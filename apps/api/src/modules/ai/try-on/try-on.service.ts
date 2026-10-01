import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { env } from "../../../env.js";
import { ApiError } from "../../../lib/errors.js";
import { mediaPublicUrl, uploadMediaObject } from "../../../lib/media-storage.js";
import { getTryOnQueue } from "../../../lib/queue.js";
import { TryOnRepository } from "./try-on.repository.js";
import {
  ALLOWED_IMAGE_MIMES,
  MAX_TRYON_IMAGE_BYTES,
  MIN_TRYON_IMAGE_BYTES,
} from "./try-on.schema.js";

export class TryOnService {
  private queue: { add: (name: string, data: any, opts?: any) => Promise<any> } | null;

  constructor(
    private repo: TryOnRepository,
    queue?: { add: (name: string, data: any, opts?: any) => Promise<any> } | null,
  ) {
    this.queue = queue !== undefined ? queue : getTryOnQueue();
  }

  async createJob(params: {
    customerId: string;
    variantId: string;
    imageBuffer: Buffer;
    imageMime: string;
    idempotencyKey?: string | null;
  }) {
    const { customerId, variantId, imageBuffer, imageMime, idempotencyKey } = params;

    // 1. Daily quota is unlimited (no restriction)

    // 2. Check idempotency if key provided
    if (idempotencyKey) {
      const existing = await this.repo.findExistingJobByIdempotency(customerId, idempotencyKey);
      if (existing) {
        return {
          id: existing.id,
          status: existing.status,
          reused: true,
        };
      }
    }

    // 3. Validate image
    if (!ALLOWED_IMAGE_MIMES.has(imageMime)) {
      throw new ApiError(
        400,
        "invalid_image_type",
        "Định dạng ảnh không hợp lệ. Chỉ chấp nhận JPEG, PNG, WebP.",
      );
    }
    if (imageBuffer.byteLength > MAX_TRYON_IMAGE_BYTES) {
      throw new ApiError(
        400,
        "image_too_large",
        "Kích thước ảnh vượt quá giới hạn tối đa 10MB.",
      );
    }
    if (imageBuffer.byteLength < MIN_TRYON_IMAGE_BYTES) {
      throw new ApiError(
        400,
        "invalid_tryon_image",
        "File ảnh bị lỗi hoặc không có nội dung.",
      );
    }

    // 4. Validate variant & product
    const variantInfo = await this.repo.findVariantWithProductAndMedia(variantId);
    if (!variantInfo) {
      throw new ApiError(404, "tryon_variant_not_found", "Không tìm thấy biến thể sản phẩm này.");
    }
    if (variantInfo.variant.variantStatus !== "active" || variantInfo.variant.productStatus !== "published") {
      throw new ApiError(400, "tryon_variant_inactive", "Sản phẩm hiện không khả dụng để thử đồ.");
    }
    if (!variantInfo.productImage) {
      throw new ApiError(400, "tryon_variant_no_image", "Sản phẩm này chưa có hình ảnh mẫu để thử.");
    }

    // 5. Store user image asset
    const sha256 = createHash("sha256").update(imageBuffer).digest("hex");
    const ext = imageMime === "image/png" ? "png" : imageMime === "image/webp" ? "webp" : "jpg";
    const storageKey = `try-on/user/${customerId}/${randomUUID()}.${ext}`;

    await uploadMediaObject(storageKey, imageBuffer, imageMime);

    const userAsset = await this.repo.createAsset({
      customerId,
      type: "USER_INPUT",
      storageKey,
      mimeType: imageMime,
      bytes: imageBuffer.byteLength,
      sha256,
      expiresAt: new Date(Date.now() + env.aiInputRetentionHours * 60 * 60 * 1000),
    });

    // 6. Create Job record
    const job = await this.repo.createJob({
      customerId,
      productId: variantInfo.variant.productId,
      variantId,
      userImageAssetId: userAsset.id,
      idempotencyKey,
      generationPromptVersion: "v1",
    });

    // 7. Enqueue in BullMQ
    if (this.queue) {
      try {
        await this.queue.add(
          "try-on",
          { jobId: job.id },
          {
            jobId: job.id,
            attempts: 1, // Do not auto-retry AI tasks to prevent multiple credit charges or timeouts
          },
        );
      } catch (err: unknown) {
        console.error("[try-on] Failed to enqueue job:", err);
        // Even if Redis is momentarily slow, job is safely created in DB
      }
    }

    return {
      id: job.id,
      status: job.status,
    };
  }

  async getJob(jobId: string, customerId: string) {
    const job = await this.repo.findJobById(jobId);
    if (!job) {
      throw new ApiError(404, "tryon_job_not_found", "Không tìm thấy phiên thử đồ.");
    }

    if (job.customerId !== customerId) {
      throw new ApiError(403, "tryon_forbidden", "Bạn không có quyền xem kết quả này.");
    }

    let resultPayload: { url: string } | null = null;
    if (job.status === "COMPLETED" && job.resultAssetId) {
      const asset = await this.repo.findAssetById(job.resultAssetId);
      if (asset) {
        resultPayload = {
          url: mediaPublicUrl(asset.storageKey),
        };
      }
    }

    let userImagePayload: { url: string } | null = null;
    if (job.userImageAssetId) {
      const uAsset = await this.repo.findAssetById(job.userImageAssetId);
      if (uAsset) {
        userImagePayload = {
          url: mediaPublicUrl(uAsset.storageKey),
        };
      }
    }

    return {
      id: job.id,
      status: job.status,
      visibility_flag: job.visibilityFlag,
      result: resultPayload,
      user_image: userImagePayload,
      error_code: job.errorCode,
      error_message: job.errorMessage,
      created_at: job.createdAt,
      started_at: job.startedAt,
      completed_at: job.completedAt,
    };
  }

  async listCustomerJobs(customerId: string) {
    const rows = await this.repo.findJobsByCustomer(customerId);
    return rows.map((r) => {
      const resUrl = r.resultStorageKey ? mediaPublicUrl(r.resultStorageKey) : null;
      const userUrl = r.userStorageKey ? mediaPublicUrl(r.userStorageKey) : null;
      return {
        id: r.id,
        status: r.status,
        created_at: r.createdAt,
        completed_at: r.completedAt,
        product: {
          id: r.productId,
          name: r.productName,
          slug: r.productSlug,
          price_vnd: r.priceVnd,
          price: r.priceVnd,
          compare_at_price_vnd: r.compareAtPriceVnd,
          image_url: r.productCoverKey ? mediaPublicUrl(r.productCoverKey) : null,
          imageUrl: r.productCoverKey ? mediaPublicUrl(r.productCoverKey) : null,
        },
        variant: {
          id: r.variantId,
          sku: r.sku,
          size: r.sizeLabel,
        },
        result_url: resUrl,
        resultUrl: resUrl,
        resultImageUrl: resUrl,
        user_image_url: userUrl,
        userImageUrl: userUrl,
        userPhotoUrl: userUrl,
      };
    });
  }

  async deleteJob(jobId: string, customerId: string): Promise<boolean> {
    return await this.repo.deleteJob(jobId, customerId);
  }
}


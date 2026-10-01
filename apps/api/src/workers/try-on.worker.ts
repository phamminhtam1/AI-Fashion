import fs from "node:fs";
import path from "node:path";
import { Worker, type Job } from "bullmq";
import { createDb } from "@elane/db";
import { createHash, randomUUID } from "node:crypto";
import { env } from "../env.js";
import { ApiError } from "../lib/errors.js";
import { mediaPublicUrl, uploadMediaObject } from "../lib/media-storage.js";
import { getRedisConnection, TRY_ON_QUEUE_NAME } from "../lib/queue.js";
import { AiWorkerClient } from "../modules/ai/try-on/ai-worker.client.js";
import { TryOnRepository } from "../modules/ai/try-on/try-on.repository.js";
import type { TryOnJobPayload } from "../modules/ai/try-on/try-on.types.js";

const db = createDb(env.databaseUrl);
const repo = new TryOnRepository(db);
const aiClient = new AiWorkerClient(env.aiWorkerUrl);

console.log("[tryon-worker] Starting worker on queue:", TRY_ON_QUEUE_NAME);

export async function processTryOnJob(job: Job<TryOnJobPayload>) {
  const { jobId } = job.data;
  console.log(`[tryon-worker] Processing job ${jobId}...`);

  const tryonJob = await repo.findJobById(jobId);
  if (!tryonJob) {
    console.warn(`[tryon-worker] Job ${jobId} not found in DB. Skipping.`);
    return;
  }

  if (tryonJob.status === "COMPLETED" || tryonJob.status === "CANCELLED") {
    console.log(`[tryon-worker] Job ${jobId} already ${tryonJob.status}. Skipping.`);
    return;
  }

  // 1. Mark status as PROCESSING
  await repo.updateJobStatus(jobId, {
    status: "PROCESSING",
    startedAt: new Date(),
    retryCount: job.attemptsMade,
  });

  try {
    // 2. Fetch user asset
    if (!tryonJob.userImageAssetId) {
      throw new ApiError(400, "invalid_tryon_image", "Không tìm thấy ảnh người dùng");
    }
    const userAsset = await repo.findAssetById(tryonJob.userImageAssetId);
    if (!userAsset) {
      throw new ApiError(400, "invalid_tryon_image", "Không tìm thấy bản ghi ảnh người dùng");
    }

    // 3. Fetch variant & product image
    const variantInfo = await repo.findVariantWithProductAndMedia(tryonJob.variantId);
    if (!variantInfo || !variantInfo.productImage) {
      throw new ApiError(404, "tryon_variant_not_found", "Không tìm thấy ảnh sản phẩm mẫu");
    }

    const userImageUrl = mediaPublicUrl(userAsset.storageKey);
    const userImagePath = path.resolve(env.uploadDir, userAsset.storageKey);

    const productImageUrl = mediaPublicUrl(variantInfo.productImage.objectKey);
    const productImagePath = path.resolve(env.uploadDir, variantInfo.productImage.objectKey);

    let cachedGarmentUrl: string | null = null;
    let cachedGarmentPath: string | null = null;
    let cachedGarmentMetadata = null;

    if (variantInfo.cachedGarmentAsset) {
      cachedGarmentUrl = mediaPublicUrl(variantInfo.cachedGarmentAsset.storageKey);
      cachedGarmentPath = path.resolve(env.uploadDir, variantInfo.cachedGarmentAsset.storageKey);
      cachedGarmentMetadata = variantInfo.variant.tryonMetadata;
    }

    // 4. Request Python AI Worker
    const aiResponse = await aiClient.generate({
      job_id: jobId,
      user_image_path: fs.existsSync(userImagePath) ? userImagePath : undefined,
      user_image_url: userImageUrl,
      product_image_path: fs.existsSync(productImagePath) ? productImagePath : undefined,
      product_image_url: productImageUrl,
      variant_id: tryonJob.variantId,
      visibility_flag: (tryonJob.visibilityFlag as any) || null,
      cached_garment_path: cachedGarmentPath && fs.existsSync(cachedGarmentPath) ? cachedGarmentPath : null,
      cached_garment_url: cachedGarmentUrl,
      cached_garment_metadata: cachedGarmentMetadata as any,
    });

    if (aiResponse.status === "failed") {
      throw new ApiError(
        500,
        aiResponse.error_code || "tryon_generation_failed",
        aiResponse.error_message || "Sinh ảnh thử đồ thất bại",
      );
    }

    // 5. Handle extracted garment caching if newly generated
    let garmentAssetId: string | null = tryonJob.garmentAssetId;
    if (aiResponse.garment && !aiResponse.garment.reused_cache) {
      let gStorageKey = aiResponse.garment.storage_key;
      let gBytes = 0;
      let gMime = "image/png";

      // If output_path provided on shared volume
      if (aiResponse.garment.output_path && fs.existsSync(aiResponse.garment.output_path)) {
        const buf = await fs.promises.readFile(aiResponse.garment.output_path);
        gBytes = buf.byteLength;
        if (!gStorageKey) {
          gStorageKey = `try-on/garments/${tryonJob.variantId}/${randomUUID()}.png`;
          await uploadMediaObject(gStorageKey, buf, gMime);
        }
      }

      if (gStorageKey) {
        const gAsset = await repo.createAsset({
          type: "GARMENT_EXTRACTED",
          storageKey: gStorageKey,
          mimeType: gMime,
          bytes: gBytes || 1024,
          sha256: aiResponse.garment.sha256 || null,
        });
        garmentAssetId = gAsset.id;

        // Cache on variant
        await repo.updateVariantGarmentCache(tryonJob.variantId, {
          garmentAssetId: gAsset.id,
          metadata: aiResponse.garment.metadata || {},
          sourceSha256: aiResponse.garment.sha256 || "",
        });
      }
    }

    // 6. Handle result image
    let resultStorageKey = aiResponse.result_storage_key;
    let resultBytes = 0;
    const resultMime = "image/png";

    if (aiResponse.result_url && (aiResponse.result_url.startsWith("http://") || aiResponse.result_url.startsWith("https://"))) {
      resultStorageKey = aiResponse.result_url;
    } else if (aiResponse.result_path && fs.existsSync(aiResponse.result_path)) {
      const buf = await fs.promises.readFile(aiResponse.result_path);
      resultBytes = buf.byteLength;
      if (!resultStorageKey) {
        resultStorageKey = `try-on/results/${tryonJob.customerId}/${jobId}.png`;
        await uploadMediaObject(resultStorageKey, buf, resultMime);
      }
    } else if (aiResponse.result_url && !resultStorageKey) {
      resultStorageKey = aiResponse.result_url;
    }

    if (!resultStorageKey) {
      throw new ApiError(500, "krea_generation_failed", "Không tìm thấy file ảnh kết quả");
    }

    const resultAsset = await repo.createAsset({
      customerId: tryonJob.customerId,
      type: "TRYON_RESULT",
      storageKey: resultStorageKey,
      mimeType: resultMime,
      bytes: resultBytes || 1024,
      expiresAt: new Date(Date.now() + env.aiResultRetentionDays * 24 * 60 * 60 * 1000),
    });

    // 7. Complete Job
    await repo.updateJobStatus(jobId, {
      status: "COMPLETED",
      visibilityFlag: aiResponse.visibility_flag,
      classifierConfidence: aiResponse.classifier?.confidence
        ? String(aiResponse.classifier.confidence)
        : null,
      garmentAssetId,
      resultAssetId: resultAsset.id,
      completedAt: new Date(),
    });

    console.log(`[tryon-worker] Job ${jobId} COMPLETED successfully!`);
  } catch (err: unknown) {
    console.error(`[tryon-worker] Job ${jobId} FAILED:`, err);

    let errorCode = "tryon_provider_failed";
    let errorMessage = "Hệ thống AI hiện đang quá tải hoặc bận xử lý. Quý khách vui lòng thử lại sau ít phút.";
    let isRetryable = true;

    if (err instanceof ApiError) {
      errorCode = err.code;
      const rawMsg = err.message || "";
      if (
        rawMsg &&
        !rawMsg.includes("{") &&
        !rawMsg.includes("Kie") &&
        !rawMsg.includes("Krea") &&
        !rawMsg.includes("code:") &&
        !rawMsg.includes("当前服务繁忙") &&
        !rawMsg.includes("HTTP ") &&
        !rawMsg.includes("JSON")
      ) {
        errorMessage = rawMsg;
      } else {
        errorMessage = "Hệ thống AI hiện đang quá tải hoặc bận xử lý. Quý khách vui lòng thử lại sau ít phút.";
      }
      if (err.status >= 400 && err.status < 500 && err.status !== 429) {
        isRetryable = false; // Never retry client validation/unauthorized errors
      }
    }

    await repo.updateJobStatus(jobId, {
      status: "FAILED",
      errorCode,
      errorMessage,
    });

    if (isRetryable && job.attemptsMade < (job.opts.attempts || 3)) {
      throw err; // Trigger BullMQ retry with exponential backoff
    }
  }
}

// Start BullMQ Worker with Concurrency = 1
export const tryOnWorker = new Worker<TryOnJobPayload>(
  TRY_ON_QUEUE_NAME,
  processTryOnJob,
  {
    connection: getRedisConnection(),
    concurrency: 1, // AI generation serialize concurrency
  },
);

tryOnWorker.on("completed", (job) => {
  console.log(`[tryon-worker] Job ${job.id} completed.`);
});

tryOnWorker.on("failed", (job, err) => {
  console.error(`[tryon-worker] Job ${job?.id} failed:`, err.message);
});

// If executed directly via CLI
if (process.argv[1]?.includes("try-on.worker")) {
  console.log("[tryon-worker] Process running. Press Ctrl+C to exit.");
  process.on("SIGINT", async () => {
    console.log("[tryon-worker] Shutting down...");
    await tryOnWorker.close();
    process.exit(0);
  });
}

import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@elane/db";
import {
  aiAssets,
  aiTryonJobs,
  mediaAssets,
  productColorways,
  productMedia,
  productVariants,
  products,
  sizes,
} from "@elane/db";
import type { AIAssetType, GarmentMetadata, TryOnStatus, VisibilityFlag } from "./try-on.types.js";

export class TryOnRepository {
  constructor(private db: Db) {}

  async countDailyJobsForCustomer(customerId: string): Promise<number> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiTryonJobs)
      .where(
        and(
          eq(aiTryonJobs.customerId, customerId),
          gte(aiTryonJobs.createdAt, twentyFourHoursAgo),
        ),
      );
    return result[0]?.count ?? 0;
  }

  async findExistingJobByIdempotency(customerId: string, idempotencyKey: string) {
    const rows = await this.db
      .select()
      .from(aiTryonJobs)
      .where(
        and(
          eq(aiTryonJobs.customerId, customerId),
          eq(aiTryonJobs.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async findVariantWithProductAndMedia(variantId: string) {
    const variants = await this.db
      .select({
        variantId: productVariants.id,
        variantStatus: productVariants.status,
        sku: productVariants.sku,
        colorwayId: productVariants.colorwayId,
        tryonAssetId: productVariants.tryonAssetId,
        tryonMetadata: productVariants.tryonMetadata,
        tryonSourceSha256: productVariants.tryonSourceSha256,
        productId: products.id,
        productName: products.name,
        productStatus: products.status,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(eq(productVariants.id, variantId))
      .limit(1);

    const variant = variants[0];
    if (!variant) return null;

    // Find best product media: prioritize colorway-specific cover, then colorway media, then product cover
    const mediaList = await this.db
      .select({
        assetId: mediaAssets.id,
        objectKey: mediaAssets.objectKey,
        mimeType: mediaAssets.mimeType,
        colorwayId: productMedia.colorwayId,
        isCover: productMedia.isCover,
        sortOrder: productMedia.sortOrder,
      })
      .from(productMedia)
      .innerJoin(mediaAssets, eq(mediaAssets.id, productMedia.assetId))
      .where(eq(productMedia.productId, variant.productId))
      .orderBy(desc(productMedia.isCover), productMedia.sortOrder);

    // Prioritize matching colorway
    const matchingColorwayMedia = mediaList.find(
      (m) => m.colorwayId === variant.colorwayId && m.isCover,
    ) || mediaList.find((m) => m.colorwayId === variant.colorwayId) || mediaList[0];

    // If variant has cached garment asset, fetch it
    let cachedGarmentAsset = null;
    if (variant.tryonAssetId) {
      const gAssets = await this.db
        .select()
        .from(aiAssets)
        .where(eq(aiAssets.id, variant.tryonAssetId))
        .limit(1);
      cachedGarmentAsset = gAssets[0] ?? null;
    }

    return {
      variant,
      productImage: matchingColorwayMedia ?? null,
      cachedGarmentAsset,
    };
  }

  async createAsset(data: {
    customerId?: string | null;
    type: AIAssetType;
    storageKey: string;
    mimeType: string;
    bytes: number;
    width?: number | null;
    height?: number | null;
    sha256?: string | null;
    sourceSha256?: string | null;
    expiresAt?: Date | null;
  }) {
    const [row] = await this.db
      .insert(aiAssets)
      .values({
        customerId: data.customerId ?? null,
        type: data.type,
        storageKey: data.storageKey,
        mimeType: data.mimeType,
        bytes: data.bytes,
        width: data.width ?? null,
        height: data.height ?? null,
        sha256: data.sha256 ?? null,
        sourceSha256: data.sourceSha256 ?? null,
        expiresAt: data.expiresAt ?? null,
      })
      .returning();
    return row;
  }

  async findAssetById(assetId: string) {
    const rows = await this.db.select().from(aiAssets).where(eq(aiAssets.id, assetId)).limit(1);
    return rows[0] ?? null;
  }

  async createJob(data: {
    customerId: string;
    productId: string;
    variantId: string;
    userImageAssetId: string;
    idempotencyKey?: string | null;
    generationPromptVersion?: string;
  }) {
    const [row] = await this.db
      .insert(aiTryonJobs)
      .values({
        customerId: data.customerId,
        productId: data.productId,
        variantId: data.variantId,
        userImageAssetId: data.userImageAssetId,
        idempotencyKey: data.idempotencyKey ?? null,
        generationPromptVersion: data.generationPromptVersion ?? "v1",
        status: "QUEUED",
      })
      .returning();
    return row;
  }

  async findJobById(jobId: string) {
    const rows = await this.db
      .select()
      .from(aiTryonJobs)
      .where(eq(aiTryonJobs.id, jobId))
      .limit(1);
    return rows[0] ?? null;
  }

  async findJobByIdAndCustomer(jobId: string, customerId: string) {
    const rows = await this.db
      .select()
      .from(aiTryonJobs)
      .where(and(eq(aiTryonJobs.id, jobId), eq(aiTryonJobs.customerId, customerId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async updateJobStatus(
    jobId: string,
    updates: {
      status: TryOnStatus;
      startedAt?: Date | null;
      completedAt?: Date | null;
      visibilityFlag?: VisibilityFlag | null;
      classifierConfidence?: string | null;
      garmentAssetId?: string | null;
      resultAssetId?: string | null;
      providerJobId?: string | null;
      errorCode?: string | null;
      errorMessage?: string | null;
      retryCount?: number;
    },
  ) {
    const setValues: Record<string, unknown> = {
      status: updates.status,
    };
    if (updates.startedAt !== undefined) setValues.startedAt = updates.startedAt;
    if (updates.completedAt !== undefined) setValues.completedAt = updates.completedAt;
    if (updates.visibilityFlag !== undefined) setValues.visibilityFlag = updates.visibilityFlag;
    if (updates.classifierConfidence !== undefined)
      setValues.classifierConfidence = updates.classifierConfidence;
    if (updates.garmentAssetId !== undefined) setValues.garmentAssetId = updates.garmentAssetId;
    if (updates.resultAssetId !== undefined) setValues.resultAssetId = updates.resultAssetId;
    if (updates.providerJobId !== undefined) setValues.providerJobId = updates.providerJobId;
    if (updates.errorCode !== undefined) setValues.errorCode = updates.errorCode;
    if (updates.errorMessage !== undefined) setValues.errorMessage = updates.errorMessage;
    if (updates.retryCount !== undefined) setValues.retryCount = updates.retryCount;

    const [row] = await this.db
      .update(aiTryonJobs)
      .set(setValues)
      .where(eq(aiTryonJobs.id, jobId))
      .returning();
    return row;
  }

  async updateVariantGarmentCache(
    variantId: string,
    data: {
      garmentAssetId: string;
      metadata: GarmentMetadata;
      sourceSha256: string;
    },
  ) {
    await this.db
      .update(productVariants)
      .set({
        tryonAssetId: data.garmentAssetId,
        tryonMetadata: data.metadata,
        tryonSourceSha256: data.sourceSha256,
        updatedAt: new Date(),
      })
      .where(eq(productVariants.id, variantId));
  }

  async findJobsByCustomer(customerId: string, limit = 50) {
    const rows = await this.db
      .select({
        id: aiTryonJobs.id,
        status: aiTryonJobs.status,
        visibilityFlag: aiTryonJobs.visibilityFlag,
        createdAt: aiTryonJobs.createdAt,
        completedAt: aiTryonJobs.completedAt,
        errorCode: aiTryonJobs.errorCode,
        errorMessage: aiTryonJobs.errorMessage,
        productId: products.id,
        productName: products.name,
        productSlug: products.slug,
        variantId: productVariants.id,
        sku: productVariants.sku,
        priceVnd: productVariants.priceVnd,
        compareAtPriceVnd: productVariants.compareAtPriceVnd,
        sizeLabel: sizes.label,
        resultStorageKey: sql<string | null>`(
          SELECT storage_key FROM ai_assets WHERE id = ${aiTryonJobs.resultAssetId}
        )`,
        userStorageKey: sql<string | null>`(
          SELECT storage_key FROM ai_assets WHERE id = ${aiTryonJobs.userImageAssetId}
        )`,
        productCoverKey: sql<string | null>`(
          SELECT ma.object_key FROM product_media pm
          JOIN media_assets ma ON ma.id = pm.asset_id
          WHERE pm.product_id = ${products.id}
          ORDER BY pm.is_cover DESC, pm.sort_order ASC
          LIMIT 1
        )`,
      })
      .from(aiTryonJobs)
      .innerJoin(products, eq(products.id, aiTryonJobs.productId))
      .innerJoin(productVariants, eq(productVariants.id, aiTryonJobs.variantId))
      .leftJoin(sizes, eq(sizes.id, productVariants.sizeId))
      .where(eq(aiTryonJobs.customerId, customerId))
      .orderBy(desc(aiTryonJobs.createdAt))
      .limit(limit);

    return rows;
  }

  async deleteJob(jobId: string, customerId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(aiTryonJobs)
      .where(and(eq(aiTryonJobs.id, jobId), eq(aiTryonJobs.customerId, customerId)))
      .returning({ id: aiTryonJobs.id });
    return deleted.length > 0;
  }
}


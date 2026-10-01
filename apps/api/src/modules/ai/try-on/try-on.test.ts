import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TryOnService } from "./try-on.service.js";
import { ApiError } from "../../../lib/errors.js";
import type { TryOnRepository } from "./try-on.repository.js";

// Mock repository for unit testing
function createMockRepo(overrides: Partial<TryOnRepository> = {}): TryOnRepository {
  return {
    countDailyJobsForCustomer: async () => 0,
    findExistingJobByIdempotency: async () => null,
    findVariantWithProductAndMedia: async () => ({
      variant: {
        variantId: "v-123",
        variantStatus: "active",
        sku: "SKU-001",
        colorwayId: "cw-1",
        tryonAssetId: null,
        tryonMetadata: null,
        tryonSourceSha256: null,
        productId: "p-123",
        productName: "Test Shirt",
        productStatus: "published",
      },
      productImage: {
        assetId: "a-1",
        objectKey: "test/product.jpg",
        mimeType: "image/jpeg",
        colorwayId: "cw-1",
        isCover: true,
        sortOrder: 0,
      },
      cachedGarmentAsset: null,
    }),
    createAsset: async (data: any) => ({
      id: "asset-uuid-123",
      ...data,
      createdAt: new Date(),
    }),
    createJob: async (data: any) => ({
      id: "job-uuid-123",
      status: "QUEUED",
      ...data,
      createdAt: new Date(),
    }),
    findJobById: async (id: string) => ({
      id,
      customerId: "cust-owner",
      productId: "p-123",
      variantId: "v-123",
      status: "COMPLETED",
      visibilityFlag: "FULL_BODY",
      resultAssetId: "asset-res-1",
      errorCode: null,
      errorMessage: null,
      createdAt: new Date(),
      startedAt: new Date(),
      completedAt: new Date(),
    }),
    findAssetById: async (id: string) => ({
      id,
      storageKey: "try-on/results/result.png",
      mimeType: "image/png",
    }),
    updateJobStatus: async () => ({} as any),
    updateVariantGarmentCache: async () => {},
    ...overrides,
  } as unknown as TryOnRepository;
}

describe("TryOnService Unit Tests", () => {
  const validBuffer = Buffer.alloc(1024, "a"); // 1KB valid dummy buffer
  const mockQueue = { add: async () => ({ id: "job-q-1" }) };

  it("1. create try-on job successfully", async () => {
    const repo = createMockRepo();
    const service = new TryOnService(repo, mockQueue);

    const result = await service.createJob({
      customerId: "cust-owner",
      variantId: "11111111-1111-1111-1111-111111111111",
      imageBuffer: validBuffer,
      imageMime: "image/jpeg",
    });

    assert.equal(result.id, "job-uuid-123");
    assert.equal(result.status, "QUEUED");
  });

  it("2. fails if image mime is invalid", async () => {
    const repo = createMockRepo();
    const service = new TryOnService(repo, mockQueue);

    await assert.rejects(
      async () => {
        await service.createJob({
          customerId: "cust-owner",
          variantId: "11111111-1111-1111-1111-111111111111",
          imageBuffer: validBuffer,
          imageMime: "application/pdf",
        });
      },
      (err: any) => {
        assert.equal(err instanceof ApiError, true);
        assert.equal(err.code, "invalid_image_type");
        return true;
      },
    );
  });

  it("3. user cannot read other's job (tryon_forbidden)", async () => {
    const repo = createMockRepo({
      findJobById: async (id: string) => ({
        id,
        customerId: "another-customer-id",
        status: "COMPLETED",
      } as any),
    });
    const service = new TryOnService(repo);

    await assert.rejects(
      async () => {
        await service.getJob("job-123", "current-customer-id");
      },
      (err: any) => {
        assert.equal(err instanceof ApiError, true);
        assert.equal(err.code, "tryon_forbidden");
        assert.equal(err.status, 403);
        return true;
      },
    );
  });

  it("4. try-on attempts are unlimited (no daily quota restriction)", async () => {
    const repo = createMockRepo({
      countDailyJobsForCustomer: async () => 999, // Many past jobs, still allowed
    });
    const service = new TryOnService(repo, mockQueue);

    const result = await service.createJob({
      customerId: "cust-unlimited",
      variantId: "11111111-1111-1111-1111-111111111111",
      imageBuffer: validBuffer,
      imageMime: "image/jpeg",
    });

    assert.equal(result.id, "job-uuid-123");
    assert.equal(result.status, "QUEUED");
  });
});

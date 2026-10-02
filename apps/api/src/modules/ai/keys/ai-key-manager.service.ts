import { and, asc, desc, eq, isNull, lt, or } from "drizzle-orm";
import type { Db } from "@elane/db";
import { aiApiKeys } from "@elane/db";
import { ApiError } from "../../../lib/errors.js";
import { decryptApiKey, encryptApiKey, maskApiKey } from "../../../lib/crypto-keys.js";

export interface KeyCreditCheckResult {
  ok: boolean;
  credits?: number;
  error?: string;
  statusCode?: number;
}

export class AiKeyManagerService {
  constructor(private db: Db) {}

  /**
   * Directly queries Kie.ai API with the given raw API key to test connectivity and retrieve remaining credits.
   */
  async checkKieCredits(rawKey: string): Promise<KeyCreditCheckResult> {
    const key = rawKey.trim();
    if (!key) {
      return { ok: false, error: "API Key không được để trống" };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const resp = await fetch("https://api.kie.ai/api/v1/chat/credit", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (resp.status === 401 || resp.status === 403) {
        return {
          ok: false,
          statusCode: resp.status,
          error: "API Key không hợp lệ hoặc tài khoản đã bị khóa",
        };
      }

      if (!resp.ok) {
        return {
          ok: false,
          statusCode: resp.status,
          error: `Kie.ai trả về mã lỗi HTTP ${resp.status}`,
        };
      }

      const body = (await resp.json()) as { code?: number; msg?: string; data?: number };
      if (body && typeof body.data === "number") {
        return {
          ok: true,
          credits: body.data,
          statusCode: 200,
        };
      }

      return {
        ok: true,
        credits: 0,
        statusCode: 200,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: `Không thể kết nối tới Kie.ai (${msg})`,
      };
    }
  }

  /**
   * Lists all registered keys with masked preview and operational status.
   * Encrypted ciphertext is intentionally excluded for security.
   */
  async listKeys() {
    const rows = await this.db
      .select({
        id: aiApiKeys.id,
        provider: aiApiKeys.provider,
        label: aiApiKeys.label,
        maskedKey: aiApiKeys.maskedKey,
        status: aiApiKeys.status,
        creditsRemaining: aiApiKeys.creditsRemaining,
        cooldownUntil: aiApiKeys.cooldownUntil,
        priority: aiApiKeys.priority,
        successCount: aiApiKeys.successCount,
        errorCount: aiApiKeys.errorCount,
        lastErrorMessage: aiApiKeys.lastErrorMessage,
        lastUsedAt: aiApiKeys.lastUsedAt,
        lastCheckedAt: aiApiKeys.lastCheckedAt,
        createdAt: aiApiKeys.createdAt,
        updatedAt: aiApiKeys.updatedAt,
      })
      .from(aiApiKeys)
      .orderBy(desc(aiApiKeys.priority), desc(aiApiKeys.createdAt));

    return rows;
  }

  /**
   * Registers a new AI API key, automatically tests validity & credits against provider.
   */
  async createKey(input: {
    provider?: string;
    label: string;
    rawKey: string;
    priority?: number;
  }) {
    const provider = (input.provider || "kie").toLowerCase().trim();
    const label = input.label?.trim();
    const rawKey = input.rawKey?.trim();
    const priority = Number(input.priority ?? 1);

    if (!label) {
      throw new ApiError(400, "invalid_input", "Vui lòng nhập tên/nhãn gợi nhớ cho Key");
    }
    if (!rawKey) {
      throw new ApiError(400, "invalid_input", "Vui lòng nhập chuỗi API Key");
    }

    let initialCredits: number | null = null;
    let initialStatus = "ACTIVE";

    // Validate key with Kie.ai if provider is kie
    if (provider === "kie") {
      const check = await this.checkKieCredits(rawKey);
      if (!check.ok) {
        throw new ApiError(400, "invalid_api_key", check.error || "API Key không hợp lệ");
      }
      initialCredits = check.credits ?? null;
      if (initialCredits === 0) {
        initialStatus = "EXHAUSTED";
      }
    }

    const encryptedKey = encryptApiKey(rawKey);
    const maskedKey = maskApiKey(rawKey);

    const [created] = await this.db
      .insert(aiApiKeys)
      .values({
        provider,
        label,
        encryptedKey,
        maskedKey,
        status: initialStatus,
        creditsRemaining: initialCredits,
        priority,
        lastCheckedAt: new Date(),
      })
      .returning({
        id: aiApiKeys.id,
        provider: aiApiKeys.provider,
        label: aiApiKeys.label,
        maskedKey: aiApiKeys.maskedKey,
        status: aiApiKeys.status,
        creditsRemaining: aiApiKeys.creditsRemaining,
        priority: aiApiKeys.priority,
        createdAt: aiApiKeys.createdAt,
      });

    return created;
  }

  /**
   * Updates an existing key's label, priority, status, or replaces the raw key.
   */
  async updateKey(
    id: string,
    input: {
      label?: string;
      priority?: number;
      status?: "ACTIVE" | "RATE_LIMITED" | "EXHAUSTED" | "REVOKED" | "DISABLED";
      rawKey?: string;
    },
  ) {
    const existing = await this.db.select().from(aiApiKeys).where(eq(aiApiKeys.id, id)).limit(1);
    if (!existing[0]) {
      throw new ApiError(404, "not_found", "Không tìm thấy API Key");
    }

    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.label !== undefined) updatePayload.label = input.label.trim();
    if (input.priority !== undefined) updatePayload.priority = Number(input.priority);
    if (input.status !== undefined) {
      updatePayload.status = input.status;
      if (input.status === "ACTIVE") {
        updatePayload.cooldownUntil = null;
        updatePayload.errorCount = 0;
      }
    }

    if (input.rawKey && input.rawKey.trim()) {
      const rawKey = input.rawKey.trim();
      if (existing[0].provider === "kie") {
        const check = await this.checkKieCredits(rawKey);
        if (!check.ok) {
          throw new ApiError(400, "invalid_api_key", check.error || "Key mới không hợp lệ");
        }
        updatePayload.creditsRemaining = check.credits ?? null;
        updatePayload.status = (check.credits ?? 1) > 0 ? "ACTIVE" : "EXHAUSTED";
        updatePayload.lastCheckedAt = new Date();
      }
      updatePayload.encryptedKey = encryptApiKey(rawKey);
      updatePayload.maskedKey = maskApiKey(rawKey);
    }

    const [updated] = await this.db
      .update(aiApiKeys)
      .set(updatePayload)
      .where(eq(aiApiKeys.id, id))
      .returning({
        id: aiApiKeys.id,
        provider: aiApiKeys.provider,
        label: aiApiKeys.label,
        maskedKey: aiApiKeys.maskedKey,
        status: aiApiKeys.status,
        creditsRemaining: aiApiKeys.creditsRemaining,
        priority: aiApiKeys.priority,
        updatedAt: aiApiKeys.updatedAt,
      });

    return updated;
  }

  /**
   * Refreshes the credit balance of a specific key against the provider.
   */
  async refreshKeyCredits(id: string) {
    const existing = await this.db.select().from(aiApiKeys).where(eq(aiApiKeys.id, id)).limit(1);
    if (!existing[0]) {
      throw new ApiError(404, "not_found", "Không tìm thấy API Key");
    }

    const rawKey = decryptApiKey(existing[0].encryptedKey);
    if (existing[0].provider !== "kie") {
      return existing[0];
    }

    const check = await this.checkKieCredits(rawKey);
    const now = new Date();

    if (!check.ok) {
      const isAuthError = check.statusCode === 401 || check.statusCode === 403;
      await this.db
        .update(aiApiKeys)
        .set({
          status: isAuthError ? "REVOKED" : existing[0].status,
          lastErrorMessage: check.error,
          lastCheckedAt: now,
          updatedAt: now,
        })
        .where(eq(aiApiKeys.id, id));

      return {
        ...existing[0],
        status: isAuthError ? "REVOKED" : existing[0].status,
        lastErrorMessage: check.error,
        lastCheckedAt: now,
      };
    }

    const credits = check.credits ?? 0;
    const newStatus = credits === 0 ? "EXHAUSTED" : existing[0].status === "EXHAUSTED" ? "ACTIVE" : existing[0].status;

    const [updated] = await this.db
      .update(aiApiKeys)
      .set({
        creditsRemaining: credits,
        status: newStatus,
        lastErrorMessage: null,
        lastCheckedAt: now,
        updatedAt: now,
      })
      .where(eq(aiApiKeys.id, id))
      .returning();

    return updated;
  }

  /**
   * Refreshes credit balances for all active and exhausted keys.
   */
  async refreshAllKeys() {
    const keys = await this.db.select().from(aiApiKeys);
    const results = [];
    for (const key of keys) {
      try {
        const updated = await this.refreshKeyCredits(key.id);
        results.push(updated);
      } catch (err: unknown) {
        console.error(`Failed to refresh key ${key.id}:`, err);
      }
    }
    return results;
  }

  /**
   * Deletes an API key record.
   */
  async deleteKey(id: string) {
    const [deleted] = await this.db
      .delete(aiApiKeys)
      .where(eq(aiApiKeys.id, id))
      .returning({ id: aiApiKeys.id });
    return { success: !!deleted, id };
  }

  /**
   * Intelligent key picker for worker execution.
   * Selects an ACTIVE key with expired cooldown, sorted by priority (high to low),
   * then highest remaining credits, then least recently used.
   */
  async acquireActiveKey(provider = "kie"): Promise<{
    id: string;
    rawKey: string;
    label: string;
    creditsRemaining: number | null;
  } | null> {
    const now = new Date();

    const candidates = await this.db
      .select()
      .from(aiApiKeys)
      .where(
        and(
          eq(aiApiKeys.provider, provider),
          eq(aiApiKeys.status, "ACTIVE"),
          or(isNull(aiApiKeys.cooldownUntil), lt(aiApiKeys.cooldownUntil, now)),
        ),
      )
      .orderBy(
        desc(aiApiKeys.priority),
        desc(aiApiKeys.creditsRemaining),
        asc(aiApiKeys.lastUsedAt),
      );

    // Filter out candidates with 0 credits and auto-mark them
    for (const candidate of candidates) {
      if (candidate.creditsRemaining !== null && candidate.creditsRemaining <= 0) {
        void this.db
          .update(aiApiKeys)
          .set({ status: "EXHAUSTED", updatedAt: now })
          .where(eq(aiApiKeys.id, candidate.id));
        continue;
      }

      try {
        const rawKey = decryptApiKey(candidate.encryptedKey);
        return {
          id: candidate.id,
          rawKey,
          label: candidate.label,
          creditsRemaining: candidate.creditsRemaining,
        };
      } catch (err) {
        console.error(`Failed to decrypt key ${candidate.id}:`, err);
      }
    }

    return null;
  }

  /**
   * Records successful usage of a key.
   */
  async recordSuccess(keyId: string) {
    const now = new Date();
    const existing = await this.db
      .select({ credits: aiApiKeys.creditsRemaining })
      .from(aiApiKeys)
      .where(eq(aiApiKeys.id, keyId))
      .limit(1);

    const currentCredits = existing[0]?.credits;
    const nextCredits =
      currentCredits !== null && currentCredits !== undefined && currentCredits > 0
        ? currentCredits - 1
        : currentCredits;

    await this.db
      .update(aiApiKeys)
      .set({
        successCount: (await this.db.select({ count: aiApiKeys.successCount }).from(aiApiKeys).where(eq(aiApiKeys.id, keyId)))[0]?.count! + 1,
        creditsRemaining: nextCredits,
        errorCount: 0,
        lastErrorMessage: null,
        lastUsedAt: now,
        updatedAt: now,
      })
      .where(eq(aiApiKeys.id, keyId));
  }

  /**
   * Records failure and automatically triggers key state transition (RATE_LIMITED, EXHAUSTED, REVOKED).
   */
  async recordFailure(
    keyId: string,
    reason: "RATE_LIMITED" | "EXHAUSTED" | "REVOKED",
    errorMsg?: string,
  ) {
    const now = new Date();
    const payload: Record<string, unknown> = {
      status: reason,
      lastErrorMessage: errorMsg || null,
      updatedAt: now,
    };

    if (reason === "RATE_LIMITED") {
      // 1 minute cooldown
      payload.cooldownUntil = new Date(Date.now() + 60 * 1000);
    } else if (reason === "EXHAUSTED") {
      payload.creditsRemaining = 0;
    }

    await this.db.update(aiApiKeys).set(payload).where(eq(aiApiKeys.id, keyId));
  }
}

import { eq, inArray } from "drizzle-orm";
import { settings, type Db } from "@elane/db";

export type StoreSettings = {
  brand: { name: string; tagline: string; supportEmail: string; supportPhone: string };
  payments: { codEnabled: boolean; bankEnabled: boolean };
  shipping: {
    freeShippingFromVnd: number;
    feeVnd: number;
    cityDeliveryDays: string;
    otherDeliveryDays: string;
  };
  returns: { returnWindowDays: number; refundWindow: string; conditions: string };
  notifications: { newOrder: boolean; paymentSuccess: boolean; lowStock: boolean };
  bankTransferConfigured: boolean;
  updatedAt: string | null;
};

export type StoreSettingsInput = Omit<StoreSettings, "bankTransferConfigured" | "updatedAt">;

export const DEFAULT_STORE_SETTINGS: StoreSettingsInput = {
  brand: {
    name: "ÉLANE",
    tagline: "Modern Femininity",
    supportEmail: "hello@elane.vn",
    supportPhone: "1900 0000",
  },
  payments: { codEnabled: true, bankEnabled: true },
  shipping: {
    freeShippingFromVnd: 1_000_000,
    feeVnd: 30_000,
    cityDeliveryDays: "1–2 ngày làm việc",
    otherDeliveryDays: "2–4 ngày làm việc",
  },
  returns: {
    returnWindowDays: 30,
    refundWindow: "5–7 ngày làm việc",
    conditions: "Sản phẩm còn nguyên tem mác, chưa qua sử dụng, giặt tẩy. Phụ kiện trang sức không áp dụng đổi trả vì lý do vệ sinh.",
  },
  notifications: { newOrder: true, paymentSuccess: true, lowStock: true },
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export async function readStoreSettings(db: Db, bankTransferConfigured: boolean): Promise<StoreSettings> {
  const rows = await db.select().from(settings).where(inArray(settings.key, ["brand", "storefront", "notifications"]));
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const brandRow = asRecord(byKey.get("brand")?.value);
  const storefrontRow = asRecord(byKey.get("storefront")?.value);
  const notificationsRow = asRecord(byKey.get("notifications")?.value);
  const paymentRow = asRecord(storefrontRow.payments);
  const shippingRow = asRecord(storefrontRow.shipping);
  const returnsRow = asRecord(storefrontRow.returns);
  const timestamps = rows.map((row) => row.updatedAt?.getTime() ?? 0);
  const latest = timestamps.length ? Math.max(...timestamps) : 0;

  return {
    brand: {
      name: asString(brandRow.name, DEFAULT_STORE_SETTINGS.brand.name),
      tagline: asString(brandRow.tagline, DEFAULT_STORE_SETTINGS.brand.tagline),
      supportEmail: asString(brandRow.supportEmail, DEFAULT_STORE_SETTINGS.brand.supportEmail),
      supportPhone: asString(brandRow.supportPhone, DEFAULT_STORE_SETTINGS.brand.supportPhone),
    },
    payments: {
      codEnabled: asBoolean(paymentRow.codEnabled, DEFAULT_STORE_SETTINGS.payments.codEnabled),
      bankEnabled: asBoolean(paymentRow.bankEnabled, DEFAULT_STORE_SETTINGS.payments.bankEnabled) && bankTransferConfigured,
    },
    shipping: {
      freeShippingFromVnd: asNumber(shippingRow.freeShippingFromVnd, asNumber(brandRow.freeShippingFromVnd, DEFAULT_STORE_SETTINGS.shipping.freeShippingFromVnd)),
      feeVnd: asNumber(shippingRow.feeVnd, DEFAULT_STORE_SETTINGS.shipping.feeVnd),
      cityDeliveryDays: asString(shippingRow.cityDeliveryDays, DEFAULT_STORE_SETTINGS.shipping.cityDeliveryDays),
      otherDeliveryDays: asString(shippingRow.otherDeliveryDays, DEFAULT_STORE_SETTINGS.shipping.otherDeliveryDays),
    },
    returns: {
      returnWindowDays: asNumber(returnsRow.returnWindowDays, DEFAULT_STORE_SETTINGS.returns.returnWindowDays),
      refundWindow: asString(returnsRow.refundWindow, DEFAULT_STORE_SETTINGS.returns.refundWindow),
      conditions: asString(returnsRow.conditions, DEFAULT_STORE_SETTINGS.returns.conditions),
    },
    notifications: {
      newOrder: asBoolean(notificationsRow.newOrder, DEFAULT_STORE_SETTINGS.notifications.newOrder),
      paymentSuccess: asBoolean(notificationsRow.paymentSuccess, DEFAULT_STORE_SETTINGS.notifications.paymentSuccess),
      lowStock: asBoolean(notificationsRow.lowStock, DEFAULT_STORE_SETTINGS.notifications.lowStock),
    },
    bankTransferConfigured,
    updatedAt: latest ? new Date(latest).toISOString() : null,
  };
}

export function toPublicStoreSettings(value: StoreSettings) {
  return {
    brand: value.brand,
    payments: {
      codEnabled: value.payments.codEnabled,
      bankEnabled: value.payments.bankEnabled && value.bankTransferConfigured,
    },
    shipping: value.shipping,
    returns: value.returns,
  };
}

export async function writeStoreSettings(db: Db, accountId: string, value: StoreSettingsInput) {
  const current = await db.select().from(settings).where(eq(settings.key, "brand")).limit(1);
  const existingBrand = asRecord(current[0]?.value);
  const brandValue = {
    ...existingBrand,
    name: value.brand.name,
    tagline: value.brand.tagline,
    supportEmail: value.brand.supportEmail,
    supportPhone: value.brand.supportPhone,
    freeShippingFromVnd: value.shipping.freeShippingFromVnd,
  };
  const storefrontValue = { payments: value.payments, shipping: value.shipping, returns: value.returns };
  const now = new Date();

  await db.transaction(async (tx) => {
    for (const row of [
      { key: "brand", value: brandValue, visibility: "public" },
      { key: "storefront", value: storefrontValue, visibility: "public" },
      { key: "notifications", value: value.notifications, visibility: "internal" },
    ]) {
      await tx.insert(settings).values({ ...row, updatedBy: accountId, updatedAt: now })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: row.value, visibility: row.visibility, updatedBy: accountId, updatedAt: now },
        });
    }
  });
}

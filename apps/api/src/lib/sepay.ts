import crypto from "node:crypto";

const ORDER_RE = /\b(ELN\d+)\b/i;

export function verifySepayHmac(
  rawBody: string,
  signatureHeader: string,
  timestampHeader: string,
  secret: string,
  nowSec = Math.floor(Date.now() / 1000),
): boolean {
  const timestamp = Number(timestampHeader);
  if (!secret || !Number.isFinite(timestamp)) return false;
  if (Math.abs(nowSec - timestamp) > 300) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function extractOrderNumber(
  code: string | null | undefined,
  content: string,
): string | null {
  if (code && /^ELN\d+$/i.test(code.trim())) return code.trim().toUpperCase();
  const m = content.match(ORDER_RE);
  return m?.[1]?.toUpperCase() ?? null;
}

export function shouldConfirmBankPayment(input: {
  transferType: string;
  transferAmount: number;
  orderGrandTotal: number;
  orderNumber: string;
  code: string | null;
  content: string;
}): boolean {
  if (input.transferType !== "in") return false;
  if (input.transferAmount !== input.orderGrandTotal) return false;
  const found = extractOrderNumber(input.code, input.content);
  return found === input.orderNumber.toUpperCase();
}

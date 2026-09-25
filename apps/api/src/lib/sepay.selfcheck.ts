import assert from "node:assert/strict";
import crypto from "node:crypto";
import { extractOrderNumber, shouldConfirmBankPayment, verifySepayHmac } from "./sepay.js";

const secret = "test-secret";
const body = JSON.stringify({ id: 1 });
const ts = Math.floor(Date.now() / 1000);
const sig =
  "sha256=" +
  crypto.createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");

assert.equal(verifySepayHmac(body, sig, String(ts), secret), true);
assert.equal(verifySepayHmac(body, "sha256=dead", String(ts), secret), false);
assert.equal(verifySepayHmac(body, sig, String(ts - 400), secret), false);

assert.equal(extractOrderNumber("ELN123", "foo ELN123 bar"), "ELN123");
assert.equal(extractOrderNumber(null, "CK ELN999 xyz"), "ELN999");
assert.equal(extractOrderNumber(null, "no code here"), null);

assert.equal(
  shouldConfirmBankPayment({
    transferType: "in",
    transferAmount: 500000,
    orderGrandTotal: 500000,
    orderNumber: "ELN1",
    code: "ELN1",
    content: "ELN1",
  }),
  true,
);
assert.equal(
  shouldConfirmBankPayment({
    transferType: "in",
    transferAmount: 1,
    orderGrandTotal: 500000,
    orderNumber: "ELN1",
    code: "ELN1",
    content: "ELN1",
  }),
  false,
);

console.log("sepay.selfcheck: ok");

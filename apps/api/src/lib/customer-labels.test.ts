import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  segmentLabelVi,
  statusLabelVi,
  normalizeCountSeries,
  segmentFromSpend,
  SPEND_LOYAL_MIN,
  SPEND_VIP_MIN,
} from "./customer-labels.js";

describe("customer-labels", () => {
  it("segmentLabelVi", () => {
    assert.equal(segmentLabelVi("new"), "Mới");
    assert.equal(segmentLabelVi("loyal"), "Thân thiết");
    assert.equal(segmentLabelVi("vip"), "VIP");
  });

  it("statusLabelVi", () => {
    assert.equal(statusLabelVi("active"), "Đang hoạt động");
    assert.equal(statusLabelVi("blocked"), "Đã khóa");
  });

  it("normalizeCountSeries fills zeros", () => {
    assert.deepEqual(normalizeCountSeries([{ key: "vip", count: 2 }], ["new", "loyal", "vip"]), [
      { key: "new", count: 0 },
      { key: "loyal", count: 0 },
      { key: "vip", count: 2 },
    ]);
  });

  it("segmentFromSpend tiers", () => {
    assert.equal(segmentFromSpend(0), "new");
    assert.equal(segmentFromSpend(SPEND_LOYAL_MIN - 1), "new");
    assert.equal(segmentFromSpend(SPEND_LOYAL_MIN), "loyal");
    assert.equal(segmentFromSpend(30_000_000), "loyal");
    assert.equal(segmentFromSpend(SPEND_VIP_MIN), "loyal");
    assert.equal(segmentFromSpend(SPEND_VIP_MIN + 1), "vip");
    assert.equal(segmentFromSpend(120_000_000), "vip");
  });
});

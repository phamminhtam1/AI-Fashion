/** Pure order helpers — shipping, stock available, order numbers. */

export function availableQty(onHand: number, reserved: number): number {
  return Math.max(0, onHand - reserved);
}

export function shippingFeeVnd(subtotalVnd: number, freeShipAt = 1_000_000, fee = 30_000): number {
  return subtotalVnd >= freeShipAt ? 0 : fee;
}

export function newOrderNumber(_now = new Date()): string {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `ELN${n}`;
}

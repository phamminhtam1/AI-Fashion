export type DocType = "receipt" | "issue" | "adjustment";

export function defaultDirection(
  type: DocType,
  lineDirection?: "in" | "out",
): "in" | "out" {
  if (type === "receipt") return "in";
  if (type === "issue") return "out";
  return lineDirection ?? "in";
}

export type StockRow = { available: number; reorder_point: number };

export function isLowStock(row: StockRow): boolean {
  return row.available <= row.reorder_point;
}

export function isOutOfStock(row: StockRow): boolean {
  return row.available === 0;
}

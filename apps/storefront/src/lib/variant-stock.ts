export type StockVariant = {
  id: string;
  colorwayId: string;
  size: string;
  available: number;
};

export function findVariant(
  variants: StockVariant[],
  colorwayId: string,
  size: string,
): StockVariant | undefined {
  return variants.find(
    (v) => v.size === size && (!colorwayId || v.colorwayId === colorwayId),
  );
}

export function isSizeInStock(
  variants: StockVariant[],
  colorwayId: string,
  size: string,
): boolean {
  const v = findVariant(variants, colorwayId, size);
  return (v?.available ?? 0) > 0;
}

export function colorwayHasStock(
  variants: StockVariant[],
  colorwayId: string,
  sizes: string[],
): boolean {
  return sizes.some((s) => isSizeInStock(variants, colorwayId, s));
}

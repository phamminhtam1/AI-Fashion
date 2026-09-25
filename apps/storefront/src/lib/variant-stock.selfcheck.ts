import { colorwayHasStock, isSizeInStock } from "./variant-stock";

type V = { id: string; colorwayId: string; size: string; available: number };

const variants: V[] = [
  { id: "1", colorwayId: "cwA", size: "M", available: 2 },
  { id: "2", colorwayId: "cwA", size: "L", available: 0 },
  { id: "3", colorwayId: "cwB", size: "M", available: 0 },
];

console.assert(isSizeInStock(variants, "cwA", "M") === true, "M in stock");
console.assert(isSizeInStock(variants, "cwA", "L") === false, "L OOS");
console.assert(isSizeInStock(variants, "cwA", "S") === false, "missing size OOS");
console.assert(isSizeInStock(variants, "cwB", "M") === false, "zero available OOS");
console.assert(colorwayHasStock(variants, "cwA", ["M", "L"]) === true, "cwA has stock");
console.assert(colorwayHasStock(variants, "cwB", ["M", "L"]) === false, "cwB empty");
console.log("variant-stock.selfcheck: ok");

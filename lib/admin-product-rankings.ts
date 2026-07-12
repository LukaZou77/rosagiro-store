export type ProductMetricRankInput = {
  productKey: string;
  value: number;
  tieBreaker: number;
};

export function rankProductMetricRows(rows: ProductMetricRankInput[]) {
  return [...rows]
    .filter((row) => row.value > 0)
    .sort(
      (left, right) =>
        right.value - left.value ||
        right.tieBreaker - left.tieBreaker ||
        left.productKey.localeCompare(right.productKey)
    )
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

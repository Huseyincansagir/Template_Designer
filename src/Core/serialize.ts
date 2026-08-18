/**
 * Canonical, key-order-insensitive JSON serialization. Used by the package
 * builder (stable manifests/checksums) and by the dirty-state comparison so
 * that logically identical projects serialize identically regardless of
 * construction-time key order.
 */
export function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`;
}

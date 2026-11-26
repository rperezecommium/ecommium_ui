export const productListColumnKeys = [
  "id", "image", "reference", "category", "price", "quantity", "visibility", "status", "media",
] as const;

export type ProductListView = { columns: string[]; limit: number };

export function parseProductListView(value: unknown): ProductListView | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== "columns" && key !== "limit")) return null;
  if (!Array.isArray(record.columns) || record.columns.length < 1 || record.columns.length > productListColumnKeys.length) return null;
  if (!record.columns.every((key) => typeof key === "string" && productListColumnKeys.some((known) => known === key))) return null;
  if (new Set(record.columns).size !== record.columns.length) return null;
  if (typeof record.limit !== "number" || !Number.isInteger(record.limit) || record.limit < 1 || record.limit > 200) return null;
  const selected = new Set(record.columns);
  return { columns: productListColumnKeys.filter((key) => selected.has(key)), limit: record.limit };
}

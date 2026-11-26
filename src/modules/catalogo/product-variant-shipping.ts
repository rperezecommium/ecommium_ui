import type { ProductShippingDraft } from "./product-editor-types";

export function parseShippingPackageOverride(value: unknown): Partial<ProductShippingDraft["package"]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Las medidas propias deben ser un objeto.");
  const result: Partial<ProductShippingDraft["package"]> = {};
  for (const [key, measurement] of Object.entries(value)) {
    if (!["weightGrams", "widthMm", "heightMm", "depthMm"].includes(key)) throw new Error("Medida de transporte desconocida.");
    if (measurement === null) continue;
    if (typeof measurement !== "number" || !Number.isSafeInteger(measurement) || measurement < 0) throw new Error("Las medidas de transporte deben ser enteros mayores o iguales a cero.");
    result[key as keyof typeof result] = measurement;
  }
  return result;
}

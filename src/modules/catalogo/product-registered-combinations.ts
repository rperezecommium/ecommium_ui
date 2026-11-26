import { slugifyProductValue } from "./product-editor-draft";
import type { ProductDraftVariantOption, ProductSpecificationLookupField } from "./product-editor-types";

export function registeredVariantSku(parentSku: string, options: ProductDraftVariantOption[], fallback = "V1") {
  const suffix = options.filter((option) => option.isActive !== false && !option.markedForDeletion)
    .map((option) => option.valueCode).filter(Boolean).join("-") || fallback;
  const normalizedSuffix = slugifyProductValue(suffix).toUpperCase();
  const base = parentSku.trim() || "PRODUCTO";
  const full = `${base}-${normalizedSuffix}`;
  if (full.length <= 64) return full;
  let hash = 2166136261;
  for (const character of full) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `${base.slice(0, 30)}-${normalizedSuffix.slice(0, 24)}-${(hash >>> 0).toString(36).toUpperCase()}`;
}

export function registeredVariantName(productName: string, options: ProductDraftVariantOption[], fields: ProductSpecificationLookupField[]) {
  const values = options.filter((option) => option.isActive !== false && !option.markedForDeletion).map((option) => {
    const field = fields.find((item) => item.fieldId === option.attributeCode || slugifyProductValue(item.name) === option.attributeCode);
    const value = field?.values.find((item) => item.fieldValueId === option.valueCode || slugifyProductValue(item.name) === option.valueCode);
    const label = option.valueCode.replace(/-/g, " ");
    return value?.name ?? (label.charAt(0).toLocaleUpperCase() + label.slice(1));
  }).filter(Boolean);
  return [productName.trim() || "Producto", ...values].join(" / ");
}

export function registeredCombinations(fields: ProductSpecificationLookupField[], categoryId: string, selections: Record<string, string[]>) {
  const dimensions: ProductDraftVariantOption[][] = [];
  const codes = new Set<string>();
  let total = 1;
  for (const [fieldId, selectedIds] of Object.entries(selections)) {
    if (!selectedIds.length) continue;
    const field = fields.find((item) => item.fieldId === fieldId && item.isActive && item.isStockKeepingUnit && item.categoryIds?.includes(categoryId));
    if (!field) return { error: "Un atributo ya no está disponible para esta categoría.", combinations: [] };
    const attributeCode = slugifyProductValue(field.name);
    if (!attributeCode || codes.has(attributeCode)) return { error: "Hay atributos con códigos coincidentes. Revisa el catálogo antes de generar.", combinations: [] };
    codes.add(attributeCode);
    const values: ProductDraftVariantOption[] = [];
    const valueCodes = new Set<string>();
    for (const id of new Set(selectedIds)) {
      const value = field.values.find((item) => item.fieldValueId === id && item.isActive);
      if (!value) return { error: "Un valor seleccionado ya no está disponible. Revisa los atributos.", combinations: [] };
      const valueCode = slugifyProductValue(value.name);
      if (!valueCode || valueCodes.has(valueCode)) return { error: "Hay valores con códigos coincidentes. Revisa el catálogo antes de generar.", combinations: [] };
      valueCodes.add(valueCode);
      values.push({ attributeCode, valueCode, isActive: true, createdInDraft: true });
    }
    total *= values.length;
    if (total > 100) return { error: "Selecciona menos valores: el máximo por generación es de 100 combinaciones.", combinations: [] };
    dimensions.push(values);
  }
  if (!dimensions.length) return { error: "Selecciona al menos un valor de un atributo registrado.", combinations: [] };
  let combinations: ProductDraftVariantOption[][] = [[]];
  for (const values of dimensions) combinations = combinations.flatMap((combination) => values.map((value) => [...combination, value]));
  return { error: null, combinations };
}

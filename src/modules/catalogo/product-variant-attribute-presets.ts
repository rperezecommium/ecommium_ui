import type { CatalogSpecificationField } from "./catalog-attributes-features";
import type { ProductSpecificationLookupField } from "./product-editor-types";

export const commonVariantAttributes = [
  { name: "Talla", values: ["XS", "S", "M", "L", "XL", "XXL"] },
  { name: "Color", values: ["Negro", "Blanco", "Gris", "Rojo", "Azul", "Verde", "Amarillo", "Naranja", "Rosa", "Marrón"] },
  { name: "Acabado", values: ["Mate", "Brillante", "Satinado"] },
];

export function variantAttributeCatalog(fields: CatalogSpecificationField[]): ProductSpecificationLookupField[] {
  return fields.filter((field) => field.isActive && field.isStockKeepingUnit).map((field) => ({
    fieldId: field.fieldId, groupId: field.groupId, groupName: field.groupName,
    name: field.name, isStockKeepingUnit: true, isActive: true,
    values: field.values.filter((value) => value.isActive).map((value) => ({ fieldValueId: value.fieldValueId, name: value.name, isActive: true })),
  }));
}

"use server";

import { getCurrentAdminSession } from "../auth/current-admin-session";
import { getAdminContext } from "../../shared/config/admin-context";
import { createCatalogSpecificationField, listCatalogAttributeFeatureData } from "./catalog-attributes-features";
import { commonVariantAttributes, variantAttributeCatalog } from "./product-variant-attribute-presets";

export async function createCommonVariantAttributes(categoryId: string) {
  const session = await getCurrentAdminSession();
  if (!session?.permissions.some((permission) => ["*", "admin:*", "system.admin", "catalog.specifications.write"].includes(permission))) {
    return { ok: false as const, message: "No tienes permiso para crear atributos.", fields: [] };
  }
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(categoryId)) {
    return { ok: false as const, message: "Selecciona primero una categoría válida en Ajustes básicos.", fields: [] };
  }
  const context = await getAdminContext();
  const data = await listCatalogAttributeFeatureData(context);
  if (data.source === "unavailable") return { ok: false as const, message: data.message ?? "No se pudo consultar el catálogo de atributos.", fields: [] };
  const fields = [...data.fields];
  for (const preset of commonVariantAttributes) {
    if (fields.some((field) => field.isStockKeepingUnit && field.isActive && field.name.trim().toLocaleLowerCase() === preset.name.toLocaleLowerCase())) continue;
    const result = await createCatalogSpecificationField(context, {
      tab: "attributes", categoryId, groupName: `Variantes · ${preset.name}`, name: preset.name,
      values: preset.values, isActive: true, isFilter: true, isOnProductDetails: true,
    });
    if (!result.ok) return { ok: false as const, message: `No se pudo crear ${preset.name}. ${result.error}`, fields: variantAttributeCatalog(fields) };
    const confirmed = result.data.fields.find((field) => field.name === preset.name && field.isStockKeepingUnit && field.isActive && field.fieldId);
    if (!confirmed) return { ok: false as const, message: `El BFF no confirmó ${preset.name}. Revisa el catálogo antes de reintentar.`, fields: variantAttributeCatalog(fields) };
    fields.push(confirmed);
  }
  return { ok: true as const, message: "Atributos habituales disponibles: Talla, Color y Acabado.", fields: variantAttributeCatalog(fields) };
}

"use server";

import { formFailure, type AdminFormState } from "../../shared/validation/admin-form-state";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "../../shared/config/admin-context";
import {
  addCatalogSpecificationValue,
  createCatalogSpecificationField,
  removeCatalogSpecificationValue,
  updateCatalogSpecificationField,
  type CatalogAttributeFeatureTab,
} from "./catalog-attributes-features";

const path = "/admin/catalogo/atributos-caracteristicas";

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function bool(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function tab(value: FormDataEntryValue | null): CatalogAttributeFeatureTab {
  return value === "attributes" ? "attributes" : "features";
}

function values(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function createAttributeFeatureAction(_state: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const context = await getAdminContext();
  const name = text(formData.get("name"));
  const categoryId = text(formData.get("categoryId"));
  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "El nombre es obligatorio.";
  if (!categoryId) fieldErrors.categoryId = "Selecciona una categoría.";
  if (Object.keys(fieldErrors).length) return { error: "Revisa los campos indicados.", fieldErrors };

  let createdFieldId = "";
  try {
    const result = await createCatalogSpecificationField(context, {
      tab: tab(formData.get("tab")),
      groupId: text(formData.get("groupId")),
      groupName: text(formData.get("groupName")),
      categoryId,
      name,
      values: values(text(formData.get("values"))),
      isActive: bool(formData.get("isActive")),
      isFilter: bool(formData.get("isFilter")),
      isOnProductDetails: bool(formData.get("isOnProductDetails")),
    });
    if (!result.ok) return {
      error: `No se pudo crear el registro. ${result.error}${result.status ? ` (HTTP ${result.status})` : ""}${result.correlationId ? ` Referencia: ${result.correlationId}` : ""}`,
    };
    const createdField = result.data.fields.find(field => field.name === name && field.isStockKeepingUnit === (tab(formData.get("tab")) === "attributes"));
    if (!createdField?.fieldId) {
      return { error: "El BFF no confirmó el registro creado. Comprueba el listado antes de reintentar." };
    }
    createdFieldId = createdField.fieldId;
  } catch (error) {
    return formFailure(error);
  }
  revalidatePath(path);
  const query = new URLSearchParams({tab: tab(formData.get("tab")), createdFieldId});
  if (!bool(formData.get("isActive"))) query.set("status", "inactive");
  redirect(`${path}?${query}`);
}

export async function updateAttributeFeatureAction(formData: FormData) {
  const context = await getAdminContext();
  const groupId = text(formData.get("groupId"));
  const fieldId = text(formData.get("fieldId"));
  const name = text(formData.get("name"));
  if (!groupId || !fieldId || !name) {
    redirect(`${path}?${new URLSearchParams({tab: tab(formData.get("tab")), mutationError: "Faltan los identificadores o el nombre de la característica."})}`);
  }

  const result = await updateCatalogSpecificationField(context, {
    groupId,
    fieldId,
    name,
    isActive: bool(formData.get("isActive")),
    isFilter: bool(formData.get("isFilter")),
    isOnProductDetails: bool(formData.get("isOnProductDetails")),
  });
  if (!result.ok) {
    const message = `No se pudo actualizar la característica. ${result.error}${result.status ? ` (HTTP ${result.status})` : ""}${result.correlationId ? ` Referencia: ${result.correlationId}` : ""}`;
    redirect(`${path}?${new URLSearchParams({ tab: tab(formData.get("tab")), mutationError: message })}`);
  }
  const confirmed = result.data.fields.find(field => field.fieldId === fieldId);
  if (!confirmed || confirmed.isActive !== bool(formData.get("isActive"))) {
    redirect(`${path}?${new URLSearchParams({ tab: tab(formData.get("tab")), mutationError: "El BFF no confirmó el cambio de estado. Comprueba el listado antes de reintentar." })}`);
  }
  revalidatePath(path);
  redirect(`${path}?${new URLSearchParams({ tab: tab(formData.get("tab")), updatedFieldId: fieldId, expectedActive: String(confirmed.isActive) })}`);
}

export async function addAttributeFeatureValueAction(formData: FormData) {
  const context = await getAdminContext();
  const groupId = text(formData.get("groupId"));
  const fieldId = text(formData.get("fieldId"));
  const value = text(formData.get("value"));
  if (!groupId || !fieldId || !value) {
    return;
  }

  await addCatalogSpecificationValue(context, {
    groupId,
    fieldId,
    value,
  });
  revalidatePath(path);
}

export async function removeAttributeFeatureValueAction(formData: FormData) {
  const context = await getAdminContext();
  const groupId = text(formData.get("groupId"));
  const fieldId = text(formData.get("fieldId"));
  const fieldValueId = text(formData.get("fieldValueId"));
  if (!groupId || !fieldId || !fieldValueId) {
    return;
  }

  await removeCatalogSpecificationValue(context, {
    groupId,
    fieldId,
    fieldValueId,
  });
  revalidatePath(path);
}

// Legacy Server Action fails closed; all deactivations require canonical impact review.
export async function deactivateAttributeFeatureAction(formData: FormData) {
  redirect(`${path}?${new URLSearchParams({tab:tab(formData.get("tab")),mutationError:"Utiliza Desactivar característica y revisa el impacto antes de confirmar."})}`);
}

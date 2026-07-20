"use server";

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

export async function createAttributeFeatureAction(formData: FormData) {
  const context = await getAdminContext();
  const name = text(formData.get("name"));
  const categoryId = text(formData.get("categoryId"));
  if (!name || !categoryId) {
    return;
  }

  await createCatalogSpecificationField(context, {
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
  revalidatePath(path);
  redirect(`${path}?tab=${tab(formData.get("tab"))}`);
}

export async function updateAttributeFeatureAction(formData: FormData) {
  const context = await getAdminContext();
  const groupId = text(formData.get("groupId"));
  const fieldId = text(formData.get("fieldId"));
  const name = text(formData.get("name"));
  if (!groupId || !fieldId || !name) {
    return;
  }

  await updateCatalogSpecificationField(context, {
    groupId,
    fieldId,
    name,
    isActive: bool(formData.get("isActive")),
    isFilter: bool(formData.get("isFilter")),
    isOnProductDetails: bool(formData.get("isOnProductDetails")),
  });
  revalidatePath(path);
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

export async function deactivateAttributeFeatureAction(formData: FormData) {
  const next = new FormData();
  next.set("groupId", text(formData.get("groupId")));
  next.set("fieldId", text(formData.get("fieldId")));
  next.set("name", text(formData.get("name")));
  next.set("isFilter", text(formData.get("isFilter")));
  next.set("isOnProductDetails", text(formData.get("isOnProductDetails")));
  await updateAttributeFeatureAction(next);
}

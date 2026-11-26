"use server";

import {formFailure,type AdminFormState} from "../../shared/validation/admin-form-state";
import { revalidatePath } from "next/cache";
import { getAdminContext } from "../../shared/config/admin-context";
import { createCatalogEntity, deleteCatalogEntity, updateCatalogEntity, type CatalogEntityKind } from "./catalog-taxonomy";

function asText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function asActive(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function pathFor(kind: CatalogEntityKind) {
  return kind === "categories" ? "/admin/catalogo/categorias" : "/admin/catalogo/marcas";
}

async function createEntityAction(kind: CatalogEntityKind, formData: FormData):Promise<AdminFormState> {
  const context=await getAdminContext();
  try{
    const result=await createCatalogEntity(context,kind,{
      name:asText(formData.get("name")),isActive:asActive(formData.get("isActive")),
      slug:asText(formData.get("slug")),title:asText(formData.get("title")),description:asText(formData.get("description")),
      text:asText(formData.get("text")),siteTitle:asText(formData.get("siteTitle")),keywords:asText(formData.get("keywords")),
    });
    if(!result.ok)return {error:result.error};
    revalidatePath(pathFor(kind));return {success:kind==='categories'?'Categoría creada.':'Marca creada.'};
  }catch(error){return formFailure(error);}
}

async function updateEntityAction(kind: CatalogEntityKind, formData: FormData) {
  const context = await getAdminContext();
  const id = asText(formData.get("id"));
  const name = asText(formData.get("name"));

  if (!id || !name) {
    return;
  }

  await updateCatalogEntity(context, kind, id, {
    name,
    isActive: asActive(formData.get("isActive")),
  });
  revalidatePath(pathFor(kind));
}

async function deleteEntityAction(kind: CatalogEntityKind, mode: "soft" | "hard", formData: FormData) {
  const context = await getAdminContext();
  const id = asText(formData.get("id"));

  if (!id) {
    return;
  }

  await deleteCatalogEntity(context, kind, id, mode);
  revalidatePath(pathFor(kind));
}

export async function createCategoryAction(_state: AdminFormState, formData: FormData) {
  return createEntityAction("categories", formData);
}

export async function updateCategoryAction(formData: FormData) {
  return updateEntityAction("categories", formData);
}

export async function softDeleteCategoryAction(formData: FormData) {
  return deleteEntityAction("categories", "soft", formData);
}

export async function hardDeleteCategoryAction(formData: FormData) {
  return deleteEntityAction("categories", "hard", formData);
}

export async function createBrandAction(_state: AdminFormState, formData: FormData) {
  return createEntityAction("brands", formData);
}

export async function updateBrandAction(formData: FormData) {
  return updateEntityAction("brands", formData);
}

export async function softDeleteBrandAction(formData: FormData) {
  return deleteEntityAction("brands", "soft", formData);
}

export async function hardDeleteBrandAction(formData: FormData) {
  return deleteEntityAction("brands", "hard", formData);
}

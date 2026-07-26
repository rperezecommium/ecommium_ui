"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "../../shared/config/admin-context";
import {
  addMediaCollectionItems,
  createMediaCollection,
  softDeleteMediaAsset,
  softDeleteMediaCollection,
  updateMediaAsset,
  updateMediaCollection,
} from "./media-admin";

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function safeReturnPath(value: FormDataEntryValue | null, fallback = "/admin/catalogo/media") {
  const path = text(value);

  if (!path || !path.startsWith("/admin/catalogo/media")) {
    return fallback;
  }

  return path;
}

function appendMessage(path: string, message: string) {
  const url = new URL(path, "http://admin.local");
  url.searchParams.set("mediaMessage", message);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function optionalNumber(value: FormDataEntryValue | null) {
  const raw = text(value);
  if (!raw) {
    return undefined;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : undefined;
}

function booleanField(formData: FormData, name: string) {
  return formData.getAll(name).some((value) => text(value) === "true");
}

function uploadedFiles(formData: FormData) {
  return formData
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);
}

export async function createMediaCollectionAction(formData: FormData) {
  const productId = text(formData.get("productId"));
  const title = text(formData.get("title"));
  const returnPath = safeReturnPath(formData.get("returnPath"));
  const files = uploadedFiles(formData);

  if (!productId || !title || files.length === 0) {
    redirect(appendMessage(returnPath, "Indica producto, titulo y al menos un archivo."));
  }

  const context = await getAdminContext();
  const result = await createMediaCollection(context, {
    productId,
    title,
    files,
    defaultLocale: text(formData.get("defaultLocale")) || context.locale,
    alt: text(formData.get("alt")),
    assetTitle: text(formData.get("assetTitle")),
  });
  const nextPath = result.ok && result.data.mediaCollectionId
    ? appendMessage(`${returnPath}${returnPath.includes("?") ? "&" : "?"}collectionId=${encodeURIComponent(result.data.mediaCollectionId)}`, "Coleccion media creada.")
    : appendMessage(returnPath, result.ok ? "Coleccion media creada." : result.error);

  revalidatePath("/admin/catalogo/media");
  redirect(nextPath);
}

export async function addMediaCollectionItemsAction(formData: FormData) {
  const mediaCollectionId = text(formData.get("mediaCollectionId"));
  const returnPath = safeReturnPath(formData.get("returnPath"));
  const files = uploadedFiles(formData);

  if (!mediaCollectionId || files.length === 0) {
    redirect(appendMessage(returnPath, "Selecciona al menos un archivo para anadir."));
  }

  const context = await getAdminContext();
  const result = await addMediaCollectionItems(context, {
    mediaCollectionId,
    files,
    defaultLocale: text(formData.get("defaultLocale")) || context.locale,
    alt: text(formData.get("alt")),
    assetTitle: text(formData.get("assetTitle")),
  });
  const message = result.ok ? "Assets anadidos a la coleccion." : result.error;

  revalidatePath("/admin/catalogo/media");
  redirect(appendMessage(returnPath, message));
}

export async function softDeleteMediaCollectionAction(formData: FormData) {
  const mediaCollectionId = text(formData.get("mediaCollectionId"));
  const confirmed = text(formData.get("confirmSoftDelete")) === "yes";
  const returnPath = safeReturnPath(formData.get("returnPath"));

  if (!mediaCollectionId || !confirmed) {
    redirect(appendMessage(returnPath, "Confirma la baja segura de la coleccion."));
  }

  const context = await getAdminContext();
  const result = await softDeleteMediaCollection(context, mediaCollectionId);
  const message = result.ok ? "Coleccion media desactivada." : result.error;

  revalidatePath("/admin/catalogo/media");
  redirect(appendMessage(returnPath, message));
}

export async function updateMediaCollectionAction(formData: FormData) {
  const mediaCollectionId = text(formData.get("mediaCollectionId"));
  const title = text(formData.get("title"));
  const returnPath = safeReturnPath(formData.get("returnPath"));

  if (!mediaCollectionId || !title) {
    redirect(appendMessage(returnPath, "Indica titulo de coleccion."));
  }

  const context = await getAdminContext();
  const result = await updateMediaCollection(context, mediaCollectionId, { title });
  const message = result.ok ? "Coleccion media actualizada." : result.error;

  revalidatePath("/admin/catalogo/media");
  redirect(appendMessage(returnPath, message));
}

export async function updateMediaAssetAction(formData: FormData) {
  const mediaCollectionId = text(formData.get("mediaCollectionId"));
  const mediaAssetId = text(formData.get("mediaAssetId"));
  const returnPath = safeReturnPath(formData.get("returnPath"));

  if (!mediaCollectionId || !mediaAssetId) {
    redirect(appendMessage(returnPath, "No se pudo identificar el asset media."));
  }

  const context = await getAdminContext();
  const result = await updateMediaAsset(context, {
    mediaCollectionId,
    mediaAssetId,
    position: optionalNumber(formData.get("position")),
    isMain: booleanField(formData, "isMain"),
    isActive: booleanField(formData, "isActive"),
    alt: text(formData.get("alt")),
    title: text(formData.get("title")),
    locale: text(formData.get("locale")) || context.locale,
  });
  const message = result.ok ? "Asset media actualizado." : result.error;

  revalidatePath("/admin/catalogo/media");
  redirect(appendMessage(returnPath, message));
}

export async function softDeleteMediaAssetAction(formData: FormData) {
  const mediaCollectionId = text(formData.get("mediaCollectionId"));
  const mediaAssetId = text(formData.get("mediaAssetId"));
  const confirmed = text(formData.get("confirmSoftDeleteAsset")) === "yes";
  const returnPath = safeReturnPath(formData.get("returnPath"));

  if (!mediaCollectionId || !mediaAssetId || !confirmed) {
    redirect(appendMessage(returnPath, "Confirma la baja segura del asset."));
  }

  const context = await getAdminContext();
  const result = await softDeleteMediaAsset(context, mediaCollectionId, mediaAssetId);
  const message = result.ok ? "Asset media desactivado." : result.error;

  revalidatePath("/admin/catalogo/media");
  redirect(appendMessage(returnPath, message));
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "../../shared/config/admin-context";
import { makeProductGateway } from "./products";

const path = "/admin/catalogo/offerings";

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function bool(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function priceToMinor(value: string) {
  const normalized = value.replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.round(parsed * 100);
}

function payloadFromForm(formData: FormData, locale: string) {
  const name = text(formData.get("name"));
  return {
    type: text(formData.get("type")) || "service",
    priceMinor: priceToMinor(text(formData.get("price"))),
    currency: text(formData.get("currency")) || "EUR",
    localizedName: [{ locale, value: name || "Servicio adicional" }],
    active: bool(formData.get("active")),
  };
}

export async function createCatalogOfferingAction(formData: FormData) {
  const context = await getAdminContext();
  await makeProductGateway(context).createOffering(payloadFromForm(formData, context.locale));
  revalidatePath(path);
  redirect(path);
}

export async function updateCatalogOfferingAction(formData: FormData) {
  const context = await getAdminContext();
  const offeringId = text(formData.get("offeringId"));
  if (!offeringId) {
    return;
  }
  await makeProductGateway(context).updateOffering({
    offeringId,
    payload: payloadFromForm(formData, context.locale),
  });
  revalidatePath(path);
  redirect(path);
}

export async function deactivateCatalogOfferingAction(formData: FormData) {
  const context = await getAdminContext();
  const offeringId = text(formData.get("offeringId"));
  if (!offeringId) {
    return;
  }
  await makeProductGateway(context).deactivateOffering(offeringId);
  revalidatePath(path);
}

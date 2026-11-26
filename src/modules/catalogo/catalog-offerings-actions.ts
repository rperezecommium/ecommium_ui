"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "../../shared/config/admin-context";
import { makeProductGateway } from "./products";

const path = "/admin/catalogo/offerings";

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function returnPath(formData: FormData) {
  const value=text(formData.get("returnPath"));
  const url=new URL(value || path,"http://admin.local");
  return url.origin === "http://admin.local" && url.pathname === path ? `${url.pathname}${url.search}` : path;
}
function failed(formData: FormData, message: string): never {
  const url=new URL(returnPath(formData),"http://admin.local");
  url.searchParams.set("offeringMessage",message);
  redirect(`${url.pathname}${url.search}`);
}

function bool(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function priceToMinor(value: string) {
  const normalized = value.replace(",", ".");
  if (!normalized) return 0;
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return undefined;
  const minor=Math.round(Number(normalized)*100);
  return Number.isSafeInteger(minor) && minor>=0 ? minor : undefined;
}

function payloadFromForm(formData: FormData, locale: string, defaultCurrency: string) {
  const name=text(formData.get("name"));
  const type=text(formData.get("type")) || "service";
  const currency=(text(formData.get("currency")) || defaultCurrency).toUpperCase();
  const priceMinor=priceToMinor(text(formData.get("price")));
  if (!name || !["service","warranty","addon"].includes(type) || !/^[A-Z]{3}$/.test(currency) || priceMinor === undefined) return undefined;
  return {type,priceMinor,currency,localizedName:[{locale,value:name}],active:bool(formData.get("active"))};
}

export async function createCatalogOfferingAction(formData: FormData) {
  const context = await getAdminContext();
  const payload=payloadFromForm(formData,context.locale,context.currency);
  if(!payload) failed(formData,"Revisa el nombre, tipo, precio y moneda del servicio.");
  const result=await makeProductGateway(context).createOffering(payload);
  if(!result.ok) failed(formData,result.error);
  const offeringId = result.data.offering.offeringId;
  if (!offeringId) failed(formData,"El BFF no confirmó la identidad del servicio. No repitas el alta sin comprobar su estado.");
  revalidatePath(path);
  redirect(`${path}?status=all&q=${encodeURIComponent(offeringId)}&createdOfferingId=${encodeURIComponent(offeringId)}`);
}

export async function updateCatalogOfferingAction(formData: FormData) {
  const context = await getAdminContext();
  const offeringId = text(formData.get("offeringId"));
  if (!offeringId) {
    return;
  }
  const payload=payloadFromForm(formData,context.locale,context.currency);
  if(!payload) failed(formData,"Revisa el nombre, tipo, precio y moneda del servicio.");
  const result=await makeProductGateway(context).updateOffering({offeringId,payload});
  if(!result.ok) failed(formData,result.error);
  revalidatePath(path);
  redirect(returnPath(formData));
}

export async function deactivateCatalogOfferingAction(formData: FormData) {
  const context = await getAdminContext();
  const offeringId = text(formData.get("offeringId"));
  if (!offeringId) {
    return;
  }
  const result=await makeProductGateway(context).deactivateOffering(offeringId);
  if(!result.ok) failed(formData,result.error);
  revalidatePath(path);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "../../shared/config/admin-context";
import { mutatePricing } from "./pricing-admin";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function scopedPath(path: string, organizationId: string, shopId: string, extra?: Record<string, string | undefined>) {
  const params = new URLSearchParams({ organizationId, shopId });
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value) {
      params.set(key, value);
    }
  }

  return `${path}?${params.toString()}`;
}

function finish(tab: string, message?: string): never {
  revalidatePath("/admin/catalogo/precios");
  redirect(`/admin/catalogo/precios?tab=${encodeURIComponent(tab)}${message ? `&pricingMessage=${encodeURIComponent(message)}` : ""}`);
}

function mutationMessage(result: Awaited<ReturnType<typeof mutatePricing>>, success: string) {
  if (result.ok) {
    return success;
  }

  return result.status === 403 ? "Falta permiso pricing.admin.write." : result.error;
}

export async function updatePriceTableActivationAction(formData: FormData) {
  const context = await getAdminContext();
  const priceTableId = asString(formData.get("priceTableId"));
  const active = asString(formData.get("active")) === "true";

  if (!priceTableId) {
    finish("tables", "Falta priceTableId.");
  }

  const path = scopedPath(`/admin/pricing/price-tables/${encodeURIComponent(priceTableId)}/activation`, context.organizationId, context.shopId);
  const result = await mutatePricing(context, path, "PATCH", { active });
  finish("tables", mutationMessage(result, "Tabla actualizada."));
}

export async function updatePricingRuleAction(formData: FormData) {
  const context = await getAdminContext();
  const priceTableId = asString(formData.get("priceTableId"));
  const ruleId = asString(formData.get("ruleId"));

  if (!priceTableId || !ruleId) {
    finish("rules", "Falta priceTableId o ruleId.");
  }

  const payload = {
    active: asString(formData.get("active")) === "true",
    priority: asNumber(formData.get("priority")),
    source: asString(formData.get("source")),
    tradePolicy: asString(formData.get("tradePolicy")),
    channel: asString(formData.get("channel")),
    customerGroup: asString(formData.get("customerGroup")) ?? null,
    country: asString(formData.get("country")),
  };
  const path = scopedPath(`/admin/pricing/price-tables/${encodeURIComponent(priceTableId)}/rules/${encodeURIComponent(ruleId)}`, context.organizationId, context.shopId);
  const result = await mutatePricing(context, path, "PATCH", payload);
  finish("rules", mutationMessage(result, "Regla actualizada."));
}

export async function deletePricingRuleAction(formData: FormData) {
  const context = await getAdminContext();
  const priceTableId = asString(formData.get("priceTableId"));
  const ruleId = asString(formData.get("ruleId"));
  const confirmed = asString(formData.get("confirmDelete")) === "DELETE";

  if (!confirmed) {
    finish("rules", "Confirma escribiendo DELETE antes de desactivar la regla.");
  }
  if (!priceTableId || !ruleId) {
    finish("rules", "Falta priceTableId o ruleId.");
  }

  const path = scopedPath(`/admin/pricing/price-tables/${encodeURIComponent(priceTableId)}/rules/${encodeURIComponent(ruleId)}`, context.organizationId, context.shopId);
  const result = await mutatePricing(context, path, "DELETE");
  finish("rules", mutationMessage(result, "Regla desactivada."));
}

export async function upsertFixedPriceAction(formData: FormData) {
  const context = await getAdminContext();
  const itemId = asString(formData.get("itemId"));
  const priceTableId = asString(formData.get("priceTableId"));

  if (!itemId || !priceTableId) {
    finish("fixed", "Falta itemId o priceTableId.");
  }

  const payload = {
    itemId,
    priceTableId,
    basePriceMinor: asNumber(formData.get("basePriceMinor")) ?? 0,
    listPriceMinor: asNumber(formData.get("listPriceMinor")) ?? null,
    currency: asString(formData.get("currency")) ?? context.currency,
    taxIncluded: asString(formData.get("taxIncluded")) === "true",
    active: true,
  };
  const path = scopedPath(`/admin/pricing/prices/${encodeURIComponent(itemId)}/fixed/${encodeURIComponent(priceTableId)}`, context.organizationId, context.shopId);
  const result = await mutatePricing(context, path, "PUT", payload);
  finish("fixed", mutationMessage(result, "Fixed price guardado."));
}

export async function deleteFixedPriceAction(formData: FormData) {
  const context = await getAdminContext();
  const itemId = asString(formData.get("itemId"));
  const priceTableId = asString(formData.get("priceTableId"));
  const confirmed = asString(formData.get("confirmDelete")) === "DELETE";

  if (!confirmed) {
    finish("fixed", "Confirma escribiendo DELETE antes de borrar fixed price.");
  }
  if (!itemId || !priceTableId) {
    finish("fixed", "Falta itemId o priceTableId.");
  }

  const path = scopedPath(`/admin/pricing/prices/${encodeURIComponent(itemId)}/fixed/${encodeURIComponent(priceTableId)}`, context.organizationId, context.shopId);
  const result = await mutatePricing(context, path, "DELETE");
  finish("fixed", mutationMessage(result, "Fixed price borrado."));
}

export async function updatePipelineCatalogAction(formData: FormData) {
  const context = await getAdminContext();
  const priceTableId = asString(formData.get("priceTableId"));

  if (!priceTableId) {
    finish("pipeline", "Falta priceTableId.");
  }

  const payload = {
    active: asString(formData.get("active")) === "true",
    mode: asString(formData.get("mode")),
  };
  const path = scopedPath(`/admin/pricing/pipeline/catalog/${encodeURIComponent(priceTableId)}`, context.organizationId, context.shopId);
  const result = await mutatePricing(context, path, "PUT", payload);
  finish("pipeline", mutationMessage(result, "Pipeline actualizado."));
}

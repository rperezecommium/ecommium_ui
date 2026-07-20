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

function asBoolean(value: FormDataEntryValue | null, fallback = true) {
  const text = asString(value);
  if (!text) {
    return fallback;
  }

  return text === "true";
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

function finish(tab: string, message?: string, keep?: Record<string, string | undefined>): never {
  revalidatePath("/admin/configuracion/precios");
  const params = new URLSearchParams({ tab });
  if (message) {
    params.set("pricingMessage", message);
  }
  for (const [key, value] of Object.entries(keep ?? {})) {
    if (value) {
      params.set(key, value);
    }
  }
  redirect(`/admin/configuracion/precios?${params.toString()}`);
}

function mutationMessage(result: Awaited<ReturnType<typeof mutatePricing>>, success: string) {
  if (result.ok) {
    return success;
  }

  return result.status === 403 ? "Falta permiso pricing.admin.write." : result.error;
}

export async function upsertTaxDefinitionAction(formData: FormData) {
  const context = await getAdminContext();
  const code = asString(formData.get("code"));
  const name = asString(formData.get("name"));
  const calculationType = asString(formData.get("calculationType")) ?? "PERCENTAGE";

  if (!code || !name) {
    finish("taxes", "Falta codigo o nombre del impuesto.");
  }

  const ratePercent = asNumber(formData.get("ratePercent"));
  const amountMinor = asNumber(formData.get("amountMinor"));
  const payload = {
    code,
    name,
    helpText: asString(formData.get("helpText")) ?? null,
    calculationType,
    rate: calculationType === "PERCENTAGE" && typeof ratePercent === "number"
      ? ratePercent / 100
      : null,
    amountMinor: calculationType === "FIXED" ? amountMinor ?? null : null,
    country: asString(formData.get("country")) ?? context.country,
    active: asBoolean(formData.get("active")),
  };
  const path = scopedPath("/admin/pricing/taxes", context.organizationId, context.shopId);
  const result = await mutatePricing(context, path, "POST", payload);
  finish("taxes", mutationMessage(result, "Impuesto guardado."));
}

export async function deleteTaxDefinitionAction(formData: FormData) {
  const context = await getAdminContext();
  const taxCode = asString(formData.get("taxCode"));
  const confirmed = asString(formData.get("confirmDelete")) === "DELETE";

  if (!confirmed) {
    finish("taxes", "Confirma escribiendo DELETE antes de desactivar el impuesto.");
  }
  if (!taxCode) {
    finish("taxes", "Falta taxCode.");
  }

  const path = scopedPath(`/admin/pricing/taxes/${encodeURIComponent(taxCode)}`, context.organizationId, context.shopId);
  const result = await mutatePricing(context, path, "DELETE");
  finish("taxes", mutationMessage(result, "Impuesto desactivado."));
}

export async function upsertPriceTableReferenceAction(formData: FormData) {
  const context = await getAdminContext();
  const code = asString(formData.get("code"));
  const name = asString(formData.get("name"));

  if (!code || !name) {
    finish("tables", "Falta codigo o nombre de la tabla.");
  }

  const payload = {
    code,
    name,
    helpText: asString(formData.get("helpText")) ?? null,
    currency: asString(formData.get("currency")) ?? context.currency,
    active: asBoolean(formData.get("active")),
  };
  const path = scopedPath("/admin/pricing/price-tables", context.organizationId, context.shopId);
  const result = await mutatePricing(context, path, "POST", payload);
  finish("tables", mutationMessage(result, "Price table guardada."));
}

export async function deletePriceTableReferenceAction(formData: FormData) {
  const context = await getAdminContext();
  const priceTableId = asString(formData.get("priceTableId"));
  const confirmed = asString(formData.get("confirmDelete")) === "DELETE";

  if (!confirmed) {
    finish("tables", "Confirma escribiendo DELETE antes de desactivar la tabla.");
  }
  if (!priceTableId) {
    finish("tables", "Falta priceTableId.");
  }

  const path = scopedPath(`/admin/pricing/price-tables/${encodeURIComponent(priceTableId)}`, context.organizationId, context.shopId);
  const result = await mutatePricing(context, path, "DELETE");
  finish("tables", mutationMessage(result, "Price table desactivada."));
}

function referenceKindPath(kind: string) {
  return ["customer-groups", "channels", "trade-policies", "countries"].includes(kind)
    ? kind
    : null;
}

export async function upsertPricingReferenceAction(formData: FormData) {
  const context = await getAdminContext();
  const kind = referenceKindPath(asString(formData.get("kind")) ?? "");
  const code = asString(formData.get("code"));
  const name = asString(formData.get("name"));

  if (!kind) {
    finish("references", "Lista no valida.");
  }
  if (!code || !name) {
    finish("references", "Falta codigo o nombre.");
  }

  const payload = {
    code,
    name,
    helpText: asString(formData.get("helpText")) ?? null,
    active: asBoolean(formData.get("active")),
  };
  const path = scopedPath(`/admin/pricing/${kind}`, context.organizationId, context.shopId);
  const result = await mutatePricing(context, path, "POST", payload);
  finish("references", mutationMessage(result, "Parametro guardado."));
}

export async function deletePricingReferenceAction(formData: FormData) {
  const context = await getAdminContext();
  const kind = referenceKindPath(asString(formData.get("kind")) ?? "");
  const code = asString(formData.get("code"));
  const confirmed = asString(formData.get("confirmDelete")) === "DELETE";

  if (!kind) {
    finish("references", "Lista no valida.");
  }
  if (!confirmed) {
    finish("references", "Confirma escribiendo DELETE antes de desactivar el parametro.");
  }
  if (!code) {
    finish("references", "Falta codigo.");
  }

  const path = scopedPath(`/admin/pricing/${kind}/${encodeURIComponent(code)}`, context.organizationId, context.shopId);
  const result = await mutatePricing(context, path, "DELETE");
  finish("references", mutationMessage(result, "Parametro desactivado."));
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
  const productId = asString(formData.get("productId"));
  const itemId = asString(formData.get("itemId"));
  const priceTableId = asString(formData.get("priceTableId"));
  const fixedPriceMinor = asNumber(formData.get("fixedPriceMinor"));
  const keep = { productId, itemId, priceTableId };

  if (!productId || !itemId || !priceTableId) {
    finish("fixed", "Falta productId, variantId o priceTableId.", keep);
  }
  if (!Number.isInteger(fixedPriceMinor)) {
    finish("fixed", "Falta fixedPriceMinor entero.", keep);
  }

  const payload = {
    productId,
    itemId,
    priceTableId,
    fixedPriceMinor,
    basePriceMinor: asNumber(formData.get("basePriceMinor")) ?? fixedPriceMinor,
    listPriceMinor: asNumber(formData.get("listPriceMinor")) ?? null,
    currency: asString(formData.get("currency")) ?? context.currency,
    timezone: asString(formData.get("timezone")) ?? "Europe/Madrid",
    taxIncluded: asString(formData.get("taxIncluded")) === "true",
    active: true,
  };
  const path = scopedPath(`/admin/pricing/prices/${encodeURIComponent(itemId)}/fixed/${encodeURIComponent(priceTableId)}`, context.organizationId, context.shopId);
  const result = await mutatePricing(context, path, "PUT", payload);
  finish("fixed", mutationMessage(result, "Fixed price guardado."), keep);
}

export async function deleteFixedPriceAction(formData: FormData) {
  const context = await getAdminContext();
  const itemId = asString(formData.get("itemId"));
  const priceTableId = asString(formData.get("priceTableId"));
  const confirmed = asString(formData.get("confirmDelete")) === "DELETE";
  const keep = { itemId, priceTableId };

  if (!confirmed) {
    finish("fixed", "Confirma escribiendo DELETE antes de borrar fixed price.", keep);
  }
  if (!itemId || !priceTableId) {
    finish("fixed", "Falta variantId o priceTableId.", keep);
  }

  const path = scopedPath(`/admin/pricing/prices/${encodeURIComponent(itemId)}/fixed/${encodeURIComponent(priceTableId)}`, context.organizationId, context.shopId);
  const result = await mutatePricing(context, path, "DELETE");
  finish("fixed", mutationMessage(result, "Fixed price borrado."), keep);
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

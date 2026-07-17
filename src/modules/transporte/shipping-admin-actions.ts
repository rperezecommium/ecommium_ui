"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "../../shared/config/admin-context";
import {
  shippingFulfillmentStatuses,
  mutateShipping,
  patchShippingActive,
  transitionShippingFulfillment,
} from "./shipping-admin";
import type { ShippingAdminTab, ShippingFulfillmentStatus } from "./shipping-admin";

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

function asBoolean(value: FormDataEntryValue | null) {
  return asString(value) !== "false";
}

function asOptionalBoolean(value: FormDataEntryValue | null) {
  const normalized = asString(value);
  return normalized === "true" ? true : normalized === "false" ? false : undefined;
}

function asNullableString(value: FormDataEntryValue | null) {
  return asString(value) ?? null;
}

function asNullableNumber(value: FormDataEntryValue | null) {
  return asNumber(value) ?? null;
}

function asStringList(value: FormDataEntryValue | null) {
  return (asString(value) ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function scopedPath(path: string, organizationId: string, shopId: string) {
  return `${path}?${new URLSearchParams({ organizationId, shopId }).toString()}`;
}

function finish(tab: ShippingAdminTab, message?: string, includeInactive?: boolean): never {
  const params = new URLSearchParams({ tab });
  if (includeInactive) {
    params.set("includeInactive", "true");
  }
  if (message) {
    params.set("shippingMessage", message);
  }

  revalidatePath("/admin/configuracion/transporte");
  redirect(`/admin/configuracion/transporte?${params.toString()}`);
}

function mutationMessage(result: Awaited<ReturnType<typeof mutateShipping>>, success: string) {
  if (result.ok) {
    return success;
  }

  return result.status === 403 ? "Falta permiso shipping.logistics.write." : result.error;
}

function isShippingFulfillmentStatus(value: string | undefined): value is ShippingFulfillmentStatus {
  return Boolean(value && shippingFulfillmentStatuses.includes(value as ShippingFulfillmentStatus));
}

function fulfillmentFinish(formData: FormData, message: string): never {
  const params = new URLSearchParams({ tab: "fulfillments", shippingMessage: message });
  const fulfillmentStatus = asString(formData.get("fulfillmentStatus"));
  const fulfillmentsLimit = asString(formData.get("fulfillmentsLimit"));
  const fulfillmentsOffset = asString(formData.get("fulfillmentsOffset"));
  const fulfillmentId = asString(formData.get("fulfillmentId"));

  if (fulfillmentStatus && isShippingFulfillmentStatus(fulfillmentStatus)) {
    params.set("fulfillmentStatus", fulfillmentStatus);
  }
  if (fulfillmentsLimit && /^\d+$/.test(fulfillmentsLimit)) {
    params.set("fulfillmentsLimit", fulfillmentsLimit);
  }
  if (fulfillmentsOffset && /^\d+$/.test(fulfillmentsOffset)) {
    params.set("fulfillmentsOffset", fulfillmentsOffset);
  }
  if (fulfillmentId) {
    params.set("fulfillmentId", fulfillmentId);
  }

  revalidatePath("/admin/configuracion/transporte");
  redirect(`/admin/configuracion/transporte?${params.toString()}`);
}

export async function upsertShippingZoneAction(formData: FormData) {
  const context = await getAdminContext();
  const zoneId = asString(formData.get("zoneId"));
  const name = asString(formData.get("name"));

  if (!zoneId || !name) {
    finish("zones", "Falta zoneId o nombre.");
  }

  const result = await mutateShipping(
    context,
    scopedPath("/admin/shipping/zones", context.organizationId, context.shopId),
    {
      zone: {
        zoneId,
        name,
        countries: asStringList(formData.get("countries")),
        states: asStringList(formData.get("states")),
        postalCodePrefixes: asStringList(formData.get("postalCodePrefixes")),
        active: asBoolean(formData.get("active")),
      },
    },
  );
  finish("zones", mutationMessage(result, "Zona guardada."));
}

export async function upsertShippingCarrierAction(formData: FormData) {
  const context = await getAdminContext();
  const carrierId = asString(formData.get("carrierId"));
  const name = asString(formData.get("name"));

  if (!carrierId || !name) {
    finish("carriers", "Falta carrierId o nombre.");
  }

  const result = await mutateShipping(
    context,
    scopedPath("/admin/shipping/carriers", context.organizationId, context.shopId),
    {
      carrier: {
        carrierId,
        name,
        trackingUrlTemplate: asNullableString(formData.get("trackingUrlTemplate")),
        logoUrl: asNullableString(formData.get("logoUrl")),
        active: asBoolean(formData.get("active")),
      },
    },
  );
  finish("carriers", mutationMessage(result, "Transportista guardado."));
}

export async function upsertShippingCarrierServiceAction(formData: FormData) {
  const context = await getAdminContext();
  const carrierServiceId = asString(formData.get("carrierServiceId"));
  const carrierId = asString(formData.get("carrierId"));
  const name = asString(formData.get("name"));

  if (!carrierServiceId || !carrierId || !name) {
    finish("services", "Falta carrierServiceId, carrierId o nombre.");
  }

  const result = await mutateShipping(
    context,
    scopedPath("/admin/shipping/carrier-services", context.organizationId, context.shopId),
    {
      carrierService: {
        carrierServiceId,
        carrierId,
        name,
        deliveryChannel: asString(formData.get("deliveryChannel")) ?? "delivery",
        ratingBasis: asString(formData.get("ratingBasis")) ?? "WEIGHT",
        transitTimeLabel: asString(formData.get("transitTimeLabel")) ?? "3-5bd",
        estimateBusinessDays: asNumber(formData.get("estimateBusinessDays")) ?? 3,
        handlingFeeMinor: asNumber(formData.get("handlingFeeMinor")) ?? 0,
        maxWeightGrams: asNullableNumber(formData.get("maxWeightGrams")),
        maxWidthMm: asNullableNumber(formData.get("maxWidthMm")),
        maxHeightMm: asNullableNumber(formData.get("maxHeightMm")),
        maxDepthMm: asNullableNumber(formData.get("maxDepthMm")),
        customerGroupIds: asStringList(formData.get("customerGroupIds")),
        active: asBoolean(formData.get("active")),
      },
    },
  );
  finish("services", mutationMessage(result, "Servicio de transportista guardado."));
}

export async function upsertShippingRateRuleAction(formData: FormData) {
  const context = await getAdminContext();
  const shippingRateRuleId = asString(formData.get("shippingRateRuleId"));
  const carrierServiceId = asString(formData.get("carrierServiceId"));
  const zoneId = asString(formData.get("zoneId"));

  if (!shippingRateRuleId || !carrierServiceId || !zoneId) {
    finish("rules", "Falta shippingRateRuleId, carrierServiceId o zoneId.");
  }

  const ratingBasis = asString(formData.get("ratingBasis")) ?? "WEIGHT";
  const result = await mutateShipping(
    context,
    scopedPath("/admin/shipping/rate-rules", context.organizationId, context.shopId),
    {
      rateRule: {
        shippingRateRuleId,
        carrierServiceId,
        zoneId,
        ratingBasis,
        minWeightGrams: ratingBasis === "WEIGHT" ? asNullableNumber(formData.get("minWeightGrams")) : null,
        maxWeightGrams: ratingBasis === "WEIGHT" ? asNullableNumber(formData.get("maxWeightGrams")) : null,
        minOrderAmountMinor: ratingBasis === "PRICE" ? asNullableNumber(formData.get("minOrderAmountMinor")) : null,
        maxOrderAmountMinor: ratingBasis === "PRICE" ? asNullableNumber(formData.get("maxOrderAmountMinor")) : null,
        priceMinor: asNumber(formData.get("priceMinor")) ?? 0,
        currency: asString(formData.get("currency")) ?? context.currency,
        taxRateBasisPoints: asNumber(formData.get("taxRateBasisPoints")) ?? 0,
        freeShippingThresholdMinor: asNullableNumber(formData.get("freeShippingThresholdMinor")),
        outOfRangeBehavior: asString(formData.get("outOfRangeBehavior")) ?? "DISABLE_CARRIER",
        priority: asNumber(formData.get("priority")) ?? 10,
        active: asBoolean(formData.get("active")),
      },
    },
  );
  finish("rules", mutationMessage(result, "Regla tarifaria guardada."));
}

export async function setShippingResourceActiveAction(formData: FormData) {
  const context = await getAdminContext();
  const tab = asString(formData.get("tab")) as ShippingAdminTab | undefined;
  const resource = asString(formData.get("resource"));
  const id = asString(formData.get("id"));
  const active = asOptionalBoolean(formData.get("active"));
  const includeInactive = asString(formData.get("includeInactive")) === "true";

  if (!tab || !resource || !id || typeof active !== "boolean") {
    finish(tab ?? "summary", "Falta recurso, id o estado activo.", includeInactive);
  }

  const result = await patchShippingActive(
    context,
    scopedPath(`/admin/shipping/${resource}/${encodeURIComponent(id)}/active`, context.organizationId, context.shopId),
    active,
  );
  finish(tab, mutationMessage(result, active ? "Recurso reactivado." : "Recurso desactivado."), includeInactive);
}

export async function transitionShippingFulfillmentAction(formData: FormData) {
  const context = await getAdminContext();
  const fulfillmentId = asString(formData.get("fulfillmentId"));
  const status = asString(formData.get("status"));
  const trackingNumber = asString(formData.get("trackingNumber"));
  const carrierId = asString(formData.get("carrierId"));

  if (!context.organizationId || !context.shopId) {
    fulfillmentFinish(formData, "Selecciona Organization y Shop antes de actualizar el envío.");
  }
  if (!fulfillmentId || !isShippingFulfillmentStatus(status)) {
    fulfillmentFinish(formData, "Falta fulfillmentId o el estado logístico no es válido.");
  }
  if (status === "SHIPPED" && !trackingNumber) {
    fulfillmentFinish(formData, "Número de tracking requerido para marcar como enviado.");
  }

  const result = await transitionShippingFulfillment(context, fulfillmentId, {
    status,
    ...(trackingNumber ? { trackingNumber } : {}),
    ...(carrierId ? { carrierId } : {}),
  });

  const message = result.ok
    ? `Estado logístico actualizado a ${status}.`
    : result.status === 403
      ? "Falta permiso shipping.logistics.write."
      : result.error;
  fulfillmentFinish(formData, message);
}

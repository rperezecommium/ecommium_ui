"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "../../shared/config/admin-context";
import {
  createPromotionCoupon,
  deletePromotionCoupon,
  updatePromotionCoupon,
} from "./promotions-admin";

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

function asIsoOrNull(value: FormDataEntryValue | null) {
  const text = asString(value);
  if (!text) {
    return null;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function finish(message: string, keep?: Record<string, string | undefined>): never {
  revalidatePath("/admin/promociones");
  const params = new URLSearchParams({ promotionMessage: message });
  for (const [key, value] of Object.entries(keep ?? {})) {
    if (value) {
      params.set(key, value);
    }
  }

  redirect(`/admin/promociones?${params.toString()}`);
}

function mutationMessage(
  result: { ok: true } | { ok: false; status?: number; error: string },
  success: string,
) {
  if (result.ok) {
    return success;
  }

  return result.status === 403 ? "Falta permiso promotions.admin.write." : result.error;
}

function discountType(value: FormDataEntryValue | null) {
  return asString(value) === "FIXED" ? "FIXED" : "PERCENTAGE";
}

function couponPayload(formData: FormData, includeCode: boolean) {
  const selectedDiscountType = discountType(formData.get("discountType"));
  const value = asNumber(formData.get("value"));
  const minSubtotalMinor = asNumber(formData.get("minSubtotalMinor"));
  const couponCode = asString(formData.get("couponCode"))?.toUpperCase();
  const payload: Record<string, unknown> = {
    name: asString(formData.get("name")),
    discountType: selectedDiscountType,
    value:
      selectedDiscountType === "FIXED" && typeof value === "number"
        ? Math.trunc(value)
        : value,
    currency: asString(formData.get("currency"))?.toUpperCase(),
    minSubtotalMinor:
      typeof minSubtotalMinor === "number" ? Math.max(0, Math.trunc(minSubtotalMinor)) : 0,
    validFrom: asIsoOrNull(formData.get("validFrom")),
    validTo: asIsoOrNull(formData.get("validTo")),
    active: asBoolean(formData.get("active")),
  };

  if (includeCode) {
    payload.couponCode = couponCode;
  }

  return { payload, couponCode };
}

function keepFilters(formData: FormData) {
  return {
    q: asString(formData.get("q")),
    status: asString(formData.get("status")),
  };
}

export async function createPromotionCouponAction(formData: FormData) {
  const context = await getAdminContext();
  const { payload, couponCode } = couponPayload(formData, true);

  if (!couponCode || !payload.name || typeof payload.value !== "number" || !payload.currency) {
    finish("Faltan datos obligatorios del cupon.", keepFilters(formData));
  }

  const result = await createPromotionCoupon(context, payload);
  finish(mutationMessage(result, "Cupon creado."), keepFilters(formData));
}

export async function updatePromotionCouponAction(formData: FormData) {
  const context = await getAdminContext();
  const couponCode = asString(formData.get("couponCode"))?.toUpperCase();
  const { payload } = couponPayload(formData, false);

  if (!couponCode || !payload.name || typeof payload.value !== "number" || !payload.currency) {
    finish("Faltan datos obligatorios del cupon.", keepFilters(formData));
  }

  const result = await updatePromotionCoupon(context, couponCode, payload);
  finish(mutationMessage(result, "Cupon actualizado."), keepFilters(formData));
}

export async function deletePromotionCouponAction(formData: FormData) {
  const context = await getAdminContext();
  const couponCode = asString(formData.get("couponCode"))?.toUpperCase();
  const confirmed = asString(formData.get("confirmDelete")) === "DESACTIVAR";

  if (!confirmed) {
    finish("Confirma escribiendo DESACTIVAR antes de desactivar el cupon.", keepFilters(formData));
  }
  if (!couponCode) {
    finish("Falta codigo de cupon.", keepFilters(formData));
  }

  const result = await deletePromotionCoupon(context, couponCode, "soft");
  finish(mutationMessage(result, "Cupon desactivado."), { ...keepFilters(formData), status: "all" });
}

export async function hardDeletePromotionCouponAction(formData: FormData) {
  const context = await getAdminContext();
  const couponCode = asString(formData.get("couponCode"))?.toUpperCase();
  const confirmedCode = asString(formData.get("confirmHardDelete"))?.toUpperCase();

  if (!couponCode) {
    finish("Falta codigo de cupon.", keepFilters(formData));
  }
  if (confirmedCode !== couponCode) {
    finish(`Confirma escribiendo ${couponCode} antes de eliminar definitivamente el cupon.`, keepFilters(formData));
  }

  const result = await deletePromotionCoupon(context, couponCode, "hard");
  finish(mutationMessage(result, "Cupon eliminado definitivamente."), { ...keepFilters(formData), status: "all" });
}

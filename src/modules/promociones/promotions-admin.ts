import { requestBff } from "../../shared/bff/client";
import type { BffResult } from "../../shared/bff/types";
import type { AdminContext } from "../../shared/config/admin-context";

export type PromotionCouponDiscountType = "FIXED" | "PERCENTAGE";
export type PromotionsAdminStatusFilter = "active" | "all";

export type PromotionCoupon = {
  organizationId: string;
  shopId: string;
  couponCode: string;
  name: string;
  discountType: PromotionCouponDiscountType;
  value: number;
  currency: string;
  minSubtotalMinor: number;
  validFrom: string | null;
  validTo: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PromotionCouponList = {
  coupons: PromotionCoupon[];
  total: number;
};

export type PromotionsAdminResult<T> = {
  source: "bff" | "unavailable";
  data: T;
  message?: string;
  failedEndpoint?: string;
  status?: number;
  permission?: "promotions.admin.write";
  correlationId?: string;
};

export type PromotionsAdminFilters = {
  q?: string;
  status?: PromotionsAdminStatusFilter;
  promotionMessage?: string;
  drawer?: "create" | "edit";
  couponCode?: string;
};

export type PromotionsAdminData = {
  coupons: PromotionsAdminResult<PromotionCouponList>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function discountTypeValue(value: unknown): PromotionCouponDiscountType {
  return value === "FIXED" ? "FIXED" : "PERCENTAGE";
}

function normalizeCoupon(value: unknown): PromotionCoupon {
  const record = asRecord(value);
  const couponRecord = record.coupon ? asRecord(record.coupon) : record;

  return {
    organizationId: stringValue(couponRecord.organizationId),
    shopId: stringValue(couponRecord.shopId),
    couponCode: stringValue(couponRecord.couponCode),
    name: stringValue(couponRecord.name),
    discountType: discountTypeValue(couponRecord.discountType),
    value: numberValue(couponRecord.value),
    currency: stringValue(couponRecord.currency),
    minSubtotalMinor: numberValue(couponRecord.minSubtotalMinor),
    validFrom: nullableString(couponRecord.validFrom),
    validTo: nullableString(couponRecord.validTo),
    active: booleanValue(couponRecord.active, true),
    createdAt: stringValue(couponRecord.createdAt),
    updatedAt: stringValue(couponRecord.updatedAt),
  };
}

function normalizeCouponList(value: unknown): PromotionCouponList {
  const record = asRecord(value);
  const rawCoupons = Array.isArray(record.coupons)
    ? record.coupons
    : Array.isArray(record.items)
      ? record.items
      : [];
  const coupons = rawCoupons.map(normalizeCoupon);

  return {
    coupons,
    total: numberValue(record.total, coupons.length),
  };
}

function makeScopedParams(
  context: AdminContext,
  extra?: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();

  if (context.organizationId) {
    params.set("organizationId", context.organizationId);
  }
  if (context.shopId) {
    params.set("shopId", context.shopId);
  }
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value?.trim()) {
      params.set(key, value.trim());
    }
  }

  return params;
}

function unavailable<T>(
  endpoint: string,
  fallback: T,
  result: Extract<BffResult<T>, { ok: false }>,
): PromotionsAdminResult<T> {
  return {
    source: "unavailable",
    data: fallback,
    message: result.status === 403 ? "Falta permiso promotions.admin.write." : result.error,
    failedEndpoint: endpoint,
    status: result.status,
    permission: result.status === 403 ? "promotions.admin.write" : undefined,
    correlationId: result.correlationId,
  };
}

function matchesCoupon(coupon: PromotionCoupon, query: string | undefined) {
  const normalized = query?.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return (
    coupon.couponCode.toLowerCase().includes(normalized) ||
    coupon.name.toLowerCase().includes(normalized)
  );
}

export async function getPromotionsAdminData(
  context: AdminContext,
  filters: PromotionsAdminFilters,
): Promise<PromotionsAdminData> {
  const includeInactive = filters.status === "all" ? "true" : undefined;
  const endpoint = `/admin/promotions/coupons?${makeScopedParams(context, {
    includeInactive,
  }).toString()}`;
  const result = await requestBff(endpoint, { context, parse: normalizeCouponList });

  if (!result.ok) {
    return {
      coupons: unavailable(endpoint, { coupons: [], total: 0 }, result),
    };
  }

  const filteredCoupons = result.data.coupons.filter((coupon) =>
    matchesCoupon(coupon, filters.q),
  );

  return {
    coupons: {
      source: "bff",
      data: {
        coupons: filteredCoupons,
        total: filteredCoupons.length,
      },
      correlationId: result.correlationId,
    },
  };
}

export async function createPromotionCoupon(
  context: AdminContext,
  payload: Record<string, unknown>,
) {
  const endpoint = `/admin/promotions/coupons?${makeScopedParams(context).toString()}`;

  return requestBff(endpoint, {
    context,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
    parse: normalizeCoupon,
  });
}

export async function updatePromotionCoupon(
  context: AdminContext,
  couponCode: string,
  payload: Record<string, unknown>,
) {
  const endpoint = `/admin/promotions/coupons/${encodeURIComponent(couponCode)}?${makeScopedParams(context).toString()}`;

  return requestBff(endpoint, {
    context,
    init: {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
    parse: normalizeCoupon,
  });
}

export async function deletePromotionCoupon(
  context: AdminContext,
  couponCode: string,
  mode = "soft",
) {
  const endpoint = `/admin/promotions/coupons/${encodeURIComponent(couponCode)}?${makeScopedParams(context, {
    mode,
  }).toString()}`;

  return requestBff(endpoint, {
    context,
    init: {
      method: "DELETE",
    },
    parse: normalizeCoupon,
  });
}

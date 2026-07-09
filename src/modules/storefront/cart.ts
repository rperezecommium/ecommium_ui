export type StorefrontCartTotals = {
  currency?: string;
  discountsTotalMinor?: number;
  grandTotalMinor?: number;
  itemsSubtotalMinor?: number;
  offeringsTotalMinor?: number;
  shippingTotalMinor?: number;
  taxTotalMinor?: number;
};

export type StorefrontCartItem = {
  availableOfferings: StorefrontCartOffering[];
  imageAlt?: string;
  imageUrl?: string;
  lineTotalMinor?: number;
  manualUnitPriceMinor?: number;
  name: string;
  productId?: string;
  productSlug?: string;
  productUrlPath?: string;
  publicUrl?: string;
  quantity: number;
  refId?: string;
  unitPriceMinor?: number;
  variantId?: string;
};

export type StorefrontCartOffering = {
  active?: boolean;
  currency?: string;
  name: string;
  offeringId?: string;
  priceMinor?: number;
  type?: string;
};

export type StorefrontCouponOffer = {
  couponCode: string;
  description?: string;
  discountType?: string;
  name: string;
  value?: number;
  currency?: string;
  minSubtotalMinor?: number;
  validTo?: string;
};

export type StorefrontOrderform = {
  availableCoupons: StorefrontCouponOffer[];
  clientProfileData?: Record<string, unknown> | null;
  couponData?: Record<string, unknown> | null;
  createdAt?: string;
  currency: string;
  items: StorefrontCartItem[];
  orderFormId?: string;
  paymentData?: Record<string, unknown> | null;
  shippingData?: Record<string, unknown> | null;
  totals: StorefrontCartTotals;
  updatedAt?: string;
};

export function normalizeOrderformPayload(payload: unknown): StorefrontOrderform {
  const envelope = asRecord(payload);
  const orderform = asRecord(envelope.orderform ?? envelope.cart ?? envelope.orderForm ?? envelope);
  const totals = normalizeTotals(orderform.totals);
  const context = asRecord(envelope.storefrontContext);
  const currency =
    asString(context.currency) ??
    asString(orderform.currency) ??
    asString(totals.currency) ??
    "EUR";

  return {
    availableCoupons: normalizeAvailableCoupons(orderform),
    clientProfileData: nullableRecord(orderform.clientProfileData),
    couponData: nullableRecord(orderform.couponData),
    createdAt: asString(orderform.createdAt),
    currency,
    items: listItems(orderform.items).map(normalizeCartItem),
    orderFormId: extractOrderFormId(orderform),
    paymentData: nullableRecord(orderform.paymentData),
    shippingData: nullableRecord(orderform.shippingData),
    totals: {
      ...totals,
      currency,
    },
    updatedAt: asString(orderform.updatedAt),
  };
}

export function extractOrderFormId(payload: unknown): string | undefined {
  const root = asRecord(payload);
  const nested = asRecord(root.orderform ?? root.orderForm ?? root.cart);
  return (
    asString(root.orderFormId) ??
    asString(root.orderformId) ??
    asString(root.id) ??
    asString(nested.orderFormId) ??
    asString(nested.orderformId) ??
    asString(nested.id)
  );
}

export function cartTotalItems(orderform: StorefrontOrderform | undefined | null) {
  return orderform?.items.reduce((total, item) => total + item.quantity, 0) ?? 0;
}

export function cartItemUnitPriceMinor(item: StorefrontCartItem) {
  return item.manualUnitPriceMinor ?? item.unitPriceMinor ?? 0;
}

export function cartItemLineTotalMinor(item: StorefrontCartItem) {
  return item.lineTotalMinor ?? cartItemUnitPriceMinor(item) * item.quantity;
}

export function cartGrandTotalMinor(orderform: StorefrontOrderform | undefined | null) {
  return orderform?.totals.grandTotalMinor ?? orderform?.items.reduce((total, item) => total + cartItemLineTotalMinor(item), 0) ?? 0;
}

export function cartDiscountsTotalMinor(orderform: StorefrontOrderform | undefined | null) {
  return orderform?.totals.discountsTotalMinor ?? 0;
}

export function cartHasShippingData(orderform: StorefrontOrderform | undefined | null) {
  return Boolean(orderform?.shippingData && Object.keys(orderform.shippingData).length > 0);
}

export function cartHasCouponData(orderform: StorefrontOrderform | undefined | null) {
  return Boolean(orderform?.couponData && Object.keys(orderform.couponData).length > 0);
}

export function cartCouponCode(orderform: StorefrontOrderform | undefined | null) {
  const couponData = orderform?.couponData;
  if (!couponData) {
    return undefined;
  }

  return (
    asString(couponData.couponCode) ??
    asString(couponData.code) ??
    asString(couponData.identifier) ??
    asString(couponData.promoCode)
  );
}

export function cartAvailableCoupons(orderform: StorefrontOrderform | undefined | null) {
  return orderform?.availableCoupons ?? [];
}

export function cartAppliedCouponOffer(orderform: StorefrontOrderform | undefined | null) {
  const couponCode = cartCouponCode(orderform);
  if (!couponCode) {
    return undefined;
  }

  const normalizedCode = couponCode.toUpperCase();
  const matchingOffer = cartAvailableCoupons(orderform).find((coupon) => coupon.couponCode.toUpperCase() === normalizedCode);
  if (matchingOffer) {
    return matchingOffer;
  }

  const couponData = orderform?.couponData;
  if (!couponData) {
    return undefined;
  }

  return {
    couponCode: normalizedCode,
    currency: asString(couponData.currency),
    description: asString(couponData.description),
    discountType: asString(couponData.discountType) ?? asString(couponData.type),
    minSubtotalMinor: asNumber(couponData.minSubtotalMinor) ?? asNumber(couponData.minimumSubtotalMinor),
    name: asString(couponData.name) ?? normalizedCode,
    validTo: asString(couponData.validTo) ?? asString(couponData.expiresAt),
    value: asNumber(couponData.value),
  };
}

export function formatCartMoney(valueMinor: number | undefined, currency = "EUR", locale = "es-ES") {
  const amount = (valueMinor ?? 0) / 100;
  return new Intl.NumberFormat(locale, {
    currency,
    style: "currency",
  }).format(amount);
}

function normalizeCartItem(value: unknown): StorefrontCartItem {
  const item = asRecord(value);
  const image = asRecord(item.image);
  const price = asRecord(item.price);
  const quantity = Math.max(0, asNumber(item.quantity) ?? 0);
  const unitPriceMinor =
    asNumber(item.unitPriceMinor) ??
    asNumber(item.priceMinor) ??
    asNumber(price.currentAmountMinor);
  const manualUnitPriceMinor = asNumber(item.manualUnitPriceMinor);
  const lineTotalMinor =
    asNumber(item.lineTotalMinor) ??
    asNumber(item.totalMinor) ??
    (unitPriceMinor !== undefined ? (manualUnitPriceMinor ?? unitPriceMinor) * quantity : undefined);

  return {
    availableOfferings: listItems(item.availableOfferings).map(normalizeOffering),
    imageAlt: asString(item.imageAlt) ?? asString(image.altText) ?? asString(image.alt),
    imageUrl: asString(item.imageUrl) ?? asString(item.publicUrl) ?? asString(image.url),
    lineTotalMinor,
    manualUnitPriceMinor,
    name: asString(item.name) ?? asString(item.productName) ?? asString(item.title) ?? "Producto",
    productId: asString(item.productId),
    productSlug: asString(item.productSlug) ?? asString(item.slug),
    productUrlPath: asString(item.productUrlPath),
    publicUrl: asString(item.publicUrl),
    quantity,
    refId: asString(item.refId) ?? asString(item.reference),
    unitPriceMinor,
    variantId: asString(item.variantId),
  };
}

function normalizeOffering(value: unknown): StorefrontCartOffering {
  const offering = asRecord(value);
  return {
    active: typeof offering.active === "boolean" ? offering.active : undefined,
    currency: asString(offering.currency),
    name: asString(offering.name) ?? "Servicio",
    offeringId: asString(offering.offeringId),
    priceMinor: asNumber(offering.priceMinor),
    type: asString(offering.type),
  };
}

function normalizeAvailableCoupons(orderform: Record<string, unknown>) {
  const coupons = [
    ...listItems(orderform.availableCoupons),
    ...listItems(orderform.availablePromotions),
    ...listItems(orderform.couponOffers),
    ...listItems(asRecord(orderform.couponData).availableCoupons),
  ]
    .map(normalizeCouponOffer)
    .filter((coupon): coupon is StorefrontCouponOffer => Boolean(coupon));

  return uniqueCouponOffers(coupons);
}

function normalizeCouponOffer(value: unknown): StorefrontCouponOffer | null {
  const coupon = asRecord(value);
  const couponCode =
    asString(coupon.couponCode) ??
    asString(coupon.code) ??
    asString(coupon.identifier) ??
    asString(coupon.promoCode);

  if (!couponCode) {
    return null;
  }

  return {
    couponCode: couponCode.toUpperCase(),
    currency: asString(coupon.currency),
    description: asString(coupon.description),
    discountType: asString(coupon.discountType) ?? asString(coupon.type),
    minSubtotalMinor: asNumber(coupon.minSubtotalMinor) ?? asNumber(coupon.minimumSubtotalMinor),
    name: asString(coupon.name) ?? asString(coupon.title) ?? couponCode,
    validTo: asString(coupon.validTo) ?? asString(coupon.expiresAt),
    value: asNumber(coupon.value),
  };
}

function uniqueCouponOffers(coupons: StorefrontCouponOffer[]) {
  const byCode = new Map<string, StorefrontCouponOffer>();
  for (const coupon of coupons) {
    const key = coupon.couponCode.toUpperCase();
    if (!byCode.has(key)) {
      byCode.set(key, coupon);
    }
  }

  return [...byCode.values()];
}

function normalizeTotals(value: unknown): StorefrontCartTotals {
  const totals = asRecord(value);
  return {
    currency: asString(totals.currency),
    discountsTotalMinor: normalizeDiscountTotalMinor(totals),
    grandTotalMinor: asNumber(totals.grandTotalMinor) ?? asNumber(totals.totalMinor),
    itemsSubtotalMinor: asNumber(totals.itemsSubtotalMinor) ?? asNumber(totals.subtotalMinor),
    offeringsTotalMinor: asNumber(totals.offeringsTotalMinor),
    shippingTotalMinor: asNumber(totals.shippingTotalMinor),
    taxTotalMinor: asNumber(totals.taxTotalMinor) ?? asNumber(totals.taxesTotalMinor),
  };
}

function normalizeDiscountTotalMinor(totals: Record<string, unknown>) {
  const value =
    asNumber(totals.discountsTotalMinor) ??
    asNumber(totals.discountTotalMinor) ??
    asNumber(totals.discountTotal) ??
    asNumber(totals.couponDiscountMinor) ??
    asNumber(totals.promotionDiscountMinor) ??
    asNumber(totals.promotionsTotalMinor) ??
    asNumber(totals.promotionTotalMinor);

  return typeof value === "number" ? Math.abs(value) : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function nullableRecord(value: unknown) {
  const record = asRecord(value);
  return Object.keys(record).length > 0 ? record : null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function listItems(value: unknown) {
  return Array.isArray(value) ? value : [];
}

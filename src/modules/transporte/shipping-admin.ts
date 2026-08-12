import { requestAdminBff } from "../../shared/bff/admin-client";
import type { BffResult } from "../../shared/bff/types";
import type { AdminContext } from "../../shared/config/admin-context";

export type ShippingAdminTab = "summary" | "zones" | "carriers" | "services" | "rules" | "quote" | "fulfillments";

export type ShippingScalar = string | number | boolean | null | undefined | string[];
export type ShippingRecord = Record<string, ShippingScalar>;

export type ShippingAdminResult<T> = {
  source: "bff" | "unavailable";
  data: T;
  message?: string;
  failedEndpoint?: string;
  status?: number;
  permission?: "shipping.logistics.read" | "shipping.logistics.write";
};

export type ShippingConfigurationData = {
  organizationId: string;
  shopId: string;
  zones: ShippingRecord[];
  carriers: ShippingRecord[];
  carrierServices: ShippingRecord[];
  rateRules: ShippingRecord[];
};

export const shippingFulfillmentStatuses = [
  "PENDING_FULFILLMENT",
  "READY_TO_PICK",
  "PICKING",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "FAILED",
] as const;

export type ShippingFulfillmentStatus = (typeof shippingFulfillmentStatuses)[number];
export type ShippingFulfillmentDisplayStatus = ShippingFulfillmentStatus | "UNKNOWN";

export const shippingFulfillmentTransitions: Record<ShippingFulfillmentStatus, readonly ShippingFulfillmentStatus[]> = {
  PENDING_FULFILLMENT: ["READY_TO_PICK", "FAILED"],
  READY_TO_PICK: ["PICKING", "FAILED"],
  PICKING: ["PACKED", "FAILED"],
  PACKED: ["SHIPPED", "FAILED"],
  SHIPPED: ["DELIVERED", "FAILED"],
  DELIVERED: [],
  FAILED: [],
};

export function nextShippingFulfillmentStatuses(status: ShippingFulfillmentDisplayStatus) {
  return status === "UNKNOWN" ? [] : shippingFulfillmentTransitions[status];
}

export type ShippingFulfillmentCarrier = {
  id: string | null;
  label: string | null;
  logoUrl: string | null;
  trackingUrlTemplate: string | null;
};

export type ShippingFulfillmentDeliveryAddress = {
  addressType: string | null;
  receiverName: string | null;
  addressId: string | null;
  isDisposable: boolean | null;
  postalCode: string;
  city: string;
  state: string;
  country: string;
  street: string;
  number: string;
  neighborhood: string | null;
  complement: string | null;
  reference: string | null;
  geoCoordinates: [number, number] | null;
};

export type ShippingFulfillmentItem = {
  lineId: string | null;
  productId: string | null;
  variantId: string;
  name: string | null;
  quantity: number;
};

export type ShippingFulfillment = {
  fulfillmentId: string;
  version: number;
  orderId: string;
  orderReference: string | null;
  customerId: string | null;
  organizationId: string;
  shopId: string;
  warehouseId: string;
  dockId: string;
  carrierId: string;
  status: ShippingFulfillmentDisplayStatus;
  trackingNumber: string | null;
  trackingUrl: string | null;
  carrier: ShippingFulfillmentCarrier | null;
  deliveryAddress: ShippingFulfillmentDeliveryAddress | null;
  logisticsSnapshot: Record<string, unknown> | null;
  items: ShippingFulfillmentItem[];
  createdAt: string;
  updatedAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
};

export type ShippingFulfillmentsData = {
  items: ShippingFulfillment[];
  total: number;
  limit: number;
  offset: number;
};

export type ShippingFulfillmentFilters = {
  status?: ShippingFulfillmentStatus;
  limit?: number;
  offset?: number;
};

export type ShippingFulfillmentTransitionInput = {
  status: ShippingFulfillmentStatus;
  trackingNumber?: string;
  carrierId?: string;
};

export type ShippingAdminData = {
  tab: ShippingAdminTab;
  configuration: ShippingAdminResult<ShippingConfigurationData>;
  quote: ShippingAdminResult<ShippingQuoteData> | null;
  fulfillments: ShippingAdminResult<ShippingFulfillmentsData> | null;
  selectedFulfillment: ShippingAdminResult<ShippingFulfillment | null> | null;
};

export type ShippingAdminFilters = {
  tab: ShippingAdminTab;
  includeInactive?: boolean;
  quoteRequested?: boolean;
  postalCode?: string;
  city?: string;
  state?: string;
  country?: string;
  variantId?: string;
  quantity?: string;
  priceMinor?: string;
  weightGrams?: string;
  widthMm?: string;
  heightMm?: string;
  depthMm?: string;
  itemsSubtotalMinor?: string;
  customerGroupId?: string;
  fulfillmentStatus?: ShippingFulfillmentStatus;
  fulfillmentsLimit?: number;
  fulfillmentsOffset?: number;
  fulfillmentId?: string;
};

export type ShippingQuoteLogisticsInfo = {
  itemIndex: number;
  itemId: string;
  selectedSla: string;
  selectedDeliveryChannel: string;
  shipsTo: string[];
  slas: ShippingRecord[];
};

export type ShippingQuoteData = {
  organizationId: string;
  shopId: string;
  currency: string;
  selectedAddress: ShippingRecord;
  logisticsInfo: ShippingQuoteLogisticsInfo[];
  calculatedAt?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function listItems(value: unknown): unknown[] {
  const record = asRecord(value);
  const items = record.items ?? record.data ?? record.results ?? value;
  return Array.isArray(items) ? items : [];
}

function scalar(value: unknown): ShippingScalar {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    typeof value === "undefined"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(String);
  }

  return undefined;
}

function normalizeRecord(value: unknown): ShippingRecord {
  const record = asRecord(value);
  const normalized: ShippingRecord = {};

  for (const [key, item] of Object.entries(record)) {
    normalized[key] = scalar(item);
  }

  return normalized;
}

function normalizeList(value: unknown): ShippingRecord[] {
  return listItems(value).map(normalizeRecord);
}

function normalizeConfiguration(value: unknown): ShippingConfigurationData {
  const record = asRecord(value);

  return {
    organizationId: String(record.organizationId ?? ""),
    shopId: String(record.shopId ?? ""),
    zones: normalizeList(record.zones),
    carriers: normalizeList(record.carriers),
    carrierServices: normalizeList(record.carrierServices),
    rateRules: normalizeList(record.rateRules),
  };
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanOrNull(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function fulfillmentStatus(value: unknown): ShippingFulfillmentDisplayStatus {
  return typeof value === "string" && shippingFulfillmentStatuses.includes(value as ShippingFulfillmentStatus)
    ? value as ShippingFulfillmentStatus
    : "UNKNOWN";
}

function normalizeCarrier(value: unknown): ShippingFulfillmentCarrier | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = asRecord(value);
  return {
    id: stringOrNull(record.id),
    label: stringOrNull(record.label),
    logoUrl: stringOrNull(record.logoUrl),
    trackingUrlTemplate: stringOrNull(record.trackingUrlTemplate),
  };
}

function normalizeDeliveryAddress(value: unknown): ShippingFulfillmentDeliveryAddress | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = asRecord(value);
  const geoCoordinates = Array.isArray(record.geoCoordinates) && record.geoCoordinates.length === 2
    && record.geoCoordinates.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate))
    ? [record.geoCoordinates[0] as number, record.geoCoordinates[1] as number] as [number, number]
    : null;

  return {
    addressType: stringOrNull(record.addressType),
    receiverName: stringOrNull(record.receiverName),
    addressId: stringOrNull(record.addressId),
    isDisposable: booleanOrNull(record.isDisposable),
    postalCode: typeof record.postalCode === "string" ? record.postalCode : "",
    city: typeof record.city === "string" ? record.city : "",
    state: typeof record.state === "string" ? record.state : "",
    country: typeof record.country === "string" ? record.country : "",
    street: typeof record.street === "string" ? record.street : "",
    number: typeof record.number === "string" ? record.number : "",
    neighborhood: stringOrNull(record.neighborhood),
    complement: stringOrNull(record.complement),
    reference: stringOrNull(record.reference),
    geoCoordinates,
  };
}

function normalizeFulfillmentItem(value: unknown): ShippingFulfillmentItem {
  const record = asRecord(value);
  return {
    lineId: stringOrNull(record.lineId),
    productId: stringOrNull(record.productId),
    variantId: typeof record.variantId === "string" ? record.variantId : "",
    name: stringOrNull(record.name),
    quantity: numberOr(record.quantity, 0),
  };
}

function normalizeFulfillment(value: unknown): ShippingFulfillment {
  const record = asRecord(value);
  const logisticsSnapshot = typeof record.logisticsSnapshot === "object" && record.logisticsSnapshot !== null
    ? asRecord(record.logisticsSnapshot)
    : null;

  return {
    fulfillmentId: typeof record.fulfillmentId === "string" ? record.fulfillmentId : "",
    version: numberOr(record.version, 0),
    orderId: typeof record.orderId === "string" ? record.orderId : "",
    orderReference: stringOrNull(record.orderReference),
    customerId: stringOrNull(record.customerId),
    organizationId: typeof record.organizationId === "string" ? record.organizationId : "",
    shopId: typeof record.shopId === "string" ? record.shopId : "",
    warehouseId: typeof record.warehouseId === "string" ? record.warehouseId : "",
    dockId: typeof record.dockId === "string" ? record.dockId : "",
    carrierId: typeof record.carrierId === "string" ? record.carrierId : "",
    status: fulfillmentStatus(record.status),
    trackingNumber: stringOrNull(record.trackingNumber),
    trackingUrl: stringOrNull(record.trackingUrl),
    carrier: normalizeCarrier(record.carrier),
    deliveryAddress: normalizeDeliveryAddress(record.deliveryAddress),
    logisticsSnapshot,
    items: Array.isArray(record.items) ? record.items.map(normalizeFulfillmentItem) : [],
    createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
    shippedAt: stringOrNull(record.shippedAt),
    deliveredAt: stringOrNull(record.deliveredAt),
  };
}

function normalizeFulfillments(value: unknown): ShippingFulfillmentsData {
  const record = asRecord(value);

  return {
    items: Array.isArray(record.items) ? record.items.map(normalizeFulfillment) : [],
    total: Math.max(0, numberOr(record.total, 0)),
    limit: Math.max(0, numberOr(record.limit, 0)),
    offset: Math.max(0, numberOr(record.offset, 0)),
  };
}

function normalizeFulfillmentTransition(value: unknown): ShippingFulfillment {
  const record = asRecord(value);
  return normalizeFulfillment(record.fulfillment ?? value);
}

function normalizeQuote(value: unknown): ShippingQuoteData {
  const record = asRecord(value);

  return {
    organizationId: String(record.organizationId ?? ""),
    shopId: String(record.shopId ?? ""),
    currency: String(record.currency ?? "EUR"),
    selectedAddress: normalizeRecord(record.selectedAddress),
    logisticsInfo: listItems(record.logisticsInfo).map((item) => {
      const itemRecord = asRecord(item);
      return {
        itemIndex: Number(itemRecord.itemIndex ?? 0),
        itemId: String(itemRecord.itemId ?? ""),
        selectedSla: String(itemRecord.selectedSla ?? ""),
        selectedDeliveryChannel: String(itemRecord.selectedDeliveryChannel ?? ""),
        shipsTo: Array.isArray(itemRecord.shipsTo) ? itemRecord.shipsTo.map(String) : [],
        slas: normalizeList(itemRecord.slas),
      };
    }),
    calculatedAt: typeof record.calculatedAt === "string" ? record.calculatedAt : undefined,
  };
}

function makeScopedParams(context: AdminContext, extra?: Record<string, string | undefined>) {
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
  permission: "shipping.logistics.read" | "shipping.logistics.write" = "shipping.logistics.read",
): ShippingAdminResult<T> {
  return {
    source: "unavailable",
    data: fallback,
    message: result.status === 403 ? `Falta permiso ${permission}.` : result.error,
    failedEndpoint: endpoint,
    status: result.status,
    permission: result.status === 403 ? permission : undefined,
  };
}

function numberFromFilter(value: string | undefined, fallback: number) {
  if (!value?.trim()) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function nonNegativeQueryNumber(value: number | undefined, fallback: number) {
  return Number.isFinite(value) && typeof value === "number"
    ? String(Math.max(0, Math.trunc(value)))
    : String(fallback);
}

function nullableNumberFromFilter(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function buildQuotePayload(context: AdminContext, filters: ShippingAdminFilters) {
  const quantity = Math.max(1, numberFromFilter(filters.quantity, 1));
  const priceMinor = Math.max(0, numberFromFilter(filters.priceMinor, 4000));

  return {
    currency: context.currency || "EUR",
    selectedAddress: {
      postalCode: filters.postalCode?.trim() || "28001",
      city: filters.city?.trim() || "Madrid",
      state: (filters.state?.trim() || context.country || "ES").toUpperCase(),
      country: (filters.country?.trim() || context.country || "ES").toUpperCase(),
    },
    itemsSubtotalMinor: numberFromFilter(filters.itemsSubtotalMinor, priceMinor * quantity),
    customerGroupId: filters.customerGroupId?.trim() || null,
    items: [
      {
        itemIndex: 0,
        variantId: filters.variantId?.trim() || "simulated-variant",
        quantity,
        priceMinor,
        weightGrams: Math.max(0, numberFromFilter(filters.weightGrams, 1500)),
        dimensionsMm: {
          widthMm: nullableNumberFromFilter(filters.widthMm),
          heightMm: nullableNumberFromFilter(filters.heightMm),
          depthMm: nullableNumberFromFilter(filters.depthMm),
        },
      },
    ],
  };
}

export async function getShippingAdminData(
  context: AdminContext,
  filters: ShippingAdminFilters,
): Promise<ShippingAdminData> {
  const configurationFallback = {
    organizationId: context.organizationId,
    shopId: context.shopId,
    zones: [],
    carriers: [],
    carrierServices: [],
    rateRules: [],
  };
  const configuration = filters.tab === "fulfillments"
    ? { source: "bff" as const, data: configurationFallback }
    : await readShippingConfiguration(context, filters, configurationFallback);
  const quote = filters.tab === "quote" && filters.quoteRequested
    ? await resolveShippingQuote(context, filters)
    : null;
  const [fulfillments, selectedFulfillment] = filters.tab === "fulfillments"
    ? await Promise.all([
      getShippingFulfillments(context, {
        status: filters.fulfillmentStatus,
        limit: filters.fulfillmentsLimit,
        offset: filters.fulfillmentsOffset,
      }),
      filters.fulfillmentId ? getShippingFulfillment(context, filters.fulfillmentId) : Promise.resolve(null),
    ])
    : [null, null];

  return {
    tab: filters.tab,
    configuration,
    quote,
    fulfillments,
    selectedFulfillment,
  };
}

async function readShippingConfiguration(
  context: AdminContext,
  filters: ShippingAdminFilters,
  fallback: ShippingConfigurationData,
): Promise<ShippingAdminResult<ShippingConfigurationData>> {
  const params = makeScopedParams(context, {
    includeInactive: filters.includeInactive ? "true" : "false",
  });
  const endpoint = `/admin/shipping/configuration?${params.toString()}`;
  const result = await requestAdminBff(endpoint, {
    context,
    parse: normalizeConfiguration,
  });

  return result.ok
    ? { source: "bff", data: result.data }
    : unavailable(endpoint, fallback, result);
}

async function resolveShippingQuote(
  context: AdminContext,
  filters: ShippingAdminFilters,
): Promise<ShippingAdminResult<ShippingQuoteData>> {
  const params = makeScopedParams(context);
  const endpoint = `/shipping/options/resolve?${params.toString()}`;
  const fallback = {
    organizationId: context.organizationId,
    shopId: context.shopId,
    currency: context.currency,
    selectedAddress: {},
    logisticsInfo: [],
  };
  const result = await requestAdminBff(endpoint, {
    context,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildQuotePayload(context, filters)),
    },
    parse: normalizeQuote,
  });

  return result.ok
    ? { source: "bff", data: result.data }
    : unavailable(endpoint, fallback, result);
}

export async function getShippingFulfillments(
  context: AdminContext,
  filters: ShippingFulfillmentFilters = {},
): Promise<ShippingAdminResult<ShippingFulfillmentsData>> {
  const params = makeScopedParams(context, {
    status: filters.status,
    limit: nonNegativeQueryNumber(filters.limit, 25),
    offset: nonNegativeQueryNumber(filters.offset, 0),
  });
  const endpoint = `/admin/shipping/fulfillments?${params.toString()}`;
  const fallback: ShippingFulfillmentsData = { items: [], total: 0, limit: 25, offset: 0 };
  const result = await requestAdminBff(endpoint, {
    context,
    parse: normalizeFulfillments,
  });

  return result.ok
    ? { source: "bff", data: result.data }
    : unavailable(endpoint, fallback, result, "shipping.logistics.write");
}

export async function getShippingFulfillment(
  context: AdminContext,
  fulfillmentId: string,
): Promise<ShippingAdminResult<ShippingFulfillment | null>> {
  const params = makeScopedParams(context);
  const endpoint = `/admin/shipping/fulfillments/${encodeURIComponent(fulfillmentId)}?${params.toString()}`;
  const result = await requestAdminBff(endpoint, {
    context,
    parse: normalizeFulfillment,
  });

  return result.ok
    ? { source: "bff", data: result.data }
    : unavailable(endpoint, null, result, "shipping.logistics.write");
}

export async function transitionShippingFulfillment(
  context: AdminContext,
  fulfillmentId: string,
  input: ShippingFulfillmentTransitionInput,
) {
  const params = makeScopedParams(context);
  const endpoint = `/admin/shipping/fulfillments/${encodeURIComponent(fulfillmentId)}/status?${params.toString()}`;
  return requestAdminBff(endpoint, {
    context,
    init: {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
    parse: normalizeFulfillmentTransition,
  });
}

export async function mutateShipping(
  context: AdminContext,
  path: string,
  payload: Record<string, unknown>,
) {
  return requestAdminBff(path, {
    context,
    init: {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
    parse: normalizeRecord,
  });
}

export async function patchShippingActive(
  context: AdminContext,
  path: string,
  active: boolean,
) {
  return requestAdminBff(path, {
    context,
    init: {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active }),
    },
    parse: normalizeRecord,
  });
}

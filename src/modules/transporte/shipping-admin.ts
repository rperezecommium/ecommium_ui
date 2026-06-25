import { requestBff } from "../../shared/bff/client";
import type { BffResult } from "../../shared/bff/types";
import type { AdminContext } from "../../shared/config/admin-context";

export type ShippingAdminTab = "summary" | "zones" | "carriers" | "services" | "rules" | "quote";

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

export type ShippingAdminData = {
  tab: ShippingAdminTab;
  configuration: ShippingAdminResult<ShippingConfigurationData>;
  quote: ShippingAdminResult<ShippingQuoteData> | null;
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
  const params = makeScopedParams(context, {
    includeInactive: filters.includeInactive ? "true" : "false",
  });
  const endpoint = `/admin/shipping/configuration?${params.toString()}`;
  const result = await requestBff(endpoint, {
    context,
    parse: normalizeConfiguration,
  });
  const fallback = {
    organizationId: context.organizationId,
    shopId: context.shopId,
    zones: [],
    carriers: [],
    carrierServices: [],
    rateRules: [],
  };
  const quote = filters.tab === "quote" && filters.quoteRequested
    ? await resolveShippingQuote(context, filters)
    : null;

  return {
    tab: filters.tab,
    configuration: result.ok
      ? { source: "bff", data: result.data }
      : unavailable(endpoint, fallback, result),
    quote,
  };
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
  const result = await requestBff(endpoint, {
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

export async function mutateShipping(
  context: AdminContext,
  path: string,
  payload: Record<string, unknown>,
) {
  return requestBff(path, {
    context,
    init: {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
    parse: normalizeRecord,
  });
}

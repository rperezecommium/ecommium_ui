import { requestAdminBff } from "../../shared/bff/admin-client";
import type { BffResult } from "../../shared/bff/types";
import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";

export type SearchAdminRecord = Record<string, unknown>;
export type SearchAdminTab = "lab" | "controls" | "index" | "feed";
export type SearchAdminDrawer =
  | "control-create"
  | "control-edit"
  | "control-associate"
  | "index-preview"
  | "index-import"
  | "feed-generate"
  | "feed-gcs"
  | "feed-delete";

export type SearchAdminResult<T> = {
  source: "bff" | "unavailable";
  data: T;
  message?: string;
  failedEndpoint?: string;
  status?: number;
  permission?: "search.admin.write";
};

export type SearchAdminHealth = SearchAdminRecord;

export type SearchAdminPreview = {
  raw: SearchAdminRecord;
  provider?: string;
  total?: number;
  searchTotal?: number;
  attributionToken?: string;
  products: SearchAdminRecord[];
};

export type SearchAdminFilters = {
  tab?: SearchAdminTab;
  drawer?: SearchAdminDrawer;
  controlId?: string;
  query?: string;
  pageCategory?: string;
  limit?: string;
  offset?: string;
  currency?: string;
  country?: string;
  tradePolicy?: string;
  channel?: string;
  customerGroup?: string;
  priceTableId?: string;
  warehouseId?: string;
  at?: string;
  sort?: string;
  filtersJson?: string;
  preview?: string;
  searchMessage?: string;
};

export type SearchAdminData = {
  tab: SearchAdminTab;
  health: SearchAdminResult<SearchAdminHealth>;
  preview: SearchAdminResult<SearchAdminPreview | null>;
  controls: SearchAdminResult<SearchAdminRecord[]>;
  servingConfigs: SearchAdminResult<SearchAdminRecord[]>;
};

function asRecord(value: unknown): SearchAdminRecord {
  return typeof value === "object" && value !== null ? value as SearchAdminRecord : {};
}

function listItems(value: unknown): SearchAdminRecord[] {
  const record = asRecord(value);
  const products = record.products ?? record.items ?? record.results ?? record.data ?? [];
  return Array.isArray(products) ? products.map(asRecord) : [];
}

function collectionItems(value: unknown, keys: string[]): SearchAdminRecord[] {
  if (Array.isArray(value)) {
    return value.map(asRecord);
  }

  const source = asRecord(value);
  for (const key of keys) {
    const item = source[key];
    if (Array.isArray(item)) {
      return item.map(asRecord);
    }

    const nested = asRecord(item);
    if (Array.isArray(nested.items)) {
      return nested.items.map(asRecord);
    }
    if (Array.isArray(nested.data)) {
      return nested.data.map(asRecord);
    }
  }

  return [];
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parsePositiveInteger(value: string | undefined, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function parseOffset(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function parseFilters(value: string | undefined): unknown[] {
  if (!value?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function makeScopedParams(context: AdminContext, extra?: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  params.set("organizationId", context.organizationId);
  params.set("shopId", context.shopId);
  params.set("locale", context.locale);

  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value) {
      params.set(key, value);
    }
  }

  return params;
}

function unavailable<T>(
  endpoint: string,
  fallback: T,
  result: Extract<BffResult<T>, { ok: false }>,
): SearchAdminResult<T> {
  return {
    source: "unavailable",
    data: fallback,
    message: result.status === 403 ? "Falta permiso search.admin.write." : result.error,
    failedEndpoint: endpoint,
    status: result.status,
    permission: result.status === 403 ? "search.admin.write" : undefined,
  };
}

function unavailableContext<T>(fallback: T): SearchAdminResult<T> {
  return {
    source: "unavailable",
    data: fallback,
    message: "Selecciona organization y shop para consultar Search.",
  };
}

function normalizePreview(value: unknown): SearchAdminPreview {
  const raw = asRecord(value);
  return {
    raw,
    provider: optionalString(raw.provider),
    total: optionalNumber(raw.total),
    searchTotal: optionalNumber(raw.searchTotal),
    attributionToken: optionalString(raw.attributionToken),
    products: listItems(raw),
  };
}

function normalizeControls(value: unknown) {
  return collectionItems(value, ["items", "controls", "data"]);
}

function normalizeServingConfigs(value: unknown) {
  return collectionItems(value, ["items", "servingConfigs", "configs", "data"]);
}

async function getSearch<T>(
  context: AdminContext,
  path: string,
  fallback: T,
  parse: (value: unknown) => T,
): Promise<SearchAdminResult<T>> {
  const result = await requestAdminBff(path, { context, parse });

  if (!result.ok) {
    return unavailable(path, fallback, result);
  }

  return { source: "bff", data: result.data };
}

async function postSearch<T>(
  context: AdminContext,
  path: string,
  fallback: T,
  body: Record<string, unknown>,
  parse: (value: unknown) => T,
): Promise<SearchAdminResult<T>> {
  const result = await requestAdminBff(path, {
    context,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    parse,
  });

  if (!result.ok) {
    return unavailable(path, fallback, result);
  }

  return { source: "bff", data: result.data };
}

export async function getSearchAdminHealth(context: AdminContext) {
  if (!hasRequiredAdminContext(context)) {
    return unavailableContext<SearchAdminHealth>({});
  }

  const endpoint = `/admin/search/health?${makeScopedParams(context).toString()}`;
  return getSearch(context, endpoint, {}, asRecord);
}

export async function getSearchAdminPreview(
  context: AdminContext,
  filters: SearchAdminFilters,
) {
  if (!hasRequiredAdminContext(context)) {
    return unavailableContext<SearchAdminPreview | null>(null);
  }

  const query = filters.query?.trim();
  if (!query) {
    return {
      source: "unavailable" as const,
      data: null,
      message: "Escribe una busqueda para ejecutar query preview.",
    };
  }

  const endpoint = `/admin/search/query-preview?${makeScopedParams(context).toString()}`;
  const body = {
    query,
    pageCategory: optionalString(filters.pageCategory),
    visitorId: "admin-search-preview",
    limit: parsePositiveInteger(filters.limit, 12, 48),
    offset: parseOffset(filters.offset),
    filters: parseFilters(filters.filtersJson),
    sort: optionalString(filters.sort),
    context: {
      organizationId: context.organizationId,
      shopId: context.shopId,
      locale: context.locale,
      currency: optionalString(filters.currency) ?? context.currency,
      country: optionalString(filters.country) ?? context.country,
      tradePolicy: optionalString(filters.tradePolicy),
      channel: optionalString(filters.channel) ?? context.channel,
      customerGroup: optionalString(filters.customerGroup),
      priceTableId: optionalString(filters.priceTableId),
      warehouseId: optionalString(filters.warehouseId),
      at: optionalString(filters.at),
    },
  };

  return postSearch(context, endpoint, null, body, normalizePreview);
}

export async function getSearchAdminControls(context: AdminContext) {
  if (!hasRequiredAdminContext(context)) {
    return unavailableContext<SearchAdminRecord[]>([]);
  }

  const endpoint = `/admin/search/controls?${makeScopedParams(context).toString()}`;
  return getSearch(context, endpoint, [], normalizeControls);
}

export async function getSearchAdminServingConfigs(context: AdminContext) {
  if (!hasRequiredAdminContext(context)) {
    return unavailableContext<SearchAdminRecord[]>([]);
  }

  const endpoint = `/admin/search/serving-configs?${makeScopedParams(context).toString()}`;
  return getSearch(context, endpoint, [], normalizeServingConfigs);
}

export async function mutateSearch(
  context: AdminContext,
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: Record<string, unknown>,
): Promise<BffResult<SearchAdminRecord>> {
  return requestAdminBff(path, {
    context,
    init: {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    },
    parse: asRecord,
  });
}

export async function getSearchAdminData(
  context: AdminContext,
  filters: SearchAdminFilters,
): Promise<SearchAdminData> {
  const tab: SearchAdminTab = filters.tab === "controls" || filters.tab === "index" || filters.tab === "feed"
    ? filters.tab
    : "lab";
  const health = await getSearchAdminHealth(context);
  const shouldPreview = tab === "lab" && (filters.preview === "1" || Boolean(filters.query?.trim()));
  const preview = shouldPreview
    ? await getSearchAdminPreview(context, filters)
    : {
        source: "unavailable" as const,
        data: null,
        message: "Ejecuta una busqueda para ver resultados hidratados.",
      };
  const [controls, servingConfigs] = tab === "controls"
    ? await Promise.all([
        getSearchAdminControls(context),
        getSearchAdminServingConfigs(context),
      ])
    : [
        {
          source: "unavailable" as const,
          data: [],
          message: "Abre la pestana Controls para listar controles.",
        },
        {
          source: "unavailable" as const,
          data: [],
          message: "Abre la pestana Controls para listar serving configs.",
        },
      ];

  return { tab, health, preview, controls, servingConfigs };
}

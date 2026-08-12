import { requestAdminBff } from "../../shared/bff/admin-client";
import type { BffResult } from "../../shared/bff/types";
import type { AdminContext } from "../../shared/config/admin-context";

export type SeoAdminTab = "summary" | "routes" | "redirects" | "resolve" | "sitemap";

export type SeoRouteKind = "CANONICAL" | "ALIAS";
export type SeoStatus = "ACTIVE" | "INACTIVE";
export type SeoRedirectStatusCode = 301 | 302;

export type SeoRoute = {
  routeId: string;
  organizationId: string;
  shopId: string;
  locale: string;
  path: string;
  entityType: string;
  entityId: string;
  routeKind: SeoRouteKind | string;
  canonicalRouteId: string | null;
  status: SeoStatus | string;
  includeInSitemap: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SeoRedirect = {
  redirectId: string;
  organizationId: string;
  shopId: string;
  locale: string;
  fromPath: string;
  toPath: string;
  statusCode: SeoRedirectStatusCode | number;
  status: SeoStatus | string;
  reason: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SeoResolveResult =
  | {
      kind: "ROUTE";
      requestedPath: string;
      canonicalPath: string;
      isCanonical: boolean;
      entityType: string;
      entityId: string;
      routeId: string;
      canonicalRouteId: string;
      organizationId: string;
      shopId: string;
      locale: string;
    }
  | {
      kind: "REDIRECT";
      requestedPath: string;
      toPath: string;
      statusCode: SeoRedirectStatusCode;
      redirectId: string;
      organizationId: string;
      shopId: string;
      locale: string;
    };

export type SeoSitemapEntry = {
  path: string;
  entityType: string;
  entityId: string;
  routeId: string;
  updatedAt: string;
};

export type SeoList<T> = {
  total: number;
  limit: number;
  offset: number;
  items: T[];
};

export type SeoSitemap = {
  organizationId: string;
  shopId: string;
  locale: string;
  entries: SeoSitemapEntry[];
};

export type SeoAdminResult<T> = {
  source: "bff" | "unavailable";
  data: T;
  message?: string;
  failedEndpoint?: string;
  status?: number;
  permission?: "routing-seo.routes.write";
};

export type SeoAdminFilters = {
  tab: SeoAdminTab;
  locale?: string;
  status?: string;
  entityType?: string;
  entityId?: string;
  path?: string;
  limit?: string;
  offset?: string;
  resolveRequested?: boolean;
};

export type SeoAdminData = {
  tab: SeoAdminTab;
  routes: SeoAdminResult<SeoList<SeoRoute>>;
  redirects: SeoAdminResult<SeoList<SeoRedirect>>;
  sitemap: SeoAdminResult<SeoSitemap> | null;
  resolved: SeoAdminResult<SeoResolveResult | null> | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function listItems(value: unknown): unknown[] {
  const record = asRecord(value);
  const items = record.items ?? record.data ?? record.results ?? value;
  return Array.isArray(items) ? items : [];
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeRoute(value: unknown): SeoRoute {
  const record = asRecord(value);
  const routeKind = stringValue(record.routeKind, "CANONICAL") === "ALIAS" ? "ALIAS" : "CANONICAL";

  return {
    routeId: stringValue(record.routeId),
    organizationId: stringValue(record.organizationId),
    shopId: stringValue(record.shopId),
    locale: stringValue(record.locale),
    path: stringValue(record.path),
    entityType: stringValue(record.entityType),
    entityId: stringValue(record.entityId),
    routeKind,
    canonicalRouteId: nullableString(record.canonicalRouteId),
    status: stringValue(record.status, "ACTIVE"),
    includeInSitemap: routeKind === "ALIAS" ? false : booleanValue(record.includeInSitemap, true),
    createdAt: stringValue(record.createdAt),
    updatedAt: stringValue(record.updatedAt),
  };
}

function normalizeRedirect(value: unknown): SeoRedirect {
  const record = asRecord(value);

  return {
    redirectId: stringValue(record.redirectId),
    organizationId: stringValue(record.organizationId),
    shopId: stringValue(record.shopId),
    locale: stringValue(record.locale),
    fromPath: stringValue(record.fromPath),
    toPath: stringValue(record.toPath),
    statusCode: numberValue(record.statusCode, 301),
    status: stringValue(record.status, "ACTIVE"),
    reason: nullableString(record.reason),
    expiresAt: nullableString(record.expiresAt),
    createdAt: stringValue(record.createdAt),
    updatedAt: stringValue(record.updatedAt),
  };
}

function normalizeRoutesList(value: unknown): SeoList<SeoRoute> {
  const record = asRecord(value);
  const items = listItems(value).map(normalizeRoute);

  return {
    total: numberValue(record.total, items.length),
    limit: numberValue(record.limit, items.length),
    offset: numberValue(record.offset, 0),
    items,
  };
}

function normalizeRedirectsList(value: unknown): SeoList<SeoRedirect> {
  const record = asRecord(value);
  const items = listItems(value).map(normalizeRedirect);

  return {
    total: numberValue(record.total, items.length),
    limit: numberValue(record.limit, items.length),
    offset: numberValue(record.offset, 0),
    items,
  };
}

function normalizeResolve(value: unknown): SeoResolveResult | null {
  const record = asRecord(value);
  const kind = stringValue(record.kind);

  if (kind === "ROUTE") {
    return {
      kind,
      requestedPath: stringValue(record.requestedPath),
      canonicalPath: stringValue(record.canonicalPath),
      isCanonical: booleanValue(record.isCanonical, false),
      entityType: stringValue(record.entityType),
      entityId: stringValue(record.entityId),
      routeId: stringValue(record.routeId),
      canonicalRouteId: stringValue(record.canonicalRouteId),
      organizationId: stringValue(record.organizationId),
      shopId: stringValue(record.shopId),
      locale: stringValue(record.locale),
    };
  }

  if (kind === "REDIRECT") {
    return {
      kind,
      requestedPath: stringValue(record.requestedPath),
      toPath: stringValue(record.toPath),
      statusCode: numberValue(record.statusCode, 301) as SeoRedirectStatusCode,
      redirectId: stringValue(record.redirectId),
      organizationId: stringValue(record.organizationId),
      shopId: stringValue(record.shopId),
      locale: stringValue(record.locale),
    };
  }

  return null;
}

function normalizeSitemap(value: unknown): SeoSitemap {
  const record = asRecord(value);
  const entries = Array.isArray(record.entries) ? record.entries.map((item) => {
    const entry = asRecord(item);
    return {
      path: stringValue(entry.path),
      entityType: stringValue(entry.entityType),
      entityId: stringValue(entry.entityId),
      routeId: stringValue(entry.routeId),
      updatedAt: stringValue(entry.updatedAt),
    };
  }) : [];

  return {
    organizationId: stringValue(record.organizationId),
    shopId: stringValue(record.shopId),
    locale: stringValue(record.locale),
    entries,
  };
}

function makeScopedParams(context: AdminContext, filters?: Record<string, string | undefined>) {
  const params = new URLSearchParams();

  if (context.organizationId) {
    params.set("organizationId", context.organizationId);
  }
  if (context.shopId) {
    params.set("shopId", context.shopId);
  }
  params.set("locale", filters?.locale?.trim() || context.locale || "es-ES");

  for (const [key, value] of Object.entries(filters ?? {})) {
    if (key !== "locale" && value?.trim()) {
      params.set(key, value.trim());
    }
  }

  return params;
}

function unavailable<T>(
  endpoint: string,
  fallback: T,
  result: Extract<BffResult<T>, { ok: false }>,
): SeoAdminResult<T> {
  return {
    source: "unavailable",
    data: fallback,
    message: result.status === 403 ? "Falta permiso routing-seo.routes.write." : result.error,
    failedEndpoint: endpoint,
    status: result.status,
    permission: result.status === 403 ? "routing-seo.routes.write" : undefined,
  };
}

function sanitizeRoutePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...payload };
  const routeKind = stringValue(sanitized.routeKind);

  delete sanitized.canonicalRouteId;

  if (routeKind === "ALIAS") {
    sanitized.includeInSitemap = false;
  }

  return sanitized;
}

function sanitizeRoutePatchPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const sanitized = sanitizeRoutePayload(payload);

  delete sanitized.routeKind;

  return sanitized;
}

export async function getSeoAdminData(
  context: AdminContext,
  filters: SeoAdminFilters,
): Promise<SeoAdminData> {
  const listFilters = {
    locale: filters.locale,
    status: filters.status,
    entityType: filters.entityType,
    entityId: filters.entityId,
    limit: filters.limit ?? "50",
    offset: filters.offset ?? "0",
  };
  const routesEndpoint = `/admin/routing-seo/routes?${makeScopedParams(context, listFilters).toString()}`;
  const redirectsEndpoint = `/admin/routing-seo/redirects?${makeScopedParams(context, {
    locale: filters.locale,
    status: filters.status,
    limit: filters.limit ?? "50",
    offset: filters.offset ?? "0",
  }).toString()}`;
  const [routesResult, redirectsResult] = await Promise.all([
    requestAdminBff(routesEndpoint, { context, parse: normalizeRoutesList }),
    requestAdminBff(redirectsEndpoint, { context, parse: normalizeRedirectsList }),
  ]);

  const sitemap = filters.tab === "sitemap"
    ? await listSeoSitemap(context, filters)
    : null;
  const resolved = filters.tab === "resolve" && filters.resolveRequested
    ? await resolveSeoPath(context, filters)
    : null;

  return {
    tab: filters.tab,
    routes: routesResult.ok
      ? { source: "bff", data: routesResult.data }
      : unavailable(routesEndpoint, { total: 0, limit: 50, offset: 0, items: [] }, routesResult),
    redirects: redirectsResult.ok
      ? { source: "bff", data: redirectsResult.data }
      : unavailable(redirectsEndpoint, { total: 0, limit: 50, offset: 0, items: [] }, redirectsResult),
    sitemap,
    resolved,
  };
}

async function listSeoSitemap(
  context: AdminContext,
  filters: SeoAdminFilters,
): Promise<SeoAdminResult<SeoSitemap>> {
  const endpoint = `/admin/routing-seo/sitemap?${makeScopedParams(context, { locale: filters.locale }).toString()}`;
  const result = await requestAdminBff(endpoint, { context, parse: normalizeSitemap });
  const fallback = {
    organizationId: context.organizationId,
    shopId: context.shopId,
    locale: filters.locale || context.locale,
    entries: [],
  };

  return result.ok
    ? { source: "bff", data: result.data }
    : unavailable(endpoint, fallback, result);
}

async function resolveSeoPath(
  context: AdminContext,
  filters: SeoAdminFilters,
): Promise<SeoAdminResult<SeoResolveResult | null>> {
  const endpoint = `/admin/routing-seo/resolve?${makeScopedParams(context, {
    locale: filters.locale,
    path: filters.path || "/",
  }).toString()}`;
  const result = await requestAdminBff(endpoint, { context, parse: normalizeResolve });

  return result.ok
    ? { source: "bff", data: result.data }
    : unavailable(endpoint, null, result);
}

export async function createSeoRoute(
  context: AdminContext,
  payload: Record<string, unknown>,
  locale?: string,
) {
  const endpoint = `/admin/routing-seo/routes?${makeScopedParams(context, { locale }).toString()}`;
  const sanitizedPayload = sanitizeRoutePayload(payload);

  return requestAdminBff(endpoint, {
    context,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sanitizedPayload),
    },
    parse: normalizeRoute,
  });
}

export async function patchSeoRoute(
  context: AdminContext,
  routeId: string,
  payload: Record<string, unknown>,
  locale?: string,
) {
  const endpoint = `/admin/routing-seo/routes/${encodeURIComponent(routeId)}?${makeScopedParams(context, { locale }).toString()}`;
  const sanitizedPayload = sanitizeRoutePatchPayload(payload);

  return requestAdminBff(endpoint, {
    context,
    init: {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sanitizedPayload),
    },
    parse: normalizeRoute,
  });
}

export async function createSeoRedirect(
  context: AdminContext,
  payload: Record<string, unknown>,
  locale?: string,
) {
  const endpoint = `/admin/routing-seo/redirects?${makeScopedParams(context, { locale }).toString()}`;

  return requestAdminBff(endpoint, {
    context,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
    parse: normalizeRedirect,
  });
}

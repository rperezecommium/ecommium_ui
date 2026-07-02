import { requestBff } from "../../shared/bff/client";
import type { BffResult } from "../../shared/bff/types";
import type { AdminContext } from "../../shared/config/admin-context";
import {
  normalizeCmsBlock,
  type CmsBlock,
} from "./cms-blocks";
export {
  blocksFromJson,
  blocksToJson,
  createCmsBlockFromPreset,
  getCmsBlockPresets,
  summarizePlacements,
  type CmsBlock,
  type CmsBlockType,
  type CmsPlacement,
} from "./cms-blocks";

export type CmsPageStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
export type CmsPageType = "LANDING" | "CONTENT" | "HOME";
export type CmsPage = {
  pageId: string;
  organizationId: string;
  shopId: string;
  locale: string;
  pageType: CmsPageType | string;
  title: string;
  path: string;
  status: CmsPageStatus;
  routeId: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type CmsPageVersion = {
  versionId: string;
  pageId: string;
  version: number;
  status: "DRAFT" | "PUBLISHED";
  title: string;
  seo: {
    title: string;
    description: string;
  };
  blocks: CmsBlock[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type CmsPageDetail = CmsPage & {
  latestVersion: CmsPageVersion | null;
  publishedVersion: CmsPageVersion | null;
};

export type CmsPagesList = {
  total: number;
  limit: number;
  offset: number;
  items: CmsPage[];
};

export type CmsAdminResult<T> = {
  source: "bff" | "unavailable";
  data: T;
  message?: string;
  failedEndpoint?: string;
  status?: number;
  permission?: "cms.pages.read" | "cms.pages.write" | "cms.pages.publish";
  correlationId?: string;
};

export type CmsAdminFilters = {
  q?: string;
  status?: CmsPageStatus | "all";
  pageType?: CmsPageType | "all";
  locale?: string;
  pageId?: string;
  mode?: "list" | "editor";
  tab?: "page" | "blocks" | "seo" | "preview";
  drawer?: "create" | "path";
  cmsMessage?: string;
};

export type CmsAdminData = {
  pages: CmsAdminResult<CmsPagesList>;
  selectedPage: CmsAdminResult<CmsPageDetail | null>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
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

function statusValue(value: unknown): CmsPageStatus {
  return value === "PUBLISHED" || value === "UNPUBLISHED" ? value : "DRAFT";
}

function normalizePage(value: unknown): CmsPage {
  const record = asRecord(value);
  return {
    pageId: stringValue(record.pageId),
    organizationId: stringValue(record.organizationId),
    shopId: stringValue(record.shopId),
    locale: stringValue(record.locale),
    pageType: stringValue(record.pageType, "LANDING"),
    title: stringValue(record.title),
    path: stringValue(record.path),
    status: statusValue(record.status),
    routeId: nullableString(record.routeId),
    createdAt: stringValue(record.createdAt),
    updatedAt: stringValue(record.updatedAt),
    publishedAt: nullableString(record.publishedAt),
  };
}

function normalizeVersion(value: unknown): CmsPageVersion | null {
  const record = asRecord(value);
  if (!record.versionId) {
    return null;
  }
  const seo = asRecord(record.seo);
  return {
    versionId: stringValue(record.versionId),
    pageId: stringValue(record.pageId),
    version: numberValue(record.version),
    status: record.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
    title: stringValue(record.title),
    seo: {
      title: stringValue(seo.title),
      description: stringValue(seo.description),
    },
    blocks: Array.isArray(record.blocks) ? record.blocks.map(normalizeCmsBlock) : [],
    createdAt: stringValue(record.createdAt),
    updatedAt: stringValue(record.updatedAt),
    publishedAt: nullableString(record.publishedAt),
  };
}

function normalizePageDetail(value: unknown): CmsPageDetail {
  const page = normalizePage(value);
  const record = asRecord(value);
  return {
    ...page,
    latestVersion: normalizeVersion(record.latestVersion),
    publishedVersion: normalizeVersion(record.publishedVersion),
  };
}

function normalizePagesList(value: unknown): CmsPagesList {
  const record = asRecord(value);
  const rawItems = Array.isArray(record.items) ? record.items : [];
  const items = rawItems.map(normalizePage);
  return {
    total: numberValue(record.total, items.length),
    limit: numberValue(record.limit, 50),
    offset: numberValue(record.offset, 0),
    items,
  };
}

function makeScopedParams(
  context: AdminContext,
  extra?: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();

  if (context.organizationId) params.set("organizationId", context.organizationId);
  if (context.shopId) params.set("shopId", context.shopId);
  if (context.locale) params.set("locale", context.locale);
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value?.trim()) params.set(key, value.trim());
  }

  return params;
}

function unavailable<T>(
  endpoint: string,
  fallback: T,
  result: Extract<BffResult<T>, { ok: false }>,
  permission: CmsAdminResult<T>["permission"],
): CmsAdminResult<T> {
  return {
    source: "unavailable",
    data: fallback,
    message: result.status === 403 ? `Falta permiso ${permission}.` : result.error,
    failedEndpoint: endpoint,
    status: result.status,
    permission: result.status === 403 ? permission : undefined,
    correlationId: result.correlationId,
  };
}

function matchesPage(page: CmsPage, query: string | undefined) {
  const normalized = query?.trim().toLowerCase();
  if (!normalized) return true;
  return (
    page.title.toLowerCase().includes(normalized) ||
    page.path.toLowerCase().includes(normalized) ||
    page.pageId.toLowerCase().includes(normalized)
  );
}

export async function getCmsAdminData(
  context: AdminContext,
  filters: CmsAdminFilters,
): Promise<CmsAdminData> {
  const locale = filters.locale ?? context.locale;
  const endpoint = `/admin/cms/pages?${makeScopedParams(context, {
    locale,
    status: filters.status && filters.status !== "all" ? filters.status : undefined,
    pageType: filters.pageType && filters.pageType !== "all" ? filters.pageType : undefined,
    limit: "50",
    offset: "0",
  }).toString()}`;
  const pagesResult = await requestBff(endpoint, { context: { ...context, locale }, parse: normalizePagesList });

  const pages = pagesResult.ok
    ? {
        source: "bff" as const,
        data: {
          ...pagesResult.data,
          items: pagesResult.data.items.filter((page) => matchesPage(page, filters.q)),
        },
        correlationId: pagesResult.correlationId,
      }
    : unavailable(endpoint, { total: 0, limit: 50, offset: 0, items: [] }, pagesResult, "cms.pages.read");

  if (!filters.pageId) {
    return {
      pages,
      selectedPage: { source: "bff", data: null },
    };
  }

  const detailEndpoint = `/admin/cms/pages/${encodeURIComponent(filters.pageId)}?${makeScopedParams(context, {
    locale,
  }).toString()}`;
  const detailResult = await requestBff(detailEndpoint, {
    context: { ...context, locale },
    parse: normalizePageDetail,
  });

  return {
    pages,
    selectedPage: detailResult.ok
      ? { source: "bff", data: detailResult.data, correlationId: detailResult.correlationId }
      : unavailable(detailEndpoint, null, detailResult, "cms.pages.read"),
  };
}

export async function createCmsPage(
  context: AdminContext,
  payload: Record<string, unknown>,
  locale?: string,
) {
  const endpoint = `/admin/cms/pages?${makeScopedParams(context, { locale: locale ?? context.locale }).toString()}`;
  return requestBff(endpoint, {
    context: { ...context, locale: locale ?? context.locale },
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
    parse: normalizePageDetail,
  });
}

export async function updateCmsDraft(
  context: AdminContext,
  pageId: string,
  payload: Record<string, unknown>,
  locale?: string,
) {
  const endpoint = `/admin/cms/pages/${encodeURIComponent(pageId)}/draft?${makeScopedParams(context, {
    locale: locale ?? context.locale,
  }).toString()}`;
  return requestBff(endpoint, {
    context: { ...context, locale: locale ?? context.locale },
    init: {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
    parse: normalizePageDetail,
  });
}

export async function publishCmsPage(context: AdminContext, pageId: string, locale?: string) {
  const endpoint = `/admin/cms/pages/${encodeURIComponent(pageId)}/publish?${makeScopedParams(context, {
    locale: locale ?? context.locale,
  }).toString()}`;
  return requestBff(endpoint, {
    context: { ...context, locale: locale ?? context.locale },
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    },
    parse: normalizePageDetail,
  });
}

export async function unpublishCmsPage(context: AdminContext, pageId: string, locale?: string) {
  const endpoint = `/admin/cms/pages/${encodeURIComponent(pageId)}/unpublish?${makeScopedParams(context, {
    locale: locale ?? context.locale,
  }).toString()}`;
  return requestBff(endpoint, {
    context: { ...context, locale: locale ?? context.locale },
    init: { method: "POST" },
    parse: normalizePageDetail,
  });
}

export async function changeCmsPublishedPath(
  context: AdminContext,
  pageId: string,
  nextPath: string,
  locale?: string,
) {
  const endpoint = `/admin/cms/pages/${encodeURIComponent(pageId)}/path?${makeScopedParams(context, {
    locale: locale ?? context.locale,
  }).toString()}`;
  return requestBff(endpoint, {
    context: { ...context, locale: locale ?? context.locale },
    init: {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nextPath }),
    },
    parse: normalizePageDetail,
  });
}

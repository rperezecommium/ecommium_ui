import { requestBff } from "../../shared/bff/client";
import type { BffResult } from "../../shared/bff/types";
import type { AdminContext } from "../../shared/config/admin-context";
import { plainProductText, slugifyProductValue } from "./product-editor-draft";
import type { ProductLookupOption } from "./product-editor-types";

export type CatalogEntityKind = "categories" | "brands";

export type CatalogEntity = ProductLookupOption & {
  isActive: boolean;
  productCount?: number;
  updatedAt?: string;
};

export type CatalogEntityListResult = {
  items: CatalogEntity[];
  total: number;
  limit: number;
  offset: number;
  source: "bff" | "unavailable";
  message?: string;
  failedEndpoint?: string;
  correlationId?: string;
};

type ListOptions = {
  q?: string;
  isActive?: boolean | null;
  limit?: number;
  offset?: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function listItems(value: unknown): unknown[] {
  const record = asRecord(value);
  const items = record.items ?? record.categories ?? record.brands ?? value;
  return Array.isArray(items) ? items : [];
}

function localizedText(value: unknown, locale = "es-ES") {
  if (typeof value === "string") {
    return plainProductText(value);
  }

  const record = asRecord(value);
  return (
    asString(record[locale]) ??
    asString(record["es-ES"]) ??
    asString(record.es) ??
    asString(record.default)
  );
}

function makeScopedParams(context: AdminContext, extra: Record<string, string> = {}) {
  const params = new URLSearchParams(extra);

  if (context.organizationId) {
    params.set("organizationId", context.organizationId);
  }
  if (context.shopId) {
    params.set("shopId", context.shopId);
  }
  if (context.locale) {
    params.set("locale", context.locale);
  }

  return params;
}

function entityId(kind: CatalogEntityKind, record: Record<string, unknown>) {
  return (
    asString(kind === "categories" ? record.categoryId : record.brandId) ??
    asString(record.id) ??
    ""
  );
}

function parseEntity(kind: CatalogEntityKind, locale: string, value: unknown): CatalogEntity {
  const root = asRecord(value);
  const record = asRecord(
    root.item ??
    root.data ??
    (kind === "categories" ? root.category : root.brand) ??
    value,
  );
  const id = entityId(kind, record);
  const label = localizedText(record.name ?? record.label ?? record.title, locale) || id;

  return {
    id,
    label,
    slug: asString(record.slug),
    isActive: asBoolean(record.isActive ?? record.active, true),
    productCount: asNumber(record.productCount ?? record.productsCount, 0),
    updatedAt: asString(record.updatedAt),
  };
}

function parseEntityList(kind: CatalogEntityKind, locale: string, value: unknown) {
  const record = asRecord(value);
  const items = listItems(value)
    .map((item) => parseEntity(kind, locale, item))
    .filter((item) => item.id);

  return {
    items,
    total: asNumber(record.total ?? record.count, items.length),
  };
}

function endpointFor(kind: CatalogEntityKind) {
  return kind === "categories" ? "/admin/categories" : "/admin/brands";
}

export async function listCatalogEntities(
  context: AdminContext,
  kind: CatalogEntityKind,
  options: ListOptions = {},
): Promise<CatalogEntityListResult> {
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;
  const params = makeScopedParams(context, {
    limit: String(limit),
    offset: String(offset),
  });

  if (options.q?.trim()) {
    params.set("q", options.q.trim());
  }
  if (typeof options.isActive === "boolean") {
    params.set("isActive", String(options.isActive));
  }

  const endpoint = `${endpointFor(kind)}?${params.toString()}`;
  const result = await requestBff(endpoint, {
    context,
    parse: (value) => parseEntityList(kind, context.locale, value),
  });

  if (!result.ok) {
    return {
      items: [],
      total: 0,
      limit,
      offset,
      source: "unavailable",
      message: result.error,
      failedEndpoint: endpoint,
      correlationId: result.correlationId,
    };
  }

  return {
    ...result.data,
    limit,
    offset,
    source: "bff",
    correlationId: result.correlationId,
  };
}

export async function createCatalogEntity(
  context: AdminContext,
  kind: CatalogEntityKind,
  input: { name: string; isActive?: boolean },
): Promise<BffResult<CatalogEntity>> {
  const name = plainProductText(input.name);
  const params = makeScopedParams(context);

  return requestBff(`${endpointFor(kind)}?${params.toString()}`, {
    context,
    init: {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        organizationId: context.organizationId,
        shopId: context.shopId,
        locale: context.locale,
        name,
        slug: slugifyProductValue(name),
        isActive: input.isActive ?? true,
      }),
    },
    parse: (value) => parseEntity(kind, context.locale, value),
  });
}

export async function updateCatalogEntity(
  context: AdminContext,
  kind: CatalogEntityKind,
  id: string,
  input: { name: string; isActive: boolean },
): Promise<BffResult<CatalogEntity>> {
  const name = plainProductText(input.name);
  const params = makeScopedParams(context);

  return requestBff(`${endpointFor(kind)}/${encodeURIComponent(id)}?${params.toString()}`, {
    context,
    init: {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        organizationId: context.organizationId,
        shopId: context.shopId,
        locale: context.locale,
        name,
        slug: slugifyProductValue(name),
        isActive: input.isActive,
      }),
    },
    parse: (value) => parseEntity(kind, context.locale, value),
  });
}

export async function deleteCatalogEntity(
  context: AdminContext,
  kind: CatalogEntityKind,
  id: string,
  mode: "soft" | "hard",
): Promise<BffResult<{ deleted?: boolean }>> {
  const params = makeScopedParams(context, { mode });

  return requestBff(`${endpointFor(kind)}/${encodeURIComponent(id)}?${params.toString()}`, {
    context,
    init: {
      method: "DELETE",
    },
    parse: (value) => asRecord(value) as { deleted?: boolean },
  });
}

export function toLookupOptions(result: CatalogEntityListResult): ProductLookupOption[] {
  return result.items.map(({ id, label, slug }) => ({ id, label, slug }));
}

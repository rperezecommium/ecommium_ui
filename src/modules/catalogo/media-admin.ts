import { requestAdminBff } from "../../shared/bff/admin-client";
import type { BffResult } from "../../shared/bff/types";
import type { AdminContext } from "../../shared/config/admin-context";

export type MediaAdminAsset = {
  mediaAssetId: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
  position?: number;
  active: boolean;
  isMain: boolean;
  alt: Record<string, string>;
  title: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
};

export type MediaAdminCollection = {
  mediaCollectionId: string;
  productId?: string;
  title: string;
  defaultLocale?: string;
  active: boolean;
  status?: string;
  itemCount: number;
  mediaAssetIds: string[];
  items: MediaAdminAsset[];
  createdAt?: string;
  updatedAt?: string;
};

export type MediaAdminListResult = {
  items: MediaAdminCollection[];
  total: number;
  limit: number;
  offset: number;
  source: "bff" | "unavailable";
  message?: string;
  failedEndpoint?: string;
  correlationId?: string;
};

export type MediaAdminListOptions = {
  q?: string;
  status?: "active" | "all";
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

function localizedText(value: unknown, locale: string) {
  const direct = asString(value);
  if (direct) {
    return direct;
  }

  const record = asRecord(value);
  return (
    asString(record[locale]) ??
    asString(record["es-ES"]) ??
    asString(record.es) ??
    asString(record.default)
  );
}

function localizedMap(value: unknown, locale: string): Record<string, string> {
  const direct = asString(value);
  if (direct) {
    return { [locale]: direct };
  }

  return Object.fromEntries(
    Object.entries(asRecord(value))
      .map(([key, item]) => [key, asString(item)])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

function listItems(value: unknown): unknown[] {
  const record = asRecord(value);
  const items = record.items ?? record.collections ?? record.data ?? value;
  return Array.isArray(items) ? items : [];
}

function assetItems(value: unknown): unknown[] {
  const record = asRecord(value);
  const items = record.items ?? record.assets ?? record.mediaItems ?? record.files;
  return Array.isArray(items) ? items : [];
}

function mediaAssetId(value: unknown) {
  const record = asRecord(value);
  return asString(record.mediaAssetId) ?? asString(record.idImage) ?? asString(record.assetId) ?? asString(record.id);
}

function parseAsset(value: unknown, locale: string): MediaAdminAsset | null {
  const root = asRecord(value);
  const record = asRecord(root.item ?? root.asset ?? root.mediaAsset ?? value);
  const metadata = asRecord(record.metadata);
  const id = mediaAssetId(record);
  if (!id) {
    return null;
  }

  return {
    mediaAssetId: id,
    fileName:
      asString(record.fileName) ??
      asString(record.filename) ??
      asString(record.name) ??
      asString(record.originalName) ??
      asString(record.publicPath)?.split("/").filter(Boolean).at(-1) ??
      id,
    mimeType: asString(record.mimeType) ?? asString(record.contentType) ?? "application/octet-stream",
    fileSize: asNumber(record.fileSize ?? record.size ?? record.bytes, 0),
    position: asNumber(record.position, 0),
    active: asBoolean(record.active ?? record.isActive, true),
    isMain: asBoolean(record.isMain ?? record.main, false),
    alt: localizedMap(record.alt ?? record.altText ?? metadata.alt, locale),
    title: localizedMap(record.title ?? metadata.title, locale),
    createdAt: asString(record.createdAt),
    updatedAt: asString(record.updatedAt),
  };
}

function parseCollection(value: unknown, locale: string): MediaAdminCollection | null {
  const root = asRecord(value);
  const record = asRecord(root.collection ?? root.data ?? value);
  const id = asString(record.mediaCollectionId) ?? asString(record.collectionId) ?? asString(record.id);
  if (!id) {
    return null;
  }

  const items = assetItems(record)
    .map((item) => parseAsset(item, locale))
    .filter((item): item is MediaAdminAsset => Boolean(item));
  const mediaAssetIds = [
    ...new Set([
      ...items.map((item) => item.mediaAssetId),
      ...(
        Array.isArray(record.mediaAssetIds)
          ? record.mediaAssetIds.map((item) => asString(item)).filter((item): item is string => Boolean(item))
          : []
      ),
    ]),
  ];

  return {
    mediaCollectionId: id,
    productId: asString(record.productId),
    title: localizedText(record.title ?? record.name ?? record.label, locale) ?? id,
    defaultLocale: asString(record.defaultLocale),
    active: asBoolean(record.active ?? record.isActive, true),
    status: asString(record.status),
    itemCount: asNumber(record.itemCount ?? record.itemsCount ?? record.assetCount, mediaAssetIds.length),
    mediaAssetIds,
    items,
    createdAt: asString(record.createdAt),
    updatedAt: asString(record.updatedAt),
  };
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

function parseCollectionList(value: unknown, locale: string) {
  const record = asRecord(value);
  const items = listItems(value)
    .map((item) => parseCollection(item, locale))
    .filter((item): item is MediaAdminCollection => Boolean(item));

  return {
    items,
    total: asNumber(record.total ?? record.count, items.length),
  };
}

function shouldHydrateCollection(collection: MediaAdminCollection) {
  return collection.items.length === 0 && (collection.itemCount > 0 || collection.mediaAssetIds.length > 0);
}

async function hydrateCollectionPreview(
  context: AdminContext,
  collection: MediaAdminCollection,
): Promise<MediaAdminCollection> {
  if (!shouldHydrateCollection(collection)) {
    return collection;
  }

  const params = makeScopedParams(context);
  const result = await requestAdminBff(
    `/admin/media/collections/${encodeURIComponent(collection.mediaCollectionId)}?${params.toString()}`,
    {
      context,
      parse: (value) => parseCollection(value, context.locale),
    },
  );

  if (!result.ok || !result.data) {
    return collection;
  }

  return {
    ...collection,
    ...result.data,
    title: result.data.title || collection.title,
    productId: result.data.productId ?? collection.productId,
    defaultLocale: result.data.defaultLocale ?? collection.defaultLocale,
    status: result.data.status ?? collection.status,
    itemCount: result.data.itemCount || collection.itemCount,
    mediaAssetIds: result.data.mediaAssetIds.length ? result.data.mediaAssetIds : collection.mediaAssetIds,
    items: result.data.items.length ? result.data.items : collection.items,
  };
}

export async function listMediaCollections(
  context: AdminContext,
  options: MediaAdminListOptions = {},
): Promise<MediaAdminListResult> {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const params = makeScopedParams(context, {
    limit: String(limit),
    offset: String(offset),
  });

  if (options.q?.trim()) {
    params.set("q", options.q.trim());
  }
  if (options.status === "all") {
    params.set("includeInactive", "true");
  }

  const endpoint = `/admin/media/collections?${params.toString()}`;
  const result = await requestAdminBff(endpoint, {
    context,
    parse: (value) => parseCollectionList(value, context.locale),
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

  const items = await Promise.all(
    result.data.items.map((collection) => hydrateCollectionPreview(context, collection)),
  );

  return {
    ...result.data,
    items,
    limit,
    offset,
    source: "bff",
    correlationId: result.correlationId,
  };
}

export async function getMediaCollection(
  context: AdminContext,
  mediaCollectionId: string,
): Promise<BffResult<MediaAdminCollection>> {
  const params = makeScopedParams(context);

  return requestAdminBff(`/admin/media/collections/${encodeURIComponent(mediaCollectionId)}?${params.toString()}`, {
    context,
    parse: (value) => parseCollection(value, context.locale) ?? {
      mediaCollectionId,
      title: mediaCollectionId,
      active: false,
      itemCount: 0,
      mediaAssetIds: [],
      items: [],
    },
  });
}

function buildUploadMetadata(files: File[], locale: string, input: {
  mainIndex?: number;
  alt?: string;
  title?: string;
}) {
  const mainIndex = input.mainIndex ?? 0;

  return files.map((_, index) => ({
    isMain: index === mainIndex,
    ...(input.alt?.trim() ? { alt: { [locale]: input.alt.trim() } } : {}),
    ...(input.title?.trim() ? { title: { [locale]: input.title.trim() } } : {}),
  }));
}

function appendUploadFiles(formData: FormData, files: File[]) {
  for (const file of files) {
    formData.append("files", file);
  }
}

export async function createMediaCollection(
  context: AdminContext,
  input: {
    productId?: string;
    title: string;
    files: File[];
    defaultLocale?: string;
    alt?: string;
    assetTitle?: string;
  },
): Promise<BffResult<MediaAdminCollection>> {
  const params = makeScopedParams(context);
  const locale = input.defaultLocale?.trim() || context.locale;
  const formData = new FormData();

  appendUploadFiles(formData, input.files);
  formData.set("organizationId", context.organizationId);
  formData.set("shopId", context.shopId);
  if (input.productId?.trim()) {
    formData.set("productId", input.productId.trim());
  }
  formData.set("title", input.title);
  formData.set("defaultLocale", locale);
  formData.set("metadata", JSON.stringify(buildUploadMetadata(input.files, locale, {
    alt: input.alt,
    title: input.assetTitle,
  })));

  return requestAdminBff(`/admin/media/collections?${params.toString()}`, {
    context,
    init: {
      method: "POST",
      body: formData,
    },
    parse: (value) => parseCollection(value, context.locale) ?? {
      mediaCollectionId: "",
      productId: input.productId,
      title: input.title,
      defaultLocale: locale,
      active: true,
      itemCount: input.files.length,
      mediaAssetIds: [],
      items: [],
    },
  });
}

export async function addMediaCollectionItems(
  context: AdminContext,
  input: {
    mediaCollectionId: string;
    files: File[];
    defaultLocale?: string;
    alt?: string;
    assetTitle?: string;
  },
): Promise<BffResult<MediaAdminCollection>> {
  const params = makeScopedParams(context);
  const locale = input.defaultLocale?.trim() || context.locale;
  const formData = new FormData();

  appendUploadFiles(formData, input.files);
  formData.set("organizationId", context.organizationId);
  formData.set("shopId", context.shopId);
  formData.set("defaultLocale", locale);
  formData.set("metadata", JSON.stringify(buildUploadMetadata(input.files, locale, {
    mainIndex: -1,
    alt: input.alt,
    title: input.assetTitle,
  })));

  return requestAdminBff(
    `/admin/media/collections/${encodeURIComponent(input.mediaCollectionId)}/items?${params.toString()}`,
    {
      context,
      init: {
        method: "POST",
        body: formData,
      },
      parse: (value) => parseCollection(value, context.locale) ?? {
        mediaCollectionId: input.mediaCollectionId,
        title: input.mediaCollectionId,
        active: true,
        itemCount: input.files.length,
        mediaAssetIds: [],
        items: [],
      },
    },
  );
}

export async function updateMediaCollection(
  context: AdminContext,
  mediaCollectionId: string,
  input: {
    title: string;
  },
): Promise<BffResult<MediaAdminCollection>> {
  const params = makeScopedParams(context);

  return requestAdminBff(`/admin/media/collections/${encodeURIComponent(mediaCollectionId)}?${params.toString()}`, {
    context,
    init: {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: input.title,
      }),
    },
    parse: (value) => parseCollection(value, context.locale) ?? {
      mediaCollectionId,
      title: input.title,
      active: true,
      itemCount: 0,
      mediaAssetIds: [],
      items: [],
    },
  });
}

export async function updateMediaAsset(
  context: AdminContext,
  input: {
    mediaCollectionId: string;
    mediaAssetId: string;
    position?: number;
    isMain?: boolean;
    isActive?: boolean;
    alt?: string;
    title?: string;
    locale?: string;
  },
): Promise<BffResult<MediaAdminCollection>> {
  const params = makeScopedParams(context);
  const locale = input.locale?.trim() || context.locale;
  const metadata: {
    alt?: Record<string, string>;
    title?: Record<string, string>;
  } = {};

  if (input.alt !== undefined) {
    metadata.alt = { [locale]: input.alt };
  }
  if (input.title !== undefined) {
    metadata.title = { [locale]: input.title };
  }

  const payload = {
    ...(input.position !== undefined ? { position: input.position } : {}),
    ...(input.isMain !== undefined ? { isMain: input.isMain } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(metadata.alt || metadata.title ? { metadata } : {}),
  };

  return requestAdminBff(
    `/admin/media/collections/${encodeURIComponent(input.mediaCollectionId)}/items/${encodeURIComponent(input.mediaAssetId)}?${params.toString()}`,
    {
      context,
      init: {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      },
      parse: (value) => parseCollection(value, context.locale) ?? {
        mediaCollectionId: input.mediaCollectionId,
        title: input.mediaCollectionId,
        active: true,
        itemCount: 0,
        mediaAssetIds: [],
        items: [],
      },
    },
  );
}

export async function softDeleteMediaCollection(
  context: AdminContext,
  mediaCollectionId: string,
): Promise<BffResult<{ deleted?: boolean; status?: string }>> {
  const params = makeScopedParams(context, { mode: "soft" });

  return requestAdminBff(`/admin/media/collections/${encodeURIComponent(mediaCollectionId)}?${params.toString()}`, {
    context,
    init: {
      method: "DELETE",
    },
    parse: (value) => asRecord(value) as { deleted?: boolean; status?: string },
  });
}

export async function softDeleteMediaAsset(
  context: AdminContext,
  mediaCollectionId: string,
  mediaAssetId: string,
): Promise<BffResult<{ deleted?: boolean; status?: string }>> {
  const params = makeScopedParams(context, { mode: "soft" });

  return requestAdminBff(
    `/admin/media/collections/${encodeURIComponent(mediaCollectionId)}/items/${encodeURIComponent(mediaAssetId)}?${params.toString()}`,
    {
      context,
      init: {
        method: "DELETE",
      },
      parse: (value) => asRecord(value) as { deleted?: boolean; status?: string },
    },
  );
}

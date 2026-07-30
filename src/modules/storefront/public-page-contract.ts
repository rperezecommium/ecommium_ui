export const storefrontPublicPageKinds = ["PRODUCT", "CATEGORY", "CMS_PAGE", "REDIRECT"] as const;

export type StorefrontPublicPageKind = (typeof storefrontPublicPageKinds)[number];
export type StorefrontPublicEntityType = Exclude<StorefrontPublicPageKind, "REDIRECT">;
export type StorefrontPublicRedirectStatus = 301 | 302;

export type StorefrontPublicRoute = {
  kind: "ROUTE";
  requestedPath: string;
  canonicalPath: string;
  isCanonical: boolean;
  entityType: StorefrontPublicEntityType;
  entityId: string;
  routeId: string;
  canonicalRouteId: string;
  organizationId: string;
  shopId: string;
  locale: string;
};

export type StorefrontPublicRedirect = {
  kind: "REDIRECT";
  requestedPath: string;
  toPath: string;
  statusCode: StorefrontPublicRedirectStatus;
  redirectId: string;
  organizationId: string;
  shopId: string;
  locale: string;
};

export type StorefrontCmsSeo = {
  title: string;
  description: string;
};

export type StorefrontCmsBlock = {
  blockId: string;
  type: string;
  props: Record<string, unknown>;
  children?: StorefrontCmsBlock[];
};

export type StorefrontCmsResolvedColumnSlot = {
  columnIndex: number;
  width: string;
  percentage?: number;
};

export type StorefrontCmsResolvedArea = {
  areaId: string;
  name?: string | null;
  containerMode?: "full-width" | "container" | string;
  maxWidth?: string | null;
  columns: string[];
  columnSlots?: StorefrontCmsResolvedColumnSlot[];
  columnGap?: string | null;
  rowGap?: string | null;
};

export type StorefrontCmsResolvedPageSettings = {
  layout?: {
    regions?: Partial<Record<"header" | "main" | "footer", {
      areas?: StorefrontCmsResolvedArea[];
    }>>;
  };
  tokens?: {
    defaultColumnGap?: string;
    defaultModuleGap?: string;
    maxWidth?: string;
  };
};

export type StorefrontCmsPublishedPage = {
  pageId: string;
  organizationId: string;
  shopId: string;
  locale: string;
  resolvedLocale: string;
  pageType: string;
  status: "PUBLISHED";
  title: string;
  canonicalPath: string;
  routeId: string;
  seo: StorefrontCmsSeo;
  blocks: StorefrontCmsBlock[];
  resolvedPageSettings?: StorefrontCmsResolvedPageSettings | null;
  version: number;
  publishedAt: string;
};

export type StorefrontProductPublicPage = {
  kind: "PRODUCT";
  route: StorefrontPublicRoute & { entityType: "PRODUCT" };
  page: Record<string, unknown>;
};

export type StorefrontCategoryPublicPage = {
  kind: "CATEGORY";
  route: StorefrontPublicRoute & { entityType: "CATEGORY" };
  page: Record<string, unknown>;
};

export type StorefrontCmsPublicPage = {
  kind: "CMS_PAGE";
  route: StorefrontPublicRoute & { entityType: "CMS_PAGE" };
  page: StorefrontCmsPublishedPage;
};

export type StorefrontPublicPageResponse =
  | StorefrontProductPublicPage
  | StorefrontCategoryPublicPage
  | StorefrontCmsPublicPage
  | StorefrontPublicRedirect;

export type StorefrontPublicPathResolution = StorefrontPublicRoute | StorefrontPublicRedirect;

export type StorefrontPublicPageMetadata = {
  title: string;
  description: string;
  canonicalPath: string;
  indexable: boolean;
};

export type StorefrontPublicPageErrorKind =
  | "INVALID_PATH"
  | "NOT_FOUND"
  | "TEMPORARILY_UNAVAILABLE"
  | "UNEXPECTED";

export type StorefrontPublicPageError = {
  kind: StorefrontPublicPageErrorKind;
  status?: number;
  title: string;
  message: string;
};

export function classifyStorefrontPublicPageError(status?: number): StorefrontPublicPageError {
  if (status === 400 || status === 422) {
    return {
      kind: "INVALID_PATH",
      status,
      title: "Esta dirección no es válida",
      message: "Revisa la dirección o vuelve a la tienda.",
    };
  }

  if (status === 404 || status === 401 || status === 403) {
    return {
      kind: "NOT_FOUND",
      status: 404,
      title: "No encontramos esta página",
      message: "Puede que haya cambiado de dirección o ya no esté publicada.",
    };
  }

  if (status === 502 || status === 503 || status === 504) {
    return {
      kind: "TEMPORARILY_UNAVAILABLE",
      status,
      title: "La página no está disponible ahora",
      message: "Inténtalo de nuevo en unos minutos.",
    };
  }

  return {
    kind: "UNEXPECTED",
    status,
    title: "No pudimos abrir esta página",
    message: "Vuelve a intentarlo o regresa a la tienda.",
  };
}

export function isStorefrontPublicPageResponse(value: unknown): value is StorefrontPublicPageResponse {
  const payload = asRecord(value);
  if (!payload) return false;

  if (payload.kind === "REDIRECT") {
    return (
      typeof payload.requestedPath === "string" &&
      typeof payload.toPath === "string" &&
      (payload.statusCode === 301 || payload.statusCode === 302)
    );
  }

  if (payload.kind !== "PRODUCT" && payload.kind !== "CATEGORY" && payload.kind !== "CMS_PAGE") {
    return false;
  }

  const route = asRecord(payload.route);
  const page = asRecord(payload.page);
  if (!route || !page) return false;

  const validRoute = (
    route.kind === "ROUTE" &&
    route.entityType === payload.kind &&
    typeof route.requestedPath === "string" &&
    typeof route.canonicalPath === "string" &&
    typeof route.isCanonical === "boolean" &&
    typeof route.entityId === "string" &&
    typeof route.organizationId === "string" &&
    typeof route.shopId === "string" &&
    typeof route.locale === "string"
  );
  if (!validRoute) return false;
  if (payload.kind !== "CMS_PAGE") return true;

  const seo = asRecord(page.seo);
  return (
    page.status === "PUBLISHED" &&
    typeof page.pageId === "string" &&
    typeof page.title === "string" &&
    typeof page.pageType === "string" &&
    typeof page.canonicalPath === "string" &&
    Array.isArray(page.blocks) &&
    Boolean(seo) &&
    typeof seo?.title === "string" &&
    typeof seo?.description === "string"
  );
}

export function isStorefrontPublicPathResolution(
  value: unknown,
): value is StorefrontPublicPathResolution {
  const payload = asRecord(value);
  if (!payload) return false;

  if (payload.kind === "REDIRECT") {
    return (
      typeof payload.requestedPath === "string" &&
      typeof payload.toPath === "string" &&
      (payload.statusCode === 301 || payload.statusCode === 302)
    );
  }

  return (
    payload.kind === "ROUTE" &&
    storefrontPublicPageKinds.slice(0, 3).includes(payload.entityType as StorefrontPublicEntityType) &&
    typeof payload.requestedPath === "string" &&
    typeof payload.canonicalPath === "string" &&
    typeof payload.isCanonical === "boolean" &&
    typeof payload.entityId === "string" &&
    typeof payload.organizationId === "string" &&
    typeof payload.shopId === "string" &&
    typeof payload.locale === "string"
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

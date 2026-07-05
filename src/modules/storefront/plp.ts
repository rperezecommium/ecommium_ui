import { requestBff } from "../../shared/bff/client";
import { defaultAdminContext } from "../../shared/config/env";

export type StorefrontPlpBlock = {
  blockId: string;
  type: string;
  props: Record<string, unknown>;
  children?: StorefrontPlpBlock[];
};

export type StorefrontPlpProduct = {
  productId: string;
  variantId?: string;
  slug: string;
  productUrlPath?: string;
  name: string;
  brand?: string;
  categoryName?: string;
  imageUrl?: string;
  imageAlt?: string;
  priceDisplay?: string;
  previousPriceDisplay?: string;
  available: boolean;
};

export type StorefrontSearchEventData = {
  organizationId: string;
  shopId: string;
  visitorId: string;
  query: string;
  offset: number;
  attributionToken?: string;
};

export type StorefrontCategoryLink = {
  id: string;
  name: string;
  slug: string;
  href: string;
  depth: number;
  active: boolean;
};

export type StorefrontPlpData = {
  categorySlug: string;
  searchQuery?: string;
  resolvedLocale?: string;
  total: number;
  limit: number;
  offset: number;
  currentPage: number;
  totalPages: number;
  contextQuery: string;
  publicPath: string;
  searchEvent?: StorefrontSearchEventData;
  categories: StorefrontCategoryLink[];
  products: StorefrontPlpProduct[];
  cmsBlocks: {
    beforeList: StorefrontPlpBlock[];
    afterList: StorefrontPlpBlock[];
  };
};

export type StorefrontPlpResult = {
  ok: boolean;
  requestedPath: string;
  status?: number;
  correlationId?: string;
  error?: string;
  data?: StorefrontPlpData;
};

type StorefrontContext = {
  organizationId: string;
  shopId: string;
  shopAlias: string;
  locale: string;
  currency: string;
  country: string;
  channel: string;
};

type StorefrontPlpOverrides = Partial<StorefrontContext & {
  routePath: string;
  page: string;
  limit: string;
  visitorId: string;
}>;

const localStorefrontDefaults: StorefrontContext = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  shopId: "22222222-2222-4222-8222-222222222222",
  shopAlias: "tienda-barcelona",
  locale: "es-ES",
  currency: "EUR",
  country: "ES",
  channel: "web",
};

const storefrontContext: StorefrontContext = {
  organizationId: process.env.ECOMMIUM_STOREFRONT_ORGANIZATION_ID || defaultAdminContext.organizationId || localStorefrontDefaults.organizationId,
  shopId: process.env.ECOMMIUM_STOREFRONT_SHOP_ID || defaultAdminContext.shopId || localStorefrontDefaults.shopId,
  shopAlias: process.env.ECOMMIUM_STOREFRONT_SHOP_ALIAS || defaultAdminContext.shopAlias || localStorefrontDefaults.shopAlias,
  locale: process.env.ECOMMIUM_STOREFRONT_LOCALE || defaultAdminContext.locale || localStorefrontDefaults.locale,
  currency: process.env.ECOMMIUM_STOREFRONT_CURRENCY || defaultAdminContext.currency || localStorefrontDefaults.currency,
  country: process.env.ECOMMIUM_STOREFRONT_COUNTRY || defaultAdminContext.country || localStorefrontDefaults.country,
  channel: process.env.ECOMMIUM_STOREFRONT_CHANNEL || localStorefrontDefaults.channel,
};

export async function getStorefrontPlp(
  categorySlug: string,
  overrides: StorefrontPlpOverrides = {},
): Promise<StorefrontPlpResult> {
  const context = {
    ...storefrontContext,
    ...compactContext(overrides),
  };
  const limit = positiveInt(overrides.limit, 16);
  const currentPage = positiveInt(overrides.page, 1);
  const offset = (currentPage - 1) * limit;
  const routePath = overrides.routePath?.trim() || `/${categorySlug}`;
  const publicPath = routePath === "/" ? "/" : `/plp/${encodeURIComponent(categorySlug)}`;
  const contextParams = buildContextParams(context);
  const params = new URLSearchParams(contextParams);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  params.set("routePath", routePath);

  const categoriesPromise = getStorefrontCategories(context, categorySlug);
  const requestedPath = `/storefront/plp/${encodeURIComponent(categorySlug)}?${params.toString()}`;
  const result = await requestBff<unknown>(requestedPath, {
    context: { locale: context.locale },
    withAuth: false,
  });
  const categories = await categoriesPromise;

  if (!result.ok) {
    return {
      ok: false,
      requestedPath,
      status: result.status,
      correlationId: result.correlationId,
      error: result.error,
    };
  }

  return {
    ok: true,
    requestedPath,
    status: result.status,
    correlationId: result.correlationId,
    data: mapPlpPayload(result.data, categorySlug, currentPage, contextParams.toString(), publicPath, categories),
  };
}

export async function getStorefrontSearch(
  query: string,
  overrides: StorefrontPlpOverrides = {},
): Promise<StorefrontPlpResult> {
  const context = {
    ...storefrontContext,
    ...compactContext(overrides),
  };
  const searchQuery = query.trim();
  const limit = positiveInt(overrides.limit, 16);
  const currentPage = positiveInt(overrides.page, 1);
  const offset = (currentPage - 1) * limit;
  const publicPath = "/search";
  const contextParams = buildContextParams(context);
  const categoriesPromise = getStorefrontCategories(context, "search");

  if (!searchQuery) {
    const categories = await categoriesPromise;
    return {
      ok: true,
      requestedPath: "/storefront/search",
      data: emptySearchData(limit, currentPage, contextParams.toString(), publicPath, categories),
    };
  }

  const params = new URLSearchParams(contextParams);
  const visitorId = overrides.visitorId?.trim() || "storefront-anonymous";
  params.set("q", searchQuery);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  params.set("visitorId", visitorId);

  const requestedPath = `/storefront/search?${params.toString()}`;
  const result = await requestBff<unknown>(requestedPath, {
    context: { locale: context.locale },
    withAuth: false,
  });
  const categories = await categoriesPromise;

  if (!result.ok) {
    return {
      ok: false,
      requestedPath,
      status: result.status,
      correlationId: result.correlationId,
      error: result.error,
    };
  }

  return {
    ok: true,
    requestedPath,
    status: result.status,
    correlationId: result.correlationId,
    data: mapSearchPayload(result.data, searchQuery, currentPage, contextParams.toString(), publicPath, categories, context, visitorId),
  };
}

function compactContext<T extends Record<string, string | undefined>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => typeof item === "string" && item.trim().length > 0),
  ) as Partial<T>;
}

async function getStorefrontCategories(
  context: StorefrontContext,
  activeSlug: string,
): Promise<StorefrontCategoryLink[]> {
  const result = await requestBff<unknown>("/storefront/navigation/categories/tree/3", {
    context: { locale: context.locale },
    withAuth: false,
  });

  if (!result.ok) {
    return fallbackCategories(activeSlug);
  }

  const root = asRecord(result.data);
  const categories = flattenCategories(listItems(root.categories), activeSlug);
  return categories.length > 0 ? categories : fallbackCategories(activeSlug);
}

function mapPlpPayload(
  payload: unknown,
  fallbackSlug: string,
  currentPage: number,
  contextQuery: string,
  publicPath: string,
  categories: StorefrontCategoryLink[],
): StorefrontPlpData {
  const root = asRecord(payload);
  const cmsBlocks = asRecord(root.cmsBlocks);
  const limit = asNumber(root.limit) ?? 16;
  const total = asNumber(root.total) ?? 0;

  return {
    categorySlug: asString(root.categorySlug) ?? fallbackSlug,
    resolvedLocale: asString(root.resolvedLocale),
    total,
    limit,
    offset: asNumber(root.offset) ?? 0,
    currentPage,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    contextQuery,
    publicPath,
    categories,
    products: listItems(root.products).map(mapProduct),
    cmsBlocks: {
      beforeList: listItems(cmsBlocks.beforeList).map(mapBlock),
      afterList: listItems(cmsBlocks.afterList).map(mapBlock),
    },
  };
}

function emptySearchData(
  limit: number,
  currentPage: number,
  contextQuery: string,
  publicPath: string,
  categories: StorefrontCategoryLink[],
): StorefrontPlpData {
  return {
    categorySlug: "search",
    total: 0,
    limit,
    offset: 0,
    currentPage,
    totalPages: 1,
    contextQuery,
    publicPath,
    categories,
    products: [],
    cmsBlocks: {
      beforeList: [],
      afterList: [],
    },
  };
}

function mapSearchPayload(
  payload: unknown,
  searchQuery: string,
  currentPage: number,
  contextQuery: string,
  publicPath: string,
  categories: StorefrontCategoryLink[],
  context: StorefrontContext,
  visitorId: string,
): StorefrontPlpData {
  const root = asRecord(payload);
  const products = searchItems(root).map(mapProduct);
  const limit = asNumber(root.limit) ?? 16;
  const total = asNumber(root.total) ?? asNumber(root.searchTotal) ?? products.length;
  const offset = asNumber(root.offset) ?? 0;

  return {
    categorySlug: "search",
    searchQuery,
    resolvedLocale: asString(root.resolvedLocale),
    total,
    limit,
    offset,
    currentPage,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    contextQuery,
    publicPath,
    searchEvent: {
      organizationId: context.organizationId,
      shopId: context.shopId,
      visitorId,
      query: searchQuery,
      offset,
      attributionToken: asString(root.attributionToken),
    },
    categories,
    products,
    cmsBlocks: {
      beforeList: [],
      afterList: [],
    },
  };
}

function buildContextParams(context: StorefrontContext) {
  const params = new URLSearchParams({
    organizationId: context.organizationId,
    locale: context.locale,
    currency: context.currency,
    country: context.country,
    channel: context.channel,
  });

  if (context.shopId) {
    params.set("shopId", context.shopId);
  } else if (context.shopAlias) {
    params.set("shopAlias", context.shopAlias);
  }

  return params;
}

function flattenCategories(
  items: unknown[],
  activeSlug: string,
  depth = 0,
): StorefrontCategoryLink[] {
  return items.flatMap((item) => {
    const category = asRecord(item);
    const name = asString(category.name) ?? asString(category.title) ?? "Categoria";
    const slug = categorySlug(category);
    if (!slug) {
      return flattenCategories(listItems(category.children), activeSlug, depth + 1);
    }

    return [
      {
        id: asString(category.id) ?? slug,
        name,
        slug,
        href: `/plp/${encodeURIComponent(slug)}`,
        depth,
        active: slug === activeSlug,
      },
      ...flattenCategories(listItems(category.children), activeSlug, depth + 1),
    ];
  });
}

function fallbackCategories(activeSlug: string): StorefrontCategoryLink[] {
  const slugs = [activeSlug, "bike-drivetrain", "clothes", "accessories", "art"];
  return Array.from(new Set(slugs)).filter(Boolean).map((slug) => {
    return {
      id: slug,
      name: titleFromSlug(slug),
      slug,
      href: `/plp/${encodeURIComponent(slug)}`,
      depth: 0,
      active: slug === activeSlug,
    };
  });
}

function categorySlug(category: Record<string, unknown>) {
  const linkId = asString(category.linkId);
  if (linkId) {
    return linkId;
  }

  const url = asString(category.url);
  return url?.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean).pop();
}

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Categoria";
}

function mapProduct(value: unknown): StorefrontPlpProduct {
  const product = asRecord(value);
  const image = asRecord(product.image);
  const price = asRecord(product.price);
  const currentAmountMinor =
    asNumber(price.currentAmountMinor) ??
    asNumber(price.grossAmountMinor) ??
    asNumber(price.amountMinor);
  const previousAmountMinor =
    asNumber(price.previousAmountMinor) ?? asNumber(price.listAmountMinor);
  const currency = asString(price.currency) ?? storefrontContext.currency;

  return {
    productId: asString(product.productId) ?? asString(product.variantId) ?? "product",
    variantId: asString(product.selectedVariantId) ?? asString(product.variantId),
    slug: asString(product.slug) ?? asString(product.productId) ?? "product",
    productUrlPath: asString(product.productUrlPath),
    name: asString(product.nombre) ?? asString(product.name) ?? "Producto",
    brand: asString(product.brand),
    categoryName: asString(product.categoryName),
    imageUrl: asString(image.url),
    imageAlt: asString(image.altText) ?? asString(image.title),
    priceDisplay: formatMoney(currentAmountMinor, currency),
    previousPriceDisplay: formatMoney(previousAmountMinor, currency),
    available: asBoolean(product.isAvailable) ?? true,
  };
}

function mapBlock(value: unknown): StorefrontPlpBlock {
  const block = asRecord(value);

  return {
    blockId: asString(block.blockId) ?? "block",
    type: asString(block.type) ?? "unknown",
    props: asRecord(block.props),
    children: listItems(block.children).map(mapBlock),
  };
}

function formatMoney(amountMinor: number | undefined, currency: string) {
  if (amountMinor === undefined) {
    return undefined;
  }

  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function listItems(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function searchItems(root: Record<string, unknown>) {
  for (const key of ["products", "results", "items", "data"]) {
    const value = root[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

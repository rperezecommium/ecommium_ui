import { requestBff } from "../../shared/bff/client";
import { defaultAdminContext } from "../../shared/config/env";

type StorefrontContext = {
  organizationId: string;
  shopId: string;
  shopAlias: string;
  locale: string;
  currency: string;
  country: string;
  channel: string;
};

export type StorefrontPdpVariant = {
  variantId: string;
  name: string;
  refId?: string;
  ean?: string;
  images: StorefrontPdpImage[];
  priceAmountMinor?: number;
  previousPriceAmountMinor?: number;
  priceDisplay?: string;
  previousPriceDisplay?: string;
  available: boolean;
  availableQuantity?: number;
  isDefault: boolean;
  offerings: string[];
  options: Array<{
    attributeCode: string;
    valueCode: string;
  }>;
};

export type StorefrontPdpImage = {
  url: string;
  alt?: string;
};

export type StorefrontPdpSpecification = {
  group: string;
  fields: Array<{
    name: string;
    value: string;
  }>;
};

export type StorefrontPdpData = {
  productId?: string;
  slug: string;
  linkId?: string;
  refId?: string;
  ean?: string;
  title: string;
  brand?: string;
  brandId?: string;
  category?: string;
  categoryId?: string;
  categorySlug?: string;
  categoryHref?: string;
  shortDescription?: string;
  description?: string;
  metaDescription?: string;
  keywords?: string;
  releaseDate?: string;
  taxCode?: string;
  imageUrl?: string;
  imageAlt?: string;
  images: StorefrontPdpImage[];
  priceAmountMinor?: number;
  previousPriceAmountMinor?: number;
  priceDisplay?: string;
  previousPriceDisplay?: string;
  available: boolean;
  availableQuantity?: number;
  variants: StorefrontPdpVariant[];
  specifications: StorefrontPdpSpecification[];
  contextQuery: string;
};

export type StorefrontPdpResult = {
  ok: boolean;
  requestedPath: string;
  status?: number;
  correlationId?: string;
  error?: string;
  data?: StorefrontPdpData;
};

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

type StorefrontPdpOverrides = Partial<StorefrontContext & {
  categorySlug: string;
  productId: string;
}>;

export async function getStorefrontPdp(
  productSlug: string,
  overrides: StorefrontPdpOverrides = {},
): Promise<StorefrontPdpResult> {
  const context = {
    ...storefrontContext,
    ...compactContext(overrides),
  };
  const contextParams = buildContextParams(context);
  const requestedPath = `/storefront/pdp/${encodeURIComponent(productSlug)}?${contextParams.toString()}`;
  const result = await requestBff<unknown>(requestedPath, {
    context: { locale: context.locale },
    withAuth: false,
  });

  if (!result.ok) {
    const fallback = await getPdpFromPlp(productSlug, context, contextParams, overrides);
    if (fallback) {
      return {
        ok: true,
        requestedPath,
        status: 200,
        correlationId: result.correlationId,
        data: fallback,
      };
    }

    return {
      ok: false,
      requestedPath,
      status: result.status,
      correlationId: result.correlationId,
      error: result.error,
    };
  }

  const mapped = mapPdpPayload(result.data, productSlug, context.currency, "");
  const categoryMeta = mapped.category ? null : await resolvePdpCategoryMeta(context, mapped.categoryId);

  return {
    ok: true,
    requestedPath,
    status: result.status,
    correlationId: result.correlationId,
    data: {
      ...mapped,
      category: mapped.category ?? categoryMeta?.name,
      categorySlug: mapped.categorySlug ?? categoryMeta?.slug,
      categoryHref: mapped.categoryHref ?? categoryMeta?.href,
    },
  };
}

async function getPdpFromPlp(
  productSlug: string,
  context: StorefrontContext,
  contextParams: URLSearchParams,
  overrides: StorefrontPdpOverrides,
): Promise<StorefrontPdpData | null> {
  const productId = overrides.productId?.trim();
  const categorySlugs = await getPdpSearchCategories(context, overrides.categorySlug?.trim());

  for (const categorySlug of categorySlugs) {
    const params = new URLSearchParams(contextParams);
    params.set("limit", "250");
    params.set("offset", "0");
    params.set("routePath", `/${categorySlug}`);

    const result = await requestBff<unknown>(
      `/storefront/plp/${encodeURIComponent(categorySlug)}?${params.toString()}`,
      {
        context: { locale: context.locale },
        withAuth: false,
      },
    );

    if (!result.ok) {
      continue;
    }

    const root = asRecord(result.data);
    const product = listItems(root.products)
      .map(asRecord)
      .find((item) => (productId ? asString(item.productId) === productId : false) || asString(item.slug) === productSlug);

    if (product) {
      return mapPdpPayload({ product }, productSlug, context.currency, "");
    }
  }

  return null;
}

async function getPdpSearchCategories(
  context: StorefrontContext,
  preferredCategorySlug: string | undefined,
): Promise<string[]> {
  const fallbackSlugs = [
    preferredCategorySlug,
    "bike-brakes",
    "bike-cockpit",
    "bike-drivetrain",
    "bike-workshop",
    "clothes",
    "accessories",
    "art",
  ].filter((slug): slug is string => Boolean(slug));

  const result = await requestBff<unknown>("/storefront/navigation/categories/tree/3", {
    context: { locale: context.locale },
    withAuth: false,
  });

  if (!result.ok) {
    return Array.from(new Set(fallbackSlugs));
  }

  const root = asRecord(result.data);
  const discoveredSlugs = flattenCategorySlugs(listItems(root.categories));
  return Array.from(new Set([...fallbackSlugs, ...discoveredSlugs]));
}

function flattenCategorySlugs(items: unknown[]): string[] {
  return items.flatMap((item) => {
    const category = asRecord(item);
    const slug = categorySlug(category);
    const children = flattenCategorySlugs(listItems(category.children));
    return slug ? [slug, ...children] : children;
  });
}

function categorySlug(category: Record<string, unknown>) {
  const directSlug = asString(category.slug) ?? asString(category.linkId);
  if (directSlug) {
    return directSlug.replace(/^\/+|\/+$/g, "");
  }

  const url = asString(category.url) ?? asString(category.href);
  return url?.split("?")[0]?.split("/").filter(Boolean).at(-1);
}

async function resolvePdpCategoryMeta(
  context: StorefrontContext,
  categoryId: string | undefined,
): Promise<{ name: string; slug: string; href: string } | null> {
  if (!categoryId) {
    return null;
  }

  const result = await requestBff<unknown>("/storefront/navigation/categories/tree/3", {
    context: { locale: context.locale },
    withAuth: false,
  });

  if (!result.ok) {
    return null;
  }

  const category = findCategoryById(listItems(asRecord(result.data).categories), categoryId);
  if (!category) {
    return null;
  }

  const name = asString(category.name) ?? asString(category.title);
  const slug = categorySlug(category);
  if (!name || !slug) {
    return null;
  }

  return {
    name,
    slug,
    href: `/plp/${encodeURIComponent(slug)}`,
  };
}

function findCategoryById(items: unknown[], categoryId: string): Record<string, unknown> | null {
  for (const item of items) {
    const category = asRecord(item);
    if (asString(category.id) === categoryId || asString(category.categoryId) === categoryId) {
      return category;
    }

    const child = findCategoryById(listItems(category.children), categoryId);
    if (child) {
      return child;
    }
  }

  return null;
}

function mapPdpPayload(
  payload: unknown,
  fallbackSlug: string,
  fallbackCurrency: string,
  contextQuery: string,
): StorefrontPdpData {
  const root = asRecord(payload);
  const product = asRecord(root.product ?? root.data ?? payload);
  const image = asRecord(product.image);
  const price = asRecord(product.price);
  const availability = asRecord(product.availability);
  const variants = listItems(product.variants).map((item) => {
    const variant = asRecord(item);
    const variantAvailability = asRecord(variant.availability);
    const variantPrice = asRecord(variant.price);
    const variantPriceAmountMinor = amountMinor(variantPrice);
    const variantPreviousPriceAmountMinor = previousAmountMinor(variantPrice);

    return {
      variantId: asString(variant.variantId) ?? asString(variant.id) ?? "variant",
      name: asString(variant.name) ?? asString(variant.refId) ?? "Variante",
      refId: asString(variant.refId),
      ean: asString(variant.ean),
      images: normalizeImages(variant),
      priceAmountMinor: variantPriceAmountMinor,
      previousPriceAmountMinor: variantPreviousPriceAmountMinor,
      priceDisplay: formatMoney(variantPriceAmountMinor, asString(variantPrice.currency) ?? fallbackCurrency),
      previousPriceDisplay: formatMoney(variantPreviousPriceAmountMinor, asString(variantPrice.currency) ?? fallbackCurrency),
      available: asBoolean(variant.isAvailable) ?? asBoolean(variantAvailability.available) ?? true,
      availableQuantity: asNumber(variantAvailability.availableQuantity),
      isDefault: asBoolean(variant.isDefault) ?? false,
      offerings: listItems(variant.offerings)
        .map((offering) => asString(asRecord(offering).name))
        .filter((name): name is string => Boolean(name)),
      options: listItems(variant.options).map((option) => {
        const record = asRecord(option);
        return {
          attributeCode: asString(record.attributeCode) ?? "attribute",
          valueCode: asString(record.valueCode) ?? "value",
        };
      }),
    };
  });
  const images = normalizeImages(product);
  const mainImage = images[0] ?? {
    url: asString(image.url) ?? "",
    alt: asString(image.altText) ?? asString(image.title),
  };
  const defaultVariant = variants.find((variant) => variant.isDefault) ?? variants[0];
  const priceAmountMinor = amountMinor(price);
  const previousPriceAmountMinor = previousAmountMinor(price);

  return {
    productId: asString(product.productId),
    slug: asString(product.slug) ?? fallbackSlug,
    linkId: asString(product.linkId),
    refId: asString(product.refId) ?? defaultVariant?.refId,
    ean: defaultVariant?.ean,
    title: asString(product.nombre) ?? asString(product.name) ?? asString(product.title) ?? "Producto",
    brand: asString(product.brand),
    brandId: asString(product.brandId),
    category: asString(product.categoryName),
    categoryId: asString(product.categoryId),
    categorySlug: asString(product.categorySlug),
    categoryHref: asString(product.categoryHref),
    shortDescription: cleanText(asString(product.shortDescription)),
    description: cleanText(asString(product.description) ?? asString(product.shortDescription)),
    metaDescription: cleanText(asString(product.metaTagDescription)),
    keywords: asString(product.keywords),
    releaseDate: asString(product.releaseDate),
    taxCode: asString(product.taxCode),
    imageUrl: mainImage.url || undefined,
    imageAlt: mainImage.alt,
    images,
    priceAmountMinor,
    previousPriceAmountMinor,
    priceDisplay: formatMoney(priceAmountMinor, asString(price.currency) ?? fallbackCurrency),
    previousPriceDisplay: formatMoney(previousPriceAmountMinor, asString(price.currency) ?? fallbackCurrency),
    available: asBoolean(product.isAvailable) ?? asBoolean(availability.available) ?? true,
    availableQuantity: asNumber(availability.availableQuantity),
    variants,
    specifications: normalizeSpecifications(product),
    contextQuery,
  };
}

function normalizeImages(product: Record<string, unknown>): StorefrontPdpImage[] {
  const images = [
    ...listItems(product.images),
    ...listItems(asRecord(product.image).url ? [product.image] : []),
    ...listItems(product.variants).flatMap((variant) => listItems(asRecord(variant).images)),
  ]
    .map(asRecord)
    .map((image) => ({
      url: asString(image.url) ?? "",
      alt: asString(image.altText) ?? asString(image.title),
    }))
    .filter((image) => image.url.length > 0);

  return Array.from(new Map(images.map((image) => [image.url, image])).values());
}

function normalizeSpecifications(product: Record<string, unknown>): StorefrontPdpSpecification[] {
  const groups = [
    ...listItems(product.specifications),
    ...listItems(product.specificationsSummary),
  ];

  return groups.map((group) => {
    const record = asRecord(group);
    return {
      group: asString(record.name) ?? "Caracteristicas",
      fields: listItems(record.fields)
        .map((field) => {
          const fieldRecord = asRecord(field);
          const selectedValue = asRecord(fieldRecord.selectedValue);
          return {
            name: asString(fieldRecord.name) ?? "Caracteristica",
            value:
              asString(selectedValue.name) ??
              asString(selectedValue.text) ??
              asString(fieldRecord.defaultValue) ??
              "",
          };
        })
        .filter((field) => field.value.length > 0),
    };
  }).filter((group) => group.fields.length > 0);
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

function compactContext<T extends Record<string, string | undefined>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => typeof item === "string" && item.trim().length > 0),
  ) as Partial<T>;
}

function amountMinor(price: Record<string, unknown>) {
  return asNumber(price.currentAmountMinor) ?? asNumber(price.grossAmountMinor) ?? asNumber(price.amountMinor);
}

function previousAmountMinor(price: Record<string, unknown>) {
  return asNumber(price.previousAmountMinor) ?? asNumber(price.listAmountMinor);
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

function cleanText(value: string | undefined): string | undefined {
  return value
    ?.replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim() || undefined;
}

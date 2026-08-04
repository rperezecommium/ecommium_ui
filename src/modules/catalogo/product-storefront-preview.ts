import { requestStorefrontBff } from "../../shared/bff/storefront-client";
import type { AdminContext } from "../../shared/config/admin-context";
import type { ProductEditorData } from "./product-editor-types";

export type ProductStorefrontPreviewData = {
  productId?: string;
  slug: string;
  title: string;
  shortDescription?: string;
  description?: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  imageAlt?: string;
  priceDisplay?: string;
  availability: string;
  breadcrumbs: string[];
  variantsCount: number;
};

export type ProductStorefrontPreviewResult = {
  ok: boolean;
  requestedPath: string;
  status?: number;
  correlationId?: string;
  error?: string;
  data?: ProductStorefrontPreviewData;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
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

function stripHtml(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim() || undefined;
}

function localizedText(value: unknown, locale: string) {
  const direct = stripHtml(asString(value));
  if (direct) {
    return direct;
  }

  const record = asRecord(value);
  return (
    stripHtml(asString(record[locale])) ??
    stripHtml(asString(record["es-ES"])) ??
    stripHtml(asString(record.es)) ??
    stripHtml(asString(record.default))
  );
}

function listItems(value: unknown): unknown[] {
  const record = asRecord(value);
  const items = record.items ?? record.products ?? record.variants ?? record.images ?? value;
  return Array.isArray(items) ? items : [];
}

function unwrapProductPayload(value: unknown) {
  const root = asRecord(value);
  const data = asRecord(root.data);

  return asRecord(
    root.product ??
      data.product ??
      root.pdp ??
      data.pdp ??
      root.item ??
      data.item ??
      value,
  );
}

function nestedName(value: unknown, locale: string) {
  const record = asRecord(value);
  return localizedText(record.name ?? record.label ?? record.title, locale);
}

function firstImage(root: Record<string, unknown>, product: Record<string, unknown>, locale: string) {
  const imageCandidates = [
    ...listItems(product.images),
    ...listItems(product.media),
    ...listItems(asRecord(product.media).items),
    ...listItems(root.images),
    ...listItems(root.media),
    ...listItems(asRecord(root.media).items),
  ];
  const image = imageCandidates.map(asRecord).find((item) => {
    return Boolean(asString(item.url) ?? asString(item.publicUrl) ?? asString(item.thumbnailUrl) ?? asString(item.previewUrl));
  });

  if (!image) {
    return {};
  }

  return {
    imageUrl: asString(image.url) ?? asString(image.publicUrl) ?? asString(image.thumbnailUrl) ?? asString(image.previewUrl),
    imageAlt: localizedText(image.alt ?? image.altText ?? image.title, locale),
  };
}

function formatMoney(amountMinor: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

function priceDisplay(value: unknown, fallbackCurrency: string, locale: string): string | undefined {
  const record = asRecord(value);
  const display =
    asString(record.display) ??
    asString(record.formatted) ??
    asString(record.priceDisplay) ??
    asString(record.priceTaxIncludedDisplay);
  if (display) {
    return display;
  }

  const resolved = asRecord(record.resolved);
  const basePrice = asRecord(record.basePrice);
  const price = asRecord(record.price);
  const amountMinor =
    asNumber(record.amountMinor) ??
    asNumber(record.priceMinor) ??
    asNumber(record.valueMinor) ??
    asNumber(record.grossAmountMinor) ??
    asNumber(record.priceTaxIncludedMinor) ??
    asNumber(resolved.grossAmountMinor) ??
    asNumber(basePrice.amountMinor) ??
    asNumber(price.amountMinor);
  const currency =
    asString(record.currency) ??
    asString(resolved.currency) ??
    asString(basePrice.currency) ??
    asString(price.currency) ??
    fallbackCurrency;

  return typeof amountMinor === "number" ? formatMoney(amountMinor, currency, locale) : undefined;
}

function priceFromPayload(root: Record<string, unknown>, product: Record<string, unknown>, fallbackCurrency: string, locale: string) {
  return (
    priceDisplay(product.price, fallbackCurrency, locale) ??
    priceDisplay(product.pricing, fallbackCurrency, locale) ??
    priceDisplay(product.offer, fallbackCurrency, locale) ??
    priceDisplay(product.offers, fallbackCurrency, locale) ??
    priceDisplay(root.price, fallbackCurrency, locale) ??
    priceDisplay(root.pricing, fallbackCurrency, locale)
  );
}

function availabilityText(value: unknown) {
  const record = asRecord(value);
  const status = asString(record.status) ?? asString(record.availability);
  if (status) {
    return status;
  }

  const available = asBoolean(record.available) ?? asBoolean(record.inStock) ?? asBoolean(record.isAvailable);
  if (available === true) {
    return "Disponible";
  }
  if (available === false) {
    return "No disponible";
  }

  const quantity =
    asNumber(record.quantity) ??
    asNumber(record.availableQuantity) ??
    asNumber(record.stock) ??
    asNumber(record.onHandQuantity);

  return typeof quantity === "number" ? `${quantity} disponible(s)` : "Sin dato Storefront";
}

function breadcrumbs(root: Record<string, unknown>, product: Record<string, unknown>, locale: string) {
  const items = [
    ...listItems(root.breadcrumbs),
    ...listItems(product.breadcrumbs),
    ...listItems(root.breadcrumb),
    ...listItems(product.breadcrumb),
  ];

  return items
    .map((item) => localizedText(asRecord(item).name ?? asRecord(item).label ?? asRecord(item).title ?? item, locale))
    .filter((item): item is string => Boolean(item));
}

export function parseStorefrontPdp(
  value: unknown,
  fallbackCurrency = "EUR",
  locale = "es-ES",
): ProductStorefrontPreviewData {
  const root = asRecord(value);
  const product = unwrapProductPayload(value);
  const brand = asRecord(product.brand);
  const category = asRecord(product.category);
  const variants = listItems(product.variants).length ? listItems(product.variants) : listItems(root.variants);
  const image = firstImage(root, product, locale);

  return {
    productId: asString(product.productId) ?? asString(product.id),
    slug: asString(product.slug) ?? asString(root.slug) ?? "",
    title:
      localizedText(product.name ?? product.title ?? root.name ?? root.title, locale) ??
      "Producto Storefront",
    shortDescription: localizedText(product.shortDescription ?? product.summary ?? root.shortDescription, locale),
    description: localizedText(product.description ?? root.description, locale),
    brand: nestedName(product.brand ?? root.brand, locale) ?? localizedText(brand.slug, locale),
    category: nestedName(product.category ?? root.category, locale) ?? localizedText(category.slug, locale),
    imageUrl: image.imageUrl,
    imageAlt: image.imageAlt,
    priceDisplay: priceFromPayload(root, product, fallbackCurrency, locale),
    availability: availabilityText(product.availability ?? product.stock ?? root.availability ?? root.stock),
    breadcrumbs: breadcrumbs(root, product, locale),
    variantsCount: variants.length,
  };
}

export async function getProductStorefrontPreview(
  context: AdminContext,
  editorData: ProductEditorData,
): Promise<ProductStorefrontPreviewResult> {
  const productSlug = editorData.product.slug.trim();
  if (!productSlug) {
    return {
      ok: false,
      requestedPath: "/storefront/pdp",
      error: "El producto no tiene slug para consultar Storefront.",
    };
  }

  const params = new URLSearchParams({
    organizationId: context.organizationId,
    shopId: context.shopId,
    locale: context.locale,
    currency: context.currency,
    country: context.country,
    channel: context.channel,
  });
  const requestedPath = `/storefront/pdp/${encodeURIComponent(productSlug)}?${params.toString()}`;
  const result = await requestStorefrontBff(requestedPath, {
    context,
    withAuth: false,
    parse: (payload) => parseStorefrontPdp(payload, context.currency, context.locale),
  });

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
    data: result.data,
  };
}

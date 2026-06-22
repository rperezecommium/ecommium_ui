import { requestBff } from "../../shared/bff/client";
import type { AdminContext } from "../../shared/config/admin-context";
import { listCatalogEntities, toLookupOptions } from "./catalog-taxonomy";
import { getPricingEditorLookups } from "./pricing-admin";
import { productStatusIsActive } from "./product-status";
import type {
  PriceDraft,
  ProductOfferingCreatePayload,
  ProductOfferingRecord,
  ProductCatalogCreatePayload,
  ProductCatalogUpdatePayload,
  ProductEditorData,
  ProductEditorLookups,
  ProductGateway,
  ProductListFilters,
  ProductListResult,
  ProductSummary,
  ProductVariantCreatePayload,
  ProductVariantOptionPayload,
  ProductVariantRecord,
  ProductVariantUpdatePayload,
  StockDraft,
} from "./product-editor-types";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stripHtml(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const withoutTags = value.replace(/<[^>]*>/g, " ");
  return withoutTags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim() || undefined;
}

function asText(value: unknown): string | undefined {
  return stripHtml(asString(value));
}

function localizedText(value: unknown, locale = "es-ES") {
  const direct = asText(value);
  if (direct) {
    return direct;
  }

  const record = asRecord(value);
  return (
    asText(record[locale]) ??
    asText(record["es-ES"]) ??
    asText(record.es) ??
    asText(record.default)
  );
}

function asRichText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function localizedRichText(value: unknown, locale = "es-ES") {
  const direct = asRichText(value);
  if (direct) {
    return direct;
  }

  const record = asRecord(value);
  return (
    asRichText(record[locale]) ??
    asRichText(record["es-ES"]) ??
    asRichText(record.es) ??
    asRichText(record.default)
  );
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asNullableString(value: unknown) {
  return asString(value) ?? null;
}

function isString(value: string | undefined): value is string {
  return typeof value === "string";
}

function listItems(value: unknown): unknown[] {
  const record = asRecord(value);
  const items = record.items ?? record.products ?? value;
  return Array.isArray(items) ? items : [];
}

function firstStringItem(value: unknown) {
  return Array.isArray(value) ? asString(value[0]) : undefined;
}

function firstCategoryRecord(value: unknown) {
  const items = listItems(value);
  return items.map(asRecord).find((item) => Object.keys(item).length > 0) ?? {};
}

function categoryIdFromRecord(value: Record<string, unknown>) {
  return (
    asString(value.categoryId) ??
    asString(value.id) ??
    asString(value.idCategory) ??
    asString(value.slug)
  );
}

function categoryNameFromRecord(value: Record<string, unknown>) {
  return (
    localizedText(value.categoryName ?? value.name ?? value.label ?? value.title) ??
    asString(value.breadcrumb) ??
    asString(value.path)
  );
}

function normalizeAdminImageUrl(value: string | undefined) {
  if (!value) {
    return null;
  }

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("/") ||
    value.startsWith("blob:") ||
    value.startsWith("data:image/")
  ) {
    return value;
  }

  return null;
}

function mediaAssetIdFromRecord(value: unknown) {
  const record = asRecord(value);
  return asString(record.mediaAssetId) ?? asString(record.idImage) ?? asString(record.id);
}

function nestedAmountMinor(value: unknown) {
  const record = asRecord(value);
  return (
    asNullableNumber(record.amountMinor) ??
    asNullableNumber(record.valueMinor) ??
    asNullableNumber(record.priceMinor) ??
    asNullableNumber(record.minor) ??
    asNullableNumber(record.cents)
  );
}

function bestImageUrl(value: unknown): string | null {
  const record = asRecord(value);
  const direct = normalizeAdminImageUrl(
    asString(record.url) ??
    asString(record.publicUrl) ??
    asString(record.public) ??
    asString(record.thumbnailUrl),
  );
  if (direct) {
    return direct;
  }

  const thumbnails = asRecord(asRecord(record.variations).generatedThumbnails);
  void thumbnails;
  const generated = asRecord(record.variations).generatedThumbnails;
  if (Array.isArray(generated)) {
    const medium = generated.find((item) => asString(asRecord(item).type) === "medium_default") ?? generated[0];
    return normalizeAdminImageUrl(asString(asRecord(medium).publicUrl));
  }

  return null;
}

function imageAlt(value: unknown, locale = "es-ES") {
  const record = asRecord(value);
  const metadata = asRecord(record.metadata);
  const alt = asRecord(metadata.alt ?? record.alt);
  return localizedText(alt[locale] ?? record.alt ?? record.thumbnailAlt, locale) ?? asText(record.altText) ?? asText(record.fileName) ?? null;
}

function parseMediaItem(value: unknown, locale = "es-ES", index = 0) {
  const record = asRecord(value);
  const mediaAssetId =
    mediaAssetIdFromRecord(record) ??
    `media-${index}`;
  const metadata = asRecord(record.metadata);
  const alt = asRecord(metadata.alt ?? record.alt);
  const title = asRecord(metadata.title ?? record.title);

  return {
    localId: mediaAssetId,
    mediaAssetId,
    fileName: asText(record.fileName) ?? asText(record.name) ?? `Imagen ${index + 1}`,
    fileSize: asNumber(record.bytes ?? record.fileSize, 0),
    mimeType: asString(record.mimeType) ?? "image/*",
    previewUrl: bestImageUrl(record) ?? undefined,
    isMain: asBoolean(record.cover ?? record.isMain, index === 0),
    active: asBoolean(record.isActive, true),
    alt: {
      [locale]: localizedText(alt[locale] ?? record.alt, locale) ?? asText(record.altText) ?? "",
    },
    title: {
      [locale]: localizedText(title[locale] ?? record.title, locale) ?? asText(record.titleText) ?? "",
    },
    persisted: true,
  };
}

function parseProduct(value: unknown): ProductSummary {
  const record = asRecord(value);
  const productId = asString(record.productId) ?? asString(record.id) ?? "";
  const images = listItems(record.images);
  const description = asRecord(record.description);
  const category = asRecord(record.category);
  const primaryCategory = asRecord(
    record.primaryCategory ??
      record.defaultCategory ??
      record.mainCategory,
  );
  const firstCategory = firstCategoryRecord(record.categories);
  const brand = asRecord(record.brand);
  const defaultVariant = asRecord(record.defaultVariant);
  const productPrice = productListPrice(record);
  const quantity = productListQuantity(record);
  const priceTaxExcludedMinor =
    asOptionalNumber(record.priceTaxExcludedMinor) ??
    asOptionalNumber(record.priceExcludingTaxMinor) ??
    asOptionalNumber(record.priceExclTaxMinor) ??
    asOptionalNumber(record.taxExcludedPriceMinor) ??
    nestedAmountMinor(record.priceTaxExcluded) ??
    nestedAmountMinor(record.priceExcludingTax) ??
    nestedAmountMinor(record.priceExclTax) ??
    nestedAmountMinor(record.taxExcludedPrice) ??
    (!productPrice?.taxIncluded ? productPrice?.basePriceMinor : undefined) ??
    asOptionalNumber(record.basePriceMinor);
  const priceTaxIncludedMinor =
    asOptionalNumber(record.priceTaxIncludedMinor) ??
    asOptionalNumber(record.priceIncludingTaxMinor) ??
    asOptionalNumber(record.priceInclTaxMinor) ??
    asOptionalNumber(record.taxIncludedPriceMinor) ??
    nestedAmountMinor(record.priceTaxIncluded) ??
    nestedAmountMinor(record.priceIncludingTax) ??
    nestedAmountMinor(record.priceInclTax) ??
    nestedAmountMinor(record.taxIncludedPrice) ??
    (productPrice?.taxIncluded ? productPrice.basePriceMinor : undefined);
  const priceTaxExcludedDisplay = displayPriceText(
    record.priceTaxExcludedDisplay,
    record.priceTaxExcludedFormatted,
    record.priceExcludingTaxDisplay,
    record.priceExcludingTaxFormatted,
    record.priceExclTaxDisplay,
    record.priceExclTaxFormatted,
    record.taxExcludedPriceDisplay,
    record.taxExcludedPriceFormatted,
    record.priceTaxExcluded,
    record.priceExcludingTax,
    record.priceExclTax,
    record.taxExcludedPrice,
  );
  const priceTaxIncludedDisplay = displayPriceText(
    record.priceTaxIncludedDisplay,
    record.priceTaxIncludedFormatted,
    record.priceIncludingTaxDisplay,
    record.priceIncludingTaxFormatted,
    record.priceInclTaxDisplay,
    record.priceInclTaxFormatted,
    record.taxIncludedPriceDisplay,
    record.taxIncludedPriceFormatted,
    record.priceDisplay,
    record.priceFormatted,
    record.formattedPrice,
    record.priceTaxIncluded,
    record.priceIncludingTax,
    record.priceInclTax,
    record.taxIncludedPrice,
    record.price,
  );
  const thumbnailUrl =
    normalizeAdminImageUrl(asString(record.thumbnailUrl)) ??
    bestImageUrl(images[0]) ??
    null;
  const thumbnailAlt =
    asText(record.thumbnailAlt) ??
    imageAlt(images[0]) ??
    null;

  return {
    productId,
    name: localizedText(record.name) ?? "Producto sin nombre",
    slug: asString(record.slug) ?? productId,
    reference: asString(record.reference) ?? asString(record.refId) ?? asString(record.sku) ?? asString(defaultVariant.refId),
    isActive: productStatusIsActive(record),
    isVisible: asBoolean(record.isVisible, true),
    mediaCollectionId: asNullableString(record.mediaCollectionId),
    mediaCount: asNumber(record.mediaCount, images.length),
    defaultVariantId:
      asString(record.defaultVariantId) ??
      asString(defaultVariant.variantId) ??
      asString(defaultVariant.id),
    thumbnailUrl,
    thumbnailAlt,
    categoryId:
      asString(record.categoryId) ??
      firstStringItem(record.categoryIds) ??
      categoryIdFromRecord(category) ??
      categoryIdFromRecord(primaryCategory) ??
      categoryIdFromRecord(firstCategory),
    categoryName:
      localizedText(record.categoryName ?? record.primaryCategoryName ?? record.defaultCategoryName ?? record.mainCategoryName) ??
      categoryNameFromRecord(category) ??
      categoryNameFromRecord(primaryCategory) ??
      categoryNameFromRecord(firstCategory),
    brandId: asString(record.brandId),
    brandName: localizedText(record.brandName ?? brand.name),
    priceTaxExcludedMinor,
    priceTaxIncludedMinor,
    priceTaxExcludedDisplay,
    priceTaxIncludedDisplay,
    currency: asString(record.currency) ?? productPrice?.currency,
    quantity,
    shortDescription: localizedRichText(record.shortDescription ?? description.summary),
    description: localizedRichText(description.body ?? record.description),
    keywords: localizedText(record.keywords),
    metaTitle: localizedText(record.title ?? record.metaTitle),
    metaDescription: localizedText(record.metaTagDescription ?? record.metaDescription),
    taxCode: asString(record.taxCode),
    updatedAt: asString(record.updatedAt),
  };
}

function parseProductList(value: unknown): { items: ProductSummary[]; total: number } {
  const record = asRecord(value);
  const items = listItems(value)
    .map(parseProduct)
    .filter((product) => product.productId);

  return {
    items,
    total: asNumber(record.total ?? record.count, items.length),
  };
}

function parseFirstProductPrice(value: unknown): PriceDraft | undefined {
  const record = asRecord(value);
  const direct =
    parsePrice(record.product ?? record.productPrice ?? value) ??
    firstActivePrice(record.productPrices);

  if (direct) {
    return direct;
  }

  const rawItems = listItems(record.items ?? record.prices ?? record.data ?? value);
  return rawItems
    .map((item) => ({ item, price: parsePrice(item) }))
    .find(({ item, price }) => Boolean(price && (priceTargetType(item) === "PRODUCT" || !priceVariantId(item))))
    ?.price;
}

function parsePrice(value: unknown): PriceDraft | undefined {
  const record = asRecord(value);
  const pricingId = asString(record.pricingId) ?? asString(record.id);
  const basePriceMinor =
    asNullableNumber(record.basePriceMinor) ??
    asNullableNumber(record.priceMinor) ??
    asNullableNumber(record.unitPriceMinor) ??
    asNullableNumber(record.amountMinor) ??
    nestedAmountMinor(record.basePrice) ??
    nestedAmountMinor(record.fixedPrice) ??
    nestedAmountMinor(record.price) ??
    nestedAmountMinor(record.amount) ??
    nestedAmountMinor(record.value);

  if (basePriceMinor === null) {
    return undefined;
  }

  return {
    pricingId,
    basePriceMinor,
    listPriceMinor:
      asNullableNumber(record.listPriceMinor) ??
      asNullableNumber(record.compareAtPriceMinor) ??
      nestedAmountMinor(record.listPrice),
    costPriceMinor: asNullableNumber(record.costPriceMinor) ?? nestedAmountMinor(record.costPrice),
    currency:
      asString(record.currency) ??
      asString(asRecord(record.basePrice).currency) ??
      asString(asRecord(record.price).currency) ??
      asString(asRecord(record.amount).currency) ??
      "EUR",
    taxIncluded: asBoolean(record.taxIncluded, true),
    taxCode: asString(record.taxCode) ?? asString(asRecord(record.tax).taxCode),
    priceTableId: asString(record.priceTableId) ?? null,
    tradePolicy: asString(record.tradePolicy),
    channel: asString(record.channel),
    customerGroup: asString(record.customerGroup) ?? null,
    country: asString(record.country),
    source: asString(record.source),
  };
}

function firstParsedPrice(...values: unknown[]) {
  for (const value of values) {
    const price = parsePrice(value);
    if (price) {
      return price;
    }

    const listPrice = listItems(value).map(parsePrice).find((item): item is PriceDraft => Boolean(item));
    if (listPrice) {
      return listPrice;
    }
  }

  return undefined;
}

function productListPrice(record: Record<string, unknown>) {
  const pricing = asRecord(record.pricing);
  const prices = asRecord(record.prices);
  const priceLists = [
    prices.product,
    prices.productPrice,
    prices.productPrices,
    prices.items,
    record.priceList,
    record.prices,
  ];

  return firstParsedPrice(
    record.productPrice,
    record.basePrice,
    record.currentPrice,
    record.unitPrice,
    record.price,
    pricing.product,
    pricing.productPrice,
    pricing.productPrices,
    pricing.basePrice,
    pricing.currentPrice,
    ...priceLists,
  );
}

function displayPriceText(...values: unknown[]) {
  return values.map(asText).find(Boolean);
}

function quantityFromRecord(value: unknown): number | undefined {
  const record = asRecord(value);
  const onHandQuantity = asOptionalNumber(record.onHandQuantity);
  const reservedQuantity = asOptionalNumber(record.reservedQuantity) ?? 0;
  const safetyStockQuantity = asOptionalNumber(record.safetyStockQuantity) ?? 0;

  return (
    asOptionalNumber(record.quantity) ??
    asOptionalNumber(record.stockQuantity) ??
    asOptionalNumber(record.availableQuantity) ??
    asOptionalNumber(record.sellableQuantity) ??
    asOptionalNumber(record.availableToSell) ??
    (typeof onHandQuantity === "number"
      ? Math.max(0, onHandQuantity - reservedQuantity - safetyStockQuantity)
      : undefined)
  );
}

function productListQuantity(record: Record<string, unknown>): number | undefined {
  const stock = asRecord(record.stock ?? record.inventory ?? record.availability);
  const nested = quantityFromRecord(stock);
  if (typeof nested === "number") {
    return nested;
  }

  const stockItems = listItems(stock.items ?? stock.stockLevels ?? stock.levels);
  if (stockItems.length > 0) {
    return stockItems.reduce<number>((total, item) => total + (quantityFromRecord(item) ?? 0), 0);
  }

  return quantityFromRecord(record);
}

function parseStock(value: unknown, fallbackWarehouseId = "main-warehouse"): StockDraft {
  const record = asRecord(value);
  const onHandQuantity = asNumber(record.onHandQuantity ?? record.availableQuantity);
  const reservedQuantity = asNumber(record.reservedQuantity);
  const safetyStockQuantity = asNumber(record.safetyStockQuantity);
  const availableQuantity =
    asNullableNumber(record.availableQuantity) ??
    Math.max(0, onHandQuantity - reservedQuantity - safetyStockQuantity);

  return {
    warehouseId: asString(record.warehouseId) ?? fallbackWarehouseId,
    onHandQuantity,
    reservedQuantity,
    safetyStockQuantity,
    availableQuantity,
    available: asBoolean(record.available, availableQuantity > 0),
    reasons: listItems(record.reasons).map(String),
  };
}

function firstActivePrice(value: unknown): PriceDraft | undefined {
  return listItems(value)
    .map(parsePrice)
    .find((price): price is PriceDraft => Boolean(price && !price.markedForDeletion));
}

function parseVariantOption(value: unknown) {
  const record = asRecord(value);
  return {
    variantOptionId: asString(record.variantOptionId) ?? asString(record.id),
    attributeCode: asString(record.attributeCode) ?? "",
    valueCode: asString(record.valueCode) ?? "",
    isActive: productStatusIsActive(record, true),
  };
}

function parseVariantOptions(value: unknown) {
  return listItems(value)
    .map(parseVariantOption)
    .filter((option) => option.attributeCode && option.valueCode && option.isActive);
}

function parseVariant(value: unknown): ProductVariantRecord {
  const record = asRecord(value);
  const variantId = asString(record.variantId) ?? asString(record.id) ?? "";

  return {
    variantId,
    name: localizedText(record.name) ?? asString(record.refId) ?? "Variante",
    refId: asString(record.refId) ?? variantId,
    ean: asString(record.ean) ?? null,
    isActive: productStatusIsActive(record, true),
    isVisible: asBoolean(record.isVisible, true),
    isDefault: asBoolean(record.isDefault) || asBoolean(record.default),
    options: parseVariantOptions(record.options),
  };
}

function parseVariantList(value: unknown): ProductVariantRecord[] {
  return listItems(value)
    .map(parseVariant)
    .filter((variant) => variant.variantId);
}

function parseDefaultVariantId(value: unknown): string | undefined {
  const variants = parseVariantList(value);
  return (
    variants.find((variant) => variant.isDefault)?.variantId ??
    variants[0]?.variantId
  );
}

function parseOffering(value: unknown): ProductOfferingRecord {
  const record = asRecord(value);
  const offeringId = asString(record.offeringId) ?? asString(record.id) ?? "";
  const localizedName = Array.isArray(record.localizedName)
    ? record.localizedName
        .map((item) => {
          const itemRecord = asRecord(item);
          const locale = asString(itemRecord.locale);
          const value = asString(itemRecord.value);
          return locale && value ? { locale, value } : null;
        })
        .filter((item): item is { locale: string; value: string } => Boolean(item))
    : [];
  const name = asText(record.name) ?? localizedName[0]?.value ?? offeringId;

  return {
    offeringId,
    name,
    localizedName,
    priceMinor: asNumber(record.priceMinor),
    currency: asString(record.currency) ?? "EUR",
    type: asString(record.type) ?? "service",
    active: asBoolean(record.active, true),
  };
}

function parseOfferingList(value: unknown): ProductOfferingRecord[] {
  return listItems(asRecord(value).offerings ?? value)
    .map(parseOffering)
    .filter((offering) => offering.offeringId);
}

function parseOfferingBatch(value: unknown): Record<string, ProductOfferingRecord[]> {
  const byVariant: Record<string, ProductOfferingRecord[]> = {};

  for (const item of listItems(asRecord(value).variants)) {
    const record = asRecord(item);
    const variantId = asString(record.variantId);
    if (variantId) {
      byVariant[variantId] = parseOfferingList(record.offerings);
    }
  }

  return byVariant;
}

function parseMediaCollection(value: unknown) {
  const collection = asRecord(asRecord(value).collection ?? value);
  const items = listItems(collection.items ?? []);
  const mediaAssetIds = items
    .map(mediaAssetIdFromRecord)
    .filter((id): id is string => Boolean(id));

  return {
    mediaCollectionId: asString(collection.mediaCollectionId) ?? asString(collection.id) ?? null,
    mediaAssetIds,
  };
}

function listVariantMediaItems(variantMedia: unknown, variantId: string) {
  const record = asRecord(variantMedia);
  const direct = record[variantId];
  if (direct) {
    return listItems(asRecord(direct).items ?? direct);
  }

  return listItems(variantMedia).flatMap((item) => {
    const itemRecord = asRecord(item);
    const itemVariantId = asString(itemRecord.variantId) ?? asString(itemRecord.productVariantId);
    if (itemVariantId !== variantId) {
      return [];
    }

    return listItems(itemRecord.items).length ? listItems(itemRecord.items) : [item];
  });
}

function priceTargetType(value: unknown) {
  return asString(asRecord(value).targetType)?.toUpperCase();
}

function priceVariantId(value: unknown) {
  const record = asRecord(value);
  return asString(record.variantId) ?? asString(record.productVariantId) ?? asString(record.targetId);
}

function parseEditorState(value: unknown, locale: string, currency: string): ProductEditorData {
  const record = asRecord(value);
  const product = parseProduct(record.product);
  const variants = listItems(record.variants).map(parseVariant).filter((variant) => variant.variantId);
  const variantOptions = asRecord(record.variantOptions);
  const variantMedia = record.variantMedia;
  const mediaCollection = asRecord(record.mediaCollection);
  const collection = asRecord(mediaCollection.collection ?? mediaCollection);
  const rawMediaItems = listItems(collection.items).length
    ? listItems(collection.items)
    : listItems(record.mediaItems).length
      ? listItems(record.mediaItems)
      : listItems(asRecord(record.product).images);
  const mediaItems = rawMediaItems.map((item, index) => parseMediaItem(item, locale, index));
  const mediaByAssetId = new Map(mediaItems.map((item) => [item.mediaAssetId, item.localId]));
  const mediaAssignments: Record<string, string[]> = {};
  const mediaMainByVariant: Record<string, string> = {};

  for (const variant of variants) {
    const mediaList = listVariantMediaItems(variantMedia, variant.variantId);
    const assignedIds = mediaList
      .map((item) => {
        const mediaAssetId = mediaAssetIdFromRecord(item);
        return mediaAssetId ? mediaByAssetId.get(mediaAssetId) ?? mediaAssetId : undefined;
      })
      .filter((id): id is string => Boolean(id));

    if (assignedIds.length > 0) {
      mediaAssignments[variant.variantId] = assignedIds;
    }

    const mainItem = mediaList.find((item) => asBoolean(asRecord(item).isMain));
    const mainAssetId = asString(asRecord(mainItem).mediaAssetId);
    if (mainAssetId) {
      mediaMainByVariant[variant.variantId] = mediaByAssetId.get(mainAssetId) ?? mainAssetId;
    }

    const options = parseVariantOptions(variantOptions[variant.variantId]);
    if (options.length > 0) {
      variant.options = options;
    }
  }

  const prices = asRecord(record.prices);
  const allPrices = listItems(prices.items).length
    ? listItems(prices.items)
    : Array.isArray(record.prices)
      ? listItems(record.prices)
      : [];
  const productPrice =
    firstActivePrice(prices.product ?? prices.productPrices) ??
    allPrices.map(parsePrice).find((price, index) => {
      const raw = allPrices[index];
      return Boolean(price && (priceTargetType(raw) === "PRODUCT" || !priceVariantId(raw)));
    });
  const variantPrices: Record<string, PriceDraft> = {};
  const rawVariantPrices = listItems(prices.variants).length
    ? listItems(prices.variants)
    : allPrices.filter((priceValue) => priceTargetType(priceValue) === "VARIANT" || Boolean(priceVariantId(priceValue)));
  for (const priceValue of rawVariantPrices) {
    const priceRecord = asRecord(priceValue);
    const variantId = priceVariantId(priceRecord);
    const price = parsePrice(priceValue);
    if (variantId && price) {
      variantPrices[variantId] = {
        ...price,
        currency: price.currency || currency,
      };
    }
  }

  const stockByVariant: Record<string, StockDraft> = {};
  for (const item of listItems(asRecord(record.availability).items)) {
    const itemRecord = asRecord(item);
    const variantId = asString(itemRecord.variantId);
    if (variantId) {
      stockByVariant[variantId] = parseStock(itemRecord);
    }
  }

  const mainMedia = mediaItems.find((item) => item.isMain) ?? mediaItems[0];
  return {
    product: {
      ...product,
      mediaCollectionId: asString(collection.mediaCollectionId) ?? product.mediaCollectionId,
      mediaCount: product.mediaCount ?? mediaItems.length,
      thumbnailUrl: product.thumbnailUrl ?? mainMedia?.previewUrl ?? null,
      thumbnailAlt: product.thumbnailAlt ?? (mainMedia ? imageAlt(mainMedia, locale) : null),
    },
    variants,
    mediaItems,
    mediaAssignments,
    mediaMainByVariant,
    productPrice: productPrice ? { ...productPrice, currency: productPrice.currency || currency } : undefined,
    variantPrices,
    offeringsByVariant: {},
    stockByVariant,
    warnings: listItems(record.warnings).map(String),
    correlationIds: [],
  };
}

function makeScopedParams(context: AdminContext, extra?: Record<string, string>) {
  const params = new URLSearchParams(extra);

  if (context.organizationId) {
    params.set("organizationId", context.organizationId);
  }
  if (context.shopId) {
    params.set("shopId", context.shopId);
  }

  return params;
}

function productHasDisplayablePrice(product: ProductSummary) {
  return Boolean(
    typeof product.priceTaxExcludedMinor === "number" ||
      typeof product.priceTaxIncludedMinor === "number" ||
      product.priceTaxExcludedDisplay ||
      product.priceTaxIncludedDisplay,
  );
}

function applyProductPrice(product: ProductSummary, price: PriceDraft | undefined): ProductSummary {
  if (!price) {
    return product;
  }

  return {
    ...product,
    priceTaxExcludedMinor:
      product.priceTaxExcludedMinor ??
      (!price.taxIncluded ? price.basePriceMinor : undefined),
    priceTaxIncludedMinor:
      product.priceTaxIncludedMinor ??
      (price.taxIncluded ? price.basePriceMinor : undefined),
    currency: product.currency ?? price.currency,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function getProductListPrice(context: AdminContext, productId: string): Promise<PriceDraft | undefined> {
  const params = makeScopedParams(context, {
    targetType: "PRODUCT",
    productId,
    active: "true",
    currency: context.currency ?? "EUR",
  });
  const result = await requestBff(`/admin/prices?${params.toString()}`, {
    context,
    parse: parseFirstProductPrice,
  });

  return result.ok ? result.data : undefined;
}

async function enrichProductsWithPricing(context: AdminContext, products: ProductSummary[]) {
  return mapWithConcurrency(
    products,
    8,
    async (product) => {
      if (productHasDisplayablePrice(product)) {
        return product;
      }

      return applyProductPrice(product, await getProductListPrice(context, product.productId));
    },
  );
}

function parseAvailabilityBatch(value: unknown): Record<string, StockDraft> {
  const record = asRecord(value);
  const items = listItems(record.items ?? record.availability ?? record.results ?? value);
  const byVariant: Record<string, StockDraft> = {};

  for (const item of items) {
    const itemRecord = asRecord(item);
    const variantId = asString(itemRecord.variantId) ?? asString(itemRecord.productVariantId);
    if (variantId) {
      byVariant[variantId] = parseStock(itemRecord);
    }
  }

  return byVariant;
}

function productHasQuantity(product: ProductSummary) {
  return typeof product.quantity === "number";
}

async function getProductListAvailabilityBatch(context: AdminContext, variantIds: string[]) {
  if (variantIds.length === 0) {
    return {};
  }

  const params = makeScopedParams(context);
  const result = await requestBff(`/admin/inventory/availability/resolve-batch?${params.toString()}`, {
    context,
    init: {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        organizationId: context.organizationId,
        shopId: context.shopId,
        items: variantIds.map((variantId) => ({
          variantId,
          warehouseId: "main-warehouse",
        })),
      }),
    },
    parse: parseAvailabilityBatch,
  });

  return result.ok ? result.data : {};
}

async function getProductListDefaultVariantId(context: AdminContext, productId: string) {
  const params = makeScopedParams(context);
  const result = await requestBff(`/admin/products/${encodeURIComponent(productId)}/variants?${params.toString()}`, {
    context,
    parse: parseDefaultVariantId,
  });

  return result.ok ? result.data : undefined;
}

async function enrichProductsWithDefaultVariantIds(context: AdminContext, products: ProductSummary[]) {
  return mapWithConcurrency(
    products,
    8,
    async (product) => {
      if (productHasQuantity(product) || product.defaultVariantId) {
        return product;
      }

      return {
        ...product,
        defaultVariantId: await getProductListDefaultVariantId(context, product.productId),
      };
    },
  );
}

async function enrichProductsWithAvailability(context: AdminContext, products: ProductSummary[]) {
  const productsWithVariants = await enrichProductsWithDefaultVariantIds(context, products);
  const variantIds = Array.from(new Set(
    productsWithVariants
      .filter((product) => !productHasQuantity(product))
      .map((product) => product.defaultVariantId)
      .filter((variantId): variantId is string => Boolean(variantId)),
  ));
  const stockByVariant = await getProductListAvailabilityBatch(context, variantIds);

  return productsWithVariants.map((product) => {
    if (productHasQuantity(product) || !product.defaultVariantId) {
      return product;
    }

    const stock = stockByVariant[product.defaultVariantId];
    return {
      ...product,
      quantity: stock?.availableQuantity,
    };
  });
}

export async function getAdminProducts(
  context: AdminContext,
  options: ProductListFilters = {},
): Promise<ProductListResult> {
  const limit = options.limit ?? 25;
  const offset = options.offset ?? 0;
  const params = makeScopedParams(context, {
    limit: String(limit),
    offset: String(offset),
  });

  if (options.q?.trim()) {
    params.set("q", options.q.trim());
  }
  if (options.categoryId?.trim()) {
    params.set("categoryId", options.categoryId.trim());
  }
  if (typeof options.isActive === "boolean") {
    params.set("isActive", String(options.isActive));
  }

  const endpoint = `/admin/products?${params.toString()}`;
  const result = await requestBff(endpoint, {
    context,
    parse: parseProductList,
  });

  if (!result.ok) {
    return {
      items: [],
      total: 0,
      limit,
      offset,
      filters: { ...options, limit, offset },
      source: "unavailable",
      message: result.error,
      failedEndpoint: endpoint,
      correlationId: result.correlationId,
    };
  }

  const pricedItems = await enrichProductsWithPricing(context, result.data.items);
  const items = await enrichProductsWithAvailability(context, pricedItems);

  return {
    ...result.data,
    items,
    limit,
    offset,
    filters: { ...options, limit, offset },
    source: "bff",
    correlationId: result.correlationId,
  };
}

export async function getAdminProductEditorData(context: AdminContext, productId: string) {
  const params = makeScopedParams(context, {
    locale: context.locale,
    currency: context.currency,
    warehouseId: "main-warehouse",
  });
  const endpoint = `/admin/products/${encodeURIComponent(productId)}/editor-state?${params.toString()}`;
  const editorState = await requestBff(endpoint, {
    context,
    parse: (value) => parseEditorState(value, context.locale, context.currency),
  });

  if (!editorState.ok) {
    return {
      ok: false as const,
      error: editorState.error,
      correlationId: editorState.correlationId,
    };
  }

  const variantIds = editorState.data.variants.map((variant) => variant.variantId).filter(Boolean);
  const offeringsResult = variantIds.length > 0
    ? await makeProductGateway(context).resolveOfferingsBatchByVariants(variantIds)
    : { ok: true as const, data: {}, status: 200, correlationId: undefined };
  const warnings = [...editorState.data.warnings];
  if (!offeringsResult.ok) {
    warnings.push(`Offerings: contrato BFF no disponible o sin permisos (${offeringsResult.error}).`);
  }

  return {
    ok: true as const,
    data: {
      ...editorState.data,
      offeringsByVariant: offeringsResult.ok ? offeringsResult.data : {},
      warnings,
      correlationIds: [editorState.correlationId, offeringsResult.correlationId].filter(isString),
    },
  };
}

export async function getProductEditorLookups(context: AdminContext): Promise<ProductEditorLookups> {
  const [categoriesResult, brandsResult, pricingLookups] = await Promise.all([
    listCatalogEntities(context, "categories", { limit: 100, offset: 0, isActive: true }),
    listCatalogEntities(context, "brands", { limit: 100, offset: 0, isActive: true }),
    getPricingEditorLookups(context),
  ]);
  const warnings: string[] = [];

  if (categoriesResult.source === "unavailable") {
    warnings.push(`Categorias: contrato BFF no disponible o sin permisos (${categoriesResult.message}).`);
  }
  if (brandsResult.source === "unavailable") {
    warnings.push(`Marcas: contrato BFF no disponible o sin permisos (${brandsResult.message}).`);
  }

  return {
    categories: toLookupOptions(categoriesResult),
    brands: toLookupOptions(brandsResult),
    taxes: pricingLookups.taxes,
    priceTables: pricingLookups.priceTables,
    warnings: [...warnings, ...pricingLookups.warnings],
  };
}

export function makeProductGateway(context: AdminContext): ProductGateway {
  const scopedPath = (path: string, extra?: Record<string, string>) => {
    const separator = path.includes("?") ? "&" : "?";
    const params = makeScopedParams(context, extra);
    const query = params.toString();
    return query ? `${path}${separator}${query}` : path;
  };

  const pricePayload = (
    price: PriceDraft,
    target: { targetType: "PRODUCT" | "VARIANT"; productId: string; variantId?: string | null },
  ) => ({
    organizationId: context.organizationId,
    shopId: context.shopId,
    targetType: target.targetType,
    productId: target.productId,
    variantId: target.variantId ?? null,
    priceTableId: price.priceTableId ?? null,
    tradePolicy: price.tradePolicy || "default",
    channel: price.channel || context.channel || "web",
    customerGroup: price.customerGroup ?? null,
    country: price.country || context.country || "ES",
    currency: price.currency || context.currency || "EUR",
    timezone: "Europe/Madrid",
    basePriceMinor: price.basePriceMinor,
    listPriceMinor: price.listPriceMinor ?? null,
    costPriceMinor: price.costPriceMinor ?? null,
    fixedPriceMinor: null,
    tiers: null,
    taxIncluded: price.taxIncluded,
    tax: price.taxCode ? { taxCode: price.taxCode } : null,
    active: true,
    priority: 10,
    source: price.source || "BASE",
  });
  const scopedJsonBody = <T extends object>(payload: T) => ({
    ...payload,
    organizationId: context.organizationId,
    shopId: context.shopId,
  });

  return {
    createProduct(payload: ProductCatalogCreatePayload) {
      return requestBff(scopedPath("/admin/products"), {
        context,
        init: {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(scopedJsonBody(payload)),
        },
        parse: parseProduct,
      });
    },
    updateProduct(productId: string, payload: ProductCatalogUpdatePayload) {
      return requestBff(scopedPath(`/admin/products/${encodeURIComponent(productId)}`), {
        context,
        init: {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(scopedJsonBody(payload)),
        },
        parse: parseProduct,
      });
    },
    getProduct(productId: string) {
      return requestBff(scopedPath(`/admin/products/${encodeURIComponent(productId)}`), {
        context,
        parse: parseProduct,
      });
    },
    listVariants(productId: string) {
      return requestBff(scopedPath(`/admin/products/${encodeURIComponent(productId)}/variants`, {
        limit: "100",
        offset: "0",
      }), {
        context,
        parse: parseVariantList,
      });
    },
    createVariant(productId: string, payload: ProductVariantCreatePayload) {
      return requestBff(scopedPath(`/admin/products/${encodeURIComponent(productId)}/variants`), {
        context,
        init: {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(scopedJsonBody(payload)),
        },
        parse: parseVariant,
      });
    },
    updateVariant(variantId: string, payload: ProductVariantUpdatePayload) {
      return requestBff(scopedPath(`/admin/variants/${encodeURIComponent(variantId)}`), {
        context,
        init: {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(scopedJsonBody(payload)),
        },
        parse: parseVariant,
      });
    },
    deleteVariant(variantId: string) {
      return requestBff(scopedPath(`/admin/variants/${encodeURIComponent(variantId)}`, { mode: "soft" }), {
        context,
        init: {
          method: "DELETE",
        },
        parse: (value) => asRecord(value) as { deleted?: boolean },
      });
    },
    createVariantOption(variantId: string, payload: ProductVariantOptionPayload) {
      return requestBff(scopedPath(`/admin/variants/${encodeURIComponent(variantId)}/options`), {
        context,
        init: {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(scopedJsonBody(payload)),
        },
        parse: parseVariantOption,
      });
    },
    updateVariantOption(variantId: string, variantOptionId: string, payload: ProductVariantOptionPayload) {
      return requestBff(scopedPath(`/admin/variants/${encodeURIComponent(variantId)}/options/${encodeURIComponent(variantOptionId)}`), {
        context,
        init: {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(scopedJsonBody(payload)),
        },
        parse: parseVariantOption,
      });
    },
    deleteVariantOption(variantId: string, variantOptionId: string) {
      return requestBff(scopedPath(`/admin/variants/${encodeURIComponent(variantId)}/options/${encodeURIComponent(variantOptionId)}`, { mode: "soft" }), {
        context,
        init: {
          method: "DELETE",
        },
        parse: (value) => asRecord(value) as { deleted?: boolean; variantOptionId?: string },
      });
    },
    createMediaCollection(input) {
      const formData = new FormData();
      for (const file of input.files) {
        formData.append("files", file);
      }
      formData.set("organizationId", context.organizationId);
      formData.set("shopId", input.shopId);
      formData.set("productId", input.productId);
      formData.set("title", input.title);
      formData.set("defaultLocale", input.defaultLocale);
      formData.set("metadata", JSON.stringify(input.metadata.map(({ isMain, alt, title }) => ({ isMain, alt, title }))));

      return requestBff(scopedPath("/admin/media/collections"), {
        context,
        init: {
          method: "POST",
          body: formData,
        },
        parse: parseMediaCollection,
      });
    },
    appendMediaItems(input) {
      const formData = new FormData();
      for (const file of input.files) {
        formData.append("files", file);
      }
      formData.set("organizationId", context.organizationId);
      formData.set("shopId", context.shopId);
      formData.set("defaultLocale", input.defaultLocale);
      formData.set("metadata", JSON.stringify(input.metadata.map(({ isMain, alt, title }) => ({ isMain, alt, title }))));

      return requestBff(scopedPath(`/admin/media/collections/${encodeURIComponent(input.mediaCollectionId)}/items`), {
        context,
        init: {
          method: "POST",
          body: formData,
        },
        parse: parseMediaCollection,
      });
    },
    assignVariantMedia(input) {
      return requestBff(scopedPath(`/admin/variants/${encodeURIComponent(input.variantId)}/media/bulk`), {
        context,
        init: {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(scopedJsonBody({
            mediaAssetIds: input.mediaAssetIds,
            mainMediaAssetId: input.mainMediaAssetId,
            status: "active",
          })),
        },
        parse: () => ({ assigned: true }),
      });
    },
    clearVariantMedia(input) {
      return requestBff(scopedPath(`/admin/variants/${encodeURIComponent(input.variantId)}/media`), {
        context,
        init: {
          method: "DELETE",
        },
        parse: (value) => asRecord(value) as { cleared?: number },
      });
    },
    setVariantMainMedia(input) {
      return requestBff(scopedPath(`/admin/variants/${encodeURIComponent(input.variantId)}/media/main`), {
        context,
        init: {
          method: "PUT",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(scopedJsonBody({
            mediaAssetId: input.mediaAssetId,
            status: "active",
          })),
        },
        parse: () => ({ assigned: true }),
      });
    },
    createProductPrice(input: { productId: string; price: PriceDraft }) {
      return requestBff(scopedPath("/admin/prices"), {
        context,
        init: {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(pricePayload(input.price, {
            targetType: "PRODUCT",
            productId: input.productId,
          })),
        },
        parse: (value) => asRecord(value) as { pricingId?: string },
      });
    },
    updatePrice(input) {
      return requestBff(scopedPath(`/admin/prices/${encodeURIComponent(input.pricingId)}`), {
        context,
        init: {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            organizationId: context.organizationId,
            shopId: context.shopId,
            basePriceMinor: input.price.basePriceMinor,
            listPriceMinor: input.price.listPriceMinor ?? null,
            costPriceMinor: input.price.costPriceMinor ?? null,
            currency: input.price.currency || context.currency || "EUR",
            taxIncluded: input.price.taxIncluded,
            tax: input.price.taxCode ? { taxCode: input.price.taxCode } : null,
            taxCode: input.price.taxCode,
            priceTableId: input.price.priceTableId ?? null,
            tradePolicy: input.price.tradePolicy || "default",
            channel: input.price.channel || context.channel || "web",
            customerGroup: input.price.customerGroup ?? null,
            country: input.price.country || context.country || "ES",
            active: true,
          }),
        },
        parse: (value) => asRecord(value) as { pricingId?: string },
      });
    },
    deletePrice(input) {
      return requestBff(scopedPath(`/admin/prices/${encodeURIComponent(input.pricingId)}`, { mode: "soft" }), {
        context,
        init: {
          method: "DELETE",
        },
        parse: (value) => asRecord(value) as { deleted?: boolean },
      });
    },
    createVariantPrice(input) {
      return requestBff(scopedPath("/admin/prices"), {
        context,
        init: {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(pricePayload(input.price, {
            targetType: "VARIANT",
            productId: input.productId,
            variantId: input.variantId,
          })),
        },
        parse: (value) => asRecord(value) as { pricingId?: string },
      });
    },
    createOffering(payload: ProductOfferingCreatePayload) {
      return requestBff(scopedPath("/admin/offerings"), {
        context,
        init: {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
        },
        parse: (value) => {
          const record = asRecord(value);
          return {
            offering: parseOffering(record.offering),
            message: asString(record.message),
          };
        },
      });
    },
    attachOfferingToVariant(input) {
      return requestBff(scopedPath(`/admin/offerings/${encodeURIComponent(input.offeringId)}/variants/${encodeURIComponent(input.variantId)}`), {
        context,
        init: {
          method: "PUT",
        },
        parse: (value) => asRecord(value) as { offeringId: string; variantId: string; message?: string },
      });
    },
    detachOfferingFromVariant(input) {
      return requestBff(scopedPath(`/admin/offerings/${encodeURIComponent(input.offeringId)}/variants/${encodeURIComponent(input.variantId)}`), {
        context,
        init: {
          method: "DELETE",
        },
        parse: (value) => asRecord(value) as { offeringId: string; variantId: string; detached?: boolean; message?: string },
      });
    },
    setOfferingVariantActivation(input) {
      return requestBff(scopedPath(`/admin/offerings/${encodeURIComponent(input.offeringId)}/variants/${encodeURIComponent(input.variantId)}/activation`), {
        context,
        init: {
          method: "PUT",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ active: input.active }),
        },
        parse: (value) => asRecord(value) as { offeringId: string; variantId: string; active?: boolean; message?: string },
      });
    },
    listOfferingsByVariant(variantId: string) {
      return requestBff(scopedPath(`/admin/offerings/variants/${encodeURIComponent(variantId)}`, {
        locale: context.locale,
        includeInactive: "true",
      }), {
        context,
        parse: parseOfferingList,
      });
    },
    resolveOfferingsBatchByVariants(variantIds: string[]) {
      return requestBff(scopedPath("/admin/offerings/variants/resolve-batch", {
        locale: context.locale,
        includeInactive: "true",
      }), {
        context,
        init: {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ variantIds }),
        },
        parse: parseOfferingBatch,
      });
    },
    putStockLevel(input: { variantId: string; stock: StockDraft }) {
      const params = makeScopedParams(context);
      return requestBff(`/admin/inventory/stock-levels?${params.toString()}`, {
        context,
        init: {
          method: "PUT",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            organizationId: context.organizationId,
            shopId: context.shopId,
            variantId: input.variantId,
            warehouseId: input.stock.warehouseId,
            onHandQuantity: input.stock.onHandQuantity,
            reservedQuantity: input.stock.reservedQuantity,
            safetyStockQuantity: input.stock.safetyStockQuantity,
          }),
        },
        parse: (value) => ({
          ...parseStock(value, input.stock.warehouseId),
          updatedAt: asString(asRecord(value).updatedAt),
        }),
      });
    },
  };
}

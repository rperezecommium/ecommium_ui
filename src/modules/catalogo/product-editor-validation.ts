import type {
  ProductCatalogCreatePayload,
  ProductCatalogUpdatePayload,
  ProductDraft,
} from "./product-editor-types";
import { makeRefIdFromName, plainProductText, slugifyProductValue } from "./product-editor-draft";

export type ProductDraftValidation = {
  ok: boolean;
  fieldErrors: Record<string, string>;
};

export type ProductPublicationChecklistItem = {
  id: "media" | "price" | "stock";
  label: string;
  ok: boolean;
  message: string;
};

function cleanOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function activeMainMediaItems(draft: ProductDraft) {
  return draft.media.items.filter((item) => item.active && item.isMain);
}

function hasPublishableMainMedia(draft: ProductDraft) {
  return activeMainMediaItems(draft).some((item) => Boolean(item.mediaAssetId || item.persisted));
}

function hasPublishableBasePrice(draft: ProductDraft) {
  return Boolean(
    draft.pricing.productPrice &&
      draft.pricing.productPrice.basePriceMinor > 0 &&
      !draft.pricing.productPrice.markedForDeletion,
  );
}

function priceHasPositiveAmount(price: ProductDraft["pricing"]["productPrice"]) {
  return Boolean(price && price.basePriceMinor > 0 && !price.markedForDeletion);
}

function priceHasCompleteTax(price: ProductDraft["pricing"]["productPrice"]) {
  if (!price?.tax?.taxCode || !price.tax.calculationType) {
    return false;
  }

  if (price.tax.calculationType === "PERCENTAGE") {
    return typeof price.tax.rate === "number" && price.tax.rate >= 0 && price.tax.rate <= 1;
  }

  return Number.isInteger(price.tax.amountMinor);
}

function taxValidationMessage(price: ProductDraft["pricing"]["productPrice"]) {
  if (!price?.tax?.taxCode) {
    return "Selecciona una regla fiscal antes de guardar el precio.";
  }

  if (!price.tax.calculationType) {
    return "La regla fiscal necesita calculationType.";
  }

  if (price.tax.calculationType === "PERCENTAGE") {
    return "La regla fiscal porcentual necesita rate entre 0 y 1.";
  }

  return "La regla fiscal fija necesita amountMinor entero.";
}

function stockAvailableQuantity(stock: ProductDraft["inventory"]["stockByVariant"][string] | undefined) {
  if (!stock) {
    return 0;
  }

  return stock.availableQuantity ?? Math.max(0, stock.onHandQuantity - stock.reservedQuantity - stock.safetyStockQuantity);
}

function hasPublishableStock(draft: ProductDraft) {
  const defaultStockAvailable = stockAvailableQuantity(draft.inventory.stockByVariant.default) > 0;

  if (draft.mode !== "variants" || draft.variants.length === 0) {
    return defaultStockAvailable;
  }

  return draft.variants.some((variant) => {
    if (!variant.isActive || !variant.isVisible) {
      return false;
    }

    return stockAvailableQuantity(
      draft.inventory.stockByVariant[variant.variantId ?? ""] ??
        draft.inventory.stockByVariant[variant.localId],
    ) > 0;
  }) || defaultStockAvailable;
}

export function getProductPublicationChecklist(draft: ProductDraft): ProductPublicationChecklistItem[] {
  return [
    {
      id: "media",
      label: "Portada",
      ok: hasPublishableMainMedia(draft),
      message: "Falta una imagen principal guardada.",
    },
    {
      id: "price",
      label: "Precio base",
      ok: hasPublishableBasePrice(draft),
      message: "Falta un precio base mayor que cero.",
    },
    {
      id: "stock",
      label: "Stock minimo",
      ok: hasPublishableStock(draft),
      message: "Falta stock disponible en default o en una combinacion vendible.",
    },
  ];
}

export function validateProductPublicationReadiness(draft: ProductDraft): ProductDraftValidation {
  const fieldErrors: Record<string, string> = {};
  const missing = getProductPublicationChecklist(draft).filter((item) => !item.ok);

  if (missing.length > 0) {
    fieldErrors.publication = "No se puede activar todavia.";
    for (const item of missing) {
      fieldErrors[`publication:${item.id}`] = item.message;
    }
  }

  return {
    ok: missing.length === 0,
    fieldErrors,
  };
}

export function normalizeProductDraft(draft: ProductDraft): ProductDraft {
  const name = plainProductText(draft.basic.name);
  const slug = draft.basic.slug.trim() || slugifyProductValue(name);
  const refId = draft.defaultVariant.refId.trim() || makeRefIdFromName(name);
  const baseTaxCode = draft.basic.taxCode.trim() || "standard";
  const productPrice = draft.pricing.productPrice;
  const variantPrices = Object.fromEntries(
    Object.entries(draft.pricing.variantPrices).map(([variantKey, price]) => [
      variantKey,
      {
        ...price,
        currency: price.currency || productPrice?.currency || "EUR",
        taxIncluded: price.taxIncluded ?? productPrice?.taxIncluded ?? true,
        taxCode: price.tax?.taxCode ?? price.taxCode ?? productPrice?.tax?.taxCode ?? productPrice?.taxCode ?? baseTaxCode,
        tax: price.tax ?? productPrice?.tax ?? null,
        priceTableId: price.priceTableId ?? productPrice?.priceTableId ?? null,
        tradePolicy: price.tradePolicy ?? productPrice?.tradePolicy,
        channel: price.channel ?? productPrice?.channel,
        customerGroup: price.customerGroup ?? productPrice?.customerGroup ?? null,
        country: price.country ?? productPrice?.country,
      },
    ]),
  );

  return {
    ...draft,
    basic: {
      ...draft.basic,
      name,
      slug,
      categoryId: draft.basic.categoryId?.trim(),
      categoryName: draft.basic.categoryName?.trim(),
      brandId: draft.basic.brandId?.trim(),
      brandName: draft.basic.brandName?.trim(),
      shortDescription: draft.basic.shortDescription.trim(),
      description: draft.basic.description.trim(),
      keywords: draft.basic.keywords.trim(),
      metaTitle: draft.basic.metaTitle.trim(),
      metaDescription: draft.basic.metaDescription.trim(),
      taxCode: baseTaxCode,
    },
    defaultVariant: {
      ...draft.defaultVariant,
      refId,
      name: cleanOptional(draft.defaultVariant.name),
      ean: cleanOptional(draft.defaultVariant.ean ?? undefined) ?? null,
    },
    variants: draft.variants.map((variant) => ({
      ...variant,
      name: plainProductText(variant.name),
      refId: variant.refId.trim(),
      ean: cleanOptional(variant.ean ?? undefined) ?? null,
      options: variant.options.map((option) => ({
        variantOptionId: option.variantOptionId,
        attributeCode: option.attributeCode.trim(),
        valueCode: option.valueCode.trim(),
        isActive: option.isActive ?? true,
        createdInDraft: option.createdInDraft,
        markedForDeletion: option.markedForDeletion,
      })),
    })),
    pricing: {
      ...draft.pricing,
      variantPrices,
    },
  };
}

export function validateProductDraft(draft: ProductDraft): ProductDraftValidation {
  const normalized = normalizeProductDraft(draft);
  const fieldErrors: Record<string, string> = {};

  if (!normalized.basic.name) {
    fieldErrors.name = "El nombre es obligatorio.";
  }

  if (!normalized.basic.slug) {
    fieldErrors.slug = "El slug o URL amigable es obligatorio.";
  }

  if (!normalized.basic.categoryId) {
    fieldErrors.categoryId = "La categoria principal es obligatoria antes de guardar.";
  }

  if (!normalized.defaultVariant.refId) {
    fieldErrors.refId = "La referencia principal es obligatoria.";
  }

  const seenRefs = new Set<string>();
  for (const variant of normalized.variants) {
    if (!variant.refId) {
      fieldErrors[`variant:${variant.localId}:refId`] = "La referencia de variante es obligatoria.";
    }

    const refKey = variant.refId.toLowerCase();
    if (seenRefs.has(refKey) || refKey === normalized.defaultVariant.refId.toLowerCase()) {
      fieldErrors[`variant:${variant.localId}:refId`] = "La referencia debe ser unica dentro del producto.";
    }
    seenRefs.add(refKey);

    const editableOptions = variant.options.filter((option) => !option.markedForDeletion);
    const completeOptions = editableOptions.filter((option) => option.attributeCode && option.valueCode);
    const hasIncompleteOptions = editableOptions.some((option) => !option.attributeCode || !option.valueCode);
    const optionKey = completeOptions
      .map((option) => `${option.attributeCode}:${option.valueCode}`)
      .sort()
      .join("|");

    if (normalized.mode === "variants" && hasIncompleteOptions && !variant.variantId) {
      fieldErrors[`variant:${variant.localId}:options`] = "Completa atributo y valor en cada opcion de la variante.";
    } else if (normalized.mode === "variants" && !optionKey && !variant.variantId) {
      fieldErrors[`variant:${variant.localId}:options`] = "La variante necesita al menos una opcion comercial.";
    }
  }

  if (priceHasPositiveAmount(normalized.pricing.productPrice) && !priceHasCompleteTax(normalized.pricing.productPrice)) {
    fieldErrors["pricing.productPrice.tax"] = taxValidationMessage(normalized.pricing.productPrice);
  }

  for (const [variantKey, price] of Object.entries(normalized.pricing.variantPrices)) {
    if (priceHasPositiveAmount(price) && !priceHasCompleteTax(price)) {
      fieldErrors[`pricing.variantPrices:${variantKey}:tax`] = taxValidationMessage(price);
    }
  }

  return {
    ok: Object.keys(fieldErrors).length === 0,
    fieldErrors,
  };
}

export function toCreateProductPayload(draft: ProductDraft, locale: string): ProductCatalogCreatePayload {
  const normalized = normalizeProductDraft(draft);
  const title = normalized.basic.metaTitle || normalized.basic.name;

  return {
    locale,
    name: normalized.basic.name,
    slug: normalized.basic.slug,
    linkId: normalized.basic.slug,
    defaultVariant: {
      refId: normalized.defaultVariant.refId,
      ...(normalized.defaultVariant.name ? { name: normalized.defaultVariant.name } : {}),
      ...(normalized.defaultVariant.ean ? { ean: normalized.defaultVariant.ean } : {}),
    },
    ...(normalized.basic.categoryId ? { categoryId: normalized.basic.categoryId } : {}),
    ...(normalized.basic.brandId ? { brandId: normalized.basic.brandId } : {}),
    isVisible: normalized.basic.isVisible,
    isActive: false,
    ...(normalized.basic.shortDescription ? { shortDescription: normalized.basic.shortDescription } : {}),
    ...(normalized.basic.description ? { description: normalized.basic.description } : {}),
    releaseDate: new Date().toISOString(),
    ...(normalized.basic.keywords ? { keywords: normalized.basic.keywords } : {}),
    title,
    taxCode: normalized.basic.taxCode,
    ...(normalized.basic.metaDescription ? { metaTagDescription: normalized.basic.metaDescription } : {}),
    supplierId: 0,
  };
}

export function toUpdateProductPayload(draft: ProductDraft): ProductCatalogUpdatePayload {
  const normalized = normalizeProductDraft(draft);

  return {
    name: normalized.basic.name,
    slug: normalized.basic.slug,
    ...(normalized.basic.shortDescription ? { shortDescription: normalized.basic.shortDescription } : {}),
    ...(normalized.basic.description ? { description: normalized.basic.description } : {}),
    ...(normalized.basic.categoryId ? { categoryId: normalized.basic.categoryId } : {}),
    ...(normalized.basic.brandId ? { brandId: normalized.basic.brandId } : {}),
    isVisible: normalized.basic.isVisible,
    isActive: normalized.basic.isActive,
    ...(normalized.basic.keywords ? { keywords: normalized.basic.keywords } : {}),
    title: normalized.basic.metaTitle || normalized.basic.name,
    taxCode: normalized.basic.taxCode,
    ...(normalized.basic.metaDescription ? { metaTagDescription: normalized.basic.metaDescription } : {}),
  };
}

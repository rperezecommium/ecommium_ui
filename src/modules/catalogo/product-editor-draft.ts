import type {
  ProductEditorData,
  ProductDraft,
  ProductDraftMediaItem,
  ProductShippingDraft,
  ProductSummary,
  ProductVariantRecord,
} from "./product-editor-types";

export function slugifyProductValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function plainProductText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function makeRefIdFromName(value: string) {
  return slugifyProductValue(value)
    .replace(/-/g, "_")
    .toUpperCase()
    .slice(0, 64);
}

function createClientDraftId() {
  return globalThis.crypto?.randomUUID?.() ?? `client-draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createEmptyProductShippingDraft(): ProductShippingDraft {
  return {
    package: {
      weightGrams: null,
      widthMm: null,
      heightMm: null,
      depthMm: null,
    },
    additionalShippingCostMinor: null,
    allowedCarrierIds: [],
    deliveryTimeMode: "none",
    deliveryTimeNotes: {
      inStock: {},
      outOfStock: {},
    },
  };
}

export function createEmptyProductDraft(locale = "es-ES", currency = "EUR"): ProductDraft {
  void locale;

  return {
    clientDraftId: createClientDraftId(),
    basic: {
      name: "",
      slug: "",
      categoryId: "",
      categorySlug: "",
      brandId: "",
      brandLinkId: "",
      shortDescription: "",
      description: "",
      isVisible: true,
      isActive: false,
      keywords: "",
      metaTitle: "",
      metaDescription: "",
      taxCode: "standard",
    },
    mode: "simple",
    defaultVariant: {
      refId: "",
      ean: null,
    },
    media: {
      items: [],
      removedItems: [],
      assignments: {},
      mainByVariant: {},
    },
    variants: [],
    pricing: {
      variantPrices: {},
      productPrice: {
        basePriceMinor: 0,
        listPriceMinor: null,
        costPriceMinor: null,
        currency,
        taxIncluded: true,
        taxCode: "standard",
        tax: null,
        priceTableId: null,
        tradePolicy: "default",
        channel: "web",
        customerGroup: null,
        country: "ES",
      },
    },
    offerings: {
      byVariant: {},
    },
    inventory: {
      stockByVariant: {
        default: {
          warehouseId: "main-warehouse",
          onHandQuantity: 0,
          reservedQuantity: 0,
          safetyStockQuantity: 0,
        },
      },
    },
    shipping: createEmptyProductShippingDraft(),
    saveState: {
      catalog: "pending",
      variants: "pending",
      media: "pending",
      variantMedia: "pending",
      pricing: "pending",
      inventory: "pending",
      shipping: "pending",
      publish: "pending",
    },
  };
}

export function makeProductMediaItem(input: {
  fileName: string;
  fileSize: number;
  mimeType: string;
  productName: string;
  locale: string;
  index: number;
  previewUrl?: string;
  isMain?: boolean;
}): ProductDraftMediaItem {
  const fallbackName = input.productName.trim() || "Nuevo producto";
  const title = `${fallbackName} imagen ${input.index + 1}`;

  return {
    localId: `media-${Date.now()}-${input.index}-${Math.random().toString(16).slice(2)}`,
    fileName: input.fileName,
    fileSize: input.fileSize,
    mimeType: input.mimeType,
    previewUrl: input.previewUrl,
    uploadStatus: "local",
    isMain: Boolean(input.isMain),
    active: true,
    alt: {
      [input.locale]: title,
    },
    title: {
      [input.locale]: title,
    },
  };
}

export function ensureSingleMainImage(items: ProductDraftMediaItem[], mainLocalId: string) {
  return items.map((item) => ({
    ...item,
    isMain: item.localId === mainLocalId,
  }));
}

export function draftFromProduct(
  product: ProductSummary,
  variants: ProductVariantRecord[] = [],
  locale = "es-ES",
  currency = "EUR",
): ProductDraft {
  const empty = createEmptyProductDraft(locale, currency);
  const defaultVariant =
    variants.find((variant) => variant.isDefault) ??
    variants.find((variant) => variant.variantId === product.defaultVariantId) ??
    variants[0];
  const realVariants = variants.filter((variant) => variant.variantId !== defaultVariant?.variantId);

  return {
    ...empty,
    clientDraftId: product.productId,
    productId: product.productId,
    defaultVariantId: product.defaultVariantId ?? defaultVariant?.variantId,
    mediaCollectionId: product.mediaCollectionId ?? null,
    basic: {
      ...empty.basic,
      name: product.name,
      slug: product.slug,
      categoryId: product.categoryId ?? "",
      categoryName: product.categoryName ?? "",
      brandId: product.brandId ?? "",
      brandName: product.brandName ?? "",
      shortDescription: product.shortDescription ?? "",
      description: product.description ?? "",
      isActive: product.isActive,
      isVisible: product.isVisible,
      keywords: product.keywords ?? "",
      metaTitle: product.metaTitle ?? product.name,
      metaDescription: product.metaDescription ?? "",
      taxCode: product.taxCode ?? empty.basic.taxCode,
    },
    mode: realVariants.length > 0 ? "variants" : "simple",
    defaultVariant: {
      refId: defaultVariant?.refId ?? makeRefIdFromName(product.name),
      name: product.name,
      ean: defaultVariant?.ean ?? null,
    },
    variants: realVariants
      .map((variant) => ({
        localId: variant.variantId,
        variantId: variant.variantId,
        name: variant.name,
        refId: variant.refId,
        ean: variant.ean ?? null,
        options: variant.options ?? [],
        isActive: variant.isActive,
        isVisible: variant.isVisible,
      })),
  };
}

export function draftFromEditorData(
  data: ProductEditorData,
  locale = "es-ES",
  currency = "EUR",
): ProductDraft {
  const draft = draftFromProduct(data.product, data.variants, locale, currency);
  const defaultVariant =
    data.variants.find((variant) => variant.isDefault) ??
    data.variants.find((variant) => variant.variantId === data.product.defaultVariantId) ??
    data.variants[0];
  const defaultVariantId = data.product.defaultVariantId ?? defaultVariant?.variantId;
  const offeringsByVariant = { ...data.offeringsByVariant };
  if (defaultVariantId && offeringsByVariant[defaultVariantId]) {
    offeringsByVariant.default = offeringsByVariant[defaultVariantId];
  }

  return {
    ...draft,
    mode: data.variants.filter((variant) => variant.variantId !== defaultVariantId).length > 0 ? "variants" : draft.mode,
    defaultVariantId,
    media: {
      items: data.mediaItems,
      removedItems: [],
      assignments: data.mediaAssignments,
      mainByVariant: data.mediaMainByVariant,
    },
    variants: data.variants
      .filter((variant) => variant.variantId !== defaultVariantId)
      .map((variant) => ({
        localId: variant.variantId,
        variantId: variant.variantId,
        name: variant.name,
        refId: variant.refId,
        ean: variant.ean ?? null,
        options: variant.options ?? [],
        isActive: variant.isActive,
        isVisible: variant.isVisible,
      })),
    pricing: {
      productPrice: data.productPrice ?? draft.pricing.productPrice,
      variantPrices: data.variantPrices,
    },
    offerings: {
      byVariant: offeringsByVariant,
    },
    inventory: {
      stockByVariant: {
        ...draft.inventory.stockByVariant,
        ...data.stockByVariant,
      },
    },
    shipping: data.shipping ?? draft.shipping,
  };
}

export function sanitizeDraftForStorage(draft: ProductDraft): ProductDraft {
  return {
    ...draft,
    media: {
      ...draft.media,
      items: draft.media.items.map((item) => ({
        ...item,
        previewUrl: item.persisted ? item.previewUrl : undefined,
      })),
    },
    shipping: draft.shipping ?? createEmptyProductShippingDraft(),
  };
}

function mediaItemKey(item: ProductDraftMediaItem) {
  return item.mediaAssetId ?? item.localId;
}

function findFreshMediaItem(
  freshItems: ProductDraftMediaItem[],
  storedItem: ProductDraftMediaItem,
) {
  const storedKeys = new Set([
    storedItem.mediaAssetId,
    storedItem.localId,
  ].filter((value): value is string => Boolean(value)));

  return freshItems.find((freshItem) =>
    [freshItem.mediaAssetId, freshItem.localId].some((value) => value && storedKeys.has(value)),
  );
}

function mergeMediaItems(
  freshItems: ProductDraftMediaItem[],
  storedItems: ProductDraftMediaItem[] = [],
) {
  const mergedKeys = new Set<string>();
  const mergedStoredItems = storedItems.map((storedItem) => {
    const freshItem = findFreshMediaItem(freshItems, storedItem);
    const merged = freshItem
      ? {
          ...freshItem,
          ...storedItem,
          mediaAssetId: storedItem.mediaAssetId ?? freshItem.mediaAssetId,
          previewUrl: storedItem.previewUrl || freshItem.previewUrl,
          persisted: storedItem.persisted ?? freshItem.persisted,
          uploadStatus: storedItem.uploadStatus ?? freshItem.uploadStatus,
          uploadError: storedItem.uploadError ?? freshItem.uploadError,
        }
      : storedItem;

    mergedKeys.add(mediaItemKey(merged));
    return merged;
  });

  const missingFreshItems = freshItems.filter((item) => !mergedKeys.has(mediaItemKey(item)));

  return [...mergedStoredItems, ...missingFreshItems];
}

export function mergeStoredProductDraft(
  initialDraft: ProductDraft,
  storedDraft: ProductDraft,
): ProductDraft {
  const mergedBasic = storedDraft.basic ?? initialDraft.basic;

  return {
    ...initialDraft,
    ...storedDraft,
    clientDraftId: storedDraft.clientDraftId ?? initialDraft.clientDraftId,
    defaultVariant: {
      ...initialDraft.defaultVariant,
      ...storedDraft.defaultVariant,
      name: mergedBasic.name,
    },
    media: {
      ...initialDraft.media,
      ...storedDraft.media,
      items: mergeMediaItems(initialDraft.media.items, storedDraft.media?.items ?? []),
      removedItems: storedDraft.media?.removedItems ?? [],
      assignments: {
        ...initialDraft.media.assignments,
        ...storedDraft.media?.assignments,
      },
      mainByVariant: {
        ...initialDraft.media.mainByVariant,
        ...storedDraft.media?.mainByVariant,
      },
    },
    offerings: storedDraft.offerings ?? initialDraft.offerings,
    shipping: storedDraft.shipping ?? initialDraft.shipping,
    saveState: {
      ...initialDraft.saveState,
      ...storedDraft.saveState,
    },
  };
}

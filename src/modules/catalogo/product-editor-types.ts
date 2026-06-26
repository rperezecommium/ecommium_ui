import type { BffResult } from "../../shared/bff/types";

export type ProductMode = "simple" | "variants";

export type SaveBlockStatus = "pending" | "running" | "success" | "failed" | "skipped" | "blocked";

export type PriceDraft = {
  pricingId?: string;
  basePriceMinor: number;
  listPriceMinor?: number | null;
  costPriceMinor?: number | null;
  currency: string;
  taxIncluded: boolean;
  taxCode?: string;
  tax?: ProductTaxLookupOption | null;
  priceTableId?: string | null;
  tradePolicy?: string;
  channel?: string;
  customerGroup?: string | null;
  country?: string;
  source?: string;
  markedForDeletion?: boolean;
};

export type SpecificPriceDraft = {
  pricingId?: string;
  targetType: "PRODUCT" | "VARIANT";
  productId?: string;
  variantKey?: string;
  variantId?: string | null;
  currency?: string | null;
  country?: string | null;
  customerGroup?: string | null;
  channel?: string | null;
  tradePolicy?: string | null;
  priceTableId?: string | null;
  minQuantity: number;
  validFrom?: string | null;
  validUntil?: string | null;
  unlimited?: boolean;
  impactType: "FIXED_PRICE" | "REDUCTION_AMOUNT" | "REDUCTION_PERCENTAGE";
  basePriceMinor?: number | null;
  fixedPriceMinor?: number | null;
  reductionValue?: number | null;
  reductionTaxIncluded?: boolean;
  taxIncluded?: boolean;
  tax?: ProductTaxLookupOption | null;
  active: boolean;
  priority?: number | null;
  markedForDeletion?: boolean;
};

export type StockDraft = {
  warehouseId: string;
  onHandQuantity: number;
  reservedQuantity: number;
  safetyStockQuantity: number;
  availableQuantity?: number;
  available?: boolean;
  reasons?: string[];
};

export type ProductShippingDraft = {
  package: {
    weightGrams?: number | null;
    widthMm?: number | null;
    heightMm?: number | null;
    depthMm?: number | null;
  };
  additionalShippingCostMinor?: number | null;
  allowedCarrierIds: string[];
  deliveryTimeMode: "none" | "default" | "specific";
  deliveryTimeNotes: {
    inStock: Record<string, string>;
    outOfStock: Record<string, string>;
  };
};

export type ProductDraftMediaItem = {
  localId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  previewUrl?: string;
  uploadStatus?: "local" | "uploading" | "uploaded" | "failed";
  uploadError?: string;
  isMain: boolean;
  active: boolean;
  alt: Record<string, string>;
  title: Record<string, string>;
  mediaAssetId?: string;
  persisted?: boolean;
};

export type ProductDraftMediaFile = {
  localId: string;
  file: File;
};

export type ProductDraftVariant = {
  localId: string;
  variantId?: string;
  name: string;
  refId: string;
  ean?: string | null;
  options: ProductDraftVariantOption[];
  isActive: boolean;
  isVisible: boolean;
};

export type ProductDraftVariantOption = {
  variantOptionId?: string;
  attributeCode: string;
  valueCode: string;
  isActive?: boolean;
  createdInDraft?: boolean;
  markedForDeletion?: boolean;
};

export type ProductOfferingRecord = {
  offeringId: string;
  name: string;
  localizedName: Array<{
    locale: string;
    value: string;
  }>;
  priceMinor: number;
  currency: string;
  type: string;
  active: boolean;
};

export type ProductAppliedPricePreviewInput = {
  productId?: string | null;
  variantId?: string | null;
  defaultVariantId?: string | null;
  currency?: string | null;
  country?: string | null;
  tradePolicy?: string | null;
  channel?: string | null;
  customerGroup?: string | null;
  priceTableId?: string | null;
  quantity?: number | string | null;
  at?: string | null;
};

export type ProductAppliedPricePreviewCondition = {
  key: string;
  requested: string | number | null;
  matched: string | number | null;
  status: "MATCH" | "ANY" | "MISMATCH";
};

export type ProductAppliedPricePreview = {
  ok: boolean;
  status: "APPLIED" | "NOT_APPLIED";
  reason: string | null;
  requested: Required<Pick<ProductAppliedPricePreviewInput, "productId" | "variantId" | "defaultVariantId" | "currency" | "country" | "tradePolicy" | "channel" | "customerGroup" | "priceTableId" | "at">> & {
    quantity: number;
  };
  resolution: {
    source: "PRODUCT" | "VARIANT" | "DEFAULT_VARIANT" | "PRODUCT_FALLBACK" | "NONE";
    usedFallback: boolean;
  };
  price: {
    pricingId: string;
    targetType: "PRODUCT" | "VARIANT";
    productId: string;
    variantId: string | null;
    priceTableId: string | null;
    tradePolicy: string | null;
    channel: string | null;
    customerGroup: string | null;
    country: string | null;
    currency: string;
    basePrice: { currency: string; amountMinor: number };
    listPrice: { currency: string; amountMinor: number } | null;
    fixedPrice: { currency: string; amountMinor: number } | null;
    tiers: Array<{ minQuantity: number; price: { currency: string; amountMinor: number } }> | null;
    taxIncluded: boolean;
    active: boolean;
    priority: number;
    source: string;
    resolved?: {
      currency: string;
      netAmountMinor: number;
      taxAmountMinor: number;
      grossAmountMinor: number;
      taxIncluded: boolean;
    };
  } | null;
  conditions: ProductAppliedPricePreviewCondition[];
  correlationIds?: string[];
};

export type ProductDraft = {
  clientDraftId: string;
  productId?: string;
  defaultVariantId?: string;
  mediaCollectionId?: string | null;
  basic: {
    name: string;
    slug: string;
    categoryId?: string;
    categoryName?: string;
    categorySlug?: string;
    brandId?: string;
    brandName?: string;
    brandLinkId?: string;
    shortDescription: string;
    description: string;
    isVisible: boolean;
    isActive: boolean;
    keywords: string;
    metaTitle: string;
    metaDescription: string;
    taxCode: string;
  };
  mode: ProductMode;
  defaultVariant: {
    refId: string;
    name?: string;
    ean?: string | null;
  };
  media: {
    items: ProductDraftMediaItem[];
    removedItems: ProductDraftMediaItem[];
    assignments: Record<string, string[]>;
    mainByVariant: Record<string, string>;
  };
  variants: ProductDraftVariant[];
  pricing: {
    productPrice?: PriceDraft;
    variantPrices: Record<string, PriceDraft>;
    specificPrices: SpecificPriceDraft[];
  };
  offerings: {
    byVariant: Record<string, ProductOfferingRecord[]>;
  };
  inventory: {
    stockByVariant: Record<string, StockDraft>;
  };
  shipping: ProductShippingDraft;
  saveState: Record<string, SaveBlockStatus>;
};

export type ProductSummary = {
  productId: string;
  name: string;
  slug: string;
  reference?: string;
  isActive: boolean;
  isVisible: boolean;
  mediaCollectionId?: string | null;
  mediaCount?: number;
  defaultVariantId?: string;
  thumbnailUrl?: string | null;
  thumbnailAlt?: string | null;
  categoryId?: string;
  categoryName?: string;
  brandId?: string;
  brandName?: string;
  priceTaxExcludedMinor?: number;
  priceTaxIncludedMinor?: number;
  priceTaxExcludedDisplay?: string;
  priceTaxIncludedDisplay?: string;
  currency?: string;
  quantity?: number;
  shortDescription?: string;
  description?: string;
  keywords?: string;
  metaTitle?: string;
  metaDescription?: string;
  taxCode?: string;
  updatedAt?: string;
};

export type ProductListResult = {
  items: ProductSummary[];
  total: number;
  limit: number;
  offset: number;
  filters?: ProductListFilters;
  source: "bff" | "unavailable";
  message?: string;
  failedEndpoint?: string;
  correlationId?: string;
};

export type ProductListFilters = {
  q?: string;
  categoryId?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
};

export type ProductVariantRecord = {
  variantId: string;
  name: string;
  refId: string;
  ean?: string | null;
  isActive: boolean;
  isVisible: boolean;
  isDefault?: boolean;
  options?: ProductDraftVariantOption[];
};

export type ProductEditorVariantRow = {
  variantId: string;
  productId?: string;
  role: "PRODUCT_SIMPLE" | "PRODUCT_DEFAULT" | "VARIANT";
  position?: number;
  variantPosition?: number | null;
  isDefault: boolean;
  isVisible: boolean;
  isActive: boolean;
  refId: string;
  name: string;
  displayLabel: string;
  selectorLabel: string;
  directMediaCount: number;
  effectiveMediaSource: "DIRECT" | "DEFAULT_VARIANT" | "NONE";
  inheritsMediaFromVariantId?: string | null;
  selectableForMedia?: boolean;
};

export type ProductEditorData = {
  product: ProductSummary;
  variants: ProductVariantRecord[];
  variantRows: ProductEditorVariantRow[];
  mediaItems: ProductDraftMediaItem[];
  mediaAssignments: Record<string, string[]>;
  mediaMainByVariant: Record<string, string>;
  productPrice?: PriceDraft;
  variantPrices: Record<string, PriceDraft>;
  specificPrices: SpecificPriceDraft[];
  offeringsByVariant: Record<string, ProductOfferingRecord[]>;
  stockByVariant: Record<string, StockDraft>;
  shipping?: ProductShippingDraft;
  warnings: string[];
  correlationIds: string[];
};

export type ProductLookupOption = {
  id: string;
  label: string;
  slug?: string;
};

export type ProductTaxLookupOption = ProductLookupOption & {
  taxId?: string;
  taxCode: string;
  name?: string | null;
  calculationType: "PERCENTAGE" | "FIXED";
  rate?: number | null;
  amountMinor?: number | null;
  isCompound?: boolean;
  isActive?: boolean;
  validFrom?: string | null;
  validUntil?: string | null;
};

export type ProductEditorLookups = {
  categories: ProductLookupOption[];
  brands: ProductLookupOption[];
  taxes: ProductTaxLookupOption[];
  priceTables: ProductLookupOption[];
  customerGroups: ProductLookupOption[];
  channels: ProductLookupOption[];
  tradePolicies: ProductLookupOption[];
  countries: ProductLookupOption[];
  carriers: ProductLookupOption[];
  warnings: string[];
};

export type ProductSaveBlocks = {
  catalog: SaveBlockStatus;
  variants: SaveBlockStatus;
  media: SaveBlockStatus;
  variantMedia: SaveBlockStatus;
  pricing: SaveBlockStatus;
  inventory: SaveBlockStatus;
  shipping: SaveBlockStatus;
  publish: SaveBlockStatus;
};

export type ProductSaveRecoveryAction = {
  code: string;
  label: string;
  targetBlock?: keyof ProductSaveBlocks | string;
  retryable?: boolean;
};

export type ProductSaveReport = {
  ok: boolean;
  operationId?: string;
  status?: string;
  retryable?: boolean;
  productId?: string;
  defaultVariantId?: string;
  mediaCollectionId?: string | null;
  blocks: ProductSaveBlocks;
  messages: string[];
  fieldErrors: Record<string, string>;
  recoveryActions: ProductSaveRecoveryAction[];
  correlationIds: string[];
  draftPatch?: Partial<ProductDraft>;
};

export type ProductDraftMediaUploadReport = {
  ok: boolean;
  uploadOperationId?: string;
  idempotencyKey?: string;
  clientDraftId?: string;
  productId?: string;
  defaultVariantId?: string | null;
  mediaCollectionId?: string | null;
  mediaItem?: ProductDraftMediaItem;
  status?: string;
  messages?: string[];
  fieldErrors?: Record<string, string>;
  correlationIds: string[];
  draftPatch?: Partial<ProductDraft>;
};

export type ProductDraftMediaStateItem = {
  localId: string;
  mediaAssetId: string;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number;
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
  isMain: boolean;
  position?: number;
  active: boolean;
  persisted: true;
  uploadStatus: "uploaded";
  alt: Record<string, string>;
  title: Record<string, string>;
};

export type ProductDraftMediaStateReport = {
  ok: boolean;
  clientDraftId?: string;
  productId?: string | null;
  defaultVariantId?: string | null;
  mediaCollectionId?: string | null;
  status?: string;
  expiresAt?: string | null;
  mediaItems: ProductDraftMediaStateItem[];
  warnings: string[];
  messages?: string[];
  fieldErrors?: Record<string, string>;
  correlationIds: string[];
  draftPatch?: Partial<ProductDraft>;
};

export type ProductCatalogCreatePayload = {
  locale: string;
  name: string;
  slug: string;
  linkId: string;
  defaultVariant: {
    refId: string;
    name?: string;
    ean?: string | null;
  };
  categoryId?: string;
  brandId?: string;
  isVisible: boolean;
  isActive: boolean;
  shortDescription?: string;
  description?: string;
  releaseDate?: string;
  keywords?: string;
  title?: string;
  taxCode?: string;
  metaTagDescription?: string;
  supplierId?: number;
  shipping?: ProductShippingDraft;
};

export type ProductCatalogUpdatePayload = {
  name: string;
  refId?: string;
  slug: string;
  shortDescription?: string;
  description?: string;
  categoryId?: string;
  brandId?: string;
  isVisible: boolean;
  isActive: boolean;
  keywords?: string;
  title?: string;
  taxCode?: string;
  metaTagDescription?: string;
  shipping?: ProductShippingDraft;
};

export type ProductVariantCreatePayload = {
  locale: string;
  name: string;
  refId: string;
  ean?: string | null;
  isVisible: boolean;
  isActive: boolean;
};

export type ProductVariantOptionPayload = {
  attributeCode: string;
  valueCode: string;
  isActive: boolean;
};

export type ProductVariantOptionRecord = ProductDraftVariantOption & {
  variantId?: string;
  productId?: string;
};

export type ProductGateway = {
  createProduct(payload: ProductCatalogCreatePayload): Promise<BffResult<ProductSummary>>;
  updateProduct(productId: string, payload: ProductCatalogUpdatePayload): Promise<BffResult<ProductSummary>>;
  getProduct(productId: string): Promise<BffResult<ProductSummary>>;
  listVariants(productId: string): Promise<BffResult<ProductVariantRecord[]>>;
  createVariant(productId: string, payload: ProductVariantCreatePayload): Promise<BffResult<ProductVariantRecord>>;
  updateVariant(variantId: string, payload: ProductVariantUpdatePayload): Promise<BffResult<ProductVariantRecord>>;
  deleteVariant(variantId: string): Promise<BffResult<{ deleted?: boolean }>>;
  createVariantOption(variantId: string, payload: ProductVariantOptionPayload): Promise<BffResult<ProductVariantOptionRecord>>;
  updateVariantOption(
    variantId: string,
    variantOptionId: string,
    payload: ProductVariantOptionPayload,
  ): Promise<BffResult<ProductVariantOptionRecord>>;
  deleteVariantOption(
    variantId: string,
    variantOptionId: string,
  ): Promise<BffResult<{ deleted?: boolean; variantOptionId?: string }>>;
  createMediaCollection(input: {
    productId: string;
    shopId: string;
    title: string;
    defaultLocale: string;
    files: File[];
    metadata: ProductDraftMediaItem[];
  }): Promise<BffResult<{ mediaCollectionId: string | null; mediaAssetIds: string[] }>>;
  appendMediaItems(input: {
    mediaCollectionId: string;
    defaultLocale: string;
    files: File[];
    metadata: ProductDraftMediaItem[];
  }): Promise<BffResult<{ mediaCollectionId: string | null; mediaAssetIds: string[] }>>;
  deleteMediaItem(input: {
    mediaCollectionId: string;
    mediaAssetId: string;
  }): Promise<BffResult<{ deleted?: boolean }>>;
  assignVariantMedia(input: {
    variantId: string;
    mediaAssetIds: string[];
    mainMediaAssetId?: string;
  }): Promise<BffResult<{ assigned: boolean }>>;
  clearVariantMedia(input: {
    variantId: string;
  }): Promise<BffResult<{ cleared?: number }>>;
  setVariantMainMedia(input: {
    variantId: string;
    mediaAssetId: string;
  }): Promise<BffResult<{ assigned: boolean }>>;
  createProductPrice(input: {
    productId: string;
    price: PriceDraft;
  }): Promise<BffResult<{ pricingId?: string }>>;
  updatePrice(input: {
    pricingId: string;
    price: PriceDraft;
  }): Promise<BffResult<{ pricingId?: string }>>;
  deletePrice(input: {
    pricingId: string;
  }): Promise<BffResult<{ deleted?: boolean }>>;
  createVariantPrice(input: {
    productId: string;
    variantId: string;
    price: PriceDraft;
  }): Promise<BffResult<{ pricingId?: string }>>;
  previewAppliedPrice(input: ProductAppliedPricePreviewInput): Promise<BffResult<ProductAppliedPricePreview>>;
  createOffering(payload: ProductOfferingCreatePayload): Promise<BffResult<{ offering: ProductOfferingRecord; message?: string }>>;
  attachOfferingToVariant(input: {
    offeringId: string;
    variantId: string;
  }): Promise<BffResult<{ offeringId: string; variantId: string; message?: string }>>;
  detachOfferingFromVariant(input: {
    offeringId: string;
    variantId: string;
  }): Promise<BffResult<{ offeringId: string; variantId: string; detached?: boolean; message?: string }>>;
  setOfferingVariantActivation(input: {
    offeringId: string;
    variantId: string;
    active: boolean;
  }): Promise<BffResult<{ offeringId: string; variantId: string; active?: boolean; message?: string }>>;
  listOfferingsByVariant(variantId: string): Promise<BffResult<ProductOfferingRecord[]>>;
  resolveOfferingsBatchByVariants(variantIds: string[]): Promise<BffResult<Record<string, ProductOfferingRecord[]>>>;
  putStockLevel(input: {
    variantId: string;
    stock: StockDraft;
  }): Promise<BffResult<StockDraft & { updatedAt?: string }>>;
};

export type ProductVariantUpdatePayload = {
  locale: string;
  name: string;
  refId: string;
  ean?: string | null;
  isVisible: boolean;
  isActive: boolean;
};

export type ProductOfferingCreatePayload = {
  type: string;
  priceMinor: number;
  currency: string;
  localizedName: Array<{
    locale: string;
    value: string;
  }>;
  active: boolean;
};

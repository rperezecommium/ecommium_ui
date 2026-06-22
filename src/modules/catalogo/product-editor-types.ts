import type { BffResult } from "../../shared/bff/types";

export type ProductMode = "simple" | "variants";

export type SaveBlockStatus = "pending" | "running" | "success" | "failed" | "skipped";

export type PriceDraft = {
  pricingId?: string;
  basePriceMinor: number;
  listPriceMinor?: number | null;
  costPriceMinor?: number | null;
  currency: string;
  taxIncluded: boolean;
  taxCode?: string;
  priceTableId?: string | null;
  tradePolicy?: string;
  channel?: string;
  customerGroup?: string | null;
  country?: string;
  source?: string;
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

export type ProductDraftMediaItem = {
  localId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  previewUrl?: string;
  isMain: boolean;
  active: boolean;
  alt: Record<string, string>;
  title: Record<string, string>;
  mediaAssetId?: string;
  persisted?: boolean;
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

export type ProductDraft = {
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
    assignments: Record<string, string[]>;
    mainByVariant: Record<string, string>;
  };
  variants: ProductDraftVariant[];
  pricing: {
    productPrice?: PriceDraft;
    variantPrices: Record<string, PriceDraft>;
  };
  offerings: {
    byVariant: Record<string, ProductOfferingRecord[]>;
  };
  inventory: {
    stockByVariant: Record<string, StockDraft>;
  };
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

export type ProductEditorData = {
  product: ProductSummary;
  variants: ProductVariantRecord[];
  mediaItems: ProductDraftMediaItem[];
  mediaAssignments: Record<string, string[]>;
  mediaMainByVariant: Record<string, string>;
  productPrice?: PriceDraft;
  variantPrices: Record<string, PriceDraft>;
  offeringsByVariant: Record<string, ProductOfferingRecord[]>;
  stockByVariant: Record<string, StockDraft>;
  warnings: string[];
  correlationIds: string[];
};

export type ProductLookupOption = {
  id: string;
  label: string;
  slug?: string;
};

export type ProductEditorLookups = {
  categories: ProductLookupOption[];
  brands: ProductLookupOption[];
  taxes: ProductLookupOption[];
  priceTables: ProductLookupOption[];
  warnings: string[];
};

export type ProductSaveBlocks = {
  catalog: SaveBlockStatus;
  variants: SaveBlockStatus;
  media: SaveBlockStatus;
  variantMedia: SaveBlockStatus;
  pricing: SaveBlockStatus;
  inventory: SaveBlockStatus;
};

export type ProductSaveReport = {
  ok: boolean;
  productId?: string;
  defaultVariantId?: string;
  mediaCollectionId?: string | null;
  blocks: ProductSaveBlocks;
  messages: string[];
  fieldErrors: Record<string, string>;
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
};

export type ProductCatalogUpdatePayload = {
  name: string;
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

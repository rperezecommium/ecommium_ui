"use client";
import { AdminResizableDrawer } from "../../shared/ui/admin-resizable-drawer";

import { loadProductWarehouseStockAction } from "./product-inventory-actions";
import { dateTimeLocalToIso, isoToDateTimeLocal } from "./product-price-dates";
import { ProductInventoryPanel } from "./product-inventory-panel";
import { reloadProductTaxesAction } from "./product-tax-lookup-actions";
import type {CatalogDeletionContext} from "./catalog-deletion-contract";
import {CatalogDeletionButton} from "./catalog-deletion-button";


import Link from "next/link";
import dynamic from "next/dynamic";
import type { StorefrontPdpData } from "../storefront/pdp";
const ProductPdpPreviewModal = dynamic(() => import("./product-pdp-preview-modal").then(module => module.ProductPdpPreviewModal));
import { registeredCombinations, registeredVariantName, registeredVariantSku } from "./product-registered-combinations";
import { assignVariantImage, effectiveVariantImage, normalizeVariantMedia, ownVariantImage } from "./product-variant-media";
import { ProductVariantImagePicker } from "./product-variant-image-picker";
import { ProductSummaryGallery } from "./product-summary-gallery";
import { ProductSeoResolutionNotice } from "./product-seo-resolution-notice";
import {remoteProductIdentityMatches} from "./product-draft-identity";
import { acknowledgeProductSaveAttempt, applyProductSavePatch, prepareProductSaveAttempt, productSaveSignature, type ProductSaveAttempt } from "./product-save-attempt";
import { type productSpecificationCatalog } from "./product-specification-fields";
import { ProductFeatureManager } from "./product-feature-manager";
import { addProductFeatureValueAction, loadProductFeaturesAction } from "./product-feature-actions";
import { productPublicationLabel } from "./product-status";
import { AdminResourceDrawer } from "../../shared/ui/admin-resource-drawer";
import { AdminMutationForm } from "../../shared/ui/admin-mutation-form";
import { CatalogEntityFields } from "./catalog-entity-fields";
import type { CatalogCreateInput } from "./catalog-taxonomy-schema";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, ChevronRight, Copy, Eye, Italic, List, ListOrdered, Pencil, Plus, Redo2, RemoveFormatting, RotateCcw, Strikethrough, Trash2, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import type { ChangeEvent, InputHTMLAttributes } from "react";
import {
  attachExistingOfferingToVariantAction,
  createProductBrandInlineAction,
  createProductCategoryInlineAction,
  detachOfferingFromVariantAction,
  deactivateProductAction,
  previewAppliedProductPriceAction,
  readProductDraftMediaStateAction,
  saveProductDraftAction,
  setOfferingVariantActivationAction,
  uploadProductDraftMediaAction,
} from "./product-actions";
import {
  canonicalPathFromSlug,
  editorBasePrice,
  editorBasePriceVariantKey,
  makeProductMediaItem,
  makeRefIdFromName,
  mergeStoredProductDraft,
  pricesForNewVariants,
  variantPriceForEdit,
  sanitizeDraftForStorage,
  slugifyProductValue,
  withEditorBasePrice,
} from "./product-editor-draft";
import type {
  ProductAppliedPricePreview,
  ProductDraft,
  ProductDraftMediaStateItem,
  ProductDraftMediaItem,
  ProductDraftMediaUploadReport,
  ProductDraftVariant,
  ProductEditorLookups,
  ProductEditorVariantRow,
  ProductLookupOption,
  ProductOfferingRecord,
  ProductSaveReport,
  ProductSpecificationLookupField,
  ProductTaxLookupOption,
  SpecificPriceDraft,
  StockDraft,
} from "./product-editor-types";
import {
  getProductPublicationChecklist,
  validateProductDraft,
  validateProductPublicationReadiness,
} from "./product-editor-validation";

type ProductEditorClientProps = {
  canDeleteProducts?:boolean;
  deletionContext?:CatalogDeletionContext;
  canManageFeatures?: boolean;
  canManageWarehouses?: boolean;
  canCreateCategories?: boolean;
  canCreateBrands?: boolean;
  contextIdentity: string;
  initialDraft: ProductDraft;
  initialVariantRows?: ProductEditorVariantRow[];
  locale: string;
  currency: string;
  lookups?: ProductEditorLookups;
  initialPreviewOpen?: boolean;
  initialNotice?: string;
  storageScope?: string;
};

type ProductEditorClientInnerProps = Omit<ProductEditorClientProps, "contextIdentity"> & {
  storageKey: string;
};

type ProductVariantRowView = ProductDraftVariant & {
  isDefault: boolean;
  role: ProductEditorVariantRow["role"];
  displayLabel: string;
  selectorLabel: string;
  effectiveMediaSource: ProductEditorVariantRow["effectiveMediaSource"];
};

type SpecificPriceFormState = {
  targetKey: string;
  fixedPrice: string;
  minQuantity: string;
  validFrom: string;
  validUntil: string;
  originalValidFrom?: string | null;
  originalValidUntil?: string | null;
  country: string;
  customerGroup: string;
  channel: string;
  tradePolicy: string;
  priceTableId: string;
  taxIncluded: boolean;
  active: boolean;
  priority: string;
};

type PricingPreviewFormState = {
  targetKey: string;
  quantity: string;
  country: string;
  channel: string;
  tradePolicy: string;
  customerGroup: string;
  priceTableId: string;
  at: string;
};

type SpecificationPickerStep = "fields" | "values";
type OfferingPickerStep = "list" | "details";
type VariantAttributePickerStep = "fields" | "values";

type TabId =
  | "basic"
  | "images"
  | "variants"
  | "pricing"
  | "audit";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "basic", label: "Ajustes basicos" },
  { id: "variants", label: "Variantes" },
  { id: "pricing", label: "Precio" },
  { id: "audit", label: "Auditoria" },
];

function tabForRecoveryBlock(block: string | undefined): TabId {
  if (block === "media" || block === "variantMedia") {
    return "basic";
  }
  if (block === "variants") {
    return "variants";
  }
  if (block === "pricing") {
    return "pricing";
  }
  if (block === "inventory") {
    return "variants";
  }
  if (block === "shipping") {
    return "variants";
  }
  if (block === "routingSeo") {
    return "basic";
  }
  if (block === "specifications") {
    return "basic";
  }

  return "basic";
}

function recoveryActionShouldRetry(action: ProductSaveReport["recoveryActions"][number]) {
  return Boolean(
    action.retryable &&
      (
        action.code.startsWith("retry") ||
        action.label.toLowerCase().startsWith("reintentar")
      ),
  );
}

const remoteMediaConfirmationAttempts = 3;
const remoteMediaConfirmationDelayMs = 450;

const defaultProductEditorLookups: ProductEditorLookups = {
  categories: [],
  brands: [],
  taxes: [],
  priceTables: [],
  customerGroups: [],
  channels: [],
  tradePolicies: [],
  countries: [],
  carriers: [],
  variantAttributeFields: [],
  specificationFields: [],
  offerings: [],
  warnings: [],
};

type DecimalNumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "step" | "type" | "value"> & {
  value: string;
  step?: string;
  onValueChange: (value: string) => void;
};

function formatDecimalInputOnBlur(value: string) {
  if (value === "") {
    return "";
  }

  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed.toFixed(2) : value;
}

function DecimalNumberInput({ value, step = "0.01", onValueChange, onBlur, onFocus, ...props }: DecimalNumberInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [draftValue, setDraftValue] = useState(value);

  return (
    <input
      {...props}
      type="number"
      step={step}
      value={isFocused ? draftValue : value}
      onFocus={(event) => {
        setIsFocused(true);
        setDraftValue(value);
        onFocus?.(event);
      }}
      onChange={(event) => {
        setDraftValue(event.target.value);
        onValueChange(event.target.value);
      }}
      onBlur={(event) => {
        const nextValue = formatDecimalInputOnBlur(event.target.value);
        setIsFocused(false);
        setDraftValue(nextValue);
        onValueChange(nextValue);
        onBlur?.(event);
      }}
    />
  );
}

function centsToInput(value: number | undefined) {
  if (!value) {
    return "";
  }

  return (value / 100).toFixed(2);
}

function formatMoney(value: number | undefined, currency: string, locale?: string) {
  if (locale) return new Intl.NumberFormat(locale, {style: "currency", currency, useGrouping: false}).format((value ?? 0) / 100);
  if (!value) {
    return "0.00";
  }

  return `${(value / 100).toFixed(2)} ${currency}`;
}

function clampInteger(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function inputToCents(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function taxRate(tax: ProductTaxLookupOption | null | undefined) {
  return tax?.calculationType === "PERCENTAGE" && typeof tax.rate === "number" ? tax.rate : null;
}

function netMinorFromPrice(price: ProductDraft["pricing"]["productPrice"], tax: ProductTaxLookupOption | null | undefined) {
  const amount = price?.basePriceMinor ?? 0;
  const rate = taxRate(tax);
  if (!rate || amount <= 0) {
    return amount;
  }

  return price?.taxIncluded ?? true ? Math.round(amount / (1 + rate)) : amount;
}

function grossMinorFromPrice(price: ProductDraft["pricing"]["productPrice"], tax: ProductTaxLookupOption | null | undefined) {
  const amount = price?.basePriceMinor ?? 0;
  const rate = taxRate(tax);
  if (!rate || amount <= 0) {
    return amount;
  }

  return price?.taxIncluded ?? true ? amount : Math.round(amount * (1 + rate));
}

function baseMinorFromNetInput(value: string, price: ProductDraft["pricing"]["productPrice"], tax: ProductTaxLookupOption | null | undefined) {
  const net = inputToCents(value);
  const rate = taxRate(tax);
  return (price?.taxIncluded ?? true) && rate ? Math.round(net * (1 + rate)) : net;
}

function baseMinorFromGrossInput(value: string, price: ProductDraft["pricing"]["productPrice"], tax: ProductTaxLookupOption | null | undefined) {
  const gross = inputToCents(value);
  const rate = taxRate(tax);
  return !(price?.taxIncluded ?? true) && rate ? Math.round(gross / (1 + rate)) : gross;
}

function availableQuantity(stock: StockDraft | undefined) {
  if (!stock) {
    return 0;
  }

  return stock.availableQuantity ?? Math.max(0, stock.onHandQuantity - stock.reservedQuantity - stock.safetyStockQuantity);
}

function stockWithAvailability(stock: StockDraft): StockDraft {
  const available = Math.max(
    0,
    stock.onHandQuantity - stock.reservedQuantity - stock.safetyStockQuantity,
  );

  return {
    ...stock,
    availabilityEstimated: true,
    availableQuantity: available,
    available: available > 0,
    reasons: available > 0 ? [] : ["OUT_OF_STOCK"],
  };
}

function nextRoutingSeoForSlug(
  current: ProductDraft,
  previousSlug: string,
  nextSlug: string,
): ProductDraft["routingSeo"] {
  const previousAutoPath = canonicalPathFromSlug(previousSlug);
  const currentPath = current.routingSeo?.canonicalPath ?? "";
  const shouldUpdate =
    !currentPath ||
    currentPath === previousAutoPath ||
    (!current.routingSeo?.canonicalRouteId && currentPath === canonicalPathFromSlug(current.basic.slug));

  return shouldUpdate
    ? {
        ...current.routingSeo,
        canonicalPath: canonicalPathFromSlug(nextSlug),
      }
    : current.routingSeo;
}

export function localStorageKey(
  draft: ProductDraft,
  locale: string,
  currency: string,
  contextIdentity: string,
  storageScope?: string,
) {
  const mode = draft.productId ? "edit" : "new";
  return `ecommium-product-draft:v4:${contextIdentity}:${mode}:${storageScope ?? draft.productId ?? "new"}:${locale}:${currency}`;
}

function defaultSpecificPriceForm(
  productPrice: ProductDraft["pricing"]["productPrice"],
  targetKey = "__product__",
): SpecificPriceFormState {
  return {
    targetKey,
    fixedPrice: "",
    minQuantity: "1",
    validFrom: "",
    validUntil: "",
    country: productPrice?.country ?? "",
    customerGroup: productPrice?.customerGroup ?? "",
    channel: "",
    tradePolicy: "",
    priceTableId: productPrice?.priceTableId ?? "",
    taxIncluded: productPrice?.taxIncluded ?? true,
    active: true,
    priority: "100",
  };
}

function defaultPricingPreviewForm(
  productPrice: ProductDraft["pricing"]["productPrice"],
  targetKey = "__product__",
): PricingPreviewFormState {
  return {
    targetKey,
    quantity: "1",
    country: "",
    channel: "",
    tradePolicy: "",
    customerGroup: productPrice?.customerGroup ?? "",
    priceTableId: productPrice?.priceTableId ?? "",
    at: "",
  };
}

function pricingResolutionLabel(source: ProductAppliedPricePreview["resolution"]["source"]) {
  const labels: Record<ProductAppliedPricePreview["resolution"]["source"], string> = {
    PRODUCT: "Precio de producto",
    VARIANT: "Precio propio de variante",
    DEFAULT_VARIANT: "Fallback productVariantDefault",
    PRODUCT_FALLBACK: "Fallback al producto",
    NONE: "Sin precio aplicable",
  };

  return labels[source];
}

function pricingConditionLabel(key: string) {
  const labels: Record<string, string> = {
    currency: "Moneda",
    country: "Pais",
    channel: "Canal",
    tradePolicy: "Politica",
    customerGroup: "Grupo cliente",
    priceTableId: "Price table",
    minQuantity: "Cantidad minima",
  };

  return labels[key] ?? key;
}

function pricingConditionStatusLabel(status: ProductAppliedPricePreview["conditions"][number]["status"]) {
  if (status === "MATCH") {
    return "Cumple";
  }
  if (status === "ANY") {
    return "Todos";
  }
  return "No cumple";
}

function lookupOptionsWithCurrent(
  options: ProductLookupOption[] | undefined,
  currentValue?: string | null,
  currentLabel?: string,
) {
  const safeOptions = options ?? [];
  const value = currentValue?.trim();
  if (!value || safeOptions.some((option) => option.id === value)) {
    return safeOptions;
  }

  return [{ id: value, label: currentLabel ?? value }, ...safeOptions];
}

function specificPriceToForm(
  price: SpecificPriceDraft,
  productPrice: ProductDraft["pricing"]["productPrice"],
): SpecificPriceFormState {
  return {
    ...defaultSpecificPriceForm(productPrice, price.targetType === "VARIANT" ? price.variantKey ?? price.variantId ?? "__product__" : "__product__"),
    fixedPrice: centsToInput(price.fixedPriceMinor ?? undefined),
    minQuantity: String(price.minQuantity || 1),
    validFrom: isoToDateTimeLocal(price.validFrom),
    validUntil: isoToDateTimeLocal(price.validUntil),
    originalValidFrom: price.validFrom,
    originalValidUntil: price.validUntil,
    country: price.country ?? "",
    customerGroup: price.customerGroup ?? "",
    channel: price.channel ?? "",
    tradePolicy: price.tradePolicy ?? "",
    priceTableId: price.priceTableId ?? productPrice?.priceTableId ?? "",
    taxIncluded: price.taxIncluded ?? productPrice?.taxIncluded ?? true,
    active: price.active ?? true,
    priority: String(price.priority ?? 100),
  };
}

function fieldErrorLabel(key: string) {
  if (key === "name") {
    return "Nombre";
  }
  if (key === "slug") {
    return "URL amigable";
  }
  if (key === "categoryId") {
    return "Categoria principal";
  }
  if (key === "refId") {
    return "Referencia principal";
  }
  if (key === "media") {
    return "Imagenes";
  }
  if (key === "pricing.productPrice.tax") {
    return "Pricing / Impuesto";
  }
  if (key.startsWith("pricing.variantPrices:")) {
    return "Pricing / Precio de variante";
  }
  if (key.startsWith("pricing.specificPrices:")) {
    return "Pricing / Precio especifico";
  }
  if (key.startsWith("variant:") && key.endsWith(":options")) {
    return "Variantes / Atributos";
  }
  if (key.startsWith("variant:")) {
    return "Variantes";
  }
  if (key.startsWith("media:")) {
    return "Imagenes de variante";
  }
  if (key.startsWith("publication")) {
    return "Publicacion";
  }

  return key;
}

function fieldErrorSummary(fieldErrors: ProductSaveReport["fieldErrors"]) {
  return Object.entries(fieldErrors)
    .filter(([, message]) => Boolean(message))
    .map(([key, message]) => ({
      key,
      label: fieldErrorLabel(key),
      message,
    }));
}

function readStoredDraft(key: string, initialDraft: ProductDraft) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.localStorage.getItem(key);
    const stored = value ? JSON.parse(value) as ProductDraft : null;
    if (stored && initialDraft.productId && stored.productId !== initialDraft.productId) {
      return null;
    }

    return stored ? mergeStoredProductDraft(initialDraft, stored) : null;
  } catch {
    return null;
  }
}

function mediaAssetPreviewUrl(mediaAssetId: string | null | undefined) {
  const normalizedMediaAssetId = mediaAssetId?.trim();
  return normalizedMediaAssetId
    ? `/api/admin/media-assets/${encodeURIComponent(normalizedMediaAssetId)}/content?variant=medium_default`
    : undefined;
}

function isEphemeralPreviewUrl(value: string | undefined) {
  return Boolean(value?.startsWith("blob:") || value?.startsWith("data:image/"));
}

function remoteDraftMediaItemToDraftItem(item: ProductDraftMediaStateItem): ProductDraftMediaItem {
  return {
    localId: item.localId || item.mediaAssetId,
    mediaAssetId: item.mediaAssetId,
    fileName: item.fileName ?? item.mediaAssetId,
    fileSize: item.fileSize,
    mimeType: item.mimeType ?? "application/octet-stream",
    previewUrl: item.previewUrl ?? item.thumbnailUrl ?? mediaAssetPreviewUrl(item.mediaAssetId),
    uploadStatus: "uploaded",
    uploadError: undefined,
    isMain: item.isMain,
    active: item.active,
    alt: item.alt ?? {},
    title: item.title ?? {},
    persisted: true,
  };
}

function sameMediaIdentity(left: ProductDraftMediaItem, right: ProductDraftMediaItem) {
  return Boolean(
    (left.mediaAssetId && left.mediaAssetId === right.mediaAssetId) ||
      left.localId === right.localId,
  );
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function remoteMediaContainsUploadedAssets(
  remoteItems: ProductDraftMediaStateItem[],
  uploadedItems: ProductDraftMediaUploadReport["mediaItem"][],
) {
  const expectedAssetIds = uploadedItems
    .map((item) => item?.mediaAssetId)
    .filter((mediaAssetId): mediaAssetId is string => Boolean(mediaAssetId));

  if (expectedAssetIds.length === 0) {
    return remoteItems.length > 0;
  }

  return expectedAssetIds.every((mediaAssetId) =>
    remoteItems.some((item) => item.mediaAssetId === mediaAssetId),
  );
}

function mergeRemoteDraftMediaState(
  draft: ProductDraft,
  remote: {
    productId?: string | null;
    defaultVariantId?: string | null;
    mediaCollectionId?: string | null;
    mediaItems: ProductDraftMediaStateItem[];
  },
): ProductDraft {
  if(!remoteProductIdentityMatches(draft,remote))return draft;
  const remoteItems = remote.mediaItems.map(remoteDraftMediaItemToDraftItem);
  if (!remote.productId && !remote.defaultVariantId && !remote.mediaCollectionId && remoteItems.length === 0) {
    return draft;
  }

  const mergedItems = draft.media.items.map((localItem) => {
    const remoteItem = remoteItems.find((candidate) => sameMediaIdentity(localItem, candidate));
    if (!remoteItem) {
      return localItem;
    }

    return {
      ...localItem,
      ...remoteItem,
      localId: localItem.localId,
      alt: {
        ...remoteItem.alt,
        ...localItem.alt,
      },
      title: {
        ...remoteItem.title,
        ...localItem.title,
      },
      isMain: localItem.isMain,
      active: localItem.active ?? remoteItem.active,
      previewUrl: remoteItem.previewUrl ?? localItem.previewUrl,
    };
  });
  const missingRemoteItems = remoteItems.filter((remoteItem) =>
    !mergedItems.some((localItem) => sameMediaIdentity(localItem, remoteItem)),
  );
  const hasRemoteMedia = remoteItems.length > 0;

  return {
    ...draft,
    productId: remote.productId ?? draft.productId,
    defaultVariantId: remote.defaultVariantId ?? draft.defaultVariantId,
    mediaCollectionId: remote.mediaCollectionId ?? draft.mediaCollectionId,
    media: {
      ...draft.media,
      items: [...mergedItems, ...missingRemoteItems],
    },
    saveState: {
      ...draft.saveState,
      media: hasRemoteMedia ? "success" : draft.saveState.media,
    },
  };
}

function variantAttributeCode(field: ProductSpecificationLookupField) {
  return slugifyProductValue(field.name || field.fieldId);
}

function variantAttributeValueCode(value: { fieldValueId: string; name: string }) {
  return slugifyProductValue(value.name || value.fieldValueId);
}

function findVariantAttributeField(fields: ProductSpecificationLookupField[], attributeCode: string) {
  return fields.find((field) =>
    field.fieldId === attributeCode ||
    variantAttributeCode(field) === attributeCode,
  );
}

function findVariantAttributeValue(field: ProductSpecificationLookupField | undefined, valueCode: string) {
  return field?.values.find((value) =>
    value.fieldValueId === valueCode ||
    variantAttributeValueCode(value) === valueCode,
  );
}

function offeringName(
  offering: { name: string; localizedName: Array<{ locale: string; value: string }> },
  locale: string,
) {
  return offering.localizedName.find((item) => item.locale === locale)?.value ??
    offering.localizedName[0]?.value ??
    offering.name;
}

type RichTextEditorProps = {
  label: string;
  minHeight?: number;
  value: string;
  onChange(value: string): void;
};

function RichTextEditor({ label, minHeight = 180, value, onChange }: RichTextEditorProps) {
  const [sourceOpen, setSourceOpen] = useState(false);
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-label": label,
        class: "richTextEditable",
        role: "textbox",
      },
    },
    onUpdate({ editor: currentEditor }) {
      onChange(currentEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor || editor.isFocused || editor.getHTML() === value) {
      return;
    }

    editor.commands.setContent(value || "", { emitUpdate: false });
  }, [editor, value]);

  return (
    <div className="adminField adminSection richTextField">
      <span>{label}</span>
      <div className="richTextEditor">
        <div className="richTextToolbar" aria-label={`Herramientas de ${label}`} role="toolbar">
          <select
            aria-label="Formato de bloque"
            value={
              editor?.isActive("heading", { level: 2 })
                ? "h2"
                : editor?.isActive("heading", { level: 3 })
                  ? "h3"
                  : editor?.isActive("blockquote")
                    ? "blockquote"
                    : editor?.isActive("codeBlock")
                      ? "codeBlock"
                      : "paragraph"
            }
            onChange={(event) => {
              const chain = editor?.chain().focus();
              if (!chain) {
                return;
              }

              if (event.target.value === "h2") {
                chain.toggleHeading({ level: 2 }).run();
              } else if (event.target.value === "h3") {
                chain.toggleHeading({ level: 3 }).run();
              } else if (event.target.value === "blockquote") {
                chain.toggleBlockquote().run();
              } else if (event.target.value === "codeBlock") {
                chain.toggleCodeBlock().run();
              } else {
                chain.setParagraph().run();
              }
            }}
          >
            <option value="paragraph">Parrafo</option>
            <option value="h2">Titulo H2</option>
            <option value="h3">Titulo H3</option>
            <option value="blockquote">Cita</option>
            <option value="codeBlock">Codigo</option>
          </select>
          <button
            aria-label="Negrita"
            className={`richTextToolbarButton ${editor?.isActive("bold") ? "isActive" : ""}`}
            disabled={!editor}
            type="button"
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold aria-hidden="true" size={16} strokeWidth={2.4} />
          </button>
          <button
            aria-label="Cursiva"
            className={`richTextToolbarButton ${editor?.isActive("italic") ? "isActive" : ""}`}
            disabled={!editor}
            type="button"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic aria-hidden="true" size={16} strokeWidth={2.4} />
          </button>
          <button
            aria-label="Tachado"
            className={`richTextToolbarButton ${editor?.isActive("strike") ? "isActive" : ""}`}
            disabled={!editor}
            type="button"
            onClick={() => editor?.chain().focus().toggleStrike().run()}
          >
            <Strikethrough aria-hidden="true" size={16} strokeWidth={2.4} />
          </button>
          <button
            aria-label="Lista con vinetas"
            className={`richTextToolbarButton ${editor?.isActive("bulletList") ? "isActive" : ""}`}
            disabled={!editor}
            type="button"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <List aria-hidden="true" size={16} strokeWidth={2.4} />
          </button>
          <button
            aria-label="Lista numerada"
            className={`richTextToolbarButton ${editor?.isActive("orderedList") ? "isActive" : ""}`}
            disabled={!editor}
            type="button"
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered aria-hidden="true" size={16} strokeWidth={2.4} />
          </button>
          <button
            aria-label="Limpiar formato"
            className="richTextToolbarButton"
            disabled={!editor}
            type="button"
            onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}
          >
            <RemoveFormatting aria-hidden="true" size={16} strokeWidth={2.4} />
          </button>
          <button
            aria-label="Deshacer"
            className="richTextToolbarButton"
            disabled={!editor?.can().undo()}
            type="button"
            onClick={() => editor?.chain().focus().undo().run()}
          >
            <Undo2 aria-hidden="true" size={16} strokeWidth={2.4} />
          </button>
          <button
            aria-label="Rehacer"
            className="richTextToolbarButton"
            disabled={!editor?.can().redo()}
            type="button"
            onClick={() => editor?.chain().focus().redo().run()}
          >
            <Redo2 aria-hidden="true" size={16} strokeWidth={2.4} />
          </button>
        </div>
        <EditorContent editor={editor} style={{ minHeight }} />
        <button className="adminButton adminButtonTiny richTextSourceToggle" type="button" aria-expanded={sourceOpen} onClick={() => setSourceOpen(!sourceOpen)}>
          {sourceOpen ? "Ocultar código HTML" : "Mostrar código HTML"}
        </button>
        {sourceOpen ? <textarea
          aria-label={`${label} HTML`}
          className="richTextSource"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
        /> : null}
      </div>
    </div>
  );
}

type EntitySelectorProps = {
  label: string;
  kind: "categories" | "brands";
  selectedId?: string;
  options: ProductLookupOption[];
  fieldError?: string;
  canCreate: boolean;
  onSelect(option: ProductLookupOption): void;
  createAction(input: CatalogCreateInput): Promise<{ ok: boolean; options: ProductLookupOption[]; option?: ProductLookupOption; message?: string; fieldErrors?: Record<string, string> }>;
};

function ProductEntitySelector({ label, kind, selectedId, options, fieldError, onSelect, createAction, canCreate }: EntitySelectorProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [localOptions, setLocalOptions] = useState(options);
  const selectedOption = localOptions.find(option => option.id === selectedId) ?? options.find(option => option.id === selectedId);
  const displayedOptions = selectedOption && !localOptions.some(option => option.id === selectedId) ? [selectedOption, ...localOptions] : localOptions;
  return (
    <>
    <div className="adminField productEntitySelector">
      <span>{label}</span>
      <div className="productEntitySelectorRow">
        <select aria-label={label} value={selectedId ?? ""} onChange={(event) => {
          const option = displayedOptions.find((item) => item.id === event.target.value);
          onSelect(option ?? {id: "", label: ""});
        }}>
          <option value="">Selecciona</option>
          {selectedId && !selectedOption ? <option value={selectedId}>Asignación no disponible</option> : null}
          {displayedOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        {canCreate ? <button className="adminButton" aria-label={kind === "categories" ? "Crear categoría" : "Crear marca o proveedor"} type="button" onClick={() => setDrawerOpen(true)}>
          <Plus aria-hidden="true" size={16} />
        </button> : null}
      </div>
      {localOptions.length === 0 ? <small>No hay opciones precargadas.</small> : null}
      {fieldError ? <small>{fieldError}</small> : null}
    </div>
      {drawerOpen && canCreate ? <AdminResourceDrawer drawerId={`product-inline-${kind}`} title={kind === "categories" ? "Crear categoría" : "Crear marca / proveedor"} description="Se creará en la tienda y el idioma actuales." onClose={() => setDrawerOpen(false)}>
        <AdminMutationForm label={kind === "categories" ? "Crear categoría" : "Crear marca"} className="adminForm" action={async (_state, data) => {
          const text = (key: string) => String(data.get(key) ?? "").trim();
          const result = await createAction({name: text("name"), slug: text("slug"), description: text("description"), title: text("title"), text: text("text"), siteTitle: text("siteTitle"), keywords: text("keywords"), isActive: data.get("isActive") === "on"});
          if (!result.ok || !result.option) return {error: result.message ?? "No se pudo crear el registro.", fieldErrors: result.fieldErrors};
          const option = result.option;
          setLocalOptions(current => [...current.filter(item => item.id !== option.id), option]);
          onSelect(option);
          setDrawerOpen(false);
          return {success: "Registro creado."};
        }}>
          <CatalogEntityFields kind={kind} />
          <button className="adminButton adminButtonPrimary" type="submit">Crear y asignar</button>
        </AdminMutationForm>
      </AdminResourceDrawer> : null}
    </>
  );
}

function ProductSaveDecision({ missing, preservingActive = false, onClose, onSave }: {
  missing: ReturnType<typeof getProductPublicationChecklist>;
  preservingActive?: boolean;
  onClose(): void;
  onSave(publish: boolean): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => { document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, []);
  return <dialog ref={dialog} className="productSaveDecision" aria-labelledby="product-save-decision-title" aria-describedby="product-save-decision-description" onCancel={onClose}>
    <h2 id="product-save-decision-title">{preservingActive ? "No se pueden guardar los cambios" : missing.length ? "Producto incompleto para publicar" : "Producto preparado para publicar"}</h2>
    <p id="product-save-decision-description">{preservingActive ? "Revisa los requisitos pendientes antes de guardar. No se ha enviado el guardado y el producto conserva su estado activo." : missing.length ? "Completa los requisitos pendientes o guarda un borrador para continuar después." : "Los requisitos de portada, precio y stock están completos. Elige cómo guardar."}</p>
    {missing.length ? <ul>{missing.map(item => <li key={item.id}>{item.message}</li>)}</ul> : null}
    <div className="adminButtonRow">
      <button className="adminButton" type="button" onClick={onClose}>Seguir editando</button>
      {!preservingActive ? <button className={missing.length ? "adminButton adminButtonPrimary" : "adminButton"} type="button" onClick={() => onSave(false)}>Guardar borrador</button> : null}
      {!preservingActive && !missing.length ? <button className="adminButton adminButtonPrimary" type="button" onClick={() => onSave(true)}>Publicar</button> : null}
    </div>
  </dialog>;
}

function ProductEditorActions({ productId, disabled }: {productId?: string; disabled: boolean}) {
  const popupId = useId();
  const popup = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({left: 0, top: 0});
  return <>
    <button className="adminButton productMoreActionsTrigger" aria-label="Más acciones del producto" popoverTarget={popupId} disabled={disabled} type="button" onClick={event => {
      const rect = event.currentTarget.getBoundingClientRect();
      setPosition({left: Math.max(8, Math.min(rect.right - 220, window.innerWidth - 228)), top: Math.max(8, rect.top - 152)});
    }}>⋯</button>
    <div className="productActionsPopover" id={popupId} popover="auto" ref={popup} style={position} role="group" aria-label="Más acciones del producto">
      {productId ? <Link className="adminButton" href={`/admin/products/new?duplicateFrom=${encodeURIComponent(productId)}`} onClick={() => popup.current?.hidePopover()}>
        <Copy aria-hidden="true" size={16} />Duplicar
      </Link> : <button className="adminButton" disabled type="button" title="Guarda el producto antes de duplicarlo"><Copy aria-hidden="true" size={16} />Duplicar</button>}
      <Link className="adminButton" href="/admin/products/new" onClick={() => popup.current?.hidePopover()}><Plus aria-hidden="true" size={16} />Crear otro producto</Link>
      {productId ? <form action={deactivateProductAction} onSubmit={event => {
        if (!window.confirm("¿Desactivar este producto? Se ocultará de la tienda y sus rutas dejarán de aparecer en el sitemap.")) event.preventDefault();
        popup.current?.hidePopover();
      }}>
        <input name="productId" type="hidden" value={productId} />
        <input name="returnTo" type="hidden" value="/admin/products" />
        <input name="confirmDeactivate" type="hidden" value="yes" />
        <button className="adminButton productActionsDanger" type="submit"><Trash2 aria-hidden="true" size={16} />Desactivar</button>
      </form> : null}
    </div>
  </>;
}

export function ProductEditorClient({
  contextIdentity,
  canDeleteProducts = false,
  deletionContext,
  canManageFeatures = false,
  canCreateCategories = false,
  canCreateBrands = false,
  initialDraft,
  initialVariantRows = [],
  locale,
  currency,
  lookups = defaultProductEditorLookups,
  initialPreviewOpen = false,
  initialNotice,
  storageScope,
}: ProductEditorClientProps) {
  const storageKey = useMemo(
    () => localStorageKey(initialDraft, locale, currency, contextIdentity, storageScope),
    [contextIdentity, currency, initialDraft, locale, storageScope],
  );
  const editorInstanceKey = `${contextIdentity}:${storageScope ?? initialDraft.productId ?? "new"}:${locale}:${currency}`;

  return (
	    <ProductEditorClientInner
	      key={editorInstanceKey}
	      initialDraft={initialDraft}
	      initialVariantRows={initialVariantRows}
	      canDeleteProducts={canDeleteProducts}
      deletionContext={deletionContext}
      canManageFeatures={canManageFeatures}
      canCreateCategories={canCreateCategories}
      canCreateBrands={canCreateBrands}
      locale={locale}
      currency={currency}
      lookups={lookups}
      storageKey={storageKey}
      initialPreviewOpen={initialPreviewOpen}
      initialNotice={initialNotice}
    />
  );
}

function ProductEditorClientInner({
  initialDraft,
  initialVariantRows = [],
  canDeleteProducts = false,
  deletionContext,
  canManageFeatures = false,
  canCreateCategories = false,
  canCreateBrands = false,
  locale,
  currency,
  lookups = defaultProductEditorLookups,
  storageKey,
  initialPreviewOpen = false,
  initialNotice,
}: ProductEditorClientInnerProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<ProductDraft>(initialDraft);
  const warehouseOptions = lookups.warehouses ?? [];
  const [taxLookups, setTaxLookups] = useState(lookups.taxes);
  const [taxReloadMessage, setTaxReloadMessage] = useState<string>();
  const [taxReloadSucceeded, setTaxReloadSucceeded] = useState(false);
  const [taxReloadPending, startTaxReload] = useTransition();
  const [stockWarehouseLoading, setStockWarehouseLoading] = useState(false);
  const [stockWarehouseMessage, setStockWarehouseMessage] = useState<string>();
  // Only initial BFF data and a save acknowledgement can change this snapshot.
  // Local recovery drafts must never turn an active product into an inactive one.
  const [persistedPublication, setPersistedPublication] = useState({
    isActive: Boolean(initialDraft.productId && initialDraft.basic.isActive),
    isVisible: initialDraft.basic.isVisible,
  });
  const [storedDraft, setStoredDraft] = useState<ProductDraft | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("basic");
  const [dirty, setDirty] = useState(false);
  const [saveDecisionOpen, setSaveDecisionOpen] = useState(false);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(draft.media.items[0]?.localId ?? null);
  const [selectedVariantKey, setSelectedVariantKey] = useState<string>("default");
  const [variantAttributeFields, setVariantAttributeFields] = useState(lookups.variantAttributeFields);
  const [attributeManagerOpen, setAttributeManagerOpen] = useState(false);
  const [attributeGroups, setAttributeGroups] = useState(lookups.specificationGroups ?? []);
  const [attributeLoadError, setAttributeLoadError] = useState<string | null>(null);
  const [specificPriceForm, setSpecificPriceForm] = useState<SpecificPriceFormState>(() =>
    defaultSpecificPriceForm(editorBasePrice(initialDraft), "__product__"),
  );
  const [specificPriceEditIndex, setSpecificPriceEditIndex] = useState<number | null>(null);
  const [specificPriceDateError, setSpecificPriceDateError] = useState<string | null>(null);
  const [specificPriceDrawerOpen, setSpecificPriceDrawerOpen] = useState(false);
  const closeSpecificPriceDrawer = useCallback(() => {
    setSpecificPriceDrawerOpen(false);
    setSpecificPriceDateError(null);
  }, []);
  const [pricingPreviewDateError, setPricingPreviewDateError] = useState<string | null>(null);
  const [pricingPreviewForm, setPricingPreviewForm] = useState<PricingPreviewFormState>(() =>
    defaultPricingPreviewForm(editorBasePrice(initialDraft), "__product__"),
  );
  const [pricingPreviewResult, setPricingPreviewResult] = useState<ProductAppliedPricePreview | null>(null);
  const [pricingPreviewBusy, setPricingPreviewBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(initialPreviewOpen);
  const [filesByLocalId, setFilesByLocalId] = useState<Record<string, File>>({});
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const [mediaPickerBusy, setMediaPickerBusy] = useState(false);
  const [mediaPickerMessage, setMediaPickerMessage] = useState<string | null>(null);
  const [generatorSelections, setGeneratorSelections] = useState<Record<string, string[]>>({});
  const [generatingVariants, setGeneratingVariants] = useState(false);
  const generationVersion = useRef(0);
  useEffect(() => {
    generationVersion.current += 1;
  }, [draft.basic.categoryId]);
  const [variantMessage, setVariantMessage] = useState<string | null>(null);
  const [brokenMediaPreviewIds, setBrokenMediaPreviewIds] = useState<Record<string, true>>({});
  const [offeringMessage, setOfferingMessage] = useState<{
    text: string;
    tone: "error" | "info" | "success";
  } | null>(null);
  const [offeringPrerequisiteNoticeDismissed, setOfferingPrerequisiteNoticeDismissed] = useState(false);
  const [offeringPickerOpen, setOfferingPickerOpen] = useState(false);
  const [offeringPickerStep, setOfferingPickerStep] = useState<OfferingPickerStep>("list");
  const [offeringPickerOfferingId, setOfferingPickerOfferingId] = useState<string | null>(null);
  const [variantAttributePickerOpen, setVariantAttributePickerOpen] = useState(false);
  const [variantAttributePickerStep, setVariantAttributePickerStep] = useState<VariantAttributePickerStep>("fields");
  const [variantAttributePickerFieldId, setVariantAttributePickerFieldId] = useState<string | null>(null);
  const [featureFields, setFeatureFields] = useState(lookups.specificationFields);
  const [featureGroups, setFeatureGroups] = useState(lookups.specificationGroups ?? []);
  const [featureLoadError, setFeatureLoadError] = useState(lookups.specificationLoadError);
  const [featureManagerOpen, setFeatureManagerOpen] = useState(false);
  const [featureSearch, setFeatureSearch] = useState("");
  const [featureRefreshing, setFeatureRefreshing] = useState(false);
  const [specificationPickerOpen, setSpecificationPickerOpen] = useState(false);
  const [specificationPickerStep, setSpecificationPickerStep] = useState<SpecificationPickerStep>("fields");
  const [specificationPickerFieldId, setSpecificationPickerFieldId] = useState<string | null>(null);
  const [report, setReport] = useState<ProductSaveReport | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const saveAttemptRef = useRef<ProductSaveAttempt | null>(null);
  const hydratedRemoteDraftIdsRef = useRef<Set<string>>(new Set());
  const savingActive = isSaving || isPending;
  const selectedMedia = draft.media.items.find((item) => item.localId === selectedMediaId) ?? draft.media.items[0];
  const productStatus = productPublicationLabel(draft.productId, persistedPublication.isActive);
  const selectedSpecifications = useMemo(() => {
    return draft.specifications.selections
      .filter((selection) => !selection.markedForDeletion)
      .map((selection) => {
        const field = featureFields.find((item) => item.fieldId === selection.fieldId) ?? {
          fieldId: selection.fieldId,
          groupId: selection.groupId ?? "",
          groupName: selection.groupId ?? "Caracteristica",
          name: selection.fieldName ?? selection.fieldId,
          isStockKeepingUnit: false,
          isActive: false,
          values: [],
        };
        const value = field.values.find((item) => item.fieldValueId === selection.fieldValueId) ?? {
          fieldValueId: selection.fieldValueId,
          name: selection.valueName ?? selection.fieldValueId,
          isActive: false,
        };
        return { field, selection, value };
      })
      .filter((item) => item.selection.fieldId && item.selection.fieldValueId);
  }, [draft.specifications.selections, featureFields]);
  function mergeFeatureCatalog(catalog: ReturnType<typeof productSpecificationCatalog>) {
    setFeatureFields(current => [...current.filter(field => !catalog.groups.some(group => group.groupId === field.groupId)), ...catalog.fields]);
    setFeatureGroups(current => [...current.filter(group => !catalog.groups.some(item => item.groupId === group.groupId)), ...catalog.groups]);
  }
  async function refreshFeatureCatalog() {
    setFeatureRefreshing(true);
    try {
      const result = await loadProductFeaturesAction();
      if (result.ok) { setFeatureFields(result.catalog.fields); setFeatureGroups(result.catalog.groups); setFeatureLoadError(undefined); }
      else setFeatureLoadError(result.message);
    } catch { setFeatureLoadError("No se pudieron actualizar las características. Inténtalo de nuevo."); } finally { setFeatureRefreshing(false); }
  }
  const specificationPickerField = specificationPickerFieldId
    ? featureFields.find((field) => field.fieldId === specificationPickerFieldId)
    : undefined;
  const variantRowsById = useMemo(
    () => new Map(initialVariantRows.map((row) => [row.variantId, row])),
    [initialVariantRows],
  );
  const allVariantRows = useMemo<ProductVariantRowView[]>(() => {
    const hasDirectMediaForKey = (variantKey: string) => Boolean(ownVariantImage(draft, variantKey));
    const productName = draft.basic.name || "Producto";
    const productRefId = draft.defaultVariant.refId || "Sin referencia";
    const productPresentation = draft.defaultVariantId ? variantRowsById.get(draft.defaultVariantId) : undefined;
    const productDirectMedia = hasDirectMediaForKey("default");

    return [
      {
        localId: "default",
        variantId: draft.defaultVariantId,
        name: productName,
        refId: draft.defaultVariant.refId,
        ean: draft.defaultVariant.ean ?? null,
        options: [],
        isActive: draft.basic.isActive,
        isVisible: draft.basic.isVisible,
        isDefault: true,
        role: productPresentation?.role ?? (draft.variants.length > 0 ? "PRODUCT_DEFAULT" : "PRODUCT_SIMPLE"),
        displayLabel: productPresentation?.displayLabel ?? `Producto - ${productName}`,
        selectorLabel: productPresentation?.selectorLabel ?? `Producto - ${productName} (${productRefId})`,
        effectiveMediaSource: productDirectMedia ? "DIRECT" : "NONE",
      },
      ...draft.variants.map((variant, index): ProductVariantRowView => {
        const presentation = variant.variantId ? variantRowsById.get(variant.variantId) : undefined;
        const directMedia = hasDirectMediaForKey(variant.localId);
        const inheritsFromProduct = !directMedia && productDirectMedia;
        const labelBase = variant.name || variant.refId || `Variante ${index + 1}`;

        return {
          ...variant,
          isDefault: false,
          role: presentation?.role ?? "VARIANT",
          displayLabel: presentation?.displayLabel ?? `Variante ${index + 1} - ${labelBase}`,
          selectorLabel: presentation?.selectorLabel ?? `Variante ${index + 1} - ${labelBase} (${variant.refId || "Sin referencia"})`,
          effectiveMediaSource: directMedia ? "DIRECT" : inheritsFromProduct ? "DEFAULT_VARIANT" : "NONE",
        };
      }),
    ];
  }, [draft, variantRowsById]);
  const selectedVariant =
    allVariantRows.find((variant) => variant.localId === selectedVariantKey || variant.variantId === selectedVariantKey) ??
    allVariantRows[0];
  const offeringTargetVariant = selectedVariant;
  const offeringTargetKey = offeringTargetVariant?.localId ?? "default";
  const offeringsForTarget = draft.offerings.byVariant[offeringTargetKey] ?? [];
  const offeringPickerOffering = offeringPickerOfferingId
    ? lookups.offerings.find((offering) => offering.offeringId === offeringPickerOfferingId)
    : undefined;
  const activeSelectedVariantOptions = selectedVariant.options.filter((option) => !option.markedForDeletion && option.isActive !== false);
  const variantAttributePickerField = variantAttributePickerFieldId
    ? variantAttributeFields.find((field) => field.fieldId === variantAttributePickerFieldId)
    : undefined;
  const productPrice = editorBasePrice(draft);
  const selectedPanelOwnPrice = selectedVariant.isDefault ? undefined : scopedDraftValue(draft.pricing.variantPrices, selectedVariant);
  const selectedPanelHasOwnPrice = Boolean(selectedPanelOwnPrice && !selectedPanelOwnPrice.markedForDeletion);
  const selectedPanelPrice = selectedPanelHasOwnPrice ? selectedPanelOwnPrice : productPrice;
  const selectedPanelStock = selectedVariant.isDefault ? { key: "default", stock: stockForKey("default"), mode: "own" } : stockForVariantRow(selectedVariant);
  const basePriceVariantKey = editorBasePriceVariantKey(draft);
  const inheritPriceLabel = basePriceVariantKey ? "Heredar precio de la variante 0" : "Heredar precio del producto";
  const basePriceTaxErrorKey = basePriceVariantKey
    ? `pricing.variantPrices:${basePriceVariantKey}:tax`
    : "pricing.productPrice.tax";
  const selectedTax =
    productPrice?.tax ??
    taxLookups.find((tax) => tax.id === productPrice?.taxCode || tax.taxCode === productPrice?.taxCode);
  const selectedPanelTaxErrorKey = selectedVariant.isDefault ? basePriceTaxErrorKey : `pricing.variantPrices:${selectedVariant.localId}:tax`;
  const selectedPanelTax = selectedPanelPrice?.tax ?? taxLookups.find((tax) => tax.id === selectedPanelPrice?.taxCode || tax.taxCode === selectedPanelPrice?.taxCode);
  const selectedPanelTaxOptions = selectedPanelTax && !taxLookups.some((tax) => tax.id === selectedPanelTax.id) ? [selectedPanelTax, ...taxLookups] : taxLookups;
  const taxOptions = selectedTax && !taxLookups.some((tax) => tax.id === selectedTax.id)
    ? [selectedTax, ...taxLookups]
    : taxLookups;
  const selectedPriceTable = productPrice?.priceTableId
    ? lookups.priceTables.find((table) => table.id === productPrice.priceTableId) ?? {
        id: productPrice.priceTableId,
        label: productPrice.priceTableId,
      }
    : null;
  const priceTableOptions = selectedPriceTable && !lookups.priceTables.some((table) => table.id === selectedPriceTable.id)
    ? [selectedPriceTable, ...lookups.priceTables]
    : lookups.priceTables;
  const specificChannelOptions = lookupOptionsWithCurrent(lookups.channels, specificPriceForm.channel);
  const specificTradePolicyOptions = lookupOptionsWithCurrent(lookups.tradePolicies, specificPriceForm.tradePolicy);
  const specificCountryOptions = lookupOptionsWithCurrent(lookups.countries, specificPriceForm.country);
  const specificCustomerGroupOptions = lookupOptionsWithCurrent(lookups.customerGroups, specificPriceForm.customerGroup);
  const previewChannelOptions = lookupOptionsWithCurrent(lookups.channels, pricingPreviewForm.channel);
  const previewTradePolicyOptions = lookupOptionsWithCurrent(lookups.tradePolicies, pricingPreviewForm.tradePolicy);
  const previewCountryOptions = lookupOptionsWithCurrent(lookups.countries, pricingPreviewForm.country);
  const previewCustomerGroupOptions = lookupOptionsWithCurrent(lookups.customerGroups, pricingPreviewForm.customerGroup);
  const pricingTaxWarning = taxReloadSucceeded ? undefined : lookups.warnings.find((warning) => warning.startsWith("Pricing taxes:"));
  const priceVariantRows = draft.variants;
  const specificPrices = draft.pricing.specificPrices ?? [];
  const visibleSpecificPrices = specificPrices.filter((price) => !price.markedForDeletion);
  const specificPriceTargetOptions = [
    {
      key: "__product__",
      label: "Producto completo",
      refId: draft.defaultVariant.refId || "Todas las combinaciones",
    },
    ...priceVariantRows.map((variant) => ({
      key: variant.localId,
      label: variant.name || variant.refId || "Variante",
      refId: variant.refId,
    })),
  ];
  const auditContext = (price: { country?: string | null; channel?: string | null; tradePolicy?: string | null; customerGroup?: string | null; priceTableId?: string | null }) => [
    price.country && `País: ${price.country}`, price.channel && `Canal: ${price.channel}`,
    price.tradePolicy && `Política: ${price.tradePolicy}`, price.customerGroup && `Grupo: ${price.customerGroup}`,
    price.priceTableId && `Tabla: ${price.priceTableId}`,
  ].filter(Boolean).join(" · ") || "Todos";
  const auditValidity = (price: { validFrom?: string | null; validUntil?: string | null }) =>
    `${price.validFrom ? isoToDateTimeLocal(price.validFrom).replace("T", " ") : "Sin inicio"} → ${price.validUntil ? isoToDateTimeLocal(price.validUntil).replace("T", " ") : "Sin fin"}`;
  const seenAuditPrices = new Set<string>();
  const auditPriceRows = [
    ...Object.entries({ ...(draft.pricing.productPrice ? { __product__: draft.pricing.productPrice } : {}), ...draft.pricing.variantPrices }).flatMap(([key, price]) => {
      if (!price || price.markedForDeletion || (price.pricingId && seenAuditPrices.has(price.pricingId))) return [];
      if (price.pricingId) seenAuditPrices.add(price.pricingId);
      const variant = allVariantRows.find(row => row.localId === key || row.variantId === key);
      return [{ key: `base-${key}`, name: key === "__product__" ? draft.basic.name || "Producto" : variant?.name || variant?.refId || key,
        type: "Precio habitual", amount: formatMoney(price.basePriceMinor, price.currency || currency, locale), quantity: 1,
        context: auditContext(price), validity: auditValidity(price), active: price.active !== false }];
    }),
    ...specificPrices.flatMap((price, index) => price.markedForDeletion ? [] : [{ key: `specific-${index}`, name: specificPriceTargetLabel(price),
      type: "Precio específico", amount: price.fixedPriceMinor == null ? "—" : formatMoney(price.fixedPriceMinor, price.currency || currency, locale),
      quantity: price.minQuantity || 1, context: auditContext(price), validity: auditValidity(price), active: price.active }]),
  ];
  const specificPriceTarget = specificPriceTargetOptions.find((target) => target.key === specificPriceForm.targetKey) ?? specificPriceTargetOptions[0];
  const pricingPreviewTarget =
    pricingPreviewForm.targetKey === "__product__"
      ? allVariantRows[0]
      : allVariantRows.find((variant) => variant.localId === pricingPreviewForm.targetKey || variant.variantId === pricingPreviewForm.targetKey);
  const publicationChecklist = useMemo(() => getProductPublicationChecklist(draft), [draft]);
  const allowedCarrierOptions = draft.shipping.allowedCarrierIds
    .filter((carrierId) => !lookups.carriers.some((carrier) => carrier.id === carrierId))
    .map((carrierId) => ({ id: carrierId, label: carrierId }));
  const carrierOptions = [...lookups.carriers, ...allowedCarrierOptions];
  const shippingPackage = { ...draft.shipping.package, ...(!selectedVariant.isDefault ? selectedVariant.shippingPackage ?? {} : {}) };
  const shippingDimensionsComplete = Boolean(
    shippingPackage.widthMm &&
      shippingPackage.heightMm &&
      shippingPackage.depthMm,
  );
  const categoryOptions = useMemo(() => {
    if (!draft.basic.categoryId || !draft.basic.categoryName || lookups.categories.some((item) => item.id === draft.basic.categoryId)) {
      return lookups.categories;
    }

    return [{ id: draft.basic.categoryId, label: draft.basic.categoryName }, ...lookups.categories];
  }, [draft.basic.categoryId, draft.basic.categoryName, lookups.categories]);
  const brandOptions = useMemo(() => {
    if (!draft.basic.brandId || !draft.basic.brandName || lookups.brands.some((item) => item.id === draft.basic.brandId)) {
      return lookups.brands;
    }

    return [{ id: draft.basic.brandId, label: draft.basic.brandName }, ...lookups.brands];
  }, [draft.basic.brandId, draft.basic.brandName, lookups.brands]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setStoredDraft(readStoredDraft(storageKey, initialDraft));
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [initialDraft, storageKey]);

  useEffect(() => {
    const clientDraftId = draft.clientDraftId?.trim();
    if (!clientDraftId || hydratedRemoteDraftIdsRef.current.has(clientDraftId)) {
      return;
    }

    hydratedRemoteDraftIdsRef.current.add(clientDraftId);
    let cancelled = false;

    void (async () => {
      const result = await readProductDraftMediaStateAction(clientDraftId);
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setMediaPickerMessage(result.messages?.[0] ?? result.fieldErrors?.media ?? null);
        return;
      }

      if(!remoteProductIdentityMatches({productId:initialDraft.productId,defaultVariantId:initialDraft.defaultVariantId,mediaCollectionId:initialDraft.mediaCollectionId},result)){setMediaPickerMessage("El borrador remoto pertenece a otra ficha. Recarga antes de recuperar sus imágenes.");return;}
      if (result.mediaItems.length === 0 && !result.productId && !result.mediaCollectionId) {
        return;
      }

      setDraft((current) =>
        current.clientDraftId === clientDraftId
          ? mergeRemoteDraftMediaState(current, result)
          : current,
      );
      setSelectedMediaId((current) => current ?? result.mediaItems[0]?.localId ?? null);
      setMediaPickerMessage(result.mediaItems.length > 0 ? `${result.mediaItems.length} imagen(es) recuperada(s) del borrador remoto.` : null);
    })();

    return () => {
      cancelled = true;
    };
  }, [draft.clientDraftId,initialDraft.productId,initialDraft.defaultVariantId,initialDraft.mediaCollectionId]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) {
        return;
      }

      event.preventDefault();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    // Keep the acknowledged IDs too: a successful write does not guarantee
    // that the asynchronous read projection can reopen the product yet.
    if (!dirty && !report?.productId) {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(sanitizeDraftForStorage(draft)));
  }, [dirty, draft, report?.productId, storageKey]);

  function updateDraft(updater: (current: ProductDraft) => ProductDraft) {
    setDraft((current) => normalizeVariantMedia(updater(current)));
    setDirty(true);
  }

  function mediaPreviewSrc(item: ProductDraftMediaItem | undefined) {
    if (!item || brokenMediaPreviewIds[item.localId]) {
      return undefined;
    }

    if (isEphemeralPreviewUrl(item.previewUrl)) {
      return item.previewUrl;
    }

    return mediaAssetPreviewUrl(item.mediaAssetId) ?? item.previewUrl;
  }

  function hasRenderableMediaPreview(item: ProductDraftMediaItem | undefined) {
    return Boolean(mediaPreviewSrc(item));
  }

  function markMediaPreviewBroken(localId: string) {
    setBrokenMediaPreviewIds((current) => ({ ...current, [localId]: true }));
  }

  function openProductPreview() {
    setPreviewOpen(true);
  }

  function setOfferingsForVariant(variantKey: string, offerings: ProductDraft["offerings"]["byVariant"][string]) {
    setDraft((current) => ({
      ...current,
      offerings: {
        ...current.offerings,
        byVariant: {
          ...current.offerings.byVariant,
          [variantKey]: offerings,
        },
      },
    }));
  }

  function updateBasic(field: keyof ProductDraft["basic"], value: string | boolean) {
    if (field === "categoryId") {
      generationVersion.current += 1;
      setGeneratorSelections({});
    }
    updateDraft((current) => {
      const previousSlug = current.basic.slug;
      const nextBasic = {
        ...current.basic,
        [field]: value,
      };

      if (field === "name" && typeof value === "string") {
        const previousAutoSlug = slugifyProductValue(current.basic.name);
        if (!current.basic.slug || current.basic.slug === previousAutoSlug) {
          nextBasic.slug = slugifyProductValue(value);
        }
        if (!current.defaultVariant.refId || current.defaultVariant.refId === makeRefIdFromName(current.basic.name)) {
          return {
            ...current,
            basic: nextBasic,
            routingSeo: nextRoutingSeoForSlug(current, previousSlug, nextBasic.slug),
            defaultVariant: {
              ...current.defaultVariant,
              name: value,
              refId: makeRefIdFromName(value),
            },
          };
        }
      }

      return {
        ...current,
        basic: nextBasic,
        routingSeo: field === "slug" && typeof value === "string"
          ? nextRoutingSeoForSlug(current, previousSlug, value)
          : current.routingSeo,
        ...(field === "name" && typeof value === "string"
          ? {
              defaultVariant: {
                ...current.defaultVariant,
                name: value,
              },
            }
          : {}),
      };
    });
  }

  function updateRoutingSeo(updater: (routingSeo: ProductDraft["routingSeo"]) => ProductDraft["routingSeo"]) {
    updateDraft((current) => ({
      ...current,
      routingSeo: updater(current.routingSeo),
    }));
  }

  function updateRoutingSeoAlias(index: number, updater: (alias: ProductDraft["routingSeo"]["aliases"][number]) => ProductDraft["routingSeo"]["aliases"][number]) {
    updateRoutingSeo((routingSeo) => ({
      ...routingSeo,
      aliases: routingSeo.aliases.map((alias, aliasIndex) => {
        if (aliasIndex !== index) {
          return alias;
        }
        const updatedAlias = updater(alias);
        return {
          routeId: updatedAlias.routeId,
          path: updatedAlias.path,
          routeKind: "ALIAS",
          status: updatedAlias.status,
          includeInSitemap: false,
          updatedAt: updatedAlias.updatedAt,
          markedForDeletion: updatedAlias.markedForDeletion,
        };
      }),
    }));
  }

  function addRoutingSeoAlias() {
    updateRoutingSeo((routingSeo) => ({
      ...routingSeo,
      aliases: [
        ...routingSeo.aliases,
        {
          path: "",
          routeKind: "ALIAS",
          status: "ACTIVE",
          includeInSitemap: false,
        },
      ],
    }));
  }

  function removeRoutingSeoAlias(index: number) {
    updateRoutingSeo((routingSeo) => ({
      ...routingSeo,
      aliases: routingSeo.aliases
        .map((alias, aliasIndex) => aliasIndex === index
          ? alias.routeId
            ? { ...alias, status: "INACTIVE", includeInSitemap: false, markedForDeletion: true }
            : null
          : alias)
        .filter((alias): alias is ProductDraft["routingSeo"]["aliases"][number] => Boolean(alias)),
    }));
  }

  function updateSpecificationSelection(fieldId: string, fieldValueId: string) {
    updateDraft((current) => {
      const field = featureFields.find((item) => item.fieldId === fieldId);
      const value = field?.values.find((item) => item.fieldValueId === fieldValueId);
      const remaining = current.specifications.selections.filter((selection) => selection.fieldId !== fieldId);

      return {
        ...current,
        specifications: {
          productId: current.productId,
          selections: value && field
            ? [
                ...remaining,
                {
                  fieldId,
                  fieldValueId,
                  groupId: field.groupId,
                  fieldName: field.name,
                  valueName: value.name,
                },
              ]
            : remaining,
        },
        saveState: {
          ...current.saveState,
          specifications: "pending",
        },
      };
    });
  }

  function openSpecificationPicker() {
    setFeatureSearch("");
    setSpecificationPickerStep("fields");
    setSpecificationPickerFieldId(null);
    setSpecificationPickerOpen(true);
  }

  function openSpecificationValues(field: ProductSpecificationLookupField) {
    setSpecificationPickerFieldId(field.fieldId);
    setSpecificationPickerStep("values");
    setSpecificationPickerOpen(true);
  }

  function closeSpecificationPicker() {
    setSpecificationPickerOpen(false);
    setSpecificationPickerStep("fields");
    setSpecificationPickerFieldId(null);
  }

  function goBackToSpecificationFields() {
    setSpecificationPickerStep("fields");
    setSpecificationPickerFieldId(null);
  }

  function removeSpecificationSelection(fieldId: string) {
    updateSpecificationSelection(fieldId, "");
  }

  function addFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (!files.length) {
      return;
    }

    const newItems = files.map((file, index) => ({
      ...makeProductMediaItem({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        productName: draft.basic.name,
        locale,
        index: draft.media.items.length + index,
        previewUrl: URL.createObjectURL(file),
        isMain: false,
      }),
      uploadStatus: "uploading" as const,
    }));

    setFilesByLocalId((currentFiles) => {
      const nextFiles = { ...currentFiles };
      newItems.forEach((item, index) => {
        nextFiles[item.localId] = files[index];
      });
      return nextFiles;
    });
    setSelectedMediaId(newItems[0]?.localId ?? selectedMediaId);

    updateDraft((current) => {
      return {
        ...current,
        media: {
          ...current.media,
          items: [...current.media.items, ...newItems],
        },
      };
    });

    void uploadSelectedMediaItems(newItems, files);
  }

  async function uploadSelectedMediaItems(items: ProductDraftMediaItem[], files: File[]) {
    const uploadedItems: ProductDraftMediaUploadReport["mediaItem"][] = [];
    for (const [index, item] of items.entries()) {
      const uploadedItem = await uploadSingleMediaItem(item, files[index], draft.media.items.length + index);
      if (uploadedItem) {
        uploadedItems.push(uploadedItem);
      }
    }

    if (uploadedItems.length > 0) {
      await confirmUploadedMediaIsOperational(draft.clientDraftId, uploadedItems);
    }

    setMediaPickerMessage(
      uploadedItems.length === items.length
        ? `${uploadedItems.length} imagen(es) subida(s) al borrador.`
        : `${uploadedItems.length}/${items.length} imagen(es) subidas. Revisa las marcadas con error.`,
    );
  }

  async function uploadSingleMediaItem(item: ProductDraftMediaItem, file: File | undefined, position: number) {
    if (!file) {
      markMediaUploadFailed(item.localId, "No se encontro el archivo local para subir.");
      return null;
    }

    const formData = new FormData();
    formData.set("fileLocalId", item.localId);
    formData.set("idempotencyKey", crypto.randomUUID());
    formData.set("metadata", JSON.stringify({
      alt: item.alt,
      title: item.title,
      isMain: item.isMain,
      position,
      active: item.active,
      productId: draft.productId,
      defaultVariantId: draft.defaultVariantId,
      mediaCollectionId: draft.mediaCollectionId,
      categoryId: draft.basic.categoryId || undefined,
      brandId: draft.basic.brandId || undefined,
    }));
    formData.set("file", file);

    try {
      const result = await uploadProductDraftMediaAction(draft.clientDraftId, formData);
      if (!result.ok || !result.mediaItem) {
        markMediaUploadFailed(item.localId, result.messages?.[0] ?? result.fieldErrors?.media ?? "No se pudo subir la imagen.");
        return null;
      }

      if(!remoteProductIdentityMatches(draft,result)){markMediaUploadFailed(item.localId,"La respuesta de subida pertenece a otra ficha. No se ha cambiado la identidad del producto.");return null;}
      setDraft((current) => remoteProductIdentityMatches(current,result)?({
        ...current,
        productId: result.productId ?? current.productId,
        defaultVariantId: result.defaultVariantId ?? current.defaultVariantId,
        mediaCollectionId: result.mediaCollectionId ?? current.mediaCollectionId,
        media: {
          ...current.media,
          items: current.media.items.map((currentItem) =>
            currentItem.localId === item.localId
              ? {
                  ...currentItem,
                  ...result.mediaItem,
                  localId: currentItem.localId,
                  previewUrl: result.mediaItem?.previewUrl ?? currentItem.previewUrl,
                  isMain: currentItem.isMain,
                  active: currentItem.active,
                  alt: currentItem.alt,
                  title: currentItem.title,
                  metadataDirty: currentItem.metadataDirty,
                  uploadStatus: "uploaded",
                  uploadError: undefined,
                  persisted: true,
                }
              : currentItem,
          ),
        },
        saveState: {
          ...current.saveState,
          media: "success",
        },
      }):current);
      setFilesByLocalId((currentFiles) => {
        const nextFiles = { ...currentFiles };
        delete nextFiles[item.localId];
        return nextFiles;
      });
      setDirty(true);
      return result.mediaItem;
    } catch (error) {
      markMediaUploadFailed(item.localId, error instanceof Error ? error.message : "No se pudo subir la imagen.");
      return null;
    }
  }

  async function confirmUploadedMediaIsOperational(
    clientDraftId: string,
    uploadedItems: ProductDraftMediaUploadReport["mediaItem"][],
  ) {
    const normalizedClientDraftId = clientDraftId.trim();
    if (!normalizedClientDraftId) {
      router.refresh();
      return;
    }

    for (let attempt = 1; attempt <= remoteMediaConfirmationAttempts; attempt += 1) {
      const result = await readProductDraftMediaStateAction(normalizedClientDraftId);
      if (result.ok) {
        if(!remoteProductIdentityMatches(draft,result)){setMediaPickerMessage("El borrador remoto pertenece a otra ficha. No se han adoptado sus imágenes.");return;}
        setDraft((current) =>
          current.clientDraftId === normalizedClientDraftId
            ? mergeRemoteDraftMediaState(current, result)
            : current,
        );
        setSelectedMediaId((current) => current ?? result.mediaItems[0]?.localId ?? null);

        if (remoteMediaContainsUploadedAssets(result.mediaItems, uploadedItems)) {
          router.refresh();
          return;
        }
      }

      if (attempt < remoteMediaConfirmationAttempts) {
        await delay(remoteMediaConfirmationDelayMs);
      }
    }

    router.refresh();
  }

  function markMediaUploadFailed(localId: string, message: string) {
    setDraft((current) => ({
      ...current,
      media: {
        ...current.media,
        items: current.media.items.map((item) =>
          item.localId === localId
            ? {
                ...item,
                uploadStatus: "failed",
                uploadError: message,
                persisted: false,
              }
            : item,
        ),
      },
      saveState: {
        ...current.saveState,
        media: "failed",
      },
    }));
    setDirty(true);
  }

  function openMediaFilePicker() {
    if (mediaPickerBusy) {
      return;
    }

    setMediaPickerBusy(true);
    setMediaPickerMessage("Abriendo selector de archivos...");
    mediaFileInputRef.current?.click();

    const releasePicker = () => {
      window.setTimeout(() => setMediaPickerBusy(false), 250);
    };
    window.addEventListener("focus", releasePicker, { once: true });
    window.setTimeout(() => setMediaPickerBusy(false), 3000);
  }

  function handleMediaFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    addFiles(event.currentTarget.files);
    event.currentTarget.value = "";
    setMediaPickerBusy(false);
    setMediaPickerMessage(files.length > 0 ? `${files.length} imagen(es) anadida(s) al borrador.` : "No se seleccionaron archivos.");
  }

  function updateMedia(localId: string, updater: (item: ProductDraftMediaItem) => ProductDraftMediaItem) {
    updateDraft((current) => ({
      ...current,
      media: {
        ...current.media,
        items: current.media.items.map((item) => item.localId === localId ? { ...updater(item), metadataDirty: true } : item),
      },
    }));
  }

  function removeMedia(localId: string) {
    updateDraft((current) => {
      const removedItem = current.media.items.find((item) => item.localId === localId);
      const remaining = current.media.items.filter((item) => item.localId !== localId);
      const nextItems = remaining;
      const nextRemovedItems = removedItem?.persisted && removedItem.mediaAssetId
        ? [
            ...(current.media.removedItems ?? []).filter((item) => item.mediaAssetId !== removedItem.mediaAssetId),
            removedItem,
          ]
        : current.media.removedItems ?? [];
      const nextAssignments = Object.fromEntries(
        Object.entries(current.media.assignments).map(([variantKey, assignedIds]) => [
          variantKey,
          assignedIds.filter((assignedId) => assignedId !== localId),
        ]),
      );
      const nextMainByVariant = Object.fromEntries(
        Object.entries(current.media.mainByVariant)
          .filter(([, mediaLocalId]) => mediaLocalId !== localId)
          .map(([variantKey, mediaLocalId]) => [
            variantKey,
            nextAssignments[variantKey]?.includes(mediaLocalId)
              ? mediaLocalId
              : nextAssignments[variantKey]?.[0],
          ])
          .filter((entry): entry is [string, string] => Boolean(entry[1])),
      );

      setFilesByLocalId((currentFiles) => {
        const nextFiles = { ...currentFiles };
        delete nextFiles[localId];
        return nextFiles;
      });
      setSelectedMediaId(nextItems[0]?.localId ?? null);

      return {
        ...current,
        media: {
          ...current.media,
          items: nextItems,
          removedItems: nextRemovedItems,
          assignments: nextAssignments,
          mainByVariant: nextMainByVariant,
        },
        saveState: {
          ...current.saveState,
          media: nextItems.some((item) => item.uploadStatus === "failed")
            ? "failed"
            : nextItems.some((item) => item.persisted || item.uploadStatus === "uploaded")
              ? "success"
              : "pending",
        },
      };
    });
  }

  function assignedMediaForVariant(variantKey: string) {
    const image = effectiveVariantImage(draft, variantKey);
    return image ? [image] : [];
  }

  function hasDirectMediaForVariant(variantKey: string) {
    return Boolean(ownVariantImage(draft, variantKey));
  }

  function renderVariantImagePicker(variantKey: string, label: string) {
    const current = effectiveVariantImage(draft, variantKey);
    return <ProductVariantImagePicker
      label={label}
      currentImage={current ? { id: current.localId, src: hasRenderableMediaPreview(current) ? mediaPreviewSrc(current) : undefined, label: current.title[locale] || current.fileName } : undefined}
      choices={draft.media.items.filter((item) => item.active).map((item) => ({ id: item.localId, src: hasRenderableMediaPreview(item) ? mediaPreviewSrc(item) : undefined, label: item.title[locale] || item.fileName }))}
      inherited={!hasDirectMediaForVariant(variantKey)}
      isDefault={variantKey === "default"}
      onAssign={(imageId) => updateDraft((currentDraft) => assignVariantImage(currentDraft, variantKey, imageId))}
      onImageError={markMediaPreviewBroken}
    />;
  }

  function updateVariant(localId: string, updater: (variant: ProductDraftVariant) => ProductDraftVariant) {
    updateDraft((current) => ({
      ...current,
      variants: current.variants.map((variant) => {
        if (variant.localId !== localId) return variant;
        const next = updater(variant);
        return next.options !== variant.options
          ? { ...next, name: registeredVariantName(current.basic.name, next.options, variantAttributeFields) }
          : next;
      }),
    }));
  }

  function addManualVariant() {
    const baseName = draft.basic.name || "Producto";
    const localId = `variant-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const variantNumber = draft.variants.length + 1;
    const name = `${baseName} / Variante ${variantNumber}`;

    updateDraft((current) => ({
      ...current,
      mode: "variants",
      pricing: {
        ...current.pricing,
        variantPrices: {
          ...current.pricing.variantPrices,
          ...pricesForNewVariants(current, [{ localId }]),
        },
      },
      variants: [
        ...current.variants,
        {
          localId,
          name,
          refId: registeredVariantSku(current.defaultVariant.refId, [], `V${variantNumber}`),
          ean: null,
          options: [],
          isActive: true,
          isVisible: true,
        },
      ],
    }));
    setSelectedVariantKey(localId);
    setActiveTab("variants");
  }

  function variantOptionWarning(variant: ProductDraftVariant) {
    const seenAttributes = new Set<string>();
    for (const option of variant.options) {
      if (option.markedForDeletion || option.isActive === false || !option.attributeCode || !option.valueCode) {
        continue;
      }
      if (seenAttributes.has(option.attributeCode)) {
        return `El atributo ${option.attributeCode} ya tiene un valor activo. Crea otra variante vendible para otro valor.`;
      }
      seenAttributes.add(option.attributeCode);
    }
    return null;
  }

  function removeSelectedVariantOption(index: number) {
    if (selectedVariant.isDefault) {
      return;
    }

    updateVariant(selectedVariant.localId, (variant) => ({
      ...variant,
      options: variant.options.flatMap((option, optionIndex) => {
        if (optionIndex !== index) {
          return [option];
        }

        return option.variantOptionId
          ? [{ ...option, isActive: false, markedForDeletion: true }]
          : [];
      }),
    }));
  }

  function mergeAttributeCatalog(catalog: ReturnType<typeof productSpecificationCatalog>) {
    setVariantAttributeFields((current) => [...current.filter((field) => !catalog.fields.some((next) => next.fieldId === field.fieldId)), ...catalog.fields]);
    setAttributeGroups((current) => [...current.filter((group) => !catalog.groups.some((next) => next.groupId === group.groupId)), ...catalog.groups]);
  }

  async function manageVariantAttributes() {
    setAttributeLoadError(null);
    try {
      const result = await loadProductFeaturesAction("attributes");
      if (!result.ok) { setAttributeLoadError(result.message); return; }
      mergeAttributeCatalog(result.catalog);
      setAttributeManagerOpen(true);
    } catch { setAttributeLoadError("No se pudieron cargar los atributos. Inténtalo de nuevo."); }
  }

  function openVariantAttributePicker() {
    if (selectedVariant.isDefault) {
      return;
    }

    setVariantAttributePickerStep("fields");
    setVariantAttributePickerFieldId(null);
    setVariantAttributePickerOpen(true);
  }

  function closeVariantAttributePicker() {
    setVariantAttributePickerOpen(false);
    setVariantAttributePickerStep("fields");
    setVariantAttributePickerFieldId(null);
  }

  function goBackToVariantAttributeFields() {
    setVariantAttributePickerStep("fields");
    setVariantAttributePickerFieldId(null);
  }

  function openVariantAttributeValues(field: ProductSpecificationLookupField) {
    if (selectedVariant.isDefault) {
      return;
    }

    setVariantAttributePickerFieldId(field.fieldId);
    setVariantAttributePickerStep("values");
    setVariantAttributePickerOpen(true);
  }

  function selectedVariantValueForAttribute(field: ProductSpecificationLookupField) {
    const attributeCode = variantAttributeCode(field);
    const selectedOption = activeSelectedVariantOptions.find((option) =>
      option.attributeCode === attributeCode || option.attributeCode === field.fieldId,
    );
    return selectedOption ? findVariantAttributeValue(field, selectedOption.valueCode) : undefined;
  }

  function updateVariantAttributeSelection(field: ProductSpecificationLookupField, fieldValueId: string) {
    if (selectedVariant.isDefault) {
      return;
    }

    const value = field.values.find((item) => item.fieldValueId === fieldValueId);
    if (!value) {
      return;
    }

    const attributeCode = variantAttributeCode(field);
    const valueCode = variantAttributeValueCode(value);
    updateVariant(selectedVariant.localId, (variant) => {
      let replaced = false;
      const options = variant.options.flatMap((option) => {
        const sameAttribute = option.attributeCode === attributeCode || option.attributeCode === field.fieldId;
        if (!sameAttribute || option.markedForDeletion) {
          return [option];
        }
        if (!replaced) {
          replaced = true;
          return [{ ...option, attributeCode, valueCode, isActive: true, markedForDeletion: false }];
        }
        return option.variantOptionId
          ? [{ ...option, isActive: false, markedForDeletion: true }]
          : [];
      });

      return {
        ...variant,
        options: replaced
          ? options
          : [...options, { attributeCode, valueCode, isActive: true, createdInDraft: true }],
      };
    });
  }

  function removeVariantFromDraft(variant: ProductDraftVariant) {
    updateDraft((current) => {
      const nextAssignments = { ...current.media.assignments };
      const nextMainByVariant = { ...current.media.mainByVariant };
      const nextVariantPrices = { ...current.pricing.variantPrices };
      const nextStockByVariant = { ...current.inventory.stockByVariant };
      const nextOfferingsByVariant = { ...current.offerings.byVariant };
      const keys = [variant.localId, variant.variantId].filter((key): key is string => Boolean(key));

      for (const key of keys) {
        delete nextAssignments[key];
        delete nextMainByVariant[key];
        delete nextVariantPrices[key];
        delete nextStockByVariant[key];
        delete nextOfferingsByVariant[key];
      }

      return {
        ...current,
        mode: current.variants.some((item) => item.localId !== variant.localId) ? "variants" : "simple",
        variants: current.variants.filter((item) => item.localId !== variant.localId),
        media: {
          ...current.media,
          assignments: nextAssignments,
          mainByVariant: nextMainByVariant,
        },
        pricing: {
          ...current.pricing,
          variantPrices: nextVariantPrices,
          specificPrices: (current.pricing.specificPrices ?? []).filter((price) =>
            price.targetType !== "VARIANT" ||
            !keys.some((key) => price.variantKey === key || price.variantId === key),
          ),
        },
        inventory: {
          ...current.inventory,
          stockByVariant: nextStockByVariant,
        },
        offerings: {
          ...current.offerings,
          byVariant: nextOfferingsByVariant,
        },
      };
    });

    if (selectedVariantKey === variant.localId || selectedVariantKey === variant.variantId) {
      setSelectedVariantKey("default");
    }
  }



  function updateVariantPriceField(
    variantKey: string,
    updater: (current: NonNullable<ProductDraft["pricing"]["productPrice"]>) => NonNullable<ProductDraft["pricing"]["productPrice"]>,
  ) {
    updateDraft((current) => {
      return {
        ...current,
        pricing: {
          ...current.pricing,
          variantPrices: {
            ...current.pricing.variantPrices,
            [variantKey]: updater(variantPriceForEdit(current, variantKey, currency)),
          },
        },
      };
    });
  }

  function updateSelectedPanelPrice(updater: (price: NonNullable<ProductDraft["pricing"]["productPrice"]>) => NonNullable<ProductDraft["pricing"]["productPrice"]>) {
    if (selectedVariant.isDefault) updateProductPriceField(updater);
    else updateVariantPriceField(selectedVariant.localId, updater);
  }

  function updateProductPriceField(updater: (current: NonNullable<ProductDraft["pricing"]["productPrice"]>) => NonNullable<ProductDraft["pricing"]["productPrice"]>) {
    updateDraft((current) => {
      const existing = editorBasePrice(current) ?? {
        basePriceMinor: 0,
        listPriceMinor: null,
        costPriceMinor: null,
        currency,
        taxIncluded: true,
        taxCode: current.basic.taxCode || "standard",
        tax: null,
        priceTableId: null,
        tradePolicy: undefined,
        channel: undefined,
        customerGroup: null,
        country: undefined,
      };

      return withEditorBasePrice(current, updater(existing));
    });
  }

  function removeVariantPrice(variantKey: string) {
    updateDraft((current) => {
      const existing = current.pricing.variantPrices[variantKey];
      const nextVariantPrices = { ...current.pricing.variantPrices };
      if (existing?.pricingId) {
        nextVariantPrices[variantKey] = {
          ...existing,
          markedForDeletion: true,
        };
      } else {
        delete nextVariantPrices[variantKey];
      }

      return {
        ...current,
        pricing: {
          ...current.pricing,
          variantPrices: nextVariantPrices,
        },
      };
    });
  }

  function specificPriceTargetLabel(price: SpecificPriceDraft) {
    if (price.targetType !== "VARIANT") {
      return "Producto completo";
    }

    const variantKey = price.variantKey ?? price.variantId;
    const target = specificPriceTargetOptions.find((item) => item.key === variantKey);
    return target ? `${target.label} · ${target.refId}` : variantKey ?? "Variante";
  }

  function resetSpecificPriceForm(targetKey = "__product__") {
    setSpecificPriceDateError(null);
    setSpecificPriceEditIndex(null);
    setSpecificPriceForm(defaultSpecificPriceForm(productPrice, targetKey));
  }

  function openSpecificPriceDrawer() {
    resetSpecificPriceForm();
    setSpecificPriceDrawerOpen(true);
  }

  function editSpecificPrice(index: number) {
    const price = specificPrices[index];
    if (!price) {
      return;
    }

    setSpecificPriceDateError(null);
    setSpecificPriceEditIndex(index);
    setSpecificPriceForm(specificPriceToForm(price, productPrice));
    setSpecificPriceDrawerOpen(true);
  }

  function removeSpecificPrice(index: number) {
    updateDraft((current) => {
      const nextSpecificPrices = [...(current.pricing.specificPrices ?? [])];
      const existing = nextSpecificPrices[index];
      if (!existing) {
        return current;
      }

      if (existing.pricingId) {
        nextSpecificPrices[index] = {
          ...existing,
          active: false,
          markedForDeletion: true,
        };
      } else {
        nextSpecificPrices.splice(index, 1);
      }

      return {
        ...current,
        pricing: {
          ...current.pricing,
          specificPrices: nextSpecificPrices,
        },
      };
    });

    if (specificPriceEditIndex === index) {
      resetSpecificPriceForm();
    }
  }

  function saveSpecificPriceForm() {
    const validFrom = dateTimeLocalToIso(specificPriceForm.validFrom, specificPriceForm.originalValidFrom);
    const validUntil = dateTimeLocalToIso(specificPriceForm.validUntil, specificPriceForm.originalValidUntil);
    if ((specificPriceForm.validFrom && !validFrom) || (specificPriceForm.validUntil && !validUntil)) {
      setSpecificPriceDateError("La fecha u hora no existe en tu zona horaria. Revisa el cambio de hora.");
      return;
    }
    if (validFrom && validUntil && Date.parse(validUntil) < Date.parse(validFrom)) {
      setSpecificPriceDateError("La fecha final no puede ser anterior a la inicial.");
      return;
    }
    const targetKey = specificPriceForm.targetKey || "__product__";
    const targetType = targetKey === "__product__" ? "PRODUCT" : "VARIANT";
    const fixedPriceMinor = inputToCents(specificPriceForm.fixedPrice);
    const minQuantity = Math.max(1, clampInteger(Number(specificPriceForm.minQuantity || "1")));
    const priority = Math.max(1, clampInteger(Number(specificPriceForm.priority || "100")));
    const selectedVariantOwnPrice = targetType === "VARIANT"
      ? draft.pricing.variantPrices[targetKey]
      : undefined;
    const basePriceMinor = selectedVariantOwnPrice?.basePriceMinor || productPrice?.basePriceMinor || fixedPriceMinor;
    const nextPrice: SpecificPriceDraft = {
      ...(specificPriceEditIndex !== null ? specificPrices[specificPriceEditIndex] : undefined),
      targetType,
      dirty: true,
      source: specificPriceEditIndex === null ? "FIXED" : specificPrices[specificPriceEditIndex].source ?? "FIXED",
      variantKey: targetType === "VARIANT" ? targetKey : undefined,
      variantId: targetType === "VARIANT"
        ? priceVariantRows.find((variant) => variant.localId === targetKey)?.variantId ?? null
        : null,
      currency: productPrice?.currency || currency,
      country: specificPriceForm.country.trim() || null,
      customerGroup: specificPriceForm.customerGroup.trim() || null,
      channel: specificPriceForm.channel.trim() || null,
      tradePolicy: specificPriceForm.tradePolicy.trim() || null,
      priceTableId: specificPriceForm.priceTableId || null,
      minQuantity,
      validFrom,
      validUntil,
      unlimited: validUntil === null,
      impactType: "FIXED_PRICE",
      fixedPriceMinor,
      reductionValue: null,
      reductionTaxIncluded: true,
      taxIncluded: specificPriceForm.taxIncluded,
      tax: productPrice?.tax ?? null,
      active: specificPriceForm.active,
      priority,
      basePriceMinor,
    } as SpecificPriceDraft;

    updateDraft((current) => {
      const nextSpecificPrices = [...(current.pricing.specificPrices ?? [])];
      if (specificPriceEditIndex === null) {
        nextSpecificPrices.push(nextPrice);
      } else {
        nextSpecificPrices[specificPriceEditIndex] = nextPrice;
      }

      return {
        ...current,
        pricing: {
          ...current.pricing,
          specificPrices: nextSpecificPrices,
        },
      };
    });
    resetSpecificPriceForm(targetKey);
    closeSpecificPriceDrawer();
  }

  async function runPricingPreview() {
    if (pricingPreviewForm.at && !dateTimeLocalToIso(pricingPreviewForm.at)) {
      setPricingPreviewDateError("La fecha u hora no existe en tu zona horaria. Revisa el cambio de hora.");
      setPricingPreviewResult(null);
      return;
    }
    setPricingPreviewDateError(null);
    const target = pricingPreviewTarget;
    const productId = draft.productId?.trim();
    const variantId = pricingPreviewForm.targetKey === "__product__" ? null : target?.variantId ?? null;

    if (!productId) {
      setPricingPreviewResult({
        ok: false,
        status: "NOT_APPLIED",
        reason: "Guarda el producto antes de simular el precio aplicado.",
        requested: {
          productId: null,
          variantId,
          defaultVariantId: draft.defaultVariantId ?? null,
          currency: productPrice?.currency ?? currency,
          country: pricingPreviewForm.country,
          tradePolicy: pricingPreviewForm.tradePolicy,
          channel: pricingPreviewForm.channel,
          customerGroup: pricingPreviewForm.customerGroup || null,
          priceTableId: pricingPreviewForm.priceTableId || null,
          quantity: Math.max(1, clampInteger(Number(pricingPreviewForm.quantity || "1"))),
          at: dateTimeLocalToIso(pricingPreviewForm.at),
        },
        resolution: { source: "NONE", usedFallback: false },
        price: null,
        conditions: [],
        correlationIds: [],
      });
      return;
    }

    if (pricingPreviewForm.targetKey !== "__product__" && !variantId) {
      setPricingPreviewResult({
        ok: false,
        status: "NOT_APPLIED",
        reason: "Guarda la variante antes de simular un precio especifico de variante.",
        requested: {
          productId,
          variantId: null,
          defaultVariantId: draft.defaultVariantId ?? null,
          currency: productPrice?.currency ?? currency,
          country: pricingPreviewForm.country,
          tradePolicy: pricingPreviewForm.tradePolicy,
          channel: pricingPreviewForm.channel,
          customerGroup: pricingPreviewForm.customerGroup || null,
          priceTableId: pricingPreviewForm.priceTableId || null,
          quantity: Math.max(1, clampInteger(Number(pricingPreviewForm.quantity || "1"))),
          at: dateTimeLocalToIso(pricingPreviewForm.at),
        },
        resolution: { source: "NONE", usedFallback: false },
        price: null,
        conditions: [],
        correlationIds: [],
      });
      return;
    }

    setPricingPreviewBusy(true);
    try {
      const result = await previewAppliedProductPriceAction({
        productId,
        variantId,
        defaultVariantId: draft.defaultVariantId ?? null,
        currency: productPrice?.currency ?? currency,
        country: pricingPreviewForm.country,
        tradePolicy: pricingPreviewForm.tradePolicy,
        channel: pricingPreviewForm.channel,
        customerGroup: pricingPreviewForm.customerGroup || null,
        priceTableId: pricingPreviewForm.priceTableId || null,
        quantity: Math.max(1, clampInteger(Number(pricingPreviewForm.quantity || "1"))),
        at: dateTimeLocalToIso(pricingPreviewForm.at),
      });
      setPricingPreviewResult(result);
    } finally {
      setPricingPreviewBusy(false);
    }
  }

  function stockForKey(variantKey: string) {
    return draft.inventory.stockByVariant[variantKey] ?? {
      warehouseId: draft.inventory.stockByVariant.default?.warehouseId ?? "",
      onHandQuantity: 0,
      reservedQuantity: 0,
      safetyStockQuantity: 0,
    };
  }

  function directStockEntryForVariant(variant: ProductDraftVariant) {
    const localStock = draft.inventory.stockByVariant[variant.localId];
    if (localStock) {
      return { key: variant.localId, stock: localStock };
    }

    if (variant.variantId && draft.inventory.stockByVariant[variant.variantId]) {
      return { key: variant.variantId, stock: draft.inventory.stockByVariant[variant.variantId] };
    }

    return null;
  }

  function stockForVariantRow(variant: ProductDraftVariant) {
    const directEntry = directStockEntryForVariant(variant);
    const defaultStock = stockForKey("default");

    return {
      key: directEntry?.key ?? variant.localId,
      stock: directEntry?.stock ?? defaultStock,
      mode: directEntry ? "own" : "inherited",
    };
  }

  function scopedDraftValue<T>(record: Record<string, T | undefined>, variant: ProductVariantRowView | undefined) {
    if (!variant) {
      return undefined;
    }

    return record[variant.localId] ?? (variant.variantId ? record[variant.variantId] : undefined);
  }

  function previewVariantAvailability(variant: ProductVariantRowView | undefined) {
    const stock = variant ? stockForVariantRow(variant).stock : undefined;
    const quantity = stock?.availableQuantity ?? availableQuantity(stock);

    return {
      stock,
      availableQuantity: quantity,
      available: stock?.available ?? quantity > 0,
    };
  }

  function pdpPreviewData(): StorefrontPdpData {
    const activeVariants = allVariantRows.filter(variant => variant.isActive && variant.isVisible);
    const rows = activeVariants.length ? activeVariants : allVariantRows;
    const variants = rows.map(variant => {
      const ownPrice = !variant.isDefault ? scopedDraftValue(draft.pricing.variantPrices, variant) : undefined;
      const price = ownPrice && !ownPrice.markedForDeletion ? ownPrice : productPrice;
      const availability = previewVariantAvailability(variant);
      const media = assignedMediaForVariant(variant.localId);
      const cover = draft.media.mainByVariant[variant.localId];
      const images = [...media].sort((a, b) => Number(b.localId === cover || b.isMain) - Number(a.localId === cover || a.isMain))
        .filter(hasRenderableMediaPreview).flatMap(item => { const url = mediaPreviewSrc(item); return url ? [{ url, alt: item.alt[locale] ?? item.fileName }] : []; });
      return {
        variantId: variant.localId, name: variant.name || variant.refId || variant.displayLabel,
        refId: variant.refId, ean: variant.ean ?? undefined, isDefault: variant.isDefault,
        images, available: availability.available, availableQuantity: availability.availableQuantity,
        priceAmountMinor: price?.basePriceMinor ?? undefined, previousPriceAmountMinor: price?.listPriceMinor ?? undefined,
        priceDisplay: formatMoney(price?.basePriceMinor, price?.currency || currency),
        previousPriceDisplay: price?.listPriceMinor ? formatMoney(price.listPriceMinor, price.currency || currency) : undefined,
        offerings: (scopedDraftValue(draft.offerings.byVariant, variant) ?? []).map(offering => ({ ...offering, id: offering.offeringId })),
        options: variant.options.filter(option => !option.markedForDeletion && (option.isActive ?? true)),
      };
    });
    const primary = variants.find(variant => variant.isDefault) ?? variants[0];
    return {
      productId: draft.productId ?? undefined, slug: draft.basic.slug || "preview",
      title: draft.basic.name || "Producto sin nombre",
      brand: draft.basic.brandName || brandOptions.find(brand => brand.id === draft.basic.brandId)?.label,
      category: draft.basic.categoryName || categoryOptions.find(category => category.id === draft.basic.categoryId)?.label,
      shortDescription: draft.basic.shortDescription, description: draft.basic.description,
      refId: primary?.refId, ean: primary?.ean, taxCode: draft.basic.taxCode,
      images: primary?.images ?? [], priceDisplay: primary?.priceDisplay,
      previousPriceDisplay: primary?.previousPriceDisplay, priceAmountMinor: primary?.priceAmountMinor,
      previousPriceAmountMinor: primary?.previousPriceAmountMinor,
      available: primary?.available ?? false, availableQuantity: primary?.availableQuantity,
      variants, specifications: selectedSpecifications.length ? [{ group: "Características técnicas", fields: selectedSpecifications.map(({ field, value }) => ({ name: field.name, value: value?.name ?? "" })) }] : [],
      contextQuery: "", eventContext: { organizationId: deletionContext?.organizationId ?? "", shopId: deletionContext?.shopId ?? "", visitorId: "" },
    };
  }

  function enableVariantOwnStock(variant: ProductDraftVariant) {
    updateDraft((current) => {
      const existing =
        current.inventory.stockByVariant[variant.localId] ??
        (variant.variantId ? current.inventory.stockByVariant[variant.variantId] : undefined);
      const defaultStock = current.inventory.stockByVariant.default ?? {
        warehouseId: "",
        onHandQuantity: 0,
        reservedQuantity: 0,
        safetyStockQuantity: 0,
      };

      return {
        ...current,
        inventory: {
          ...current.inventory,
          stockByVariant: {
            ...current.inventory.stockByVariant,
            [variant.localId]: stockWithAvailability(existing ?? { ...defaultStock, persisted: false }),
          },
        },
      };
    });
  }

  function inheritVariantStock(variant: ProductDraftVariant) {
    if (directStockEntryForVariant(variant)?.stock.persisted) return;
    updateDraft((current) => {
      const nextStockByVariant = { ...current.inventory.stockByVariant };
      delete nextStockByVariant[variant.localId];
      if (variant.variantId) {
        delete nextStockByVariant[variant.variantId];
      }

      return {
        ...current,
        inventory: {
          ...current.inventory,
          stockByVariant: nextStockByVariant,
        },
      };
    });
  }

  function updateStock(variantKey: string, updater: (stock: StockDraft) => StockDraft) {
    updateDraft((current) => {
      const currentStock = current.inventory.stockByVariant[variantKey] ?? {
        warehouseId: current.inventory.stockByVariant.default?.warehouseId ?? "",
        onHandQuantity: 0,
        reservedQuantity: 0,
        safetyStockQuantity: 0,
      };
      const nextStock = stockWithAvailability({ ...updater(currentStock), readOnlySelection: false });

      return {
        ...current,
        inventory: {
          ...current.inventory,
          stockByVariant: {
            ...current.inventory.stockByVariant,
            [variantKey]: nextStock,
          },
        },
      };
    });
  }

  function updateStockNumber(variantKey: string, field: "onHandQuantity" | "reservedQuantity" | "safetyStockQuantity", value: string) {
    updateStock(variantKey, (stock) => ({
      ...stock,
      [field]: clampInteger(Number(value)),
    }));
  }

  function updateSelectedPanelStock(field: "onHandQuantity" | "reservedQuantity" | "safetyStockQuantity", value: string) {
    if (!selectedVariant.isDefault && selectedPanelStock.mode === "inherited") {
      enableVariantOwnStock(selectedVariant);
      updateStockNumber(selectedVariant.localId, field, value);
    } else {
      updateStockNumber(selectedPanelStock.key, field, value);
    }
  }

  async function selectStockWarehouse(value: string, base = false) {
    const variant = base ? allVariantRows[0] : selectedVariant;
    const state = variant.isDefault ? { key: "default", stock: stockForKey("default"), mode: "own" } : stockForVariantRow(variant);
    if (value === state.stock.warehouseId) return;
    if (state.stock.availabilityEstimated) {
      setStockWarehouseMessage("Guarda las cantidades pendientes antes de cambiar de almacén.");
      return;
    }
    setStockWarehouseMessage(undefined);
    const key = variant.isDefault ? "default" : state.key;
    if (!variant.variantId) {
      updateDraft((current) => ({ ...current, inventory: { ...current.inventory, stockByVariant: { ...current.inventory.stockByVariant, [key]: { warehouseId: value, onHandQuantity: 0, reservedQuantity: 0, safetyStockQuantity: 0, persisted: false } } } }));
      return;
    }
    if (!value) return;
    setStockWarehouseLoading(true);
    try {
      const result = await loadProductWarehouseStockAction({ variantId: variant.variantId, warehouseId: value });
      if (!result.ok) { setStockWarehouseMessage(result.message); return; }
      setDraft((current) => ({ ...current, inventory: { ...current.inventory, stockByVariant: { ...current.inventory.stockByVariant, [key]: { ...result.stock, readOnlySelection: true } } } }));
    } finally { setStockWarehouseLoading(false); }
  }

  function updateShipping(updater: (shipping: ProductDraft["shipping"]) => ProductDraft["shipping"]) {
    updateDraft((current) => ({
      ...current,
      shipping: updater(current.shipping),
    }));
  }

  function updateShippingPackage(field: keyof ProductDraft["shipping"]["package"], value: string) {
    const measurement = value.trim() === "" ? null : Number(value);
    if (selectedVariant.isDefault) updateShipping((shipping) => ({ ...shipping, package: { ...shipping.package, [field]: measurement } }));
    else updateVariant(selectedVariant.localId, (variant) => {
      const shippingPackage = { ...variant.shippingPackage };
      if (measurement === null) delete shippingPackage[field];
      else shippingPackage[field] = measurement;
      return { ...variant, shippingPackage };
    });
  }

  function renderShippingMeasurement(field: keyof ProductDraft["shipping"]["package"], label: string) {
    const own = !selectedVariant.isDefault && Object.prototype.hasOwnProperty.call(selectedVariant.shippingPackage ?? {}, field);
    const id = `shipping-${selectedVariant.localId}-${field}`;
    return <div className="adminField" key={field}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" inputMode="numeric" min="0" step="1" value={shippingPackage[field] ?? ""} onChange={(event) => updateShippingPackage(field, event.target.value)} />
      {own ? <small>Valor propio</small> : null}
      {own ? <button className="productImageAddLink" type="button" aria-label={`Restaurar herencia de ${label}`} onClick={() => updateShippingPackage(field, "")}>Restaurar herencia</button> : null}
    </div>;
  }

  function updateShippingDeliveryNote(kind: "inStock" | "outOfStock", value: string) {
    updateShipping((shipping) => ({
      ...shipping,
      deliveryTimeNotes: {
        ...shipping.deliveryTimeNotes,
        [kind]: {
          ...shipping.deliveryTimeNotes[kind],
          [locale]: value,
        },
      },
    }));
  }

  function toggleShippingCarrier(carrierId: string, checked: boolean) {
    updateShipping((shipping) => {
      const nextCarrierIds = checked
        ? Array.from(new Set([...shipping.allowedCarrierIds, carrierId]))
        : shipping.allowedCarrierIds.filter((id) => id !== carrierId);

      return {
        ...shipping,
        allowedCarrierIds: nextCarrierIds,
      };
    });
  }

  function mergeVariantsByRef(variants: ProductDraftVariant[]) {
    const seen = new Set<string>();
    return variants.filter((variant) => {
      const key = variant.refId.toLowerCase();
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  function applyGeneratedCombinations(rows: ProductDraftVariant[]) {
    updateDraft((current) => {
      const variants = mergeVariantsByRef([...current.variants, ...rows]);
      const newVariants = variants.filter((variant) => !current.variants.some((existing) => existing.localId === variant.localId));
      return {
        ...current,
        mode: "variants",
        variants,
        pricing: {
          ...current.pricing,
          variantPrices: { ...current.pricing.variantPrices, ...pricesForNewVariants(current, newVariants) },
        },
      };
    });
  }

  async function requestCombinationGeneration() {
    if (generatingVariants) return;
    const version = generationVersion.current;
    setGeneratingVariants(true);
    setVariantMessage(null);
    try {
      const latest = await loadProductFeaturesAction("attributes");
      if (version !== generationVersion.current) return;
      if (!latest.ok) { setVariantMessage(latest.message); return; }
      mergeAttributeCatalog(latest.catalog);
      const result = registeredCombinations(latest.catalog.fields, draft.basic.categoryId ?? "", generatorSelections);
      if (result.error) { setVariantMessage(result.error); return; }
      const rows = result.combinations.map((options) => {
        const name = registeredVariantName(draft.basic.name, options, latest.catalog.fields);
        return { localId: `variant-${crypto.randomUUID()}`, name, refId: registeredVariantSku(draft.defaultVariant.refId, options), ean: null, options, isActive: true, isVisible: true };
      });
      applyGeneratedCombinations(rows);
    } catch { setVariantMessage("No se pudo comprobar el catálogo de atributos. Inténtalo de nuevo."); }
    finally { setGeneratingVariants(false); }
  }

  function handleRecoveryAction(action: ProductSaveReport["recoveryActions"][number]) {
    setActiveTab(tabForRecoveryBlock(action.targetBlock));
    if (recoveryActionShouldRetry(action)) {
      saveDraft();
    }
  }

  function saveDraft(publish?: boolean) {
    if (publish === undefined && (!persistedPublication.isActive || publicationChecklist.some(item => !item.ok))) {
      setSaveDecisionOpen(true);
      return;
    }
    setSaveDecisionOpen(false);
    const shouldActivate = persistedPublication.isActive || publish === true;
    const savingDraft = {
      ...draft,
      basic: {
        ...draft.basic,
        isActive: shouldActivate,
        isVisible: persistedPublication.isActive ? persistedPublication.isVisible : shouldActivate ? true : draft.basic.isVisible,
      },
    };
    const validation = validateProductDraft(savingDraft);
    if (!validation.ok) {
      const errors = fieldErrorSummary(validation.fieldErrors);
      setReport({
        ok: false,
        blocks: {
          catalog: "failed",
          variants: draft.saveState.variants ?? "pending",
          media: draft.saveState.media ?? "pending",
          variantMedia: draft.saveState.variantMedia ?? "pending",
          specifications: draft.saveState.specifications ?? "pending",
          pricing: draft.saveState.pricing ?? "pending",
          inventory: draft.saveState.inventory ?? "pending",
          shipping: draft.saveState.shipping ?? "pending",
          routingSeo: draft.saveState.routingSeo ?? "pending",
          publish: draft.saveState.publish ?? "pending",
        },
        messages: [
          errors.length
            ? `No se guardo. Revisa: ${errors.map((error) => error.label).join(", ")}.`
            : "No se guardo. Revisa los datos del formulario.",
        ],
        fieldErrors: validation.fieldErrors,
        recoveryActions: [{
          code: "review_validation",
          label: "Revisar campos obligatorios",
          targetBlock: "catalog",
          retryable: false,
        }],
        correlationIds: [],
      });
      setActiveTab(
        Object.keys(validation.fieldErrors).some((key) => key.startsWith("pricing."))
          ? "pricing"
          : Object.keys(validation.fieldErrors).some((key) => key.startsWith("variant:"))
            ? "variants"
            : "basic",
      );
      return;
    }

    if (savingDraft.basic.isActive) {
      const publicationValidation = validateProductPublicationReadiness(savingDraft);
      if (!publicationValidation.ok) {
        const errors = fieldErrorSummary(publicationValidation.fieldErrors);
        setReport({
          ok: false,
          blocks: {
            catalog: draft.saveState.catalog ?? "pending",
            variants: draft.saveState.variants ?? "pending",
            media: draft.saveState.media ?? "pending",
            variantMedia: draft.saveState.variantMedia ?? "pending",
            specifications: draft.saveState.specifications ?? "pending",
            pricing: draft.saveState.pricing ?? "pending",
            inventory: draft.saveState.inventory ?? "pending",
            shipping: draft.saveState.shipping ?? "pending",
            routingSeo: draft.saveState.routingSeo ?? "pending",
            publish: "blocked",
          },
          messages: [
            errors.length
              ? `No se guardo. Revisa: ${errors.map((error) => error.label).join(", ")}.`
              : "No se puede activar todavia.",
          ],
          fieldErrors: publicationValidation.fieldErrors,
          recoveryActions: [{
            code: "review_publication",
            label: "Revisar publicacion",
            targetBlock: "publish",
            retryable: false,
          }],
          correlationIds: [],
        });
        setDraft((current) => ({
          ...current,
          saveState: {
            ...current.saveState,
            publish: "blocked",
          },
        }));
        setActiveTab("basic");
        return;
      }
    }

    const formData = new FormData();
    const serializedDraft = JSON.stringify(sanitizeDraftForStorage(savingDraft));
    formData.set("draft", serializedDraft);
    draft.media.items.forEach((item) => {
      const file = filesByLocalId[item.localId];
      if (file && !item.persisted && !item.mediaAssetId && (!item.uploadStatus || item.uploadStatus === "local")) {
        formData.append("fileLocalIds", item.localId);
        formData.append("files", file);
      }
    });

    let attempt: ProductSaveAttempt;
    try {
      attempt = prepareProductSaveAttempt(saveAttemptRef.current, productSaveSignature(savingDraft, shouldActivate), formData, () => crypto.randomUUID());
      saveAttemptRef.current = attempt;
    } catch (error) {
      setReport({
        ...(report ?? {}),
        ok: false,
        messages: [error instanceof Error ? error.message : "No se pudo preparar el guardado."],
        fieldErrors: { operation: "Hay un guardado anterior sin confirmar." },
        blocks: report?.blocks ?? { catalog: "pending", variants: "pending", media: "pending", variantMedia: "pending", specifications: "pending", pricing: "pending", inventory: "pending", shipping: "pending", routingSeo: "pending", publish: "pending" },
        recoveryActions: report?.recoveryActions ?? [],
        correlationIds: report?.correlationIds ?? [],
      });
      return;
    }

    setIsSaving(true);
    startTransition(async () => {
      try {
        const result = await saveProductDraftAction(attempt.request);
        setReport(result);
        const acknowledgedDraft = applyProductSavePatch(savingDraft, result);
        saveAttemptRef.current = acknowledgeProductSaveAttempt(attempt, result, productSaveSignature(acknowledgedDraft, shouldActivate));

        const confirmedPublication = result.draftPatch?.basic
          ? { isActive: result.draftPatch.basic.isActive, isVisible: result.draftPatch.basic.isVisible }
          : result.ok && result.blocks.publish === "success"
            ? { isActive: savingDraft.basic.isActive, isVisible: savingDraft.basic.isVisible }
            : persistedPublication;
        setPersistedPublication(confirmedPublication);
        if (result.draftPatch || result.ok) {
          setDraft((current) => {
            const patched = applyProductSavePatch(current, result);
            return { ...patched, basic: { ...patched.basic, ...confirmedPublication } };
          });
        }

        if (result.ok) {
          setDirty(false);
          setStoredDraft(null);
        }

        if (result.blocks.variants === "success") {
          setVariantMessage(null);
        }

        if (result.fieldErrors.media || result.blocks.media === "failed" || result.blocks.variantMedia === "failed") {
          setActiveTab("basic");
        }
      } catch (error) {
        setReport({
          ok: false,
          blocks: {
            catalog: "failed",
            variants: "pending",
            media: "pending",
            variantMedia: "pending",
            specifications: "pending",
            pricing: "pending",
            inventory: "pending",
            shipping: "pending",
            routingSeo: "pending",
            publish: "pending",
          },
          messages: [error instanceof Error ? error.message : "No se pudo completar el guardado."],
          fieldErrors: {},
          recoveryActions: [{
            code: "retry_operation",
            label: "Reintentar guardado",
            targetBlock: "catalog",
            retryable: true,
          }],
          correlationIds: [],
        });
      } finally {
        setIsSaving(false);
      }
    });
  }

  function assignExistingOfferingToSelectedVariant(offeringId: string) {
    const variantId = offeringTargetVariant?.variantId;
    if (!offeringId) {
      setOfferingMessage({ text: "Selecciona un offering existente.", tone: "info" });
      return;
    }
    if (!variantId) {
      setOfferingMessage({ text: "Guarda el producto y la variante antes de asignar offerings.", tone: "info" });
      return;
    }

    startTransition(async () => {
      const result = await attachExistingOfferingToVariantAction({
        variantId,
        offeringId,
      });
      if (result.ok) {
        setOfferingsForVariant(offeringTargetKey, result.offerings);
        setOfferingPickerStep("list");
        setOfferingPickerOfferingId(null);
      }
      setOfferingMessage({
        text: result.message ?? (result.ok ? "Offering asignado." : "No se pudo asignar el offering."),
        tone: result.ok ? "success" : "error",
      });
    });
  }

  function openOfferingPicker() {
    setOfferingPickerStep("list");
    setOfferingPickerOfferingId(null);
    setOfferingPickerOpen(true);
    setOfferingMessage(null);
  }

  function openOfferingDetails(offering: ProductOfferingRecord) {
    setOfferingPickerOfferingId(offering.offeringId);
    setOfferingPickerStep("details");
    setOfferingPickerOpen(true);
    setOfferingMessage(null);
  }

  function closeOfferingPicker() {
    setOfferingPickerOpen(false);
    setOfferingPickerStep("list");
    setOfferingPickerOfferingId(null);
  }

  function goBackToOfferingList() {
    setOfferingPickerStep("list");
    setOfferingPickerOfferingId(null);
  }

  function detachOffering(offeringId: string) {
    const variantId = offeringTargetVariant?.variantId;

    startTransition(async () => {
      const result = await detachOfferingFromVariantAction({ variantId, offeringId });
      if (result.ok) {
        setOfferingsForVariant(offeringTargetKey, result.offerings);
      }
      setOfferingMessage({
        text: result.message ?? (result.ok ? "Offering desasignado." : "No se pudo desasignar el offering."),
        tone: result.ok ? "success" : "error",
      });
    });
  }

  function setOfferingActivation(offeringId: string, active: boolean) {
    const variantId = offeringTargetVariant?.variantId;

    startTransition(async () => {
      const result = await setOfferingVariantActivationAction({ variantId, offeringId, active });
      if (result.ok) {
        setOfferingsForVariant(offeringTargetKey, result.offerings);
      }
      setOfferingMessage({
        text: result.message ?? (result.ok ? "Offering actualizado." : "No se pudo actualizar el offering."),
        tone: result.ok ? "success" : "error",
      });
    });
  }

  return (
    <main className="adminPage productEditorPage" aria-busy={savingActive}>
      {pricingTaxWarning || taxReloadMessage ? <div className={`adminBanner ${taxReloadSucceeded ? "adminBannerInfo" : "adminBannerWarn"}`} role="status">
        <p>{taxReloadMessage ?? pricingTaxWarning}</p>
        <button className="adminButton" type="button" disabled={taxReloadPending} onClick={() => startTaxReload(async () => {
          const result = await reloadProductTaxesAction();
          if (result.ok) setTaxLookups(result.taxes);
          setTaxReloadSucceeded(result.ok);
          setTaxReloadMessage(result.ok ? "Reglas fiscales actualizadas. Se conservan los datos del producto." : result.message ?? "No se pudieron cargar las reglas fiscales.");
        })}>{taxReloadPending ? "Cargando reglas fiscales…" : "Volver a cargar impuestos"}</button>
      </div> : null}
      <div className="adminBreadcrumb">
        <Link href="/admin">Admin</Link> / <Link href="/admin/catalogo">Catalogo</Link> / <Link href="/admin/products">Productos</Link> / {draft.productId ? "Editar" : "Nuevo"}
      </div>

      <div className="productEditorHeader">
        <div className="productEditorTitleGroup">
          <div className="productEditorMeta">
            <span className={`adminBadge ${persistedPublication.isActive ? "adminBadgeOk" : "adminBadgeWarn"}`}>
              {productStatus}
            </span>
            <span>{locale} / {currency}</span>
          </div>
        </div>

        <div className="productEditorHeaderActions">
          <Link className="productImageAddLink" href="/admin/products/new">Agregar producto</Link>
        </div>
      </div>

      {initialNotice ? (
        <section className="adminBanner adminBannerInfo" aria-live="polite">
          <p>{initialNotice}</p>
        </section>
      ) : null}

      {report ? (
        <section className={`adminBanner ${report.ok ? "" : "adminBannerError"}`} aria-live="polite">
          {report.messages.map((message) => <p key={message}>{message}</p>)}
          {fieldErrorSummary(report.fieldErrors).length > 0 ? (
            <ul>
              {fieldErrorSummary(report.fieldErrors).map((error) => (
                <li key={error.key}>
                  <strong>{error.label}:</strong> {error.message}
                </li>
              ))}
            </ul>
          ) : null}
          {report.recoveryActions.length > 0 ? (
            <div className="adminButtonRow productRecoveryActions" aria-label="Acciones de recuperacion recomendadas">
              {report.recoveryActions.map((action) => (
                <button
                  className="adminButton"
                  key={`${action.code}:${action.targetBlock ?? "operation"}`}
                  type="button"
                  onClick={() => handleRecoveryAction(action)}
                >
                  {action.label}
                </button>
              ))}
              {!report.recoveryActions.some((action) => action.label === "Continuar editando") ? (
                <button className="adminButton" type="button" onClick={() => setReport(null)}>
                  Continuar editando
                </button>
              ) : null}
            </div>
          ) : null}
          {report.correlationIds.length > 0 ? (
            <p className="adminContextHint">Correlation: {report.correlationIds.join(", ")}</p>
          ) : null}
        </section>
      ) : null}

      {storedDraft && !dirty ? (
        <section className="adminBanner adminBannerInfo" aria-live="polite">
          <p>Hay un borrador local guardado para esta ficha.</p>
          <div className="adminButtonRow">
            <button
              className="adminButton adminButtonPrimary"
              type="button"
              onClick={() => {
                setDraft(storedDraft);
                setDirty(true);
                setStoredDraft(null);
              }}
            >
              Restaurar borrador
            </button>
            <button
              className="adminButton"
              type="button"
              onClick={() => {
                window.localStorage.removeItem(storageKey);
                setStoredDraft(null);
              }}
            >
              Descartar borrador
            </button>
          </div>
        </section>
      ) : null}

      {lookups.warnings.length > 0 ? (
        <section className="adminBanner adminBannerInfo" aria-live="polite">
          {lookups.warnings.filter(warning => (!warning.startsWith("Caracteristicas:") || featureLoadError) && (!taxReloadSucceeded || !warning.startsWith("Pricing taxes:"))).map((warning) => <p key={warning}>{warning}</p>)}
        </section>
      ) : null}

      <nav className="productEditorTabs" aria-label="Pestanas de producto">
        {tabs.map((tab) => (
          <button
            className={`productEditorTab ${activeTab === tab.id ? "productEditorTabActive" : ""}`}
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className={`productEditorLayout${activeTab === "audit" || activeTab === "pricing" ? " productEditorLayoutAudit" : ""}`}>
        <section className="productEditorContent">
          {activeTab === "basic" ? (
            <div className="productBasicSections">
              <details className="productEditorPanel productBasicSection" open>
                <summary>Datos principales</summary>
                <div className="productBasicSectionBody">
                <div className="adminFormGrid adminFormGridTwo productMainDataGrid">
                  <label className="adminField">
                    <span>Nombre</span>
                    <input value={draft.basic.name} onChange={(event) => updateBasic("name", event.target.value)} />
                    {report?.fieldErrors.name ? <small>{report.fieldErrors.name}</small> : null}
                  </label>
                  <label className="adminField">
                    <span>URL amigable</span>
                    <input value={draft.basic.slug} onChange={(event) => updateBasic("slug", event.target.value)} />
                    {report?.fieldErrors.slug ? <small>{report.fieldErrors.slug}</small> : null}
                  </label>
                  <label className="adminField">
                    <span>Referencia / SKU</span>
                    <input
                      value={draft.defaultVariant.refId}
                      onChange={(event) => updateDraft((current) => ({
                        ...current,
                        defaultVariant: { ...current.defaultVariant, refId: event.target.value },
                      }))}
                    />
                    <small>Código interno de la variante predeterminada.</small>
                    {report?.fieldErrors.refId ? <small>{report.fieldErrors.refId}</small> : null}
                  </label>
                  <label className="adminField">
                    <span>EAN</span>
                    <input
                      value={draft.defaultVariant.ean ?? ""}
                      onChange={(event) => updateDraft((current) => ({
                        ...current,
                        defaultVariant: { ...current.defaultVariant, ean: event.target.value || null },
                      }))}
                    />
                  </label>
                </div>
                <RichTextEditor
                  label="Resumen"
                  minHeight={64}
                  value={draft.basic.shortDescription}
                  onChange={(value) => updateBasic("shortDescription", value)}
                />
                <RichTextEditor
                  label="Descripcion"
                  minHeight={240}
                  value={draft.basic.description}
                  onChange={(value) => updateBasic("description", value)}
                />
                </div>
              </details>
              
                
                
              <details className="productEditorPanel productBasicSection" open>
                <summary>SEO</summary>
                <div className="productBasicSectionBody">
              <div className="adminFormGrid adminFormGridTwo">
                <label className="adminField">
                  <span>Titulo SEO</span>
                  <input value={draft.basic.metaTitle} onChange={(event) => updateBasic("metaTitle", event.target.value)} />
                </label>
                <label className="adminField">
                  <span>Keywords</span>
                  <input value={draft.basic.keywords} onChange={(event) => updateBasic("keywords", event.target.value)} />
                </label>
              </div>
              <label className="adminField adminSection">
                <span>Meta description</span>
                <textarea className="adminTextarea" value={draft.basic.metaDescription} onChange={(event) => updateBasic("metaDescription", event.target.value)} />
              </label>
              <div className="adminFormGrid adminFormGridTwo adminSection">
                <label className="adminField">
                  <span>Canonical path</span>
                  <input
                    value={draft.routingSeo.canonicalPath}
                    onChange={(event) => updateRoutingSeo((routingSeo) => ({
                      ...routingSeo,
                      canonicalPath: event.target.value,
                    }))}
                    placeholder="/producto-demo/p"
                  />
                </label>
                <label className="adminField">
                  <span>Estado ruta</span>
                  <select
                    value={draft.routingSeo.status}
                    onChange={(event) => updateRoutingSeo((routingSeo) => ({
                      ...routingSeo,
                      status: event.target.value === "INACTIVE" ? "INACTIVE" : "ACTIVE",
                    }))}
                  >
                    <option value="ACTIVE">Activo</option>
                    <option value="INACTIVE">Inactivo</option>
                  </select>
                </label>
                <label className="adminField">
                  <span>Sitemap</span>
                  <select
                    value={draft.routingSeo.includeInSitemap ? "true" : "false"}
                    onChange={(event) => updateRoutingSeo((routingSeo) => ({
                      ...routingSeo,
                      includeInSitemap: event.target.value === "true",
                    }))}
                  >
                    <option value="true">Incluir</option>
                    <option value="false">Excluir</option>
                  </select>
                </label>
                <label className="adminField">
                  <span>Redirect al cambiar path</span>
                  <select
                    value={draft.routingSeo.createRedirectFromPreviousPath ? "true" : "false"}
                    onChange={(event) => updateRoutingSeo((routingSeo) => ({
                      ...routingSeo,
                      createRedirectFromPreviousPath: event.target.value === "true",
                    }))}
                  >
                    <option value="false">No crear</option>
                    <option value="true">Crear 301</option>
                  </select>
                </label>
              </div>
              <div className="adminSection">
                <div className="productEditorToolbar">
                  <div>
                    <h3>Aliases</h3>
                    <p>Rutas alternativas del mismo producto.</p>
                  </div>
                  <button type="button" className="adminButton adminButtonSecondary" onClick={addRoutingSeoAlias}>
                    <Plus size={16} aria-hidden="true" />
                    Anadir alias
                  </button>
                </div>
                {draft.routingSeo.aliases.filter((alias) => !alias.markedForDeletion).length > 0 ? (
                  <div className="adminStack">
                    {draft.routingSeo.aliases.map((alias, index) => alias.markedForDeletion ? null : (
                      <div className="adminFormGrid adminFormGridThree" key={alias.routeId ?? `alias-${index}`}>
                        <label className="adminField">
                          <span>Path alias</span>
                          <input
                            value={alias.path}
                            onChange={(event) => updateRoutingSeoAlias(index, (currentAlias) => ({
                              ...currentAlias,
                              path: event.target.value,
                            }))}
                            placeholder="/producto-demo"
                          />
                        </label>
                        <label className="adminField">
                          <span>Estado</span>
                          <select
                            value={alias.status}
                            onChange={(event) => updateRoutingSeoAlias(index, (currentAlias) => ({
                              ...currentAlias,
                              status: event.target.value === "INACTIVE" ? "INACTIVE" : "ACTIVE",
                            }))}
                          >
                            <option value="ACTIVE">Activo</option>
                            <option value="INACTIVE">Inactivo</option>
                          </select>
                        </label>
                        <div className="adminField">
                          <span>Acciones</span>
                          <button type="button" className="adminIconButton" onClick={() => removeRoutingSeoAlias(index)} aria-label="Eliminar alias">
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="adminBanner adminBannerInfo">
                    <p>Sin aliases configurados.</p>
                  </div>
                )}
              </div>
              {draft.routingSeo.resolvedCanonical ? (
                <ProductSeoResolutionNotice>
                    Resolucion: {draft.routingSeo.resolvedCanonical.kind}
                    {draft.routingSeo.resolvedCanonical.canonicalPath ? ` -> ${draft.routingSeo.resolvedCanonical.canonicalPath}` : ""}
                </ProductSeoResolutionNotice>
              ) : null}
                </div>
              </details>
            </div>
          ) : null}

          {activeTab === "variants" ? (
            <>
            <div className="productEditorPanel">
              <div className="productEditorSectionHeader">
                <div>
	                  <h2>Producto y variantes</h2>
                </div>
                <div className="adminButtonRow">
                  <button className="productImageAddLink" type="button" onClick={addManualVariant}>
                    Anadir variante
                  </button>
                </div>
              </div>
              <details className="productVariantGeneratorAdvanced"><summary>Generar variantes desde atributos</summary>
              <div className="productCombinationGenerator productRegisteredGenerator">
                <div className="productRegisteredGeneratorTables">
                  {variantAttributeFields.filter((field) => field.isActive && field.isStockKeepingUnit && field.categoryIds?.includes(draft.basic.categoryId ?? "")).map((field) => {
                    const expanded = Object.prototype.hasOwnProperty.call(generatorSelections, field.fieldId);
                    return (
                      <table className="productBasicFeaturesGrid" key={field.fieldId} aria-label={`Generar por ${field.name}`}>
                        <thead><tr><th colSpan={2}>
                          <label className="adminCheckbox">
                            <input type="checkbox" disabled={generatingVariants} checked={expanded} aria-expanded={expanded} aria-controls={`generator-values-${field.fieldId}`} onChange={(event) => {
                              const checked = event.target.checked;
                              setGeneratorSelections((current) => {
                                const next = { ...current };
                                if (checked) next[field.fieldId] = [];
                                else delete next[field.fieldId];
                                return next;
                              });
                            }} />{field.name}
                          </label>
                        </th></tr></thead>
                        <tbody id={`generator-values-${field.fieldId}`} hidden={!expanded}>
                          {field.values.filter((value) => value.isActive).map((value) => (
                            <tr key={value.fieldValueId}><td>
                              <input type="checkbox" aria-label={`${field.name}: ${value.name}`} disabled={generatingVariants} checked={(generatorSelections[field.fieldId] ?? []).includes(value.fieldValueId)} onChange={(event) => {
                                const checked = event.target.checked;
                                setGeneratorSelections((current) => ({ ...current, [field.fieldId]: checked ? [...(current[field.fieldId] ?? []), value.fieldValueId] : (current[field.fieldId] ?? []).filter((id) => id !== value.fieldValueId) }));
                              }} />
                            </td><td>{value.name}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })}
                </div>
                {!variantAttributeFields.some((field) => field.categoryIds?.includes(draft.basic.categoryId ?? "")) ? <p>No hay atributos registrados para esta categoría.</p> : null}
                <button className="adminButton" type="button" disabled={generatingVariants || !Object.values(generatorSelections).some((ids) => ids.length)} onClick={requestCombinationGeneration}>
                  {generatingVariants ? "Agregando…" : "Agregar"}
                </button>
              </div>
              </details>
              {variantMessage ? (
                <div className="adminBanner adminSection" aria-live="polite">
                  <p>{variantMessage}</p>
                </div>
              ) : null}
              <div className="adminTableScroller adminSection">
                <table className="adminTable productVariantCompactTable">
                  <thead><tr><th aria-label="Selección">Sel.</th><th>Imagen</th><th>Nombre</th><th>SKU / referencia</th><th>Variante</th><th>Acción</th></tr></thead>
                  <tbody>
                    {allVariantRows.map((variant) => {
                      const variantValues = variant.options
                        .filter((option) => !option.markedForDeletion && option.isActive !== false)
                        .map((option) => {
                          const field = findVariantAttributeField(variantAttributeFields, option.attributeCode);
                          const value = findVariantAttributeValue(field, option.valueCode);
                          if (value) return value.name;
                          const label = option.valueCode.replace(/-/g, " ").trim();
                          return label ? label.charAt(0).toLocaleUpperCase(locale) + label.slice(1) : "";
                        })
                        .filter(Boolean);
                      return (
                      <tr key={variant.localId} onClick={() => setSelectedVariantKey(variant.localId)}>
                        <td><input type="radio" name="product-selected-variant" aria-label={`Seleccionar ${variant.refId}`} checked={selectedVariant.localId === variant.localId} onChange={() => setSelectedVariantKey(variant.localId)} /></td>
                        <td>{renderVariantImagePicker(variant.localId, variant.isDefault ? "variante 0" : variant.name)}</td>
                        <td><span className="productVariantCellText" title={variant.name || "Sin nombre"}>{variant.name || "Sin nombre"}</span></td>
                        <td><span className="productVariantCellText" title={variant.refId || "Sin referencia"}>{variant.refId || "Sin referencia"}</span></td>
                        <td>
                          <div className="productVariantValueList">
                            {variantValues.length ? variantValues.map((value, index) => (
                              <span className="productVariantValueBadge" title={value} key={`${value}-${index}`}>{value}</span>
                            )) : "—"}
                          </div>
                        </td>
                        <td className="productVariantActionCell" onClick={(event) => event.stopPropagation()}>
                          {!variant.isDefault ? (
                            variant.variantId && draft.productId && canDeleteProducts && deletionContext ? <CatalogDeletionButton iconOnly target={{ ...deletionContext, productId: draft.productId, variantId: variant.variantId }} name={variant.refId} disabled={dirty || savingActive} disabledReason={dirty ? "Guarda los cambios antes de eliminar." : undefined} onComplete={() => { window.localStorage.removeItem(storageKey); window.location.assign(`/admin/products/${encodeURIComponent(draft.productId!)}`); }} /> : !variant.variantId ? <button className="productFeatureTableAction productFeatureTableDelete" type="button" aria-label={`Quitar ${variant.refId}`} title="Quitar variante del borrador" disabled={savingActive} onClick={() => { if (window.confirm(`¿Quitar la variante ${variant.refId} del borrador?`)) removeVariantFromDraft(variant); }}><Trash2 size={14} aria-hidden="true" /></button> : null
                          ) : null}
                        </td>


                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

              <section className="productEditorPanel productOfferingPositionPanel adminSection">
                <div className="productEditorSectionHeader productEditorSectionHeaderCompact">
                  <div>
                    <h2>Servicios adicionales</h2>
                  </div>
                  <button className="productImageAddLink" type="button" onClick={openOfferingPicker}>
                    Agregar servicio
                  </button>
                </div>
                {!offeringTargetVariant?.variantId && !offeringPrerequisiteNoticeDismissed ? (
                  <div className="adminBanner adminBannerInfo adminBannerDismissible">
                    <p>Guarda primero esta variante para asociar servicios adicionales.</p>
                    <button
                      aria-label="Cerrar aviso de servicios adicionales"
                      className="adminBannerClose"
                      type="button"
                      onClick={() => setOfferingPrerequisiteNoticeDismissed(true)}
                    >
                      <X aria-hidden="true" size={14} />
                    </button>
                  </div>
                ) : null}
                {offeringMessage ? (
                  <div className={`adminBanner adminBanner${offeringMessage.tone[0].toUpperCase()}${offeringMessage.tone.slice(1)}`} aria-live="polite">
                    <p>{offeringMessage.text}</p>
                  </div>
                ) : null}
                <div className="productOfferingSummary">
                  {offeringsForTarget.length === 0 ? (
                    <p className="adminContextHint">No hay servicios adicionales asociados a esta variante.</p>
                  ) : (
                    <div className="adminTableScroller">
                      <table className="productBasicFeaturesGrid productVariantServicesTable" aria-label="Servicios adicionales de la variante">
                        <thead><tr><th scope="col">Servicio</th><th scope="col">Precio</th><th scope="col">Activo</th><th scope="col">Acción</th></tr></thead>
                        <tbody>{offeringsForTarget.map((offering) => (
                          <tr key={offering.offeringId}>
                            <th scope="row">{offeringName(offering, locale)}</th>
                            <td>{formatMoney(offering.priceMinor, offering.currency || currency)}</td>
                            <td><input type="checkbox" aria-label={`Activar ${offeringName(offering, locale)}`} checked={offering.active} disabled={isPending} onChange={(event) => setOfferingActivation(offering.offeringId, event.target.checked)} /></td>
                            <td><button className="productFeatureTableAction productFeatureTableDelete" disabled={isPending} type="button" aria-label={`Quitar servicio ${offeringName(offering, locale)}`} title="Quitar servicio de la variante" onClick={() => detachOffering(offering.offeringId)}><Trash2 size={14} aria-hidden="true" /></button></td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>

            <details className="productEditorPanel productBasicSection productVariantShippingPanel adminSection" open>
              <summary><span>Transporte</span></summary>
              <div className="productBasicSectionBody">
                <div className="productVariantShippingHeader">
                  <p className="adminContextHint">{selectedVariant.isDefault ? "Datos base del producto. Las variantes usan estos valores mientras no tengan una excepción propia." : "Cada medida hereda del producto. Al editarla, se guarda como valor propio de esta variante."}</p>
                  {!selectedVariant.isDefault ? <button className="productImageAddLink" type="button" disabled={!Object.keys(selectedVariant.shippingPackage ?? {}).length} onClick={() => updateVariant(selectedVariant.localId, (variant) => ({ ...variant, shippingPackage: {} }))}>Heredar valores</button> : null}
                </div>
                <fieldset className="productVariantShippingFields">
              <div className="adminTableScroller productVariantShippingSummary">
                <table className="productBasicFeaturesGrid" aria-label="Resumen de transporte">
                  <thead><tr><th scope="col">Peso</th><th scope="col">Dimensiones</th><th scope="col">Coste adicional</th><th scope="col">Transportistas</th></tr></thead>
                  <tbody><tr>
                    <td>{shippingPackage.weightGrams != null ? `${shippingPackage.weightGrams} g` : "Sin definir"}</td>
                    <td>{shippingDimensionsComplete ? `${shippingPackage.widthMm} x ${shippingPackage.heightMm} x ${shippingPackage.depthMm} mm` : "Sin definir"}</td>
                    <td>{formatMoney(draft.shipping.additionalShippingCostMinor ?? 0, currency)}</td>
                    <td>{draft.shipping.allowedCarrierIds.length > 0 ? `${draft.shipping.allowedCarrierIds.length} seleccionados` : "Todos los activos"}</td>
                  </tr></tbody>
                </table>
              </div>

              <div className="adminFormGrid productVariantShippingMeasurements">
                {renderShippingMeasurement("weightGrams", "Peso (g)")} 
                <label className="adminField">
                  <span>Coste adicional ({currency})</span>
                  <DecimalNumberInput
                    disabled={!selectedVariant.isDefault}
                    inputMode="decimal"
                    min="0"
                    value={centsToInput(draft.shipping.additionalShippingCostMinor ?? undefined)}
                    onValueChange={(value) => updateShipping((shipping) => ({
                      ...shipping,
                      additionalShippingCostMinor: inputToCents(value),
                    }))}
                  />
                </label>
                {renderShippingMeasurement("widthMm", "Ancho (mm)")} 
                {renderShippingMeasurement("heightMm", "Alto (mm)")} 
                {renderShippingMeasurement("depthMm", "Profundidad (mm)")} 
                <label className="adminField">
                  <span>Plazo de entrega</span>
                  <select
                    disabled={!selectedVariant.isDefault}
                    value={draft.shipping.deliveryTimeMode}
                    onChange={(event) => updateShipping((shipping) => ({
                      ...shipping,
                      deliveryTimeMode: event.target.value as ProductDraft["shipping"]["deliveryTimeMode"],
                    }))}
                  >
                    <option value="none">Sin texto propio</option>
                    <option value="default">Usar plazo por defecto</option>
                    <option value="specific">Texto especifico del producto</option>
                  </select>
                </label>
              </div>

              {draft.shipping.deliveryTimeMode === "specific" ? (
                <div className="adminFormGrid adminFormGridTwo adminSection">
                  <label className="adminField">
                    <span>Entrega con stock ({locale})</span>
                    <textarea
                      disabled={!selectedVariant.isDefault}
                      className="adminTextarea"
                      value={draft.shipping.deliveryTimeNotes.inStock[locale] ?? ""}
                      onChange={(event) => updateShippingDeliveryNote("inStock", event.target.value)}
                    />
                  </label>
                  <label className="adminField">
                    <span>Entrega sin stock ({locale})</span>
                    <textarea
                      disabled={!selectedVariant.isDefault}
                      className="adminTextarea"
                      value={draft.shipping.deliveryTimeNotes.outOfStock[locale] ?? ""}
                      onChange={(event) => updateShippingDeliveryNote("outOfStock", event.target.value)}
                    />
                  </label>
                </div>
              ) : null}

              <div className="productEditorSectionHeader productEditorSectionHeaderCompact adminSection">
                <div>
                  <h3>Transportistas permitidos</h3>
                  <p>Sin seleccion explicita, el producto permite todos los transportistas activos del modulo Transporte.</p>
                </div>
                {draft.shipping.allowedCarrierIds.length > 0 ? (
                  <button
                    className="adminButton"
                    type="button"
                    disabled={!selectedVariant.isDefault}
                    onClick={() => updateShipping((shipping) => ({ ...shipping, allowedCarrierIds: [] }))}
                  >
                    Permitir todos
                  </button>
                ) : null}
              </div>

              {carrierOptions.length > 0 ? (
                <div className="productShippingCarrierGrid">
                  {carrierOptions.map((carrier) => {
                    const checked = draft.shipping.allowedCarrierIds.includes(carrier.id);
                    return (
                      <label className={`productShippingCarrier ${checked ? "productShippingCarrierActive" : ""}`} key={carrier.id}>
                        <input
                          checked={checked}
                          type="checkbox"
                          disabled={!selectedVariant.isDefault}
                          onChange={(event) => toggleShippingCarrier(carrier.id, event.target.checked)}
                        />
                        <span>
                          <strong>{carrier.label}</strong>
                          <small>{carrier.id}</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="adminBanner adminSection">
                  <p>No hay transportistas cargados desde BFF Shipping. Puedes guardar paquete y coste; la seleccion de carriers quedara en todos los activos.</p>
                </div>
              )}
                </fieldset>
              </div>
            </details>
            </>
          ) : null}

          {activeTab === "pricing" ? (
            <>
            <section className="productEditorPanel productSpecificPricePanel">
              {lookups.warnings.filter((warning) => warning.startsWith("Pricing") && (!taxReloadSucceeded || !warning.startsWith("Pricing taxes:"))).map((warning) => (
                <div className="adminBanner adminBannerInfo" key={warning}><p>{warning}</p></div>
              ))}
              <section className="productSpecificPriceList productListGrid" aria-label="Precios específicos">
                <div className="productSpecificPriceListHeader">
                  <h2>Precio específico</h2>
                  <button className="productImageAddLink" type="button" aria-haspopup="dialog" onClick={openSpecificPriceDrawer}>
                    Agregar precio específico
                  </button>
                </div>
                <div className="adminTableScroller productListTableScroller">
                  <table className="adminTable productListTable productSpecificPriceTable" aria-label="Precios específicos">
                    <thead>
                      <tr>
                        <th scope="col">Aplicación</th>
                        <th scope="col">Precio</th>
                        <th scope="col">Unidades</th>
                        <th scope="col">Duración</th>
                        <th scope="col">Contexto</th>
                        <th scope="col">Estado</th>
                        <th scope="col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleSpecificPrices.length === 0 ? (
                        <tr><td colSpan={7}>No hay precios específicos. Agrega uno para el producto o una combinación.</td></tr>
                      ) : specificPrices.map((price, index) => price.markedForDeletion ? null : (
                        <tr key={price.pricingId ?? `${price.targetType}-${index}`}>
                          <td className="productListNameCell">
                            <strong>{specificPriceTargetLabel(price)}</strong>
                          </td>
                          <td>
                            <strong>{formatMoney(price.fixedPriceMinor ?? undefined, price.currency ?? productPrice?.currency ?? currency)}</strong>
                          </td>
                          <td>{price.minQuantity || 1}</td>
                          <td>{price.validUntil ? price.validUntil.slice(0, 10) : "Ilimitado"}</td>
                          <td>
                            <div>{price.country || "Todos los países"} · {price.customerGroup || "Todos los grupos"}</div>
                          </td>
                          <td><span className={`adminBadge ${price.active ? "adminBadgeOk" : "adminBadgeWarn"}`}>{price.active ? "Activo" : "Inactivo"}</span></td>
                          <td>
                            <div className="productListActions">
                              <button className="adminButton employeesActionInfo" type="button" title="Editar" aria-haspopup="dialog" onClick={() => editSpecificPrice(index)}>
                                <Pencil size={16} aria-hidden="true" /><span className="adminVisuallyHidden">Editar precio específico para {specificPriceTargetLabel(price)}</span>
                              </button>
                              <button className="adminButton employeesActionWarning" type="button" title="Eliminar" onClick={() => removeSpecificPrice(index)}>
                                <Trash2 size={16} aria-hidden="true" /><span className="adminVisuallyHidden">Eliminar precio específico para {specificPriceTargetLabel(price)}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              {report?.blocks.pricing === "failed" ? (
                <div className="adminBanner adminBannerError adminSection">
                  <p>Pricing fallo sin romper Catalog/Media.</p>
                  <button className="adminButton" type="button" onClick={() => saveDraft()}>Reintentar precio</button>
                </div>
              ) : null}
            </section>
              <details className="productEditorPanel productPriceSimulator productSpecificPrices productPricingAdvanced adminSection">
                <summary className="productPricingPreviewSummary">
                  <span className="productPricingSummaryLabel">
                    <ChevronRight aria-hidden="true" className="productCollapseIcon" size={16} />
                    <span>Simulador de precio aplicado</span>
                  </span>
                  <span className={`adminBadge ${pricingPreviewResult?.ok ? "adminBadgeOk" : "adminBadgeWarn"}`}>
                    {pricingPreviewResult?.status === "ERROR" ? "Error de simulación" : pricingPreviewResult ? pricingResolutionLabel(pricingPreviewResult.resolution.source) : "Sin simular"}
                  </span>
                </summary>
                <section className="productPriceSimulatorForm" aria-label="Parámetros de simulación">
                <p className="adminContextHint">Confirma el precio que Pricing devuelve para producto, variante y contexto.</p>
                <div className="adminFormGrid productPriceSimulatorGrid">
                  <label className="adminField">
                    <span>Aplicar sobre</span>
                    <select
                      value={pricingPreviewForm.targetKey}
                      onChange={(event) => setPricingPreviewForm((current) => ({ ...current, targetKey: event.target.value }))}
                    >
                      <option value="__product__">Producto completo · {draft.defaultVariant.refId || draft.basic.name}</option>
                      {priceVariantRows.map((variant) => (
                        <option key={variant.localId} value={variant.localId}>
                          {variant.name || variant.refId || "Variante"} · {variant.refId || "sin referencia"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="adminField">
                    <span>Cantidad</span>
                    <input
                      min="1"
                      step="1"
                      type="number"
                      value={pricingPreviewForm.quantity}
                      onChange={(event) => setPricingPreviewForm((current) => ({ ...current, quantity: event.target.value }))}
                    />
                  </label>
                  <label className="adminField">
                    <span>Pais</span>
                    <select
                      value={pricingPreviewForm.country}
                      onChange={(event) => setPricingPreviewForm((current) => ({ ...current, country: event.target.value }))}
                    >
                      <option value="">País del contexto</option>
                      {previewCountryOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="adminField">
                    <span>Canal</span>
                    <select
                      value={pricingPreviewForm.channel}
                      onChange={(event) => setPricingPreviewForm((current) => ({ ...current, channel: event.target.value }))}
                    >
                      <option value="">Canal del contexto</option>
                      {previewChannelOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="adminField">
                    <span>Politica comercial</span>
                    <select
                      value={pricingPreviewForm.tradePolicy}
                      onChange={(event) => setPricingPreviewForm((current) => ({ ...current, tradePolicy: event.target.value }))}
                    >
                      <option value="">Sin política</option>
                      {previewTradePolicyOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="adminField">
                    <span>Grupo cliente</span>
                    <select
                      value={pricingPreviewForm.customerGroup}
                      onChange={(event) => setPricingPreviewForm((current) => ({ ...current, customerGroup: event.target.value }))}
                    >
                      <option value="">Todos</option>
                      {previewCustomerGroupOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="adminField">
                    <span>Price table</span>
                    <select
                      value={pricingPreviewForm.priceTableId}
                      onChange={(event) => setPricingPreviewForm((current) => ({ ...current, priceTableId: event.target.value }))}
                    >
                      <option value="">Auto / base</option>
                      {priceTableOptions.map((table) => (
                        <option key={table.id} value={table.id}>{table.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="adminField">
                    <span>Fecha de simulacion</span>
                    <input
                      type="datetime-local"
                      value={pricingPreviewForm.at}
                      onChange={(event) => setPricingPreviewForm((current) => ({ ...current, at: event.target.value }))}
                    />
                  </label>
                </div>
                {pricingPreviewDateError ? <p className="adminBanner adminBannerError" role="alert">{pricingPreviewDateError}</p> : null}
                <div className="adminButtonRow adminSection">
                  <button
                    className="adminButton adminButtonPrimary"
                    disabled={pricingPreviewBusy}
                    type="button"
                    onClick={runPricingPreview}
                  >
                    {pricingPreviewBusy ? "Simulando..." : "Simular precio"}
                  </button>
                  <button
                    className="adminButton"
                    type="button"
                    onClick={() => {
                      setPricingPreviewForm(defaultPricingPreviewForm(productPrice, "__product__"));
                      setPricingPreviewDateError(null);
                      setPricingPreviewResult(null);
                    }}
                  >
                    Reiniciar
                  </button>
                </div>
                </section>
                {pricingPreviewResult ? (
                  <div className="productPriceSimulatorResults">
                    {pricingPreviewResult.ok && pricingPreviewResult.price ? (
                      <section className="productPriceSimulatorResult productSpecificPriceList productListGrid adminTableScroller" aria-label="Resultado de simulación">
                        <table className="adminTable productListTable productSpecificPriceTable" aria-label="Precio simulado">
                          <thead><tr><th scope="col">Nombre artículo</th><th scope="col">Precio base</th><th scope="col">Precio aplicado</th></tr></thead>
                          <tbody><tr>
                            <td>{pricingPreviewForm.targetKey === "__product__" ? draft.basic.name : pricingPreviewTarget?.name || pricingPreviewTarget?.refId || draft.basic.name}</td>
                            <td>{formatMoney(pricingPreviewResult.price.basePrice.amountMinor, pricingPreviewResult.price.currency)}</td>
                            <td>{formatMoney(
                              pricingPreviewResult.price.resolved?.grossAmountMinor ??
                                pricingPreviewResult.price.fixedPrice?.amountMinor ??
                                pricingPreviewResult.price.basePrice.amountMinor,
                              pricingPreviewResult.price.resolved?.currency ?? pricingPreviewResult.price.currency,
                            )}</td>
                          </tr></tbody>
                        </table>
                      </section>
                    ) : (
                      <div className="adminBanner adminBannerError">
                        <p>{pricingPreviewResult.reason ?? "No hay precio aplicable para estos parametros."}</p>
                      </div>
                    )}
                    {pricingPreviewResult.conditions.length > 0 ? (
                      <section className="productPriceSimulatorConditions productSpecificPriceList productListGrid adminTableScroller" aria-label="Resumen de condiciones">
                        <table className="adminTable productListTable productSpecificPriceTable" aria-label="Condiciones del precio simulado">
                          <thead>
                            <tr>
                              <th>Parametro</th>
                              <th>Solicitado</th>
                              <th>Regla aplicada</th>
                              <th>Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pricingPreviewResult.conditions.map((condition) => (
                              <tr key={condition.key}>
                                <td>{pricingConditionLabel(condition.key)}</td>
                                <td>{condition.requested ?? "Todos"}</td>
                                <td>{condition.matched ?? "Todos"}</td>
                                <td>
                                  <span className={`adminBadge ${condition.status === "MATCH" || condition.status === "ANY" ? "adminBadgeOk" : "adminBadgeWarn"}`}>
                                    {pricingConditionStatusLabel(condition.status)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </section>
                    ) : null}
                  </div>
                ) : null}
              </details>
            </>
          ) : null}

          {activeTab === "audit" ? (
            <>
              <details className="productEditorPanel productBasicSection" open>
                <summary><span>Resumen de inventario</span></summary>
                <div className="productBasicSectionBody adminTableScroller">
                  <table className="productBasicFeaturesGrid productInventoryOverview" aria-label="Resumen de inventario por variante">
                    <thead><tr><th scope="col">Variante</th><th scope="col">Almacén</th><th scope="col">Existencias</th><th scope="col">Reservado</th><th scope="col">Seguridad</th><th scope="col">Disponible</th><th scope="col">Estado</th><th scope="col">Origen</th></tr></thead>
                    <tbody>{allVariantRows.map((row) => {
                      const state = row.isDefault ? { stock: stockForKey("default"), mode: "own" } : stockForVariantRow(row);
                      const stock = state.stock;
                      const available = availableQuantity(stock);
                      return <tr key={row.localId} aria-selected={selectedVariant.localId === row.localId}>
                        <th scope="row"><button className="productImageAddLink" type="button" aria-label={`Ver inventario de ${row.refId}`} onClick={() => { setSelectedVariantKey(row.localId); setActiveTab("variants"); }}>{row.isDefault ? "Producto" : row.refId}</button></th>
                        <td>{warehouseOptions.find((warehouse) => warehouse.id === stock.warehouseId)?.label ?? (stock.warehouseId || "Contexto de tienda")}</td>
                        <td>{stock.onHandQuantity}</td><td>{stock.reservedQuantity}</td><td>{stock.safetyStockQuantity}</td><td>{available}{stock.availabilityEstimated ? " (estimado)" : ""}</td><td>{(stock.available ?? available > 0) ? "Disponible" : "Sin disponibilidad"}</td><td>{row.isDefault ? "Producto" : state.mode === "own" ? "Propio" : "Producto"}</td>
                      </tr>;
                    })}</tbody>
                  </table>
                  <p className="adminContextHint">El stock compartido del producto no se suma una vez por cada variante.</p>
                </div>
              </details>
              <details className="productEditorPanel productBasicSection productAuditPrices adminSection" open>
                <summary><span>Precios fijados</span></summary>
                <div className="productBasicSectionBody adminTableScroller">
                  <table className="productBasicFeaturesGrid" aria-label="Precios fijados del producto y variantes">
                    <thead><tr><th scope="col">Artículo</th><th scope="col">Tipo</th><th scope="col">Precio</th><th scope="col">Unidades mínimas</th><th scope="col">Contexto</th><th scope="col">Vigencia</th><th scope="col">Estado</th></tr></thead>
                    <tbody>
                      {auditPriceRows.length ? auditPriceRows.map(row => <tr key={row.key}>
                        <th scope="row">{row.name}</th><td>{row.type}</td><td>{row.amount}</td><td>{row.quantity}</td><td>{row.context}</td><td>{row.validity}</td><td>{row.active ? "Activo" : "Inactivo"}</td>
                      </tr>) : <tr><td colSpan={7}>No hay precios fijados.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </details>
              {draft.routingSeo.canonicalPath || draft.routingSeo.canonicalRouteId || draft.routingSeo.resolvedCanonical || draft.routingSeo.aliases.some(alias => !alias.markedForDeletion) ? (
                <details className="productEditorPanel productBasicSection productAuditSeo adminSection" open>
                  <summary><span>Routing/SEO</span></summary>
                  <div className="productBasicSectionBody adminTableScroller">
                    <table className="productBasicFeaturesGrid" aria-label="Resumen de Routing y SEO">
                      <tbody>
                        <tr><th scope="row">Canonical</th><td>{draft.routingSeo.canonicalPath || draft.routingSeo.resolvedCanonical?.canonicalPath || "Pendiente"}</td></tr>
                        <tr><th scope="row">Estado ruta</th><td>{draft.routingSeo.status}</td></tr>
                        <tr><th scope="row">Sitemap</th><td>{draft.routingSeo.includeInSitemap ? "Incluido" : "Excluido"}</td></tr>
                        <tr><th scope="row">Aliases activos</th><td>{draft.routingSeo.aliases.filter(alias => !alias.markedForDeletion && alias.status === "ACTIVE").length}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </details>
              ) : null}
            </>
          ) : null}
        </section>

        {activeTab !== "audit" && activeTab !== "pricing" ? <aside className="productEditorSidePanel">
          <section className="productEditorPanel">
            <div className="productImagePanelHeader">
              <h2>Imágenes</h2>
              <button className="productImageAddLink" type="button" onClick={openMediaFilePicker} disabled={mediaPickerBusy}>
                {mediaPickerBusy ? "Abriendo…" : "Añadir imagen"}
              </button>
            </div>
            <input ref={mediaFileInputRef} className="productFileInput" type="file" accept="image/*" multiple onChange={handleMediaFileInputChange} />
            <ProductSummaryGallery
              images={[...draft.media.items].sort((a, b) => Number(Boolean(b.isMain)) - Number(Boolean(a.isMain)))
                .filter((item) => hasRenderableMediaPreview(item))
                .flatMap((item) => {
                  const src = mediaPreviewSrc(item);
                  return src ? [{ id: item.localId, src, alt: item.alt[locale] || item.fileName }] : [];
                })}
              onImageError={markMediaPreviewBroken}
              selectedId={selectedMedia?.localId}
              onSelect={setSelectedMediaId}
              onRemove={removeMedia}
            />
            {mediaPickerMessage ? <p className="productMediaStatus" role="status">{mediaPickerMessage}</p> : null}
            {report?.fieldErrors.media ? <p className="adminBanner adminBannerError">{report.fieldErrors.media}</p> : null}
            {selectedMedia ? (
              <div className="productImageMetadata" key={selectedMedia.localId}>
                <h3>Metadata</h3>
                <div className="productImageMetadataFields">
                  <label className="adminField">
                    <span>Título del asset</span>
                    <input title="Título del asset" value={selectedMedia.title[locale] ?? ""} onChange={(event) => updateMedia(selectedMedia.localId, (item) => ({ ...item, title: { ...item.title, [locale]: event.target.value } }))} />
                  </label>
                  <label className="adminField">
                    <span>Alt del asset</span>
                    <input title="Alt del asset" value={selectedMedia.alt[locale] ?? ""} onChange={(event) => updateMedia(selectedMedia.localId, (item) => ({ ...item, alt: { ...item.alt, [locale]: event.target.value } }))} />
                  </label>
                </div>
                <div className="productImageMetadataOptions">
                  <label className="adminCheckbox">
                    <input type="checkbox" checked={selectedMedia.isMain} onChange={(event) => updateDraft((current) => assignVariantImage(current, "default", event.target.checked ? selectedMedia.localId : undefined))} disabled={!selectedMedia.active} />
                    Imagen de portada
                  </label>
                  <label className="adminCheckbox">
                    <input type="checkbox" checked={selectedMedia.active} onChange={(event) => updateMedia(selectedMedia.localId, (item) => ({ ...item, active: event.target.checked }))} />
                    Activa
                  </label>
                </div>
              </div>
            ) : null}
          </section>

          {activeTab === "variants" ? (<>
              <section className="productEditorPanel productVariantAttributePanel">
                <div className="productImagePanelHeader">
                  <h2>Atributos de la variante</h2>
                  <button className="productImageAddLink" type="button" aria-label="Añadir atributo a la variante" title="Añadir atributo" disabled={selectedVariant.isDefault} onClick={openVariantAttributePicker}><Plus size={16} aria-hidden="true" /></button>
                </div>
                {activeSelectedVariantOptions.length ? (
                  <table className="productBasicFeaturesGrid productVariantAssignedAttributes" aria-label="Atributos asignados a la variante">
                    <tbody>{selectedVariant.options.map((option, index) => {
                      if (option.markedForDeletion || option.isActive === false) return null;
                      const field = findVariantAttributeField(variantAttributeFields, option.attributeCode);
                      const value = findVariantAttributeValue(field, option.valueCode);
                      return <tr key={`${option.attributeCode}-${index}`}>
                        <th scope="row">{field?.name ?? option.attributeCode}</th>
                        <td>{value?.name ?? option.valueCode}</td>
                        <td><button className="productFeatureTableAction productFeatureTableDelete" type="button" disabled={selectedVariant.isDefault} aria-label={`Quitar atributo ${option.attributeCode}`} onClick={() => removeSelectedVariantOption(index)}><Trash2 size={14} aria-hidden="true" /></button></td>
                      </tr>;
                    })}</tbody>
                  </table>
                ) : !selectedVariant.isDefault ? <p className="adminContextHint">Sin atributos asignados.</p> : null}
                {variantOptionWarning(selectedVariant) || report?.fieldErrors[`variant:${selectedVariant.localId}:options`] ? <p className="adminBanner adminBannerError">{variantOptionWarning(selectedVariant) ?? report?.fieldErrors[`variant:${selectedVariant.localId}:options`]}</p> : null}
              </section>
              <section className="productEditorPanel productSelectedVariantIdentity">
                <h2>Datos de la variante seleccionada</h2>
                <p className="adminContextHint">{selectedVariant.isDefault ? "Variante 0 · comparte nombre y referencia con los datos base del producto." : selectedVariant.name}</p>
                <div className="adminFormGrid adminFormGridTwo">
                  <label className="adminField"><span>Nombre</span><input aria-label="Nombre de la variante seleccionada" value={selectedVariant.name} onChange={(event) => selectedVariant.isDefault ? updateBasic("name", event.target.value) : updateVariant(selectedVariant.localId, (item) => ({ ...item, name: event.target.value }))} /></label>
                  <label className="adminField"><span>Referencia / SKU</span><input aria-label="Referencia de la variante seleccionada" value={selectedVariant.refId} onChange={(event) => selectedVariant.isDefault ? updateDraft((current) => ({ ...current, defaultVariant: { ...current.defaultVariant, refId: event.target.value } })) : updateVariant(selectedVariant.localId, (item) => ({ ...item, refId: event.target.value }))} /></label>
                  <label className="adminField"><span>EAN</span><input value={selectedVariant.ean ?? ""} onChange={(event) => selectedVariant.isDefault ? updateDraft((current) => ({ ...current, defaultVariant: { ...current.defaultVariant, ean: event.target.value || null } })) : updateVariant(selectedVariant.localId, (item) => ({ ...item, ean: event.target.value || null }))} /></label>
                  <div className="productSelectedVariantStates">
                    <label className="adminCheckbox"><input type="checkbox" checked={selectedVariant.isActive} onChange={(event) => selectedVariant.isDefault ? updateBasic("isActive", event.target.checked) : updateVariant(selectedVariant.localId, (item) => ({ ...item, isActive: event.target.checked }))} />Activa</label>
                  <label className="adminCheckbox"><input type="checkbox" checked={selectedVariant.isVisible} onChange={(event) => selectedVariant.isDefault ? updateBasic("isVisible", event.target.checked) : updateVariant(selectedVariant.localId, (item) => ({ ...item, isVisible: event.target.checked }))} />Visible</label>
                  </div>
                </div>
                {report?.fieldErrors[selectedVariant.isDefault ? "refId" : `variant:${selectedVariant.localId}:refId`] ? <p className="adminBanner adminBannerError">{report.fieldErrors[selectedVariant.isDefault ? "refId" : `variant:${selectedVariant.localId}:refId`]}</p> : null}

              </section>
<details className="productEditorPanel productBasicSection productVariantPricePanel" open>
                  <summary><span className="productPriceHeading">Precio normal: <span className="productBasicSummaryHint">{formatMoney(selectedPanelPrice?.basePriceMinor, selectedPanelPrice?.currency || currency, locale)}</span></span></summary>
                  {!selectedVariant.isDefault ? <button className="productPriceInherit" type="button" aria-label={inheritPriceLabel} title={`${inheritPriceLabel}. Se aplicará al guardar.`} disabled={savingActive || !selectedPanelHasOwnPrice} onClick={() => {
                    removeVariantPrice(draft.pricing.variantPrices[selectedVariant.localId] ? selectedVariant.localId : selectedVariant.variantId ?? selectedVariant.localId);
                  }}><RotateCcw size={15} aria-hidden="true" /></button> : null}
                  <div className="productBasicSectionBody productBasicPricing">
                  <div className="productPriceFields">
                    <div className="productPriceAmounts">
                    <label className="adminField">
                      <span>Precio sin impuestos</span>
                      <DecimalNumberInput
                        min="0"
                        value={centsToInput(netMinorFromPrice(selectedPanelPrice, selectedPanelTax))}
                        onValueChange={(value) => updateSelectedPanelPrice((price) => ({
                          ...price,
                          basePriceMinor: baseMinorFromNetInput(value, price, selectedPanelTax),
                          priceKind: value.trim() ? "REGULAR" : undefined,
                          currency: price.currency || currency,
                        }))}
                      />
                    </label>
                    <label className="adminField">
                      <span>Precio con impuestos</span>
                      <DecimalNumberInput
                        min="0"
                        value={centsToInput(grossMinorFromPrice(selectedPanelPrice, selectedPanelTax))}
                        onValueChange={(value) => updateSelectedPanelPrice((price) => ({
                          ...price,
                          basePriceMinor: baseMinorFromGrossInput(value, price, selectedPanelTax),
                          priceKind: value.trim() ? "REGULAR" : undefined,
                          currency: price.currency || currency,
                        }))}
                      />
                    </label>
                    
                    <label className="adminField">
                      <span>Coste</span>
                      <DecimalNumberInput
                        min="0"
                        value={centsToInput(selectedPanelPrice?.costPriceMinor ?? undefined)}
                        onValueChange={(value) => updateSelectedPanelPrice((price) => ({
                          ...price,
                          costPriceMinor: inputToCents(value) || null,
                        }))}
                      />
                    </label>
                    <label className="adminField">
                      <span>Precio tachado</span>
                      <DecimalNumberInput
                        min="0"
                        value={centsToInput(selectedPanelPrice?.listPriceMinor ?? undefined)}
                        onValueChange={(value) => updateSelectedPanelPrice((price) => ({
                          ...price,
                          listPriceMinor: inputToCents(value) || null,
                        }))}
                      />
                    </label>
                  
                    </div>
                    <div className="productPriceTaxRow">
                    
                    <label className="adminField productPriceTaxField">
                      <span>Impuestos</span>
                      <select
                        disabled={selectedPanelTaxOptions.length === 0}
                        value={selectedPanelTax?.id ?? ""}
                        onChange={(event) => {
                          const tax = selectedPanelTaxOptions.find((item) => item.id === event.target.value) ?? null;
                          updateSelectedPanelPrice((price) => ({
                            ...price,
                            taxCode: tax?.taxCode ?? draft.basic.taxCode ?? "standard",
                            tax,
                          }));
                        }}
                      >
                        <option value="">{selectedPanelTaxOptions.length ? "Sin regla fiscal" : "Sin reglas fiscales cargadas"}</option>
                        {selectedPanelTaxOptions.map((tax) => (
                          <option key={tax.id} value={tax.id}>{tax.label}</option>
                        ))}
                      </select>
                      {report?.fieldErrors[selectedPanelTaxErrorKey] ? (
                        <small>{report.fieldErrors[selectedPanelTaxErrorKey]}</small>
                      ) : null}
                    </label>
                    <label className="adminCheckbox productPriceTaxToggle">
                      <input type="checkbox" checked={selectedPanelPrice?.taxIncluded ?? true} onChange={event => updateSelectedPanelPrice(price => ({...price, taxIncluded: event.target.checked}))} />
                      Impuestos incluidos
                    </label>
                    </div>
                  </div>
                </div>
                </details>
<ProductInventoryPanel
                stock={selectedPanelStock.stock}
                warehouses={warehouseOptions}
                warehouseError={stockWarehouseMessage ?? lookups?.warehouseLoadError}
                loading={stockWarehouseLoading}
                canRestore={!selectedVariant.isDefault && selectedPanelStock.mode === "own" && !directStockEntryForVariant(selectedVariant)?.stock.persisted}
                onRestore={!selectedVariant.isDefault ? () => inheritVariantStock(selectedVariant) : undefined}
                onQuantity={updateSelectedPanelStock}
                onWarehouse={(value) => { void selectStockWarehouse(value); }}
                failed={report?.blocks.inventory === "failed"}
                onRetry={() => saveDraft()}
              />
          </>) : null}


          {activeTab === "basic" ? (
            <>
<details className="productEditorPanel productBasicSection" open>
                <summary><span>Categoría/Marca: <span className="productBasicSummaryHint">{categoryOptions.find((item) => item.id === draft.basic.categoryId)?.label || draft.basic.categoryName || "Sin categoría"}/{brandOptions.find((item) => item.id === draft.basic.brandId)?.label || draft.basic.brandName || (draft.basic.brandId ? "Marca no disponible" : "Sin marca")}</span></span></summary>
                <div className="productBasicSectionBody adminFormGrid adminFormGridTwo">
                  <ProductEntitySelector
                    canCreate={canCreateCategories}
                    createAction={createProductCategoryInlineAction}
                    fieldError={report?.fieldErrors.categoryId}
                    label="Categoria principal"
                    onSelect={(option) => {
                      generationVersion.current += 1;
                      setGeneratorSelections({});
                      updateDraft((current) => ({
                      ...current,
                      basic: {
                        ...current.basic,
                        categoryId: option.id,
                        categoryName: option.label,
                        categorySlug: option.slug,
                      },
                    }));
                    }}
                    options={categoryOptions}
                    kind="categories"
                    selectedId={draft.basic.categoryId}
                  />
                  <ProductEntitySelector
                    canCreate={canCreateBrands}
                    createAction={createProductBrandInlineAction}
                    label="Marca / proveedor"
                    onSelect={(option) => updateDraft((current) => ({
                      ...current,
                      basic: {
                        ...current.basic,
                        brandId: option.id,
                        brandName: option.label,
                      },
                    }))}
                    options={brandOptions}
                    kind="brands"
                    selectedId={draft.basic.brandId}
                  />
                </div>
              </details>
              <section className="productEditorPanel productBasicFeatures">
                <div className="productImagePanelHeader">
                  <h2>Características</h2>
                  <button className="productImageAddLink" type="button" onClick={openSpecificationPicker}>Agregar</button>
                </div>
                {featureLoadError ? (
                  <div className="adminBanner adminBannerError" role="alert">
                    <p>No se pudieron cargar las características. {featureLoadError}</p>
                    <button className="adminButton" type="button" disabled={featureRefreshing} onClick={refreshFeatureCatalog}>{featureRefreshing ? "Actualizando…" : "Reintentar"}</button>
                  </div>
                ) : null}
                {selectedSpecifications.length ? (
                  <table className="productBasicFeaturesGrid" aria-label="Características añadidas">
                    <colgroup><col className="productFeatureNameColumn" /><col /><col className="productFeatureActionColumn" /></colgroup>
                    <tbody>
                      {selectedSpecifications.map(({ field, value }) => (
                        <tr key={field.fieldId}>
                          <th scope="row">{field.name}</th>
                          <td>{value.name}</td>
                          <td className="productFeatureActionCell"><button className="productFeatureTableAction productFeatureTableDelete" type="button" aria-label={`Quitar ${field.name}`} title={`Quitar ${field.name}`} onClick={() => removeSpecificationSelection(field.fieldId)}><Trash2 size={15} aria-hidden="true" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="adminContextHint">Sin características añadidas.</p>}
              </section>
<details className="productEditorPanel productBasicSection" open>
                  <summary><span>Precio normal: <span className="productBasicSummaryHint">{formatMoney(productPrice?.basePriceMinor, productPrice?.currency || currency, locale)}</span></span></summary>
                  <div className="productBasicSectionBody productBasicPricing">
                  <div className="productPriceFields">
                    <div className="productPriceAmounts">
                    <label className="adminField">
                      <span>Precio sin impuestos</span>
                      <DecimalNumberInput
                        min="0"
                        value={centsToInput(netMinorFromPrice(productPrice, selectedTax))}
                        onValueChange={(value) => updateProductPriceField((price) => ({
                          ...price,
                          basePriceMinor: baseMinorFromNetInput(value, price, selectedTax),
                          priceKind: value.trim() ? "REGULAR" : undefined,
                          currency: price.currency || currency,
                        }))}
                      />
                    </label>
                    <label className="adminField">
                      <span>Precio con impuestos</span>
                      <DecimalNumberInput
                        min="0"
                        value={centsToInput(grossMinorFromPrice(productPrice, selectedTax))}
                        onValueChange={(value) => updateProductPriceField((price) => ({
                          ...price,
                          basePriceMinor: baseMinorFromGrossInput(value, price, selectedTax),
                          priceKind: value.trim() ? "REGULAR" : undefined,
                          currency: price.currency || currency,
                        }))}
                      />
                    </label>
                    
                    <label className="adminField">
                      <span>Coste</span>
                      <DecimalNumberInput
                        min="0"
                        value={centsToInput(productPrice?.costPriceMinor ?? undefined)}
                        onValueChange={(value) => updateProductPriceField((price) => ({
                          ...price,
                          costPriceMinor: inputToCents(value) || null,
                        }))}
                      />
                    </label>
                    <label className="adminField">
                      <span>Precio tachado</span>
                      <DecimalNumberInput
                        min="0"
                        value={centsToInput(productPrice?.listPriceMinor ?? undefined)}
                        onValueChange={(value) => updateProductPriceField((price) => ({
                          ...price,
                          listPriceMinor: inputToCents(value) || null,
                        }))}
                      />
                    </label>
                  
                    </div>
                    <div className="productPriceTaxRow">
                    
                    <label className="adminField productPriceTaxField">
                      <span>Impuestos</span>
                      <select
                        disabled={taxOptions.length === 0}
                        value={selectedTax?.id ?? ""}
                        onChange={(event) => {
                          const tax = taxOptions.find((item) => item.id === event.target.value) ?? null;
                          updateProductPriceField((price) => ({
                            ...price,
                            taxCode: tax?.taxCode ?? draft.basic.taxCode ?? "standard",
                            tax,
                          }));
                        }}
                      >
                        <option value="">{taxOptions.length ? "Sin regla fiscal" : "Sin reglas fiscales cargadas"}</option>
                        {taxOptions.map((tax) => (
                          <option key={tax.id} value={tax.id}>{tax.label}</option>
                        ))}
                      </select>
                      {report?.fieldErrors[basePriceTaxErrorKey] ? (
                        <small>{report.fieldErrors[basePriceTaxErrorKey]}</small>
                      ) : null}
                    </label>
                    <label className="adminCheckbox productPriceTaxToggle">
                      <input type="checkbox" checked={productPrice?.taxIncluded ?? true} onChange={event => updateProductPriceField(price => ({...price, taxIncluded: event.target.checked}))} />
                      Impuestos incluidos
                    </label>
                    </div>
                  </div>
                </div>
                </details>
              <ProductInventoryPanel
                stock={stockForKey("default")}
                warehouses={warehouseOptions}
                warehouseError={stockWarehouseMessage ?? lookups?.warehouseLoadError}
                loading={stockWarehouseLoading}
                canRestore={false}

                onQuantity={(field, value) => updateStockNumber("default", field, value)}
                onWarehouse={(value) => { void selectStockWarehouse(value, true); }}
                failed={report?.blocks.inventory === "failed"}
                onRetry={() => saveDraft()}
              />
            </>
          ) : null}

        </aside> : null}
      </div>

      {specificPriceDrawerOpen ? (
        <AdminResourceDrawer drawerId="product-specific-price"
          title={specificPriceEditIndex === null ? "Agregar precio específico" : "Editar precio específico"}
          description="Se añadirá al borrador. Guarda el producto para aplicar los cambios."
          className="productSpecificPriceDrawer"
          onClose={closeSpecificPriceDrawer}
        >
                <div className="productSpecificPriceForm">
                  <div className="adminFormGrid adminFormGridTwo">
                    <label className="adminField productSpecificPriceTarget">
                      <span>Aplicar a</span>
                      <select
                        value={specificPriceForm.targetKey}
                        onChange={(event) => setSpecificPriceForm((current) => ({ ...current, targetKey: event.target.value }))}
                      >
                        {specificPriceTargetOptions.map((target) => (
                          <option key={target.key} value={target.key}>
                            {target.label} · {target.refId}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="adminField">
                      <span>Precio especifico</span>
                      <DecimalNumberInput
                        aria-label="Precio especifico"
                        min="0"
                        value={specificPriceForm.fixedPrice}
                        onValueChange={(value) => setSpecificPriceForm((current) => ({ ...current, fixedPrice: value }))}
                      />
                    </label>
                    <label className="adminField">
                      <span>Minimo de unidades</span>
                      <input
                        min="1"
                        step="1"
                        type="number"
                        value={specificPriceForm.minQuantity}
                        onChange={(event) => setSpecificPriceForm((current) => ({ ...current, minQuantity: event.target.value }))}
                      />
                    </label>
                    <label className="adminField">
                      <span>Fecha inicial</span>
                      <input
                        type="datetime-local"
                        value={specificPriceForm.validFrom}
                        onChange={(event) => setSpecificPriceForm((current) => ({ ...current, validFrom: event.target.value }))}
                      />
                    </label>
                    <label className="adminField">
                      <span>Fecha final</span>
                      <input
                        type="datetime-local"
                        value={specificPriceForm.validUntil}
                        onChange={(event) => setSpecificPriceForm((current) => ({ ...current, validUntil: event.target.value }))}
                      />
                    </label>
                  </div>
                  <details className="productPricingAdvanced">
                    <summary>
                      <ChevronRight aria-hidden="true" className="productCollapseIcon" size={16} />
                      <span>Condiciones avanzadas</span>
                    </summary>
                    <div className="adminFormGrid adminFormGridTwo">
                      <label className="adminField">
                        <span>Pais</span>
                        <select
                          value={specificPriceForm.country}
                          onChange={(event) => setSpecificPriceForm((current) => ({ ...current, country: event.target.value }))}
                        >
                          <option value="">Todos</option>
                          {specificCountryOptions.map((option) => (
                            <option key={option.id} value={option.id}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="adminField">
                        <span>Grupo cliente</span>
                        <select
                          value={specificPriceForm.customerGroup}
                          onChange={(event) => setSpecificPriceForm((current) => ({ ...current, customerGroup: event.target.value }))}
                        >
                          <option value="">Todos</option>
                          {specificCustomerGroupOptions.map((option) => (
                            <option key={option.id} value={option.id}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="adminField">
                        <span>Canal</span>
                        <select
                          value={specificPriceForm.channel}
                          onChange={(event) => setSpecificPriceForm((current) => ({ ...current, channel: event.target.value }))}
                        >
                          <option value="">Todos los canales</option>
                      {specificChannelOptions.map((option) => (
                            <option key={option.id} value={option.id}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="adminField">
                        <span>Politica comercial</span>
                        <select
                          value={specificPriceForm.tradePolicy}
                          onChange={(event) => setSpecificPriceForm((current) => ({ ...current, tradePolicy: event.target.value }))}
                        >
                          <option value="">Todas las políticas</option>
                      {specificTradePolicyOptions.map((option) => (
                            <option key={option.id} value={option.id}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="adminField">
                        <span>Price table</span>
                        <select
                          value={specificPriceForm.priceTableId}
                          onChange={(event) => setSpecificPriceForm((current) => ({ ...current, priceTableId: event.target.value }))}
                        >
                          <option value="">Sin tabla</option>
                          {priceTableOptions.map((table) => (
                            <option key={table.id} value={table.id}>{table.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="adminField">
                        <span>Prioridad</span>
                        <input
                          min="1"
                          step="1"
                          type="number"
                          value={specificPriceForm.priority}
                          onChange={(event) => setSpecificPriceForm((current) => ({ ...current, priority: event.target.value }))}
                        />
                      </label>
                      <label className="adminCheckbox">
                        <input
                          checked={specificPriceForm.taxIncluded}
                          type="checkbox"
                          onChange={(event) => setSpecificPriceForm((current) => ({ ...current, taxIncluded: event.target.checked }))}
                        />
                        Precio con impuestos
                      </label>
                      <label className="adminCheckbox">
                        <input
                          checked={specificPriceForm.active}
                          type="checkbox"
                          onChange={(event) => setSpecificPriceForm((current) => ({ ...current, active: event.target.checked }))}
                        />
                        Activo
                      </label>
                    </div>
                  </details>
                  {specificPriceEditIndex !== null ? (
                    <p className="adminContextHint">Editando regla #{specificPriceEditIndex + 1} para {specificPriceTarget.label}.</p>
                  ) : null}
                  {specificPriceDateError ? <p className="adminBanner adminBannerError" role="alert">{specificPriceDateError}</p> : null}
                  <div className="adminButtonRow productSpecificPriceActions">
                    <button className="adminButton adminButtonPrimary" type="button" onClick={saveSpecificPriceForm}>
                      {specificPriceEditIndex === null ? "Guardar precio especifico" : "Actualizar precio especifico"}
                    </button>
                    <button className="adminButton" type="button" onClick={closeSpecificPriceDrawer}>
                      Cancelar
                    </button>
                  </div>
                </div>
        </AdminResourceDrawer>
      ) : null}

      {variantAttributePickerOpen && !attributeManagerOpen ? (
        <AdminResourceDrawer drawerId="product-variant-attribute" title={variantAttributePickerStep === "fields" ? "Asignar atributo" : variantAttributePickerField?.name ?? "Valores"} description="Selecciona un atributo y uno de sus valores para la variante actual." onClose={closeVariantAttributePicker}>
          <div className="adminFeatureDrawerBody">
            {attributeLoadError ? <p role="alert" className="adminBanner adminBannerError">{attributeLoadError}</p> : null}
            {variantAttributePickerStep === "fields" ? (
              <>
                {canManageFeatures ? <button className="adminButton" type="button" onClick={manageVariantAttributes}>Administrar atributos</button> : null}
                {variantAttributeFields.length ? (
                  <table className="productBasicFeaturesGrid" aria-label="Atributos disponibles para asignar">
                    <tbody>{variantAttributeFields.filter((field) => field.categoryIds?.includes(draft.basic.categoryId ?? "")).map((field) => {
                      const selectedValue = selectedVariantValueForAttribute(field);
                      return <tr key={field.fieldId}><th scope="row">{field.name}</th><td><button className="productVariantAttributeValueLink" type="button" onClick={() => openVariantAttributeValues(field)}>{selectedValue?.name ?? "Elegir valor"}</button></td></tr>;
                    })}</tbody>
                  </table>
                ) : null}
                {!variantAttributeFields.some((field) => field.categoryIds?.includes(draft.basic.categoryId ?? "")) ? <p>No hay atributos disponibles para esta categoría.</p> : null}
              </>
            ) : (
              <>
                <button className="adminButton" type="button" onClick={goBackToVariantAttributeFields}>Atrás</button>
                {variantAttributePickerField ? <>
                  <div className="productVariantAttributeValueList">
                    {variantAttributePickerField.values.map((value) => <button className="productVariantAttributeValueChoice" type="button" aria-pressed={selectedVariantValueForAttribute(variantAttributePickerField)?.fieldValueId === value.fieldValueId} key={value.fieldValueId} onClick={() => { updateVariantAttributeSelection(variantAttributePickerField, value.fieldValueId); closeVariantAttributePicker(); }}>{value.name}</button>)}
                  </div>
                  {canManageFeatures ? <AdminMutationForm key={variantAttributePickerField.fieldId} label={`Añadir opción a ${variantAttributePickerField.name}`} action={async (_state, form) => {
                    const result = await addProductFeatureValueAction(form);
                    if (result.catalog) mergeAttributeCatalog(result.catalog);
                    return result.state;
                  }}>
                    <input type="hidden" name="tab" value="attributes" />
                    <input type="hidden" name="groupId" value={variantAttributePickerField.groupId} />
                    <input type="hidden" name="fieldId" value={variantAttributePickerField.fieldId} />
                    <label className="adminField"><span>Nueva opción para {variantAttributePickerField.name}</span><input name="value" required maxLength={200} /></label>
                    <button className="adminButton" type="submit">Añadir opción</button>
                  </AdminMutationForm> : null}
                </> : <p>Atributo no disponible. Vuelve atrás.</p>}
              </>
            )}
          </div>
        </AdminResourceDrawer>
      ) : null}
      {attributeManagerOpen && canManageFeatures ? <ProductFeatureManager mode="attributes" categoryId={draft.basic.categoryId ?? ""} categories={categoryOptions} fields={variantAttributeFields} groups={attributeGroups} onChange={mergeAttributeCatalog} onClose={() => setAttributeManagerOpen(false)} /> : null}

      {offeringPickerOpen ? (
        <div
          className="productOfferingOverlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && offeringPickerStep === "list") {
              closeOfferingPicker();
            }
          }}
        >
          <AdminResizableDrawer drawerId="product-editor-client-product-offering-picker-title-1"
            aria-labelledby="product-offering-picker-title"
            aria-modal="true"
            className="productOfferingDrawer"
            role="dialog"
          >
            <header className="productOfferingDrawerHeader">
              <div>
                <span className="adminBadge">
                  {offeringsForTarget.length} asociado{offeringsForTarget.length === 1 ? "" : "s"}
                </span>
                <h2 id="product-offering-picker-title">
                  {offeringPickerStep === "list"
                    ? offeringsForTarget.length > 0 ? "Agregar otro servicio" : "Servicios adicionales"
                    : offeringPickerOffering ? offeringName(offeringPickerOffering, locale) : "Servicio"}
                </h2>
              </div>
              {offeringPickerStep === "list" ? (
                <button className="adminButton" type="button" onClick={closeOfferingPicker}>
                  Cerrar
                </button>
              ) : (
                <button className="adminButton" type="button" onClick={goBackToOfferingList}>
                  Atras
                </button>
              )}
            </header>

            <div className="productOfferingDrawerBody">
              {offeringMessage ? (
                <div className={`adminBanner adminBanner${offeringMessage.tone[0].toUpperCase()}${offeringMessage.tone.slice(1)}`} aria-live="polite">
                  <p>{offeringMessage.text}</p>
                </div>
              ) : null}

              {offeringPickerStep === "list" ? (
                <>
                  {offeringsForTarget.length > 0 ? (
                    <section className="productOfferingDrawerSection">
                      <h3>Asociados</h3>
                      <div className="productOfferingSelectedList">
                        {offeringsForTarget.map((offering) => (
                          <div className="productOfferingSelectedItem" key={offering.offeringId}>
                            <span>
                              <small>{offering.type}</small>
                              <strong>{offeringName(offering, locale)}</strong>
                            </span>
                            <span>{formatMoney(offering.priceMinor, offering.currency || currency)}</span>
                            <span className={offering.active ? "adminBadge adminBadgeOk" : "adminBadge adminBadgeWarn"}>
                              {offering.active ? "Activo" : "Inactivo"}
                            </span>
                            <div className="adminButtonRow">
                              <button
                                className="adminButton adminButtonTiny"
                                disabled={isPending}
                                type="button"
                                onClick={() => setOfferingActivation(offering.offeringId, !offering.active)}
                              >
                                {offering.active ? "Desactivar" : "Activar"}
                              </button>
                              <button
                                className="adminButton adminButtonTiny"
                                disabled={isPending}
                                type="button"
                                onClick={() => detachOffering(offering.offeringId)}
                              >
                                Quitar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  <section className="productOfferingDrawerSection">
                    <div className="productOfferingDrawerSectionHeader">
                      <h3>Todos los servicios</h3>
                      <Link className="adminButton adminButtonTiny" href="/admin/catalogo/offerings">
                        Gestionar servicios
                      </Link>
                    </div>
                    {!offeringTargetVariant?.variantId ? (
                      <div className="adminBanner adminBannerInfo">
                        <p>Guarda primero esta variante para asociar servicios adicionales.</p>
                      </div>
                    ) : null}
                    {lookups.offerings.length === 0 ? (
                      <div className="adminEmptyState">
                        <h2>Sin servicios configurados</h2>
                        <p>Crea primero servicios en Catalogo / Offerings.</p>
                      </div>
                    ) : (
                      <div className="productOfferingChoiceList">
                        {lookups.offerings.map((offering) => {
                          const associated = offeringsForTarget.some((item) => item.offeringId === offering.offeringId);
                          return (
                            <button
                              className="productOfferingChoice"
                              disabled={!offeringTargetVariant?.variantId}
                              key={offering.offeringId}
                              type="button"
                              onClick={() => openOfferingDetails(offering)}
                            >
                              <span>
                                <small>{offering.type}</small>
                                <strong>{offeringName(offering, locale)}</strong>
                              </span>
                              <span>{formatMoney(offering.priceMinor, offering.currency || currency)}</span>
                              <span className={associated ? "adminBadge adminBadgeOk" : "adminBadge"}>
                                {associated ? "Asociado" : "Elegir"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </>
              ) : (
                <section className="productOfferingDrawerSection">
                  {offeringPickerOffering ? (
                    <>
                      <dl className="productOfferingDetailList">
                        <div><dt>Servicio</dt><dd>{offeringName(offeringPickerOffering, locale)}</dd></div>
                        <div><dt>Tipo</dt><dd>{offeringPickerOffering.type}</dd></div>
                        <div><dt>Precio</dt><dd>{formatMoney(offeringPickerOffering.priceMinor, offeringPickerOffering.currency || currency)}</dd></div>
                        <div><dt>Estado</dt><dd>{offeringPickerOffering.active ? "Activo" : "Inactivo"}</dd></div>
                      </dl>
                      <button
                        className="adminButton"
                        disabled={
                          isPending ||
                          !offeringTargetVariant?.variantId ||
                          offeringsForTarget.some((item) => item.offeringId === offeringPickerOffering.offeringId)
                        }
                        type="button"
                        onClick={() => assignExistingOfferingToSelectedVariant(offeringPickerOffering.offeringId)}
                      >
                        {offeringsForTarget.some((item) => item.offeringId === offeringPickerOffering.offeringId)
                          ? "Ya asociado"
                          : "Agregar servicio"}
                      </button>
                    </>
                  ) : (
                    <div className="adminEmptyState">
                      <h2>Servicio no disponible</h2>
                      <p>Vuelve atras y elige otro servicio.</p>
                    </div>
                  )}
                </section>
              )}
            </div>
          </AdminResizableDrawer>
        </div>
      ) : null}

      {featureManagerOpen && canManageFeatures ? <ProductFeatureManager categoryId={draft.basic.categoryId ?? ""} categories={categoryOptions} fields={featureFields} groups={featureGroups} onChange={mergeFeatureCatalog} onClose={() => setFeatureManagerOpen(false)} /> : null}
      {specificationPickerOpen ? (
        <div
          className="productSpecificationOverlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && specificationPickerStep === "fields") {
              closeSpecificationPicker();
            }
          }}
        >
          <AdminResizableDrawer drawerId="product-editor-client-product-specification-picker-title-2"
            aria-labelledby="product-specification-picker-title"
            aria-modal="true"
            className={`productSpecificationDrawer ${specificationPickerStep === "values" ? "productSpecificationValueDrawer" : ""}`}
            role="dialog"
          >
            <header className="productSpecificationDrawerHeader">
              <div>
                <h2 id="product-specification-picker-title">
                  {specificationPickerStep === "fields"
                    ? selectedSpecifications.length > 0 ? "Agregar otra caracteristica" : "Caracteristicas"
                    : specificationPickerField?.name ?? "Valores"}
                </h2>
              </div>
              {specificationPickerStep === "fields" ? (
                <button className="adminButton" type="button" onClick={closeSpecificationPicker}>
                  Cerrar
                </button>
              ) : (
                <button className="adminButton" type="button" onClick={goBackToSpecificationFields}>
                  Atras
                </button>
              )}
            </header>

            <div className="productSpecificationDrawerBody">
              {specificationPickerStep === "fields" ? (
                <>
                  {selectedSpecifications.length > 0 ? (
                    <div className="productFeatureSelectedTables">
                      {Array.from(new Set(selectedSpecifications.map(({ field }) => field.groupId))).map((groupId) => {
                        const items = selectedSpecifications.filter(({ field }) => field.groupId === groupId);
                        return (
                          <table className="productFeaturePickerTable" key={groupId} aria-label={`Características añadidas: ${items[0].field.groupName}`}>
                            <colgroup><col className="productFeatureNameColumn" /><col /><col className="productFeatureActionColumn" /></colgroup>
                            <thead><tr><th colSpan={3}>{items[0].field.groupName}</th></tr></thead>
                            <tbody>
                              {items.map(({ field, value }) => (
                                <tr key={field.fieldId}>
                                  <th scope="row">{field.name}</th>
                                  <td>{value.name}</td>
                                  <td className="productFeatureActionCell"><button className="productFeatureTableAction productFeatureTableDelete" type="button" aria-label={`Quitar ${field.name}`} title={`Quitar ${field.name}`} onClick={() => removeSpecificationSelection(field.fieldId)}><Trash2 size={15} aria-hidden="true" /></button></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        );
                      })}
                    </div>
                  ) : null}

                  <section className="productSpecificationDrawerSection">
                    <div className="productSpecificationDrawerSectionHeader">
                      <h3>Buscar características</h3>
                      {canManageFeatures ? <button className="adminButton adminButtonTiny" type="button" onClick={() => { closeSpecificationPicker(); setFeatureManagerOpen(true); }}>Administrar características</button> : null}
                    </div>
                    <label className="adminField"><span>Buscar por nombre o grupo</span><input value={featureSearch} onChange={event => setFeatureSearch(event.target.value)} placeholder="Material, geometría…" /></label>
                    {featureFields.length === 0 ? (
                      <div className="adminEmptyState">
                        <h2>Sin caracteristicas configuradas</h2>
                        <p>Crea primero caracteristicas en Catalogo / Caracteristicas.</p>
                      </div>
                    ) : (
                      <div className="productFeatureSearchResults">
                        {Array.from(new Set(featureFields.map((field) => field.groupId))).map((groupId) => {
                          const fields = featureFields.filter((field) => field.groupId === groupId && `${field.name} ${field.groupName} ${(field.categoryIds ?? []).map((id) => categoryOptions.find((category) => category.id === id)?.label ?? "").join(" ")}`.toLocaleLowerCase().includes(featureSearch.trim().toLocaleLowerCase()));
                          if (!fields.length) return null;
                          return (
                            <table className="productFeaturePickerTable" key={groupId} aria-label={fields[0].groupName}>
                              <colgroup><col className="productFeatureNameColumn" /><col /><col className="productFeatureActionColumn" /></colgroup>
                              <thead><tr><th colSpan={3}>{fields[0].groupName}</th></tr></thead>
                              <tbody>
                                {fields.map((field) => {
                                  const selected = selectedSpecifications.find((item) => item.field.fieldId === field.fieldId);
                                  return <tr key={field.fieldId}>
                                    <th scope="row">{field.name}</th>
                                    <td>{selected?.value.name ?? "—"}</td>
                                    <td className="productFeatureActionCell"><button className="productFeatureTableAction" type="button" aria-label={`Elegir valor para ${field.name}`} title={`Elegir valor para ${field.name}`} onClick={() => openSpecificationValues(field)}><Plus size={16} aria-hidden="true" /></button></td>
                                  </tr>;
                                })}
                              </tbody>
                            </table>
                          );
                        })}
                        {!featureFields.some((field) => `${field.name} ${field.groupName} ${(field.categoryIds ?? []).map((id) => categoryOptions.find((category) => category.id === id)?.label ?? "").join(" ")}`.toLocaleLowerCase().includes(featureSearch.trim().toLocaleLowerCase())) ? <p className="adminContextHint">Sin resultados para esta búsqueda.</p> : null}
                      </div>
                    )}
                  </section>
                </>
              ) : (
                <section className="productSpecificationDrawerSection">
                  <p className="adminContextHint">
                    Selecciona un valor para {specificationPickerField?.name ?? "esta caracteristica"}.
                  </p>
                  {specificationPickerField ? (
                    <div className="productSpecificationValueList">
                      {specificationPickerField.values.map((value) => {
                        const selected = draft.specifications.selections.some(
                          (selection) =>
                            !selection.markedForDeletion && selection.fieldId === specificationPickerField.fieldId &&
                            selection.fieldValueId === value.fieldValueId,
                        );
                        return (
                          <button
                            aria-pressed={selected}
                            className={"productSpecificationValueChoice " + (selected ? "productSpecificationValueChoiceActive" : "")}
                            key={value.fieldValueId}
                            type="button"
                            onClick={() => {
                              updateSpecificationSelection(specificationPickerField.fieldId, value.fieldValueId);
                              goBackToSpecificationFields();
                            }}
                          >
                            {value.name}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="adminEmptyState">
                      <h2>Caracteristica no disponible</h2>
                      <p>Vuelve atras y elige otra caracteristica.</p>
                    </div>
                  )}
                </section>
              )}
            </div>
          </AdminResizableDrawer>
        </div>
      ) : null}

      {previewOpen ? <ProductPdpPreviewModal initialVariantId={selectedVariant.localId} data={pdpPreviewData()} onClose={() => setPreviewOpen(false)} /> : null}

      {saveDecisionOpen ? <ProductSaveDecision preservingActive={persistedPublication.isActive} missing={publicationChecklist.filter(item => !item.ok)} onClose={() => setSaveDecisionOpen(false)} onSave={saveDraft} /> : null}

      {savingActive ? (
        <div className="productSavingOverlay" role="status" aria-live="assertive">
          <div className="productSavingDialog">
            <span className="adminSpinner productSavingRing" aria-hidden="true" />
            <strong>Guardando producto</strong>
            <span>Espera un momento.</span>
          </div>
        </div>
      ) : null}

      <footer className="productEditorFooter" role="group" aria-label="Acciones del producto">
        <div className="productEditorSaveStatus" role="status" aria-live="polite">
          <span className={`adminBadge ${persistedPublication.isActive ? "adminBadgeOk" : "adminBadgeWarn"}`}>{productStatus}</span>
          <span>{savingActive ? "Guardando…" : report && !report.ok ? "No se pudo completar el guardado" : dirty ? "Cambios sin guardar" : report?.ok ? "Guardado" : "Sin cambios"}</span>
        </div>
        <div className="productEditorFooterActions">
          <button className="adminButton" type="button" onClick={openProductPreview} disabled={savingActive}>
            <Eye aria-hidden="true" size={16} />Vista previa
          </button>
          <button className="adminButton adminButtonPrimary" type="button" disabled={savingActive} onClick={() => saveDraft()}>
            <span className="adminSpinner adminSpinnerInline" aria-hidden="true" style={{ display: savingActive ? undefined : "none" }} />
            <span>{savingActive ? "Guardando…" : persistedPublication.isActive ? "Guardar cambios" : "Guardar"}</span>
          </button>
          {draft.productId && canDeleteProducts && deletionContext ? (
            <CatalogDeletionButton
              target={{ ...deletionContext, productId: draft.productId }}
              name={draft.basic.name}
              disabled={dirty || savingActive}
              disabledReason={dirty ? "Guarda los cambios antes de eliminar." : undefined}
              onComplete={() => { window.localStorage.removeItem(storageKey); router.replace("/admin/products"); router.refresh(); }}
            />
          ) : null}
          <ProductEditorActions productId={draft.productId} disabled={savingActive} />
        </div>
      </footer>
    </main>
  );
}

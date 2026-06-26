"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Eye, Italic, List, ListOrdered, Plus, Redo2, RemoveFormatting, Strikethrough, Trash2, Undo2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ChangeEvent, InputHTMLAttributes } from "react";
import {
  createAndAttachOfferingAction,
  createProductBrandInlineAction,
  createProductCategoryInlineAction,
  detachOfferingFromVariantAction,
  previewAppliedProductPriceAction,
  readProductDraftMediaStateAction,
  saveProductDraftAction,
  setOfferingVariantActivationAction,
  uploadProductDraftMediaAction,
} from "./product-actions";
import {
  ensureSingleMainImage,
  makeProductMediaItem,
  makeRefIdFromName,
  mergeStoredProductDraft,
  sanitizeDraftForStorage,
  slugifyProductValue,
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
  ProductSaveReport,
  ProductTaxLookupOption,
  SaveBlockStatus,
  SpecificPriceDraft,
  StockDraft,
} from "./product-editor-types";
import {
  getProductPublicationChecklist,
  validateProductDraft,
  validateProductPublicationReadiness,
} from "./product-editor-validation";

type ProductEditorClientProps = {
  contextIdentity: string;
  initialDraft: ProductDraft;
  initialVariantRows?: ProductEditorVariantRow[];
  locale: string;
  currency: string;
  lookups?: ProductEditorLookups;
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
  unlimited: boolean;
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

type TabId =
  | "basic"
  | "images"
  | "variants"
  | "pricing"
  | "offerings"
  | "inventory"
  | "shipping"
  | "seo"
  | "options";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "basic", label: "Ajustes basicos" },
  { id: "images", label: "Imagenes" },
  { id: "variants", label: "Variantes" },
  { id: "pricing", label: "Precio" },
  { id: "offerings", label: "Offering" },
  { id: "inventory", label: "Inventario" },
  { id: "shipping", label: "Transporte" },
  { id: "seo", label: "SEO" },
  { id: "options", label: "Opciones" },
];

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

function formatMoney(value: number | undefined, currency: string) {
  if (!value) {
    return "0.00";
  }

  return `${(value / 100).toFixed(2)} ${currency}`;
}

function pricePreview(price: ProductDraft["pricing"]["productPrice"], tax: ProductTaxLookupOption | null | undefined) {
  const base = price?.basePriceMinor ?? 0;
  const rate = tax?.calculationType === "PERCENTAGE" ? tax.rate : undefined;
  if (!rate || base <= 0) {
    return null;
  }

  if (price?.taxIncluded ?? true) {
    const net = Math.round(base / (1 + rate));
    return { net, tax: base - net, gross: base };
  }

  const taxAmount = Math.round(base * rate);
  return { net: base, tax: taxAmount, gross: base + taxAmount };
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

function dateTimeLocalToIso(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isoToDateTimeLocal(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 16);
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
    availableQuantity: available,
    available: available > 0,
    reasons: available > 0 ? [] : ["OUT_OF_STOCK"],
  };
}

export function localStorageKey(
  draft: ProductDraft,
  locale: string,
  currency: string,
  contextIdentity: string,
) {
  const mode = draft.productId ? "edit" : "new";
  return `ecommium-product-draft:v4:${contextIdentity}:${mode}:${draft.productId ?? "new"}:${locale}:${currency}`;
}

function statusLabel(status: SaveBlockStatus) {
  const labels: Record<SaveBlockStatus, string> = {
    pending: "Pendiente",
    running: "Guardando",
    success: "Correcto",
    failed: "Fallo",
    skipped: "Sin cambios",
    blocked: "Bloqueado",
  };

  return labels[status];
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
    unlimited: true,
    country: productPrice?.country ?? "",
    customerGroup: productPrice?.customerGroup ?? "",
    channel: productPrice?.channel ?? "web",
    tradePolicy: productPrice?.tradePolicy ?? "default",
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
    country: productPrice?.country ?? "ES",
    channel: productPrice?.channel ?? "web",
    tradePolicy: productPrice?.tradePolicy ?? "default",
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
    unlimited: price.unlimited ?? !price.validUntil,
    country: price.country ?? "",
    customerGroup: price.customerGroup ?? "",
    channel: price.channel ?? productPrice?.channel ?? "web",
    tradePolicy: price.tradePolicy ?? productPrice?.tradePolicy ?? "default",
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
    return "Variantes / Opciones";
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

function statusClass(status: SaveBlockStatus) {
  if (status === "success") {
    return "adminBadgeOk";
  }
  if (status === "failed") {
    return "adminBadgeError";
  }
  if (status === "running" || status === "pending" || status === "blocked") {
    return "adminBadgeWarn";
  }

  return "";
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
      isMain: localItem.isMain || remoteItem.isMain,
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

function combinationRows(colorValues: string, sizeValues: string, productName: string): ProductDraftVariant[] {
  const colors = colorValues.split(",").map((value) => value.trim()).filter(Boolean);
  const sizes = sizeValues.split(",").map((value) => value.trim()).filter(Boolean);
  const colorList = colors.length ? colors : [""];
  const sizeList = sizes.length ? sizes : [""];

  return colorList.flatMap((color) =>
    sizeList.map((size) => {
      const parts = [color, size].filter(Boolean);
      const name = parts.length ? `${productName} / ${parts.join(" / ")}` : productName;
      const refBase = makeRefIdFromName(parts.length ? `${productName} ${parts.join(" ")}` : productName);

      return {
        localId: `variant-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name,
        refId: refBase,
        ean: null,
        options: [
          ...(color ? [{ attributeCode: "color", valueCode: slugifyProductValue(color) }] : []),
          ...(size ? [{ attributeCode: "size", valueCode: slugifyProductValue(size) }] : []),
        ],
        isActive: true,
        isVisible: true,
      };
    }),
  );
}

function optionLabel(variant: ProductDraftVariant) {
  return variant.options.length
    ? variant.options.map((option) => `${option.attributeCode}: ${option.valueCode}`).join(", ")
    : "Sin opciones";
}

function offeringName(
  offering: { name: string; localizedName: Array<{ locale: string; value: string }> },
  locale: string,
) {
  return offering.localizedName.find((item) => item.locale === locale)?.value ??
    offering.localizedName[0]?.value ??
    offering.name;
}

const allowedRichTextTags = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "em",
  "h2",
  "h3",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "strong",
  "strike",
  "ul",
]);

function isSafeRichTextHref(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith("/") ||
    normalized.startsWith("#") ||
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("mailto:") ||
    normalized.startsWith("tel:")
  );
}

function sanitizeRichTextHtml(html: string) {
  if (!html.trim() || typeof document === "undefined") {
    return "";
  }

  const template = document.createElement("template");
  template.innerHTML = html;

  function cleanNode(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent ?? "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();
    const cleanChildren = Array.from(element.childNodes)
      .map(cleanNode)
      .filter((child): child is Node => Boolean(child));

    if (!allowedRichTextTags.has(tagName)) {
      const fragment = document.createDocumentFragment();
      cleanChildren.forEach((child) => fragment.appendChild(child));
      return fragment;
    }

    const cleanElement = document.createElement(tagName);
    if (tagName === "a") {
      const href = element.getAttribute("href");
      if (href && isSafeRichTextHref(href)) {
        cleanElement.setAttribute("href", href.trim());
        cleanElement.setAttribute("rel", "noopener noreferrer");
      }
      const title = element.getAttribute("title");
      if (title) {
        cleanElement.setAttribute("title", title);
      }
    }

    cleanChildren.forEach((child) => cleanElement.appendChild(child));
    return cleanElement;
  }

  const wrapper = document.createElement("div");
  Array.from(template.content.childNodes).forEach((node) => {
    const cleanNodeResult = cleanNode(node);
    if (cleanNodeResult) {
      wrapper.appendChild(cleanNodeResult);
    }
  });

  return wrapper.innerHTML;
}

type RichTextPreviewProps = {
  className?: string;
  emptyLabel: string;
  html: string;
};

function RichTextPreview({ className = "", emptyLabel, html }: RichTextPreviewProps) {
  const sanitizedHtml = useMemo(() => sanitizeRichTextHtml(html), [html]);

  if (!html.trim() || !sanitizedHtml) {
    return <p className="productPreviewEmpty">{emptyLabel}</p>;
  }

  return (
    <div
      className={`productPreviewRichText ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}

type RichTextEditorProps = {
  label: string;
  minHeight?: number;
  value: string;
  onChange(value: string): void;
};

function RichTextEditor({ label, minHeight = 180, value, onChange }: RichTextEditorProps) {
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
        <textarea
          aria-label={`${label} HTML`}
          className="richTextSource"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}

type EntitySelectorProps = {
  label: string;
  placeholder: string;
  selectedId?: string;
  options: ProductLookupOption[];
  fieldError?: string;
  onSelect(option: ProductLookupOption): void;
  createAction(name: string): Promise<{ ok: boolean; options: ProductLookupOption[]; option?: ProductLookupOption; message?: string }>;
};

function ProductEntitySelector({
  label,
  placeholder,
  selectedId,
  options,
  fieldError,
  onSelect,
  createAction,
}: EntitySelectorProps) {
  const [newName, setNewName] = useState("");
  const [localOptions, setLocalOptions] = useState(options);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runCreate() {
    const name = newName.trim();
    if (!name) {
      return;
    }

    startTransition(async () => {
      const result = await createAction(name);
      setLocalOptions(result.options.length ? result.options : localOptions);
      if (result.ok && result.option) {
        onSelect(result.option);
        setNewName("");
        setMessage(null);
        return;
      }

      setMessage(result.message ?? "No se pudo crear la entidad en BFF.");
    });
  }

  return (
    <div className="adminField productEntitySelector">
      <span>{label}</span>
      <div className="productEntitySelectorRow">
        <select
          aria-label={label}
          value={selectedId ?? ""}
          onChange={(event) => {
            const option = localOptions.find((item) => item.id === event.target.value);
            if (option) {
              onSelect(option);
            }
          }}
        >
          <option value="">Selecciona</option>
          {localOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          aria-label={`Nueva ${label.toLowerCase()}`}
          autoComplete="off"
          placeholder={placeholder}
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              runCreate();
            }
          }}
        />
        <button className="adminButton" disabled={isPending || !newName.trim()} type="button" onClick={runCreate}>
          Crear nueva
        </button>
      </div>
      {localOptions.length === 0 ? <small>No hay opciones precargadas desde BFF.</small> : null}
      {fieldError ? <small>{fieldError}</small> : null}
      {message ? <small>{message}</small> : null}
    </div>
  );
}

export function ProductEditorClient({
  contextIdentity,
  initialDraft,
  initialVariantRows = [],
  locale,
  currency,
  lookups = defaultProductEditorLookups,
}: ProductEditorClientProps) {
  const storageKey = useMemo(
    () => localStorageKey(initialDraft, locale, currency, contextIdentity),
    [contextIdentity, currency, initialDraft, locale],
  );
  const editorInstanceKey = `${contextIdentity}:${initialDraft.productId ?? "new"}:${locale}:${currency}`;

  return (
	    <ProductEditorClientInner
	      key={editorInstanceKey}
	      initialDraft={initialDraft}
	      initialVariantRows={initialVariantRows}
	      locale={locale}
      currency={currency}
      lookups={lookups}
      storageKey={storageKey}
    />
  );
}

function ProductEditorClientInner({
  initialDraft,
  initialVariantRows = [],
  locale,
  currency,
  lookups = defaultProductEditorLookups,
  storageKey,
}: ProductEditorClientInnerProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<ProductDraft>(initialDraft);
  const [storedDraft, setStoredDraft] = useState<ProductDraft | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("basic");
  const [dirty, setDirty] = useState(false);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(draft.media.items[0]?.localId ?? null);
  const [selectedVariantKey, setSelectedVariantKey] = useState<string>("default");
  const [specificPriceForm, setSpecificPriceForm] = useState<SpecificPriceFormState>(() =>
    defaultSpecificPriceForm(initialDraft.pricing.productPrice, "__product__"),
  );
  const [specificPriceEditIndex, setSpecificPriceEditIndex] = useState<number | null>(null);
  const [pricingPreviewForm, setPricingPreviewForm] = useState<PricingPreviewFormState>(() =>
    defaultPricingPreviewForm(initialDraft.pricing.productPrice, "__product__"),
  );
  const [pricingPreviewResult, setPricingPreviewResult] = useState<ProductAppliedPricePreview | null>(null);
  const [pricingPreviewBusy, setPricingPreviewBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewVariantKey, setPreviewVariantKey] = useState<string>("default");
  const [filesByLocalId, setFilesByLocalId] = useState<Record<string, File>>({});
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const [mediaPickerBusy, setMediaPickerBusy] = useState(false);
  const [mediaPickerMessage, setMediaPickerMessage] = useState<string | null>(null);
  const [variantColors, setVariantColors] = useState("");
  const [variantSizes, setVariantSizes] = useState("");
  const [pendingGeneratedVariants, setPendingGeneratedVariants] = useState<ProductDraftVariant[] | null>(null);
  const [variantMessage, setVariantMessage] = useState<string | null>(null);
  const [brokenMediaPreviewIds, setBrokenMediaPreviewIds] = useState<Record<string, true>>({});
  const [offeringForm, setOfferingForm] = useState({
    variantKey: "default",
    name: "",
    type: "service",
    price: "",
    active: true,
  });
  const [offeringMessage, setOfferingMessage] = useState<string | null>(null);
  const [report, setReport] = useState<ProductSaveReport | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const saveOperationKeyRef = useRef<string | null>(null);
  const hydratedRemoteDraftIdsRef = useRef<Set<string>>(new Set());
  const savingActive = isSaving || isPending;
  const selectedMedia = draft.media.items.find((item) => item.localId === selectedMediaId) ?? draft.media.items[0];
  const productStatus = draft.basic.isActive ? "Activo" : "Fuera de linea";
  const variantRowsById = useMemo(
    () => new Map(initialVariantRows.map((row) => [row.variantId, row])),
    [initialVariantRows],
  );
  const allVariantRows = useMemo<ProductVariantRowView[]>(() => {
    const hasDirectMediaForKey = (variantKey: string) => (draft.media.assignments[variantKey] ?? []).length > 0;
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
        effectiveMediaSource: productPresentation?.effectiveMediaSource ?? (productDirectMedia ? "DIRECT" : "NONE"),
      },
      ...draft.variants.map((variant, index) => {
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
          effectiveMediaSource: presentation?.effectiveMediaSource ?? (directMedia ? "DIRECT" : inheritsFromProduct ? "DEFAULT_VARIANT" : "NONE"),
        };
      }),
    ];
  }, [draft, variantRowsById]);
  const selectedVariant =
    allVariantRows.find((variant) => variant.localId === selectedVariantKey || variant.variantId === selectedVariantKey) ??
    allVariantRows[0];
  const offeringTargetVariant =
    allVariantRows.find((variant) => variant.localId === offeringForm.variantKey || variant.variantId === offeringForm.variantKey) ??
    allVariantRows[0];
  const offeringTargetKey = offeringTargetVariant?.localId ?? "default";
  const offeringsForTarget = draft.offerings.byVariant[offeringTargetKey] ?? [];
  const productPrice = draft.pricing.productPrice;
  const selectedTax =
    productPrice?.tax ??
    lookups.taxes.find((tax) => tax.id === productPrice?.taxCode || tax.taxCode === productPrice?.taxCode);
  const taxOptions = selectedTax && !lookups.taxes.some((tax) => tax.id === selectedTax.id)
    ? [selectedTax, ...lookups.taxes]
    : lookups.taxes;
  const selectedPriceTable = productPrice?.priceTableId
    ? lookups.priceTables.find((table) => table.id === productPrice.priceTableId) ?? {
        id: productPrice.priceTableId,
        label: productPrice.priceTableId,
      }
    : null;
  const priceTableOptions = selectedPriceTable && !lookups.priceTables.some((table) => table.id === selectedPriceTable.id)
    ? [selectedPriceTable, ...lookups.priceTables]
    : lookups.priceTables;
  const productChannelOptions = lookupOptionsWithCurrent(lookups.channels, productPrice?.channel ?? "web");
  const productTradePolicyOptions = lookupOptionsWithCurrent(lookups.tradePolicies, productPrice?.tradePolicy ?? "default");
  const productCountryOptions = lookupOptionsWithCurrent(lookups.countries, productPrice?.country ?? "ES");
  const productCustomerGroupOptions = lookupOptionsWithCurrent(lookups.customerGroups, productPrice?.customerGroup);
  const specificChannelOptions = lookupOptionsWithCurrent(lookups.channels, specificPriceForm.channel || productPrice?.channel || "web");
  const specificTradePolicyOptions = lookupOptionsWithCurrent(lookups.tradePolicies, specificPriceForm.tradePolicy || productPrice?.tradePolicy || "default");
  const specificCountryOptions = lookupOptionsWithCurrent(lookups.countries, specificPriceForm.country);
  const specificCustomerGroupOptions = lookupOptionsWithCurrent(lookups.customerGroups, specificPriceForm.customerGroup);
  const previewChannelOptions = lookupOptionsWithCurrent(lookups.channels, pricingPreviewForm.channel || productPrice?.channel || "web");
  const previewTradePolicyOptions = lookupOptionsWithCurrent(lookups.tradePolicies, pricingPreviewForm.tradePolicy || productPrice?.tradePolicy || "default");
  const previewCountryOptions = lookupOptionsWithCurrent(lookups.countries, pricingPreviewForm.country || productPrice?.country || "ES");
  const previewCustomerGroupOptions = lookupOptionsWithCurrent(lookups.customerGroups, pricingPreviewForm.customerGroup);
  const pricingTaxWarning = lookups.warnings.find((warning) => warning.startsWith("Pricing taxes:"));
  const pricingTablesWarning = lookups.warnings.find((warning) => warning.startsWith("Pricing price tables:"));
  const currentPricePreview = pricePreview(productPrice, selectedTax);
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
  const selectedPriceVariant =
    priceVariantRows.find((variant) => variant.localId === selectedVariantKey || variant.variantId === selectedVariantKey) ??
    priceVariantRows[0];
  const selectedVariantPrice = selectedPriceVariant
    ? draft.pricing.variantPrices[selectedPriceVariant.localId]
    : undefined;
  const selectedVariantUsesOwnPrice = Boolean(selectedVariantPrice && !selectedVariantPrice.markedForDeletion);
  const selectedVariantTax =
    selectedVariantPrice?.tax ??
    selectedTax ??
    lookups.taxes.find((tax) => tax.id === selectedVariantPrice?.taxCode || tax.taxCode === selectedVariantPrice?.taxCode);
  const variantTaxOptions = selectedVariantTax && !taxOptions.some((tax) => tax.id === selectedVariantTax.id)
    ? [selectedVariantTax, ...taxOptions]
    : taxOptions;
  const selectedVariantPriceTable = selectedVariantPrice?.priceTableId
    ? priceTableOptions.find((table) => table.id === selectedVariantPrice.priceTableId) ?? {
        id: selectedVariantPrice.priceTableId,
        label: selectedVariantPrice.priceTableId,
      }
    : null;
  const variantPriceTableOptions = selectedVariantPriceTable && !priceTableOptions.some((table) => table.id === selectedVariantPriceTable.id)
    ? [selectedVariantPriceTable, ...priceTableOptions]
    : priceTableOptions;
  const specificPriceTarget = specificPriceTargetOptions.find((target) => target.key === specificPriceForm.targetKey) ?? specificPriceTargetOptions[0];
  const pricingPreviewTarget =
    pricingPreviewForm.targetKey === "__product__"
      ? allVariantRows[0]
      : allVariantRows.find((variant) => variant.localId === pricingPreviewForm.targetKey || variant.variantId === pricingPreviewForm.targetKey);
  const selectedVariantAssignments = draft.media.assignments[selectedVariant.localId] ?? [];
  const selectedVariantMain = draft.media.mainByVariant[selectedVariant.localId];
  const previewVariant =
    allVariantRows.find((variant) => variant.localId === previewVariantKey || variant.variantId === previewVariantKey) ??
    selectedVariant;
  const previewVariantKeyResolved = previewVariant?.localId ?? "default";
  const previewMediaItems = previewVariant
    ? assignedMediaForVariant(previewVariantKeyResolved)
    : draft.media.items.filter((item) => item.isMain).slice(0, 1);
  const previewMainMediaId = previewVariant ? draft.media.mainByVariant[previewVariantKeyResolved] : undefined;
  const previewHeroMedia =
    previewMediaItems.find((item) => item.localId === previewMainMediaId) ??
    previewMediaItems.find((item) => item.isMain) ??
    previewMediaItems[0] ??
    draft.media.items.find((item) => item.isMain);
  const previewOwnPrice = !previewVariant?.isDefault
    ? draft.pricing.variantPrices[previewVariantKeyResolved]
    : undefined;
  const previewEffectivePrice = previewOwnPrice && !previewOwnPrice.markedForDeletion
    ? previewOwnPrice
    : productPrice;
  const previewTax =
    previewEffectivePrice?.tax ??
    selectedTax ??
    lookups.taxes.find((tax) => tax.id === previewEffectivePrice?.taxCode || tax.taxCode === previewEffectivePrice?.taxCode);
  const previewPriceBreakdown = pricePreview(previewEffectivePrice, previewTax);
  const previewStock =
    draft.inventory.stockByVariant[previewVariantKeyResolved] ??
    (previewVariant?.isDefault ? draft.inventory.stockByVariant.default : undefined);
  const previewAvailableQuantity = previewStock?.availableQuantity ?? availableQuantity(previewStock);
  const previewIsAvailable = previewStock?.available ?? previewAvailableQuantity > 0;
  const previewOfferings = draft.offerings.byVariant[previewVariantKeyResolved] ?? [];
  const previewOptions = previewVariant?.options.filter((option) => !option.markedForDeletion) ?? [];
  const activePreviewVariants = allVariantRows.filter((variant) => variant.isActive && variant.isVisible);
  const previewVariantChoiceBase = activePreviewVariants.length ? activePreviewVariants : allVariantRows;
  const previewVariantChoices = previewVariantChoiceBase.some((variant) => variant.localId === previewVariantKeyResolved)
    ? previewVariantChoiceBase
    : [previewVariant, ...previewVariantChoiceBase];
  const publicationChecklist = useMemo(() => getProductPublicationChecklist(draft), [draft]);
  const publicationReady = publicationChecklist.every((item) => item.ok);
  const allowedCarrierOptions = draft.shipping.allowedCarrierIds
    .filter((carrierId) => !lookups.carriers.some((carrier) => carrier.id === carrierId))
    .map((carrierId) => ({ id: carrierId, label: carrierId }));
  const carrierOptions = [...lookups.carriers, ...allowedCarrierOptions];
  const shippingPackage = draft.shipping.package;
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
  }, [draft.clientDraftId]);

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
    if (!dirty) {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(sanitizeDraftForStorage(draft)));
  }, [dirty, draft, storageKey]);

  useEffect(() => {
    if (!previewOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewOpen]);

  function updateDraft(updater: (current: ProductDraft) => ProductDraft) {
    setDraft((current) => updater(current));
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
    setPreviewVariantKey(selectedVariant.localId);
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
    updateDraft((current) => {
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

  function addFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (!files.length) {
      return;
    }

    const hasMain = draft.media.items.some((item) => item.isMain);
    const newItems = files.map((file, index) => ({
      ...makeProductMediaItem({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        productName: draft.basic.name,
        locale,
        index: draft.media.items.length + index,
        previewUrl: URL.createObjectURL(file),
        isMain: !hasMain && index === 0,
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

      setDraft((current) => ({
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
                  isMain: result.mediaItem?.isMain ?? currentItem.isMain,
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
      }));
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
        items: current.media.items.map((item) => item.localId === localId ? updater(item) : item),
      },
    }));
  }

  function removeMedia(localId: string) {
    updateDraft((current) => {
      const removedItem = current.media.items.find((item) => item.localId === localId);
      const remaining = current.media.items.filter((item) => item.localId !== localId);
      const nextItems = remaining.some((item) => item.isMain) || remaining.length === 0
        ? remaining
        : remaining.map((item, index) => ({ ...item, isMain: index === 0 }));
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
    const assignedIds = draft.media.assignments[variantKey] ?? [];
    const assigned = assignedIds
      .map((localId) => draft.media.items.find((item) => item.localId === localId))
      .filter((item): item is ProductDraftMediaItem => Boolean(item));

    return assigned.length
      ? assigned
      : draft.media.items.filter((item) => item.isMain).slice(0, 1);
  }

  function hasDirectMediaForVariant(variantKey: string) {
    return (draft.media.assignments[variantKey] ?? []).length > 0;
  }

  function clearVariantMedia(variantKey: string) {
    updateDraft((current) => {
      const nextMainByVariant = { ...current.media.mainByVariant };
      delete nextMainByVariant[variantKey];

      return {
        ...current,
        media: {
          ...current.media,
          assignments: {
            ...current.media.assignments,
            [variantKey]: [],
          },
          mainByVariant: nextMainByVariant,
        },
      };
    });
  }

  function setVariantMainMedia(variantKey: string, mediaLocalId: string) {
    updateDraft((current) => ({
      ...current,
      media: {
        ...current.media,
        assignments: {
          ...current.media.assignments,
          [variantKey]: [mediaLocalId],
        },
        mainByVariant: {
          ...current.media.mainByVariant,
          [variantKey]: mediaLocalId,
        },
      },
    }));
  }

  function updateVariant(localId: string, updater: (variant: ProductDraftVariant) => ProductDraftVariant) {
    updateDraft((current) => ({
      ...current,
      variants: current.variants.map((variant) => variant.localId === localId ? updater(variant) : variant),
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
      variants: [
        ...current.variants,
        {
          localId,
          name,
          refId: makeRefIdFromName(name),
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

  function addSelectedVariantOption() {
    if (selectedVariant.isDefault) {
      return;
    }

    updateVariant(selectedVariant.localId, (variant) => ({
      ...variant,
      options: [
        ...variant.options,
        { attributeCode: "", valueCode: "", isActive: true, createdInDraft: true },
      ],
    }));
  }

  function updateSelectedVariantOption(index: number, field: "attributeCode" | "valueCode", value: string) {
    if (selectedVariant.isDefault) {
      return;
    }

    updateVariant(selectedVariant.localId, (variant) => ({
      ...variant,
      options: variant.options.map((option, optionIndex) =>
        optionIndex === index
          ? { ...option, [field]: slugifyProductValue(value) }
          : option,
      ),
    }));
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
    if (offeringForm.variantKey === variant.localId || offeringForm.variantKey === variant.variantId) {
      setOfferingForm((current) => ({ ...current, variantKey: "default" }));
    }
  }

  function changeVariantLifecycle(variant: ProductDraftVariant) {
    if (!variant.variantId) {
      removeVariantFromDraft(variant);
      setVariantMessage(`Variante ${variant.refId} quitada del borrador.`);
      return;
    }

    const nextActive = !variant.isActive;
    updateVariant(variant.localId, (item) => ({ ...item, isActive: nextActive }));
    setVariantMessage(
      nextActive
        ? `Variante ${variant.refId} marcada para reactivar. Guarda el producto para persistir el cambio.`
        : `Variante ${variant.refId} marcada para desactivar. Guarda el producto para persistir el cambio.`,
    );
  }

  function updateVariantPrice(variantKey: string, value: string) {
    updateVariantPriceField(variantKey, (price) => ({
      ...price,
      basePriceMinor: inputToCents(value),
    }));
  }

  function updateVariantPriceField(
    variantKey: string,
    updater: (current: NonNullable<ProductDraft["pricing"]["productPrice"]>) => NonNullable<ProductDraft["pricing"]["productPrice"]>,
  ) {
    updateDraft((current) => {
      const existing = current.pricing.variantPrices[variantKey];
      const inheritedPrice = {
            basePriceMinor: current.pricing.variantPrices[variantKey]?.basePriceMinor ?? 0,
            listPriceMinor: current.pricing.variantPrices[variantKey]?.listPriceMinor ?? null,
            costPriceMinor: current.pricing.variantPrices[variantKey]?.costPriceMinor ?? null,
            currency,
            taxIncluded: current.pricing.productPrice?.taxIncluded ?? true,
            taxCode: current.pricing.productPrice?.taxCode ?? current.basic.taxCode ?? "standard",
            tax: current.pricing.productPrice?.tax ?? null,
            priceTableId: current.pricing.productPrice?.priceTableId ?? null,
            tradePolicy: current.pricing.productPrice?.tradePolicy ?? "default",
            channel: current.pricing.productPrice?.channel ?? "web",
            customerGroup: current.pricing.productPrice?.customerGroup ?? null,
            country: current.pricing.productPrice?.country ?? "ES",
            markedForDeletion: false,
      };

      return {
        ...current,
        pricing: {
          ...current.pricing,
          variantPrices: {
            ...current.pricing.variantPrices,
            [variantKey]: updater({
              ...inheritedPrice,
              ...existing,
              markedForDeletion: false,
            }),
          },
        },
      };
    });
  }

  function updateProductPriceField(updater: (current: NonNullable<ProductDraft["pricing"]["productPrice"]>) => ProductDraft["pricing"]["productPrice"]) {
    updateDraft((current) => {
      const existing = current.pricing.productPrice ?? {
        basePriceMinor: 0,
        listPriceMinor: null,
        costPriceMinor: null,
        currency,
        taxIncluded: true,
        taxCode: current.basic.taxCode || "standard",
        tax: null,
        priceTableId: null,
        tradePolicy: "default",
        channel: "web",
        customerGroup: null,
        country: "ES",
      };

      return {
        ...current,
        pricing: {
          ...current.pricing,
          productPrice: updater(existing),
        },
      };
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

  function specificPriceCountForVariant(variant: ProductDraftVariant) {
    return visibleSpecificPrices.filter((price) =>
      price.targetType === "PRODUCT" ||
      price.variantKey === variant.localId ||
      price.variantKey === variant.variantId ||
      price.variantId === variant.variantId,
    ).length;
  }

  function resetSpecificPriceForm(targetKey = "__product__") {
    setSpecificPriceEditIndex(null);
    setSpecificPriceForm(defaultSpecificPriceForm(productPrice, targetKey));
  }

  function editSpecificPrice(index: number) {
    const price = specificPrices[index];
    if (!price) {
      return;
    }

    setSpecificPriceEditIndex(index);
    setSpecificPriceForm(specificPriceToForm(price, productPrice));
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
      variantKey: targetType === "VARIANT" ? targetKey : undefined,
      variantId: targetType === "VARIANT"
        ? priceVariantRows.find((variant) => variant.localId === targetKey)?.variantId ?? null
        : null,
      currency: productPrice?.currency || currency,
      country: specificPriceForm.country.trim() || null,
      customerGroup: specificPriceForm.customerGroup.trim() || null,
      channel: specificPriceForm.channel.trim() || productPrice?.channel || "web",
      tradePolicy: specificPriceForm.tradePolicy.trim() || productPrice?.tradePolicy || "default",
      priceTableId: specificPriceForm.priceTableId || null,
      minQuantity,
      validFrom: dateTimeLocalToIso(specificPriceForm.validFrom),
      validUntil: specificPriceForm.unlimited ? null : dateTimeLocalToIso(specificPriceForm.validUntil),
      unlimited: specificPriceForm.unlimited,
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
  }

  async function runPricingPreview() {
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
          country: pricingPreviewForm.country || productPrice?.country || "ES",
          tradePolicy: pricingPreviewForm.tradePolicy || productPrice?.tradePolicy || "default",
          channel: pricingPreviewForm.channel || productPrice?.channel || "web",
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
          country: pricingPreviewForm.country || productPrice?.country || "ES",
          tradePolicy: pricingPreviewForm.tradePolicy || productPrice?.tradePolicy || "default",
          channel: pricingPreviewForm.channel || productPrice?.channel || "web",
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
        country: pricingPreviewForm.country || productPrice?.country || "ES",
        tradePolicy: pricingPreviewForm.tradePolicy || productPrice?.tradePolicy || "default",
        channel: pricingPreviewForm.channel || productPrice?.channel || "web",
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
      warehouseId: draft.inventory.stockByVariant.default?.warehouseId ?? "main-warehouse",
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

  function enableVariantOwnStock(variant: ProductDraftVariant) {
    updateDraft((current) => {
      const existing =
        current.inventory.stockByVariant[variant.localId] ??
        (variant.variantId ? current.inventory.stockByVariant[variant.variantId] : undefined);
      const defaultStock = current.inventory.stockByVariant.default ?? {
        warehouseId: "main-warehouse",
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
            [variant.localId]: stockWithAvailability(existing ?? defaultStock),
          },
        },
      };
    });
  }

  function inheritVariantStock(variant: ProductDraftVariant) {
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
        warehouseId: current.inventory.stockByVariant.default?.warehouseId ?? "main-warehouse",
        onHandQuantity: 0,
        reservedQuantity: 0,
        safetyStockQuantity: 0,
      };
      const nextStock = stockWithAvailability(updater(currentStock));

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

  function updateStockWarehouse(variantKey: string, value: string) {
    updateStock(variantKey, (stock) => ({
      ...stock,
      warehouseId: value.trim() || "main-warehouse",
    }));
  }

  function updateShipping(updater: (shipping: ProductDraft["shipping"]) => ProductDraft["shipping"]) {
    updateDraft((current) => ({
      ...current,
      shipping: updater(current.shipping),
    }));
  }

  function optionalIntegerFromInput(value: string) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
  }

  function updateShippingPackage(field: keyof ProductDraft["shipping"]["package"], value: string) {
    updateShipping((shipping) => ({
      ...shipping,
      package: {
        ...shipping.package,
        [field]: optionalIntegerFromInput(value),
      },
    }));
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

  function applyGeneratedCombinations(rows: ProductDraftVariant[], action: "replace" | "append") {
    updateDraft((current) => {
      if (action === "append") {
        return {
          ...current,
          mode: "variants",
          variants: mergeVariantsByRef([...current.variants, ...rows]),
        };
      }

      return {
        ...current,
        mode: "variants",
        variants: rows,
        media: {
          ...current.media,
          assignments: {},
          mainByVariant: {},
        },
        pricing: {
          ...current.pricing,
          variantPrices: {},
          specificPrices: (current.pricing.specificPrices ?? []).filter((price) => price.targetType !== "VARIANT"),
        },
        inventory: {
          ...current.inventory,
          stockByVariant: {
            default: current.inventory.stockByVariant.default,
          },
        },
      };
    });
    setSelectedVariantKey(rows[0]?.localId ?? "default");
    setPendingGeneratedVariants(null);
  }

  function requestCombinationGeneration() {
    const rows = combinationRows(variantColors, variantSizes, draft.basic.name || "Producto");
    if (!rows.length) {
      return;
    }

    if (draft.variants.length > 0) {
      setPendingGeneratedVariants(rows);
      return;
    }

    applyGeneratedCombinations(rows, "replace");
  }

  function saveDraft() {
    const validation = validateProductDraft(draft);
    if (!validation.ok) {
      const errors = fieldErrorSummary(validation.fieldErrors);
      setReport({
        ok: false,
        blocks: {
          catalog: "failed",
          variants: draft.saveState.variants ?? "pending",
          media: draft.saveState.media ?? "pending",
          variantMedia: draft.saveState.variantMedia ?? "pending",
          pricing: draft.saveState.pricing ?? "pending",
          inventory: draft.saveState.inventory ?? "pending",
          shipping: draft.saveState.shipping ?? "pending",
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

    if (draft.basic.isActive) {
      const publicationValidation = validateProductPublicationReadiness(draft);
      if (!publicationValidation.ok) {
        const errors = fieldErrorSummary(publicationValidation.fieldErrors);
        setReport({
          ok: false,
          blocks: {
            catalog: draft.saveState.catalog ?? "pending",
            variants: draft.saveState.variants ?? "pending",
            media: draft.saveState.media ?? "pending",
            variantMedia: draft.saveState.variantMedia ?? "pending",
            pricing: draft.saveState.pricing ?? "pending",
            inventory: draft.saveState.inventory ?? "pending",
            shipping: draft.saveState.shipping ?? "pending",
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
    formData.set("draft", JSON.stringify(sanitizeDraftForStorage(draft)));
    saveOperationKeyRef.current ??= crypto.randomUUID();
    formData.set("idempotencyKey", saveOperationKeyRef.current);
    draft.media.items.forEach((item) => {
      const file = filesByLocalId[item.localId];
      if (file && !item.persisted && !item.mediaAssetId && (!item.uploadStatus || item.uploadStatus === "local")) {
        formData.append("fileLocalIds", item.localId);
        formData.append("files", file);
      }
    });

    setIsSaving(true);
    startTransition(async () => {
      try {
        const result = await saveProductDraftAction(formData);
        setReport(result);
        if (result.ok || !result.retryable) {
          saveOperationKeyRef.current = null;
        }

        if (result.draftPatch) {
          setDraft((current) => ({
            ...current,
            ...result.draftPatch,
            media: result.draftPatch?.media
              ? result.draftPatch.media
              : {
                  ...current.media,
                  items: result.blocks.media === "success"
                    ? current.media.items.map((item) => ({ ...item, persisted: true }))
                    : current.media.items,
                },
            saveState: result.draftPatch?.saveState ?? current.saveState,
          }));
        }

        if (result.ok || result.productId) {
          setDirty(false);
          window.localStorage.removeItem(storageKey);
        }

        if (result.blocks.variants === "success") {
          setVariantMessage(null);
        }

        if (result.fieldErrors.media || result.blocks.media === "failed" || result.blocks.variantMedia === "failed") {
          setActiveTab("images");
        }
      } catch (error) {
        setReport({
          ok: false,
          blocks: {
            catalog: "failed",
            variants: "pending",
            media: "pending",
            variantMedia: "pending",
            pricing: "pending",
            inventory: "pending",
            shipping: "pending",
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

  function createOfferingForSelectedVariant() {
    const variantId = offeringTargetVariant?.variantId;
    const name = offeringForm.name.trim();

    if (!name) {
      setOfferingMessage("El nombre del offering es obligatorio.");
      return;
    }
    if (!variantId) {
      setOfferingMessage("Guarda el producto y la variante antes de asignar offerings.");
      return;
    }

    startTransition(async () => {
      const result = await createAndAttachOfferingAction({
        variantId,
        name,
        type: offeringForm.type,
        priceMinor: inputToCents(offeringForm.price),
        currency,
        active: offeringForm.active,
      });

      if (result.ok) {
        setOfferingsForVariant(offeringTargetKey, result.offerings);
        setOfferingForm((current) => ({ ...current, name: "", price: "" }));
      }

      setOfferingMessage(result.message ?? (result.ok ? "Offering asignado." : "No se pudo asignar el offering."));
    });
  }

  function detachOffering(offeringId: string) {
    const variantId = offeringTargetVariant?.variantId;

    startTransition(async () => {
      const result = await detachOfferingFromVariantAction({ variantId, offeringId });
      if (result.ok) {
        setOfferingsForVariant(offeringTargetKey, result.offerings);
      }
      setOfferingMessage(result.message ?? (result.ok ? "Offering desasignado." : "No se pudo desasignar el offering."));
    });
  }

  function setOfferingActivation(offeringId: string, active: boolean) {
    const variantId = offeringTargetVariant?.variantId;

    startTransition(async () => {
      const result = await setOfferingVariantActivationAction({ variantId, offeringId, active });
      if (result.ok) {
        setOfferingsForVariant(offeringTargetKey, result.offerings);
      }
      setOfferingMessage(result.message ?? (result.ok ? "Offering actualizado." : "No se pudo actualizar el offering."));
    });
  }

  return (
    <main className="adminPage productEditorPage" aria-busy={savingActive}>
      <div className="adminBreadcrumb">
        <Link href="/admin">Admin</Link> / <Link href="/admin/catalogo">Catalogo</Link> / <Link href="/admin/products">Productos</Link> / {draft.productId ? "Editar" : "Nuevo"}
      </div>

      <div className="productEditorHeader">
        <div className="productEditorTitleGroup">
          <input
            aria-label="Nombre del producto"
            className="productEditorTitleInput"
            placeholder="Nuevo producto"
            value={draft.basic.name}
            onChange={(event) => updateBasic("name", event.target.value)}
          />
          <div className="productEditorMeta">
            <span className={`adminBadge ${draft.basic.isActive ? "adminBadgeOk" : "adminBadgeWarn"}`}>
              {productStatus}
            </span>
            <span>{draft.mode === "simple" ? "Producto simple" : "Producto con variantes"}</span>
            <span>{locale} / {currency}</span>
          </div>
        </div>

        <div className="productEditorMode" aria-label="Tipo de producto">
          <button
            className={`adminButton ${draft.mode === "simple" ? "adminButtonPrimary" : ""}`}
            type="button"
            onClick={() => updateDraft((current) => ({ ...current, mode: "simple" }))}
          >
            Producto simple
          </button>
          <button
            className={`adminButton ${draft.mode === "variants" ? "adminButtonPrimary" : ""}`}
            type="button"
            onClick={() => updateDraft((current) => ({ ...current, mode: "variants" }))}
          >
            Producto con variantes
          </button>
        </div>
      </div>

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
            <div className="adminButtonRow" aria-label="Acciones de recuperacion recomendadas">
              {report.recoveryActions.map((action) => (
                <span className="adminBadge adminBadgeWarn" key={`${action.code}:${action.targetBlock ?? "operation"}`}>
                  {action.label}
                </span>
              ))}
            </div>
          ) : null}
          {report.correlationIds.length > 0 ? (
            <p className="adminContextHint">Correlation: {report.correlationIds.join(", ")}</p>
          ) : null}
        </section>
      ) : null}

      {storedDraft && !dirty ? (
        <section className="adminBanner" aria-live="polite">
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
        <section className="adminBanner" aria-live="polite">
          {lookups.warnings.map((warning) => <p key={warning}>{warning}</p>)}
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

      <div className="productEditorLayout">
        <section className="productEditorContent">
          {activeTab === "basic" ? (
            <div className="productEditorPanel">
              <div className="adminTabPanel">
                <div className="productEditorSectionHeader">
                  <div>
                    <h2>Ajustes basicos</h2>
                    <p>Informacion esencial sincronizada con la ficha de producto.</p>
                  </div>
                </div>
                <div className="adminFormGrid adminFormGridTwo">
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
                  <ProductEntitySelector
                    createAction={createProductCategoryInlineAction}
                    fieldError={report?.fieldErrors.categoryId}
                    label="Categoria principal"
                    onSelect={(option) => updateDraft((current) => ({
                      ...current,
                      basic: {
                        ...current.basic,
                        categoryId: option.id,
                        categoryName: option.label,
                        categorySlug: option.slug,
                      },
                    }))}
                    options={categoryOptions}
                    placeholder="Nueva categoria"
                    selectedId={draft.basic.categoryId}
                  />
                  <ProductEntitySelector
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
                    placeholder="Nueva marca/proveedor"
                    selectedId={draft.basic.brandId}
                  />
                  <label className="adminField">
                    <span>Referencia principal</span>
                    <input
                      value={draft.defaultVariant.refId}
                      onChange={(event) => updateDraft((current) => ({
                        ...current,
                        defaultVariant: { ...current.defaultVariant, refId: event.target.value },
                      }))}
                    />
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
                <section className="productBasicPricing adminSection">
                  <div className="productEditorSectionHeader productEditorSectionHeaderCompact">
                    <div>
                      <h3>Precio base</h3>
                      <p>{formatMoney(productPrice?.basePriceMinor, productPrice?.currency || currency)} · {selectedTax?.label ?? "Sin regla fiscal"}</p>
                    </div>
                    <button className="adminButton" type="button" onClick={() => setActiveTab("pricing")}>
                      Ver precio avanzado
                    </button>
                  </div>
                  <div className="adminFormGrid adminFormGridTwo">
                    <label className="adminField">
                      <span>Precio venta imp. excl.</span>
                      <DecimalNumberInput
                        min="0"
                        value={centsToInput(netMinorFromPrice(productPrice, selectedTax))}
                        onValueChange={(value) => updateProductPriceField((price) => ({
                          ...price,
                          basePriceMinor: baseMinorFromNetInput(value, price, selectedTax),
                          currency: price.currency || currency,
                        }))}
                      />
                    </label>
                    <label className="adminField">
                      <span>Precio venta imp. incl.</span>
                      <DecimalNumberInput
                        min="0"
                        value={centsToInput(grossMinorFromPrice(productPrice, selectedTax))}
                        onValueChange={(value) => updateProductPriceField((price) => ({
                          ...price,
                          basePriceMinor: baseMinorFromGrossInput(value, price, selectedTax),
                          currency: price.currency || currency,
                        }))}
                      />
                    </label>
                    <label className="adminField">
                      <span>Regla de impuestos</span>
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
                      {report?.fieldErrors["pricing.productPrice.tax"] ? (
                        <small>{report.fieldErrors["pricing.productPrice.tax"]}</small>
                      ) : null}
                    </label>
                    <label className="adminField">
                      <span>Precio de coste</span>
                      <DecimalNumberInput
                        min="0"
                        value={centsToInput(productPrice?.costPriceMinor ?? undefined)}
                        onValueChange={(value) => updateProductPriceField((price) => ({
                          ...price,
                          costPriceMinor: inputToCents(value) || null,
                        }))}
                      />
                    </label>
                  </div>
                </section>
                <RichTextEditor
                  label="Resumen"
                  minHeight={140}
                  value={draft.basic.shortDescription}
                  onChange={(value) => updateBasic("shortDescription", value)}
                />
                <RichTextEditor
                  label="Descripcion"
                  minHeight={240}
                  value={draft.basic.description}
                  onChange={(value) => updateBasic("description", value)}
                />
                <div className="adminButtonRow adminSection">
                  <label className="adminCheckbox">
                    <input type="checkbox" checked={draft.basic.isVisible} onChange={(event) => updateBasic("isVisible", event.target.checked)} />
                    Visible en canales
                  </label>
                  <label className="adminCheckbox">
                    <input type="checkbox" checked={draft.basic.isActive} onChange={(event) => updateBasic("isActive", event.target.checked)} />
                    Activo
                  </label>
                </div>
                <div className={`adminBanner adminSection ${draft.basic.isActive && !publicationReady ? "adminBannerError" : ""}`}>
                  <p>{publicationReady ? "Producto listo para activarse." : "Para activar el producto faltan datos comerciales minimos."}</p>
                  <div className="productSaveBlocks">
                    {publicationChecklist.map((item) => (
                      <span className={`adminBadge ${item.ok ? "adminBadgeOk" : "adminBadgeWarn"}`} key={item.id}>
                        {item.label}: {item.ok ? "Correcto" : "Pendiente"}
                      </span>
                    ))}
                  </div>
                  {report?.fieldErrors.publication ? <small>{report.fieldErrors.publication}</small> : null}
                  {publicationChecklist.filter((item) => !item.ok).map((item) => (
                    <small key={item.id}>{item.message}</small>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "images" ? (
            <div className="adminSplit">
              <section className="productEditorPanel">
                <div className="productEditorSectionHeader">
                  <div>
                    <h2>Imagenes</h2>
                    <p>Galeria del producto, portada y captions localizados.</p>
                  </div>
                </div>
                <div className="productMediaGrid">
                  <input
                    ref={mediaFileInputRef}
                    className="productFileInput"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleMediaFileInputChange}
                  />
                  <button
                    className="productMediaAdd"
                    type="button"
                    onClick={openMediaFilePicker}
                    disabled={mediaPickerBusy}
                  >
                    <Plus aria-hidden="true" size={34} />
                    <span>{mediaPickerBusy ? "Abriendo..." : "Anadir imagenes"}</span>
                  </button>
                  {draft.media.items.map((item) => (
                    <div
                      className={`productMediaTile ${selectedMedia?.localId === item.localId ? "productMediaTileActive" : ""}`}
                      key={item.localId}
                    >
                      <button className="productMediaTileSelect" type="button" onClick={() => setSelectedMediaId(item.localId)}>
                        {hasRenderableMediaPreview(item) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mediaPreviewSrc(item)} alt={item.alt[locale] ?? item.fileName} onError={() => markMediaPreviewBroken(item.localId)} />
                        ) : (
                          <span>{item.fileName}</span>
                        )}
                        {item.isMain ? <strong>Portada</strong> : null}
                        {item.uploadStatus === "uploading" ? <em>Subiendo...</em> : null}
                        {item.uploadStatus === "uploaded" || item.persisted ? <em>Subida</em> : null}
                        {item.uploadStatus === "failed" ? <em>{item.uploadError ?? "Error al subir"}</em> : null}
                        {!item.persisted && (!item.uploadStatus || item.uploadStatus === "local") ? <em>Pendiente de subir</em> : null}
                      </button>
                      <button
                        aria-label={`Eliminar ${item.alt[locale] ?? item.fileName}`}
                        className="productMediaDeleteButton"
                        type="button"
                        onClick={() => removeMedia(item.localId)}
                      >
                        <Trash2 aria-hidden="true" size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                {mediaPickerMessage ? <p className="productMediaStatus">{mediaPickerMessage}</p> : null}
                {report?.fieldErrors.media ? (
                  <div className="adminBanner adminBannerError adminSection">
                    <p>{report.fieldErrors.media}</p>
                  </div>
                ) : null}
              </section>

              <aside className="productEditorPanel">
	                <h2>Metadata del asset</h2>
	                {selectedMedia ? (
	                  <div className="adminForm">
	                    <p className="adminContextHint">Estos campos describen el archivo. El nombre comercial de la variante se edita en Variantes.</p>
	                    <label className="adminCheckbox">
                      <input
                        type="checkbox"
                        checked={selectedMedia.isMain}
                        onChange={() => updateDraft((current) => ({
                          ...current,
                          media: {
                            ...current.media,
                            items: ensureSingleMainImage(current.media.items, selectedMedia.localId),
                          },
                        }))}
                      />
                      Imagen de portada
                    </label>
                    <label className="adminField">
	                      <span>Alt del asset</span>
                      <input value={selectedMedia.alt[locale] ?? ""} onChange={(event) => updateMedia(selectedMedia.localId, (item) => ({
                        ...item,
                        alt: { ...item.alt, [locale]: event.target.value },
                      }))} />
                    </label>
                    <label className="adminField">
	                      <span>Titulo del asset</span>
                      <input value={selectedMedia.title[locale] ?? ""} onChange={(event) => updateMedia(selectedMedia.localId, (item) => ({
                        ...item,
                        title: { ...item.title, [locale]: event.target.value },
                      }))} />
                    </label>
                    <label className="adminCheckbox">
                      <input type="checkbox" checked={selectedMedia.active} onChange={(event) => updateMedia(selectedMedia.localId, (item) => ({ ...item, active: event.target.checked }))} />
                      Activa
                    </label>
                    <button className="adminButton" type="button" onClick={() => removeMedia(selectedMedia.localId)}>
                      Eliminar del borrador
                    </button>
                  </div>
                ) : (
                  <div className="adminEmptyState">Selecciona una imagen para editar metadata.</div>
                )}
              </aside>
            </div>
          ) : null}

          {activeTab === "variants" ? (
            <div className="productEditorPanel">
              <div className="productEditorSectionHeader">
                <div>
	                  <h2>Producto y variantes</h2>
	                  <p>Gestiona producto y variantes vendibles con SKU, EAN, precio, stock, imagenes y estado propios.</p>
                </div>
                <div className="adminButtonRow">
                  <button className="adminButton" type="button">Filtros</button>
                  <button className="adminButton" type="button">Acciones masivas</button>
                  <button className="adminButton adminButtonPrimary" type="button" onClick={addManualVariant}>
                    Anadir variante
                  </button>
                </div>
              </div>
              <div className="productCombinationGenerator">
                <div>
                  <strong>Generador rapido desde opciones</strong>
	                  <p>Usalo solo cuando cada resultado generado sea una variante vendible.</p>
                </div>
                <div className="adminFormGrid adminFormGridTwo">
                  <label className="adminField">
                    <span>Color</span>
                    <input placeholder="rojo, azul" value={variantColors} onChange={(event) => setVariantColors(event.target.value)} />
                  </label>
                  <label className="adminField">
                    <span>Talla</span>
                    <input placeholder="S, M, L" value={variantSizes} onChange={(event) => setVariantSizes(event.target.value)} />
                  </label>
                </div>
                <button
                  className="adminButton adminButtonPrimary"
                  type="button"
                  onClick={requestCombinationGeneration}
                >
	                  Generar variantes
                </button>
              </div>
              {pendingGeneratedVariants ? (
                <div className="adminBanner adminSection">
                  <p>Ya existen variantes en la ficha. Elige como aplicar las {pendingGeneratedVariants.length} variantes nuevas.</p>
                  <div className="adminButtonRow">
                    <button className="adminButton adminButtonPrimary" type="button" onClick={() => applyGeneratedCombinations(pendingGeneratedVariants, "replace")}>
                      Reemplazar variantes
                    </button>
                    <button className="adminButton" type="button" onClick={() => applyGeneratedCombinations(pendingGeneratedVariants, "append")}>
                      Agregar a existentes
                    </button>
                    <button className="adminButton" type="button" onClick={() => setPendingGeneratedVariants(null)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : null}
              {variantMessage ? (
                <div className="adminBanner adminSection" aria-live="polite">
                  <p>{variantMessage}</p>
                </div>
              ) : null}
              <div className="adminTableScroller adminSection">
                <table className="adminTable productCombinationTable">
                  <thead>
                    <tr>
                      <th aria-label="Seleccion">Sel.</th>
                      <th>Imagen</th>
	                      <th>Producto / variante</th>
                      <th>SKU / referencia</th>
                      <th>EAN</th>
                      <th>Precio</th>
                      <th>Stock</th>
                      <th>Configuracion</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className={`productDefaultVariantRow ${selectedVariant.isDefault ? "productRowSelected" : ""}`}>
                      <td>
                        <input
	                          aria-label="Seleccionar producto"
                          checked={selectedVariant.isDefault}
                          type="radio"
                          onChange={() => setSelectedVariantKey("default")}
                        />
                      </td>
                      <td>
                        <div className="productCombinationImageCell">
                          <div className={`productTinyThumb ${hasDirectMediaForVariant("default") ? "" : "productTinyThumbInherited"}`}>
                            {hasRenderableMediaPreview(assignedMediaForVariant("default")[0]) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={mediaPreviewSrc(assignedMediaForVariant("default")[0])}
                                alt=""
                                onError={() => markMediaPreviewBroken(assignedMediaForVariant("default")[0].localId)}
                              />
                            ) : (
                              <span>No image</span>
                            )}
                          </div>
                          <span className={`productMediaStateBadge ${hasDirectMediaForVariant("default") ? "productMediaStateDirect" : "productMediaStateInherited"}`}>
                            {hasDirectMediaForVariant("default") ? "Directa" : "Portada producto"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <input
	                          aria-label="Nombre del producto"
                          readOnly
                          value={draft.basic.name}
                        />
                        <div className="adminContextHint">
                          {draft.defaultVariantId ? `variantId ${draft.defaultVariantId}` : "Se resolvera al guardar"}
                        </div>
	                        <div className="adminContextHint">{allVariantRows[0]?.displayLabel ?? "Producto base"}</div>
                      </td>
                      <td>
                        <input
	                          aria-label="Referencia principal"
                          readOnly
                          value={draft.defaultVariant.refId}
                        />
                      </td>
                      <td>
                        <input
	                          aria-label="EAN principal"
                          readOnly
                          value={draft.defaultVariant.ean ?? ""}
                        />
                      </td>
                      <td>
                        <div className="productInlinePriceCell">
                          <input
	                            aria-label="Precio del producto / defaultVariant"
                            readOnly
                            value={centsToInput(productPrice?.basePriceMinor)}
                          />
                          <span className="adminBadge adminBadgeOk">Precio del producto</span>
                        </div>
                      </td>
                      <td>
                        <input
	                          aria-label="Stock principal"
                          readOnly
                          value={stockForKey("default").onHandQuantity}
                        />
                      </td>
                      <td>
                        <div className="productVariantStateStack">
                          <span className={`adminBadge ${draft.basic.isActive ? "adminBadgeOk" : "adminBadgeWarn"}`}>
                            {draft.basic.isActive ? "Activa" : "Inactiva"}
                          </span>
                          <span className={`adminBadge ${draft.basic.isVisible ? "adminBadgeOk" : "adminBadgeWarn"}`}>
                            {draft.basic.isVisible ? "Visible" : "Oculta"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <button className="adminButton" type="button" onClick={() => setActiveTab("basic")}>
                          Editar base
                        </button>
                      </td>
                    </tr>
                    {draft.variants.length === 0 ? (
                      <tr>
                        <td colSpan={9}>Sin variantes adicionales. El producto usa solo la variante predeterminada.</td>
                      </tr>
                    ) : draft.variants.map((variant, index) => {
                      const rowError =
                        report?.fieldErrors[`variant:${variant.localId}`] ??
                        report?.fieldErrors[`variant:${variant.localId}:options`] ??
                        report?.fieldErrors[`pricing.variantPrices:${variant.localId}:tax`];
                      const refError = report?.fieldErrors[`variant:${variant.localId}:refId`];
                      const variantPrice = draft.pricing.variantPrices[variant.localId];
                      const usesOwnPrice = Boolean(variantPrice && !variantPrice.markedForDeletion);

                      return (
                        <tr className={selectedVariant.localId === variant.localId ? "productRowSelected" : ""} key={variant.localId}>
                          <td>
                            <input
                              aria-label={`Seleccionar ${variant.refId}`}
                              checked={selectedVariant.localId === variant.localId}
                              type="radio"
                              onChange={() => setSelectedVariantKey(variant.localId)}
                            />
                          </td>
                          <td>
                            <div className="productCombinationImageCell">
                              <div className={`productTinyThumb ${hasDirectMediaForVariant(variant.localId) ? "" : "productTinyThumbInherited"}`}>
                                {hasRenderableMediaPreview(assignedMediaForVariant(variant.localId)[0]) ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={mediaPreviewSrc(assignedMediaForVariant(variant.localId)[0])}
                                  alt=""
                                  onError={() => markMediaPreviewBroken(assignedMediaForVariant(variant.localId)[0].localId)}
                                />
                              ) : (
                                <span>No image</span>
                              )}
                              </div>
                              <span className={`productMediaStateBadge ${hasDirectMediaForVariant(variant.localId) ? "productMediaStateDirect" : "productMediaStateInherited"}`}>
                                {hasDirectMediaForVariant(variant.localId) ? "Directa" : "Heredada"}
                              </span>
                            </div>
                          </td>
                          <td>
                            <input
                              aria-label={`Nombre variante ${index + 1}`}
                              value={variant.name}
                              onChange={(event) => updateVariant(variant.localId, (item) => ({ ...item, name: event.target.value }))}
                            />
                            <div className="adminContextHint">
                              {variant.variantId ? `variantId ${variant.variantId}` : "Pendiente de guardar"}
                            </div>
                            <div className="adminContextHint">Opciones: {optionLabel(variant)}</div>
                            {rowError ? <small>{rowError}</small> : null}
                          </td>
                          <td>
                            <input
                              aria-label={`Referencia variante ${index + 1}`}
                              value={variant.refId}
                              onChange={(event) => updateVariant(variant.localId, (item) => ({ ...item, refId: event.target.value }))}
                            />
                            {refError ? <small>{refError}</small> : null}
                          </td>
                          <td>
                            <input
                              aria-label={`EAN variante ${index + 1}`}
                              value={variant.ean ?? ""}
                              onChange={(event) => updateVariant(variant.localId, (item) => ({ ...item, ean: event.target.value || null }))}
                            />
                          </td>
                          <td>
                            <div className="productInlinePriceCell">
                              <DecimalNumberInput
                                aria-label={`Precio variante ${index + 1}`}
                                min="0"
                                value={centsToInput(variantPrice?.markedForDeletion ? undefined : variantPrice?.basePriceMinor)}
                                onValueChange={(value) => updateVariantPrice(variant.localId, value)}
                              />
                              <button
                                className="adminButton"
                                disabled={!usesOwnPrice}
                                type="button"
                                onClick={() => removeVariantPrice(variant.localId)}
                              >
                                Heredar
                              </button>
                              <span className={`adminBadge ${usesOwnPrice ? "adminBadgeOk" : ""}`}>
                                {usesOwnPrice ? "Precio propio" : "Usa precio del producto"}
                              </span>
                            </div>
                          </td>
                          <td>
                            <input
                              aria-label={`Stock variante ${index + 1}`}
                              min="0"
                              type="number"
                              value={stockForKey(variant.localId).onHandQuantity}
                              onChange={(event) => updateStockNumber(variant.localId, "onHandQuantity", event.target.value)}
                            />
                          </td>
                          <td>
                            <div className="productVariantStateStack">
                              <span className={`adminBadge ${variant.isActive ? "adminBadgeOk" : "adminBadgeWarn"}`}>
                                {variant.isActive ? "Activa" : "Inactiva"}
                              </span>
                              <label className="adminCheckbox">
                                <input
                                  aria-label={`Activa variante ${index + 1}`}
                                  type="checkbox"
                                  checked={variant.isActive}
                                  onChange={(event) => updateVariant(variant.localId, (item) => ({ ...item, isActive: event.target.checked }))}
                                />
                                Activa
                              </label>
                              <label className="adminCheckbox">
                                <input
                                  aria-label={`Visible variante ${index + 1}`}
                                  type="checkbox"
                                  checked={variant.isVisible}
                                  onChange={(event) => updateVariant(variant.localId, (item) => ({ ...item, isVisible: event.target.checked }))}
                                />
                                Visible
                              </label>
                            </div>
                          </td>
                          <td>
                            <div className="adminButtonRow">
                              <button
                                className="adminButton"
                                disabled={isPending}
                                type="button"
                                onClick={() => changeVariantLifecycle(variant)}
                              >
                                {!variant.variantId ? "Quitar" : variant.isActive ? "Desactivar" : "Reactivar"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="productVariantDetailGrid adminSection">
                <section className="productVariantDetailPanel">
                  <div className="productEditorSectionHeader productEditorSectionHeaderCompact">
                    <div>
                      <h3>Opciones de la variante</h3>
                      <p>{selectedVariant.isDefault ? "La variante predeterminada se configura desde Ajustes basicos." : selectedVariant.name}</p>
                    </div>
                    <button
                      className="adminButton"
                      disabled={selectedVariant.isDefault}
                      type="button"
                      onClick={addSelectedVariantOption}
                    >
                      Anadir opcion
                    </button>
                  </div>
                  {selectedVariant.variantId ? (
                    <div className="adminBanner">
                      <p>Las opciones guardadas se actualizaran al guardar la ficha. Quitar una opcion persistida la desactiva de forma segura.</p>
                    </div>
                  ) : null}
                  {selectedVariant.options.filter((option) => !option.markedForDeletion).length === 0 ? (
                    <p className="adminContextHint">Sin opciones comerciales asignadas.</p>
                  ) : (
                    <div className="adminTableScroller">
                      <table className="adminTable productOptionTable">
                        <thead>
                          <tr>
                            <th>Atributo</th>
                            <th>Valor</th>
                            <th>Accion</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedVariant.options
                            .map((option, optionIndex) => ({ option, optionIndex }))
                            .filter(({ option }) => !option.markedForDeletion)
                            .map(({ option, optionIndex }) => (
                            <tr key={`${selectedVariant.localId}-${optionIndex}`}>
                              <td>
                                <input
                                  aria-label={`Atributo opcion ${optionIndex + 1}`}
                                  disabled={selectedVariant.isDefault}
                                  placeholder="color"
                                  value={option.attributeCode}
                                  onChange={(event) => updateSelectedVariantOption(optionIndex, "attributeCode", event.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  aria-label={`Valor opcion ${optionIndex + 1}`}
                                  disabled={selectedVariant.isDefault}
                                  placeholder="negro"
                                  value={option.valueCode}
                                  onChange={(event) => updateSelectedVariantOption(optionIndex, "valueCode", event.target.value)}
                                />
                              </td>
                              <td>
                                <button
                                  className="adminButton"
                                  disabled={selectedVariant.isDefault}
                                  type="button"
                                  onClick={() => removeSelectedVariantOption(optionIndex)}
                                >
                                  Quitar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {report?.fieldErrors[`variant:${selectedVariant.localId}:options`] ? (
                    <small>{report.fieldErrors[`variant:${selectedVariant.localId}:options`]}</small>
                  ) : null}
                </section>
                <section className="productVariantDetailPanel">
                  <h3>Especificaciones</h3>
                  <p>Las especificaciones pertenecen al catalogo del producto/categoria, no al precio, stock ni media.</p>
                  <div className="adminBanner">
                    <p>Las especificaciones del producto estan pendientes de integrarse en esta ficha.</p>
                  </div>
                  <dl className="productMetaList">
                    <div><dt>Categoria</dt><dd>{draft.basic.categoryName || draft.basic.categoryId || "Sin categoria"}</dd></div>
                    <div><dt>Contrato esperado</dt><dd>Listar campos por categoria y guardar selecciones por producto.</dd></div>
                  </dl>
                </section>
              </div>
            </div>
          ) : null}

          {activeTab === "pricing" ? (
            <section className="productEditorPanel">
              <div className="productEditorSectionHeader">
                <div>
                  <h2>Precio</h2>
                  <p>Define el precio base del producto y anade excepciones solo cuando las necesites.</p>
                </div>
              </div>
              <div className="pricingEditorContext">
                <span>Currency: <strong>{productPrice?.currency || currency}</strong></span>
                <span>Country: <strong>{productPrice?.country || "ES"}</strong></span>
                <span>Precio base: <strong>{formatMoney(productPrice?.basePriceMinor, productPrice?.currency || currency)}</strong></span>
                <span>Reglas especificas: <strong>{visibleSpecificPrices.length}</strong></span>
              </div>
              {lookups.warnings.filter((warning) => warning.startsWith("Pricing")).map((warning) => (
                <div className="adminBanner" key={warning}><p>{warning}</p></div>
              ))}
              <div className="adminFormGrid adminFormGridTwo">
                <label className="adminField">
                  <span>Precio de venta (imp. excl.)</span>
                  <DecimalNumberInput
                    aria-label="Precio de venta sin impuestos"
                    min="0"
                    value={centsToInput(netMinorFromPrice(productPrice, selectedTax))}
                    onValueChange={(value) => updateProductPriceField((price) => ({
                      ...price,
                      basePriceMinor: baseMinorFromNetInput(value, price, selectedTax),
                      currency: price.currency || currency,
                    }))}
                  />
                </label>
                <label className="adminField">
                  <span>Precio de venta (imp. incl.)</span>
                  <DecimalNumberInput
                    aria-label="Precio de venta con impuestos"
                    min="0"
                    value={centsToInput(grossMinorFromPrice(productPrice, selectedTax))}
                    onValueChange={(value) => updateProductPriceField((price) => ({
                      ...price,
                      basePriceMinor: baseMinorFromGrossInput(value, price, selectedTax),
                      currency: price.currency || currency,
                    }))}
                  />
                </label>
                <label className="adminField">
                  <span>Impuesto</span>
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
                  {report?.fieldErrors["pricing.productPrice.tax"] ? (
                    <small>{report.fieldErrors["pricing.productPrice.tax"]}</small>
                  ) : null}
                  {taxOptions.length === 0 ? (
                    <small>{pricingTaxWarning ?? "No hay reglas fiscales disponibles para este contexto."}</small>
                  ) : null}
                </label>
                <label className="adminField">
                  <span>Precio de coste</span>
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
              <label className="adminCheckbox adminSection">
                <input
                  type="checkbox"
                  checked={productPrice?.taxIncluded ?? true}
                  onChange={(event) => updateProductPriceField((price) => ({
                    ...price,
                    taxIncluded: event.target.checked,
                  }))}
                />
                Impuestos incluidos
              </label>
              <details className="productPricingAdvanced adminSection">
                <summary>Contexto avanzado de precio base</summary>
                <div className="adminFormGrid adminFormGridTwo">
                  <label className="adminField">
                    <span>priceTableId</span>
                    <select
                      value={productPrice?.priceTableId ?? ""}
                      onChange={(event) => updateProductPriceField((price) => ({
                        ...price,
                        priceTableId: event.target.value || null,
                      }))}
                    >
                      <option value="">Precio base</option>
                      {priceTableOptions.map((table) => (
                        <option key={table.id} value={table.id}>{table.label}</option>
                      ))}
                    </select>
                    {priceTableOptions.length === 0 ? (
                      <small>{pricingTablesWarning ?? "No hay price tables disponibles para este contexto."}</small>
                    ) : null}
                  </label>
                  <label className="adminField">
                    <span>tradePolicy</span>
                    <select
                      value={productPrice?.tradePolicy ?? "default"}
                      onChange={(event) => updateProductPriceField((price) => ({ ...price, tradePolicy: event.target.value }))}
                    >
                      {productTradePolicyOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="adminField">
                    <span>channel</span>
                    <select
                      value={productPrice?.channel ?? "web"}
                      onChange={(event) => updateProductPriceField((price) => ({ ...price, channel: event.target.value }))}
                    >
                      {productChannelOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="adminField">
                    <span>country</span>
                    <select
                      value={productPrice?.country ?? "ES"}
                      onChange={(event) => updateProductPriceField((price) => ({ ...price, country: event.target.value }))}
                    >
                      {productCountryOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="adminField">
                    <span>customerGroup</span>
                    <select
                      value={productPrice?.customerGroup ?? ""}
                      onChange={(event) => updateProductPriceField((price) => ({ ...price, customerGroup: event.target.value || null }))}
                    >
                      <option value="">Todos</option>
                      {productCustomerGroupOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </details>
              <div className="productPriceSummary productPriceSummaryWide adminSection">
                <div>
                  <strong>{formatMoney(productPrice?.basePriceMinor, productPrice?.currency || currency)}</strong>
                  <span>Precio producto</span>
                </div>
                <div>
                  <strong>{formatMoney(productPrice?.listPriceMinor ?? undefined, productPrice?.currency || currency)}</strong>
                  <span>Precio tachado</span>
                </div>
                <div>
                  <strong>{currentPricePreview ? formatMoney(currentPricePreview.net, productPrice?.currency || currency) : "-"}</strong>
                  <span>Neto preview</span>
                </div>
                <div>
                  <strong>{currentPricePreview ? formatMoney(currentPricePreview.tax, productPrice?.currency || currency) : "-"}</strong>
                  <span>Impuesto preview</span>
                </div>
                <div>
                  <strong>{currentPricePreview ? formatMoney(currentPricePreview.gross, productPrice?.currency || currency) : "-"}</strong>
                  <span>Bruto preview</span>
                </div>
                {!currentPricePreview ? <p>Preview neto/impuesto/bruto pendiente de respuesta resuelta del BFF o de una tasa en el impuesto seleccionado.</p> : null}
              </div>
              <section className="productSpecificPrices adminSection">
                <div className="productEditorSectionHeader">
                  <div>
                    <h3>Precios especificos</h3>
                    <p>{visibleSpecificPrices.length > 0 ? `${visibleSpecificPrices.length} regla(s) enlazada(s) al producto.` : "Sin reglas especificas todavia."}</p>
                  </div>
                  <button className="adminButton" type="button" onClick={() => resetSpecificPriceForm()}>
                    Anadir precio especifico
                  </button>
                </div>
                <div className="productSpecificPriceForm">
                  <div className="adminFormGrid adminFormGridTwo">
                    <label className="adminField">
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
                    <label className="adminCheckbox">
                      <input
                        checked={specificPriceForm.unlimited}
                        type="checkbox"
                        onChange={(event) => setSpecificPriceForm((current) => ({ ...current, unlimited: event.target.checked }))}
                      />
                      Ilimitado
                    </label>
                    <label className="adminField">
                      <span>Fecha final</span>
                      <input
                        disabled={specificPriceForm.unlimited}
                        type="datetime-local"
                        value={specificPriceForm.validUntil}
                        onChange={(event) => setSpecificPriceForm((current) => ({ ...current, validUntil: event.target.value }))}
                      />
                    </label>
                  </div>
                  <details className="productPricingAdvanced">
                    <summary>Condiciones avanzadas</summary>
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
                  <div className="adminButtonRow">
                    <button className="adminButton adminButtonPrimary" type="button" onClick={saveSpecificPriceForm}>
                      {specificPriceEditIndex === null ? "Guardar precio especifico" : "Actualizar precio especifico"}
                    </button>
                    <button className="adminButton" type="button" onClick={() => resetSpecificPriceForm()}>
                      Limpiar
                    </button>
                  </div>
                </div>
                {visibleSpecificPrices.length > 0 ? (
                  <div className="adminTableScroller adminSection">
                    <table className="adminTable productSpecificPriceTable">
                      <thead>
                        <tr>
                          <th>Aplicacion</th>
                          <th>Precio</th>
                          <th>Unidades</th>
                          <th>Duracion</th>
                          <th>Contexto</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {specificPrices.map((price, index) => {
                          if (price.markedForDeletion) {
                            return null;
                          }
                          return (
                            <tr key={price.pricingId ?? `${price.targetType}-${index}`}>
                              <td>
                                <strong>{specificPriceTargetLabel(price)}</strong>
                                <div className="adminContextHint">{price.targetType === "VARIANT" ? "Variante/combinacion" : "Todas las combinaciones"}</div>
                              </td>
                              <td>
                                <strong>{formatMoney(price.fixedPriceMinor ?? undefined, price.currency ?? productPrice?.currency ?? currency)}</strong>
                                <div className="adminContextHint">{price.taxIncluded ? "Imp. incl." : "Imp. excl."}</div>
                              </td>
                              <td>{price.minQuantity || 1}</td>
                              <td>{price.validUntil ? price.validUntil.slice(0, 10) : "Ilimitado"}</td>
                              <td>
                                <div>{price.country || "Todos los paises"} · {price.customerGroup || "Todos los grupos"}</div>
                                <div className="adminContextHint">{price.channel || "web"} · {price.tradePolicy || "default"}</div>
                              </td>
                              <td>
                                <div className="adminButtonRow">
                                  <button className="adminButton" type="button" onClick={() => editSpecificPrice(index)}>Editar</button>
                                  <button className="adminButton adminButtonDanger" type="button" onClick={() => removeSpecificPrice(index)}>Eliminar</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </section>
              <section className="productSpecificPrices adminSection">
                <div className="productEditorSectionHeader">
                  <div>
                    <h3>Simulador de precio aplicado</h3>
                    <p>Confirma el precio que Pricing devuelve para producto, variante y contexto.</p>
                  </div>
                  <span className={`adminBadge ${pricingPreviewResult?.ok ? "adminBadgeOk" : "adminBadgeWarn"}`}>
                    {pricingPreviewResult ? pricingResolutionLabel(pricingPreviewResult.resolution.source) : "Sin simular"}
                  </span>
                </div>
                <div className="adminFormGrid adminFormGridTwo">
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
                      setPricingPreviewResult(null);
                    }}
                  >
                    Reiniciar
                  </button>
                </div>
                {pricingPreviewResult ? (
                  <div className="adminSection">
                    {pricingPreviewResult.ok && pricingPreviewResult.price ? (
                      <div className="productPriceSummary productPriceSummaryWide">
                        <div>
                          <strong>{formatMoney(
                            pricingPreviewResult.price.resolved?.grossAmountMinor ??
                              pricingPreviewResult.price.fixedPrice?.amountMinor ??
                              pricingPreviewResult.price.basePrice.amountMinor,
                            pricingPreviewResult.price.resolved?.currency ?? pricingPreviewResult.price.currency,
                          )}</strong>
                          <span>Precio aplicado</span>
                        </div>
                        <div>
                          <strong>{formatMoney(pricingPreviewResult.price.basePrice.amountMinor, pricingPreviewResult.price.currency)}</strong>
                          <span>Precio base</span>
                        </div>
                        <div>
                          <strong>{pricingPreviewResult.price.fixedPrice ? formatMoney(pricingPreviewResult.price.fixedPrice.amountMinor, pricingPreviewResult.price.fixedPrice.currency) : "-"}</strong>
                          <span>Precio especifico</span>
                        </div>
                        <div>
                          <strong>{pricingPreviewResult.price.source}</strong>
                          <span>Fuente</span>
                        </div>
                        <div>
                          <strong>{pricingPreviewResult.price.pricingId}</strong>
                          <span>pricingId</span>
                        </div>
                      </div>
                    ) : (
                      <div className="adminBanner adminBannerError">
                        <p>{pricingPreviewResult.reason ?? "No hay precio aplicable para estos parametros."}</p>
                      </div>
                    )}
                    <div className="pricingEditorContext">
                      <span>Target: <strong>{pricingPreviewTarget?.displayLabel ?? "Producto"}</strong></span>
                      <span>Resolucion: <strong>{pricingResolutionLabel(pricingPreviewResult.resolution.source)}</strong></span>
                      <span>Fallback: <strong>{pricingPreviewResult.resolution.usedFallback ? "Si" : "No"}</strong></span>
                      {pricingPreviewResult.price ? (
                        <span>Tabla: <strong>{pricingPreviewResult.price.priceTableId ?? "base"}</strong></span>
                      ) : null}
                    </div>
                    {pricingPreviewResult.conditions.length > 0 ? (
                      <div className="adminTableScroller adminSection">
                        <table className="adminTable productSpecificPriceTable">
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
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>
              <div className="adminBanner adminSection">
                <p>La productVariantDefault se gestiona con el precio superior. Las variantes listadas abajo solo necesitan cambios si requieren precio, impuesto o tabla propios.</p>
              </div>
              {priceVariantRows.length > 0 ? (
              <>
              <div className="adminSection">
                <div className="productEditorSectionHeader">
                  <div>
                    <h3>Override de variante adicional</h3>
                    <p>{selectedPriceVariant?.name ?? "Selecciona una variante adicional"}</p>
                  </div>
                  <span className={`adminBadge ${selectedVariantUsesOwnPrice ? "adminBadgeOk" : ""}`}>
                    {selectedVariantUsesOwnPrice ? "Precio propio" : "Fallback producto"}
                  </span>
                </div>
                <div className="adminFormGrid adminFormGridTwo">
                  <label className="adminField">
                    <span>Variante adicional a editar</span>
                    <select
                      value={selectedPriceVariant?.localId ?? ""}
                      onChange={(event) => setSelectedVariantKey(event.target.value)}
                    >
                      {priceVariantRows.map((variant) => (
                        <option key={variant.localId} value={variant.localId}>
                          {variant.name} · {variant.refId || "sin referencia"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="adminField">
                    <span>Precio propio</span>
                    <DecimalNumberInput
                      disabled={!selectedPriceVariant}
                      min="0"
                      value={centsToInput(selectedVariantPrice?.markedForDeletion ? undefined : selectedVariantPrice?.basePriceMinor)}
                      onValueChange={(value) => selectedPriceVariant ? updateVariantPrice(selectedPriceVariant.localId, value) : undefined}
                    />
                    {selectedPriceVariant && report?.fieldErrors[`pricing.variantPrices:${selectedPriceVariant.localId}:tax`] ? (
                      <small>{report.fieldErrors[`pricing.variantPrices:${selectedPriceVariant.localId}:tax`]}</small>
                    ) : null}
                  </label>
                  <label className="adminField">
                    <span>Impuesto de variante</span>
                    <select
                      disabled={!selectedPriceVariant || !selectedVariantUsesOwnPrice || variantTaxOptions.length === 0}
                      value={selectedVariantTax?.id ?? ""}
                      onChange={(event) => {
                        const tax = variantTaxOptions.find((item) => item.id === event.target.value) ?? null;
                        if (!selectedPriceVariant) {
                          return;
                        }
                        updateVariantPriceField(selectedPriceVariant.localId, (price) => ({
                          ...price,
                          taxCode: tax?.taxCode ?? price.taxCode,
                          tax,
                        }));
                      }}
                    >
                      <option value="">{variantTaxOptions.length ? "Heredar/sin regla" : "Sin reglas fiscales cargadas"}</option>
                      {variantTaxOptions.map((tax) => (
                        <option key={tax.id} value={tax.id}>{tax.label}</option>
                      ))}
                    </select>
                    {!selectedVariantUsesOwnPrice && selectedPriceVariant ? (
                      <small>Usa el impuesto del producto: {selectedTax?.label ?? "sin regla fiscal"}.</small>
                    ) : null}
                  </label>
                  <label className="adminField">
                    <span>priceTableId de variante</span>
                    <select
                      disabled={!selectedPriceVariant || !selectedVariantUsesOwnPrice}
                      value={selectedVariantPrice?.priceTableId ?? ""}
                      onChange={(event) => selectedPriceVariant
                        ? updateVariantPriceField(selectedPriceVariant.localId, (price) => ({
                            ...price,
                            priceTableId: event.target.value || null,
                          }))
                        : undefined}
                    >
	                      <option value="">Precio base</option>
                      {variantPriceTableOptions.map((table) => (
                        <option key={table.id} value={table.id}>{table.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="adminButtonRow adminSection">
                  <button
                    className="adminButton"
                    disabled={!selectedPriceVariant || !selectedVariantUsesOwnPrice}
                    type="button"
                    onClick={() => selectedPriceVariant ? removeVariantPrice(selectedPriceVariant.localId) : undefined}
                  >
                    Quitar precio propio
                  </button>
                </div>
              </div>
              <div className="adminTableScroller adminSection">
                <table className="adminTable productCombinationTable">
                  <thead>
                    <tr>
                      <th aria-label="Seleccion">Sel.</th>
                      <th>Variante</th>
                      <th>Modo</th>
                      <th>Precio</th>
                      <th>Especificos</th>
                      <th>Fiscalidad</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceVariantRows.map((variant) => {
                      const price = draft.pricing.variantPrices[variant.localId];
                      const usesOwnPrice = Boolean(price && !price.markedForDeletion);
                      const variantTax = price?.tax ?? selectedTax;
                      const variantPriceTable = price?.priceTableId ?? productPrice?.priceTableId;
                      const specificCount = specificPriceCountForVariant(variant);
                      return (
                        <tr className={selectedPriceVariant?.localId === variant.localId ? "productRowSelected" : ""} key={variant.localId}>
                          <td>
                            <input
                              aria-label={`Editar precio de ${variant.refId || variant.name}`}
                              checked={selectedPriceVariant?.localId === variant.localId}
                              type="radio"
                              onChange={() => setSelectedVariantKey(variant.localId)}
                            />
                          </td>
                          <td>
                            <strong>{variant.name}</strong>
                            <div className="adminContextHint">{variant.refId}</div>
                          </td>
	                          <td>
	                            <span className={`adminBadge ${usesOwnPrice ? "adminBadgeOk" : ""}`}>
	                              {usesOwnPrice ? "Precio propio de variante" : "Usa precio del producto"}
	                            </span>
	                            <div className="adminContextHint">
	                              {price?.pricingId ? `Pricing ${price.pricingId}` : usesOwnPrice ? "Override nuevo" : "Fallback activo"}
	                            </div>
                          </td>
                          <td>
                            <strong>{usesOwnPrice ? formatMoney(price?.basePriceMinor, price?.currency || currency) : formatMoney(productPrice?.basePriceMinor, productPrice?.currency || currency)}</strong>
                            <div className="adminContextHint">{usesOwnPrice ? "Override" : "Producto"}</div>
                          </td>
                          <td>
                            <span className={`adminBadge ${specificCount > 0 ? "adminBadgeOk" : ""}`}>
                              {specificCount > 0 ? `${specificCount} regla(s)` : "Sin reglas"}
                            </span>
                          </td>
                          <td>
                            <div>{variantTax?.label ?? "Sin regla fiscal"}</div>
	                            <div className="adminContextHint">{variantPriceTable ?? "Precio base"}</div>
                          </td>
                          <td>
                            <div className="adminButtonRow">
                              <button
                                className="adminButton"
                                type="button"
                                onClick={() => setSelectedVariantKey(variant.localId)}
                              >
                                Editar
                              </button>
                              <button
                                className="adminButton"
                                type="button"
                                onClick={() => resetSpecificPriceForm(variant.localId)}
                              >
                                Anadir especifico
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
              ) : (
                <div className="adminBanner adminSection">
                  <p>Este producto no tiene variantes adicionales. El precio superior cubre la productVariantDefault.</p>
                </div>
              )}
              {report?.blocks.pricing === "failed" ? (
                <div className="adminBanner adminBannerError adminSection">
                  <p>Pricing fallo sin romper Catalog/Media.</p>
                  <button className="adminButton" type="button" onClick={saveDraft}>Reintentar precio</button>
                </div>
              ) : null}
            </section>
          ) : null}

          {activeTab === "offerings" ? (
            <section className="productEditorPanel">
              <div className="productEditorSectionHeader">
                <div>
                  <h2>Offering</h2>
                  <p>Servicios vendibles asociados a una variante persistida.</p>
                </div>
              </div>
              {!draft.productId ? (
                <div className="adminBanner adminSection">
                  <p>Guarda primero el producto para crear variantes reales antes de asignar offerings.</p>
                </div>
              ) : null}
              <div className="adminFormGrid adminFormGridTwo">
                <label className="adminField">
                  <span>Variante</span>
                  <select
                    value={offeringForm.variantKey}
                    onChange={(event) => {
                      setOfferingForm((current) => ({ ...current, variantKey: event.target.value }));
                      setOfferingMessage(null);
                    }}
                  >
	                    {allVariantRows.map((variant) => (
	                      <option key={variant.localId} value={variant.localId}>
	                        {variant.selectorLabel}
	                      </option>
	                    ))}
                  </select>
                  {!offeringTargetVariant?.variantId ? <small>Esta variante todavia no tiene variantId.</small> : null}
                </label>
                <label className="adminField">
                  <span>Nombre del offering</span>
                  <input
                    placeholder="Garantia extendida"
                    value={offeringForm.name}
                    onChange={(event) => setOfferingForm((current) => ({ ...current, name: event.target.value }))}
                  />
                </label>
                <label className="adminField">
                  <span>Tipo</span>
                  <select
                    value={offeringForm.type}
                    onChange={(event) => setOfferingForm((current) => ({ ...current, type: event.target.value }))}
                  >
                    <option value="service">Servicio</option>
                    <option value="warranty">Garantia</option>
                    <option value="addon">Add-on</option>
                  </select>
                </label>
                <label className="adminField">
                  <span>Precio</span>
                  <DecimalNumberInput
                    min="0"
                    value={offeringForm.price}
                    onValueChange={(value) => setOfferingForm((current) => ({ ...current, price: value }))}
                  />
                </label>
              </div>
              <div className="adminButtonRow adminSection">
                <label className="adminCheckbox">
                  <input
                    type="checkbox"
                    checked={offeringForm.active}
                    onChange={(event) => setOfferingForm((current) => ({ ...current, active: event.target.checked }))}
                  />
                  Activo
                </label>
                <button
                  className="adminButton adminButtonPrimary"
                  disabled={isPending || !offeringTargetVariant?.variantId}
                  type="button"
                  onClick={createOfferingForSelectedVariant}
                >
                  Crear y asignar
                </button>
              </div>
              {offeringMessage ? (
                <div className="adminBanner adminSection" aria-live="polite">
                  <p>{offeringMessage}</p>
                </div>
              ) : null}
              <div className="adminTableScroller adminSection">
                <table className="adminTable productCombinationTable">
                  <thead>
                    <tr>
                      <th>Offering</th>
                      <th>Tipo</th>
                      <th>Precio</th>
                      <th>Estado</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offeringsForTarget.length === 0 ? (
                      <tr>
                        <td colSpan={5}>No hay offerings asociados a esta variante.</td>
                      </tr>
                    ) : offeringsForTarget.map((offering) => (
                      <tr key={offering.offeringId}>
                        <td>
                          <strong>{offeringName(offering, locale)}</strong>
                          <div className="adminContextHint">{offering.offeringId}</div>
                        </td>
                        <td>{offering.type}</td>
                        <td>{formatMoney(offering.priceMinor, offering.currency || currency)}</td>
                        <td>
                          <label className="adminCheckbox">
                            <input
                              checked={offering.active}
                              disabled={isPending}
                              type="checkbox"
                              onChange={(event) => setOfferingActivation(offering.offeringId, event.target.checked)}
                            />
                            {offering.active ? "Activo" : "Inactivo"}
                          </label>
                        </td>
                        <td>
                          <button
                            className="adminButton"
                            disabled={isPending}
                            type="button"
                            onClick={() => detachOffering(offering.offeringId)}
                          >
                            Desasignar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {activeTab === "inventory" ? (
            <section className="productEditorPanel">
              <div className="productEditorSectionHeader">
                <div>
                  <h2>Inventario</h2>
                  <p>Stock por variante y warehouse, separado del precio y la galeria.</p>
                </div>
              </div>

              <div className="adminTableScroller adminSection">
                <table className="adminTable productCombinationTable">
                  <thead>
                    <tr>
	                      <th>Stock del producto</th>
                      <th>Warehouse</th>
                      <th>On hand</th>
                      <th>Reservado</th>
                      <th>Safety</th>
                      <th>Disponible</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const stock = stockForKey("default");
                      const available = availableQuantity(stock);
                      return (
                        <tr>
                          <td>
	                            <strong>{allVariantRows[0]?.displayLabel ?? "Producto"}</strong>
                            <div className="adminContextHint">
                              {draft.defaultVariantId ? `variantId ${draft.defaultVariantId}` : "Se resolvera al guardar"}
                            </div>
                          </td>
                          <td>
                            <input
                              aria-label="Warehouse default"
                              value={stock.warehouseId}
                              onChange={(event) => updateStockWarehouse("default", event.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              aria-label="On hand default"
                              min="0"
                              type="number"
                              value={stock.onHandQuantity}
                              onChange={(event) => updateStockNumber("default", "onHandQuantity", event.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              aria-label="Reservado default"
                              min="0"
                              type="number"
                              value={stock.reservedQuantity}
                              onChange={(event) => updateStockNumber("default", "reservedQuantity", event.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              aria-label="Safety default"
                              min="0"
                              type="number"
                              value={stock.safetyStockQuantity}
                              onChange={(event) => updateStockNumber("default", "safetyStockQuantity", event.target.value)}
                            />
                          </td>
                          <td>
                            <strong>{available}</strong>
                          </td>
                          <td>
                            <span className={`adminBadge ${available > 0 ? "adminBadgeOk" : "adminBadgeWarn"}`}>
                              {available > 0 ? "Disponible" : "Sin stock"}
                            </span>
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>

              {draft.mode === "variants" ? (
                <div className="adminTableScroller adminSection">
                  <table className="adminTable productCombinationTable">
                    <thead>
                      <tr>
                        <th>Variante</th>
                        <th>Modo</th>
                        <th>Warehouse</th>
                        <th>On hand</th>
                        <th>Reservado</th>
                        <th>Safety</th>
                        <th>Disponible</th>
                        <th>Estado</th>
                        <th>Accion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.variants.length === 0 ? (
                        <tr>
	                          <td colSpan={9}>Sin variantes adicionales. Usa el stock del producto simple.</td>
                        </tr>
                      ) : draft.variants.map((variant) => {
                        const stockState = stockForVariantRow(variant);
                        const stock = stockState.stock;
                        const hasOwnStock = stockState.mode === "own";
                        const canReturnToInherited = hasOwnStock && (!variant.variantId || stockState.key !== variant.variantId);
                        const available = availableQuantity(stock);
                        return (
                          <tr className={hasOwnStock ? "" : "productInventoryInherited"} key={variant.localId}>
                            <td>
                              <strong>{variant.name}</strong>
                              <div className="adminContextHint">
                                {variant.variantId ? `variantId ${variant.variantId}` : `${variant.refId} pendiente de guardar`}
                              </div>
                            </td>
                            <td className="productInventoryModeCell">
                              <span className={`productMediaStateBadge ${hasOwnStock ? "productMediaStateDirect" : "productMediaStateInherited"}`}>
                                {hasOwnStock ? "Stock propio" : "Heredado"}
                              </span>
	                              {!hasOwnStock ? <small>Usa stock del producto</small> : null}
                            </td>
                            <td>
                              <input
                                aria-label={`Warehouse ${variant.refId}`}
                                disabled={!hasOwnStock}
                                value={stock.warehouseId}
                                onChange={(event) => updateStockWarehouse(stockState.key, event.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                aria-label={`On hand ${variant.refId}`}
                                disabled={!hasOwnStock}
                                min="0"
                                type="number"
                                value={stock.onHandQuantity}
                                onChange={(event) => updateStockNumber(stockState.key, "onHandQuantity", event.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                aria-label={`Reservado ${variant.refId}`}
                                disabled={!hasOwnStock}
                                min="0"
                                type="number"
                                value={stock.reservedQuantity}
                                onChange={(event) => updateStockNumber(stockState.key, "reservedQuantity", event.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                aria-label={`Safety ${variant.refId}`}
                                disabled={!hasOwnStock}
                                min="0"
                                type="number"
                                value={stock.safetyStockQuantity}
                                onChange={(event) => updateStockNumber(stockState.key, "safetyStockQuantity", event.target.value)}
                              />
                            </td>
                            <td>
                              <strong>{available}</strong>
                            </td>
                            <td>
                              <span className={`adminBadge ${available > 0 ? "adminBadgeOk" : "adminBadgeWarn"}`}>
                                {available > 0 ? "Disponible" : "Sin stock"}
                              </span>
                            </td>
                            <td>
                              {hasOwnStock ? (
                                <button
                                  className="adminButton"
                                  disabled={!canReturnToInherited}
                                  title={canReturnToInherited ? undefined : "Inventory no expone borrado de stock persistido todavia."}
                                  type="button"
                                  onClick={() => inheritVariantStock(variant)}
                                >
	                                  {canReturnToInherited ? "Heredar default" : "Stock propio guardado"}
                                </button>
                              ) : (
                                <button className="adminButton" type="button" onClick={() => enableVariantOwnStock(variant)}>
                                  Usar stock propio
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {report?.blocks.inventory === "failed" ? (
                <div className="adminBanner adminBannerError adminSection">
                  <p>Inventory fallo sin revertir Catalog, Media ni Pricing.</p>
                  <button className="adminButton" type="button" onClick={saveDraft}>Reintentar stock</button>
                </div>
              ) : null}

              <div className="productPriceSummary adminSection">
                {(() => {
                  const variantStockRows = draft.variants.map((variant) => stockForVariantRow(variant));
                  const ownAvailable = variantStockRows.reduce(
                    (total, row) => total + (row.mode === "own" ? availableQuantity(row.stock) : 0),
                    0,
                  );
                  const inheritedCount = variantStockRows.filter((row) => row.mode === "inherited").length;

                  return (
                    <>
                      <strong>{availableQuantity(stockForKey("default"))}</strong>
	                      <span>Disponible producto</span>
                      <strong>{ownAvailable}</strong>
                      <span>Disponible stock propio</span>
                      <strong>{inheritedCount}/{draft.variants.length}</strong>
                      <span>Variantes heredando</span>
                    </>
                  );
                })()}
              </div>
            </section>
          ) : null}

          {activeTab === "shipping" ? (
            <section className="productEditorPanel">
              <div className="productEditorSectionHeader">
                <div>
                  <h2>Transporte</h2>
	                  <p>Datos logisticos del producto; las variantes heredan salvo reglas propias futuras.</p>
                </div>
	                <span className="adminBadge">Producto</span>
              </div>

              <div className="pricingEditorContext">
                <span><strong>Peso:</strong> {draft.shipping.package.weightGrams ? `${draft.shipping.package.weightGrams} g` : "Sin definir"}</span>
                <span><strong>Dimensiones:</strong> {shippingDimensionsComplete ? `${shippingPackage.widthMm} x ${shippingPackage.heightMm} x ${shippingPackage.depthMm} mm` : "Sin definir"}</span>
                <span><strong>Coste adicional:</strong> {formatMoney(draft.shipping.additionalShippingCostMinor ?? 0, currency)}</span>
                <span><strong>Transportistas:</strong> {draft.shipping.allowedCarrierIds.length > 0 ? `${draft.shipping.allowedCarrierIds.length} seleccionados` : "Todos los activos"}</span>
              </div>

              <div className="adminFormGrid adminFormGridTwo">
                <label className="adminField">
                  <span>Peso del paquete (g)</span>
                  <input
                    inputMode="numeric"
                    min="0"
                    type="number"
                    value={draft.shipping.package.weightGrams ?? ""}
                    onChange={(event) => updateShippingPackage("weightGrams", event.target.value)}
                  />
                </label>
                <label className="adminField">
                  <span>Coste adicional ({currency})</span>
                  <DecimalNumberInput
                    inputMode="decimal"
                    min="0"
                    value={centsToInput(draft.shipping.additionalShippingCostMinor ?? undefined)}
                    onValueChange={(value) => updateShipping((shipping) => ({
                      ...shipping,
                      additionalShippingCostMinor: inputToCents(value),
                    }))}
                  />
                </label>
                <label className="adminField">
                  <span>Ancho (mm)</span>
                  <input
                    inputMode="numeric"
                    min="0"
                    type="number"
                    value={draft.shipping.package.widthMm ?? ""}
                    onChange={(event) => updateShippingPackage("widthMm", event.target.value)}
                  />
                </label>
                <label className="adminField">
                  <span>Alto (mm)</span>
                  <input
                    inputMode="numeric"
                    min="0"
                    type="number"
                    value={draft.shipping.package.heightMm ?? ""}
                    onChange={(event) => updateShippingPackage("heightMm", event.target.value)}
                  />
                </label>
                <label className="adminField">
                  <span>Profundidad (mm)</span>
                  <input
                    inputMode="numeric"
                    min="0"
                    type="number"
                    value={draft.shipping.package.depthMm ?? ""}
                    onChange={(event) => updateShippingPackage("depthMm", event.target.value)}
                  />
                </label>
                <label className="adminField">
                  <span>Plazo de entrega</span>
                  <select
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
                      className="adminTextarea"
                      value={draft.shipping.deliveryTimeNotes.inStock[locale] ?? ""}
                      onChange={(event) => updateShippingDeliveryNote("inStock", event.target.value)}
                    />
                  </label>
                  <label className="adminField">
                    <span>Entrega sin stock ({locale})</span>
                    <textarea
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
            </section>
          ) : null}

          {activeTab === "seo" ? (
            <section className="productEditorPanel">
              <h2>SEO</h2>
              <div className="adminFormGrid adminFormGridTwo">
                <label className="adminField">
                  <span>Title</span>
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
            </section>
          ) : null}

          {activeTab === "options" ? (
            <section className="productEditorPanel">
              <h2>Opciones</h2>
              <label className="adminField">
                <span>Tax code</span>
                <input value={draft.basic.taxCode} onChange={(event) => updateBasic("taxCode", event.target.value)} />
              </label>
            </section>
          ) : null}
        </section>

        <aside className="productEditorSidePanel">
          <section className="productEditorPanel">
            <h2>Resumen</h2>
            <div className="productCoverPreview">
              {hasRenderableMediaPreview(assignedMediaForVariant("default")[0]) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaPreviewSrc(assignedMediaForVariant("default")[0])}
                  alt=""
                  onError={() => markMediaPreviewBroken(assignedMediaForVariant("default")[0].localId)}
                />
              ) : (
                <span>Sin portada</span>
              )}
            </div>
            <dl className="productMetaList">
              <div><dt>Tipo</dt><dd>{draft.mode === "simple" ? "Producto simple" : "Con variantes"}</dd></div>
              <div><dt>Precio base</dt><dd>{formatMoney(draft.pricing.productPrice?.basePriceMinor, currency)}</dd></div>
              <div><dt>Variantes</dt><dd>{draft.variants.length}</dd></div>
              <div><dt>Imagenes</dt><dd>{draft.media.items.length}</dd></div>
            </dl>
          </section>

          {activeTab === "variants" || activeTab === "images" ? (
            <section className="productEditorPanel">
              <h2>Imagenes de variante</h2>
              <label className="adminField">
                <span>Variante seleccionada</span>
                <select value={selectedVariant.localId} onChange={(event) => setSelectedVariantKey(event.target.value)}>
	                  {allVariantRows.map((variant) => (
	                    <option key={variant.localId} value={variant.localId}>
	                      {variant.selectorLabel}
	                    </option>
	                  ))}
                </select>
              </label>
              <div className="productVariantMediaPicker">
                {draft.media.items.length === 0 ? (
                  <div className="adminEmptyState">Sube imagenes en la pestana Imagenes para asignarlas a una variante.</div>
                ) : draft.media.items.map((item) => {
                  const selectedVariantMediaId = selectedVariantMain ?? selectedVariantAssignments[0];
                  const checked = selectedVariantMediaId === item.localId;
                  const isMain = checked;
                  const fieldError = report?.fieldErrors[`media:${selectedVariant.localId}`];
                  return (
                    <div className={`productVariantMediaItem ${checked ? "productVariantMediaItemSelected" : ""}`} key={item.localId}>
                      <button type="button" onClick={() => setVariantMainMedia(selectedVariant.localId, item.localId)}>
                        {hasRenderableMediaPreview(item) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mediaPreviewSrc(item)} alt={item.alt[locale] ?? item.fileName} onError={() => markMediaPreviewBroken(item.localId)} />
                        ) : (
                          <span>{item.fileName}</span>
                        )}
                      </button>
                      <label className="adminCheckbox">
                        <input
                          checked={checked}
                          type="checkbox"
                          onChange={(event) => {
                            if (event.target.checked) {
                              setVariantMainMedia(selectedVariant.localId, item.localId);
                            } else {
                              clearVariantMedia(selectedVariant.localId);
                            }
                          }}
                        />
                        Asignada
                      </label>
                      <label className="adminCheckbox">
                        <input checked={isMain} type="radio" onChange={() => setVariantMainMedia(selectedVariant.localId, item.localId)} />
                        Portada
                      </label>
                      {fieldError && checked ? <small>{fieldError}</small> : null}
                    </div>
                  );
                })}
              </div>
              <button className="adminButton adminSection" type="button" onClick={() => clearVariantMedia(selectedVariant.localId)}>
	                Limpiar imagenes y heredar producto
              </button>
            </section>
          ) : null}
        </aside>
      </div>

      {previewOpen ? (
        <div
          className="productPreviewOverlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPreviewOpen(false);
            }
          }}
        >
          <aside aria-labelledby="product-preview-title" aria-modal="true" className="productPreviewDrawer" role="dialog">
            <header className="productPreviewHeader">
              <div>
                <span className={"adminBadge " + (draft.basic.isActive && draft.basic.isVisible ? "adminBadgeOk" : "adminBadgeWarn")}>
                  {draft.basic.isActive && draft.basic.isVisible ? "Publicado" : "Borrador"}
                </span>
                <h2 id="product-preview-title">Vista previa PDP</h2>
              </div>
              <button aria-label="Cerrar vista previa" className="adminIconButton" type="button" onClick={() => setPreviewOpen(false)}>
                <X aria-hidden="true" size={18} />
              </button>
            </header>

            <div className="productPreviewBody">
              <section className="productPreviewMediaPane" aria-label="Imagenes del producto">
                <div className="productPreviewMediaStage">
                  {hasRenderableMediaPreview(previewHeroMedia) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaPreviewSrc(previewHeroMedia)}
                      alt={previewHeroMedia.alt[locale] ?? previewHeroMedia.fileName}
                      onError={() => markMediaPreviewBroken(previewHeroMedia.localId)}
                    />
                  ) : (
                    <span>Sin imagen</span>
                  )}
                </div>
                {previewMediaItems.length > 1 ? (
                  <div className="productPreviewThumbs">
                    {previewMediaItems.slice(0, 6).map((item) => (
                      <span
                        className={"productPreviewThumb " + (item.localId === previewHeroMedia?.localId ? "productPreviewThumbActive" : "")}
                        key={item.localId}
                      >
                        {hasRenderableMediaPreview(item) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mediaPreviewSrc(item)} alt={item.alt[locale] ?? item.fileName} onError={() => markMediaPreviewBroken(item.localId)} />
                        ) : (
                          <span>{item.fileName.slice(0, 2).toUpperCase()}</span>
                        )}
                      </span>
                    ))}
                  </div>
                ) : null}

                {previewVariantChoices.length > 1 ? (
                  <section className="productPreviewVariantTiles" aria-label="Variantes activas">
                    <span>Variantes activas</span>
                    <div>
                      {previewVariantChoices.map((variant) => {
                        const variantMedia = assignedMediaForVariant(variant.localId)[0];
                        const variantSelected = variant.localId === previewVariantKeyResolved;
                        return (
                          <button
                            aria-label={variant.selectorLabel}
                            aria-pressed={variantSelected}
                            className={"productPreviewVariantTile " + (variantSelected ? "productPreviewVariantTileActive" : "")}
                            key={variant.localId}
                            title={variant.selectorLabel}
                            type="button"
                            onClick={() => setPreviewVariantKey(variant.localId)}
                          >
                            <span>
                              {hasRenderableMediaPreview(variantMedia) ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={mediaPreviewSrc(variantMedia)}
                                  alt={variantMedia.alt[locale] ?? variantMedia.fileName}
                                  onError={() => markMediaPreviewBroken(variantMedia.localId)}
                                />
                              ) : (
                                <span>{variant.name.slice(0, 2).toUpperCase() || variant.refId.slice(0, 2).toUpperCase() || "VA"}</span>
                              )}
                            </span>
                            <small>{variant.name || variant.refId || variant.displayLabel}</small>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ) : null}
              </section>

              <section className="productPreviewInfoPane">
                <div className="productPreviewBrandRow">
                  <span>{draft.basic.brandName || "Sin marca"}</span>
                  <span className={"adminBadge " + (previewIsAvailable ? "adminBadgeOk" : "adminBadgeWarn")}>
                    {previewIsAvailable ? "Disponible" : "Sin stock"}
                  </span>
                </div>
                <h3>{draft.basic.name || "Producto sin nombre"}</h3>
                <RichTextPreview
                  className="productPreviewSummary"
                  emptyLabel="Sin descripcion corta"
                  html={draft.basic.shortDescription}
                />

                <label className="adminField productPreviewVariantSelect">
                  <span>Variante</span>
                  <select value={previewVariantKeyResolved} onChange={(event) => setPreviewVariantKey(event.target.value)}>
                    {previewVariantChoices.map((variant) => (
                      <option key={variant.localId} value={variant.localId}>
                        {variant.selectorLabel}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="productPreviewPriceBlock">
                  <strong>{formatMoney(previewEffectivePrice?.basePriceMinor, previewEffectivePrice?.currency || currency)}</strong>
                  {previewEffectivePrice?.listPriceMinor ? (
                    <span>{formatMoney(previewEffectivePrice.listPriceMinor, previewEffectivePrice.currency || currency)}</span>
                  ) : null}
                </div>

                <dl className="productPreviewMetaGrid">
                  <div><dt>Referencia</dt><dd>{previewVariant?.refId || draft.defaultVariant.refId || "-"}</dd></div>
                  <div><dt>EAN</dt><dd>{previewVariant?.ean || "-"}</dd></div>
                  <div><dt>Stock</dt><dd>{previewAvailableQuantity}</dd></div>
                  <div><dt>Impuesto</dt><dd>{previewTax?.label ?? previewTax?.name ?? previewEffectivePrice?.taxCode ?? draft.basic.taxCode}</dd></div>
                </dl>

                {previewOptions.length ? (
                  <section className="productPreviewSection">
                    <h4>Combinacion</h4>
                    <div className="productPreviewOptionList">
                      {previewOptions.map((option) => (
                        <span key={option.attributeCode + ":" + option.valueCode}>
                          <strong>{option.attributeCode}</strong>
                          {option.valueCode}
                        </span>
                      ))}
                    </div>
                  </section>
                ) : null}

                {previewPriceBreakdown ? (
                  <section className="productPreviewSection">
                    <h4>Precio calculado</h4>
                    <dl className="productPreviewMetaGrid">
                      <div><dt>Neto</dt><dd>{formatMoney(previewPriceBreakdown.net, previewEffectivePrice?.currency || currency)}</dd></div>
                      <div><dt>Impuesto</dt><dd>{formatMoney(previewPriceBreakdown.tax, previewEffectivePrice?.currency || currency)}</dd></div>
                      <div><dt>Total</dt><dd>{formatMoney(previewPriceBreakdown.gross, previewEffectivePrice?.currency || currency)}</dd></div>
                    </dl>
                  </section>
                ) : null}

                <section className="productPreviewSection">
                  <h4>Servicios y disponibilidad</h4>
                  {previewOfferings.length ? (
                    <div className="productPreviewOfferingList">
                      {previewOfferings.map((offering) => (
                        <span className={offering.active ? "" : "productPreviewMuted"} key={offering.offeringId}>
                          {offering.name}
                          <small>{formatMoney(offering.priceMinor, offering.currency)}</small>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="productPreviewEmpty">Sin servicios adicionales para esta variante.</p>
                  )}
                </section>

                <section className="productPreviewSection">
                  <h4>Detalles</h4>
                  <RichTextPreview
                    className="productPreviewDescription"
                    emptyLabel="Sin descripcion extendida."
                    html={draft.basic.description}
                  />
                </section>

                <section className="productPreviewSection">
                  <h4>Envio</h4>
                  <dl className="productPreviewShippingGrid">
                    <div><dt>Peso</dt><dd>{draft.shipping.package.weightGrams ? String(draft.shipping.package.weightGrams) + " g" : "-"}</dd></div>
                    <div><dt>Ancho</dt><dd>{draft.shipping.package.widthMm ? String(draft.shipping.package.widthMm) + " mm" : "-"}</dd></div>
                    <div><dt>Alto</dt><dd>{draft.shipping.package.heightMm ? String(draft.shipping.package.heightMm) + " mm" : "-"}</dd></div>
                    <div><dt>Fondo</dt><dd>{draft.shipping.package.depthMm ? String(draft.shipping.package.depthMm) + " mm" : "-"}</dd></div>
                  </dl>
                </section>
              </section>
            </div>
          </aside>
        </div>
      ) : null}

      {savingActive ? (
        <div className="productSavingOverlay" role="status" aria-live="assertive">
          <div className="productSavingDialog">
            <span className="adminSpinner productSavingRing" aria-hidden="true" />
            <strong>Guardando producto</strong>
              <span>Catalog, variantes, imagenes, pricing, inventario y transporte se procesan por bloques.</span>
            <div className="productSavingSteps">
              <span>Catalog</span>
              <span>Variantes</span>
              <span>Media</span>
              <span>Pricing</span>
              <span>Inventario</span>
              <span>Transporte</span>
              <span>Publicacion</span>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="productEditorFooter">
        <div className="productSaveBlocks">
          {Object.entries(draft.saveState).map(([block, status]) => (
            <span className={`adminBadge ${statusClass(status)}`} key={block}>
              {block}: {statusLabel(status)}
            </span>
          ))}
        </div>
        <div className="adminButtonRow">
          <button className="adminButton" type="button" onClick={openProductPreview}>
            <Eye aria-hidden="true" size={16} />
            Vista previa
          </button>
          <span className={`adminBadge ${draft.basic.isActive ? "adminBadgeOk" : "adminBadgeWarn"}`}>{productStatus}</span>
          <button className="adminButton adminButtonPrimary" type="button" disabled={savingActive} onClick={saveDraft}>
            {savingActive ? <span className="adminSpinner adminSpinnerInline" aria-hidden="true" /> : null}
            {savingActive ? "Guardando producto" : "Guardar producto"}
          </button>
          <button className="adminButton" type="button">Duplicar</button>
          <Link className="adminButton" href="/admin/products">Ir al catalogo</Link>
          <Link className="adminButton" href="/admin/products/new">Anadir nuevo producto</Link>
        </div>
      </footer>
    </main>
  );
}

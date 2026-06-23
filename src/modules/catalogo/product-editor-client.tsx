"use client";

import Link from "next/link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered, Plus, Redo2, RemoveFormatting, Strikethrough, Trash2, Undo2 } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  createAndAttachOfferingAction,
  createProductBrandInlineAction,
  createProductCategoryInlineAction,
  detachOfferingFromVariantAction,
  saveProductDraftAction,
  setOfferingVariantActivationAction,
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
  ProductDraft,
  ProductDraftMediaItem,
  ProductDraftVariant,
  ProductEditorLookups,
  ProductLookupOption,
  ProductSaveReport,
  ProductTaxLookupOption,
  SaveBlockStatus,
  StockDraft,
} from "./product-editor-types";
import { getProductPublicationChecklist, validateProductDraft } from "./product-editor-validation";

type ProductEditorClientProps = {
  contextIdentity: string;
  initialDraft: ProductDraft;
  locale: string;
  currency: string;
  lookups?: ProductEditorLookups;
};

type ProductEditorClientInnerProps = Omit<ProductEditorClientProps, "contextIdentity"> & {
  storageKey: string;
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
  };

  return labels[status];
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
  if (status === "running" || status === "pending") {
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
    if (stored && stored.productId !== initialDraft.productId) {
      return null;
    }

    return stored ? mergeStoredProductDraft(initialDraft, stored) : null;
  } catch {
    return null;
  }
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
  locale,
  currency,
  lookups = { categories: [], brands: [], taxes: [], priceTables: [], warnings: [] },
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
      locale={locale}
      currency={currency}
      lookups={lookups}
      storageKey={storageKey}
    />
  );
}

function ProductEditorClientInner({
  initialDraft,
  locale,
  currency,
  lookups = { categories: [], brands: [], taxes: [], priceTables: [], warnings: [] },
  storageKey,
}: ProductEditorClientInnerProps) {
  const [draft, setDraft] = useState<ProductDraft>(initialDraft);
  const [storedDraft, setStoredDraft] = useState<ProductDraft | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("basic");
  const [dirty, setDirty] = useState(false);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(draft.media.items[0]?.localId ?? null);
  const [selectedVariantKey, setSelectedVariantKey] = useState<string>("default");
  const [filesByLocalId, setFilesByLocalId] = useState<Record<string, File>>({});
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
  const savingActive = isSaving || isPending;
  const selectedMedia = draft.media.items.find((item) => item.localId === selectedMediaId) ?? draft.media.items[0];
  const productStatus = draft.basic.isActive ? "Activo" : "Fuera de linea";
  const allVariantRows = useMemo(() => [
    {
      localId: "default",
      variantId: draft.defaultVariantId,
      name: (draft.defaultVariant.name ?? draft.basic.name) || "Variante predeterminada",
      refId: draft.defaultVariant.refId,
      ean: draft.defaultVariant.ean ?? null,
      options: [],
      isActive: draft.basic.isActive,
      isVisible: draft.basic.isVisible,
      isDefault: true,
    },
    ...draft.variants.map((variant) => ({ ...variant, isDefault: false })),
  ], [draft]);
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
  const pricingTaxWarning = lookups.warnings.find((warning) => warning.startsWith("Pricing taxes:"));
  const pricingTablesWarning = lookups.warnings.find((warning) => warning.startsWith("Pricing price tables:"));
  const currentPricePreview = pricePreview(productPrice, selectedTax);
  const priceVariantRows = draft.variants;
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
  const selectedVariantAssignments = draft.media.assignments[selectedVariant.localId] ?? [];
  const selectedVariantMain = draft.media.mainByVariant[selectedVariant.localId];
  const publicationChecklist = useMemo(() => getProductPublicationChecklist(draft), [draft]);
  const publicationReady = publicationChecklist.every((item) => item.ok);
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

  function updateDraft(updater: (current: ProductDraft) => ProductDraft) {
    setDraft((current) => updater(current));
    setDirty(true);
  }

  function hasRenderableMediaPreview(item: ProductDraftMediaItem | undefined) {
    return Boolean(item?.previewUrl && !brokenMediaPreviewIds[item.localId]);
  }

  function markMediaPreviewBroken(localId: string) {
    setBrokenMediaPreviewIds((current) => ({ ...current, [localId]: true }));
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
              refId: makeRefIdFromName(value),
            },
          };
        }
      }

      return {
        ...current,
        basic: nextBasic,
      };
    });
  }

  function addFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (!files.length) {
      return;
    }

    updateDraft((current) => {
      const hasMain = current.media.items.some((item) => item.isMain);
      const newItems = files.map((file, index) =>
        makeProductMediaItem({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          productName: current.basic.name,
          locale,
          index: current.media.items.length + index,
          previewUrl: URL.createObjectURL(file),
          isMain: !hasMain && index === 0,
        }),
      );

      setFilesByLocalId((currentFiles) => {
        const nextFiles = { ...currentFiles };
        newItems.forEach((item, index) => {
          nextFiles[item.localId] = files[index];
        });
        return nextFiles;
      });
      setSelectedMediaId(newItems[0]?.localId ?? selectedMediaId);

      return {
        ...current,
        media: {
          ...current.media,
          items: [...current.media.items, ...newItems],
        },
      };
    });
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

  function toggleVariantMedia(variantKey: string, mediaLocalId: string) {
    updateDraft((current) => {
      const currentAssignments = current.media.assignments[variantKey] ?? [];
      const assigned = currentAssignments.includes(mediaLocalId)
        ? currentAssignments.filter((localId) => localId !== mediaLocalId)
        : [...currentAssignments, mediaLocalId];
      const nextMain = assigned.includes(current.media.mainByVariant[variantKey])
        ? current.media.mainByVariant[variantKey]
        : assigned[0];

      return {
        ...current,
        media: {
          ...current.media,
          assignments: {
            ...current.media.assignments,
            [variantKey]: assigned,
          },
          mainByVariant: {
            ...current.media.mainByVariant,
            ...(nextMain ? { [variantKey]: nextMain } : {}),
          },
        },
      };
    });
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
          [variantKey]: Array.from(new Set([...(current.media.assignments[variantKey] ?? []), mediaLocalId])),
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
        },
        messages: [
          errors.length
            ? `No se guardo. Revisa: ${errors.map((error) => error.label).join(", ")}.`
            : "No se guardo. Revisa los datos del formulario.",
        ],
        fieldErrors: validation.fieldErrors,
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

    const formData = new FormData();
    formData.set("draft", JSON.stringify(sanitizeDraftForStorage(draft)));
    draft.media.items.forEach((item) => {
      const file = filesByLocalId[item.localId];
      if (file && !item.persisted && !item.mediaAssetId) {
        formData.append("fileLocalIds", item.localId);
        formData.append("files", file);
      }
    });

    setIsSaving(true);
    startTransition(async () => {
      try {
        const result = await saveProductDraftAction(formData);
        setReport(result);

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
          },
          messages: [error instanceof Error ? error.message : "No se pudo completar el guardado."],
          fieldErrors: {},
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
                  <label className="productMediaAdd" aria-label="Anadir imagenes">
                    <Plus aria-hidden="true" size={34} />
                    <span>Anadir imagenes</span>
                    <input className="productFileInput" type="file" accept="image/*" multiple onChange={(event) => addFiles(event.target.files)} />
                  </label>
                  {draft.media.items.map((item) => (
                    <div
                      className={`productMediaTile ${selectedMedia?.localId === item.localId ? "productMediaTileActive" : ""}`}
                      key={item.localId}
                    >
                      <button className="productMediaTileSelect" type="button" onClick={() => setSelectedMediaId(item.localId)}>
                        {hasRenderableMediaPreview(item) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.previewUrl} alt={item.alt[locale] ?? item.fileName} onError={() => markMediaPreviewBroken(item.localId)} />
                        ) : (
                          <span>{item.fileName}</span>
                        )}
                        {item.isMain ? <strong>Portada</strong> : null}
                        {!item.persisted ? <em>Pendiente de guardar</em> : null}
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
                  <h2>Product Variants</h2>
                  <p>Gestiona unidades vendibles con SKU, EAN, precio, stock, imagenes y estado propios.</p>
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
                  <p>Usalo solo cuando cada resultado generado sea una `ProductVariant` vendible.</p>
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
                  Generar ProductVariants
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
                      <th>ProductVariant</th>
                      <th>SKU / referencia</th>
                      <th>EAN</th>
                      <th>Precio</th>
                      <th>Stock</th>
                      <th>Configuracion</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.variants.length === 0 ? (
                      <tr>
                        <td colSpan={9}>Sin variantes adicionales. El producto usa la variante predeterminada.</td>
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
                                  src={assignedMediaForVariant(variant.localId)[0].previewUrl}
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
                              <input
                                aria-label={`Precio variante ${index + 1}`}
                                min="0"
                                step="0.01"
                                type="number"
                                value={centsToInput(variantPrice?.markedForDeletion ? undefined : variantPrice?.basePriceMinor)}
                                onChange={(event) => updateVariantPrice(variant.localId, event.target.value)}
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
                  <p>El precio superior pertenece al producto y a su productVariantDefault. Las variantes adicionales heredan salvo override propio.</p>
                </div>
              </div>
              <div className="pricingEditorContext">
                <span>Currency: <strong>{productPrice?.currency || currency}</strong></span>
                <span>Country: <strong>{productPrice?.country || "ES"}</strong></span>
                <span>Trade policy: <strong>{productPrice?.tradePolicy || "default"}</strong></span>
                <span>Channel: <strong>{productPrice?.channel || "web"}</strong></span>
                <span>Customer group: <strong>{productPrice?.customerGroup || "Todos"}</strong></span>
              </div>
              {lookups.warnings.filter((warning) => warning.startsWith("Pricing")).map((warning) => (
                <div className="adminBanner" key={warning}><p>{warning}</p></div>
              ))}
              <div className="adminFormGrid adminFormGridTwo">
                <label className="adminField">
                  <span>Precio del producto / defaultVariant</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={centsToInput(productPrice?.basePriceMinor)}
                    onChange={(event) => updateProductPriceField((price) => ({
                      ...price,
                      basePriceMinor: inputToCents(event.target.value),
                      currency: price.currency || currency,
                    }))}
                  />
                </label>
                <label className="adminField">
                  <span>Precio tachado del producto / defaultVariant</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={centsToInput(productPrice?.listPriceMinor ?? undefined)}
                    onChange={(event) => updateProductPriceField((price) => ({
                      ...price,
                      listPriceMinor: inputToCents(event.target.value) || null,
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
                  <span>priceTableId</span>
                  <select
                    value={productPrice?.priceTableId ?? ""}
                    onChange={(event) => updateProductPriceField((price) => ({
                      ...price,
                      priceTableId: event.target.value || null,
                    }))}
                  >
                    <option value="">Base/default</option>
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
                  <input
                    value={productPrice?.tradePolicy ?? "default"}
                    onChange={(event) => updateProductPriceField((price) => ({ ...price, tradePolicy: event.target.value }))}
                  />
                </label>
                <label className="adminField">
                  <span>channel</span>
                  <input
                    value={productPrice?.channel ?? "web"}
                    onChange={(event) => updateProductPriceField((price) => ({ ...price, channel: event.target.value }))}
                  />
                </label>
                <label className="adminField">
                  <span>country</span>
                  <input
                    value={productPrice?.country ?? "ES"}
                    onChange={(event) => updateProductPriceField((price) => ({ ...price, country: event.target.value }))}
                  />
                </label>
                <label className="adminField">
                  <span>customerGroup</span>
                  <input
                    value={productPrice?.customerGroup ?? ""}
                    placeholder="Todos"
                    onChange={(event) => updateProductPriceField((price) => ({ ...price, customerGroup: event.target.value || null }))}
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
                    <input
                      disabled={!selectedPriceVariant}
                      min="0"
                      step="0.01"
                      type="number"
                      value={centsToInput(selectedVariantPrice?.markedForDeletion ? undefined : selectedVariantPrice?.basePriceMinor)}
                      onChange={(event) => selectedPriceVariant ? updateVariantPrice(selectedPriceVariant.localId, event.target.value) : undefined}
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
                      <option value="">Base/default</option>
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
                            <div>{variantTax?.label ?? "Sin regla fiscal"}</div>
                            <div className="adminContextHint">{variantPriceTable ?? "Base/default"}</div>
                          </td>
                          <td>
                            <button
                              className="adminButton"
                              type="button"
                              onClick={() => setSelectedVariantKey(variant.localId)}
                            >
                              Editar
                            </button>
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
                        {variant.isDefault ? "Default - " : ""}{variant.refId || variant.name}
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
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    value={offeringForm.price}
                    onChange={(event) => setOfferingForm((current) => ({ ...current, price: event.target.value }))}
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
                      <th>Stock default</th>
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
                            <strong>{draft.defaultVariant.refId || "Default"}</strong>
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
                          <td colSpan={9}>Sin variantes adicionales. Usa el stock default del producto simple.</td>
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
                              {!hasOwnStock ? <small>Usa stock default</small> : null}
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
                      <span>Disponible default</span>
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
              <h2>Transporte</h2>
              <div className="adminEmptyState">Peso, dimensiones y reglas logisticas quedan pendientes para la fachada Shipping del producto.</div>
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
                  src={assignedMediaForVariant("default")[0].previewUrl}
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
                      {variant.isDefault ? "Default - " : ""}{variant.refId || variant.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="productVariantMediaPicker">
                {draft.media.items.length === 0 ? (
                  <div className="adminEmptyState">Sube imagenes en la pestana Imagenes para asignarlas a una variante.</div>
                ) : draft.media.items.map((item) => {
                  const checked = selectedVariantAssignments.includes(item.localId);
                  const isMain = selectedVariantMain === item.localId;
                  const fieldError = report?.fieldErrors[`media:${selectedVariant.localId}`];
                  return (
                    <div className={`productVariantMediaItem ${checked ? "productVariantMediaItemSelected" : ""}`} key={item.localId}>
                      <button type="button" onClick={() => toggleVariantMedia(selectedVariant.localId, item.localId)}>
                        {hasRenderableMediaPreview(item) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.previewUrl} alt={item.alt[locale] ?? item.fileName} onError={() => markMediaPreviewBroken(item.localId)} />
                        ) : (
                          <span>{item.fileName}</span>
                        )}
                      </button>
                      <label className="adminCheckbox">
                        <input checked={checked} type="checkbox" onChange={() => toggleVariantMedia(selectedVariant.localId, item.localId)} />
                        Asignada
                      </label>
                      <label className="adminCheckbox">
                        <input checked={isMain} disabled={!checked} type="radio" onChange={() => setVariantMainMedia(selectedVariant.localId, item.localId)} />
                        Portada
                      </label>
                      {fieldError && checked ? <small>{fieldError}</small> : null}
                    </div>
                  );
                })}
              </div>
              <button className="adminButton adminSection" type="button" onClick={() => clearVariantMedia(selectedVariant.localId)}>
                Limpiar imagenes y heredar default
              </button>
            </section>
          ) : null}
        </aside>
      </div>

      {savingActive ? (
        <div className="productSavingOverlay" role="status" aria-live="assertive">
          <div className="productSavingDialog">
            <span className="adminSpinner productSavingRing" aria-hidden="true" />
            <strong>Guardando producto</strong>
            <span>Catalog, variantes, imagenes, pricing e inventario se procesan por bloques.</span>
            <div className="productSavingSteps">
              <span>Catalog</span>
              <span>Variantes</span>
              <span>Media</span>
              <span>Pricing</span>
              <span>Inventario</span>
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
          <button className="adminButton" type="button">Vista previa</button>
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

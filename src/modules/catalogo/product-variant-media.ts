import type { ProductDraft, ProductDraftMediaItem } from "./product-editor-types";

function variantKey(draft: ProductDraft, key: string) {
  if (key === "default" || key === draft.defaultVariantId) return "default";
  return draft.variants.find((variant) => variant.localId === key || variant.variantId === key)?.localId ?? key;
}

export function productCover(draft: ProductDraft) {
  return draft.media.items.find((item) => item.isMain && item.active);
}

export function ownVariantImage(draft: ProductDraft, key: string) {
  const canonical = variantKey(draft, key);
  if (canonical === "default") return productCover(draft);
  const variant = draft.variants.find((item) => item.localId === canonical);
  const ids = draft.media.assignments[canonical] ?? (variant?.variantId ? draft.media.assignments[variant.variantId] : []) ?? [];
  const main = draft.media.mainByVariant[canonical] ?? (variant?.variantId ? draft.media.mainByVariant[variant.variantId] : undefined);
  const candidates = ids.map((id) => draft.media.items.find((item) => item.localId === id || item.mediaAssetId === id)).filter((item): item is ProductDraftMediaItem => Boolean(item?.active));
  return candidates.find((item) => item.localId === main || item.mediaAssetId === main) ?? candidates[0];
}

export function effectiveVariantImage(draft: ProductDraft, key: string) {
  return ownVariantImage(draft, key) ?? productCover(draft);
}

// Persist inheritance as an empty override, never as a copied cover assignment.
export function normalizeVariantMedia(draft: ProductDraft): ProductDraft {
  const firstCover = draft.media.items.find((item) => item.isMain);
  const items = draft.media.items.map((item) => item.isMain && item !== firstCover ? { ...item, isMain: false, metadataDirty: true } : item);
  const next = { ...draft, media: { ...draft.media, items } };
  const assignments: Record<string, string[]> = {};
  const mainByVariant: Record<string, string> = {};
  for (const key of new Set(["default", ...Object.keys(draft.media.assignments), ...Object.keys(draft.media.mainByVariant)])) {
    const canonical = variantKey(next, key);
    const image = ownVariantImage(next, canonical);
    assignments[canonical] = image ? [image.localId] : [];
    if (image) mainByVariant[canonical] = image.localId;
  }
  return { ...next, media: { ...next.media, assignments, mainByVariant } };
}

export function assignVariantImage(draft: ProductDraft, key: string, imageId?: string): ProductDraft {
  const canonical = variantKey(draft, key);
  const image = draft.media.items.find((item) => item.localId === imageId && item.active);
  if (imageId && !image) return draft;
  if (canonical === "default") {
    return normalizeVariantMedia({ ...draft, media: { ...draft.media, items: draft.media.items.map((item) => ({ ...item, isMain: item.localId === image?.localId, metadataDirty: item.metadataDirty || item.isMain !== (item.localId === image?.localId) })) } });
  }
  const normalized = normalizeVariantMedia(draft);
  const mainByVariant = { ...normalized.media.mainByVariant };
  if (image) mainByVariant[canonical] = image.localId;
  else delete mainByVariant[canonical];
  return { ...normalized, media: { ...normalized.media, assignments: { ...normalized.media.assignments, [canonical]: image ? [image.localId] : [] }, mainByVariant } };
}

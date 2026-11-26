export type ProductDraftIdentity = {
  productId?: string | null;
  defaultVariantId?: string | null;
  mediaCollectionId?: string | null;
};
/** A remote upload session can complete a new draft, never retarget an existing product. */
export function remoteProductIdentityMatches(
  current: ProductDraftIdentity,
  remote: ProductDraftIdentity,
) {
  return (
    ["productId", "defaultVariantId", "mediaCollectionId"] as const
  ).every(
    (key) => !current[key] || !remote[key] || current[key] === remote[key],
  );
}

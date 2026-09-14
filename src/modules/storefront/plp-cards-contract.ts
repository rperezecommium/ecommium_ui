// Contrato compacto opt-in; los errores se traducen por requestStorefrontBff.
export function parsePlpCardsPayload(value: unknown, expected: { categorySlug: string; limit: number; offset: number; currency?: string | null }): unknown {
  const bad = (): never => { throw new Error("PLP_CARDS_INVALID_RESPONSE"); };
  if (!value || typeof value !== "object" || Array.isArray(value)) return bad();
  const p = value as Record<string, unknown>;
  if (p.view !== "cards" || p.categorySlug !== expected.categorySlug || p.limit !== expected.limit || p.offset !== expected.offset ||
      !Number.isSafeInteger(p.total) || (p.total as number) < 0 || !Array.isArray(p.products) ||
      p.products.length !== Math.min(expected.limit, Math.max(0, (p.total as number) - expected.offset))) return bad();
  const ids = new Set<string>();
  for (const item of p.products) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return bad();
    const c = item as Record<string, unknown>;
    if (!["productId", "selectedVariantId", "name", "slug"].every(k => typeof c[k] === "string" && (c[k] as string).length > 0) ||
        typeof c.brand !== "string" || typeof c.isAvailable !== "boolean" || ids.has(c.productId as string)) return bad();
    ids.add(c.productId as string);
    if (c.productUrlPath !== `/pdp/${encodeURIComponent(c.slug as string)}`) return bad();
    if (c.image !== null) {
      const image = c.image as Record<string, unknown> | undefined;
      if (!image || typeof image.url !== "string" || !/^https?:\/\//.test(image.url) || typeof image.altText !== "string") return bad();
    }
    if (c.price !== null) {
      const price = c.price as Record<string, unknown> | undefined;
      if (!price || price.currency !== expected.currency || !Number.isSafeInteger(price.currentAmountMinor) || (price.currentAmountMinor as number) < 0 ||
          (price.previousAmountMinor !== null && (!Number.isSafeInteger(price.previousAmountMinor) || (price.previousAmountMinor as number) < 0))) return bad();
    }
  }
  return value;
}

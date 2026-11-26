/** Explicit server-side policy selection for one canonical storefront deployment.
 * Never inferred from a price, customer group, locale or Shop regional defaults.
 */
export function withStorefrontCommercialPolicy(path: string, environment: Record<string, string | undefined> = process.env): string {
  const policy = environment.ECOMMIUM_STOREFRONT_TRADE_POLICY?.trim();
  if (!policy) return path;
  const organizationId = environment.ECOMMIUM_STOREFRONT_ORGANIZATION_ID?.trim();
  const shopId = environment.ECOMMIUM_STOREFRONT_SHOP_ID?.trim();
  if (!organizationId || !shopId || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(policy)) {
    throw new Error("La política comercial Storefront requiere configuración explícita y Organization/Shop canónicos.");
  }
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Ruta BFF relativa requerida.");
  const url = new URL(path, "http://storefront.internal");
  if (!/^\/(?:storefront\/(?:pdp|plp|page|search|checkout\/context)(?:\/|$)|orderforms(?:\/|$)|payments\/transactions(?:\/|$)|orders(?:\/|$))/.test(url.pathname)) return path;
  if (url.searchParams.get("organizationId") !== organizationId || url.searchParams.get("shopId") !== shopId) return path;
  const selected = url.searchParams.get("tradePolicy");
  if (selected && selected !== policy) throw new Error("La política solicitada no coincide con la seleccionada para esta tienda.");
  url.searchParams.set("tradePolicy", policy);
  return url.pathname + url.search;
}

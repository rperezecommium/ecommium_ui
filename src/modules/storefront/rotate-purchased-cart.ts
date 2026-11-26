/** Move the current cart pointer; the purchased snapshot is an immutable audit fact. */
export async function rotatePurchasedCart(orderFormId: string, guestSessionId?: string, request: typeof fetch = fetch): Promise<unknown> {
  const params = new URLSearchParams({ forceNewCart: "true" });
  if (guestSessionId) params.set("guestSessionId", guestSessionId);
  const response = await request(`/api/storefront/cart?${params.toString()}`, {cache:"no-store",credentials:"same-origin"});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("No pudimos preparar un carrito nuevo después de la compra.");
  const next = payload?.orderform;
  if (!next || typeof next.orderFormId !== "string" || !next.orderFormId || next.orderFormId === orderFormId || !Array.isArray(next.items) || next.items.length !== 0) {
    throw new Error("Checkout no confirmó un carrito nuevo y vacío.");
  }
  return payload;
}

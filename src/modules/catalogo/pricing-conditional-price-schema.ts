export function conditionalPricePayload(form: FormData) {
  const text = (key: string, required = false) => {
    const value = form.get(key);
    if (typeof value !== "string" || value.length > 200) throw Error(`Revisa ${key}.`);
    if (required && !value.trim()) throw Error(`Completa ${key}.`);
    return value.trim();
  };
  const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  const productId = text("productId", true), variantId = text("variantId");
  if (!uuid(productId) || (variantId && !uuid(variantId))) throw Error("Indica IDs válidos de producto y variante.");
  const amount = Number(text("amountMinor", true)), priority = Number(text("priority", true));
  if (!Number.isSafeInteger(amount) || amount < 0 || !Number.isSafeInteger(priority)) throw Error("Importe y prioridad deben ser enteros válidos; el importe no puede ser negativo.");
  const currency = text("currency", true).toUpperCase(), country = text("country").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency) || (country && !/^[A-Z]{2}$/.test(country))) throw Error("Revisa moneda y país.");
  const active = text("active");
  if (!["true", "false"].includes(active)) throw Error("Estado inválido.");
  return {
    productId, variantId: variantId || null, targetType: variantId ? "VARIANT" : "PRODUCT",
    priceTableId: text("priceTableId", true), currency,
    basePriceMinor: amount, fixedPriceMinor: amount, priority,
    source: "FIXED", priceKind: "SPECIFIC", taxIncluded: false, timezone: "UTC",
    active: active === "true", country: country || null,
    channel: text("channel") || null, tradePolicy: text("tradePolicy") || null,
    customerGroup: text("customerGroup") || null,
  };
}

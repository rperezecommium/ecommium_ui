export type RemovalKind = "taxes" | "price-tables";
export type RemovalAmount = {
  currency: string;
  netAmountMinor: number;
  taxAmountMinor: number;
  grossAmountMinor: number;
  taxIncluded: boolean;
};
export type RemovalReview = {
  impactVersion: string;
  affectedPrices: number;
  offset: number;
  canConfirm: boolean;
  blockers: string[];
  options: Array<{ code: string; name: string }>;
  rows: Array<{
    pricingId: string;
    productId: string;
    variantId: string | null;
    currency: string;
    active: boolean;
    before: RemovalAmount;
    after: RemovalAmount | null;
    destinationBefore: RemovalAmount | null;
    retainedContextAfter: RemovalAmount | null;
    context: {
      atIsoDateTime: string;
      quantity: number;
      country: string | null;
      channel: string | null;
      tradePolicy: string | null;
      customerGroup: string | null;
    } | null;
  }>;
};
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Respuesta no válida.");
  return value as Record<string, unknown>;
}
function text(value: unknown): value is string {
  return (
    typeof value === "string" && value.trim().length > 0 && value.length <= 500
  );
}
function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function amount(value: unknown, currency: string): RemovalAmount {
  const row = object(value);
  if (
    row.currency !== currency ||
    typeof row.taxIncluded !== "boolean" ||
    ![row.netAmountMinor, row.taxAmountMinor, row.grossAmountMinor].every(
      count,
    ) ||
    (row.netAmountMinor as number) + (row.taxAmountMinor as number) !==
      row.grossAmountMinor
  )
    throw Error("Importes de revisión no válidos.");
  return row as RemovalAmount;
}
export function parseRemovalReview(raw: unknown): RemovalReview {
  const value = object(raw);
  const offset = value.offset ?? 0;
  if (!count(offset)) throw Error("Paginación no válida.");
  if (
    typeof value.impactVersion !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.impactVersion) ||
    !count(value.affectedPrices) ||
    typeof value.canConfirm !== "boolean" ||
    !Array.isArray(value.blockers) ||
    !value.blockers.every(text) ||
    !Array.isArray(value.options) ||
    !Array.isArray(value.rows) ||
    value.rows.length > 50 ||
    value.rows.length > value.affectedPrices ||
    (value.canConfirm && value.blockers.length)
  )
    throw Error("Revisión no válida.");
  const options = value.options.map((raw) => {
    const option = object(raw);
    if (!text(option.code) || !text(option.name))
      throw Error("Sustituto no válido.");
    return { code: option.code, name: option.name };
  });
  if (new Set(options.map((option) => option.code)).size !== options.length)
    throw Error("Sustitutos duplicados.");
  const rows = value.rows.map((raw) => {
    const row = object(raw);
    if (
      !text(row.pricingId) ||
      !text(row.productId) ||
      (row.variantId !== null && !text(row.variantId)) ||
      typeof row.currency !== "string" ||
      !/^[A-Z]{3}$/.test(row.currency) ||
      typeof row.active !== "boolean"
    )
      throw Error("Precio de revisión no válido.");
    const context = row.context == null ? null : object(row.context);
    if (
      context &&
      (typeof context.atIsoDateTime !== "string" ||
        !Number.isFinite(Date.parse(context.atIsoDateTime)) ||
        !count(context.quantity) ||
        context.quantity === 0 ||
        ["country", "channel", "tradePolicy", "customerGroup"].some(
          (key) => context[key] !== null && !text(context[key]),
        ))
    )
      throw Error("Contexto de revisión no válido.");
    return {
      pricingId: row.pricingId,
      productId: row.productId,
      variantId: row.variantId,
      currency: row.currency,
      active: row.active,
      before: amount(row.before, row.currency),
      after: row.after === null ? null : amount(row.after, row.currency),
      destinationBefore:
        row.destinationBefore == null
          ? null
          : amount(row.destinationBefore, row.currency),
      retainedContextAfter:
        row.retainedContextAfter == null
          ? null
          : amount(row.retainedContextAfter, row.currency),
      context: context as RemovalReview["rows"][number]["context"],
    };
  });
  return {
    impactVersion: value.impactVersion,
    affectedPrices: value.affectedPrices,
    offset,
    canConfirm: value.canConfirm,
    blockers: value.blockers,
    options,
    rows,
  };
}
export type RemovalReceiptRequest = {
  kind: RemovalKind;
  code: string;
  impactVersion: string;
  replacementCode?: string;
};
export function parseRemovalReceiptRequest(
  raw: unknown,
): RemovalReceiptRequest {
  const value = object(raw);
  if (
    !["taxes", "price-tables"].includes(String(value.kind)) ||
    !text(value.code) ||
    value.code.length > 200 ||
    typeof value.impactVersion !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.impactVersion) ||
    (value.replacementCode !== undefined &&
      (!text(value.replacementCode) || value.replacementCode.length > 200))
  )
    throw Error("Operación no válida.");
  return {
    kind: value.kind as RemovalKind,
    code: value.code,
    impactVersion: value.impactVersion,
    replacementCode: value.replacementCode as string | undefined,
  };
}
export function parseRemovalReceipt(
  raw: unknown,
  expected: RemovalReceiptRequest,
  status = false,
) {
  const value = object(raw);
  if (
    value.reviewed !== true ||
    value.deleted !== true ||
    value.mode !== "hard" ||
    value.kind !== expected.kind ||
    value.code !== expected.code ||
    value.impactVersion !== expected.impactVersion ||
    value.replacementCode !== (expected.replacementCode ?? null) ||
    value.remainingAssignments !== 0 ||
    !count(value.affectedPrices) ||
    !(status ? ["PENDING", "COMPLETE"] : ["PENDING"]).includes(
      String(value.readStatus),
    ) ||
    (status &&
      (!count(value.contexts) ||
        (value.readStatus === "COMPLETE" && value.contexts === 0)))
  )
    throw Error("El recibo de eliminación no es válido.");
  return value;
}

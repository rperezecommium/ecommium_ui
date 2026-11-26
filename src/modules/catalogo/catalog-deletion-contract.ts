export type CatalogDeletionContext = {
  organizationId: string;
  shopId: string;
  locale: string;
};
export type CatalogDeletionTarget = CatalogDeletionContext & {
  productId: string;
  variantId?: string;
};
export type CatalogDeletionReview = {
  reviewId: string;
  version: string;
  expiresAt: string;
  refId: string;
  name: string;
  canDelete: boolean;
  participants: Array<{
    owner: string;
    blockers: string[];
    counts: Record<string, number>;
  }>;
};
export type CatalogDeletionOperation = {
  operationId: string;
  productId: string;
  variantId?: string;
  step: number;
  asynchronous?: boolean;
  status:
    | "PENDING"
    | "BLOCKED"
    | "ABORTING"
    | "ABORTED"
    | "RUNNING"
    | "RETRYABLE"
    | "AWAITING_PROJECTION"
    | "COMPLETED";
  error: string | null;
};
export const catalogDeletionId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
export function validCatalogDeletionTarget(t: CatalogDeletionTarget) {
  return Boolean(
    t &&
    catalogDeletionId(t.organizationId) &&
    catalogDeletionId(t.shopId) &&
    catalogDeletionId(t.productId) &&
    (!t.variantId || catalogDeletionId(t.variantId)) &&
    typeof t.locale === "string" &&
    /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(t.locale),
  );
}
function record(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw Error("INVALID_DELETION_RESPONSE");
  return v as Record<string, unknown>;
}
function identity(v: unknown, expected: CatalogDeletionTarget) {
  const t = record(v);
  if (
    t.productId !== expected.productId ||
    (t.variantId ?? undefined) !== expected.variantId ||
    t.organizationId !== expected.organizationId ||
    t.shopId !== expected.shopId ||
    t.kind !== (expected.variantId ? "variant" : "product")
  )
    throw Error("DELETION_IDENTITY_MISMATCH");
  return t;
}
export function parseCatalogDeletionReview(
  v: unknown,
  expected: CatalogDeletionTarget,
): CatalogDeletionReview {
  const r = record(v),
    t = identity(r.target, expected),
    p = record(r.participants);
  if (
    !catalogDeletionId(r.reviewId) ||
    typeof r.version !== "string" ||
    !/^[0-9a-f]{64}$/.test(r.version) ||
    typeof r.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(r.expiresAt)) ||
    typeof t.refId !== "string" ||
    !t.refId ||
    typeof t.name !== "string" ||
    typeof r.canDelete !== "boolean"
  )
    throw Error("INVALID_DELETION_REVIEW");
  const participants = [
    "inventory",
    "pricing",
    "routing-seo",
    "media",
    "cms",
    "search",
  ].map((owner) => {
    const i = record(p[owner]);
    const counts = record(i.counts);
    if (
      typeof i.version !== "string" ||
      !i.version ||
      !Array.isArray(i.blockers) ||
      i.blockers.some((b) => typeof b !== "string") ||
      Object.values(counts).some(
        (n) => typeof n !== "number" || !Number.isSafeInteger(n) || n < 0,
      )
    )
      throw Error("INVALID_DELETION_IMPACT");
    return {
      owner,
      blockers: i.blockers as string[],
      counts: counts as Record<string, number>,
    };
  });
  if (r.canDelete !== participants.every((p) => !p.blockers.length))
    throw Error("INVALID_DELETION_CAPABILITY");
  return {
    reviewId: r.reviewId,
    version: r.version,
    expiresAt: r.expiresAt,
    refId: t.refId,
    name: t.name,
    canDelete: r.canDelete,
    participants,
  };
}
export function parseCatalogDeletionOperation(
  v: unknown,
  expected: CatalogDeletionTarget,
  operationId?: string,
): CatalogDeletionOperation {
  const r = record(v);
  identity(r.target, expected);
  if (
    (r.asynchronous !== undefined && typeof r.asynchronous !== "boolean") ||
    !catalogDeletionId(r.operationId) ||
    (operationId && r.operationId !== operationId) ||
    !Number.isSafeInteger(r.step) ||
    Number(r.step) < 0 ||
    Number(r.step) > 15 ||
    ![
      "PENDING",
      "BLOCKED",
      "ABORTING",
      "ABORTED",
      "RUNNING",
      "RETRYABLE",
      "AWAITING_PROJECTION",
      "COMPLETED",
    ].includes(String(r.status)) ||
    (r.error !== null && typeof r.error !== "string") ||
    (r.status === "COMPLETED" && r.step !== 15)
  )
    throw Error("INVALID_DELETION_OPERATION");
  return {
    operationId: r.operationId,
    productId: expected.productId,
    variantId: expected.variantId,
    step: Number(r.step),
    asynchronous: r.asynchronous === true,
    status: r.status as CatalogDeletionOperation["status"],
    error: r.error as string | null,
  };
}

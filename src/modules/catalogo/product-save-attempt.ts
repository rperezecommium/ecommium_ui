import { sanitizeDraftForStorage } from "./product-editor-draft";
import type { ProductDraft, ProductSaveReport } from "./product-editor-types";

// A key identifies an immutable command, not the mutable editor draft.
export function productSaveSignature(draft: ProductDraft, publish: boolean) {
  const snapshot = sanitizeDraftForStorage(draft);
  return JSON.stringify({ ...snapshot, basic: { ...snapshot.basic, isActive: publish }, saveState: undefined });
}

export type ProductSaveAttempt = {
  key: string;
  signature: string;
  request: FormData;
  uncertain: boolean;
};

export function prepareProductSaveAttempt(
  previous: ProductSaveAttempt | null,
  signature: string,
  request: FormData,
  createKey: () => string,
): ProductSaveAttempt {
  if (previous?.signature === signature) return previous;
  if (previous?.uncertain) {
    throw new Error("El resultado del guardado anterior aún no está confirmado. Reintenta esa operación antes de enviar cambios nuevos.");
  }
  const key = createKey();
  request.set("idempotencyKey", key);
  return { key, signature, request, uncertain: true };
}

export function acknowledgeProductSaveAttempt(
  attempt: ProductSaveAttempt,
  report: ProductSaveReport,
  acknowledgedSignature: string,
): ProductSaveAttempt | null {
  if (report.ok || report.retryable === false) return null;
  // A transport error cannot acknowledge a new payload or a new operation.
  if (!report.operationId) return { ...attempt, uncertain: true };
  return { ...attempt, signature: acknowledgedSignature, uncertain: false };
}

export function applyProductSavePatch(current: ProductDraft, report: ProductSaveReport): ProductDraft {
  return {
    ...current,
    ...report.draftPatch,
    basic: { ...current.basic, ...report.draftPatch?.basic },
    media: report.draftPatch?.media ?? current.media,
    saveState: report.draftPatch?.saveState ?? current.saveState,
  };
}

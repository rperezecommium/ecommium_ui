"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestAdminBff } from "../../shared/bff/admin-client";
import { getAdminContext } from "../../shared/config/admin-context";

const PATCH_ACTIONS = new Set(["review", "approve", "reject", "receive-return", "resolve", "close"]);
const TASK_TYPES = new Set(["NEW_CASE", "CUSTOMER_MESSAGE", "EVIDENCE_REVIEW", "SOLUTION_PROPOSAL_REJECTED", "SOLUTION_PROPOSAL_ACCEPTED"]);
const TASK_STATUSES = new Set(["OPEN", "ASSIGNED"]);
const RESOLUTION_OUTCOMES = new Set(["REFUND", "EXCHANGE", "REPAIR", "REPLACEMENT", "STORE_CREDIT", "REJECTED", "NO_ACTION", "MIXED"]);
const CLOSURE_REASONS = new Set(["COMPLETED", "CANCELLED", "AUTO_TIMEOUT", "LEGACY_MIGRATION"]);
const SOLUTION_TYPES = new Set(["REFUND", "EXCHANGE", "REPAIR", "REPLACEMENT", "STORE_CREDIT", "NO_ACTION"]);
const RETURN_SHIPPING_PAYERS = new Set(["STORE", "CUSTOMER"]);
// El BFF recibe la prueba de cierre como JSON Base64. Limitamos el fichero
// antes de codificarlo para que la petición resultante no supere su límite.
const MAX_CLOSURE_PROOF_IMAGE_BYTES = 6 * 1024 * 1024;
const CLOSURE_PROOF_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNullableString(value: FormDataEntryValue | null) {
  const normalized = asString(value);
  return normalized === "__null__" ? null : normalized;
}

function optionalEnum(value: FormDataEntryValue | null, allowed: Set<string>, label: string) {
  const normalized = asString(value);
  if (!normalized) {
    return undefined;
  }
  if (!allowed.has(normalized)) {
    throw new Error(`${label} no es válido.`);
  }

  return normalized;
}

function requiredEnum(value: FormDataEntryValue | null, allowed: Set<string>, label: string) {
  const normalized = requiredString(value, label);
  if (!allowed.has(normalized)) {
    throw new Error(`${label} no es válido.`);
  }

  return normalized;
}

function requiredString(value: FormDataEntryValue | null, label: string) {
  const normalized = asString(value);
  if (!normalized) {
    throw new Error(`${label} requerido.`);
  }

  return normalized;
}

function optionalPositiveInteger(value: FormDataEntryValue | null, label: string) {
  const raw = asString(value);
  if (!raw) {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${label} debe ser un entero positivo.`);
  }

  return parsed;
}

/**
 * El BFF usa unidades menores, pero el formulario Admin acepta importes como
 * los escribiría una persona: 51,18 €, 51.18 o 1.234,50. No usamos Number
 * para evitar redondeos binarios antes de construir los céntimos.
 */
function optionalMoneyToMinor(value: FormDataEntryValue | null, label: string) {
  const raw = asString(value);
  if (!raw) return undefined;

  const compact = raw.replace(/[\s\u00a0]/g, "").replace(/€|EUR/gi, "");
  if (!compact || !/^[0-9.,]+$/.test(compact)) {
    throw new Error(`${label} debe tener un formato como 51,18 €.`);
  }

  const separators = compact.match(/[.,]/g) ?? [];
  let whole = compact;
  let fraction = "";
  if (separators.length > 0) {
    const comma = compact.lastIndexOf(",");
    const dot = compact.lastIndexOf(".");
    const decimalIndex = Math.max(comma, dot);
    const decimalSeparator = compact[decimalIndex];
    const before = compact.slice(0, decimalIndex);
    const after = compact.slice(decimalIndex + 1);
    const otherSeparator = decimalSeparator === "," ? "." : ",";
    const hasOtherSeparator = before.includes(otherSeparator);

    if (hasOtherSeparator) {
      const groups = before.split(otherSeparator);
      if (!groups.every((group, index) => /^\d{3}$/.test(group) || (index === 0 && /^\d{1,3}$/.test(group)))) {
        throw new Error(`${label} debe tener un formato como 1.234,50 €.`);
      }
      whole = groups.join("");
      fraction = after;
    } else if (separators.length === 1 && after.length <= 2) {
      whole = before;
      fraction = after;
    } else if (separators.length === 1 && decimalSeparator === "." && after.length === 3) {
      whole = `${before}${after}`;
    } else {
      throw new Error(`${label} debe usar como máximo dos decimales, por ejemplo 51,18 €.`);
    }
  }

  if (!/^\d+$/.test(whole) || (fraction && !/^\d{1,2}$/.test(fraction))) {
    throw new Error(`${label} debe tener un formato como 51,18 €.`);
  }

  const minor = Number(`${whole}${fraction.padEnd(2, "0")}`);
  if (!Number.isSafeInteger(minor) || minor < 0) {
    throw new Error(`${label} no es válido.`);
  }

  return minor;
}

function optionalCurrency(value: FormDataEntryValue | null) {
  const currency = asString(value)?.toUpperCase();
  if (!currency) return undefined;
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("La moneda debe usar código ISO de tres letras.");
  }

  return currency;
}

async function validateClosureProofImage(file: File): Promise<string | null> {
  if (!CLOSURE_PROOF_IMAGE_MIME_TYPES.has(file.type)) {
    return "Solo se admiten imágenes JPG, PNG o WebP.";
  }
  if (file.size > MAX_CLOSURE_PROOF_IMAGE_BYTES) {
    return "La imagen no puede superar 6 MB.";
  }
  if (!file.name || file.name.length > 160 || /[\u0000\r\n]/.test(file.name)) {
    return "El nombre de archivo no es válido.";
  }

  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const hasJpegSignature =
    signature.length >= 3 && signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
  const hasPngSignature =
    signature.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      .every((value, index) => signature[index] === value);
  const hasWebpSignature =
    signature.length >= 12 && String.fromCharCode(...signature.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...signature.slice(8, 12)) === "WEBP";

  const hasExpectedSignature =
    (file.type === "image/jpeg" && hasJpegSignature)
    || (file.type === "image/png" && hasPngSignature)
    || (file.type === "image/webp" && hasWebpSignature);

  return hasExpectedSignature ? null : "El contenido del archivo no coincide con una imagen permitida.";
}

async function fileToBase64(file: File) {
  return Buffer.from(await file.arrayBuffer()).toString("base64");
}

type ClosureProofInput = {
  note: string;
  evidence?: {
    contentBase64: string;
    mimeType: string;
    idempotencyKey: string;
  };
};

/**
 * El contrato BFF exige una nota interna para cada prueba de cierre. La imagen
 * es un complemento opcional y puede registrarse junto al cierre de solución
 * o, si hay un reintento, desde el caso ya resuelto.
 */
async function readClosureProofInput(
  formData: FormData,
  noteField: string,
  required: boolean,
): Promise<ClosureProofInput | undefined> {
  const note = asString(formData.get(noteField));
  const file = formData.get("evidence");
  const hasEvidence = file instanceof File && file.size > 0;

  if (file !== null && !(file instanceof File)) {
    throw new Error("La imagen adjunta no es válida.");
  }

  if (!note && !hasEvidence) {
    if (required) {
      throw new Error("Nota interna requerida para registrar la prueba de cierre.");
    }
    return undefined;
  }

  if (!note) {
    throw new Error("Describe internamente cómo se verificó la solución antes de adjuntar una imagen.");
  }
  if (note.length > 4_000) {
    throw new Error("La nota interna no puede superar 4.000 caracteres.");
  }

  if (!hasEvidence) {
    return { note };
  }

  const fileError = await validateClosureProofImage(file);
  if (fileError) {
    throw new Error(fileError);
  }

  return {
    note,
    evidence: {
      contentBase64: await fileToBase64(file),
      mimeType: file.type,
      idempotencyKey: asString(formData.get("evidenceIdempotencyKey")) ?? `admin-after-sales-closure-proof-image-${crypto.randomUUID()}`,
    },
  };
}

function scopedPath(path: string, organizationId: string, shopId: string) {
  return `${path}?${new URLSearchParams({ organizationId, shopId }).toString()}`;
}

function afterSalesReturnPath(
  message: string,
  caseId?: string,
  caseTab?: string,
  caseFocus?: string,
  noticeKind: "success" | "error" = "success",
) {
  const params = new URLSearchParams({ notice: message });
  if (noticeKind === "error") {
    params.set("noticeKind", "error");
  }
  if (caseId) {
    params.set("caseId", caseId);
  }
  if (caseTab) {
    params.set("caseTab", caseTab);
  }
  if (caseFocus) {
    params.set("caseFocus", caseFocus);
  }

  return `/admin/postventa?${params.toString()}`;
}

function jsonBody(fields: Record<string, unknown>) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined && value !== ""),
    ),
  );
}

function revalidateAfterSales() {
  revalidatePath("/admin/postventa");
  // El contador vive en el layout Admin. Al atender una tarea debe refrescarse
  // junto a la bandeja, sin esperar a una navegación posterior.
  revalidatePath("/admin", "layout");
}

async function mutateCase(
  caseId: string,
  pathSuffix: string,
  init: RequestInit,
  successMessage: string,
  caseTab?: string,
): Promise<never> {
  const context = await getAdminContext();
  const result = await requestAdminBff(
    scopedPath(`/admin/after-sales/cases/${encodeURIComponent(caseId)}/${pathSuffix}`, context.organizationId, context.shopId),
    { context, init },
  );

  revalidateAfterSales();
  if (!result.ok) {
    redirect(afterSalesReturnPath(result.status === 403 ? "Falta permiso after-sales.manage." : result.error, caseId, caseTab, undefined, "error"));
  }

  redirect(afterSalesReturnPath(successMessage, caseId, caseTab));
}

async function mutateTask(
  taskId: string,
  caseId: string,
  caseFocus?: "message" | "evidence",
  caseTab: "caso" | "propuesta" | "ejecucion" = "caso",
): Promise<never> {
  const context = await getAdminContext();
  const result = await requestAdminBff(
    scopedPath(`/admin/after-sales/tasks/${encodeURIComponent(taskId)}/attend`, context.organizationId, context.shopId),
    { context, init: { method: "POST" } },
  );

  revalidateAfterSales();
  if (!result.ok) {
    redirect(afterSalesReturnPath(result.status === 403 ? "Falta permiso after-sales.manage." : result.error, undefined, undefined, undefined, "error"));
  }

  redirect(afterSalesReturnPath("Caso atendido y tarea retirada de la cola.", caseId, caseTab, caseFocus));
}

export async function applyAfterSalesFiltersAction(formData: FormData): Promise<never> {
  const params = new URLSearchParams();
  const caseId = asString(formData.get("caseId"));
  const status = asString(formData.get("status"));
  const customerId = asString(formData.get("customerId"));
  const orderId = asString(formData.get("orderId"));
  const assignedEmployeeId = asString(formData.get("assignedEmployeeId"));
  const limit = asString(formData.get("limit"));

  if (caseId) {
    params.set("caseId", caseId);
  }
  if (status) {
    params.set("status", status);
  }
  if (customerId) {
    params.set("customerId", customerId);
  }
  if (orderId) {
    params.set("orderId", orderId);
  }
  if (assignedEmployeeId) {
    params.set("assignedEmployeeId", assignedEmployeeId);
  }
  if (limit) {
    params.set("limit", limit);
  }

  redirect(`/admin/postventa${params.size ? `?${params.toString()}` : ""}`);
}

export async function applyAfterSalesTaskFiltersAction(formData: FormData): Promise<never> {
  const params = new URLSearchParams();
  const taskType = optionalEnum(formData.get("taskType"), TASK_TYPES, "Tipo de tarea");
  const taskStatus = optionalEnum(formData.get("taskStatus"), TASK_STATUSES, "Estado de tarea");

  if (taskType) params.set("taskType", taskType);
  if (taskStatus) params.set("taskStatus", taskStatus);

  redirect(`/admin/postventa${params.size ? `?${params.toString()}` : ""}`);
}

export async function assignAfterSalesOwnerAction(formData: FormData): Promise<never> {
  const caseId = requiredString(formData.get("caseId"), "caseId");
  const assignedEmployeeId = asNullableString(formData.get("assignedEmployeeId"));
  const caseTab = asString(formData.get("caseTab"));

  return mutateCase(
    caseId,
    "assignment",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: jsonBody({ assignedEmployeeId }),
    },
    assignedEmployeeId ? "Caso asignado." : "Caso desasignado.",
    caseTab,
  );
}

export async function attendAfterSalesTaskAction(formData: FormData): Promise<never> {
  const taskId = requiredString(formData.get("taskId"), "taskId");
  const caseId = requiredString(formData.get("caseId"), "caseId");
  const caseFocus = optionalEnum(formData.get("caseFocus"), new Set(["message", "evidence"]), "Foco de caso") as "message" | "evidence" | undefined;
  const taskType = optionalEnum(formData.get("taskType"), TASK_TYPES, "Tipo de tarea");

  return mutateTask(
    taskId,
    caseId,
    caseFocus,
    taskType === "SOLUTION_PROPOSAL_REJECTED"
      ? "propuesta"
      : taskType === "SOLUTION_PROPOSAL_ACCEPTED"
        ? "ejecucion"
        : "caso",
  );
}

export async function transitionAfterSalesCaseAction(formData: FormData): Promise<never> {
  const caseId = requiredString(formData.get("caseId"), "caseId");
  const action = requiredString(formData.get("caseAction"), "Accion");
  const caseTab = asString(formData.get("caseTab"));
  if (!PATCH_ACTIONS.has(action)) {
    throw new Error("Accion postventa no soportada.");
  }

  const body = action === "resolve"
    ? jsonBody({
        resolutionOutcome: optionalEnum(formData.get("resolutionOutcome"), RESOLUTION_OUTCOMES, "Resultado"),
        resolutionReason: requiredString(formData.get("resolutionReason"), "Explicación de la resolución"),
      })
    : action === "close"
      ? jsonBody({
          closureReason: optionalEnum(formData.get("closureReason"), CLOSURE_REASONS, "Motivo de cierre"),
        })
      : jsonBody({
          adminNotes: asString(formData.get("adminNotes")),
          reason: asString(formData.get("reason")),
        });

  return mutateCase(
    caseId,
    action,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body,
    },
    "Caso actualizado.",
    caseTab,
  );
}

export async function sendAfterSalesSolutionProposalAction(formData: FormData): Promise<never> {
  const caseId = requiredString(formData.get("caseId"), "caseId");
  const caseTab = asString(formData.get("caseTab"));
  const solutionType = requiredEnum(formData.get("solutionType"), SOLUTION_TYPES, "Solución");
  const customerMessage = requiredString(formData.get("customerMessage"), "Mensaje para el cliente");
  const amountMinor = optionalMoneyToMinor(
    formData.get("amount") ?? formData.get("amountMinor"),
    "Importe",
  );
  const returnRequired = formData.get("returnRequired") === "true";
  const returnShippingPaidBy = returnRequired
    ? requiredEnum(formData.get("returnShippingPaidBy"), RETURN_SHIPPING_PAYERS, "Responsable del transporte")
    : "NOT_REQUIRED";
  const expiresInDays = optionalPositiveInteger(formData.get("expiresInDays"), "Vigencia") ?? 7;

  if (customerMessage.length > 4_000) {
    throw new Error("El mensaje para el cliente no puede superar 4.000 caracteres.");
  }
  if (expiresInDays > 90) {
    throw new Error("La vigencia no puede superar 90 días.");
  }

  return mutateCase(
    caseId,
    "solution-proposals",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: jsonBody({
        solutionType,
        customerMessage,
        amountMinor,
        currency: amountMinor === undefined ? undefined : optionalCurrency(formData.get("currency")),
        returnRequired,
        returnShippingPaidBy,
        expiresInDays,
        idempotencyKey: asString(formData.get("idempotencyKey")) ?? `admin-after-sales-proposal-${crypto.randomUUID()}`,
      }),
    },
    "Propuesta enviada al cliente.",
    caseTab,
  );
}

export async function startAfterSalesSolutionExecutionAction(formData: FormData): Promise<never> {
  const caseId = requiredString(formData.get("caseId"), "caseId");
  const caseTab = asString(formData.get("caseTab"));

  return mutateCase(
    caseId,
    "solution-execution",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: jsonBody({ idempotencyKey: asString(formData.get("idempotencyKey")) ?? `admin-after-sales-execution-${crypto.randomUUID()}` }),
    },
    "La solución está en ejecución.",
    caseTab,
  );
}

export async function completeAfterSalesSolutionAction(formData: FormData): Promise<never> {
  const caseId = requiredString(formData.get("caseId"), "caseId");
  const caseTab = asString(formData.get("caseTab"));
  const resolutionReason = requiredString(formData.get("resolutionReason"), "Explicación de la resolución");
  let proof: ClosureProofInput | undefined;
  try {
    proof = await readClosureProofInput(formData, "closureProofNote", true);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo validar la prueba de cierre.";
    redirect(afterSalesReturnPath(message, caseId, caseTab, undefined, "error"));
  }

  if (!proof) {
    redirect(afterSalesReturnPath("Nota interna requerida para finalizar la solución.", caseId, caseTab, undefined, "error"));
  }

  const context = await getAdminContext();
  const finalizationResult = await requestAdminBff(
    scopedPath(`/admin/after-sales/cases/${encodeURIComponent(caseId)}/solution-finalization`, context.organizationId, context.shopId),
    {
      context,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: jsonBody({
          resolutionReason,
          closureProof: proof,
          idempotencyKey: asString(formData.get("idempotencyKey")) ?? `admin-after-sales-solution-finalization-${crypto.randomUUID()}`,
        }),
      },
    },
  );

  revalidateAfterSales();
  if (!finalizationResult.ok) {
    redirect(afterSalesReturnPath(
      finalizationResult.status === 403 ? "Falta permiso after-sales.manage." : finalizationResult.error,
      caseId,
      caseTab,
      undefined,
      "error",
    ));
  }

  redirect(afterSalesReturnPath("Solución finalizada. El cliente puede confirmar el cierre.", caseId, caseTab));
}

export async function recordAfterSalesClosureProofAction(formData: FormData): Promise<never> {
  const caseId = requiredString(formData.get("caseId"), "caseId");
  const caseTab = asString(formData.get("caseTab"));
  const resolutionId = requiredString(formData.get("resolutionId"), "resolutionId");
  let proof: ClosureProofInput | undefined;
  try {
    proof = await readClosureProofInput(formData, "note", true);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo validar la prueba de cierre.";
    redirect(afterSalesReturnPath(message, caseId, caseTab, undefined, "error"));
  }

  if (!proof) {
    redirect(afterSalesReturnPath("Nota interna requerida para registrar la prueba de cierre.", caseId, caseTab, undefined, "error"));
  }

  return mutateCase(
    caseId,
    "closure-proofs",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: jsonBody({ resolutionId, ...proof }),
    },
    "Prueba de cierre registrada.",
    caseTab,
  );
}

export async function replyToAfterSalesCustomerAction(formData: FormData): Promise<never> {
  const caseId = requiredString(formData.get("caseId"), "caseId");
  const caseTab = asString(formData.get("caseTab"));
  const body = requiredString(formData.get("body"), "Respuesta");
  if (body.length > 4_000) {
    throw new Error("La respuesta no puede superar 4.000 caracteres.");
  }

  return mutateCase(
    caseId,
    "messages",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: jsonBody({
        body,
        idempotencyKey: asString(formData.get("idempotencyKey")) ?? `admin-after-sales-message-${crypto.randomUUID()}`,
      }),
    },
    "Respuesta enviada al cliente.",
    caseTab,
  );
}

export async function authorizeAfterSalesReturnAction(formData: FormData): Promise<never> {
  const caseId = requiredString(formData.get("caseId"), "caseId");
  const caseTab = asString(formData.get("caseTab"));

  return mutateCase(
    caseId,
    "return-authorizations",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: jsonBody({ metadataJson: { note: asString(formData.get("note")) } }),
    },
    "Retorno autorizado.",
    caseTab,
  );
}

export async function createAfterSalesResolutionAction(formData: FormData): Promise<never> {
  const caseId = requiredString(formData.get("caseId"), "caseId");
  const amountMinor = optionalPositiveInteger(formData.get("amountMinor"), "Importe");
  const caseTab = asString(formData.get("caseTab"));

  return mutateCase(
    caseId,
    "resolutions",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: jsonBody({
        caseItemId: asString(formData.get("caseItemId")),
        resolutionType: asString(formData.get("resolutionType")),
        amountMinor,
        currency: asString(formData.get("currency")),
        externalReference: asString(formData.get("externalReference")),
        metadataJson: { note: asString(formData.get("note")) },
      }),
    },
    "Resolucion registrada.",
    caseTab,
  );
}

export async function requestAfterSalesRefundAction(formData: FormData): Promise<never> {
  const caseId = requiredString(formData.get("caseId"), "caseId");
  const caseTab = asString(formData.get("caseTab"));

  return mutateCase(
    caseId,
    "refund-requests",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: jsonBody({
        transactionId: asString(formData.get("transactionId")),
        resolutionId: asString(formData.get("resolutionId")),
      }),
    },
    "Refund solicitado.",
    caseTab,
  );
}

export async function requestAfterSalesInventoryDispositionAction(formData: FormData): Promise<never> {
  const caseId = requiredString(formData.get("caseId"), "caseId");
  const caseTab = asString(formData.get("caseTab"));

  return mutateCase(
    caseId,
    "inventory-dispositions",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: jsonBody({
        caseItemId: asString(formData.get("caseItemId")),
        dispositionType: asString(formData.get("dispositionType")),
        warehouseId: asString(formData.get("warehouseId")),
      }),
    },
    "Disposicion de inventario solicitada.",
    caseTab,
  );
}

export async function requestAfterSalesDocumentAdjustmentAction(formData: FormData): Promise<never> {
  const caseId = requiredString(formData.get("caseId"), "caseId");
  const caseTab = asString(formData.get("caseTab"));

  return mutateCase(
    caseId,
    "document-adjustments",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: jsonBody({
        refundRequestId: asString(formData.get("refundRequestId")),
        invoiceId: asString(formData.get("invoiceId")),
        adjustmentType: asString(formData.get("adjustmentType")),
      }),
    },
    "Ajuste documental solicitado.",
    caseTab,
  );
}

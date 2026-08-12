"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestAdminBff } from "../../shared/bff/admin-client";
import { getAdminContext } from "../../shared/config/admin-context";

const PATCH_ACTIONS = new Set(["review", "approve", "reject", "receive-return", "resolve", "close"]);

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNullableString(value: FormDataEntryValue | null) {
  const normalized = asString(value);
  return normalized === "__null__" ? null : normalized;
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

function scopedPath(path: string, organizationId: string, shopId: string) {
  return `${path}?${new URLSearchParams({ organizationId, shopId }).toString()}`;
}

function afterSalesReturnPath(message: string, caseId?: string, caseTab?: string) {
  const params = new URLSearchParams({ notice: message });
  if (caseId) {
    params.set("caseId", caseId);
  }
  if (caseTab) {
    params.set("caseTab", caseTab);
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

  revalidatePath("/admin/postventa");
  if (!result.ok) {
    redirect(afterSalesReturnPath(result.status === 403 ? "Falta permiso after-sales.manage." : result.error, caseId, caseTab));
  }

  redirect(afterSalesReturnPath(successMessage, caseId, caseTab));
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

export async function transitionAfterSalesCaseAction(formData: FormData): Promise<never> {
  const caseId = requiredString(formData.get("caseId"), "caseId");
  const action = requiredString(formData.get("caseAction"), "Accion");
  const caseTab = asString(formData.get("caseTab"));
  if (!PATCH_ACTIONS.has(action)) {
    throw new Error("Accion postventa no soportada.");
  }

  return mutateCase(
    caseId,
    action,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: jsonBody({
        adminNotes: asString(formData.get("adminNotes")),
        reason: asString(formData.get("reason")),
      }),
    },
    "Caso actualizado.",
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

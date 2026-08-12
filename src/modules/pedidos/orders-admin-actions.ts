"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestAdminBff } from "../../shared/bff/admin-client";
import { getAdminSession } from "../../shared/auth/session";
import { getAdminContext } from "../../shared/config/admin-context";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function requiredString(value: FormDataEntryValue | null, label: string) {
  const normalized = asString(value);
  if (!normalized) {
    throw new Error(`${label} requerido.`);
  }

  return normalized;
}

function requiredPositiveInteger(value: FormDataEntryValue | null, label: string) {
  const raw = requiredString(value, label);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${label} debe ser un entero positivo.`);
  }

  return parsed;
}

function isAllowedFulfillmentStatus(status: string | undefined): status is string {
  return (
    status !== "PACKED" &&
    status !== "SHIPPED" &&
    status !== "DELIVERED" &&
    status !== "FAILED"
  ) ? false : true;
}

function scopedPath(path: string, organizationId: string, shopId: string) {
  return `${path}?${new URLSearchParams({ organizationId, shopId }).toString()}`;
}

function ordersReturnPath(message: string, orderId?: string, noticeKind?: "success" | "error" | "info") {
  const params = new URLSearchParams({ notice: message });
  if (orderId) {
    params.set("orderId", orderId);
  }
  if (noticeKind) {
    params.set("noticeKind", noticeKind);
  }

  return `/admin/pedidos?${params.toString()}`;
}

async function actorId() {
  const session = await getAdminSession();
  return session?.employeeId ?? "admin-ui";
}

export async function applyOrdersFiltersAction(formData: FormData): Promise<never> {
  const params = new URLSearchParams();
  const orderId = asString(formData.get("orderId"));
  const customerId = asString(formData.get("customerId"));
  const limit = asString(formData.get("limit"));

  if (orderId) {
    params.set("orderId", orderId);
  }
  if (customerId) {
    params.set("customerId", customerId);
  }
  if (limit) {
    params.set("limit", limit);
  }

  redirect(`/admin/pedidos${params.size ? `?${params.toString()}` : ""}`);
}

export async function assignAfterSalesCaseAction(formData: FormData): Promise<never> {
  const context = await getAdminContext();
  const caseId = requiredString(formData.get("caseId"), "caseId");
  const orderId = asString(formData.get("orderId"));
  const assignedEmployeeId = requiredString(formData.get("assignedEmployeeId"), "Responsable");
  const result = await requestAdminBff(
    scopedPath(`/admin/after-sales/cases/${encodeURIComponent(caseId)}/assignment`, context.organizationId, context.shopId),
    {
      context,
      init: {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assignedEmployeeId,
          assignedBy: await actorId(),
        }),
      },
    },
  );

  revalidatePath("/admin/pedidos");
  if (!result.ok) {
    redirect(ordersReturnPath(result.status === 403 ? "Falta permiso after-sales.manage." : result.error, orderId));
  }

  redirect(ordersReturnPath("Caso postventa asignado.", orderId));
}

export async function issueOrderInvoiceAction(formData: FormData): Promise<never> {
  const context = await getAdminContext();
  const orderId = requiredString(formData.get("orderId"), "orderId");
  const result = await requestAdminBff(
    scopedPath("/admin/invoices/issue", context.organizationId, context.shopId),
    {
      context,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId,
          idempotencyKey: `admin-order-invoice-${orderId}`,
        }),
      },
    },
  );

  revalidatePath("/admin/pedidos");
  if (!result.ok) {
    redirect(ordersReturnPath(result.status === 403 ? "Falta permiso invoices.manage." : result.error, orderId));
  }

  redirect(ordersReturnPath("Factura solicitada.", orderId));
}

export async function createInvoiceAdjustmentAction(formData: FormData): Promise<never> {
  const context = await getAdminContext();
  const orderId = requiredString(formData.get("orderId"), "orderId");
  const invoiceId = requiredString(formData.get("invoiceId"), "invoiceId");
  const adjustmentType = requiredString(formData.get("adjustmentType"), "Tipo");
  const amountMinor = requiredPositiveInteger(formData.get("amountMinor"), "Importe");
  const currency = asString(formData.get("currency")) ?? context.currency;
  const reason = requiredString(formData.get("reason"), "Motivo");
  const result = await requestAdminBff(
    scopedPath("/admin/invoices/adjustments", context.organizationId, context.shopId),
    {
      context,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId,
          invoiceId,
          source: "admin-ui",
          idempotencyKey: `admin-invoice-adjustment-${invoiceId}-${adjustmentType}-${amountMinor}`,
          adjustmentType,
          amountMinor,
          currency,
          reason,
        }),
      },
    },
  );

  revalidatePath("/admin/pedidos");
  if (!result.ok) {
    redirect(ordersReturnPath(result.status === 403 ? "Falta permiso invoices.manage." : result.error, orderId));
  }

  redirect(ordersReturnPath("Ajuste fiscal solicitado.", orderId));
}

export async function createOrderFulfillmentAction(formData: FormData): Promise<never> {
  const context = await getAdminContext();
  const orderId = requiredString(formData.get("orderId"), "orderId");
  const result = await requestAdminBff(
    scopedPath(`/admin/orders/${encodeURIComponent(orderId)}/fulfillment`, context.organizationId, context.shopId),
    {
      context,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      },
    },
  );

  revalidatePath("/admin/pedidos");
  if (!result.ok) {
    redirect(ordersReturnPath(result.status === 403 ? "Falta permiso shipping.logistics.write." : result.error, orderId, "error"));
  }

  redirect(ordersReturnPath("Pedido en preparacion.", orderId, "success"));
}

export async function transitionFulfillmentStatusAction(formData: FormData): Promise<never> {
  const context = await getAdminContext();
  const orderId = requiredString(formData.get("orderId"), "orderId");
  const status = asString(formData.get("status"));
  const trackingNumber = asString(formData.get("trackingNumber"));
  const carrierId = asString(formData.get("carrierId"));

  if (!isAllowedFulfillmentStatus(status)) {
    redirect(ordersReturnPath("Estado logistico no permitido.", orderId, "error"));
  }
  if (status === "SHIPPED" && !trackingNumber) {
    redirect(ordersReturnPath("Numero de tracking requerido para marcar como enviado.", orderId, "error"));
  }

  const body: Record<string, string> = { status };

  if (trackingNumber) {
    body.trackingNumber = trackingNumber;
  }
  if (carrierId) {
    body.carrierId = carrierId;
  }

  const result = await requestAdminBff(
    scopedPath(`/admin/orders/${encodeURIComponent(orderId)}/fulfillment/status`, context.organizationId, context.shopId),
    {
      context,
      init: {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    },
  );

  revalidatePath("/admin/pedidos");
  if (!result.ok) {
    redirect(ordersReturnPath(result.status === 403 ? "Falta permiso shipping.logistics.write." : result.error, orderId, "error"));
  }

  const statusLabel = status === "PACKED" ? "En despacho" : status;
  redirect(ordersReturnPath(`Estado logistico actualizado a ${statusLabel}.`, orderId, "success"));
}

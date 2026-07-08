"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestBff } from "../../shared/bff/client";
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

function scopedPath(path: string, organizationId: string, shopId: string) {
  return `${path}?${new URLSearchParams({ organizationId, shopId }).toString()}`;
}

function invoicesReturnPath(message: string, invoiceId?: string) {
  const params = new URLSearchParams({ notice: message });
  if (invoiceId) {
    params.set("invoiceId", invoiceId);
  }

  return `/admin/pagos?${params.toString()}`;
}

export async function applyInvoiceFiltersAction(formData: FormData): Promise<never> {
  const params = new URLSearchParams();
  const invoiceId = asString(formData.get("invoiceId"));
  const orderId = asString(formData.get("orderId"));
  const status = asString(formData.get("status"));
  const limit = asString(formData.get("limit"));

  if (invoiceId) {
    params.set("invoiceId", invoiceId);
  }
  if (orderId) {
    params.set("orderId", orderId);
  }
  if (status) {
    params.set("status", status);
  }
  if (limit) {
    params.set("limit", limit);
  }

  redirect(`/admin/pagos${params.size ? `?${params.toString()}` : ""}`);
}

export async function issueInvoiceFromFiscalConsoleAction(formData: FormData): Promise<never> {
  const context = await getAdminContext();
  const orderId = requiredString(formData.get("orderId"), "orderId");
  const result = await requestBff(
    scopedPath("/admin/invoices/issue", context.organizationId, context.shopId),
    {
      context,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId,
          idempotencyKey: `admin-fiscal-console-invoice-${orderId}`,
        }),
      },
    },
  );

  revalidatePath("/admin/pagos");
  if (!result.ok) {
    redirect(invoicesReturnPath(result.status === 403 ? "Falta permiso invoices.manage." : result.error));
  }

  redirect(invoicesReturnPath("Factura solicitada."));
}

export async function createFiscalInvoiceAdjustmentAction(formData: FormData): Promise<never> {
  const context = await getAdminContext();
  const orderId = requiredString(formData.get("orderId"), "orderId");
  const invoiceId = requiredString(formData.get("invoiceId"), "invoiceId");
  const adjustmentType = requiredString(formData.get("adjustmentType"), "Tipo");
  const amountMinor = requiredPositiveInteger(formData.get("amountMinor"), "Importe");
  const currency = asString(formData.get("currency")) ?? context.currency;
  const reason = requiredString(formData.get("reason"), "Motivo");
  const result = await requestBff(
    scopedPath("/admin/invoices/adjustments", context.organizationId, context.shopId),
    {
      context,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId,
          invoiceId,
          source: "admin-fiscal-console",
          idempotencyKey: `admin-fiscal-adjustment-${invoiceId}-${adjustmentType}-${amountMinor}`,
          adjustmentType,
          amountMinor,
          currency,
          reason,
        }),
      },
    },
  );

  revalidatePath("/admin/pagos");
  if (!result.ok) {
    redirect(invoicesReturnPath(result.status === 403 ? "Falta permiso invoices.manage." : result.error, invoiceId));
  }

  redirect(invoicesReturnPath("Nota o ajuste fiscal solicitado.", invoiceId));
}

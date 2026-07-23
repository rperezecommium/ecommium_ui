"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestBff } from "../../shared/bff/client";
import { getAdminContext } from "../../shared/config/admin-context";

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function boolValue(formData: FormData, key: string) {
  return value(formData, key) === "on";
}

function activeValue(formData: FormData, key: string) {
  const raw = value(formData, key);
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  return raw === "on";
}

function numberValue(formData: FormData, key: string) {
  const raw = value(formData, key);
  if (!raw) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function positiveIntegerValue(formData: FormData, key: string) {
  const parsed = numberValue(formData, key);
  return typeof parsed === "number" && Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function scopedPath(path: string, organizationId: string, shopId: string) {
  return `${path}?${new URLSearchParams({ organizationId, shopId }).toString()}`;
}

function resourcePath(resource: string, id: string) {
  if (resource === "payment-systems") {
    return `/admin/payments/payment-systems/${encodeURIComponent(id)}`;
  }
  if (resource === "affiliations") {
    return `/admin/payments/affiliations/${encodeURIComponent(id)}`;
  }
  if (resource === "rules") {
    return `/admin/payments/rules/${encodeURIComponent(id)}`;
  }
  throw new Error("Recurso Payments no permitido.");
}

async function activeContext() {
  const context = await getAdminContext();
  if (!context.organizationId || !context.shopId) {
    throw new Error("Selecciona organization y shop antes de configurar pagos.");
  }
  return context;
}

function paymentsRedirect(tab: string, notice: string, includeInactive = false) {
  const params = new URLSearchParams({ tab, notice });
  if (includeInactive) {
    params.set("includeInactive", "true");
  }

  revalidatePath("/admin/pagos");
  redirect(`/admin/pagos?${params.toString()}`);
}

function operationRedirect(
  tab: "operaciones" | "reembolsos",
  notice: string,
  options: { referenceId?: string; transactionId?: string; drawer?: "refund-evidence" } = {},
) {
  const params = new URLSearchParams({ tab, notice });
  if (options.referenceId) {
    params.set("transactionReference", options.referenceId);
  }
  if (options.transactionId) {
    params.set("transactionId", options.transactionId);
  }
  if (options.drawer) {
    params.set("drawer", options.drawer);
  }

  revalidatePath("/admin/pagos");
  redirect(`/admin/pagos?${params.toString()}`);
}

export async function createPaymentSystemAction(formData: FormData) {
  const context = await activeContext();
  const payload = {
    paymentSystemId: value(formData, "paymentSystemId"),
    name: value(formData, "name"),
    groupName: value(formData, "groupName"),
    methodType: value(formData, "methodType"),
    provider: value(formData, "provider"),
    active: boolValue(formData, "active"),
    supportsInstallments: boolValue(formData, "supportsInstallments"),
    maxInstallments: numberValue(formData, "maxInstallments"),
  };

  const result = await requestBff(scopedPath("/admin/payments/payment-systems", context.organizationId, context.shopId), {
    context,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
  });

  if (!result.ok) {
    throw new Error(result.error);
  }

  paymentsRedirect("metodos", "Metodo de pago creado.");
}

export async function createPaymentAffiliationAction(formData: FormData) {
  const context = await activeContext();
  const payload = {
    affiliationId: value(formData, "affiliationId"),
    name: value(formData, "name"),
    provider: value(formData, "provider"),
    merchantId: value(formData, "merchantId"),
    active: boolValue(formData, "active"),
  };

  const result = await requestBff(scopedPath("/admin/payments/affiliations", context.organizationId, context.shopId), {
    context,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
  });

  if (!result.ok) {
    throw new Error(result.error);
  }

  paymentsRedirect("proveedores", "Proveedor de pago creado.");
}

export async function createPaymentRuleAction(formData: FormData) {
  const context = await activeContext();
  const payload = {
    ruleId: value(formData, "ruleId"),
    name: value(formData, "name"),
    paymentSystemId: value(formData, "paymentSystemId"),
    affiliationId: value(formData, "affiliationId"),
    priority: numberValue(formData, "priority"),
    country: value(formData, "country"),
    currency: value(formData, "currency"),
    minValueMinor: numberValue(formData, "minValueMinor"),
    maxValueMinor: numberValue(formData, "maxValueMinor"),
    active: boolValue(formData, "active"),
  };

  const result = await requestBff(scopedPath("/admin/payments/rules", context.organizationId, context.shopId), {
    context,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
  });

  if (!result.ok) {
    throw new Error(result.error);
  }

  paymentsRedirect("routing", "Regla de routing creada.");
}

export async function setPaymentResourceActiveAction(formData: FormData) {
  const context = await activeContext();
  const tab = value(formData, "tab") || "metodos";
  const resource = value(formData, "resource");
  const id = value(formData, "id");
  const active = activeValue(formData, "active");
  const includeInactive = value(formData, "includeInactive") === "true";

  if (!resource || !id) {
    paymentsRedirect(tab, "Falta recurso Payments o identificador.", includeInactive);
  }

  const result = await requestBff(scopedPath(resourcePath(resource, id), context.organizationId, context.shopId), {
    context,
    init: {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active }),
    },
  });

  if (!result.ok) {
    throw new Error(result.error);
  }

  paymentsRedirect(tab, active ? "Recurso Payments reactivado." : "Recurso Payments desactivado.", includeInactive);
}

export async function createPaymentRefundAction(formData: FormData) {
  const context = await activeContext();
  const transactionId = value(formData, "transactionId");
  const refundId = value(formData, "refundId");
  const valueMinor = positiveIntegerValue(formData, "valueMinor");
  const currency = value(formData, "currency");
  const referenceId = value(formData, "referenceId");

  if (value(formData, "confirmed") !== "on") {
    throw new Error("Confirma el reembolso antes de enviarlo a Payments.");
  }
  if (!transactionId || !refundId || !valueMinor || !currency) {
    throw new Error("Faltan datos para solicitar el reembolso.");
  }

  const result = await requestBff(
    scopedPath(`/admin/payments/transactions/${encodeURIComponent(transactionId)}/refunds`, context.organizationId, context.shopId),
    {
      context,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refundId, valueMinor, currency }),
      },
    },
  );

  if (!result.ok) {
    throw new Error(result.error);
  }

  operationRedirect(
    "reembolsos",
    "Solicitud creada. El importe quedó reservado; Payments está comprobando la confirmación del proveedor.",
    { referenceId, transactionId, drawer: "refund-evidence" },
  );
}

export async function createPaymentCancellationAction(formData: FormData) {
  const context = await activeContext();
  const transactionId = value(formData, "transactionId");
  const cancellationId = value(formData, "cancellationId");
  const valueMinor = positiveIntegerValue(formData, "valueMinor");
  const currency = value(formData, "currency");
  const referenceId = value(formData, "referenceId");

  if (value(formData, "confirmed") !== "on") {
    throw new Error("Confirma la cancelación antes de enviarla a Payments.");
  }
  if (!transactionId || !cancellationId || !valueMinor || !currency) {
    throw new Error("Faltan datos para solicitar la cancelación.");
  }

  const result = await requestBff(
    scopedPath(`/admin/payments/transactions/${encodeURIComponent(transactionId)}/cancellations`, context.organizationId, context.shopId),
    {
      context,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cancellationId, valueMinor, currency }),
      },
    },
  );

  if (!result.ok) {
    throw new Error(result.error);
  }

  operationRedirect("reembolsos", "Solicitud de cancelación enviada a Payments.", { referenceId, transactionId });
}

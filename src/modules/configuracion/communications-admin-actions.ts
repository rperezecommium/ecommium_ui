"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "../../shared/config/admin-context";
import {
  bootstrapAuthEmailTemplates,
  getEmailDelivery,
  patchEmailProviderSettings,
  retryEmailDelivery,
  sendCommunicationsTestEmail,
} from "./communications-admin";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNullableString(value: FormDataEntryValue | null) {
  return asString(value) ?? null;
}

function asBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function asNumber(value: FormDataEntryValue | null) {
  const normalized = asString(value);
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function finish(notice: string): never {
  revalidatePath("/admin/configuracion/comunicaciones");
  redirect(`/admin/configuracion/comunicaciones?notice=${encodeURIComponent(notice)}`);
}

function allowedValue(value: FormDataEntryValue | null, allowed: readonly string[]) {
  const normalized = asString(value);
  return normalized && allowed.includes(normalized) ? normalized : undefined;
}

function safeFilterValue(value: FormDataEntryValue | null) {
  const normalized = asString(value);
  return normalized && normalized.length <= 200 ? normalized : undefined;
}

function safeInteger(value: FormDataEntryValue | null, minimum: number, maximum?: number) {
  const normalized = asString(value);
  const parsed = Number.parseInt(normalized ?? "", 10);
  return Number.isFinite(parsed) && parsed >= minimum && (typeof maximum === "undefined" || parsed <= maximum)
    ? String(parsed)
    : undefined;
}

function deliveryRetryReturnPath(formData: FormData, notice: string, deliveryId?: string) {
  const params = new URLSearchParams();
  const templateStatus = allowedValue(formData.get("status"), ["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]);
  const deliveryStatus = allowedValue(formData.get("deliveryStatus"), ["PENDING", "SENT", "FAILED", "SKIPPED", "RETRYING"]);
  const deliveryTemplateKey = safeFilterValue(formData.get("deliveryTemplateKey"));
  const deliverySourceEventId = safeFilterValue(formData.get("deliverySourceEventId"));
  const deliveryCustomerId = safeFilterValue(formData.get("deliveryCustomerId"));
  const deliveriesLimit = safeInteger(formData.get("deliveriesLimit"), 1, 100);
  const deliveriesOffset = safeInteger(formData.get("deliveriesOffset"), 0);

  if (templateStatus) params.set("status", templateStatus);
  if (deliveryStatus) params.set("deliveryStatus", deliveryStatus);
  if (deliveryTemplateKey) params.set("deliveryTemplateKey", deliveryTemplateKey);
  if (deliverySourceEventId) params.set("deliverySourceEventId", deliverySourceEventId);
  if (deliveryCustomerId) params.set("deliveryCustomerId", deliveryCustomerId);
  if (deliveriesLimit) params.set("deliveriesLimit", deliveriesLimit);
  if (deliveriesOffset) params.set("deliveriesOffset", deliveriesOffset);
  if (deliveryId) {
    params.set("drawer", "delivery");
    params.set("deliveryId", deliveryId);
  }
  params.set("notice", notice);

  return `/admin/configuracion/comunicaciones?${params.toString()}`;
}

function finishDeliveryRetry(formData: FormData, notice: string, deliveryId?: string): never {
  revalidatePath("/admin/configuracion/comunicaciones");
  redirect(deliveryRetryReturnPath(formData, notice, deliveryId));
}

export async function updateEmailProviderSettingsAction(formData: FormData) {
  const context = await getAdminContext();
  const provider = asString(formData.get("provider")) ?? "stub";
  const secret = asString(formData.get("secret"));
  const clearSecret = asBoolean(formData.get("clearSecret"));

  const result = await patchEmailProviderSettings(context, {
    provider,
    active: asBoolean(formData.get("active")),
    fromEmail: asNullableString(formData.get("fromEmail")),
    replyToEmail: asNullableString(formData.get("replyToEmail")),
    smtpHost: asNullableString(formData.get("smtpHost")),
    smtpPort: asNumber(formData.get("smtpPort")),
    smtpSecure: asBoolean(formData.get("smtpSecure")),
    smtpUser: asNullableString(formData.get("smtpUser")),
    ...(secret ? { secret } : {}),
    ...(clearSecret ? { clearSecret: true } : {}),
  });

  if (!result.ok) {
    finish(result.status === 403 ? "Falta permiso communications.manage." : result.error);
  }

  finish("Configuracion de email guardada.");
}

export async function bootstrapAuthEmailTemplatesAction(formData: FormData) {
  const context = await getAdminContext();
  const locale = asString(formData.get("locale")) ?? context.locale;
  const overwrite = asBoolean(formData.get("overwrite"));
  const result = await bootstrapAuthEmailTemplates(context, {
    locale,
    overwrite,
  });

  if (!result.ok) {
    finish(result.status === 403 ? "Falta permiso communications.manage." : result.error);
  }

  finish(
    `Plantillas auth listas: ${result.data.created} creadas, ${result.data.updated} actualizadas, ${result.data.existing} existentes.`,
  );
}

export async function sendCommunicationsTestEmailAction(formData: FormData) {
  const context = await getAdminContext();
  const recipientEmail = asString(formData.get("recipientEmail"));
  const templateKey = asString(formData.get("templateKey")) ?? "customer.account.activation";
  const locale = asString(formData.get("locale")) ?? context.locale;

  if (!recipientEmail) {
    finish("Indica el destinatario para enviar la prueba.");
  }

  const now = Date.now();
  const result = await sendCommunicationsTestEmail(context, {
    templateKey,
    locale,
    recipient: { email: recipientEmail },
    data: {
      customerName: "Prueba Ecommium",
      activationUrl: "https://example.test/account/activate?token=test",
      passwordResetUrl: "https://example.test/account/password-reset?token=test",
      expiresAt: new Date(now + 60 * 60 * 1000).toISOString(),
      supportEmail: "soporte@example.com",
      eventType: "email_provider_test",
    },
    idempotencyKey: `admin-communications-test:${context.organizationId}:${context.shopId}:${recipientEmail}:${now}`,
    sourceEventId: `admin.communications.test.${now}`,
  });

  if (!result.ok) {
    finish(result.status === 403 ? "Falta permiso communications.manage." : result.error);
  }

  finish(`Prueba de email procesada para ${recipientEmail}. Delivery ${result.data.deliveryId} en estado ${result.data.status}.`);
}

export async function retryEmailDeliveryAction(formData: FormData): Promise<never> {
  const context = await getAdminContext();
  const deliveryId = safeFilterValue(formData.get("deliveryId"));

  if (!deliveryId) {
    finishDeliveryRetry(formData, "Selecciona una entrega fallida para reintentar.");
  }

  const current = await getEmailDelivery(context, deliveryId);
  if (!current.ok) {
    finishDeliveryRetry(
      formData,
      current.status === 403 ? "Falta permiso communications.manage." : current.error,
      deliveryId,
    );
  }
  if (current.data.status !== "FAILED") {
    finishDeliveryRetry(formData, "Solo se pueden reintentar entregas fallidas.", deliveryId);
  }

  const result = await retryEmailDelivery(context, deliveryId);
  if (!result.ok) {
    finishDeliveryRetry(
      formData,
      result.status === 403 ? "Falta permiso communications.manage." : result.error,
      deliveryId,
    );
  }

  finishDeliveryRetry(
    formData,
    `Entrega ${result.data.deliveryId} reintentada. Estado actual: ${result.data.status}.`,
    result.data.deliveryId,
  );
}

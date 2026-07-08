"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "../../shared/config/admin-context";
import { bootstrapAuthEmailTemplates, patchEmailProviderSettings, sendCommunicationsTestEmail } from "./communications-admin";

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

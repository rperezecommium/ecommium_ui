"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "../../shared/config/admin-context";
import {
  bootstrapAuthEmailTemplates,
  createEmailTemplate,
  getEmailDelivery,
  hardDeleteEmailTemplateImage,
  listEmailTemplateImages,
  patchEmailProviderSettings,
  patchEmailTemplate,
  previewEmailTemplate,
  retryEmailDelivery,
  sendCommunicationsTestEmail,
  transitionEmailTemplate,
  uploadEmailTemplateImage,
} from "./communications-admin";
import type { EmailTemplateWritePayload } from "./communications-admin";

const templateVariablePattern = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$/;
const emailTemplateTransitions = ["activate", "deactivate", "archive"] as const;

type FormResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

type EmailTemplateCreatePayload = Required<Pick<EmailTemplateWritePayload, "templateKey" | "locale">> & EmailTemplateWritePayload;

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

function allowedValue<T extends string>(value: FormDataEntryValue | null, allowed: readonly T[]) {
  const normalized = asString(value);
  return normalized && allowed.includes(normalized as T) ? normalized as T : undefined;
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

function parseTemplateVariables(value: FormDataEntryValue | null): FormResult<string[]> {
  const variables = (asString(value) ?? "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

  const invalid = variables.find((item) => !templateVariablePattern.test(item));
  if (invalid) {
    return { ok: false, error: `La variable \"${invalid}\" no tiene un formato válido.` };
  }

  return { ok: true, value: [...new Set(variables)].sort() };
}

function parseTemplatePreviewData(value: FormDataEntryValue | null): FormResult<Record<string, unknown>> {
  const raw = asString(value) ?? "{}";

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      return { ok: false, error: "Los datos de preview deben ser un objeto JSON." };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, error: "Los datos de preview deben ser JSON válido." };
  }
}

function templatePayload(formData: FormData, options: { includeKey: true }): FormResult<EmailTemplateCreatePayload>;
function templatePayload(formData: FormData, options: { includeKey: false }): FormResult<EmailTemplateWritePayload>;
function templatePayload(formData: FormData, options: { includeKey: boolean }): FormResult<EmailTemplateWritePayload | EmailTemplateCreatePayload> {
  const variables = parseTemplateVariables(formData.get("requiredVariables"));
  if (!variables.ok) {
    return variables;
  }
  const previewData = parseTemplatePreviewData(formData.get("previewData"));
  if (!previewData.ok) {
    return previewData;
  }

  const payload = {
    subjectTemplate: asNullableString(formData.get("subjectTemplate")),
    htmlTemplate: asNullableString(formData.get("htmlTemplate")),
    textTemplate: asNullableString(formData.get("textTemplate")),
    requiredVariables: variables.value,
    previewData: previewData.value,
  };

  if (!options.includeKey) {
    return { ok: true, value: payload };
  }

  const templateKey = asString(formData.get("templateKey"));
  const locale = asString(formData.get("locale"));
  if (!templateKey || !locale) {
    return { ok: false, error: "Indica la clave y el locale de la plantilla." };
  }

  return { ok: true, value: { ...payload, templateKey, locale } };
}

function deliveryRetryReturnPath(formData: FormData, notice: string, deliveryId?: string) {
  const params = new URLSearchParams();
  const templateStatus = allowedValue(formData.get("status"), ["DRAFT", "ACTIVE", "ARCHIVED"]);
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

export async function createEmailTemplateAction(formData: FormData): Promise<never> {
  const context = await getAdminContext();
  const payload = templatePayload(formData, { includeKey: true });
  if (!payload.ok) {
    finish(payload.error);
  }

  const result = await createEmailTemplate(context, payload.value);
  if (!result.ok) {
    finish(result.status === 403 ? "Falta permiso communications.manage." : result.error);
  }

  finish(`Plantilla ${result.data.templateKey} creada como borrador.`);
}

export async function patchEmailTemplateAction(formData: FormData): Promise<never> {
  const context = await getAdminContext();
  const templateId = safeFilterValue(formData.get("templateId"));
  if (!templateId) {
    finish("Selecciona una plantilla para guardar.");
  }
  const payload = templatePayload(formData, { includeKey: false });
  if (!payload.ok) {
    finish(payload.error);
  }

  const result = await patchEmailTemplate(context, templateId, payload.value);
  if (!result.ok) {
    finish(result.status === 403 ? "Falta permiso communications.manage." : result.error);
  }

  finish(`Plantilla ${result.data.templateKey} guardada como borrador.`);
}

export async function previewEmailTemplateAction(formData: FormData) {
  const context = await getAdminContext();
  const templateId = safeFilterValue(formData.get("templateId"));
  if (!templateId) {
    return { ok: false as const, error: "Guarda la plantilla antes de previsualizarla." };
  }
  const previewData = parseTemplatePreviewData(formData.get("previewData"));
  if (!previewData.ok) {
    return { ok: false as const, error: previewData.error };
  }

  const result = await previewEmailTemplate(context, templateId, previewData.value);
  if (!result.ok) {
    return {
      ok: false as const,
      error: result.status === 403 ? "Falta permiso communications.manage." : result.error,
    };
  }

  return { ok: true as const, data: result.data };
}

export async function uploadEmailTemplateImageAction(formData: FormData) {
  const context = await getAdminContext();
  const templateId = safeFilterValue(formData.get("templateId"));
  const templateKey = safeFilterValue(formData.get("templateKey"));
  const locale = safeFilterValue(formData.get("locale")) ?? context.locale;
  const file = formData.get("file");

  if (!templateId || !templateKey) {
    return { ok: false as const, error: "Guarda la plantilla antes de subir una imagen." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "Selecciona una imagen válida." };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false as const, error: "Solo se permiten archivos de imagen." };
  }

  const result = await uploadEmailTemplateImage(context, {
    templateId,
    templateKey,
    locale,
    file,
  });
  if (!result.ok) {
    return {
      ok: false as const,
      error: result.status === 403 ? "Falta permiso media.assets.write." : result.error,
    };
  }

  return { ok: true as const, data: result.data };
}

export async function listEmailTemplateImagesAction(formData: FormData) {
  const context = await getAdminContext();
  const templateId = safeFilterValue(formData.get("templateId"));
  if (!templateId) {
    return { ok: false as const, error: "Guarda la plantilla antes de gestionar sus imágenes." };
  }

  const result = await listEmailTemplateImages(context, templateId);
  if (!result.ok) {
    return {
      ok: false as const,
      error: result.status === 403 ? "Falta permiso media.assets.write." : result.error,
    };
  }
  return { ok: true as const, data: result.data };
}

export async function deleteEmailTemplateImageAction(formData: FormData) {
  const context = await getAdminContext();
  const templateId = safeFilterValue(formData.get("templateId"));
  const mediaCollectionId = safeFilterValue(formData.get("mediaCollectionId"));
  const mediaAssetId = safeFilterValue(formData.get("mediaAssetId"));
  const htmlTemplate = asNullableString(formData.get("htmlTemplate"));

  if (!templateId || !mediaCollectionId || !mediaAssetId) {
    return { ok: false as const, error: "No se pudo identificar la imagen que quieres eliminar." };
  }

  const images = await listEmailTemplateImages(context, templateId);
  if (!images.ok) {
    return {
      ok: false as const,
      error: images.status === 403 ? "Falta permiso media.assets.write." : images.error,
    };
  }
  const ownedImage = images.data.find((image) => (
    image.mediaCollectionId === mediaCollectionId && image.mediaAssetId === mediaAssetId
  ));
  if (!ownedImage) {
    return { ok: false as const, error: "La imagen no pertenece a esta plantilla." };
  }

  const updated = await patchEmailTemplate(context, templateId, { htmlTemplate });
  if (!updated.ok) {
    return {
      ok: false as const,
      error: updated.status === 403 ? "Falta permiso communications.manage." : updated.error,
    };
  }

  const deleted = await hardDeleteEmailTemplateImage(context, {
    mediaCollectionId,
    mediaAssetId,
  });
  revalidatePath("/admin/configuracion/comunicaciones");
  if (!deleted.ok) {
    return {
      ok: false as const,
      error: deleted.status === 403
        ? "La imagen se retiró de la plantilla, pero falta permiso media.assets.write para borrarla de Media/GCS."
        : `La imagen se retiró de la plantilla, pero no se pudo borrar de Media/GCS: ${deleted.error}`,
    };
  }

  return {
    ok: true as const,
    data: { status: updated.data.status },
  };
}

export async function transitionEmailTemplateAction(formData: FormData): Promise<never> {
  const context = await getAdminContext();
  const templateId = safeFilterValue(formData.get("templateId"));
  const transition = allowedValue(formData.get("transition"), emailTemplateTransitions);
  if (!templateId || !transition) {
    finish("Selecciona una transición válida para la plantilla.");
  }

  const result = await transitionEmailTemplate(context, templateId, transition);
  if (!result.ok) {
    finish(result.status === 403 ? "Falta permiso communications.manage." : result.error);
  }

  const label = transition === "activate" ? "activada" : transition === "deactivate" ? "pausada" : "archivada";
  finish(`Plantilla ${result.data.templateKey} ${label}.`);
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

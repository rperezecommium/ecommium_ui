"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearStorefrontCustomerSession, updateStorefrontCustomerSessionEmail } from "./storefront-customer-session";
import {
  confirmStorefrontAfterSalesCompletion,
  createStorefrontAfterSalesCase,
  replyToStorefrontAfterSalesCase,
  respondToStorefrontAfterSalesSolutionProposal,
  uploadStorefrontAfterSalesEvidence,
  createStorefrontCustomerAddress,
  deleteStorefrontCustomerAddress,
  logoutAllStorefrontSessions,
  logoutCurrentStorefrontSession,
  patchStorefrontCustomerAddress,
  patchStorefrontCustomerProfile,
  setStorefrontCustomerAddressDefault,
} from "./storefront-account";

export type StorefrontAccountActionState = {
  caseId?: string;
  status: "idle" | "success" | "error";
  message: string;
};

type AddressOperation = "create" | "update" | "delete" | "default-shipping" | "default-billing";
type SessionOperation = "current" | "others" | "all";
type AfterSalesCaseItem = {
  orderLineId: string;
  quantityRequested: number;
};

const maxEvidenceFileBytes = 10 * 1024 * 1024;
const allowedEvidenceMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function formBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function evidenceFilesFromForm(formData: FormData): File[] | null {
  const files = formData.getAll("evidences");
  if (files.length > 15 || files.some((file) => !(file instanceof File) || file.size === 0)) {
    return null;
  }
  return files as File[];
}

function afterSalesCaseItemsFromForm(formData: FormData): AfterSalesCaseItem[] | null {
  const rawItems = formString(formData, "items");
  if (!rawItems) return null;

  try {
    const parsedItems: unknown = JSON.parse(rawItems);
    if (!Array.isArray(parsedItems) || parsedItems.length === 0) return null;

    const lineIds = new Set<string>();
    const items: AfterSalesCaseItem[] = [];
    for (const item of parsedItems) {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      if (Object.keys(record).length !== 2) return null;

      const orderLineId = typeof record.orderLineId === "string" ? record.orderLineId.trim() : "";
      const quantityRequested = typeof record.quantityRequested === "number" ? record.quantityRequested : null;
      if (!orderLineId || lineIds.has(orderLineId) || !Number.isInteger(quantityRequested) || !quantityRequested || quantityRequested <= 0) {
        return null;
      }

      lineIds.add(orderLineId);
      items.push({ orderLineId, quantityRequested });
    }

    return items;
  } catch {
    return null;
  }
}

function addressOperation(value: string): AddressOperation | null {
  return ["create", "update", "delete", "default-shipping", "default-billing"].includes(value)
    ? value as AddressOperation
    : null;
}

function sessionOperation(value: string): SessionOperation | null {
  return ["current", "others", "all"].includes(value)
    ? value as SessionOperation
    : null;
}

export async function updateStorefrontAccountProfile(
  previousState: StorefrontAccountActionState,
  formData: FormData,
): Promise<StorefrontAccountActionState> {
  void previousState;
  const firstName = formString(formData, "firstName");
  const lastName = formString(formData, "lastName");
  const phone = formString(formData, "phone");
  const avatarId = formString(formData, "avatarId");
  const locale = formString(formData, "locale") || "es-ES";

  if (!firstName || !lastName) {
    return {
      status: "error",
      message: "Nombre y apellido son obligatorios.",
    };
  }

  const result = await patchStorefrontCustomerProfile({
    firstName,
    lastName,
    phone: phone || null,
    avatarId: avatarId || null,
    clientPreferencesData: {
      locale,
      optinNewsLetter: formBoolean(formData, "optinNewsLetter"),
    },
  });

  if (!result.ok) {
    return {
      status: "error",
      message: result.status === 401
        ? "Inicia sesion para editar tu cuenta."
        : "No se pudo guardar el perfil. Intentalo de nuevo.",
    };
  }

  revalidatePath("/account");

  return {
    status: "success",
    message: "Perfil actualizado correctamente.",
  };
}

export async function updateStorefrontAccountCredentials(
  previousState: StorefrontAccountActionState,
  formData: FormData,
): Promise<StorefrontAccountActionState> {
  void previousState;
  const email = formString(formData, "email");
  const currentPassword = formString(formData, "currentPassword");
  const newPassword = formString(formData, "newPassword");

  if (!email) {
    return {
      status: "error",
      message: "Email es obligatorio.",
    };
  }

  if (!currentPassword) {
    return {
      status: "error",
      message: "Confirma tu password actual para cambiar credenciales.",
    };
  }

  if (newPassword && newPassword.length < 8) {
    return {
      status: "error",
      message: "La nueva password debe tener al menos 8 caracteres.",
    };
  }

  const result = await patchStorefrontCustomerProfile({
    email,
    currentPassword,
    ...(newPassword ? { newPassword } : {}),
  });

  if (!result.ok) {
    return {
      status: "error",
      message: result.status === 401 || result.status === 403
        ? "No se pudieron validar las credenciales actuales."
        : "No se pudieron actualizar las credenciales.",
    };
  }

  await updateStorefrontCustomerSessionEmail(result.data.profile.email);
  revalidatePath("/account");

  return {
    status: "success",
    message: result.data.security
      ? "Credenciales actualizadas. Las sesiones anteriores fueron revisadas por seguridad."
      : "Credenciales actualizadas.",
  };
}

export async function submitStorefrontAfterSalesCase(
  previousState: StorefrontAccountActionState,
  formData: FormData,
): Promise<StorefrontAccountActionState> {
  void previousState;
  const orderId = formString(formData, "orderId");
  const reasonCode = formString(formData, "reasonCode");
  const requestedResolution = formString(formData, "requestedResolution");
  const customerMessage = formString(formData, "customerMessage");
  const items = afterSalesCaseItemsFromForm(formData);
  const evidenceFiles = evidenceFilesFromForm(formData);

  if (!orderId) {
    return {
      status: "error",
      message: "Selecciona la compra asociada al caso.",
    };
  }

  if (!reasonCode || !requestedResolution) {
    return {
      status: "error",
      message: "Selecciona motivo y solucion solicitada.",
    };
  }

  if (!items) {
    return {
      status: "error",
      message: "Selecciona al menos un producto afectado y su cantidad.",
    };
  }

  if (customerMessage.length < 20) {
    return {
      status: "error",
      message: "Cuéntanos qué ha ocurrido con al menos 20 caracteres.",
    };
  }

  if (!evidenceFiles) {
    return {
      status: "error",
      message: "Puedes adjuntar hasta 15 imágenes válidas al abrir el caso.",
    };
  }

  for (const evidenceFile of evidenceFiles) {
    const fileError = await validateStorefrontEvidenceFile(evidenceFile);
    if (fileError) {
      return { status: "error", message: fileError };
    }
  }

  const result = await createStorefrontAfterSalesCase({
    orderId,
    reasonCode,
    requestedResolution,
    customerMessage,
    items,
    source: "storefront_account",
  });

  if (!result.ok) {
    return {
      status: "error",
      message: result.status === 401
        ? "Inicia sesion para abrir un caso de postventa."
        : "No pudimos abrir el caso. Revisa los datos e intentalo de nuevo.",
    };
  }

  revalidatePath("/account");

  if (evidenceFiles.length === 0) {
    return {
      caseId: result.data.caseId,
      status: "success",
      message: result.data.caseId
        ? `Caso ${result.data.caseId} creado. Te contactaremos por email.`
        : "Caso creado. Te contactaremos por email.",
    };
  }

  if (!result.data.caseId) {
    return {
      caseId: result.data.caseId,
      status: "success",
      message: "Caso creado. No pudimos vincular las imágenes automáticamente; podrás añadirlas desde el caso.",
    };
  }

  let uploadedEvidenceCount = 0;
  for (const evidenceFile of evidenceFiles) {
    const evidenceResult = await uploadStorefrontAfterSalesEvidence({
      caseId: result.data.caseId,
      messageId: null,
      file: evidenceFile,
      idempotencyKey: `ui-opening-evidence-${crypto.randomUUID()}`,
    });
    if (evidenceResult.ok) uploadedEvidenceCount += 1;
  }

  return {
    caseId: result.data.caseId,
    status: "success",
    message: uploadedEvidenceCount === evidenceFiles.length
      ? `Caso ${result.data.caseId} creado con ${uploadedEvidenceCount} ${uploadedEvidenceCount === 1 ? "imagen adjunta" : "imágenes adjuntas"}. Te contactaremos por email.`
      : `Caso ${result.data.caseId} creado. Se añadieron ${uploadedEvidenceCount} de ${evidenceFiles.length} imágenes; podrás reintentar las restantes desde el caso.`,
  };
}

export async function replyToStorefrontAfterSalesCaseAction(
  previousState: StorefrontAccountActionState,
  formData: FormData,
): Promise<StorefrontAccountActionState> {
  void previousState;
  const caseId = formString(formData, "caseId");
  const body = formString(formData, "body");
  if (!caseId || body.length < 2) {
    return { status: "error", message: "Escribe un mensaje para continuar el caso." };
  }
  const result = await replyToStorefrontAfterSalesCase(caseId, body, `ui-reply-${crypto.randomUUID()}`);
  if (!result.ok) {
    return { status: "error", message: result.status === 401 ? "Inicia sesión para responder." : "No pudimos enviar tu mensaje. Inténtalo de nuevo." };
  }
  revalidatePath("/account");
  return { status: "success", message: "Tu mensaje se añadió al historial del caso." };
}

export async function respondToStorefrontAfterSalesSolutionProposalAction(
  previousState: StorefrontAccountActionState,
  formData: FormData,
): Promise<StorefrontAccountActionState> {
  void previousState;
  const caseId = formString(formData, "caseId");
  const proposalId = formString(formData, "proposalId");
  const decision = formString(formData, "decision");
  if (!caseId || !proposalId || (decision !== "ACCEPT" && decision !== "REJECT")) {
    return { status: "error", message: "La respuesta a la propuesta no es válida." };
  }

  const result = await respondToStorefrontAfterSalesSolutionProposal(caseId, proposalId, decision);
  if (!result.ok) {
    return {
      status: "error",
      message: result.status === 401 ? "Inicia sesión para responder a la propuesta." : "No pudimos registrar tu respuesta. Inténtalo de nuevo.",
    };
  }

  revalidatePath("/account");
  return {
    status: "success",
    message: decision === "ACCEPT" ? "Has aceptado la propuesta. Te informaremos cuando iniciemos su ejecución." : "Has rechazado la propuesta. El equipo revisará una nueva alternativa.",
  };
}

export async function confirmStorefrontAfterSalesCompletionAction(
  previousState: StorefrontAccountActionState,
  formData: FormData,
): Promise<StorefrontAccountActionState> {
  void previousState;
  const caseId = formString(formData, "caseId");
  const note = formString(formData, "note");

  if (!caseId) {
    return { status: "error", message: "No encontramos el caso que deseas cerrar." };
  }
  if (note.length > 4_000) {
    return { status: "error", message: "La confirmación no puede superar 4.000 caracteres." };
  }

  const result = await confirmStorefrontAfterSalesCompletion(caseId, note || undefined);
  if (!result.ok) {
    return {
      status: "error",
      message: result.status === 401
        ? "Inicia sesión para confirmar el cierre."
        : "No pudimos confirmar el cierre. Actualiza el caso e inténtalo de nuevo.",
    };
  }

  revalidatePath("/account");
  return { status: "success", message: "Has confirmado la solución. El caso queda cerrado." };
}

export async function uploadStorefrontAfterSalesEvidenceAction(
  previousState: StorefrontAccountActionState,
  formData: FormData,
): Promise<StorefrontAccountActionState> {
  void previousState;
  const caseId = formString(formData, "caseId");
  const messageId = formString(formData, "messageId");
  const file = formData.get("evidence");
  if (!caseId || !(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Selecciona una imagen para adjuntar." };
  }
  const fileError = await validateStorefrontEvidenceFile(file);
  if (fileError) {
    return { status: "error", message: fileError };
  }
  const result = await uploadStorefrontAfterSalesEvidence({
    caseId,
    messageId: messageId || null,
    file,
    idempotencyKey: `ui-evidence-${crypto.randomUUID()}`,
  });
  if (!result.ok) {
    return { status: "error", message: evidenceUploadFailureMessage(result.status) };
  }
  revalidatePath("/account");
  return { status: "success", message: "Imagen analizada y añadida al caso." };
}

async function validateStorefrontEvidenceFile(file: File): Promise<string | null> {
  if (!allowedEvidenceMimeTypes.has(file.type)) {
    return "Solo se admiten archivos JPG, PNG o WebP.";
  }
  if (file.size > maxEvidenceFileBytes) {
    return "La imagen no puede superar 10 MB.";
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

function evidenceUploadFailureMessage(status: number | undefined) {
  if (status === 401) return "Inicia sesión para aportar una imagen.";
  if (status === 400 || status === 413 || status === 415 || status === 422) {
    return "La imagen fue rechazada. Usa JPG, PNG o WebP de hasta 10 MB.";
  }
  if (status === 409 || status === 429) {
    return "Has alcanzado el límite de evidencias para este caso o mensaje. Inténtalo más tarde.";
  }
  if (status === 503) {
    return "La aportación de imágenes está temporalmente no disponible.";
  }
  return "No pudimos adjuntar la imagen. Inténtalo de nuevo.";
}

export async function submitStorefrontAccountAddress(
  previousState: StorefrontAccountActionState,
  formData: FormData,
): Promise<StorefrontAccountActionState> {
  void previousState;
  const operation = addressOperation(formString(formData, "operation"));
  const addressId = formString(formData, "addressId");

  if (!operation) {
    return {
      status: "error",
      message: "Accion de direccion no soportada.",
    };
  }

  if (operation !== "create" && !addressId) {
    return {
      status: "error",
      message: "Selecciona una direccion valida.",
    };
  }

  if (operation === "delete") {
    const result = await deleteStorefrontCustomerAddress(addressId);
    return addressActionResult(result.ok, result.status, "Direccion eliminada.");
  }

  if (operation === "default-shipping" || operation === "default-billing") {
    const result = await setStorefrontCustomerAddressDefault(addressId, operation === "default-shipping" ? "shipping" : "billing");
    return addressActionResult(result.ok, result.status, operation === "default-shipping" ? "Direccion de envio actualizada." : "Direccion fiscal actualizada.");
  }

  const payload = addressPayloadFromForm(formData);
  const validationError = validateAddressPayload(payload);
  if (validationError) {
    return {
      status: "error",
      message: validationError,
    };
  }

  const result = operation === "create"
    ? await createStorefrontCustomerAddress(payload)
    : await patchStorefrontCustomerAddress(addressId, payload);

  return addressActionResult(result.ok, result.status, operation === "create" ? "Direccion guardada." : "Direccion actualizada.");
}

export async function closeStorefrontAccountSessions(
  previousState: StorefrontAccountActionState,
  formData: FormData,
): Promise<StorefrontAccountActionState> {
  void previousState;
  const operation = sessionOperation(formString(formData, "operation"));

  if (!operation) {
    return {
      status: "error",
      message: "Accion de sesion no soportada.",
    };
  }

  if (operation === "current") {
    const result = await logoutCurrentStorefrontSession();
    if (!result.ok) {
      return sessionActionResult(false, result.status, "No pudimos cerrar esta sesion.");
    }

    await clearStorefrontCustomerSession();
    revalidatePath("/");
    redirect("/");
  }

  const result = await logoutAllStorefrontSessions(operation === "all");

  if (!result.ok) {
    return sessionActionResult(false, result.status, "No pudimos cerrar las sesiones.");
  }

  if (result.data.currentSessionRevoked) {
    await clearStorefrontCustomerSession();
    revalidatePath("/");
    redirect("/");
  }

  revalidatePath("/account");

  return {
    status: "success",
    message: result.data.revokedSessions > 0
      ? `${result.data.revokedSessions} sesion(es) cerrada(s).`
      : "No habia otras sesiones activas que cerrar.",
  };
}

export async function logoutStorefrontCustomer(): Promise<void> {
  try {
    await logoutCurrentStorefrontSession();
  } finally {
    await clearStorefrontCustomerSession();
  }
  revalidatePath("/");
  redirect("/");
}

function addressPayloadFromForm(formData: FormData) {
  return {
    alias: formString(formData, "alias"),
    addressType: formString(formData, "addressType") || "residential",
    addressRole: formString(formData, "addressRole") || "BOTH",
    receiverName: formString(formData, "receiverName"),
    street: formString(formData, "street"),
    number: formString(formData, "number"),
    neighborhood: formString(formData, "neighborhood") || null,
    city: formString(formData, "city"),
    state: formString(formData, "state"),
    country: formString(formData, "country") || "ES",
    postalCode: formString(formData, "postalCode"),
    complement: formString(formData, "complement") || null,
    reference: formString(formData, "reference") || null,
  };
}

function validateAddressPayload(payload: ReturnType<typeof addressPayloadFromForm>) {
  if (payload.alias.length < 2 || payload.alias.length > 40) {
    return "El alias debe tener entre 2 y 40 caracteres.";
  }

  if (!payload.receiverName || !payload.street || !payload.number || !payload.city || !payload.state || !payload.country || !payload.postalCode) {
    return "Completa los campos obligatorios de la direccion.";
  }

  if (payload.postalCode.length < 4) {
    return "Introduce un codigo postal valido.";
  }

  return null;
}

function addressActionResult(ok: boolean, status: number | undefined, successMessage: string): StorefrontAccountActionState {
  if (ok) {
    revalidatePath("/account");
    return {
      status: "success",
      message: successMessage,
    };
  }

  if (status === 401) {
    return {
      status: "error",
      message: "Inicia sesion para gestionar direcciones.",
    };
  }

  if (status === 409) {
    return {
      status: "error",
      message: "Revisa el alias o el limite de direcciones guardadas.",
    };
  }

  return {
    status: "error",
    message: "No se pudo guardar la libreta de direcciones.",
  };
}

function sessionActionResult(ok: boolean, status: number | undefined, fallbackError: string): StorefrontAccountActionState {
  if (ok) {
    return {
      status: "success",
      message: "Sesiones actualizadas.",
    };
  }

  return {
    status: "error",
    message: status === 401
      ? "Vuelve a iniciar sesion para gestionar tus dispositivos."
      : fallbackError,
  };
}

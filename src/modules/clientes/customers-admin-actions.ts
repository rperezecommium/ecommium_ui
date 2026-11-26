"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestAdminBff } from "../../shared/bff/admin-client";
import { getAdminSession } from "../../shared/auth/session";
import type { AdminFormState } from "../../shared/validation/admin-form-state";
import { getAdminContext } from "../../shared/config/admin-context";

function asString(value: FormDataEntryValue | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNullableString(value: FormDataEntryValue | null) {
  return asString(value) ?? null;
}

function asBoolean(value: FormDataEntryValue | null) {
  return value === "true" || value === "on";
}

function requiredString(value: FormDataEntryValue | null, label: string) {
  const normalized = asString(value);
  if (!normalized) {
    throw new Error(`${label} requerido.`);
  }

  return normalized;
}

function buyerType(value: FormDataEntryValue | null) {
  const normalized = asString(value);
  if (normalized && !["PRIVATE_BUYER", "BUSINESS_BUYER"].includes(normalized)) throw new Error("Tipo comprador inválido.");
  return normalized === "BUSINESS_BUYER" ? "BUSINESS_BUYER" : "PRIVATE_BUYER";
}

function addressRole(value: FormDataEntryValue | null) {
  const normalized = asString(value);
  return normalized === "SHIPPING" || normalized === "BILLING" ? normalized : "BOTH";
}

function scopedPath(path: string, organizationId: string, shopId: string) {
  return `${path}?${new URLSearchParams({ organizationId, shopId }).toString()}`;
}

function customerDetailReturnPath(value: FormDataEntryValue | null | undefined) {
  const returnTo = asString(value);
  if (!returnTo?.startsWith("/admin/clientes/")) {
    return undefined;
  }

  const [pathname, query = ""] = returnTo.split("?", 2);
  if (!pathname.startsWith("/admin/clientes/")) {
    return undefined;
  }

  return `${pathname}${query ? `?${query}` : ""}`;
}

function customersReturnPath(message: string, customerId?: string, returnTo?: FormDataEntryValue | null) {
  const detailPath = customerDetailReturnPath(returnTo);
  if (detailPath) {
    const [pathname, query = ""] = detailPath.split("?", 2);
    const params = new URLSearchParams(query);
    params.set("customerMessage", message);
    return `${pathname}?${params.toString()}`;
  }

  const params = new URLSearchParams({ customerMessage: message });
  if (customerId) {
    params.set("drawer", "detail");
    params.set("customerId", customerId);
  }

  return `/admin/clientes?${params.toString()}`;
}

function mutationMessage(status: number | undefined, fallback: string) {
  return status === 403 ? "Falta permiso customers.addresses.write." : fallback;
}

function profileMutationMessage(status: number | undefined, fallback: string) {
  if (status === 409) return "El perfil o su grupo comercial ha cambiado. No se ha guardado. Conserva tus cambios y recarga el perfil para revisar la versión actual.";
  return mutationMessage(status, fallback);
}

async function canWriteCustomerProfile() {
  const session = await getAdminSession();
  return Boolean(session?.employeeId && session.scope === "admin" && session.permissions.some(permission =>
    ["*", "admin:*", "system.admin", "customers.addresses.write"].includes(permission.trim().toLowerCase())));
}

function customerMutationMessage(status: number | undefined, fallback: string, permission: string) {
  return status === 403 ? `Falta permiso ${permission}.` : fallback;
}

async function actor() {
  const session = await getAdminSession();

  return {
    actorId: session?.employeeId ?? "admin-ui",
    actorEmail: session?.email ?? "admin@ecommium.local",
  };
}

async function customerJsonMutation(
  formData: FormData,
  pathSuffix: string,
  method: "POST" | "PATCH" | "PUT",
  payload: unknown,
  successMessage: string,
  permission: string,
): Promise<never> {
  const context = await getAdminContext();
  const customerId = requiredString(formData.get("customerId"), "customerId");
  const result = await requestAdminBff(
    scopedPath(`/admin/customers/${encodeURIComponent(customerId)}${pathSuffix}`, context.organizationId, context.shopId),
    {
      context,
      init: {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    },
  );

  revalidatePath("/admin/clientes");
  if (!result.ok) {
    redirect(customersReturnPath(customerMutationMessage(result.status, result.error, permission), customerId, formData.get("returnTo")));
  }

  redirect(customersReturnPath(successMessage, customerId, formData.get("returnTo")));
}

async function customerEmptyMutation(
  formData: FormData,
  pathSuffix: string,
  method: "POST" | "PATCH",
  successMessage: string,
  permission: string,
): Promise<never> {
  const context = await getAdminContext();
  const customerId = requiredString(formData.get("customerId"), "customerId");
  const result = await requestAdminBff(
    scopedPath(`/admin/customers/${encodeURIComponent(customerId)}${pathSuffix}`, context.organizationId, context.shopId),
    {
      context,
      init: { method },
    },
  );

  revalidatePath("/admin/clientes");
  if (!result.ok) {
    redirect(customersReturnPath(customerMutationMessage(result.status, result.error, permission), customerId, formData.get("returnTo")));
  }

  redirect(customersReturnPath(successMessage, customerId, formData.get("returnTo")));
}

function parseProfileWriteReceipt(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Recibo de perfil inválido.");
  const data = value as Record<string, unknown>;
  if (typeof data.customerId !== "string" || !data.customerId.trim() || data.customerId.length > 200) throw new Error("Identidad de perfil inválida.");
  return { customerId: data.customerId };
}

function profilePayload(formData: FormData) {
  const preferences: { locale?: string; optinNewsLetter?: boolean } = {
    locale: asString(formData.get("locale")),
  };
  if (formData.has("optinNewsLetter")) {
    preferences.optinNewsLetter = asBoolean(formData.get("optinNewsLetter"));
  }

  return {
    firstName: requiredString(formData.get("firstName"), "Nombre"),
    lastName: requiredString(formData.get("lastName"), "Apellido"),
    documentNumber: asNullableString(formData.get("documentNumber")),
    phone: asNullableString(formData.get("phone")),
    buyerType: buyerType(formData.get("buyerType")),
    ...commercialMembershipPayload(formData),
    clientPreferencesData: preferences,
  };
}

function commercialMembershipPayload(formData: FormData) {
  if (formData.get("commercialMembershipIncluded") !== "true") return {};
  const groupCode = asString(formData.get("commercialGroupCode")) ?? null;
  if (groupCode !== null && !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(groupCode)) throw new Error("Grupo comercial inválido.");
  const approval = formData.get("commercialB2bApproved");
  if (approval !== null && !["on", "true", "false"].includes(String(approval))) throw new Error("Aprobación comercial inválida.");
  if (asBoolean(approval) && buyerType(formData.get("buyerType")) !== "BUSINESS_BUYER") throw new Error("Para aprobar condiciones B2B, selecciona Empresa como tipo comprador.");
  const rawRevision = formData.get("commercialMembershipRevision");
  const expectedRevision = typeof rawRevision === "string" && /^\d+$/.test(rawRevision) ? Number(rawRevision) : NaN;
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error("Revisión del grupo inválida. Recarga el perfil.");
  const password = formData.get("commercialCurrentPassword");
  if (typeof password !== "string" || !password.trim() || password.length > 256) throw new Error("Confirma el cambio comercial con tu contraseña de administrador.");
  return { currentPassword: password, commercialMembership: { groupCode, b2bApproved: asBoolean(formData.get("commercialB2bApproved")), expectedRevision, reason: "Asignación manual desde el perfil Admin" } };
}

function addressPayload(formData: FormData) {
  return {
    alias: requiredString(formData.get("alias"), "Nombre de la dirección"),
    addressType: asString(formData.get("addressType")) ?? "residential",
    addressRole: addressRole(formData.get("addressRole")),
    receiverName: requiredString(formData.get("receiverName"), "Receptor"),
    street: requiredString(formData.get("street"), "Calle"),
    number: requiredString(formData.get("number"), "Numero"),
    neighborhood: asNullableString(formData.get("neighborhood")),
    city: requiredString(formData.get("city"), "Ciudad"),
    state: requiredString(formData.get("state"), "Provincia/estado"),
    country: requiredString(formData.get("country"), "Pais").toUpperCase(),
    postalCode: requiredString(formData.get("postalCode"), "Codigo postal"),
    complement: asNullableString(formData.get("complement")),
    reference: asNullableString(formData.get("reference")),
  };
}

export async function applyCustomersFiltersAction(formData: FormData): Promise<never> {
  const params = new URLSearchParams();
  const q = asString(formData.get("q"));
  const email = asString(formData.get("email"));
  const limit = asString(formData.get("limit"));

  if (q) {
    params.set("q", q);
  }
  if (email) {
    params.set("email", email);
  }
  if (limit) {
    params.set("limit", limit);
  }

  redirect(`/admin/clientes${params.size ? `?${params.toString()}` : ""}`);
}

export async function createCustomerAction(formData: FormData): Promise<never> {
  if (!await canWriteCustomerProfile()) redirect(customersReturnPath("Falta permiso customers.addresses.write."));
  const context = await getAdminContext();
  const email = requiredString(formData.get("email"), "Email").toLowerCase();
  const payload = {
    organizationId: context.organizationId,
    shopId: context.shopId,
    email,
    ...profilePayload(formData),
  };

  const result = await requestAdminBff<{ customerId?: string }>(
    scopedPath("/admin/customers", context.organizationId, context.shopId),
    {
      context,
      parse: parseProfileWriteReceipt,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    },
  );

  revalidatePath("/admin/clientes");
  if (!result.ok) {
    redirect(customersReturnPath(mutationMessage(result.status, result.error)));
  }

  redirect(customersReturnPath("Cliente creado.", result.data.customerId));
}

async function saveCustomerProfile(formData: FormData): Promise<AdminFormState> {
  if (!await canWriteCustomerProfile()) return { error: "Falta permiso customers.addresses.write." };
  let payload;
  let customerId;
  try {
    customerId = requiredString(formData.get("customerId"), "customerId");
    payload = profilePayload(formData);
  } catch (error) {
    if (error instanceof Error && ["Para aprobar condiciones B2B, selecciona Empresa como tipo comprador.", "Confirma el cambio comercial con tu contraseña de administrador."].includes(error.message)) return { error: error.message };
    return { error: "Revisa nombre, apellido y datos comerciales. La revisión debe ser válida; recarga el perfil si ha cambiado." };
  }
  const context = await getAdminContext();
  const result = await requestAdminBff<{ customerId?: string }>(
    scopedPath(`/admin/customers/${encodeURIComponent(customerId)}`, context.organizationId, context.shopId),
    { context, parse: value => {
      const receipt = parseProfileWriteReceipt(value);
      if (receipt.customerId !== customerId) throw new Error("Identidad de perfil incompatible.");
      return receipt;
    }, init: { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) } },
  );
  if (!result.ok && payload.commercialMembership && result.status === 403) return { error: "No se ha podido confirmar el cambio comercial. Revisa tu contraseña y tus permisos. No se ha guardado el perfil." };
  if (!result.ok && result.status === 429) return { error: "Demasiados intentos de confirmación. Espera antes de volver a intentarlo." };
  if (!result.ok) return { error: profileMutationMessage(result.status, "No se ha podido confirmar el guardado del perfil. Comprueba su estado antes de volver a guardar.") };
  revalidatePath("/admin/clientes");
  return {};
}

export async function updateCustomerProfileAction(formData: FormData): Promise<never> {
  profilePayload(formData);
  const result = await saveCustomerProfile(formData);
  redirect(customersReturnPath(result.error ?? "Cliente actualizado.", asString(formData.get("customerId")), formData.get("returnTo")));
}

export async function updateCustomerProfileFormAction(_state: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const result = await saveCustomerProfile(formData);
  if (result.error) return result;
  redirect(customersReturnPath("Cliente actualizado.", asString(formData.get("customerId")), formData.get("returnTo")));
}

export async function createCustomerAddressAction(formData: FormData): Promise<never> {
  const context = await getAdminContext();
  const customerId = requiredString(formData.get("customerId"), "customerId");
  const result = await requestAdminBff(
    scopedPath(`/admin/customers/${encodeURIComponent(customerId)}/addresses`, context.organizationId, context.shopId),
    {
      context,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(addressPayload(formData)),
      },
    },
  );

  revalidatePath("/admin/clientes");
  if (!result.ok) {
    redirect(customersReturnPath(mutationMessage(result.status, result.error), customerId, formData.get("returnTo")));
  }

  redirect(customersReturnPath("Direccion creada.", customerId, formData.get("returnTo")));
}

export async function updateCustomerAddressAction(formData: FormData): Promise<never> {
  const context = await getAdminContext();
  const customerId = requiredString(formData.get("customerId"), "customerId");
  const addressId = requiredString(formData.get("addressId"), "addressId");
  const result = await requestAdminBff(
    scopedPath(
      `/admin/customers/${encodeURIComponent(customerId)}/addresses/${encodeURIComponent(addressId)}`,
      context.organizationId,
      context.shopId,
    ),
    {
      context,
      init: {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(addressPayload(formData)),
      },
    },
  );

  revalidatePath("/admin/clientes");
  if (!result.ok) {
    redirect(customersReturnPath(mutationMessage(result.status, result.error), customerId, formData.get("returnTo")));
  }

  redirect(customersReturnPath("Direccion actualizada.", customerId, formData.get("returnTo")));
}

export async function deleteCustomerAddressAction(formData: FormData): Promise<never> {
  const context = await getAdminContext();
  const customerId = requiredString(formData.get("customerId"), "customerId");
  const addressId = requiredString(formData.get("addressId"), "addressId");
  const result = await requestAdminBff(
    scopedPath(
      `/admin/customers/${encodeURIComponent(customerId)}/addresses/${encodeURIComponent(addressId)}`,
      context.organizationId,
      context.shopId,
    ),
    {
      context,
      init: { method: "DELETE" },
    },
  );

  revalidatePath("/admin/clientes");
  if (!result.ok) {
    redirect(customersReturnPath(mutationMessage(result.status, result.error), customerId, formData.get("returnTo")));
  }

  redirect(customersReturnPath("Direccion eliminada.", customerId, formData.get("returnTo")));
}

export async function setDefaultShippingAddressAction(formData: FormData): Promise<never> {
  const context = await getAdminContext();
  const customerId = requiredString(formData.get("customerId"), "customerId");
  const addressId = requiredString(formData.get("addressId"), "addressId");
  const result = await requestAdminBff(
    scopedPath(
      `/admin/customers/${encodeURIComponent(customerId)}/addresses/${encodeURIComponent(addressId)}/default-shipping`,
      context.organizationId,
      context.shopId,
    ),
    {
      context,
      init: { method: "PATCH" },
    },
  );

  revalidatePath("/admin/clientes");
  if (!result.ok) {
    redirect(customersReturnPath(mutationMessage(result.status, result.error), customerId, formData.get("returnTo")));
  }

  redirect(customersReturnPath("Direccion de envio actualizada.", customerId, formData.get("returnTo")));
}

export async function setDefaultBillingAddressAction(formData: FormData): Promise<never> {
  const context = await getAdminContext();
  const customerId = requiredString(formData.get("customerId"), "customerId");
  const addressId = requiredString(formData.get("addressId"), "addressId");
  const result = await requestAdminBff(
    scopedPath(
      `/admin/customers/${encodeURIComponent(customerId)}/addresses/${encodeURIComponent(addressId)}/default-billing`,
      context.organizationId,
      context.shopId,
    ),
    {
      context,
      init: { method: "PATCH" },
    },
  );

  revalidatePath("/admin/clientes");
  if (!result.ok) {
    redirect(customersReturnPath(mutationMessage(result.status, result.error), customerId, formData.get("returnTo")));
  }

  redirect(customersReturnPath("Direccion fiscal actualizada.", customerId, formData.get("returnTo")));
}

export async function setCustomerAccountActivationAction(formData: FormData): Promise<never> {
  const currentActor = await actor();

  return customerJsonMutation(
    formData,
    "/account/activation",
    "PATCH",
    {
      active: asBoolean(formData.get("active")),
      actorId: currentActor.actorId,
      actorEmail: currentActor.actorEmail,
      reason: asNullableString(formData.get("reason")),
    },
    asBoolean(formData.get("active")) ? "Cuenta reactivada." : "Cuenta bloqueada.",
    "customers.account.write",
  );
}

export async function resendCustomerActivationAction(formData: FormData): Promise<never> {
  const currentActor = await actor();

  return customerJsonMutation(
    formData,
    "/account/activation/resend",
    "POST",
    {
      locale: asString(formData.get("locale")) ?? "es-ES",
      actorId: currentActor.actorId,
      actorEmail: currentActor.actorEmail,
      reason: asNullableString(formData.get("reason")),
    },
    "Activacion reenviada.",
    "customers.account.write",
  );
}

export async function requestCustomerPasswordResetAction(formData: FormData): Promise<never> {
  const currentActor = await actor();

  return customerJsonMutation(
    formData,
    "/account/password-reset/request",
    "POST",
    {
      locale: asString(formData.get("locale")) ?? "es-ES",
      actorId: currentActor.actorId,
      actorEmail: currentActor.actorEmail,
      reason: asNullableString(formData.get("reason")),
    },
    "Reset de password solicitado.",
    "customers.account.write",
  );
}

export async function testResetCustomerAction(formData: FormData): Promise<never> {
  const context = await getAdminContext();
  const customerId = requiredString(formData.get("customerId"), "customerId");
  const confirmEmail = requiredString(formData.get("confirmEmail"), "Email").toLowerCase();
  const result = await requestAdminBff(
    scopedPath(`/admin/customers/${encodeURIComponent(customerId)}/test-reset`, context.organizationId, context.shopId),
    {
      context,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmEmail }),
      },
    },
  );

  revalidatePath("/admin/clientes");
  if (!result.ok) {
    redirect(customersReturnPath(customerMutationMessage(result.status, result.error, "customers.privacy.write"), customerId));
  }

  redirect(customersReturnPath(`Fixture reiniciado para ${confirmEmail}.`));
}

export async function executeCustomerPrivacyErasureAction(formData: FormData): Promise<never> {
  const currentActor = await actor();

  return customerJsonMutation(
    formData,
    "/privacy-erasure/execute",
    "POST",
    {
      requestId: asNullableString(formData.get("requestId")),
      reason: requiredString(formData.get("reason"), "Motivo legal"),
      actorId: currentActor.actorId,
      actorEmail: currentActor.actorEmail,
    },
    "Baja legal ejecutada: PII anonimizada y acceso revocado.",
    "customers.privacy.write",
  );
}

export async function createCustomerNoteAction(formData: FormData): Promise<never> {
  const currentActor = await actor();

  return customerJsonMutation(
    formData,
    "/notes",
    "POST",
    {
      authorId: currentActor.actorId,
      authorEmail: currentActor.actorEmail,
      body: requiredString(formData.get("body"), "Nota"),
      visibility: "ADMIN",
    },
    "Nota interna creada.",
    "customers.notes.write",
  );
}

export async function replaceCustomerTagsAction(formData: FormData): Promise<never> {
  const items = (asString(formData.get("tags")) ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((label) => ({
      tagKey: label.toLowerCase().replaceAll(" ", "-"),
      label,
    }));

  return customerJsonMutation(
    formData,
    "/tags",
    "PUT",
    { items },
    "Tags internos actualizados.",
    "customers.tags.write",
  );
}

export async function createCustomerTaskAction(formData: FormData): Promise<never> {
  const currentActor = await actor();

  return customerJsonMutation(
    formData,
    "/tasks",
    "POST",
    {
      title: requiredString(formData.get("title"), "Tarea"),
      description: asNullableString(formData.get("description")),
      assignedEmployeeId: asNullableString(formData.get("assignedEmployeeId")),
      dueAt: asNullableString(formData.get("dueAt")),
      createdBy: currentActor.actorId,
    },
    "Tarea creada.",
    "customers.tasks.write",
  );
}

export async function updateCustomerTaskStatusAction(formData: FormData): Promise<never> {
  const taskId = requiredString(formData.get("taskId"), "taskId");

  return customerJsonMutation(
    formData,
    `/tasks/${encodeURIComponent(taskId)}`,
    "PATCH",
    { status: asString(formData.get("status")) ?? "DONE" },
    "Tarea actualizada.",
    "customers.tasks.write",
  );
}

export async function createCustomerPrivacyRequestAction(formData: FormData): Promise<never> {
  const currentActor = await actor();

  return customerJsonMutation(
    formData,
    "/privacy-requests",
    "POST",
    {
      requestType: asString(formData.get("requestType")) ?? "ACCESS",
      requestedBy: currentActor.actorId,
      requesterEmail: currentActor.actorEmail,
      reason: asNullableString(formData.get("reason")),
    },
    "Solicitud de privacidad creada.",
    "customers.privacy.write",
  );
}

export async function updateCustomerPrivacyRequestStatusAction(formData: FormData): Promise<never> {
  const currentActor = await actor();
  const requestId = requiredString(formData.get("requestId"), "requestId");

  return customerJsonMutation(
    formData,
    `/privacy-requests/${encodeURIComponent(requestId)}`,
    "PATCH",
    {
      status: asString(formData.get("status")) ?? "IN_REVIEW",
      resolution: asNullableString(formData.get("resolution")),
      resolvedBy: currentActor.actorId,
    },
    "Solicitud de privacidad actualizada.",
    "customers.privacy.write",
  );
}

export async function recordCustomerConsentAction(formData: FormData): Promise<never> {
  const currentActor = await actor();

  return customerJsonMutation(
    formData,
    "/consents",
    "POST",
    {
      consentType: "MARKETING_EMAIL",
      granted: asBoolean(formData.get("granted")),
      source: "ADMIN",
      actorId: currentActor.actorId,
      actorEmail: currentActor.actorEmail,
      reason: asNullableString(formData.get("reason")),
    },
    "Consentimiento actualizado.",
    "customers.consents.write",
  );
}

export async function revokeCustomerSessionsAction(formData: FormData): Promise<never> {
  const currentActor = await actor();

  return customerJsonMutation(
    formData,
    "/sessions/revoke",
    "POST",
    {
      actorId: currentActor.actorId,
      actorEmail: currentActor.actorEmail,
      reason: asNullableString(formData.get("reason")),
    },
    "Sesiones revocadas.",
    "customers.sessions.write",
  );
}

export async function sendCustomerEmailAction(formData: FormData): Promise<never> {
  const customerId = requiredString(formData.get("customerId"), "customerId");
  const templateKey = requiredString(formData.get("templateKey"), "template");

  return customerJsonMutation(
    formData,
    "/communications/email",
    "POST",
    {
      templateKey,
      locale: asString(formData.get("locale")) ?? "es-ES",
      data: {
        message: asString(formData.get("message")) ?? "",
      },
      idempotencyKey: `admin-customer-email-${customerId}-${templateKey}`,
    },
    "Email enviado.",
    "customers.communications.write",
  );
}

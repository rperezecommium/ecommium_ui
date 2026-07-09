"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestBff } from "../../shared/bff/client";
import { getAdminSession } from "../../shared/auth/session";
import { getAdminContext } from "../../shared/config/admin-context";

function asString(value: FormDataEntryValue | null) {
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
  return normalized === "BUSINESS_BUYER" ? "BUSINESS_BUYER" : "PRIVATE_BUYER";
}

function addressRole(value: FormDataEntryValue | null) {
  const normalized = asString(value);
  return normalized === "SHIPPING" || normalized === "BILLING" ? normalized : "BOTH";
}

function scopedPath(path: string, organizationId: string, shopId: string) {
  return `${path}?${new URLSearchParams({ organizationId, shopId }).toString()}`;
}

function customersReturnPath(message: string, customerId?: string) {
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
  const result = await requestBff(
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
    redirect(customersReturnPath(customerMutationMessage(result.status, result.error, permission), customerId));
  }

  redirect(customersReturnPath(successMessage, customerId));
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
  const result = await requestBff(
    scopedPath(`/admin/customers/${encodeURIComponent(customerId)}${pathSuffix}`, context.organizationId, context.shopId),
    {
      context,
      init: { method },
    },
  );

  revalidatePath("/admin/clientes");
  if (!result.ok) {
    redirect(customersReturnPath(customerMutationMessage(result.status, result.error, permission), customerId));
  }

  redirect(customersReturnPath(successMessage, customerId));
}

function profilePayload(formData: FormData) {
  return {
    firstName: requiredString(formData.get("firstName"), "Nombre"),
    lastName: requiredString(formData.get("lastName"), "Apellido"),
    documentNumber: asNullableString(formData.get("documentNumber")),
    phone: asNullableString(formData.get("phone")),
    buyerType: buyerType(formData.get("buyerType")),
    clientPreferencesData: {
      locale: asString(formData.get("locale")),
      optinNewsLetter: asBoolean(formData.get("optinNewsLetter")),
    },
  };
}

function addressPayload(formData: FormData) {
  return {
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
  const context = await getAdminContext();
  const email = requiredString(formData.get("email"), "Email").toLowerCase();
  const payload = {
    organizationId: context.organizationId,
    shopId: context.shopId,
    email,
    ...profilePayload(formData),
  };

  const result = await requestBff<{ customerId?: string }>(
    scopedPath("/admin/customers", context.organizationId, context.shopId),
    {
      context,
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

export async function updateCustomerProfileAction(formData: FormData): Promise<never> {
  const context = await getAdminContext();
  const customerId = requiredString(formData.get("customerId"), "customerId");
  const result = await requestBff<{ customerId?: string }>(
    scopedPath(`/admin/customers/${encodeURIComponent(customerId)}`, context.organizationId, context.shopId),
    {
      context,
      init: {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(profilePayload(formData)),
      },
    },
  );

  revalidatePath("/admin/clientes");
  if (!result.ok) {
    redirect(customersReturnPath(mutationMessage(result.status, result.error), customerId));
  }

  redirect(customersReturnPath("Cliente actualizado.", customerId));
}

export async function createCustomerAddressAction(formData: FormData): Promise<never> {
  const context = await getAdminContext();
  const customerId = requiredString(formData.get("customerId"), "customerId");
  const result = await requestBff(
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
    redirect(customersReturnPath(mutationMessage(result.status, result.error), customerId));
  }

  redirect(customersReturnPath("Direccion creada.", customerId));
}

export async function updateCustomerAddressAction(formData: FormData): Promise<never> {
  const context = await getAdminContext();
  const customerId = requiredString(formData.get("customerId"), "customerId");
  const addressId = requiredString(formData.get("addressId"), "addressId");
  const result = await requestBff(
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
    redirect(customersReturnPath(mutationMessage(result.status, result.error), customerId));
  }

  redirect(customersReturnPath("Direccion actualizada.", customerId));
}

export async function deleteCustomerAddressAction(formData: FormData): Promise<never> {
  const context = await getAdminContext();
  const customerId = requiredString(formData.get("customerId"), "customerId");
  const addressId = requiredString(formData.get("addressId"), "addressId");
  const result = await requestBff(
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
    redirect(customersReturnPath(mutationMessage(result.status, result.error), customerId));
  }

  redirect(customersReturnPath("Direccion eliminada.", customerId));
}

export async function setDefaultShippingAddressAction(formData: FormData): Promise<never> {
  const context = await getAdminContext();
  const customerId = requiredString(formData.get("customerId"), "customerId");
  const addressId = requiredString(formData.get("addressId"), "addressId");
  const result = await requestBff(
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
    redirect(customersReturnPath(mutationMessage(result.status, result.error), customerId));
  }

  redirect(customersReturnPath("Direccion de envio actualizada.", customerId));
}

export async function setDefaultBillingAddressAction(formData: FormData): Promise<never> {
  const context = await getAdminContext();
  const customerId = requiredString(formData.get("customerId"), "customerId");
  const addressId = requiredString(formData.get("addressId"), "addressId");
  const result = await requestBff(
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
    redirect(customersReturnPath(mutationMessage(result.status, result.error), customerId));
  }

  redirect(customersReturnPath("Direccion fiscal actualizada.", customerId));
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
  const result = await requestBff(
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

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearStorefrontCustomerSession, updateStorefrontCustomerSessionEmail } from "./storefront-customer-session";
import {
  createStorefrontAfterSalesCase,
  createStorefrontCustomerAddress,
  deleteStorefrontCustomerAddress,
  patchStorefrontCustomerAddress,
  patchStorefrontCustomerProfile,
  setStorefrontCustomerAddressDefault,
} from "./storefront-account";

export type StorefrontAccountActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

type AddressOperation = "create" | "update" | "delete" | "default-shipping" | "default-billing";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function formBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function addressOperation(value: string): AddressOperation | null {
  return ["create", "update", "delete", "default-shipping", "default-billing"].includes(value)
    ? value as AddressOperation
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

  if (customerMessage.length < 20) {
    return {
      status: "error",
      message: "Describe el caso con al menos 20 caracteres.",
    };
  }

  const result = await createStorefrontAfterSalesCase({
    orderId,
    reasonCode,
    requestedResolution,
    customerMessage,
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

  return {
    status: "success",
    message: result.data.caseId
      ? `Caso ${result.data.caseId} creado. Te contactaremos por email.`
      : "Caso creado. Te contactaremos por email.",
  };
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

export async function logoutStorefrontCustomer(): Promise<void> {
  await clearStorefrontCustomerSession();
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

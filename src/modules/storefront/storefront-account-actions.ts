"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearStorefrontCustomerSession, updateStorefrontCustomerSessionEmail } from "./storefront-customer-session";
import { createStorefrontAfterSalesCase, patchStorefrontCustomerProfile } from "./storefront-account";

export type StorefrontAccountActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function formBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
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

export async function logoutStorefrontCustomer(): Promise<void> {
  await clearStorefrontCustomerSession();
  revalidatePath("/");
  redirect("/");
}

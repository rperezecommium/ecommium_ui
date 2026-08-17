"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requestAdminBff } from "../../shared/bff/admin-client";
import {
  adminCredentialRecoveryCookieName,
  unsealAdminCredentialRecoveryToken,
} from "../../shared/auth/admin-credential-recovery-cookie";
import { clearAdminContext } from "../../shared/config/admin-context";
import { clearAdminSession, getAdminSession } from "../../shared/auth/session";

const recoveryPath = "/auth/admin/password-recovery";
const recoveryCompletePath = "/auth/admin/password-recovery/complete";

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function secret(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function recoveryRedirect(kind: "error" | "notice", message: string): never {
  redirect(`${recoveryPath}?${kind}=${encodeURIComponent(message)}`);
}

function recoveryCompleteRedirect(kind: "error" | "notice", message: string): never {
  redirect(`${recoveryCompletePath}?${kind}=${encodeURIComponent(message)}`);
}

function safeAdminReturnPath(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.startsWith("/admin/")
    ? value
    : "/admin/configuracion/seguridad";
}

function validPassword(value: string) {
  return value.length >= 8 && value.length <= 256;
}

function credentialError(status?: number) {
  if (status === 429) {
    return "Demasiados intentos. Espera unos minutos antes de volver a intentarlo.";
  }

  if (status === 403) {
    return "Confirma primero tu identidad con tu contraseña actual.";
  }

  return "No se pudo completar la operación de credenciales. Inténtalo de nuevo.";
}

export async function requestAdminPasswordRecoveryAction(formData: FormData) {
  const email = text(formData.get("email")).toLowerCase();
  if (!email || email.length > 256 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    recoveryRedirect("error", "Escribe un email válido para continuar.");
  }

  const result = await requestAdminBff<{ accepted: true }>("/admin/auth/password-recovery/request", {
    withAuth: false,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, locale: "es-ES" }),
    },
  });

  if (!result.ok && result.status !== 202) {
    recoveryRedirect("error", "No se pudo procesar la solicitud ahora. Vuelve a intentarlo más tarde.");
  }

  recoveryRedirect("notice", "Si existe una cuenta elegible, recibirás un enlace para crear una contraseña nueva.");
}

export async function completeAdminPasswordRecoveryAction(formData: FormData) {
  const cookieStore = await cookies();
  const token = unsealAdminCredentialRecoveryToken(
    cookieStore.get(adminCredentialRecoveryCookieName)?.value,
  );
  const newPassword = secret(formData.get("newPassword"));
  const confirmation = secret(formData.get("confirmation"));

  if (!token) {
    recoveryCompleteRedirect("error", "El enlace ya no está disponible. Solicita uno nuevo.");
  }

  if (!validPassword(newPassword)) {
    recoveryCompleteRedirect("error", "La nueva contraseña debe tener entre 8 y 256 caracteres.");
  }

  if (newPassword !== confirmation) {
    recoveryCompleteRedirect("error", "Las contraseñas no coinciden.");
  }

  const result = await requestAdminBff<{ status: "password_reset"; security?: { requiresLogin?: boolean } }>(
    "/admin/auth/password-recovery/complete",
    {
      withAuth: false,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      },
    },
  );

  if (!result.ok) {
    if (result.status !== 503) {
      cookieStore.delete(adminCredentialRecoveryCookieName);
    }
    recoveryCompleteRedirect("error", "No se pudo completar la recuperación. Solicita un enlace nuevo si el problema continúa.");
  }

  cookieStore.delete(adminCredentialRecoveryCookieName);
  redirect("/auth/login?authNotice=Contraseña creada. Inicia sesión con tu nueva contraseña.");
}

export async function changeOwnAdminPasswordAction(formData: FormData) {
  const session = await getAdminSession();
  const currentPassword = secret(formData.get("currentPassword"));
  const newPassword = secret(formData.get("newPassword"));
  const confirmation = secret(formData.get("confirmation"));
  const returnTo = safeAdminReturnPath(formData.get("returnTo"));

  if (!session) {
    redirect("/auth/login?next=/admin/password");
  }

  if (!currentPassword || !validPassword(newPassword) || newPassword !== confirmation) {
    redirect(`${returnTo}?error=${encodeURIComponent("Revisa la contraseña actual y confirma una nueva contraseña de entre 8 y 256 caracteres.")}`);
  }

  const stepUp = await requestAdminBff<{ status: "VERIFIED" }>("/admin/session/step-up", {
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword }),
    },
  });

  if (!stepUp.ok || stepUp.data.status !== "VERIFIED") {
    redirect(`${returnTo}?error=${encodeURIComponent(credentialError(stepUp.status))}`);
  }

  const result = await requestAdminBff<{
    security?: { requiresLogin?: boolean };
    status: "password_changed";
  }>("/admin/auth/password/change", {
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword, revokeOtherSessions: true }),
    },
  });

  if (!result.ok) {
    redirect(`${returnTo}?error=${encodeURIComponent(credentialError(result.status))}`);
  }

  if (result.data.security?.requiresLogin) {
    await clearAdminContext();
    await clearAdminSession();
    redirect("/auth/login?authNotice=La contraseña cambió. Inicia sesión de nuevo.");
  }

  revalidatePath("/admin");
  redirect(`${returnTo}?notice=${encodeURIComponent("Contraseña actualizada. Las demás sesiones activas se cerraron.")}`);
}

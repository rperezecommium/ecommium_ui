"use server";

import { redirect } from "next/navigation";
import { requestAdminBff } from "../../shared/bff/admin-client";
import { clearAdminSession, getAdminSession } from "../../shared/auth/session";
import { clearAdminContext } from "../../shared/config/admin-context";
import {
  getAdminInstallationStatus,
  parseAdminInstallationAdoptionCompletion,
  parseAdminInstallationFreshCompletion,
} from "./admin-installation";

const installationPath = "/admin/installation";

function exactText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function normalizedText(value: FormDataEntryValue | null) {
  return exactText(value).trim();
}

function finish(kind: "notice" | "error", message: string): never {
  redirect(`${installationPath}?${kind}=${encodeURIComponent(message)}`);
}

function finishAtLogin(message: string): never {
  redirect(`/auth/login?authNotice=${encodeURIComponent(message)}`);
}

function passwordIsValid(value: string) {
  return value.length >= 8 && value.length <= 256 && value.trim().length > 0;
}

function freshError(status?: number) {
  if (status === 401) return "El claim fue rechazado. Solicita uno nuevo al operador y vuelve a intentarlo.";
  if (status === 409) return "La instalación cambió de estado. Recarga la pantalla antes de continuar.";
  if (status === 429) return "Se alcanzó el límite de intentos. Espera antes de volver a intentarlo.";
  return "No se pudo completar la instalación. No se creó ninguna sesión ni tenant.";
}

function adoptionError(status?: number) {
  if (status === 403) return "La confirmación caducó o esta cuenta no es elegible para adoptar Admin 0.";
  if (status === 409) return "La instalación cambió de estado. Recarga la pantalla antes de continuar.";
  if (status === 429) return "Se alcanzó el límite de intentos. Espera antes de volver a intentarlo.";
  return "No se pudo completar la adopción. La sesión actual no se ha borrado desde la UI.";
}

function hasSystemAdminAccess(session: Awaited<ReturnType<typeof getAdminSession>>) {
  if (!session || session.principalType !== "EMPLOYEE" || session.scope !== "admin") {
    return false;
  }

  const roles = new Set(session.roles.map((role) => role.trim().toLowerCase()));
  const permissions = new Set(session.permissions.map((permission) => permission.trim().toLowerCase()));
  return (
    (roles.has("admin") || roles.has("superadmin")) &&
    (permissions.has("*") || permissions.has("system.admin") || permissions.has("admin:*"))
  );
}

async function requireExpectedState(expected: "FRESH_READY" | "ADOPTION_REQUIRED") {
  const status = await getAdminInstallationStatus();
  if (!status.ok) {
    finish("error", "No se pudo verificar el estado de instalación. Inténtalo de nuevo más tarde.");
  }

  if (status.data.state !== expected) {
    finish("error", "La instalación cambió de estado. Revisa el paso operativo mostrado en pantalla.");
  }
}

export async function completeFreshAdminInstallationAction(formData: FormData) {
  const claim = normalizedText(formData.get("claim"));
  const email = normalizedText(formData.get("email"));
  const password = exactText(formData.get("password"));
  const passwordConfirmation = exactText(formData.get("passwordConfirmation"));
  const firstName = normalizedText(formData.get("firstName"));
  const lastName = normalizedText(formData.get("lastName"));

  if (!claim || claim.length > 512 || !email || email.length > 320) {
    finish("error", "Claim y email son obligatorios y deben tener un formato válido.");
  }
  if (!passwordIsValid(password)) {
    finish("error", "La contraseña debe tener entre 8 y 256 caracteres y no puede estar vacía.");
  }
  if (password !== passwordConfirmation) {
    finish("error", "La confirmación no coincide exactamente con la contraseña elegida.");
  }
  if (firstName.length > 100 || lastName.length > 100) {
    finish("error", "Nombre y apellidos admiten un máximo de 100 caracteres.");
  }

  await requireExpectedState("FRESH_READY");
  const result = await requestAdminBff("/admin/installation/fresh-completion", {
    withAuth: false,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        claim,
        email,
        password,
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
      }),
    },
    parse: parseAdminInstallationFreshCompletion,
  });

  if (!result.ok) {
    finish("error", freshError(result.status));
  }

  await clearAdminSession();
  await clearAdminContext();
  finishAtLogin("Admin 0 fue creado. Inicia sesión para configurar la primera Organization y tienda.");
}

export async function completeAdoptionAdminInstallationAction(formData: FormData) {
  const currentPassword = exactText(formData.get("currentPassword"));
  const newPassword = exactText(formData.get("newPassword"));
  const passwordConfirmation = exactText(formData.get("passwordConfirmation"));
  const session = await getAdminSession();

  if (!hasSystemAdminAccess(session)) {
    finish("error", "Inicia sesión con el SuperAdmin SYSTEM elegible antes de continuar.");
  }
  if (!currentPassword) {
    finish("error", "Escribe tu contraseña actual para confirmar tu identidad.");
  }
  if (!passwordIsValid(newPassword)) {
    finish("error", "La nueva contraseña debe tener entre 8 y 256 caracteres y no puede estar vacía.");
  }
  if (currentPassword === newPassword) {
    finish("error", "La nueva contraseña debe ser distinta de la contraseña actual.");
  }
  if (newPassword !== passwordConfirmation) {
    finish("error", "La confirmación no coincide exactamente con la nueva contraseña.");
  }

  await requireExpectedState("ADOPTION_REQUIRED");
  const stepUp = await requestAdminBff<{ status: string }>("/admin/session/step-up", {
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword }),
    },
    parse: (value) => {
      const record = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
      if (record.status !== "VERIFIED") throw new Error("Step-up no verificado.");
      return { status: record.status };
    },
  });

  if (!stepUp.ok) {
    finish("error", "No se pudo confirmar tu identidad. Revisa la contraseña actual e inténtalo de nuevo.");
  }

  const result = await requestAdminBff("/admin/installation/adoption-completion", {
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newPassword }),
    },
    parse: parseAdminInstallationAdoptionCompletion,
  });

  if (!result.ok) {
    finish("error", adoptionError(result.status));
  }

  await clearAdminSession();
  await clearAdminContext();
  finishAtLogin("Admin 0 fue adoptado y todas sus sesiones se revocaron. Inicia sesión con la nueva contraseña.");
}

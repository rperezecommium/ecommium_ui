"use server";

import { redirect } from "next/navigation";
import { requestBff } from "../../shared/bff/client";

const securityPath = "/admin/configuracion/seguridad";

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function finish(kind: "notice" | "error", message: string): never {
  redirect(`${securityPath}?${kind}=${encodeURIComponent(message)}`);
}

export async function verifyAdminStepUpAction(formData: FormData) {
  const currentPassword = text(formData.get("currentPassword"));
  if (!currentPassword) finish("error", "Escribe tu contraseña actual para confirmar esta acción.");

  const result = await requestBff("/admin/session/step-up", {
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword }),
    },
  });

  if (!result.ok) finish("error", "No se pudo confirmar tu identidad. Revisa la contraseña e inténtalo de nuevo.");
  finish("notice", "Identidad confirmada para las acciones sensibles de esta sesión.");
}

export async function logoutOtherAdminSessionsAction() {
  const result = await requestBff("/admin/sessions/logout-others", {
    init: { method: "POST" },
  });

  if (!result.ok) finish("error", "No se pudieron cerrar las otras sesiones. No se ha cerrado la sesión actual.");
  finish("notice", "Se cerraron las demás sesiones activas de tu cuenta.");
}

export async function revokeAdminDeviceSessionAction(formData: FormData) {
  const sessionId = text(formData.get("sessionId"));
  if (!sessionId) finish("error", "No se identificó el dispositivo que quieres cerrar.");

  const result = await requestBff(`/admin/sessions/${encodeURIComponent(sessionId)}/revoke`, {
    init: { method: "POST" },
  });

  if (!result.ok) finish("error", "No se pudo cerrar ese dispositivo. Vuelve a cargar la lista e inténtalo de nuevo.");
  finish("notice", "El dispositivo seleccionado ya no puede utilizar esta cuenta.");
}

"use server";

import { redirect } from "next/navigation";
import { requestBff } from "../../shared/bff/client";
import { adminBffToken } from "../../shared/config/env";
import { hasUsableAdminBearer } from "../../shared/auth/admin-bearer";
import { clearAdminContext, getAdminContext, saveAdminContext } from "../../shared/config/admin-context";
import {
  clearAdminSession,
  getAdminSession,
  saveAdminSession,
  type AdminSession,
} from "../../shared/auth/session";
import { getAvailableAdminContexts, shopToContext } from "../configuracion/organization-shop";
import { buildAdminLoginPayload } from "./admin-login-payload";
import { mergeAuthSessions, parseAuthSessionPayload } from "./auth-session-payload";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function safeNextPath(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.startsWith("/admin") ? value : "/admin";
}

function loginRedirect(nextPath: string, authError: string): never {
  redirect(`/auth/login?next=${encodeURIComponent(nextPath)}&authError=${encodeURIComponent(authError)}`);
}

function genericAuthError(status?: number) {
  if (status === 429) {
    return "Demasiados intentos. Espera unos minutos e intentalo de nuevo.";
  }

  if (status === 401 || status === 403) {
    return "No se pudo iniciar sesion. Revisa tus credenciales o permisos e intentalo de nuevo.";
  }

  return "No se pudo iniciar sesion. Intentalo de nuevo.";
}

function genericOperationalAccessError(status?: number) {
  if (status === 429) {
    return "Demasiados intentos. Espera unos minutos e intentalo de nuevo.";
  }

  if (status === 401 || status === 403) {
    return "No se pudo validar el acceso operativo al Admin.";
  }

  return "No se pudo cargar el contexto operativo del Admin.";
}

type LoginCredentials = {
  email: string;
  password: string;
  nextPath: string;
};

function parseLoginResult(value: unknown): AdminSession {
  return parseAuthSessionPayload(value, { requireAccessToken: true });
}

function parseMeResult(value: unknown): AdminSession {
  return parseAuthSessionPayload(value, { requireAccessToken: false });
}

function makeAuthHeader(accessToken: string) {
  return {
    authorization: `Bearer ${accessToken}`,
  };
}

async function fetchCurrentSessionWithToken(accessToken: string) {
  return await requestBff("/auth/me", {
    withAuth: false,
    init: {
      headers: makeAuthHeader(accessToken),
    },
    parse: parseMeResult,
  });
}

async function refreshAccessToken(refreshToken: string) {
  return await requestBff("/auth/refresh", {
    withAuth: false,
    init: {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    },
    parse: parseLoginResult,
  });
}

async function loginAdminWithCredentials({
  email,
  password,
  nextPath,
}: LoginCredentials) {
  if (!email || !password) {
    loginRedirect(nextPath, "Email y password son obligatorios.");
  }

  const loginResult = await requestBff("/auth/login", {
    withAuth: false,
    init: {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(buildAdminLoginPayload(email, password)),
    },
    parse: parseLoginResult,
  });

  if (!loginResult.ok || !loginResult.data.accessToken) {
    loginRedirect(nextPath, loginResult.ok ? "No se pudo iniciar sesion. Intentalo de nuevo." : genericAuthError(loginResult.status));
  }

  const meResult = await fetchCurrentSessionWithToken(loginResult.data.accessToken);

  if (!meResult.ok) {
    loginRedirect(nextPath, genericAuthError(meResult.status));
  }

  const session = mergeAuthSessions(loginResult.data, meResult.data);
  const availableContexts = await getAvailableAdminContexts({
    accessToken: loginResult.data.accessToken,
  });

  if (!availableContexts.ok) {
    loginRedirect(nextPath, genericOperationalAccessError(availableContexts.status));
  }

  const shops = availableContexts.directory.organizations.flatMap((organization) => organization.shops);

  if (shops.length === 0) {
    await clearAdminContext();
    await clearAdminSession();
    loginRedirect(nextPath, "Acceso denegado operativo: tu usuario no tiene tiendas disponibles para operar el Admin.");
  }

  const selectedShop = shops.length === 1 ? shops[0] : null;
  const currentContext = await getAdminContext();

  await saveAdminSession(session);

  if (selectedShop) {
    await saveAdminContext(shopToContext(selectedShop, currentContext));
    redirect(nextPath);
  }

  await clearAdminContext();
  redirect(
    `/admin/configuracion/contexto?contextNotice=${encodeURIComponent("Selecciona una tienda para continuar.")}`,
  );
}

export async function loginAdminEmployee(formData: FormData) {
  await loginAdminWithCredentials({
    email: asString(formData.get("email")),
    password: asString(formData.get("password")),
    nextPath: safeNextPath(formData.get("next")),
  });
}

export async function logoutAdminEmployee() {
  const session = await getAdminSession();

  if (session?.accessToken) {
    await requestBff("/auth/logout", {
      init: {
        method: "POST",
      },
    });
  }

  await clearAdminContext();
  await clearAdminSession();
  redirect("/auth/login");
}

export async function refreshAdminEmployeeSession() {
  const current = await getAdminSession();

  if (!current) {
    return null;
  }

  if (!hasUsableAdminBearer(current)) {
    return null;
  }

  if (!current.accessToken) {
    return current;
  }

  const meResult = await requestBff("/auth/me", {
    parse: parseMeResult,
  });

  if (meResult.ok) {
    const nextSession = mergeAuthSessions(current, meResult.data);
    return nextSession;
  }

  if (!current.refreshToken) {
    if (adminBffToken) {
      return {
        ...current,
        accessToken: undefined,
      };
    }

    return null;
  }

  const refreshResult = await refreshAccessToken(current.refreshToken);

  if (!refreshResult.ok || !refreshResult.data.accessToken) {
    return null;
  }

  const refreshed = mergeAuthSessions(current, refreshResult.data);
  const refreshedMeResult = await fetchCurrentSessionWithToken(refreshed.accessToken ?? "");

  if (!refreshedMeResult.ok) {
    return null;
  }

  const nextSession = mergeAuthSessions(refreshed, refreshedMeResult.data);
  return nextSession;
}

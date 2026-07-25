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
import { refreshAdminTokens } from "../../shared/auth/admin-session-refresh";
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

function appendOperationalDiagnostic(message: string, input: { status?: number; correlationId?: string }) {
  const details = [
    input.status ? `codigo BFF ${input.status}` : null,
    input.correlationId ? `correlation ID ${input.correlationId}` : null,
  ].filter(Boolean);

  return details.length > 0 ? `${message} (${details.join(", ")}).` : message;
}

function genericOperationalAccessError(input: { status?: number; correlationId?: string }) {
  const { status } = input;

  if (status === 429) {
    return appendOperationalDiagnostic("Demasiados intentos. Espera unos minutos e intentalo de nuevo.", input);
  }

  if (status === 401 || status === 403) {
    return appendOperationalDiagnostic("No se pudo validar el acceso operativo al Admin.", input);
  }

  return appendOperationalDiagnostic("No se pudo cargar el contexto operativo del Admin.", input);
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

function contextFromDefault(
  defaultContext: { organizationId: string; shopId: string },
  currentContext: Awaited<ReturnType<typeof getAdminContext>>,
) {
  return {
    ...currentContext,
    organizationId: defaultContext.organizationId,
    shopId: defaultContext.shopId,
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

async function refreshStoredAdminSession(current: AdminSession) {
  if (!current.refreshToken) {
    return null;
  }

  const refreshResult = await refreshAdminTokens(current.refreshToken);

  if (!refreshResult.ok) {
    return null;
  }

  const refreshedSession = {
    ...current,
    accessToken: refreshResult.accessToken,
    refreshToken: refreshResult.refreshToken,
    expiresAt: refreshResult.expiresAt,
  };

  const meResult = await fetchCurrentSessionWithToken(refreshResult.accessToken);

  if (!meResult.ok) {
    return null;
  }

  const nextSession = mergeAuthSessions(refreshedSession, meResult.data);
  await saveAdminSession(nextSession);
  return nextSession;
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
    loginRedirect(
      nextPath,
      genericOperationalAccessError({
        status: availableContexts.status,
        correlationId: availableContexts.correlationId,
      }),
    );
  }

  const shops = availableContexts.directory.organizations.flatMap((organization) => organization.shops);
  const currentContext = await getAdminContext();
  const selectedDefaultShop = availableContexts.defaultContext
    ? shops.find((shop) => (
        shop.organizationId === availableContexts.defaultContext?.organizationId &&
        shop.id === availableContexts.defaultContext?.shopId
      ))
    : null;

  if (shops.length === 0 && !availableContexts.defaultContext) {
    await clearAdminContext();
    await clearAdminSession();
    loginRedirect(nextPath, "Acceso denegado operativo: tu usuario no tiene tiendas disponibles para operar el Admin.");
  }

  const selectedShop = selectedDefaultShop ?? (shops.length === 1 ? shops[0] : null);

  await saveAdminSession(session);

  if (selectedShop) {
    await saveAdminContext(shopToContext(selectedShop, currentContext));
    redirect(nextPath);
  }

  if (availableContexts.defaultContext) {
    await saveAdminContext(contextFromDefault(availableContexts.defaultContext, currentContext));
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

  const refreshedSession = meResult.status === 401 || meResult.status === 403
    ? await refreshStoredAdminSession(current)
    : null;

  if (refreshedSession) {
    return refreshedSession;
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

  return null;
}

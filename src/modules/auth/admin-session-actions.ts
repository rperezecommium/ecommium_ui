"use server";

import { redirect } from "next/navigation";
import { requestBff } from "../../shared/bff/client";
import { adminBffToken, defaultAdminContext } from "../../shared/config/env";
import { hasUsableAdminBearer } from "../../shared/auth/admin-bearer";
import { getAdminContext } from "../../shared/config/admin-context";
import {
  clearAdminSession,
  getAdminSession,
  saveAdminSession,
  type AdminSession,
} from "../../shared/auth/session";
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

type LoginCredentials = {
  email: string;
  password: string;
  organizationId: string;
  shopId: string;
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
  organizationId,
  shopId,
  nextPath,
}: LoginCredentials) {
  if (!email || !password) {
    loginRedirect(nextPath, "Email y password son obligatorios.");
  }

  if (!organizationId || !shopId) {
    loginRedirect(nextPath, "Organization ID y Shop ID son obligatorios para login Admin.");
  }

  const loginResult = await requestBff("/auth/login", {
    withAuth: false,
    init: {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        scope: "admin",
        organizationId,
        shopId,
      }),
    },
    parse: parseLoginResult,
  });

  if (!loginResult.ok || !loginResult.data.accessToken) {
    loginRedirect(nextPath, loginResult.ok ? "El BFF no devolvio accessToken." : loginResult.error);
  }

  const meResult = await fetchCurrentSessionWithToken(loginResult.data.accessToken);

  if (!meResult.ok) {
    loginRedirect(nextPath, `Login aceptado, pero /auth/me no pudo validar la sesion. ${meResult.error}`);
  }

  await saveAdminSession(mergeAuthSessions(loginResult.data, meResult.data));
  redirect(nextPath);
}

export async function loginAdminEmployee(formData: FormData) {
  const context = await getAdminContext();
  await loginAdminWithCredentials({
    email: asString(formData.get("email")),
    password: asString(formData.get("password")),
    organizationId: context.organizationId || defaultAdminContext.organizationId,
    shopId: context.shopId || defaultAdminContext.shopId,
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

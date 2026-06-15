"use server";

import { redirect } from "next/navigation";
import { requestBff } from "../../shared/bff/client";
import {
  clearAdminSession,
  getAdminSession,
  saveAdminSession,
  type AdminSession,
} from "../../shared/auth/session";

type LoginResult = {
  accessToken: string;
  employee: {
    employeeId: string;
    name: string;
    email: string;
    profile: AdminSession["profile"];
    permissions: string[];
  };
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeProfile(value: unknown): AdminSession["profile"] {
  const profile = asString(value);

  if (profile === "SuperAdmin" || profile === "Admin" || profile === "Operator" || profile === "Viewer") {
    return profile;
  }

  if (profile.toUpperCase() === "SUPER_ADMIN") {
    return "SuperAdmin";
  }

  return "Operator";
}

function parseLoginResult(value: unknown): LoginResult {
  const record = asRecord(value);
  const session = asRecord(record.session);
  const employee = asRecord(record.employee ?? record.user ?? record.employeeSession);
  const accessToken =
    asString(record.accessToken) ||
    asString(record.token) ||
    asString(session.accessToken) ||
    asString(session.token);

  return {
    accessToken,
    employee: {
      employeeId: asString(employee.employeeId) || asString(employee.id) || "employee",
      name: asString(employee.name) || asString(employee.displayName) || asString(employee.email) || "Employee",
      email: asString(employee.email),
      profile: normalizeProfile(employee.profile ?? employee.role),
      permissions: asStringArray(employee.permissions).length
        ? asStringArray(employee.permissions)
        : ["admin:view"],
    },
  };
}

function parseMeResult(value: unknown): AdminSession {
  const record = asRecord(value);
  const employee = asRecord(record.employee ?? record.user ?? record);
  const session = asRecord(record.session);

  return {
    accessToken: asString(record.accessToken) || asString(session.accessToken) || undefined,
    employeeId: asString(employee.employeeId) || asString(employee.id) || "employee",
    name: asString(employee.name) || asString(employee.displayName) || asString(employee.email) || "Employee",
    email: asString(employee.email),
    profile: normalizeProfile(employee.profile ?? employee.role),
    permissions: asStringArray(employee.permissions).length
      ? asStringArray(employee.permissions)
      : ["admin:view"],
  };
}

function safeNextPath(value: FormDataEntryValue | null) {
  const nextPath = typeof value === "string" && value.startsWith("/admin") ? value : "/admin";
  return nextPath;
}

export async function loginAdminEmployee(formData: FormData) {
  const email = asString(formData.get("email")).trim();
  const password = asString(formData.get("password"));
  const nextPath = safeNextPath(formData.get("next"));

  if (!email || !password) {
    redirect(`/auth/login?next=${encodeURIComponent(nextPath)}&authError=${encodeURIComponent("Email y password son obligatorios.")}`);
  }

  const result = await requestBff("/admin/sessions/login", {
    init: {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    },
    parse: parseLoginResult,
  });

  if (!result.ok || !result.data.accessToken) {
    redirect(`/auth/login?next=${encodeURIComponent(nextPath)}&authError=${encodeURIComponent(result.ok ? "El BFF no devolvio accessToken." : result.error)}`);
  }

  await saveAdminSession({
    accessToken: result.data.accessToken,
    ...result.data.employee,
  });

  redirect(nextPath);
}

export async function logoutAdminEmployee() {
  const session = await getAdminSession();

  if (session?.accessToken) {
    await requestBff("/admin/sessions/logout", {
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

  if (!current?.accessToken) {
    return current;
  }

  const result = await requestBff("/admin/sessions/me", {
    parse: parseMeResult,
  });

  if (!result.ok) {
    return current;
  }

  const nextSession = {
    ...result.data,
    accessToken: result.data.accessToken ?? current.accessToken,
  };

  await saveAdminSession(nextSession);
  return nextSession;
}

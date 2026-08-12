import { cookies } from "next/headers";
import { sealAdminSessionCookie, unsealAdminSessionCookie } from "./admin-session-cookie";
import { getAdminRequestSession } from "./admin-request-session";

export type AdminSession = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  sessionId?: string;
  employeeId: string;
  name: string;
  email: string;
  profile: "SuperAdmin" | "Admin" | "Operator" | "Viewer";
  principalType: "ADMIN" | "EMPLOYEE" | "CUSTOMER";
  scope: "admin" | "storefront";
  roles: string[];
  permissions: string[];
  organizationId?: string;
  shopId?: string;
};

export const sessionCookieName = "ecommium_employee_session";

type PersistedAdminSession = Omit<AdminSession, "roles" | "permissions"> & {
  roles?: string[];
  permissions?: string[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(asString).filter(Boolean)
    : [];
}

function decodeBase64Url(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (base64.length % 4)) % 4;
  return Buffer.from(`${base64}${"=".repeat(padLength)}`, "base64").toString("utf8");
}

function decodeAccessTokenClaims(accessToken?: string): Record<string, unknown> {
  if (!accessToken) {
    return {};
  }

  const [, payloadSegment] = accessToken.split(".");
  if (!payloadSegment) {
    return {};
  }

  try {
    return asRecord(JSON.parse(decodeBase64Url(payloadSegment)));
  } catch {
    return {};
  }
}

function compactElevatedPermissions(permissions: string[]) {
  const elevated = new Set(["*", "admin:*", "system.admin"]);
  return permissions.filter((permission) => elevated.has(permission.trim().toLowerCase()));
}

function toPersistedAdminSession(session: AdminSession): PersistedAdminSession {
  const persisted: PersistedAdminSession = { ...session };

  const elevatedPermissions = compactElevatedPermissions(session.permissions);
  if (elevatedPermissions.length > 0) {
    persisted.permissions = elevatedPermissions;
  } else {
    delete persisted.permissions;
  }

  if (session.roles.length === 0) {
    delete persisted.roles;
  }

  return persisted;
}

function parseSession(value: string | undefined): AdminSession | null {
  const unsealed = unsealAdminSessionCookie(value);
  if (!unsealed) {
    return null;
  }

  try {
    const parsed = JSON.parse(unsealed) as PersistedAdminSession;
    const tokenClaims = decodeAccessTokenClaims(parsed.accessToken);
    const principalType = asString(parsed.principalType || tokenClaims.principalType).toUpperCase();
    const scope = asString(parsed.scope || tokenClaims.scope).toLowerCase();
    const permissions = asStringArray(parsed.permissions);
    const tokenPermissions = asStringArray(tokenClaims.permissions);
    const roles = asStringArray(parsed.roles);
    const tokenRoles = asStringArray(tokenClaims.roles);

    if (
      typeof parsed.accessToken === "string" &&
      parsed.accessToken.trim() &&
      typeof parsed.employeeId === "string" &&
      parsed.employeeId.trim() &&
      typeof parsed.name === "string" &&
      typeof parsed.email === "string" &&
      principalType === "EMPLOYEE" &&
      scope === "admin"
    ) {
      return {
        accessToken: parsed.accessToken,
        refreshToken: typeof parsed.refreshToken === "string" ? parsed.refreshToken : undefined,
        expiresAt: typeof parsed.expiresAt === "string" ? parsed.expiresAt : undefined,
        sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : undefined,
        employeeId: parsed.employeeId,
        name: parsed.name,
        email: parsed.email,
        profile: parsed.profile,
        principalType: "EMPLOYEE",
        scope: "admin",
        roles: roles.length > 0 ? roles : tokenRoles,
        permissions: permissions.length > 0 ? permissions : tokenPermissions,
        organizationId: typeof parsed.organizationId === "string" ? parsed.organizationId : undefined,
        shopId: typeof parsed.shopId === "string" ? parsed.shopId : undefined,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const requestSession = getAdminRequestSession();
  if (requestSession) {
    return requestSession;
  }

  const cookieStore = await cookies();
  return parseSession(cookieStore.get(sessionCookieName)?.value);
}

export async function getAdminAuthorizationToken() {
  const session = await getAdminSession();
  return session?.accessToken;
}

export async function saveAdminSession(session: AdminSession) {
  if (
    !session.accessToken ||
    !session.employeeId ||
    session.principalType !== "EMPLOYEE" ||
    session.scope !== "admin"
  ) {
    throw new Error("Only an authenticated Employee/admin session can be persisted");
  }

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, sealAdminSessionCookie(JSON.stringify(toPersistedAdminSession(session))), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
}

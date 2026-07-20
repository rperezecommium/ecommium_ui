import { cookies } from "next/headers";
import { canUseDevAdminSession } from "./admin-bearer";

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

const devSession: AdminSession = {
  accessToken: undefined,
  employeeId: "dev-employee",
  name: "Admin Ecommium",
  email: "admin@ecommium.local",
  profile: "SuperAdmin",
  principalType: "EMPLOYEE",
  scope: "admin",
  roles: ["super-admin"],
  permissions: ["admin:*"],
};

function parseSession(value: string | undefined): AdminSession | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as AdminSession;
    if (
      typeof parsed.employeeId === "string" &&
      typeof parsed.name === "string" &&
      typeof parsed.email === "string" &&
      Array.isArray(parsed.permissions)
    ) {
      return {
        accessToken: typeof parsed.accessToken === "string" ? parsed.accessToken : undefined,
        refreshToken: typeof parsed.refreshToken === "string" ? parsed.refreshToken : undefined,
        expiresAt: typeof parsed.expiresAt === "string" ? parsed.expiresAt : undefined,
        sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : undefined,
        employeeId: parsed.employeeId,
        name: parsed.name,
        email: parsed.email,
        profile: parsed.profile,
        principalType:
          parsed.principalType === "ADMIN" ||
          parsed.principalType === "EMPLOYEE" ||
          parsed.principalType === "CUSTOMER"
            ? parsed.principalType
            : "EMPLOYEE",
        scope: parsed.scope === "storefront" ? "storefront" : "admin",
        roles: Array.isArray(parsed.roles)
          ? parsed.roles.filter((role): role is string => typeof role === "string")
          : [],
        permissions: parsed.permissions.filter((permission): permission is string => typeof permission === "string"),
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
  const cookieStore = await cookies();
  return parseSession(cookieStore.get(sessionCookieName)?.value);
}

export async function getAdminAuthorizationToken() {
  const session = await getAdminSession();
  return session?.accessToken;
}

export async function saveAdminSession(session: AdminSession) {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, JSON.stringify(session), {
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

export async function createDevSession() {
  if (!canUseDevAdminSession()) {
    return false;
  }

  await saveAdminSession(devSession);
  return true;
}

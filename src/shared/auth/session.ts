import { cookies } from "next/headers";

export type AdminSession = {
  accessToken?: string;
  employeeId: string;
  name: string;
  email: string;
  profile: "SuperAdmin" | "Admin" | "Operator" | "Viewer";
  permissions: string[];
};

export const sessionCookieName = "ecommium_employee_session";

const devSession: AdminSession = {
  accessToken: undefined,
  employeeId: "dev-employee",
  name: "Admin Ecommium",
  email: "admin@ecommium.local",
  profile: "SuperAdmin",
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
        employeeId: parsed.employeeId,
        name: parsed.name,
        email: parsed.email,
        profile: parsed.profile,
        permissions: parsed.permissions.filter((permission): permission is string => typeof permission === "string"),
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
  if (process.env.ECOMMIUM_ADMIN_DEV_SESSION !== "1") {
    return;
  }

  await saveAdminSession(devSession);
}

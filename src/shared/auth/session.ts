import { cookies } from "next/headers";

export type AdminSession = {
  employeeId: string;
  name: string;
  email: string;
  profile: "SuperAdmin" | "Admin" | "Operator" | "Viewer";
  permissions: string[];
};

const sessionCookieName = "ecommium_employee_session";

const devSession: AdminSession = {
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
      return parsed;
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

export async function createDevSession() {
  if (process.env.ECOMMIUM_ADMIN_DEV_SESSION !== "1") {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, JSON.stringify(devSession), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

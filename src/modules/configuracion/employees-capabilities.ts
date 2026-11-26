import type { AdminSession } from "../../shared/auth/session";
export function getEmployeesCapabilities(
  session: Pick<AdminSession, "permissions" | "roles"> | null,
) {
  const permissions = new Set(
    session?.permissions.map((value) => value.trim().toLowerCase()),
  );
  const elevated = ["*", "system.admin", "admin:*"].some((value) =>
    permissions.has(value),
  );
  return {
    canManageEmployees: elevated || permissions.has("employees.manage"),
    canManageProfiles: elevated || permissions.has("employees.security"),
    canResetCredentials:
      elevated &&
      !!session?.roles.some((role) => role.toLowerCase() === "superadmin"),
  };
}

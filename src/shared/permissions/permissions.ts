import type { AdminSession } from "../auth/session";

export type AdminPermission =
  | "admin:view"
  | "admin:configuration:view"
  | "admin:health:view"
  | "admin:employees:view"
  | "admin:catalog:view"
  | "admin:orders:view"
  | "admin:customers:view"
  | "admin:payments:view"
  | "admin:shipping:view";

export function can(session: AdminSession, permission: AdminPermission) {
  return session.permissions.includes("admin:*") || session.permissions.includes(permission);
}

export function filterAllowedNavigation<T extends { permission: AdminPermission }>(
  session: AdminSession,
  items: T[],
) {
  return items.filter((item) => can(session, item.permission));
}

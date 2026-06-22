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

const permissionAliases: Record<AdminPermission, string[]> = {
  "admin:view": ["admin:view"],
  "admin:configuration:view": [
    "admin:configuration:view",
    "employees.read",
    "employees.manage",
    "employees.security",
    "sessions.admin.accounts.write",
  ],
  "admin:health:view": ["admin:health:view"],
  "admin:employees:view": ["admin:employees:view", "employees.read", "employees.manage", "employees.security"],
  "admin:catalog:view": [
    "admin:catalog:view",
    "catalog.products.write",
    "catalog.categories.write",
    "catalog.brands.write",
    "catalog.specifications.write",
    "media.assets.write",
  ],
  "admin:orders:view": ["admin:orders:view", "orders.read", "checkout.configuration.write"],
  "admin:customers:view": ["admin:customers:view", "customers.read"],
  "admin:payments:view": ["admin:payments:view", "payments.admin.write"],
  "admin:shipping:view": ["admin:shipping:view", "shipping.admin.write"],
};

export function can(session: AdminSession, permission: AdminPermission) {
  const current = new Set(session.permissions.map((item) => item.trim().toLowerCase()));
  const aliases = permissionAliases[permission] ?? [permission];

  return (
    (permission === "admin:view" && session.scope === "admin") ||
    current.has("*") ||
    current.has("system.admin") ||
    current.has("admin:*") ||
    aliases.some((alias) => current.has(alias.toLowerCase()))
  );
}

export function filterAllowedNavigation<T extends { permission: AdminPermission }>(
  session: AdminSession,
  items: T[],
) {
  return items.filter((item) => can(session, item.permission));
}

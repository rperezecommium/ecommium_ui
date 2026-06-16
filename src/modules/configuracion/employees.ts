import { requestBff } from "../../shared/bff/client";
import type { AdminContext } from "../../shared/config/admin-context";

export type EmployeesCollectionResponse<T> = {
  items?: T[];
  data?: T[];
  employees?: T[];
  profiles?: T[];
  permissions?: T[];
  total?: number;
  totalItems?: number;
  [key: string]: unknown;
};

export type EmployeeRecord = {
  employeeId?: string;
  id?: string;
  principalId?: string;
  email?: string;
  name?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  status?: string;
  active?: boolean;
  profileIds?: string[];
  profiles?: EmployeeProfileRecord[];
  roles?: string[];
  permissions?: string[];
  [key: string]: unknown;
};

export type EmployeeProfileRecord = {
  profileId?: string;
  id?: string;
  name?: string;
  description?: string | null;
  status?: string;
  active?: boolean;
  permissions?: string[];
  [key: string]: unknown;
};

export type EmployeePermissionRecord = {
  permission?: string;
  value?: string;
  key?: string;
  name?: string;
  description?: string;
  category?: string;
  [key: string]: unknown;
};

export type EmployeesModuleData = {
  health: {
    ok: boolean;
    status: "ok" | "unavailable";
    message: string;
    correlationId?: string;
  };
  employees: EmployeeRecord[];
  profiles: EmployeeProfileRecord[];
  permissions: EmployeePermissionRecord[];
  errors: string[];
};

type CollectionKey<T> = keyof EmployeesCollectionResponse<T>;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(asString).filter(Boolean) : [];
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function collectionItems<T>(
  payload: EmployeesCollectionResponse<T>,
  keys: Array<CollectionKey<T>>,
): T[] {
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value as T[];
    }
  }

  return [];
}

function parseCollection<T>(value: unknown): EmployeesCollectionResponse<T> {
  if (Array.isArray(value)) {
    return { items: value as T[], total: value.length };
  }

  return asRecord(value) as EmployeesCollectionResponse<T>;
}

function normalizeEmployee(value: unknown): EmployeeRecord {
  const record = asRecord(value);
  const firstName = asString(record.firstName);
  const lastName = asString(record.lastName);
  const profileIds = asStringArray(record.profileIds);

  return {
    ...record,
    employeeId: asString(record.employeeId) || asString(record.id) || asString(record.principalId),
    id: asString(record.id),
    principalId: asString(record.principalId),
    email: asString(record.email),
    firstName,
    lastName,
    name: asString(record.name) || asString(record.fullName) || [firstName, lastName].filter(Boolean).join(" "),
    status: asString(record.status),
    active: typeof record.active === "boolean" ? record.active : undefined,
    profileIds,
    profiles: asArray(record.profiles).map(normalizeProfile),
    roles: asStringArray(record.roles),
    permissions: asStringArray(record.permissions),
  };
}

function normalizeProfile(value: unknown): EmployeeProfileRecord {
  const record = asRecord(value);

  return {
    ...record,
    profileId: asString(record.profileId) || asString(record.id),
    id: asString(record.id),
    name: asString(record.name),
    description: asString(record.description) || null,
    status: asString(record.status),
    active: typeof record.active === "boolean" ? record.active : undefined,
    permissions: asStringArray(record.permissions),
  };
}

function normalizePermission(value: unknown): EmployeePermissionRecord {
  if (typeof value === "string") {
    return { permission: value };
  }

  const record = asRecord(value);

  return {
    ...record,
    permission: asString(record.permission) || asString(record.value) || asString(record.key) || asString(record.name),
    value: asString(record.value),
    key: asString(record.key),
    name: asString(record.name),
    description: asString(record.description),
    category: asString(record.category),
  };
}

function employeesPath(path: string, context?: AdminContext) {
  const params = new URLSearchParams();

  if (context?.organizationId) {
    params.set("organizationId", context.organizationId);
  }

  if (context?.shopId) {
    params.set("shopId", context.shopId);
  }

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function parseEmployees(value: unknown) {
  return collectionItems(parseCollection<EmployeeRecord>(value), ["items", "data", "employees"])
    .map(normalizeEmployee);
}

function parseProfiles(value: unknown) {
  return collectionItems(parseCollection<EmployeeProfileRecord>(value), ["items", "data", "profiles"])
    .map(normalizeProfile);
}

function parsePermissions(value: unknown) {
  return collectionItems(parseCollection<EmployeePermissionRecord>(value), ["items", "data", "permissions"])
    .map(normalizePermission);
}

export function employeeIdOf(employee: EmployeeRecord) {
  return employee.employeeId || employee.id || employee.principalId || "";
}

export function employeeDisplayName(employee: EmployeeRecord) {
  return employee.name || employee.fullName || [employee.firstName, employee.lastName].filter(Boolean).join(" ") || "-";
}

export function profileIdOf(profile: EmployeeProfileRecord) {
  return profile.profileId || profile.id || "";
}

export function permissionValueOf(permission: EmployeePermissionRecord) {
  return permission.permission || permission.value || permission.key || permission.name || "";
}

export function statusLabel(value: { active?: boolean; status?: unknown }) {
  if (typeof value.status === "string" && value.status.trim()) {
    return value.status;
  }

  if (typeof value.active === "boolean") {
    return value.active ? "ACTIVE" : "INACTIVE";
  }

  return "-";
}

export function employeeProfileIdsOf(employee: EmployeeRecord) {
  if (Array.isArray(employee.profileIds) && employee.profileIds.length > 0) {
    return employee.profileIds;
  }

  if (Array.isArray(employee.profiles)) {
    return employee.profiles.map(profileIdOf).filter(Boolean);
  }

  return [];
}

export async function getEmployeesModuleData(context: AdminContext): Promise<EmployeesModuleData> {
  const errors: string[] = [];
  const healthResult = await requestBff("/admin/employees/health", {
    parse: (value) => asRecord(value),
  });

  const [employeesResult, profilesResult, permissionsResult] = await Promise.all([
    requestBff(employeesPath("/admin/employees", context), { context, parse: parseEmployees }),
    requestBff(employeesPath("/admin/employees/profiles", context), { context, parse: parseProfiles }),
    requestBff(employeesPath("/admin/employees/permissions/catalog", context), { context, parse: parsePermissions }),
  ]);

  if (!employeesResult.ok) {
    errors.push(`/admin/employees: ${employeesResult.error}`);
  }

  if (!profilesResult.ok) {
    errors.push(`/admin/employees/profiles: ${profilesResult.error}`);
  }

  if (!permissionsResult.ok) {
    errors.push(`/admin/employees/permissions/catalog: ${permissionsResult.error}`);
  }

  return {
    health: healthResult.ok
      ? {
          ok: true,
          status: "ok",
          message: "Employees BFF disponible",
          correlationId: healthResult.correlationId,
        }
      : {
          ok: false,
          status: "unavailable",
          message: healthResult.error,
          correlationId: healthResult.correlationId,
        },
    employees: employeesResult.ok ? employeesResult.data : [],
    profiles: profilesResult.ok ? profilesResult.data : [],
    permissions: permissionsResult.ok ? permissionsResult.data : [],
    errors,
  };
}

export function buildEmployeesMutationPath(path: string, organizationId: string, shopId: string) {
  return `${path}?${new URLSearchParams({ organizationId, shopId }).toString()}`;
}

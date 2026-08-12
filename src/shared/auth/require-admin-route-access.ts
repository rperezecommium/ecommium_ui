import { requestAdminBff } from "../bff/admin-client";
import { getAdminContext, hasRequiredAdminContext, type AdminContext } from "../config/admin-context";
import { getAvailableAdminContexts } from "../../modules/configuracion/organization-shop";
import { getAdminSession } from "./session";

type CurrentEmployee = {
  employeeId: string;
  permissions: string[];
};

export type AdminRouteAccess = {
  accessToken: string;
  context: AdminContext;
  employeeId: string;
};

export type AdminRouteAccessResult =
  | { ok: true; data: AdminRouteAccess }
  | { ok: false; response: Response };

function forbidden() {
  return new Response("Forbidden", { status: 403 });
}

function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

function unavailable() {
  return new Response("Admin authorization is temporarily unavailable", { status: 503 });
}

function notFound() {
  return new Response("Not found", { status: 404 });
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asPermissions(value: unknown) {
  return Array.isArray(value)
    ? value.filter((permission): permission is string => typeof permission === "string")
    : [];
}

function parseCurrentEmployee(value: unknown): CurrentEmployee | null {
  const root = asRecord(value);
  const principal = asRecord(root.principal ?? root.user);
  const session = asRecord(root.session);
  const principalType = asNonEmptyString(principal.principalType ?? session.principalType)?.toUpperCase();
  const scope = asNonEmptyString(principal.scope ?? session.scope)?.toLowerCase();
  const employeeId =
    asNonEmptyString(principal.id) ??
    asNonEmptyString(principal.employeeId) ??
    asNonEmptyString(principal.sub);

  if (principalType !== "EMPLOYEE" || scope !== "admin" || !employeeId) {
    return null;
  }

  return {
    employeeId,
    permissions: asPermissions(principal.permissions ?? session.permissions ?? root.permissions),
  };
}

function hasPermission(permissions: string[], requiredPermission: string) {
  const current = new Set(permissions.map((permission) => permission.trim().toLowerCase()));
  return current.has("*") || current.has("system.admin") || current.has(requiredPermission.toLowerCase());
}

/**
 * Autoriza Route Handlers administrativos que no heredan los guards del
 * layout. La cookie de UI solo aporta un bearer candidato: la identidad,
 * permiso y tenant se vuelven a confirmar con el BFF antes de proxyar datos.
 */
export async function requireAdminRouteAccess(
  requiredPermission: string,
): Promise<AdminRouteAccessResult> {
  const storedSession = await getAdminSession();
  const accessToken = storedSession?.accessToken;

  // Una petición de usuario nunca puede sustituir su sesión por un bearer técnico.
  if (!accessToken) {
    return { ok: false, response: unauthorized() };
  }

  const currentSessionResult = await requestAdminBff("/auth/me", {
    withAuth: false,
    init: {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    },
  });

  if (!currentSessionResult.ok) {
    if (currentSessionResult.status === 401 || currentSessionResult.status === 403) {
      return { ok: false, response: unauthorized() };
    }
    return { ok: false, response: unavailable() };
  }

  const employee = parseCurrentEmployee(currentSessionResult.data);
  if (!employee || !hasPermission(employee.permissions, requiredPermission)) {
    return { ok: false, response: forbidden() };
  }

  const context = await getAdminContext();
  if (!hasRequiredAdminContext(context)) {
    return { ok: false, response: notFound() };
  }

  const availableContexts = await getAvailableAdminContexts({ accessToken });
  if (!availableContexts.ok) {
    if (availableContexts.status === 401 || availableContexts.status === 403) {
      return { ok: false, response: unauthorized() };
    }
    return { ok: false, response: unavailable() };
  }

  const tenantIsAuthorized = availableContexts.directory.organizations.some((organization) =>
    organization.id === context.organizationId &&
    organization.shops.some((shop) => shop.id === context.shopId),
  );
  if (!tenantIsAuthorized) {
    // No revelar si el recurso existe para un tenant no autorizado.
    return { ok: false, response: notFound() };
  }

  return {
    ok: true,
    data: {
      accessToken,
      context,
      employeeId: employee.employeeId,
    },
  };
}

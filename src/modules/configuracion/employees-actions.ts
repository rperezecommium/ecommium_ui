"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestBff } from "../../shared/bff/client";
import { getAdminContext } from "../../shared/config/admin-context";
import { buildEmployeesMutationPath } from "./employees";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function lines(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function shopScopeValues(formData: FormData) {
  return formData.getAll("shopScopes")
    .map((item) => asString(item))
    .filter(Boolean)
    .map((value) => {
      const [organizationId, shopId] = value.split("|").map((part) => part.trim());
      return organizationId && shopId ? { organizationId, shopId } : null;
    })
    .filter((scope): scope is { organizationId: string; shopId: string } => Boolean(scope));
}

function safeRedirect(params: Record<string, string>): never {
  const query = new URLSearchParams(params);
  redirect(`/admin/configuracion/equipo?${query.toString()}`);
}

function finish(tab: string, notice: string): never {
  revalidatePath("/admin/configuracion/equipo");
  safeRedirect({ tab, notice });
}

function fail(tab: string, error: string): never {
  safeRedirect({ tab, error });
}

async function getTenant(tab: string) {
  const context = await getAdminContext();

  if (!context.organizationId || !context.shopId) {
    fail(tab, "Define organizationId y shopId antes de operar Employees.");
  }

  return context;
}

function buildEmployeePayload(formData: FormData, options: { includeShopScopes?: boolean } = {}) {
  const firstName = asString(formData.get("firstName"));
  const lastName = asString(formData.get("lastName"));
  const temporaryPassword = asString(formData.get("temporaryPassword"));
  const status = asString(formData.get("status"));
  const profileIds = formData.getAll("profileIds").map((item) => asString(item)).filter(Boolean);

  return {
    email: asString(formData.get("email")),
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
    ...(temporaryPassword ? { temporaryPassword } : {}),
    active: status ? status === "ACTIVE" : asBoolean(formData.get("active")),
    status: status || (asBoolean(formData.get("active")) ? "ACTIVE" : "INACTIVE"),
    profileIds,
    ...(options.includeShopScopes ? { shopScopes: shopScopeValues(formData) } : {}),
  };
}

export async function createEmployeeAction(formData: FormData) {
  const tab = "create-employee";
  const context = await getTenant(tab);
  const payload = buildEmployeePayload(formData, { includeShopScopes: true });

  if (!payload.email || !payload.temporaryPassword) {
    fail(tab, "Email y password inicial son obligatorios.");
  }

  if (payload.temporaryPassword.length < 8) {
    fail(tab, "El password inicial debe tener minimo 8 caracteres.");
  }

  const result = await requestBff(buildEmployeesMutationPath("/admin/employees", context.organizationId, context.shopId), {
    context,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
  });

  if (!result.ok) {
    fail(tab, `No se pudo crear empleado. ${result.error}`);
  }

  finish("employees", "Empleado creado.");
}

export async function updateEmployeeAction(formData: FormData) {
  const tab = "employees";
  const context = await getTenant(tab);
  const employeeId = asString(formData.get("employeeId"));
  const payload = buildEmployeePayload(formData);

  if (!employeeId) {
    fail(tab, "Selecciona un empleado para editar.");
  }

  const result = await requestBff(
    buildEmployeesMutationPath(`/admin/employees/${encodeURIComponent(employeeId)}`, context.organizationId, context.shopId),
    {
      context,
      init: {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    },
  );

  if (!result.ok) {
    fail(tab, `No se pudo actualizar empleado. ${result.error}`);
  }

  finish(tab, "Empleado actualizado.");
}

export async function updateEmployeeStatusAction(formData: FormData) {
  const tab = "employees";
  const context = await getTenant(tab);
  const employeeId = asString(formData.get("employeeId"));
  const active = asBoolean(formData.get("active"));

  if (!employeeId) {
    fail(tab, "Selecciona un empleado para cambiar estado.");
  }

  const result = await requestBff(
    buildEmployeesMutationPath(`/admin/employees/${encodeURIComponent(employeeId)}/status`, context.organizationId, context.shopId),
    {
      context,
      init: {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active, status: active ? "ACTIVE" : "INACTIVE" }),
      },
    },
  );

  if (!result.ok) {
    fail(tab, `No se pudo cambiar estado. ${result.error}`);
  }

  finish(tab, active ? "Empleado activado." : "Empleado desactivado.");
}

export async function updateEmployeeShopScopesAction(formData: FormData) {
  const tab = "employees";
  const context = await getTenant(tab);
  const employeeId = asString(formData.get("employeeId"));
  const shopScopes = shopScopeValues(formData);

  if (!employeeId) {
    fail(tab, "Selecciona un empleado para asignar tiendas.");
  }

  const result = await requestBff(
    buildEmployeesMutationPath(`/admin/employees/${encodeURIComponent(employeeId)}/shop-scopes`, context.organizationId, context.shopId),
    {
      context,
      init: {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shopScopes }),
      },
    },
  );

  if (!result.ok) {
    fail(tab, `No se pudieron actualizar tiendas. ${result.error}`);
  }

  finish(tab, "Acceso a tiendas actualizado.");
}

export async function createProfileAction(formData: FormData) {
  const tab = "profiles";
  const context = await getTenant(tab);
  const name = asString(formData.get("name"));
  const active = asBoolean(formData.get("active"));

  if (!name) {
    fail(tab, "El nombre del perfil es obligatorio.");
  }

  const result = await requestBff(
    buildEmployeesMutationPath("/admin/employees/profiles", context.organizationId, context.shopId),
    {
      context,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          description: asString(formData.get("description")) || undefined,
          active,
          status: active ? "ACTIVE" : "INACTIVE",
        }),
      },
    },
  );

  if (!result.ok) {
    fail(tab, `No se pudo crear perfil. ${result.error}`);
  }

  finish(tab, "Perfil creado.");
}

export async function updateProfileAction(formData: FormData) {
  const tab = "profiles";
  const context = await getTenant(tab);
  const profileId = asString(formData.get("profileId"));
  const status = asString(formData.get("status"));

  if (!profileId) {
    fail(tab, "Selecciona un perfil para editar.");
  }

  const result = await requestBff(
    buildEmployeesMutationPath(`/admin/employees/profiles/${encodeURIComponent(profileId)}`, context.organizationId, context.shopId),
    {
      context,
      init: {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: asString(formData.get("name")) || undefined,
          description: asString(formData.get("description")) || undefined,
          status: status || undefined,
          active: status ? status === "ACTIVE" : undefined,
        }),
      },
    },
  );

  if (!result.ok) {
    fail(tab, `No se pudo editar perfil. ${result.error}`);
  }

  finish(tab, "Perfil actualizado.");
}

export async function updateProfilePermissionsAction(formData: FormData) {
  const tab = "permissions";
  const context = await getTenant(tab);
  const profileId = asString(formData.get("profileId"));
  const permissions = lines(asString(formData.get("permissions")));

  if (!profileId) {
    fail(tab, "Selecciona un perfil para asignar permisos.");
  }

  const result = await requestBff(
    buildEmployeesMutationPath(
      `/admin/employees/profiles/${encodeURIComponent(profileId)}/permissions`,
      context.organizationId,
      context.shopId,
    ),
    {
      context,
      init: {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ permissions }),
      },
    },
  );

  if (!result.ok) {
    fail(tab, `No se pudieron asignar permisos. ${result.error}`);
  }

  finish(tab, "Permisos del perfil actualizados.");
}

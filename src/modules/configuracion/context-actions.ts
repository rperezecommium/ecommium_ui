"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestAdminBff } from "../../shared/bff/admin-client";
import { getAdminSession } from "../../shared/auth/session";
import type { AdminContext } from "../../shared/config/admin-context";
import { getAdminContext, saveAdminContext } from "../../shared/config/admin-context";
import { defaultAdminContext } from "../../shared/config/env";
import {
  resolveShopContext,
  resolveShopContextById,
  shopToContext,
  type ShopOption,
} from "./organization-shop";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function safeRedirect(path: string, params?: Record<string, string>): never {
  const target = path.startsWith("/admin") ? path : "/admin/configuracion/contexto";
  const [pathname, existingQuery = ""] = target.split("?");
  const query = new URLSearchParams(existingQuery);

  for (const [key, value] of Object.entries(params ?? {})) {
    query.set(key, value);
  }

  redirect(query.size ? `${pathname}?${query.toString()}` : pathname);
}

function revalidateAdminContextRoutes(redirectTo: string) {
  const [path] = redirectTo.split("?");

  revalidatePath("/admin", "layout");
  if (path.startsWith("/admin")) {
    revalidatePath(path);
  }
}

function makeContextFromForm(formData: FormData, current: AdminContext): AdminContext {
  return {
    organizationId: asString(formData.get("organizationId")),
    shopId: asString(formData.get("shopId")),
    shopAlias: asString(formData.get("shopAlias")),
    shopName: asString(formData.get("shopName")),
    primaryDomain: asString(formData.get("primaryDomain")),
    shopStatus: asString(formData.get("shopStatus")),
    locale: asString(formData.get("locale")) || current.locale || defaultAdminContext.locale,
    currency: asString(formData.get("currency")) || current.currency || defaultAdminContext.currency,
    country: asString(formData.get("country")) || current.country || defaultAdminContext.country,
    channel: asString(formData.get("channel")) || current.channel || defaultAdminContext.channel,
  };
}

function makeShopPayload(formData: FormData) {
  const status = asString(formData.get("status"));
  const shopGroupId = asString(formData.get("shopGroupId"));
  const settingsOverride = {
    defaultLocale: asString(formData.get("locale")),
    defaultCurrency: asString(formData.get("currency")),
    defaultCountry: asString(formData.get("country")),
  };

  return {
    name: asString(formData.get("name")),
    shopAlias: asString(formData.get("shopAlias")),
    primaryDomain: asString(formData.get("primaryDomain")),
    ...(shopGroupId ? { shopGroupId } : {}),
    ...(status ? { status } : {}),
    settingsOverride,
  };
}

function parseShop(value: unknown): ShopOption {
  const record = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const effectiveSettings =
    typeof record.effectiveSettings === "object" && record.effectiveSettings !== null
      ? record.effectiveSettings as Record<string, unknown>
      : {};

  return {
    id: typeof record.shopId === "string" ? record.shopId : typeof record.id === "string" ? record.id : "",
    name: typeof record.name === "string" ? record.name : "Tienda",
    organizationId: typeof record.organizationId === "string" ? record.organizationId : "",
    shopAlias: typeof record.shopAlias === "string" ? record.shopAlias : undefined,
    shopGroupId: typeof record.shopGroupId === "string" ? record.shopGroupId : undefined,
    primaryDomain: typeof record.primaryDomain === "string" ? record.primaryDomain : undefined,
    status: typeof record.status === "string" ? record.status : undefined,
    locale: typeof effectiveSettings.defaultLocale === "string" ? effectiveSettings.defaultLocale : undefined,
    currency: typeof effectiveSettings.defaultCurrency === "string" ? effectiveSettings.defaultCurrency : undefined,
    country: typeof effectiveSettings.defaultCountry === "string" ? effectiveSettings.defaultCountry : undefined,
  };
}

function parseOrganization(value: unknown) {
  const record = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  return {
    id: typeof record.organizationId === "string"
      ? record.organizationId
      : typeof record.id === "string"
        ? record.id
        : "",
    name: typeof record.name === "string" ? record.name : "Organization",
  };
}

function hasSystemOrganizationManagement(session: Awaited<ReturnType<typeof getAdminSession>>) {
  if (!session || session.principalType !== "EMPLOYEE" || session.scope !== "admin") {
    return false;
  }

  const roles = new Set(session.roles.map((role) => role.trim().toLowerCase()));
  const permissions = new Set(session.permissions.map((permission) => permission.trim().toLowerCase()));
  return (
    (roles.has("admin") || roles.has("superadmin")) &&
    (permissions.has("*") || permissions.has("admin:*") || permissions.has("organizations-shops.manage"))
  );
}

export async function createOrganizationAction(formData: FormData) {
  const session = await getAdminSession();
  const current = await getAdminContext();
  const name = asString(formData.get("name"));
  const legalName = asString(formData.get("legalName"));

  if (!hasSystemOrganizationManagement(session)) {
    safeRedirect("/admin/configuracion/contexto", {
      contextError: "La sesión actual no puede crear Organizations.",
    });
  }
  if (!name || name.length > 200 || legalName.length > 200) {
    safeRedirect("/admin/configuracion/contexto?tab=create-organization", {
      contextError: "Nombre es obligatorio; nombre y razón social admiten un máximo de 200 caracteres.",
    });
  }

  const result = await requestAdminBff("/admin/organizations-shops/organizations", {
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        ...(legalName ? { legalName } : {}),
        defaultSettings: {
          defaultLocale: asString(formData.get("locale")) || current.locale,
          defaultCurrency: asString(formData.get("currency")) || current.currency,
          defaultCountry: asString(formData.get("country")) || current.country,
          timezone: asString(formData.get("timezone")) || "Europe/Madrid",
        },
      }),
    },
    parse: parseOrganization,
  });

  if (!result.ok || !result.data.id) {
    safeRedirect("/admin/configuracion/contexto?tab=create-organization", {
      contextError: `No se pudo crear la Organization. ${result.ok ? "Respuesta sin organizationId." : result.error}`,
    });
  }

  await saveAdminContext({
    ...current,
    organizationId: result.data.id,
    shopId: "",
    shopAlias: "",
    shopName: "",
    primaryDomain: "",
    shopStatus: "",
  });
  revalidateAdminContextRoutes("/admin/configuracion/contexto");
  safeRedirect("/admin/configuracion/contexto?tab=create-shop", {
    contextNotice: `${result.data.name} fue creada. Crea ahora su primera tienda.`,
  });
}

export async function updateAdminContext(formData: FormData) {
  const current = await getAdminContext();
  const redirectTo = asString(formData.get("redirectTo")) || "/admin/configuracion/contexto";
  const nextContext = makeContextFromForm(formData, current);

  if (!nextContext.organizationId) {
    safeRedirect(redirectTo, { contextError: "Selecciona una Organization." });
  }

  if (nextContext.shopId) {
    const resolved = await resolveShopContextById(nextContext.organizationId, nextContext.shopId);

    if (resolved.ok) {
      await saveAdminContext(shopToContext(resolved.shop, nextContext));
      revalidateAdminContextRoutes(redirectTo);
      safeRedirect(redirectTo, { contextNotice: "Contexto activo actualizado." });
    }
  }

  if (!nextContext.shopId && nextContext.shopAlias) {
    const resolved = await resolveShopContext(nextContext.organizationId, nextContext.shopAlias);

    if (!resolved.ok) {
      safeRedirect(redirectTo, {
        contextError: `Tienda no encontrada para esa Organization: ${nextContext.shopAlias}.`,
      });
    }

    await saveAdminContext(shopToContext(resolved.shop, nextContext));
    revalidateAdminContextRoutes(redirectTo);
    safeRedirect(redirectTo, { contextNotice: "Contexto activo actualizado por shopAlias." });
  }

  if (!nextContext.shopId) {
    safeRedirect(redirectTo, { contextError: "Selecciona una tienda o informa un shopAlias." });
  }

  await saveAdminContext(nextContext);
  revalidateAdminContextRoutes(redirectTo);
  safeRedirect(redirectTo, { contextNotice: "Contexto activo actualizado." });
}

export async function createShopAction(formData: FormData) {
  const current = await getAdminContext();
  const redirectTo = "/admin/configuracion/contexto";
  const organizationId = asString(formData.get("organizationId"));
  const payload = makeShopPayload(formData);

  if (!organizationId || !payload.name || !payload.shopAlias) {
    safeRedirect(redirectTo, {
      contextError: "Para crear tienda necesitas Organization, nombre y shopAlias.",
    });
  }

  const params = new URLSearchParams({ organizationId });
  const result = await requestAdminBff(`/admin/organizations-shops/shops?${params.toString()}`, {
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
    parse: parseShop,
  });

  if (!result.ok || !result.data.id) {
    safeRedirect(redirectTo, {
      contextError: `No se pudo crear la tienda. ${result.ok ? "Respuesta sin shopId." : result.error}`,
    });
  }

  const createdShop = {
    ...result.data,
    organizationId,
  };

  if (formData.get("setActive") === "on") {
    await saveAdminContext(shopToContext(createdShop, current));
    revalidateAdminContextRoutes(redirectTo);
  }

  safeRedirect(redirectTo, {
    contextNotice: formData.get("setActive") === "on"
      ? "Tienda creada y marcada como contexto activo."
      : "Tienda creada. Puedes seleccionarla como contexto activo.",
  });
}

export async function updateShopAction(formData: FormData) {
  const current = await getAdminContext();
  const redirectTo = "/admin/configuracion/contexto";
  const organizationId = asString(formData.get("organizationId"));
  const shopId = asString(formData.get("shopId"));
  const payload = makeShopPayload(formData);

  if (!organizationId || !shopId) {
    safeRedirect(redirectTo, {
      contextError: "Selecciona una tienda existente para editar.",
    });
  }

  const params = new URLSearchParams({ organizationId });
  const result = await requestAdminBff(`/admin/organizations-shops/shops/${shopId}?${params.toString()}`, {
    context: current,
    init: {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
    parse: parseShop,
  });

  if (!result.ok || !result.data.id) {
    safeRedirect(redirectTo, {
      contextError: `No se pudo editar la tienda. ${result.ok ? "Respuesta sin shopId." : result.error}`,
    });
  }

  const updatedShop = {
    ...result.data,
    organizationId,
  };
  const isCurrent =
    current.shopId === shopId ||
    (!current.shopId && Boolean(current.shopAlias) && current.shopAlias === updatedShop.shopAlias);

  if (isCurrent) {
    await saveAdminContext(shopToContext(updatedShop, current));
    revalidateAdminContextRoutes(redirectTo);
  }

  safeRedirect(redirectTo, {
    contextNotice: isCurrent
      ? "Tienda editada y contexto activo actualizado."
      : "Tienda editada.",
  });
}

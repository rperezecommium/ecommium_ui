"use server";

import { redirect } from "next/navigation";
import { requestBff } from "../../shared/bff/client";
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
  const query = new URLSearchParams(params);
  redirect(query.size ? `${target}?${query.toString()}` : target);
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
    safeRedirect(redirectTo, { contextNotice: "Contexto activo actualizado por shopAlias." });
  }

  if (!nextContext.shopId) {
    safeRedirect(redirectTo, { contextError: "Selecciona una tienda o informa un shopAlias." });
  }

  await saveAdminContext(nextContext);
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
  const result = await requestBff(`/admin/organizations-shops/shops?${params.toString()}`, {
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
  const result = await requestBff(`/admin/organizations-shops/shops/${shopId}?${params.toString()}`, {
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
  }

  safeRedirect(redirectTo, {
    contextNotice: isCurrent
      ? "Tienda editada y contexto activo actualizado."
      : "Tienda editada.",
  });
}

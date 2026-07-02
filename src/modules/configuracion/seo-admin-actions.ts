"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "../../shared/config/admin-context";
import { createSeoRedirect, createSeoRoute, patchSeoRoute } from "./seo-admin";
import type { SeoAdminTab } from "./seo-admin";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asBoolean(value: FormDataEntryValue | null) {
  return asString(value) !== "false";
}

function asNullableString(value: FormDataEntryValue | null) {
  return asString(value) ?? null;
}

function asRouteKind(value: FormDataEntryValue | null) {
  return asString(value) === "ALIAS" ? "ALIAS" : "CANONICAL";
}

function futureIsoDate(value: string | null) {
  if (!value) {
    return false;
  }

  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed > new Date();
}

function finish(tab: SeoAdminTab, message?: string, locale?: string, status?: string): never {
  const params = new URLSearchParams({ tab });
  if (message) {
    params.set("seoMessage", message);
  }
  if (locale) {
    params.set("locale", locale);
  }
  if (status) {
    params.set("status", status);
  }

  revalidatePath("/admin/configuracion/seo");
  redirect(`/admin/configuracion/seo?${params.toString()}`);
}

function mutationMessage(
  result: { ok: true } | { ok: false; status?: number; error: string },
  success: string,
) {
  if (result.ok) {
    return success;
  }

  return result.status === 403 ? "Falta permiso routing-seo.routes.write." : result.error;
}

export async function createSeoRouteAction(formData: FormData) {
  const context = await getAdminContext();
  const locale = asString(formData.get("locale")) ?? context.locale;
  const path = asString(formData.get("path"));
  const entityType = asString(formData.get("entityType"));
  const entityId = asString(formData.get("entityId"));

  if (!path || !entityType || !entityId) {
    finish("routes", "Falta path, entityType o entityId.", locale);
  }

  const routeKind = asRouteKind(formData.get("routeKind"));
  const result = await createSeoRoute(context, {
    path,
    entityType,
    entityId,
    routeKind,
    includeInSitemap: routeKind === "ALIAS" ? false : asBoolean(formData.get("includeInSitemap")),
  }, locale);

  finish("routes", mutationMessage(result, "Ruta SEO creada."), locale);
}

export async function patchSeoRouteAction(formData: FormData) {
  const context = await getAdminContext();
  const locale = asString(formData.get("locale")) ?? context.locale;
  const routeId = asString(formData.get("routeId"));

  if (!routeId) {
    finish("routes", "Falta routeId.", locale);
  }

  const routeKind = asRouteKind(formData.get("routeKind"));
  const result = await patchSeoRoute(context, routeId, {
    path: asString(formData.get("path")),
    status: asString(formData.get("status")) ?? "ACTIVE",
    routeKind,
    includeInSitemap: routeKind === "ALIAS" ? false : asBoolean(formData.get("includeInSitemap")),
    createRedirectFromPreviousPath: asBoolean(formData.get("createRedirectFromPreviousPath")),
  }, locale);

  finish("routes", mutationMessage(result, "Ruta SEO actualizada."), locale);
}

export async function createSeoRedirectAction(formData: FormData) {
  const context = await getAdminContext();
  const locale = asString(formData.get("locale")) ?? context.locale;
  const fromPath = asString(formData.get("fromPath"));
  const toPath = asString(formData.get("toPath"));

  if (!fromPath || !toPath) {
    finish("redirects", "Falta origen o destino.", locale);
  }

  const statusCode = asNumber(formData.get("statusCode")) ?? 301;
  const reason = asNullableString(formData.get("reason"));
  const expiresAt = asNullableString(formData.get("expiresAt"));

  if (statusCode === 302 && !reason) {
    finish("redirects", "Un redirect 302 necesita motivo.", locale);
  }
  if (statusCode === 302 && !futureIsoDate(expiresAt)) {
    finish("redirects", "Un redirect 302 necesita expiresAt futuro en formato ISO.", locale);
  }

  const result = await createSeoRedirect(context, {
    fromPath,
    toPath,
    statusCode,
    reason,
    expiresAt,
  }, locale);

  finish("redirects", mutationMessage(result, "Redirect SEO creado."), locale);
}

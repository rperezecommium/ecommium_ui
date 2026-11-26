"use server";

import { getCurrentAdminSession } from "../auth/current-admin-session";
import { getAdminContext } from "../../shared/config/admin-context";
import { getStorefrontNavigationRead } from "../storefront/plp";

export async function loadCmsPreviewNavigation(locale: string) {
  const session = await getCurrentAdminSession();
  if (!session?.permissions.some(permission => ["*", "admin:*", "system.admin", "cms.settings.read", "cms.settings.write", "cms.pages.read", "cms.pages.write"].includes(permission))) {
    return { categories: [], message: "Se necesita una sesión con permisos CMS para cargar la navegación." };
  }
  const context = await getAdminContext();
  if (typeof locale !== "string" || !/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(locale)) return { categories: [], message: "El idioma del preview no es válido." };
  return getStorefrontNavigationRead({ organizationId: context.organizationId, shopId: context.shopId, locale });
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "../../shared/config/admin-context";
import { archiveCmsSitePart, createCmsSitePart, duplicateCmsSitePart, saveCmsShellAssignment, type CmsBreadcrumbMode, type CmsShellScope, type CmsSitePartKind } from "./cms-admin";
import { deleteCmsSitePart, getCmsSitePart, getCmsSitePartUsage } from "./cms-admin";
import { getCurrentAdminSession } from "../auth/current-admin-session";
import { listCmsShellAssignmentPages } from "./cms-admin";

const value = (data: FormData, key: string) => typeof data.get(key) === "string" ? String(data.get(key)).trim() : "";
const pathFor = (kind: CmsSitePartKind) => kind === "HEADER" ? "/admin/cms/headers" : "/admin/cms/footers";
const finish = (kind: CmsSitePartKind, message: string, sitePartId?: string, locale?: string, tab = "design"): never => {
  const params = new URLSearchParams({ cmsSitePartMessage: message, tab });
  if (locale) params.set("locale", locale);
  if (sitePartId) params.set("sitePartId", sitePartId);
  revalidatePath(pathFor(kind));
  redirect(`${pathFor(kind)}?${params.toString()}`);
};

export async function createCmsSitePartAction(data: FormData) {
  const context = await getAdminContext();
  const kind = value(data, "kind") as CmsSitePartKind;
  const name = value(data, "name");
  const result = await createCmsSitePart(context, { kind, name }, value(data, "locale") || context.locale);
  finish(kind, result.ok ? `${kind === "HEADER" ? "Header" : "Footer"} creado.` : result.error, result.ok ? result.data.sitePartId : undefined, value(data, "locale"), result.ok ? "design" : "library");
}

export async function duplicateCmsSitePartAction(data: FormData) {
  const context = await getAdminContext();
  const kind = value(data, "kind") as CmsSitePartKind;
  const result = await duplicateCmsSitePart(context, value(data, "sitePartId"), value(data, "duplicateName") || undefined, value(data, "locale") || context.locale);
  finish(kind, result.ok ? "Copia creada como borrador." : result.error, result.ok ? result.data.sitePartId : undefined, value(data, "locale"));
}

export async function archiveCmsSitePartAction(data: FormData) {
  const context = await getAdminContext();
  const kind = value(data, "kind") as CmsSitePartKind;
  const sitePartId = value(data, "sitePartId");
  const result = await archiveCmsSitePart(context, sitePartId, value(data, "locale") || context.locale);
  finish(kind, result.ok ? "Elemento archivado." : result.error, sitePartId, value(data, "locale"));
}

export async function saveCmsShellAssignmentAction(data: FormData) {
  const session=await getCurrentAdminSession();
  if(session?.scope!=="admin"||!session.permissions.some(permission=>["*","admin:*","system.admin","cms.settings.write"].includes(permission)))throw Error("No tienes permiso para asignar cabeceras o pies.");
  const context = await getAdminContext();
  const kind = value(data, "kind") as CmsSitePartKind;
  const scope = value(data, "scope") as CmsShellScope;
  if(!["HEADER","FOOTER"].includes(kind)||!["DEFAULT","SURFACE","PAGE"].includes(scope)||!["AUTO","HIDDEN"].includes(value(data,"breadcrumbMode"))||(scope!=="DEFAULT"&&!value(data,"scopeKey")))return finish(kind,"La asignación no es válida.",undefined,context.locale,"assignments");
  const selectedId = value(data, "selectedId") === "__none__" ? null : value(data, "selectedId") || null;
  const result = await saveCmsShellAssignment(context, {
    scope,
    scopeKey: scope === "DEFAULT" ? null : value(data, "scopeKey"),
    ...(kind === "HEADER" ? { headerId: selectedId } : { footerId: selectedId }),
    breadcrumbMode: value(data, "breadcrumbMode") as CmsBreadcrumbMode,
  }, value(data, "locale") || context.locale);
  finish(kind, result.ok ? "Asignacion guardada." : result.error, selectedId ?? undefined, value(data, "locale"), "assignments");
}

export async function loadCmsShellAssignmentPagesAction(expected:{organizationId:string;shopId:string;locale:string},offset:number){
  const session=await getCurrentAdminSession(),context=await getAdminContext();
  if(session?.scope!=="admin"||!session.permissions.some(permission=>["*","admin:*","system.admin","cms.pages.read","cms.pages.write"].includes(permission)))return {ok:false as const,message:"No tienes permiso para leer las páginas."};
  if(context.organizationId!==expected.organizationId||context.shopId!==expected.shopId||context.locale!==expected.locale||!Number.isSafeInteger(offset)||offset<0)return {ok:false as const,message:"El contexto o la página de resultados no son válidos."};
  const result=await listCmsShellAssignmentPages(context,offset);
  return result.ok?{ok:true as const,data:result.data}:{ok:false as const,message:result.error};
}

export async function deleteCmsSitePartAction(data: FormData): Promise<{ error: string }> {
  const context = await getAdminContext();
  const id = value(data, "sitePartId"), kind = value(data, "kind") as CmsSitePartKind;
  const locale = value(data, "locale") || context.locale;
  if (!id || !["HEADER", "FOOTER"].includes(kind)) return { error: "Elemento no valido." };
  const current = await getCmsSitePart(context, id, locale);
  if (!current.ok) return { error: current.error };
  if (current.data.sitePartId !== id || current.data.kind !== kind) return { error: "El elemento no coincide con la seleccion." };
  if (value(data, "confirmName") !== current.data.name) return { error: "Escribe el nombre exacto para confirmar la eliminacion." };
  const usage = await getCmsSitePartUsage(context, id, locale);
  if (!usage.ok) return { error: "No se pudo comprobar el uso. No se ha eliminado." };
  if (usage.data.count > 0) return { error: "En uso: reemplaza o retira sus asignaciones antes de eliminar." };
  const result = await deleteCmsSitePart(context, id, locale);
  if (!result.ok) return { error: result.status === 409 ? "El elemento esta en uso o ha cambiado. Revisa sus asignaciones." : result.error };
  return finish(kind, "Elemento eliminado definitivamente.", undefined, locale, "library");
}

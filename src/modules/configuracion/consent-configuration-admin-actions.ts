"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSession } from "../../shared/auth/session";
import { getAdminContext } from "../../shared/config/admin-context";
import { can } from "../../shared/permissions/permissions";
import { createConsentDraft, createNextConsentDraft, deactivateConsentOverride, deleteConsentHistoricalVersion, getConsentIntegrationCatalogAdminData, parseConsentPolicy, publishConsentDraft, updateConsentDraft, validateConsentDraft, type ConsentDraftInput, type ConsentIntegrationCatalogEntry, type ConsentScopeType, type ConsentSystemProfile } from "./consent-configuration-admin";

const route = "/admin/configuracion/consent";
const scopes = new Set<ConsentScopeType>(["ORGANIZATION", "SHOP"]);
const profiles = new Set<ConsentSystemProfile>(["EU_BASELINE", "ES_AEPD"]);

function finish(notice: string, scopeType = "SHOP"): never { revalidatePath(route); redirect(`${route}?scopeType=${scopeType}&notice=${encodeURIComponent(notice)}`); }
function formText(formData: FormData, name: string) { const value = formData.get(name); return typeof value === "string" ? value.trim() : ""; }

function assertPermission(session: Awaited<ReturnType<typeof getAdminSession>>, permission: "admin:consent:write" | "admin:consent:publish") {
  return Boolean(session && session.scope === "admin" && can(session, permission));
}

function validateIntegrationBindings(policy: ConsentDraftInput["policy"], catalog: ConsentIntegrationCatalogEntry[]) {
  for (const service of policy.services) {
    const binding = service.integration;
    if (!binding) continue;
    const entry = catalog.find((candidate) => candidate.providerKey === binding.providerKey && candidate.contractVersion === binding.contractVersion);
    if (!entry) throw new Error("La integración ya no está aprobada. Recarga el catálogo antes de guardar.");
    if (service.thirdParty !== entry.thirdParty || service.purposeKeys.length !== 1 || service.purposeKeys[0] !== entry.requiredPurposeKey) throw new Error("La integración debe conservar la finalidad aprobada.");
    const purpose = policy.purposes.find((candidate) => candidate.purposeKey === entry.requiredPurposeKey);
    if (!purpose || purpose.necessary || entry.requiredPurposeClassification !== "OPTIONAL") throw new Error("La integración requiere una finalidad opcional compatible.");
    const fields = new Map(entry.fields.map((field) => [field.key, field]));
    const configurationKeys = Object.keys(binding.publicConfig);
    if (configurationKeys.length !== fields.size || configurationKeys.some((field) => !fields.has(field))) throw new Error("La configuración pública de la integración no coincide con el proveedor aprobado.");
    for (const field of entry.fields) {
      const value = binding.publicConfig[field.key];
      if (typeof value !== "string" || (field.required && !value.trim()) || (field.maxLength && value.length > field.maxLength)) throw new Error(`Revisa ${field.label}.`);
      if (field.pattern) {
        let matcher: RegExp;
        try { matcher = new RegExp(field.pattern); } catch { throw new Error("El catálogo de integraciones no contiene un formato válido."); }
        if (!matcher.test(value)) throw new Error(`Revisa ${field.label}.`);
      }
    }
    const resources = policy.resources.filter((resource) => resource.serviceKey === service.serviceKey);
    if (!resources.length || resources.some((resource) => resource.classification !== entry.requiredPurposeClassification || resource.purposeKeys.length !== 1 || resource.purposeKeys[0] !== entry.requiredPurposeKey || !entry.requiredResourceTypes.includes(resource.resourceType)) || entry.requiredResourceTypes.some((resourceType) => !resources.some((resource) => resource.resourceType === resourceType))) {
      throw new Error("Los recursos de la integración no coinciden con su proveedor aprobado.");
    }
  }
}

async function draftFromForm(formData: FormData, catalog: ConsentIntegrationCatalogEntry[]): Promise<ConsentDraftInput> {
  const scopeType = formText(formData, "scopeType") as ConsentScopeType;
  const defaultLocale = formText(formData, "defaultLocale");
  const supportedLocales = formText(formData, "supportedLocales").split(",").map((value) => value.trim()).filter(Boolean);
  const systemProfile = formText(formData, "systemProfile") as ConsentSystemProfile;
  if (!scopes.has(scopeType) || !profiles.has(systemProfile) || !defaultLocale || !supportedLocales.includes(defaultLocale)) throw new Error("Revisa scope, locale por defecto y perfiles regulatorios.");
  let policy: ConsentDraftInput["policy"];
  try { policy = parseConsentPolicy(JSON.parse(formText(formData, "policy"))); } catch { throw new Error("La estructura de finalidades, servicios o recursos no es válida."); }
  if (systemProfile === "ES_AEPD") { policy.firstLayerRejectAction = true; policy.optionalPurposesPreselected = false; }
  validateIntegrationBindings(policy, catalog);
  return { scopeType, defaultLocale, supportedLocales, systemProfile, policy };
}

export async function saveConsentDraftAction(formData: FormData): Promise<never> {
  const session = await getAdminSession();
  const scopeType = formText(formData, "scopeType") || "SHOP";
  if (!assertPermission(session, "admin:consent:write")) finish("Falta permiso consent.configuration.write.", scopeType);
  const context = await getAdminContext();
  const catalog = await getConsentIntegrationCatalogAdminData(context);
  if (!catalog.ok) finish("No se pudo verificar el catálogo de integraciones. Inténtalo de nuevo cuando el BFF esté disponible.", scopeType);
  let input: ConsentDraftInput;
  try { input = await draftFromForm(formData, catalog.data); } catch (error) { finish(error instanceof Error ? error.message : "No se pudo validar el borrador.", scopeType); }
  const configurationVersionId = formText(formData, "configurationVersionId");
  const result = configurationVersionId
    ? await updateConsentDraft(context, configurationVersionId, { ...input, expectedUpdatedAt: formText(formData, "expectedUpdatedAt") })
    : await createConsentDraft(context, input);
  if (!result.ok) finish(result.status === 409 ? "El borrador cambió en otra sesión. Recarga antes de guardar." : result.error, input.scopeType);
  finish(`Borrador de Consentimiento guardado. Versión ${result.data.version}.`, input.scopeType);
}

export async function validateConsentDraftAction(formData: FormData): Promise<never> {
  const session = await getAdminSession(); const scopeType = formText(formData, "scopeType") || "SHOP";
  if (!assertPermission(session, "admin:consent:write")) finish("Falta permiso consent.configuration.write.", scopeType);
  const result = await validateConsentDraft(await getAdminContext(), formText(formData, "configurationVersionId"));
  if (!result.ok) finish(result.error, scopeType);
  finish(result.data.valid ? "El borrador es publicable." : `El borrador aún no es publicable: ${result.data.code ?? "revisa la política"}.`, scopeType);
}

export async function publishConsentDraftAction(formData: FormData): Promise<never> {
  const session = await getAdminSession(); const scopeType = formText(formData, "scopeType") || "SHOP";
  if (!assertPermission(session, "admin:consent:publish")) finish("Falta permiso consent.configuration.publish.", scopeType);
  if (formText(formData, "confirmPublish") !== "PUBLICAR") finish("Para publicar escribe PUBLICAR y vuelve a intentarlo.", scopeType);
  const result = await publishConsentDraft(await getAdminContext(), formText(formData, "configurationVersionId"), formText(formData, "expectedUpdatedAt"));
  if (!result.ok) finish(result.status === 409 ? "El borrador cambió en otra sesión. Recarga antes de publicar." : result.error, scopeType);
  finish(`Consentimiento publicado. Versión ${result.data.version}; Storefront solicitará renovación cuando corresponda.`, scopeType);
}

export async function createNextConsentDraftAction(formData: FormData): Promise<never> {
  const session = await getAdminSession(); const scopeType = formText(formData, "scopeType") || "SHOP";
  if (!assertPermission(session, "admin:consent:write")) finish("Falta permiso consent.configuration.write.", scopeType);
  const result = await createNextConsentDraft(await getAdminContext(), formText(formData, "configurationId"));
  if (!result.ok) finish(result.error, scopeType);
  finish(`Nueva revisión creada: versión ${result.data.version}.`, scopeType);
}

export async function returnConsentOverrideToInheritanceAction(formData: FormData): Promise<never> {
  const session = await getAdminSession(); const scopeType = formText(formData, "scopeType") || "SHOP";
  if (!assertPermission(session, "admin:consent:write")) finish("Falta permiso consent.configuration.write.", scopeType);
  if (scopeType !== "SHOP") finish("Solo una Shop puede volver a heredar.", scopeType);
  if (formText(formData, "confirmInheritance") !== "HEREDAR") finish("Para volver a heredar escribe HEREDAR y vuelve a intentarlo.", scopeType);
  const result = await deactivateConsentOverride(await getAdminContext(), formText(formData, "configurationId"), formText(formData, "expectedUpdatedAt"));
  if (!result.ok) finish(result.status === 409 ? "La configuración cambió en otra sesión. Recarga antes de volver a heredar." : result.error, scopeType);
  finish("La Shop vuelve a heredar. El historial se conserva.", scopeType);
}

export async function deleteConsentHistoricalVersionAction(formData: FormData): Promise<never> {
  const session = await getAdminSession();
  if (!assertPermission(session, "admin:consent:write")) {
    revalidatePath(route);
    redirect(`${route}?tab=HISTORY&notice=${encodeURIComponent("Falta permiso consent.configuration.write.")}`);
  }
  if (formText(formData, "confirmDelete") !== "ELIMINAR") {
    revalidatePath(route);
    redirect(`${route}?tab=HISTORY&notice=${encodeURIComponent("Para eliminar escribe ELIMINAR y vuelve a intentarlo.")}`);
  }
  const result = await deleteConsentHistoricalVersion(
    await getAdminContext(),
    formText(formData, "configurationVersionId"),
    formText(formData, "expectedUpdatedAt"),
  );
  revalidatePath(route);
  redirect(`${route}?tab=HISTORY&notice=${encodeURIComponent(result.ok ? "Versión histórica eliminada." : result.status === 409 ? "La versión está protegida por recibos de consentimiento o cambió en otra sesión." : result.error)}`);
}

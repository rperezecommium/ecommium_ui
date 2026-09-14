import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";
import { requestAdminBff } from "../../shared/bff/admin-client";
import type { BffResult } from "../../shared/bff/types";

export type ConsentScopeType = "ORGANIZATION" | "SHOP";
export type ConsentSystemProfile = "EU_BASELINE" | "ES_AEPD";
export type ConsentResourceType = "COOKIE" | "LOCAL_STORAGE" | "SESSION_STORAGE" | "INDEXED_DB" | "SCRIPT" | "PIXEL" | "IFRAME" | "REQUEST";
export type ConsentIntegrationBinding = {
  providerKey: string;
  contractVersion: number;
  enabled: boolean;
  publicConfig: Record<string, string>;
};
export type ConsentIntegrationCatalogField = {
  key: string;
  label: string;
  helpText: string;
  valueType: "STRING";
  required: boolean;
  pattern?: string;
  maxLength?: number;
};
export type ConsentIntegrationCatalogEntry = {
  providerKey: string;
  contractVersion: number;
  displayName: string;
  description: string;
  thirdParty: boolean;
  requiredPurposeClassification: "NECESSARY" | "OPTIONAL";
  requiredPurposeKey: string;
  requiredResourceTypes: ConsentResourceType[];
  fields: ConsentIntegrationCatalogField[];
};

export type ConsentPolicy = {
  firstLayerRejectAction: boolean;
  optionalPurposesPreselected: boolean;
  purposes: Array<{ purposeKey: string; necessary: boolean; content: Record<string, { title: string; description: string }> }>;
  services: Array<{ serviceKey: string; purposeKeys: string[]; thirdParty: boolean; content: Record<string, { name: string; description: string; privacyPolicyUrl?: string }>; integration?: ConsentIntegrationBinding }>;
  resources: Array<{ resourceKey: string; serviceKey: string; purposeKeys: string[]; resourceType: ConsentResourceType; classification: "NECESSARY" | "OPTIONAL"; cleanupRequired: boolean }>;
};

export type ConsentConfiguration = {
  configurationId: string;
  configurationVersionId: string;
  version: number;
  status: "DRAFT" | "PUBLISHED" | "SUPERSEDED";
  scopeType: ConsentScopeType;
  defaultLocale: string;
  supportedLocales: string[];
  systemProfile: ConsentSystemProfile;
  policy: ConsentPolicy;
  isActive: boolean;
  updatedAt: string;
  publishedAt: string | null;
};

export type ConsentConfigurationSource = {
  scopeType: ConsentScopeType;
  scopeId: string;
  configurationId: string;
  configurationVersionId: string;
  version: number;
};

export type ConsentEffectiveConfiguration = {
  status: "AVAILABLE" | "NOT_CONFIGURED";
  source: ConsentConfigurationSource | null;
  published: ConsentConfiguration | null;
};

export type ConsentConfigurationState = {
  status: "AVAILABLE" | "NOT_CONFIGURED";
  draft: ConsentConfiguration | null;
  published: ConsentConfiguration | null;
  history: ConsentConfiguration[];
  selectedScope: { scopeType: ConsentScopeType; scopeId: string };
  effective: ConsentEffectiveConfiguration;
};
export type ConsentDraftInput = { scopeType: ConsentScopeType; defaultLocale: string; supportedLocales: string[]; systemProfile: ConsentSystemProfile; policy: ConsentPolicy; expectedUpdatedAt?: string };

const resourceTypes = new Set<ConsentResourceType>(["COOKIE", "LOCAL_STORAGE", "SESSION_STORAGE", "INDEXED_DB", "SCRIPT", "PIXEL", "IFRAME", "REQUEST"]);
const scopes = new Set<ConsentScopeType>(["ORGANIZATION", "SHOP"]);
const profiles = new Set<ConsentSystemProfile>(["EU_BASELINE", "ES_AEPD"]);

const record = (value: unknown, field: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Respuesta BFF inválida: ${field}.`);
  return value as Record<string, unknown>;
};
const text = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Respuesta BFF inválida: ${field}.`);
  return value.trim();
};
const strings = (value: unknown, field: string) => {
  if (!Array.isArray(value)) throw new Error(`Respuesta BFF inválida: ${field}.`);
  return value.map((item, index) => text(item, `${field}[${index}]`));
};

function parseContent(value: unknown, field: string, names: readonly [string, string]) {
  const content = record(value, field);
  return Object.fromEntries(Object.entries(content).map(([locale, item]) => {
    const localized = record(item, `${field}.${locale}`);
    return [text(locale, `${field}.locale`), {
      [names[0]]: text(localized[names[0]], `${field}.${locale}.${names[0]}`),
      [names[1]]: text(localized[names[1]], `${field}.${locale}.${names[1]}`),
      ...(typeof localized.privacyPolicyUrl === "string" && localized.privacyPolicyUrl.trim() ? { privacyPolicyUrl: localized.privacyPolicyUrl.trim() } : {}),
    }];
  }));
}

function parseIntegration(value: unknown): ConsentIntegrationBinding {
  const integration = record(value, "service.integration");
  if (!Number.isInteger(integration.contractVersion) || (integration.contractVersion as number) < 1 || typeof integration.enabled !== "boolean") {
    throw new Error("Respuesta BFF inválida: service.integration.");
  }
  const publicConfig = record(integration.publicConfig, "service.integration.publicConfig");
  return {
    providerKey: text(integration.providerKey, "service.integration.providerKey"),
    contractVersion: integration.contractVersion as number,
    enabled: integration.enabled,
    publicConfig: Object.fromEntries(Object.entries(publicConfig).map(([field, item]) => [text(field, "service.integration.publicConfig.field"), text(item, `service.integration.publicConfig.${field}`)])),
  };
}

export function parseConsentPolicy(value: unknown): ConsentPolicy {
  const policy = record(value, "policy");
  if (typeof policy.firstLayerRejectAction !== "boolean" || typeof policy.optionalPurposesPreselected !== "boolean") throw new Error("Respuesta BFF inválida: reglas de primera capa.");
  if (!Array.isArray(policy.purposes) || !Array.isArray(policy.services) || !Array.isArray(policy.resources)) throw new Error("Respuesta BFF inválida: policy.");
  return {
    firstLayerRejectAction: policy.firstLayerRejectAction,
    optionalPurposesPreselected: policy.optionalPurposesPreselected,
    purposes: policy.purposes.map((item, index) => {
      const purpose = record(item, `policy.purposes[${index}]`);
      if (typeof purpose.necessary !== "boolean") throw new Error("Respuesta BFF inválida: purpose.necessary.");
      return { purposeKey: text(purpose.purposeKey, "purposeKey"), necessary: purpose.necessary, content: parseContent(purpose.content, "purpose.content", ["title", "description"]) as ConsentPolicy["purposes"][number]["content"] };
    }),
    services: policy.services.map((item, index) => {
      const service = record(item, `policy.services[${index}]`);
      if (typeof service.thirdParty !== "boolean") throw new Error("Respuesta BFF inválida: service.thirdParty.");
      return { serviceKey: text(service.serviceKey, "serviceKey"), purposeKeys: strings(service.purposeKeys, "service.purposeKeys"), thirdParty: service.thirdParty, content: parseContent(service.content, "service.content", ["name", "description"]) as ConsentPolicy["services"][number]["content"], ...(service.integration === undefined ? {} : { integration: parseIntegration(service.integration) }) };
    }),
    resources: policy.resources.map((item, index) => {
      const resource = record(item, `policy.resources[${index}]`);
      const resourceType = text(resource.resourceType, "resource.resourceType") as ConsentResourceType;
      if (!resourceTypes.has(resourceType) || (resource.classification !== "NECESSARY" && resource.classification !== "OPTIONAL") || typeof resource.cleanupRequired !== "boolean") throw new Error("Respuesta BFF inválida: resource.");
      return { resourceKey: text(resource.resourceKey, "resourceKey"), serviceKey: text(resource.serviceKey, "resource.serviceKey"), purposeKeys: strings(resource.purposeKeys, "resource.purposeKeys"), resourceType, classification: resource.classification, cleanupRequired: resource.cleanupRequired };
    }),
  };
}

export function parseConsentConfiguration(value: unknown): ConsentConfiguration {
  const configuration = record(value, "configuration");
  const scopeType = text(configuration.scopeType, "scopeType") as ConsentScopeType;
  const systemProfile = text(configuration.systemProfile, "systemProfile") as ConsentSystemProfile;
  if (!scopes.has(scopeType) || !profiles.has(systemProfile) || !["DRAFT", "PUBLISHED", "SUPERSEDED"].includes(text(configuration.status, "status")) || !Number.isInteger(configuration.version)) throw new Error("Respuesta BFF inválida: configuración Consent.");
  if (typeof configuration.isActive !== "boolean") throw new Error("Respuesta BFF inválida: configuración activa.");
  return { configurationId: text(configuration.configurationId, "configurationId"), configurationVersionId: text(configuration.configurationVersionId, "configurationVersionId"), version: configuration.version as number, status: configuration.status as ConsentConfiguration["status"], scopeType, defaultLocale: text(configuration.defaultLocale, "defaultLocale"), supportedLocales: strings(configuration.supportedLocales, "supportedLocales"), systemProfile, policy: parseConsentPolicy(configuration.policy), isActive: configuration.isActive, updatedAt: text(configuration.updatedAt, "updatedAt"), publishedAt: typeof configuration.publishedAt === "string" ? configuration.publishedAt : null };
}

export function parseConsentConfigurationState(value: unknown): ConsentConfigurationState {
  const state = record(value, "respuesta");
  if (state.status !== "AVAILABLE" && state.status !== "NOT_CONFIGURED") throw new Error("Respuesta BFF inválida: status Consent.");
  const selectedScope = record(state.selectedScope, "selectedScope");
  const selectedScopeType = text(selectedScope.scopeType, "selectedScope.scopeType") as ConsentScopeType;
  if (!scopes.has(selectedScopeType)) throw new Error("Respuesta BFF inválida: selectedScope.scopeType.");
  const effective = record(state.effective, "effective");
  if (effective.status !== "AVAILABLE" && effective.status !== "NOT_CONFIGURED") throw new Error("Respuesta BFF inválida: effective.status.");
  if (effective.status === "NOT_CONFIGURED" && (effective.source !== null || effective.published !== null)) throw new Error("Respuesta BFF inválida: configuración efectiva.");
  let source: ConsentConfigurationSource | null = null;
  let published: ConsentConfiguration | null = null;
  if (effective.status === "AVAILABLE") {
    const sourceValue = record(effective.source, "effective.source");
    const sourceScopeType = text(sourceValue.scopeType, "effective.source.scopeType") as ConsentScopeType;
    if (!scopes.has(sourceScopeType) || !Number.isInteger(sourceValue.version)) throw new Error("Respuesta BFF inválida: effective.source.");
    source = {
      scopeType: sourceScopeType,
      scopeId: text(sourceValue.scopeId, "effective.source.scopeId"),
      configurationId: text(sourceValue.configurationId, "effective.source.configurationId"),
      configurationVersionId: text(sourceValue.configurationVersionId, "effective.source.configurationVersionId"),
      version: sourceValue.version as number,
    };
    published = parseConsentConfiguration(effective.published);
  }
  return {
    status: state.status,
    draft: state.draft ? parseConsentConfiguration(state.draft) : null,
    published: state.published ? parseConsentConfiguration(state.published) : null,
    history: Array.isArray(state.history) ? state.history.map(parseConsentConfiguration) : [],
    selectedScope: { scopeType: selectedScopeType, scopeId: text(selectedScope.scopeId, "selectedScope.scopeId") },
    effective: { status: effective.status, source, published },
  };
}

function parseIntegrationCatalog(value: unknown): ConsentIntegrationCatalogEntry[] {
  const response = record(value, "catálogo de integraciones");
  if (!Array.isArray(response.integrations)) throw new Error("Respuesta BFF inválida: integrations.");
  return response.integrations.map((item, index) => {
    const entry = record(item, `integrations[${index}]`);
    if (!Number.isInteger(entry.contractVersion) || (entry.contractVersion as number) < 1 || typeof entry.thirdParty !== "boolean" || (entry.requiredPurposeClassification !== "NECESSARY" && entry.requiredPurposeClassification !== "OPTIONAL") || !Array.isArray(entry.fields)) {
      throw new Error("Respuesta BFF inválida: integración aprobada.");
    }
    return {
      providerKey: text(entry.providerKey, "integration.providerKey"),
      contractVersion: entry.contractVersion as number,
      displayName: text(entry.displayName, "integration.displayName"),
      description: text(entry.description, "integration.description"),
      thirdParty: entry.thirdParty,
      requiredPurposeClassification: entry.requiredPurposeClassification,
      requiredPurposeKey: text(entry.requiredPurposeKey, "integration.requiredPurposeKey"),
      requiredResourceTypes: strings(entry.requiredResourceTypes, "integration.requiredResourceTypes").map((resourceType) => {
        if (!resourceTypes.has(resourceType as ConsentResourceType)) throw new Error("Respuesta BFF inválida: integration.requiredResourceTypes.");
        return resourceType as ConsentResourceType;
      }),
      fields: entry.fields.map((field, fieldIndex) => {
        const specification = record(field, `integration.fields[${fieldIndex}]`);
        if (specification.valueType !== "STRING" || typeof specification.required !== "boolean") throw new Error("Respuesta BFF inválida: integration.field.");
        if (specification.maxLength !== undefined && (!Number.isInteger(specification.maxLength) || (specification.maxLength as number) < 1 || (specification.maxLength as number) > 256)) throw new Error("Respuesta BFF inválida: integration.field.maxLength.");
        if (specification.pattern !== undefined && (typeof specification.pattern !== "string" || specification.pattern.length > 256)) throw new Error("Respuesta BFF inválida: integration.field.pattern.");
        return { key: text(specification.key, "integration.field.key"), label: text(specification.label, "integration.field.label"), helpText: text(specification.helpText, "integration.field.helpText"), valueType: "STRING" as const, required: specification.required, ...(typeof specification.pattern === "string" ? { pattern: specification.pattern } : {}), ...(typeof specification.maxLength === "number" ? { maxLength: specification.maxLength } : {}) };
      }),
    };
  });
}

function path(context: AdminContext, suffix: string, scopeType?: ConsentScopeType) {
  const query = new URLSearchParams({ organizationId: context.organizationId, shopId: context.shopId });
  if (scopeType) query.set("scopeType", scopeType);
  return `/admin/consent/${suffix}${suffix.includes("?") ? "&" : "?"}${query}`;
}

function missing<T>(message: string): BffResult<T> { return { ok: false, status: 428, error: message, correlationId: "consent-context-missing" }; }

export async function getConsentConfigurationAdminData(context: AdminContext, scopeType: ConsentScopeType): Promise<BffResult<ConsentConfigurationState>> {
  if (!hasRequiredAdminContext(context)) return missing("Define una Organization y Shop activas para configurar Consentimiento.");
  return requestAdminBff(path(context, "configurations", scopeType), { context, parse: parseConsentConfigurationState });
}

export async function getConsentIntegrationCatalogAdminData(context: AdminContext): Promise<BffResult<ConsentIntegrationCatalogEntry[]>> {
  if (!hasRequiredAdminContext(context)) return missing("Define una Organization y Shop activas para consultar integraciones aprobadas.");
  const query = new URLSearchParams({ organizationId: context.organizationId, shopId: context.shopId });
  return requestAdminBff(`/admin/consent/integrations?${query}`, { context, parse: parseIntegrationCatalog });
}

export async function createConsentDraft(context: AdminContext, draft: ConsentDraftInput): Promise<BffResult<ConsentConfiguration>> {
  if (!hasRequiredAdminContext(context)) return missing("Define una Organization y Shop activas para crear el borrador.");
  return requestAdminBff(path(context, "drafts"), { context, init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) }, parse: parseConsentConfiguration });
}

export async function updateConsentDraft(context: AdminContext, configurationVersionId: string, draft: Required<Pick<ConsentDraftInput, "expectedUpdatedAt">> & Omit<ConsentDraftInput, "scopeType" | "expectedUpdatedAt">): Promise<BffResult<ConsentConfiguration>> {
  if (!hasRequiredAdminContext(context)) return missing("Define una Organization y Shop activas para editar el borrador.");
  return requestAdminBff(path(context, `drafts/${encodeURIComponent(configurationVersionId)}`), { context, init: { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) }, parse: parseConsentConfiguration });
}

export async function validateConsentDraft(context: AdminContext, configurationVersionId: string): Promise<BffResult<{ valid: boolean; code: string | null }>> {
  if (!hasRequiredAdminContext(context)) return missing("Define una Organization y Shop activas para validar el borrador.");
  return requestAdminBff(path(context, `drafts/${encodeURIComponent(configurationVersionId)}/validate`), { context, init: { method: "POST" }, parse: (value) => { const response = record(value, "validación"); if (typeof response.valid !== "boolean") throw new Error("Respuesta BFF inválida: validación."); return { valid: response.valid, code: typeof response.code === "string" ? response.code : null }; } });
}

export async function publishConsentDraft(context: AdminContext, configurationVersionId: string, expectedUpdatedAt: string): Promise<BffResult<ConsentConfiguration>> {
  if (!hasRequiredAdminContext(context)) return missing("Define una Organization y Shop activas para publicar.");
  return requestAdminBff(path(context, `drafts/${encodeURIComponent(configurationVersionId)}/publish`), { context, init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedUpdatedAt }) }, parse: parseConsentConfiguration });
}

export async function createNextConsentDraft(context: AdminContext, configurationId: string): Promise<BffResult<ConsentConfiguration>> {
  if (!hasRequiredAdminContext(context)) return missing("Define una Organization y Shop activas para crear una revisión.");
  return requestAdminBff(path(context, `configurations/${encodeURIComponent(configurationId)}/drafts`), { context, init: { method: "POST" }, parse: parseConsentConfiguration });
}

export async function deactivateConsentOverride(context: AdminContext, configurationId: string, expectedUpdatedAt: string): Promise<BffResult<ConsentConfiguration>> {
  if (!hasRequiredAdminContext(context)) return missing("Define una Organization y Shop activas para volver a heredar.");
  return requestAdminBff(path(context, `configurations/${encodeURIComponent(configurationId)}/deactivate`), { context, init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedUpdatedAt }) }, parse: parseConsentConfiguration });
}

export async function deleteConsentHistoricalVersion(context: AdminContext, configurationVersionId: string, expectedUpdatedAt: string): Promise<BffResult<{ deleted: true }>> {
  if (!hasRequiredAdminContext(context)) return missing("Define una Organization y Shop activas para eliminar una versión.");
  return requestAdminBff(path(context, `versions/${encodeURIComponent(configurationVersionId)}`), {
    context,
    init: { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedUpdatedAt }) },
    parse: (value) => {
      const response = record(value, "eliminación de versión");
      if (response.deleted !== true) throw new Error("Respuesta BFF inválida: eliminación de versión.");
      return { deleted: true };
    },
  });
}

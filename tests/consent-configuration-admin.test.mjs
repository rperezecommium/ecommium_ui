import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function loadConsentAdminModule() {
  const output = ts.transpileModule(source("src/modules/configuracion/consent-configuration-admin.ts"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const context = {
    URLSearchParams,
    exports,
    module: { exports },
    require(specifier) {
      if (specifier.endsWith("/shared/config/admin-context")) return { hasRequiredAdminContext: () => true };
      if (specifier.endsWith("/shared/bff/admin-client")) return { requestAdminBff: () => undefined };
      throw new Error(`Unexpected test require: ${specifier}`);
    },
  };
  vm.runInNewContext(output, context);
  return context.module.exports;
}

const consentAdmin = loadConsentAdminModule();

const policy = {
  firstLayerRejectAction: true,
  optionalPurposesPreselected: false,
  purposes: [{ purposeKey: "necessary", necessary: true, content: { "es-ES": { title: "Necesarias", description: "Funcionamiento" } } }],
  services: [{ serviceKey: "core", purposeKeys: ["necessary"], thirdParty: false, content: { "es-ES": { name: "Core", description: "Funcionamiento" } } }],
  resources: [{ resourceKey: "core-cookie", serviceKey: "core", purposeKeys: ["necessary"], resourceType: "COOKIE", classification: "NECESSARY", cleanupRequired: false }],
};

function publishedConfiguration(scopeType, version = 4) {
  return {
    configurationId: `${scopeType.toLowerCase()}-configuration`,
    configurationVersionId: `${scopeType.toLowerCase()}-version`,
    version,
    status: "PUBLISHED",
    scopeType,
    defaultLocale: "es-ES",
    supportedLocales: ["es-ES"],
    systemProfile: "ES_AEPD",
    policy,
    isActive: true,
    updatedAt: "2026-08-31T10:00:00.000Z",
    publishedAt: "2026-08-31T10:00:00.000Z",
  };
}

function inheritedState(sourceScopeType, selectedScopeType = "SHOP") {
  const sourceId = sourceScopeType === "ORGANIZATION" ? "organization-1" : "shop-1";
  const source = publishedConfiguration(sourceScopeType);
  return {
    status: sourceScopeType === selectedScopeType ? "AVAILABLE" : "NOT_CONFIGURED",
    draft: null,
    published: sourceScopeType === selectedScopeType ? source : null,
    selectedScope: { scopeType: selectedScopeType, scopeId: "shop-1" },
    effective: {
      status: "AVAILABLE",
      source: {
        scopeType: sourceScopeType,
        scopeId: sourceId,
        configurationId: source.configurationId,
        configurationVersionId: source.configurationVersionId,
        version: source.version,
      },
      published: source,
    },
  };
}

test("Consent Admin uses only scoped Admin BFF lifecycle endpoints and the closed integration catalog", () => {
  const data = source("src/modules/configuracion/consent-configuration-admin.ts");
  assert.match(data, /`\/admin\/consent\/\$\{suffix\}/);
  assert.match(data, /path\(context, "configurations", scopeType\)/);
  assert.match(data, /path\(context, "drafts"\)/);
  assert.match(data, /\/admin\/consent\/integrations\?/);
  assert.match(data, /parseIntegrationCatalog/);
  assert.match(data, /expectedUpdatedAt/);
  assert.match(data, /configurations\/\$\{encodeURIComponent\(configurationId\)\}\/deactivate/);
  assert.match(data, /versions\/\$\{encodeURIComponent\(configurationVersionId\)\}/);
  assert.match(data, /deleteConsentHistoricalVersion/);
  assert.match(data, /requestAdminBff/);
  assert.doesNotMatch(data, /services\/consent|CONSENT_INTERNAL_TOKEN/);
});

test("Consent Admin integrates permissions, structured editing and guarded publishing", () => {
  const editor = source("src/modules/configuracion/consent-configuration-form-client.tsx");
  const activeEditor = editor.slice(editor.lastIndexOf("export function ConsentConfigurationForm"));
  const preview = source("src/modules/configuracion/consent-configuration-preview.tsx");
  const adminPage = source("src/modules/configuracion/consent-configuration-admin-page.tsx");
  const actions = source("src/modules/configuracion/consent-configuration-admin-actions.ts");
  const page = source("app/(admin)/admin/configuracion/consent/page.tsx");
  assert.match(activeEditor, /Servicios aprobados/); assert.match(activeEditor, /Proveedor aprobado/); assert.match(activeEditor, /Añadir y configurar/); assert.match(activeEditor, /entry\.fields\.map/); assert.match(activeEditor, /field\.helpText/); assert.match(activeEditor, /ConsentConfigurationPreview/); assert.doesNotMatch(activeEditor, /textarea/);
  assert.doesNotMatch(activeEditor, /Añadir servicio|Inventario técnico avanzado|Servicios declarados|Recursos tecnológicos declarados/); assert.doesNotMatch(activeEditor, /name="(?:header|footer|script|html)"/);
  assert.match(activeEditor, /No pegues scripts, HTML ni URLs/);
  assert.match(preview, /Previsualización segura/); assert.match(preview, /No guarda cambios ni carga tecnologías/);
  assert.doesNotMatch(preview, /fetch\(|dangerouslySetInnerHTML|<iframe|<script|style=/);
  assert.match(actions, /confirmPublish/) ; assert.match(actions, /result\.status === 409/);
  assert.match(actions, /confirmInheritance/); assert.match(actions, /deactivateConsentOverride/);
  assert.match(actions, /confirmDelete/); assert.match(actions, /ELIMINAR/);
  assert.match(actions, /validateIntegrationBindings/); assert.match(actions, /getConsentIntegrationCatalogAdminData/);
  assert.match(page, /admin:consent:publish/);
  assert.match(adminPage, /!published && canWrite/);
});

test("Consent Admin exposes Shop, Organization and a protected version history", () => {
  const adminPage = source("src/modules/configuracion/consent-configuration-admin-page.tsx");
  const page = source("app/(admin)/admin/configuracion/consent/page.tsx");
  const state = inheritedState("SHOP");
  state.history = [{ ...publishedConfiguration("SHOP", 3), status: "SUPERSEDED", isActive: true }];
  const parsed = consentAdmin.parseConsentConfigurationState(state);
  assert.equal(parsed.history[0].status, "SUPERSEDED");
  assert.match(adminPage, />Historial</);
  assert.match(adminPage, /SUPERSEDED/);
  assert.match(adminPage, /deleteConsentHistoricalVersionAction/);
  assert.match(page, /tab === "HISTORY"/);
});

test("Consent Admin distinguishes its own configuration from the configuration it inherits", () => {
  const data = source("src/modules/configuracion/consent-configuration-admin.ts");
  const editor = source("src/modules/configuracion/consent-configuration-form-client.tsx");
  const adminPage = source("src/modules/configuracion/consent-configuration-admin-page.tsx");
  assert.match(data, /selectedScope/);
  assert.match(data, /effective/);
  assert.match(data, /effective\.source/);
  assert.match(adminPage, /Configuración que se aplica/);
  assert.match(adminPage, /hereda la versión/);
  assert.match(adminPage, /inheritedConfiguration=\{inherited \? effectivePublished : null\}/);
  assert.match(editor, /Esta versión parte de la Organization/);
  assert.match(adminPage, /Volver a heredar/);
  assert.match(adminPage, /canReturnToInheritance/);
});

test("Consent Admin accepts the effective configuration from Organization or Shop and rejects Group", () => {
  for (const sourceScopeType of ["ORGANIZATION", "SHOP"]) {
    const parsed = consentAdmin.parseConsentConfigurationState(inheritedState(sourceScopeType));
    assert.equal(parsed.effective.status, "AVAILABLE");
    assert.equal(parsed.effective.source?.scopeType, sourceScopeType);
    assert.equal(parsed.effective.source?.configurationId, `${sourceScopeType.toLowerCase()}-configuration`);
    assert.equal(parsed.effective.published?.policy.services[0].serviceKey, "core");
    assert.equal(parsed.published?.scopeType ?? null, sourceScopeType === "SHOP" ? "SHOP" : null);
  }
  assert.throws(() => consentAdmin.parseConsentConfigurationState(inheritedState("SHOP_GROUP")), /effective\.source/);
});

test("Consent Admin rejects an incomplete effective response instead of guessing an inherited configuration", () => {
  const incomplete = inheritedState("ORGANIZATION");
  incomplete.effective.source = null;
  assert.throws(() => consentAdmin.parseConsentConfigurationState(incomplete), /effective\.source/);
});

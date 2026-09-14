import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function loadConsentModule() {
  const source = readFileSync(
    new URL("../src/modules/storefront/storefront-consent.ts", import.meta.url),
    "utf8",
  );
  const integrationPolicySource = readFileSync(
    new URL("../src/modules/storefront/storefront-consent-integration-policy.ts", import.meta.url),
    "utf8",
  );
  const integrationPolicyOutput = ts.transpileModule(integrationPolicySource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const integrationPolicyExports = {};
  const integrationPolicyContext = { exports: integrationPolicyExports, module: { exports: integrationPolicyExports }, URL };
  vm.runInNewContext(integrationPolicyOutput, integrationPolicyContext);
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const context = {
    exports,
    module: { exports },
    require: (request) => request === "./storefront-consent-integration-policy" ? integrationPolicyContext.module.exports : {},
  };
  vm.runInNewContext(output, context);
  return context.module.exports;
}

const consent = loadConsentModule();

const runtimeSource = readFileSync(
  new URL("../src/modules/storefront/storefront-consent-runtime.tsx", import.meta.url),
  "utf8",
);

test("Consent runtime parses only the effective localized snapshot", () => {
  const parsed = consent.parseStorefrontConsentPolicyResponse({
    status: "AVAILABLE",
    snapshotFingerprint: "sha256:current",
    effectiveLocale: "es-ES",
    localeFallback: false,
    renewalRequired: true,
    snapshot: {
      configurationVersionId: "version-1",
      version: 1,
      policy: {
        firstLayerRejectAction: true,
        purposes: [
          {
            purposeKey: "necessary",
            necessary: true,
            content: { title: "Necesarias", description: "Funcionamiento" },
          },
          {
            purposeKey: "analytics",
            necessary: false,
            content: { title: "Analítica", description: "Medición" },
          },
        ],
        services: [
          { serviceKey: "core", purposeKeys: ["necessary"] },
          {
            serviceKey: "analytics",
            purposeKeys: ["analytics"],
            integration: {
              providerKey: "google-analytics",
              contractVersion: 1,
              enabled: true,
              publicConfig: { measurementId: "G-ABCDE123" },
            },
          },
        ],
      },
    },
    decision: null,
  });

  assert.equal(parsed.status, "AVAILABLE");
  assert.equal(parsed.policy.effectiveLocale, "es-ES");
  assert.equal(parsed.renewalRequired, true);
  assert.equal(parsed.policy.firstLayerRejectAction, true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(parsed.policy.services.find((service) => service.serviceKey === "analytics")?.integration)),
    { providerKey: "google-analytics", contractVersion: 1, enabled: true, publicConfig: { measurementId: "G-ABCDE123" } },
  );
  assert.deepEqual(
    [...consent.consentAllowedServiceKeys(parsed.policy, parsed.decision)],
    ["core"],
  );
});

test("Consent runtime fails closed for absent, malformed, or not configured policies", () => {
  assert.equal(consent.parseStorefrontConsentPolicyResponse({ status: "NOT_CONFIGURED" }).policy, null);
  assert.equal(consent.parseStorefrontConsentPolicyResponse({ status: "AVAILABLE" }), null);
  assert.equal(
    consent.consentAllowedServiceKeys(
      {
        configurationVersionId: "version-1",
        configurationVersion: 1,
        snapshotFingerprint: "sha256:current",
        effectiveLocale: "es-ES",
        localeFallback: false,
        firstLayerRejectAction: false,
        purposes: [{ purposeKey: "analytics", necessary: false, title: "Analítica", description: "Medición" }],
        services: [{ serviceKey: "analytics", purposeKeys: ["analytics"] }],
      },
      null,
    ).size,
    0,
  );
});

test("Consent runtime accepts only the localized BFF snapshot and keeps optional services denied until a receipt grants them", () => {
  const parsed = consent.parseStorefrontConsentPolicyResponse({
    status: "AVAILABLE",
    snapshotFingerprint: "sha256:v2",
    effectiveLocale: "es-ES",
    localeFallback: false,
    renewalRequired: true,
    snapshot: {
      configurationVersionId: "version-2",
      version: 2,
      policy: {
        firstLayerRejectAction: true,
        purposes: [{
          purposeKey: "analytics",
          necessary: false,
          content: { "es-ES": { title: "Analítica", description: "Medición opcional" } },
        }, {
          purposeKey: "necessary",
          necessary: true,
          content: { "es-ES": { title: "Necesarias", description: "Funcionamiento" } },
        }],
        services: [{ serviceKey: "analytics", purposeKeys: ["analytics"] }, { serviceKey: "core", purposeKeys: ["necessary"] }],
      },
    },
    decision: { action: "SAVE_PREFERENCES", selections: [{ purposeKey: "analytics", status: "GRANTED" }] },
  });

  assert.deepEqual([...consent.consentAllowedServiceKeys(parsed.policy, null)], ["core"]);
  assert.deepEqual([...consent.consentAllowedServiceKeys(parsed.policy, parsed.decision)].sort(), ["analytics", "core"]);
  assert.equal(consent.parseStorefrontConsentDecision({ action: "UNKNOWN", selections: [] }), null);
  const withdrawn = consent.parseStorefrontConsentDecision({
    action: "WITHDRAW_ALL",
    selections: [{ purposeKey: "analytics", status: "DENIED" }],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(withdrawn)), {
    action: "WITHDRAW_ALL",
    selections: [{ purposeKey: "analytics", status: "DENIED" }],
  });
});

test("Consent runtime uses only the Storefront BFF contract and keeps reads and writes private", () => {
  assert.match(runtimeSource, /\/api\/v1\/storefront\/consent\/policy/);
  assert.match(runtimeSource, /\/api\/v1\/storefront\/consent\/decisions/);
  assert.match(runtimeSource, /configurationVersionId: policy\.configurationVersionId/);
  assert.match(runtimeSource, /snapshotFingerprint: policy\.snapshotFingerprint/);
  assert.match(runtimeSource, /idempotencyKey: crypto\.randomUUID\(\)/);
  assert.match(runtimeSource, /credentials: "include"/);
  assert.match(runtimeSource, /cache: "no-store"/);
  assert.doesNotMatch(runtimeSource, /localStorage|sessionStorage|services\/consent|CONSENT_INTERNAL_TOKEN/);
});

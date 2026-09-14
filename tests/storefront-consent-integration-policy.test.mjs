import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(
  new URL("../src/modules/storefront/storefront-consent-integration-policy.ts", import.meta.url),
  "utf8",
);

function loadIntegrationPolicyModule() {
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const context = { exports, module: { exports }, URL };
  vm.runInNewContext(output, context);
  return context.module.exports;
}

const policy = loadIntegrationPolicyModule();

test("only reviewed provider v1 bindings are recognized", () => {
  const valid = {
    providerKey: "google-analytics",
    contractVersion: 1,
    enabled: true,
    publicConfig: { measurementId: "G-ABCDE123" },
  };
  assert.deepEqual(JSON.parse(JSON.stringify(policy.parsePublishedConsentIntegration(valid))), valid);
  assert.equal(policy.parsePublishedConsentIntegration({ ...valid, providerKey: "other" }), undefined);
  assert.equal(policy.parsePublishedConsentIntegration({ ...valid, contractVersion: 2 }), undefined);
  assert.equal(policy.parsePublishedConsentIntegration({ ...valid, publicConfig: { measurementId: "G-ABCDE123", script: "https://example.test" } }), undefined);

  const metaPixel = {
    providerKey: "meta-pixel",
    contractVersion: 1,
    enabled: true,
    publicConfig: { pixelId: "123456789012345" },
  };
  assert.deepEqual(JSON.parse(JSON.stringify(policy.parsePublishedConsentIntegration(metaPixel))), metaPixel);
  assert.equal(policy.parsePublishedConsentIntegration({ ...metaPixel, publicConfig: { pixelId: "not-a-pixel-id" } }), undefined);
  assert.equal(policy.parsePublishedConsentIntegration({ ...metaPixel, publicConfig: { pixelId: "123456789012345", event: "Purchase" } }), undefined);

  const matomo = { providerKey: "matomo-cloud", contractVersion: 1, enabled: true, publicConfig: { cloudHost: "tienda.matomo.cloud", siteId: "7" } };
  assert.deepEqual(JSON.parse(JSON.stringify(policy.parsePublishedConsentIntegration(matomo))), matomo);
  assert.equal(policy.parsePublishedConsentIntegration({ ...matomo, publicConfig: { ...matomo.publicConfig, cloudHost: "example.test" } }), undefined);
  const clarity = { providerKey: "microsoft-clarity", contractVersion: 1, enabled: true, publicConfig: { projectId: "abc123" } };
  assert.deepEqual(JSON.parse(JSON.stringify(policy.parsePublishedConsentIntegration(clarity))), clarity);
  assert.equal(policy.parsePublishedConsentIntegration({ ...clarity, publicConfig: { projectId: "abc!23" } }), undefined);
});

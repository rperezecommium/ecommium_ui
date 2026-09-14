import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(
  new URL("../src/modules/storefront/storefront-consent-gates.tsx", import.meta.url),
  "utf8",
);
const turnstile = readFileSync(
  new URL("../src/modules/storefront/storefront-turnstile-widget.tsx", import.meta.url),
  "utf8",
);
const gatePolicySource = readFileSync(
  new URL("../src/modules/storefront/storefront-consent-integration-policy.ts", import.meta.url),
  "utf8",
);

function loadGatePolicyModule() {
  const output = ts.transpileModule(gatePolicySource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const context = { exports, module: { exports }, URL };
  vm.runInNewContext(output, context);
  return context.module.exports;
}

const gatePolicy = loadGatePolicyModule();

test("Consent gates deny by default and keep provider execution in reviewed UI code", () => {
  assert.match(source, /useStorefrontConsentService\(serviceKey\)/);
  assert.match(source, /return allowed \? <>\{children\}<\/> : <>\{fallback\}<\/>/);
  assert.match(source, /StorefrontConsentScriptGate/);
  assert.match(source, /StorefrontConsentEmbedGate/);
  assert.match(source, /StorefrontConsentIntegrationRegistry/);
  assert.match(source, /if \(!allowed\) return undefined;/);
  assert.ok(source.indexOf("if (!allowed) return undefined;") < source.indexOf("document.createElement"));
  assert.doesNotMatch(source, /eval\(|dangerouslySetInnerHTML/);
});

test("Consent gate source policy permits only reviewed provider loaders", () => {
  assert.equal(gatePolicy.safeConsentScriptSource("https://www.googletagmanager.com/gtag/js?id=G-ABCDE123", "https://shop.example.test"), "https://www.googletagmanager.com/gtag/js?id=G-ABCDE123");
  assert.equal(gatePolicy.safeConsentScriptSource("/adapter.js", "https://shop.example.test"), null);
  assert.equal(gatePolicy.safeConsentScriptSource("https://provider.example.test/adapter.js", "https://shop.example.test"), null);
  assert.equal(gatePolicy.safeConsentScriptSource("http://www.googletagmanager.com/gtag/js?id=G-ABCDE123", "https://shop.example.test"), null);
  assert.equal(gatePolicy.safeConsentScriptSource("javascript:alert(1)", "https://shop.example.test"), null);
  assert.equal(gatePolicy.safeConsentScriptSource("https://www.googletagmanager.com/gtag/js?id=invalid", "https://shop.example.test"), null);
  assert.equal(gatePolicy.safeConsentScriptSource("https://connect.facebook.net/en_US/fbevents.js", "https://shop.example.test"), "https://connect.facebook.net/en_US/fbevents.js");
  assert.equal(gatePolicy.safeConsentScriptSource("https://connect.facebook.net/es_ES/fbevents.js", "https://shop.example.test"), null);
  assert.equal(gatePolicy.safeConsentScriptSource("https://connect.facebook.net/en_US/fbevents.js?pixelId=123456789012345", "https://shop.example.test"), null);
  assert.equal(gatePolicy.safeConsentScriptSource("https://tienda.matomo.cloud/matomo.js", "https://shop.example.test"), "https://tienda.matomo.cloud/matomo.js");
  assert.equal(gatePolicy.safeConsentScriptSource("https://example.test/matomo.js", "https://shop.example.test"), null);
  assert.equal(gatePolicy.safeConsentScriptSource("https://www.clarity.ms/tag/abc123", "https://shop.example.test"), "https://www.clarity.ms/tag/abc123");
  assert.equal(gatePolicy.safeConsentScriptSource("https://www.clarity.ms/tag/abc123?x=1", "https://shop.example.test"), null);
});

test("Turnstile removes its technology and token when consent is withdrawn", () => {
  assert.match(turnstile, /unloadTurnstileScript\(\)/);
  assert.match(turnstile, /onVerificationChange\?\.\(false\)/);
  assert.match(turnstile, /setVerification\(\{[\s\S]*?token: ""/);
  assert.match(turnstile, /if \(!consented\)/);
});

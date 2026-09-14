import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/modules/storefront/storefront-consent-proxy.ts", import.meta.url),
  "utf8",
);

test("Consent same-origin proxy remains a constrained Storefront BFF transport", () => {
  assert.match(source, /getStorefrontBffBaseUrl/);
  assert.match(source, /\/storefront\/consent\/\$\{path\}/);
  assert.match(source, /validateSameOriginMutation\(request\)/);
  assert.match(source, /getStorefrontContext\(\)/);
  assert.match(source, /ec_consent_subject/);
  assert.match(source, /attribute\.startsWith\("domain="\)/);
  assert.match(source, /process\.env\.NODE_ENV !== "production" \|\| normalized\.includes\("secure"\)/);
  assert.doesNotMatch(source, /services\/consent|CONSENT_INTERNAL_TOKEN|localStorage|sessionStorage/);
});

test("Consent proxy accepts only the published decision shape and no arbitrary forwarding", () => {
  assert.match(source, /const decisionKeys = new Set/);
  assert.match(source, /Object\.keys\(value\)\.some\(\(key\) => !decisionKeys\.has\(key\)\)/);
  assert.match(source, /value\.selections\.length > 64/);
  assert.match(source, /AbortSignal\.timeout\(15_000\)/);
  assert.match(source, /Cache-Control": cacheControl/);
});

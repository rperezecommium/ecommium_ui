import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/modules/storefront/storefront-consent-banner.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("Consent preference center is an accessible modal and never treats close as consent", () => {
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /returnFocusRef\.current\.focus\(\)/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
});

test("Consent first layer obeys the published reject action and keeps necessary purposes locked", () => {
  assert.match(source, /firstLayerRejectAction \|\| preferencesOpen/);
  assert.match(source, /disabled=\{purpose\.necessary \|\| isSaving\}/);
  assert.match(source, /purpose\.necessary \? copy\.necessary/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(source, /persist\("WITHDRAW_ALL"\)/);
  assert.match(source, /copy\.withdraw/);
});

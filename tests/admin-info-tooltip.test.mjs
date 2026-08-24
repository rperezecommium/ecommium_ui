import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);

test("admin informative tooltips use the shared accessible component for the Pricing pilots", () => {
  const component = readFileSync(path.resolve(root, "src/shared/ui/admin-info-tooltip.tsx"), "utf8");
  const pricingPage = readFileSync(path.resolve(root, "src/modules/catalogo/pricing-admin-page.tsx"), "utf8");
  const guide = readFileSync(path.resolve(root, "docs/admin-informative-tooltips.md"), "utf8");

  assert.match(component, /"use client"/);
  assert.match(component, /role="tooltip"/);
  assert.match(component, /event\.key === "Escape"/);
  assert.match(component, /pointerdown/);
  assert.match(component, /createPortal/);
  assert.match(component, /aria-describedby/);
  assert.match(component, /title\?: string/);
  assert.match(component, /title \? <strong>\{title\}<\/strong> : null/);
  assert.match(pricingPage, /AdminInfoTooltip/);
  assert.match(pricingPage, /Más información sobre precios fijados/);
  assert.match(pricingPage, /Más información sobre el pipeline de precios/);
  assert.match(pricingPage, /pricingTabTooltips/);
  assert.match(guide, /src\/shared\/ui\/admin-info-tooltip\.tsx/);
  assert.match(guide, /No crear tooltips ad hoc/);
});

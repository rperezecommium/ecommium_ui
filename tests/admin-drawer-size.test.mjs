import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { loadTs } from "./helpers/load-ts.mjs";

const { availableDrawerWidth, clampDrawerRatio, draggedDrawerRatio, keyboardDrawerRatio } = loadTs("src/shared/ui/admin-drawer-size.ts");

test("drawer limits use the visible navigation edge and remain bounded", () => {
  assert.equal(availableDrawerWidth(1440, 248), 1192);
  assert.equal(availableDrawerWidth(1440, 0), 1440);
  assert.equal(availableDrawerWidth(390, 248), 142);
  assert.equal(availableDrawerWidth(390, 500), 1);
  for (const ratio of [-100, 0, 0.1, 0.2]) assert.equal(clampDrawerRatio(ratio), 0.2);
  for (const ratio of [0.5, 0.6, 100]) assert.equal(clampDrawerRatio(ratio), 0.5);
  assert.equal(clampDrawerRatio(NaN), 0.4);
});

test("dragging left grows a right-anchored drawer, clamps overshoot and preserves fractions", () => {
  assert.equal(draggedDrawerRatio(400, 600, 500, 1000), 0.5);
  assert.equal(draggedDrawerRatio(400, 600, 700, 1000), 0.3);
  assert.equal(draggedDrawerRatio(400, 600, -2000, 1000), 0.5);
  assert.equal(draggedDrawerRatio(400, 600, 2000, 1000), 0.2);
  assert.equal(draggedDrawerRatio(400.5, 600.5, 600, 1000), 0.401);
});

test("keyboard controls follow drag direction and expose exact minimum/maximum", () => {
  assert.equal(keyboardDrawerRatio(0.4, "Home", false), 0.2);
  assert.equal(keyboardDrawerRatio(0.4, "End", false), 0.5);
  assert.ok(Math.abs(keyboardDrawerRatio(0.4, "ArrowLeft", false) - 0.41) < 1e-9);
  assert.ok(Math.abs(keyboardDrawerRatio(0.4, "ArrowRight", true) - 0.35) < 1e-9);
  assert.equal(keyboardDrawerRatio(0.5, "ArrowLeft", true), 0.5);
  assert.equal(keyboardDrawerRatio(0.2, "ArrowRight", false), 0.2);
  assert.equal(keyboardDrawerRatio(0.4, "Tab", false), null);
});

test("all Admin lateral declarations use the shared resize primitive with a stable module identity", () => {
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : entry.name.endsWith(".tsx") ? [path.join(dir, entry.name)] : []);
  let panels = 0;
  const seen = new Set();
  for (const file of [...walk("src/modules").filter(file => !file.includes("/storefront/")), "src/shared/ui/admin-resource-drawer.tsx"]) {
    const source = fs.readFileSync(file, "utf8");
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isJsxOpeningElement(node)) {
        const tag = node.tagName.getText(ast);
        const attrs = node.attributes.getText(ast);
        assert.ok(!(tag === "aside" && /adminSideDrawer|productOfferingDrawer|productSpecificationDrawer|productPreviewDrawer/.test(attrs)), `${file}: raw lateral panel bypasses the standard`);
        if (["AdminResizableDrawer", "AdminResourceDrawer", "SeoDrawer", "ShippingDrawer"].includes(tag)) {
          const id = node.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText(ast) === "drawerId");
          assert.ok(id?.initializer, `${file}: missing drawerId`);
          if (ts.isStringLiteral(id.initializer)) {
            assert.ok(!seen.has(id.initializer.text), `Duplicate drawer identity: ${id.initializer.text}`);
            seen.add(id.initializer.text);
          }
          panels++;
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  assert.ok(panels >= 50, "Inventory must cover existing shared and custom Admin laterals");
});

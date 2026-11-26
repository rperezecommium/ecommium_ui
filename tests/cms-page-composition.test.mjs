import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    structuredClone,
    TextEncoder,
    Map,
    Set,
    JSON,
    crypto: globalThis.crypto,
    require: (spec) => load(path.resolve(path.dirname(file), spec + ".ts")),
  });
  return exports;
}
const {
  assertPageBudget,
  pageCompositionMatches,
  pageCompositionWithoutHydration,
} = load(path.resolve("src/modules/cms/cms-page-composition.ts"));
const { remapSection } = load(
  path.resolve("src/modules/cms/cms-section-tree.ts"),
);
const sample = () => ({
  compositionSchemaVersion: 1,
  sections: [
    {
      sectionId: "section",
      name: "Section",
      root: {
        nodeId: "slot",
        kind: "module",
        module: {
          instanceId: "piece",
          name: "Products",
          body: { kind: "registered", type: "commerce.productGrid", props: {} },
        },
      },
    },
  ],
  styleSheet: { base: [{ selector: "#section", styles: { padding: "8px" } }] },
});
test("page copy comparison permits only remapped identities and CSS targets", () => {
  const original = sample(),
    copy = structuredClone(original);
  copy.sections = original.sections.map((section) => remapSection(section));
  copy.styleSheet.base[0].selector = "#" + copy.sections[0].sectionId;
  assert.equal(pageCompositionMatches(original, copy, true), true);
  assert.equal(pageCompositionMatches(original, copy), false);
  copy.sections[0].name = "Changed";
  assert.equal(pageCompositionMatches(original, copy, true), false);
  assert.equal(original.sections[0].sectionId, "section");
});
test("page budgets apply across all inserted sections", () => {
  const doc = sample();
  assert.doesNotThrow(() => assertPageBudget(doc));
  doc.sections.push(structuredClone(doc.sections[0]));
  assert.throws(() => assertPageBudget(doc), /identidades/);
  doc.sections = Array.from({ length: 25 }, () =>
    remapSection(sample().sections[0]),
  );
  assert.throws(() => assertPageBudget(doc), /Composición/);
  const large = sample();
  large.sections[0].name = "é".repeat(524288);
  assert.throws(() => assertPageBudget(large), /1 MiB/);
  const plp = sample();
  plp.sections[0].root.module.body.type = "plp.productGrid";
  assert.throws(() => assertPageBudget(plp), /PLP/);
});
test("public validation strips only transient commerce hydration without modifying response", () => {
  const doc = sample(),
    props = doc.sections[0].root.module.body.props;
  props.hydratedProducts = [{ price: 99 }];
  props.hydration = { status: "ready" };
  props.limit = 4;
  const clean = pageCompositionWithoutHydration(doc);
  assert.deepEqual(clean.sections[0].root.module.body.props, { limit: 4 });
  assert.equal(props.hydratedProducts[0].price, 99);
  const other = sample();
  other.sections[0].root.module.body.type = "accordion";
  other.sections[0].root.module.body.props.hydration = "invalid";
  assert.equal(
    pageCompositionWithoutHydration(other).sections[0].root.module.body.props
      .hydration,
    "invalid",
  );
});

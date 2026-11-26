import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
import path from "node:path";
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    structuredClone,
    Map,
    Set,
    JSON,
    crypto: globalThis.crypto,
    require: (spec) => load(path.resolve(path.dirname(file), spec + ".ts")),
  });
  cache.set(file, exports);
  return exports;
}
const tree = load(path.resolve("src/modules/cms/cms-section-tree.ts"));
const sample = () => ({
  sectionId: "s",
  name: "Section",
  root: {
    nodeId: "root",
    kind: "container",
    layout: "grid",
    presentation: {},
    children: [
      {
        nodeId: "child",
        kind: "container",
        layout: "stack",
        presentation: {},
        children: [],
      },
      {
        nodeId: "slot",
        kind: "module",
        module: {
          instanceId: "i",
          name: "FAQ",
          body: {
            kind: "registered",
            type: "accordion",
            props: { heading: "FAQ", items: [] },
          },
        },
      },
    ],
  },
  styleSheet: { base: [{ selector: "#child", styles: { padding: "13px" } }] },
});
test("move preserves source and identities, refuses ancestor cycles", () => {
  const doc = sample();
  const moved = tree.moveSpace(doc, "slot", "child", 0);
  assert.equal(doc.root.children.length, 2);
  assert.equal(moved.root.children.length, 1);
  assert.equal(moved.root.children[0].children[0].nodeId, "slot");
  assert.throws(() => tree.moveSpace(moved, "child", "child", 0));
  assert.throws(() => tree.moveSpace(doc, "root", "child", 0));
});
test("owner materialization matches only declared identity changes", () => {
  const backend = path.resolve("../ecommium/composable_ecommerce/services/cms"),
    req = createRequire(path.join(backend, "package.json"));
  req("ts-node").register({
    compiler: req.resolve("typescript"),
    transpileOnly: true,
    skipProject: true,
    compilerOptions: {
      module: "CommonJS",
      target: "ES2021",
      esModuleInterop: true,
      resolveJsonModule: true,
    },
  });
  const { materializeSection, sectionDocument } = req(
    "./src/domain/page/independent-section.value-object.ts",
  );
  const original = sample(),
    copy = materializeSection(sectionDocument(original));
  assert.equal(tree.sectionReceiptMatches(original, copy), true);
  copy.root.children[1].module.body.props.heading = "Changed";
  assert.equal(tree.sectionReceiptMatches(original, copy), false);
});
test("UI insertion generates independent module identities and remaps section CSS", () => {
  const original = sample();
  const copy = tree.remapSection(original);
  assert.notEqual(copy.sectionId, original.sectionId);
  assert.notEqual(copy.root.children[1].module.instanceId, "i");
  assert.equal(
    copy.styleSheet.base[0].selector,
    "#" + copy.root.children[0].nodeId,
  );
  assert.equal(tree.sectionReceiptMatches(original, copy), true);
});

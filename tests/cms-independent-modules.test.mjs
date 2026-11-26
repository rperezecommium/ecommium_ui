import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
const ui = process.cwd(),
  backend = path.resolve(ui, "../ecommium/composable_ecommerce");
const ownerRequire = createRequire(
  path.join(backend, "services/cms/package.json"),
);
ownerRequire("ts-node").register({
  compiler: ownerRequire.resolve("typescript"),
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
    target: "ES2021",
    esModuleInterop: true,
    resolveJsonModule: true,
  },
});
const { materializeModule } = ownerRequire(
  "./src/domain/page/independent-module-copy.ts",
);
const source = ts.transpileModule(
  readFileSync("src/modules/cms/cms-independent-module-comparison.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const ctx = { exports: {}, structuredClone, Map, Set, JSON };
vm.runInNewContext(source, ctx);
const { independentModuleReceiptMatches: matches } = ctx.exports;
const sample = () => ({
  instanceId: "i",
  name: "Card",
  body: {
    kind: "visual",
    value: {
      schemaVersion: 2,
      moduleId: "m",
      type: "container",
      panels: [
        {
          panelId: "p",
          elements: [
            {
              elementId: "title",
              elementType: "heading",
              props: { text: "title #title" },
            },
            {
              elementId: "link",
              elementType: "link",
              props: { text: "Link", href: "#title", ariaLabelledBy: "title" },
            },
          ],
        },
      ],
      contentSchema: {},
      assetRefs: [
        {
          assetKey: "shared",
          mediaAssetId: "media-shared",
          src: "https://example.com/image.png",
        },
      ],
    },
  },
  styleSheet: { base: [{ selector: "#title", styles: { color: "red" } }] },
});
test("UI validates owner-assigned identities without accepting changed content, Media or references", () => {
  const original = sample(),
    copy = materializeModule(original);
  assert.equal(matches(original, copy), true);
  for (const mutate of [
    (m) => (m.name = "Other"),
    (m) => (m.body.value.panels[0].elements[0].props.text = "Changed"),
    (m) => (m.body.value.assetRefs[0].mediaAssetId = "different"),
    (m) => (m.body.value.panels[0].elements[1].props.href = "#foreign"),
    (m) => (m.styleSheet.base[0].styles.color = "blue"),
  ]) {
    const altered = structuredClone(copy);
    mutate(altered);
    assert.equal(matches(original, altered), false);
  }
  assert.deepEqual(original, sample());
});
test("schema snapshots agree across UI, CMS and BFF", () => {
  const schema = JSON.parse(
    readFileSync("docs/contracts/cms-composition-boundary.schema.json"),
  );
  for (const location of [
    "services/cms/src/domain/page/independent-module.schema.json",
    "apps/bff/src/modules/cms/application/validators/independent-module.schema.json",
  ])
    assert.deepEqual(
      JSON.parse(readFileSync(path.join(backend, location))),
      schema,
    );
});

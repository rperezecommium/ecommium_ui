import * as lucideIcons from "lucide-react";
import sanitizeHtml from "sanitize-html";
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsx from "react/jsx-runtime";
function load(path, dependencies = {}, globals = {}) {
  const code = ts.transpileModule(
    readFileSync(new URL("../" + path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    },
  ).outputText;
  const exports = {};
  const ctx = {
    exports,
    module: { exports },
    URL,
    URLSearchParams,
    Set,
    Map,
    Math,
    JSON,
    ...globals,
    require: (k) => {
      if (k === "react") return React;
      if (k === "react/jsx-runtime") return jsx;
      if (k in dependencies) return dependencies[k];
      throw new Error("Unexpected dependency: " + k);
    },
  };
  vm.runInNewContext(code, ctx);
  return ctx.module.exports;
}

const registry = load("packages/cms-blocks/src/index.ts");
const renderer = load("packages/cms-blocks/src/react.tsx", {
  "./index": registry,
  "./icons": load("packages/cms-blocks/src/icons.ts", {"lucide-react": lucideIcons}),
  "./rich-text": load("packages/cms-blocks/src/rich-text.ts", {"sanitize-html": sanitizeHtml}),
  "./newsletter-form": { CmsNewsletterForm: () => null },
});
function render(props) {
  return renderToStaticMarkup(React.createElement(renderer.CmsBlockRenderer, { block: { blockId: "intro", type: "plp.categoryIntro", props }, mode: "storefront" }));
}
test("category banner escapes content, bounds styles and rejects unsafe image URLs", () => {
  const html = render({ backgroundMode: true, heading: "<script>alert(1)</script>", headingLevel: 1, imageUrl: "javascript:alert(1)", height: 9999, overlayOpacity: 999, textColor: "red;position:fixed", backgroundPosition: "url(evil)" });
  assert.match(html, /<h1>&lt;script&gt;/);
  assert.match(html, /min-height:600px/);
  assert.match(html, /color:#ffffff/);
  assert.doesNotMatch(html, /background-image|position:fixed|javascript:/);
  for (const url of ["//evil.example/image.png", "data:image/svg+xml,test", "http://127.0.0.1/image.png", "/\\evil.example/a"]) assert.doesNotMatch(render({ backgroundMode: true, imageUrl: url }), /background-image/);
  const safe = render({ backgroundMode: true, heading: "Ciclismo", imageUrl: "/assets/cms/home-categories/bicicletas.webp", overlayOpacity: 999 });
  assert.match(safe, /background-image:linear-gradient/);
  assert.match(safe, /0.9/);
});
test("legacy category intro remains compatible and background preset exposes structured controls", () => {
  assert.match(render({ heading: "Categoria" }), /storefrontCmsIntro/);
  const preset = registry.createCmsBlockFromPreset("plp.categoryIntro");
  assert.equal(preset.props.backgroundMode, true);
  const fields = registry.getCmsBlockDefinition("plp.categoryIntro").editorFields.map(f => f.key);
  for (const field of ["target", "imageUrl", "heading", "body", "height", "overlayOpacity", "textColor", "backgroundPosition"]) assert.ok(fields.includes(field));
});

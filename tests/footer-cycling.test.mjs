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

const icon = (props) => React.createElement("svg", props);
const link = ({ children, ...props }) =>
  React.createElement("a", props, children);
const image = ({ priority, ...props }) =>
  React.createElement("img", { ...props, "data-priority": String(priority) });
const system = load("src/modules/cms/cms-system-block-view.tsx", {
  "next/link": link,
  "next/image": image,
  "lucide-react": {
    ChevronDown: icon,
    CircleHelp: icon,
    RotateCcw: icon,
    Star: icon,
  },
});
const renderer = load("src/modules/storefront/storefront-site-part.tsx", {
  "../cms/cms-system-block-view": system,
  "../../../packages/cms-blocks/src": {},
  "./newsletter-client": { NewsletterProvider: ({ children }) => children },
  "../../../packages/cms-blocks/src/react": { CmsPresentationView: ({ children }) => children, CmsBlockRenderer: () => null },
  "./storefront-auth-drawer": { StorefrontAuthEntry: () => null },
  "./cart-client": { StorefrontCartStatus: () => null },
});
const place = (col) => ({
  region: "footer",
  areaId: "main",
  columnIndex: col,
  order: col,
});
const part = {
  sitePartId: "footer",
  kind: "FOOTER",
  revision: {
    revisionId: "r3",
    revision: 3,
    layout: {
      regions: {
        footer: {
          areas: [
            {
              areaId: "main",
              containerMode: "container",
              columns: ["28%", "18%", "18%", "18%", "18%"],
            },
          ],
        },
      },
    },
    blocks: [
      {
        blockId: "logo",
        type: "store.logo",
        placement: place(1),
        props: {
          imageUrl: "/assets/brand/ecommium-logo.png",
          imageAlt: "Ecommium",
          href: "/home",
        },
      },
      {
        blockId: "nav",
        type: "footer.navigation",
        placement: place(2),
        props: {
          title: "Ciclismo <script>",
          items: [
            { label: "Componentes", href: "/search" },
            { label: "Unsafe", href: "//attacker.test" },
          ],
        },
      },
      {
        blockId: "social",
        type: "footer.social",
        placement: place(3),
        props: {
          items: [
            { label: "Instagram", href: "https://www.instagram.com/" },
            { label: "Facebook", href: "https://www.facebook.com/" },
            { label: "YouTube", href: "https://www.youtube.com/" },
            { label: "X", href: "https://x.com/" },
            { label: "Injected", href: "javascript:alert(1)" },
          ],
        },
      },
    ],
  },
};
test("Footer preserves five gap-aware columns, editable titles and safe navigation", () => {
  const html = renderToStaticMarkup(
    React.createElement(renderer.StorefrontSitePartView, { part }),
  );
  assert.equal(
    (html.match(/class="storefrontSitePartColumn"/g) || []).length,
    5,
  );
  assert.match(html, /minmax\(0, 28fr\)/);
  assert.match(html, /Ciclismo &lt;script&gt;/);
  assert.ok(!html.includes("//attacker.test"));
  assert.match(html, /alt="Ecommium"/);
  assert.match(html, /data-priority="false"/);
});
test("Social strip exposes four named SVG icons and safe external links", () => {
  const html = renderToStaticMarkup(
    React.createElement(renderer.StorefrontSitePartView, { part }),
  );
  for (const name of ["Instagram", "Facebook", "YouTube", "X"])
    assert.ok(html.includes('aria-label="' + name + '"'));
  assert.equal((html.match(/<svg/g) || []).length, 4);
  assert.match(html, /noopener noreferrer/);
  assert.ok(!html.includes("javascript:"));
  assert.ok(!html.includes("Injected"));
});

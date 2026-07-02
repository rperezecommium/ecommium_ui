import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(new URL("..", import.meta.url).pathname);

function loadTsModule(relativePath, extraRequire = () => ({})) {
  const source = readFileSync(path.resolve(root, relativePath), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const commonJsExports = {};
  const moduleContext = {
    URLSearchParams,
    JSON,
    Date,
    Math,
    encodeURIComponent,
    exports: commonJsExports,
    module: { exports: commonJsExports },
    require(specifier) {
      return extraRequire(specifier);
    },
  };

  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
}

function loadCmsBlocksModule() {
  return loadTsModule("src/modules/cms/cms-blocks.ts");
}

function loadCmsAdminModule(requestBff) {
  return loadTsModule("src/modules/cms/cms-admin.ts", (specifier) => {
    if (specifier.endsWith("/shared/bff/client")) {
      return { requestBff };
    }
    if (specifier === "./cms-blocks") {
      return loadCmsBlocksModule();
    }
    return {};
  });
}

const context = {
  organizationId: "org-1",
  shopId: "shop-1",
  shopAlias: "shop",
  shopName: "Shop",
  primaryDomain: "shop.test",
  shopStatus: "ACTIVE",
  locale: "es-ES",
  currency: "EUR",
  country: "ES",
  channel: "web",
};

test("cms navigation is exposed as its own admin menu", () => {
  const shellSource = readFileSync(path.resolve(root, "src/app-shell/admin-shell.tsx"), "utf8");
  const permissionsSource = readFileSync(path.resolve(root, "src/shared/permissions/permissions.ts"), "utf8");
  const pageSource = readFileSync(path.resolve(root, "app/(admin)/admin/cms/page.tsx"), "utf8");

  assert.match(shellSource, /href: "\/admin\/cms"/);
  assert.match(shellSource, /label: "CMS"/);
  assert.match(permissionsSource, /"admin:cms:view"/);
  assert.match(permissionsSource, /cms\.pages\.read/);
  assert.match(pageSource, /getCmsAdminData/);
});

test("cms admin data uses scoped BFF endpoints and maps permissions", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({
      path: pathValue,
      method: options.init?.method ?? "GET",
    });

    if (pathValue.startsWith("/admin/cms/pages/page-1?")) {
      return { ok: false, status: 403, error: "Forbidden", correlationId: "corr-1" };
    }

    const raw = {
      total: 1,
      limit: 50,
      offset: 0,
      items: [{
        pageId: "page-1",
        organizationId: "org-1",
        shopId: "shop-1",
        locale: "es-ES",
        pageType: "LANDING",
        title: "Landing CMS",
        path: "/landing",
        status: "DRAFT",
        routeId: null,
        createdAt: "2026-07-02T00:00:00.000Z",
        updatedAt: "2026-07-02T00:00:00.000Z",
        publishedAt: null,
      }],
    };

    return {
      ok: true,
      data: options.parse ? options.parse(raw) : raw,
      correlationId: "corr-list",
    };
  };
  const { getCmsAdminData } = loadCmsAdminModule(requestBff);

  const data = await getCmsAdminData(context, {
    status: "DRAFT",
    pageType: "LANDING",
    pageId: "page-1",
  });

  assert.ok(calls.some((call) =>
    call.path === "/admin/cms/pages?organizationId=org-1&shopId=shop-1&locale=es-ES&status=DRAFT&pageType=LANDING&limit=50&offset=0"
  ));
  assert.ok(calls.some((call) =>
    call.path === "/admin/cms/pages/page-1?organizationId=org-1&shopId=shop-1&locale=es-ES"
  ));
  assert.equal(data.pages.source, "bff");
  assert.equal(data.selectedPage.source, "unavailable");
  assert.equal(data.selectedPage.permission, "cms.pages.read");
  assert.equal(data.selectedPage.correlationId, "corr-1");
});

test("cms block presets provide PLP-ready placements and JSON serialization", () => {
  const {
    blocksFromJson,
    blocksToJson,
    createCmsBlockFromPreset,
    getCmsBlockPlpTarget,
    getCmsBlockSurface,
    summarizePlacements,
    summarizePlpComposition,
  } =
    loadCmsAdminModule(async () => ({ ok: true, data: {} }));

  const blocks = [
    createCmsBlockFromPreset("banner.hero"),
    createCmsBlockFromPreset("plp.categoryIntro"),
    createCmsBlockFromPreset("plp.subcategoryTiles"),
    createCmsBlockFromPreset("carousel"),
    createCmsBlockFromPreset("accordion"),
  ];
  const parsed = blocksFromJson(blocksToJson(blocks));
  const summary = summarizePlacements(parsed);

  assert.equal(parsed[0].type, "banner.hero");
  assert.equal(parsed[1].type, "plp.categoryIntro");
  assert.equal(parsed[2].type, "plp.subcategoryTiles");
  assert.equal(parsed[3].type, "carousel");
  assert.equal(parsed[4].type, "accordion");
  assert.equal(summary.main, 1);
  assert.equal(summary.beforeList, 3);
  assert.equal(summary.afterList, 1);
  assert.equal(getCmsBlockSurface(parsed[0]), "page");
  assert.equal(getCmsBlockSurface(parsed[1]), "plp");
  const target = getCmsBlockPlpTarget(parsed[1]);
  assert.equal(target.listingKind, "CATEGORY");
  assert.equal(target.routePath, "");
  assert.equal(target.categorySlug, "");

  const plpSummary = summarizePlpComposition(parsed);
  assert.equal(plpSummary.total, 4);
  assert.equal(plpSummary.beforeList, 3);
  assert.equal(plpSummary.afterList, 1);
});

test("cms page UI documents the Routing SEO and builder strategy", () => {
  const pageSource = readFileSync(path.resolve(root, "src/modules/cms/cms-admin-page.tsx"), "utf8");
  const editorSource = readFileSync(path.resolve(root, "src/modules/cms/cms-block-editor-client.tsx"), "utf8");

  assert.match(pageSource, /Routing\/SEO/);
  assert.match(pageSource, /Antes PLP/);
  assert.match(pageSource, /Base PLP/);
  assert.match(pageSource, /Plantillas de bloques/);
  assert.match(editorSource, /Biblioteca de bloques/);
  assert.match(editorSource, /Bloques PLP/);
  assert.match(editorSource, /Ordenar por: Relevancia/);
  assert.match(editorSource, /Hummingbird printed t-shirt/);
  assert.match(editorSource, /Preview draft/);
  assert.match(editorSource, /Target PLP/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(new URL("..", import.meta.url).pathname);

function loadSearchAdminModule(requestAdminBff) {
  const source = readFileSync(path.resolve(root, "src/modules/search/search-admin.ts"), "utf8");
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
    exports: commonJsExports,
    module: { exports: commonJsExports },
    require(specifier) {
      if (specifier.endsWith("/shared/bff/admin-client")) {
        return { requestAdminBff };
      }
      if (specifier.endsWith("/shared/config/admin-context")) {
        return {
          hasRequiredAdminContext(context) {
            return Boolean(context.organizationId && context.shopId);
          },
        };
      }

      return {};
    },
  };

  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
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

test("search admin is exposed under catalog navigation with search permission alias", () => {
  const shellSource = readFileSync(path.resolve(root, "src/app-shell/admin-shell.tsx"), "utf8");
  const navigationSource = readFileSync(path.resolve(root, "src/app-shell/admin-navigation.tsx"), "utf8");
  const globalsSource = readFileSync(path.resolve(root, "app/globals.css"), "utf8");
  const permissionsSource = readFileSync(path.resolve(root, "src/shared/permissions/permissions.ts"), "utf8");
  const routeSource = readFileSync(path.resolve(root, "app/(admin)/admin/catalogo/search/page.tsx"), "utf8");
  const pageSource = readFileSync(path.resolve(root, "src/modules/search/search-admin-page.tsx"), "utf8");
  const actionsSource = readFileSync(path.resolve(root, "src/modules/search/search-admin-actions.ts"), "utf8");

  assert.match(shellSource, /href: "\/admin\/catalogo\/search"/);
  assert.match(shellSource, /label: "Busqueda"/);
  assert.match(shellSource, /permission: "admin:search:view"/);
  assert.match(navigationSource, /usePathname/);
  assert.match(navigationSource, /<details className=\{`adminNavGroup/);
  assert.match(navigationSource, /<summary className=\{`adminNavParent/);
  assert.match(navigationSource, /open=\{active && pathname !== "\/admin"\}/);
  assert.match(navigationSource, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(navigationSource, /adminNavActive/);
  assert.match(navigationSource, /const indexItem = childItems\.find\(\(child\) => child\.href === item\.href\) \?\? \{ \.\.\.item, label: "Resumen" \};/);
  assert.match(navigationSource, /const submenuItems = childItems\.filter\(\(child\) => child\.href !== item\.href\);/);
  assert.match(navigationSource, /<NavigationSubLink exact item=\{indexItem\} \/>/);
  assert.match(navigationSource, /const active = exact \? pathname === item\.href : isRouteActive\(pathname, item\.href\);/);
  assert.match(navigationSource, /<span className="adminNavLabel">\{item\.label\}<\/span>/);
  assert.match(globalsSource, /\.adminNavSubmenu \.adminNavLabel \{\s*font-size: 14px;\s*font-weight: 500;/);
  assert.match(globalsSource, /\.adminNavSubmenu a\.adminNavActive \.adminNavLabel \{\s*font-weight: 800;/);
  assert.doesNotMatch(navigationSource, /Actual/);
  assert.match(permissionsSource, /"admin:search:view"/);
  assert.match(permissionsSource, /"search\.admin\.write"/);
  assert.match(routeSource, /getSearchAdminData/);
  assert.match(routeSource, /SearchAdminPage/);
  assert.match(pageSource, /label: "Controls"/);
  assert.match(pageSource, /label: "Index"/);
  assert.match(pageSource, /label: "Feed"/);
  assert.match(pageSource, /createSearchControlAction/);
  assert.match(pageSource, /updateSearchControlAction/);
  assert.match(pageSource, /deleteSearchControlAction/);
  assert.match(pageSource, /associateSearchControlAction/);
  assert.match(pageSource, /removeSearchControlAssociationAction/);
  assert.match(pageSource, /previewSearchIndexAction/);
  assert.match(pageSource, /createSearchGcsImportJobAction/);
  assert.match(pageSource, /deleteSearchNdjsonAction/);
  assert.match(pageSource, /defaultSearchGcsUri/);
  assert.match(pageSource, /Archivo destino en GCS/);
  assert.match(pageSource, /search-products-\$\{timestamp\}\.ndjson/);
  assert.match(pageSource, /adminSideDrawer/);
  assert.match(pageSource, /searchJsonTextarea/);
  assert.match(actionsSource, /\/admin\/search\/controls/);
  assert.match(actionsSource, /\/admin\/search\/serving-configs\/\$\{encodeURIComponent\(servingConfigId\)\}\/controls/);
  assert.match(actionsSource, /\/admin\/search\/serving-configs\/\$\{encodeURIComponent\(servingConfigId\)\}\/controls\/\$\{encodeURIComponent\(controlId\)\}/);
  assert.match(actionsSource, /\/admin\/search\/index\/preview/);
  assert.match(actionsSource, /\/admin\/search\/index\/import-jobs/);
  assert.match(actionsSource, /\/admin\/search\/index\/ndjson/);
  assert.match(actionsSource, /\/admin\/search\/index\/gcs-import-jobs/);
  assert.match(actionsSource, /sourceMode/);
  assert.match(actionsSource, /catalogSource/);
  assert.match(pageSource, /productsFile/);
});

test("search admin calls scoped BFF health and query preview endpoints", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({
      path: pathValue,
      method: options.init?.method ?? "GET",
      body: options.init?.body ? JSON.parse(options.init.body) : undefined,
    });

    const raw = pathValue.startsWith("/admin/search/health?")
      ? { provider: "fake", servingConfig: "default_config" }
      : {
          provider: "fake",
          searchTotal: 1,
          attributionToken: "token-1",
          products: [{ productId: "product-1", name: "Pastillas de freno" }],
        };

    return { ok: true, data: options.parse ? options.parse(raw) : raw };
  };
  const { getSearchAdminData } = loadSearchAdminModule(requestAdminBff);

  const data = await getSearchAdminData(context, {
    preview: "1",
    query: "pastillas freno",
    pageCategory: "bike-brakes",
    limit: "8",
    currency: "EUR",
    country: "ES",
    channel: "web",
  });

  assert.equal(data.health.source, "bff");
  assert.equal(data.preview.source, "bff");
  assert.equal(data.preview.data.products[0].productId, "product-1");
  assert.ok(calls.some((call) => call.path === "/admin/search/health?organizationId=org-1&shopId=shop-1&locale=es-ES"));
  assert.ok(calls.some((call) => call.path === "/admin/search/query-preview?organizationId=org-1&shopId=shop-1&locale=es-ES" && call.method === "POST"));
  const previewCall = calls.find((call) => call.method === "POST");
  assert.equal(previewCall.body.query, "pastillas freno");
  assert.equal(previewCall.body.pageCategory, "bike-brakes");
  assert.equal(previewCall.body.visitorId, "admin-search-preview");
  assert.equal(previewCall.body.limit, 8);
  assert.equal(previewCall.body.context.organizationId, "org-1");
  assert.equal(previewCall.body.context.shopId, "shop-1");
});

test("search admin controls tab loads controls and serving configs through scoped BFF endpoints", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method ?? "GET" });

    const raw = pathValue.startsWith("/admin/search/controls?")
      ? { items: [{ name: "controls/lubricante-aceite", rule: { condition: {}, twowaySynonymsAction: { synonyms: ["lubricante", "aceite"] } } }] }
      : pathValue.startsWith("/admin/search/serving-configs?")
        ? { data: { items: [{ name: "servingConfigs/default_search", controls: ["controls/lubricante-aceite"] }] } }
        : { provider: "fake" };

    return { ok: true, data: options.parse ? options.parse(raw) : raw };
  };
  const { getSearchAdminData } = loadSearchAdminModule(requestAdminBff);

  const data = await getSearchAdminData(context, { tab: "controls" });

  assert.equal(data.tab, "controls");
  assert.equal(data.controls.source, "bff");
  assert.equal(data.servingConfigs.source, "bff");
  assert.equal(data.controls.data[0].name, "controls/lubricante-aceite");
  assert.equal(data.servingConfigs.data[0].name, "servingConfigs/default_search");
  assert.ok(calls.some((call) => call.path === "/admin/search/controls?organizationId=org-1&shopId=shop-1&locale=es-ES"));
  assert.ok(calls.some((call) => call.path === "/admin/search/serving-configs?organizationId=org-1&shopId=shop-1&locale=es-ES"));
  assert.equal(calls.some((call) => call.path.startsWith("/admin/search/query-preview?")), false);
});

test("search admin index and feed tabs keep lab preview idle until forms submit", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method ?? "GET" });
    return { ok: true, data: options.parse ? options.parse({ provider: "fake" }) : { provider: "fake" } };
  };
  const { getSearchAdminData } = loadSearchAdminModule(requestAdminBff);

  const indexData = await getSearchAdminData(context, { tab: "index", query: "pastillas" });
  const feedData = await getSearchAdminData(context, { tab: "feed", query: "pastillas" });

  assert.equal(indexData.tab, "index");
  assert.equal(feedData.tab, "feed");
  assert.equal(indexData.preview.source, "unavailable");
  assert.equal(feedData.preview.source, "unavailable");
  assert.equal(calls.some((call) => call.path.startsWith("/admin/search/query-preview?")), false);
  assert.ok(calls.every((call) => call.path.startsWith("/admin/search/health?")));
});

test("search admin maps read failures to search permission guidance", async () => {
  const requestAdminBff = async () => ({ ok: false, status: 403, error: "Forbidden" });
  const { getSearchAdminHealth } = loadSearchAdminModule(requestAdminBff);

  const health = await getSearchAdminHealth(context);

  assert.equal(health.source, "unavailable");
  assert.equal(health.message, "Falta permiso search.admin.write.");
  assert.equal(health.permission, "search.admin.write");
});

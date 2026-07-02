import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(new URL("..", import.meta.url).pathname);

const context = {
  organizationId: "org-barcelona",
  shopId: "shop-barcelona",
  shopAlias: "barcelona",
  shopName: "Barcelona",
  primaryDomain: "barcelona.test",
  shopStatus: "ACTIVE",
  locale: "es-ES",
  currency: "EUR",
  country: "ES",
  channel: "web",
};

function loadSeoAdminModule(requestBff) {
  const source = readFileSync(path.resolve(root, "src/modules/configuracion/seo-admin.ts"), "utf8");
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
    console,
    exports: commonJsExports,
    module: { exports: commonJsExports },
    require(specifier) {
      if (specifier.endsWith("/shared/bff/client")) {
        return { requestBff };
      }

      throw new Error(`Unexpected test require: ${specifier}`);
    },
  };

  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
}

function ok(raw, options) {
  return {
    ok: true,
    data: options.parse ? options.parse(raw) : raw,
    status: 200,
    correlationId: "corr-test",
  };
}

function assertScopedPath(pathValue) {
  assert.match(pathValue, /[?&]organizationId=org-barcelona(?:&|$)/);
  assert.match(pathValue, /[?&]shopId=shop-barcelona(?:&|$)/);
  assert.match(pathValue, /[?&]locale=es-ES(?:&|$)/);
}

test("seo admin reads routes and redirects through scoped Admin BFF", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method ?? "GET" });

    if (pathValue.startsWith("/admin/routing-seo/routes?")) {
      return ok({
        total: 1,
        limit: 50,
        offset: 0,
        items: [{
          routeId: "route-product",
          organizationId: context.organizationId,
          shopId: context.shopId,
          locale: context.locale,
          path: "/producto-demo/p",
          entityType: "PRODUCT",
          entityId: "product-demo",
          routeKind: "CANONICAL",
          canonicalRouteId: null,
          status: "ACTIVE",
          includeInSitemap: true,
          createdAt: "2026-06-30T00:00:00.000Z",
          updatedAt: "2026-06-30T00:00:00.000Z",
        }],
      }, options);
    }

    if (pathValue.startsWith("/admin/routing-seo/redirects?")) {
      return ok({
        total: 1,
        limit: 50,
        offset: 0,
        items: [{
          redirectId: "redirect-old",
          organizationId: context.organizationId,
          shopId: context.shopId,
          locale: context.locale,
          fromPath: "/producto-antiguo/p",
          toPath: "/producto-demo/p",
          statusCode: 301,
          status: "ACTIVE",
          reason: "slug change",
          expiresAt: null,
          createdAt: "2026-06-30T00:00:00.000Z",
          updatedAt: "2026-06-30T00:00:00.000Z",
        }],
      }, options);
    }

    throw new Error(`Unexpected BFF path: ${pathValue}`);
  };
  const { getSeoAdminData } = loadSeoAdminModule(requestBff);

  const data = await getSeoAdminData(context, { tab: "summary", locale: "es-ES", status: "ACTIVE" });

  assert.equal(data.routes.source, "bff");
  assert.equal(data.routes.data.items[0].path, "/producto-demo/p");
  assert.equal(data.redirects.data.items[0].fromPath, "/producto-antiguo/p");
  assert.equal(calls.length, 2);
  assertScopedPath(calls[0].path);
  assert.match(calls[0].path, /[?&]status=ACTIVE(?:&|$)/);
});

test("seo admin resolve posts no browser direct calls and normalizes route response", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method ?? "GET" });

    if (pathValue.startsWith("/admin/routing-seo/routes?")) {
      return ok({ total: 0, limit: 50, offset: 0, items: [] }, options);
    }
    if (pathValue.startsWith("/admin/routing-seo/redirects?")) {
      return ok({ total: 0, limit: 50, offset: 0, items: [] }, options);
    }
    if (pathValue.startsWith("/admin/routing-seo/resolve?")) {
      return ok({
        kind: "ROUTE",
        requestedPath: "/producto-demo/p",
        canonicalPath: "/producto-demo/p",
        isCanonical: true,
        entityType: "PRODUCT",
        entityId: "product-demo",
        routeId: "route-product",
        canonicalRouteId: "route-product",
        organizationId: context.organizationId,
        shopId: context.shopId,
        locale: context.locale,
      }, options);
    }

    throw new Error(`Unexpected BFF path: ${pathValue}`);
  };
  const { getSeoAdminData } = loadSeoAdminModule(requestBff);

  const data = await getSeoAdminData(context, {
    tab: "resolve",
    locale: "es-ES",
    path: "/producto-demo/p",
    resolveRequested: true,
  });

  const resolveCall = calls.find((call) => call.path.startsWith("/admin/routing-seo/resolve?"));
  assert.ok(resolveCall);
  assert.equal(resolveCall.method, "GET");
  assertScopedPath(resolveCall.path);
  assert.match(resolveCall.path, /[?&]path=%2Fproducto-demo%2Fp(?:&|$)/);
  assert.equal(data.resolved.source, "bff");
  assert.equal(data.resolved.data.kind, "ROUTE");
  assert.equal(data.resolved.data.entityId, "product-demo");
});

test("seo admin mutations use POST and PATCH through scoped Admin BFF", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method, body: options.init?.body });
    return ok({
      routeId: "route-product",
      path: "/producto-demo/p",
      entityType: "PRODUCT",
      entityId: "product-demo",
      routeKind: "CANONICAL",
      canonicalRouteId: null,
      status: "ACTIVE",
      includeInSitemap: true,
      createdAt: "2026-06-30T00:00:00.000Z",
      updatedAt: "2026-06-30T00:00:00.000Z",
    }, options);
  };
  const { createSeoRoute, patchSeoRoute, createSeoRedirect } = loadSeoAdminModule(requestBff);

  await createSeoRoute(context, {
    path: "/producto-demo/p",
    entityType: "PRODUCT",
    entityId: "product-demo",
    routeKind: "CANONICAL",
    includeInSitemap: true,
  }, "es-ES");
  await patchSeoRoute(context, "route-product", {
    path: "/producto-demo-editado/p",
    status: "ACTIVE",
    includeInSitemap: true,
    createRedirectFromPreviousPath: true,
  }, "es-ES");
  await createSeoRedirect(context, {
    fromPath: "/producto-antiguo/p",
    toPath: "/producto-demo/p",
    statusCode: 301,
  }, "es-ES");

  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].path.startsWith("/admin/routing-seo/routes?"), true);
  assertScopedPath(calls[0].path);
  assert.equal(JSON.parse(calls[0].body).entityId, "product-demo");

  assert.equal(calls[1].method, "PATCH");
  assert.equal(calls[1].path.startsWith("/admin/routing-seo/routes/route-product?"), true);
  assert.equal(JSON.parse(calls[1].body).createRedirectFromPreviousPath, true);

  assert.equal(calls[2].method, "POST");
  assert.equal(calls[2].path.startsWith("/admin/routing-seo/redirects?"), true);
  assert.equal(JSON.parse(calls[2].body).fromPath, "/producto-antiguo/p");
});

test("seo admin normalizes alias routes as non-indexable read-only canonical links", async () => {
  const requestBff = async (pathValue, options = {}) => {
    if (pathValue.startsWith("/admin/routing-seo/routes?")) {
      return ok({
        total: 1,
        limit: 50,
        offset: 0,
        items: [{
          routeId: "route-alias",
          organizationId: context.organizationId,
          shopId: context.shopId,
          locale: context.locale,
          path: "/alias-demo/p",
          entityType: "PRODUCT",
          entityId: "product-demo",
          routeKind: "ALIAS",
          canonicalRouteId: "route-product",
          status: "ACTIVE",
          includeInSitemap: true,
          createdAt: "2026-06-30T00:00:00.000Z",
          updatedAt: "2026-06-30T00:00:00.000Z",
        }],
      }, options);
    }
    if (pathValue.startsWith("/admin/routing-seo/redirects?")) {
      return ok({ total: 0, limit: 50, offset: 0, items: [] }, options);
    }

    throw new Error(`Unexpected BFF path: ${pathValue}`);
  };
  const { getSeoAdminData } = loadSeoAdminModule(requestBff);

  const data = await getSeoAdminData(context, { tab: "routes", locale: "es-ES" });
  const alias = data.routes.data.items[0];

  assert.equal(alias.routeKind, "ALIAS");
  assert.equal(alias.canonicalRouteId, "route-product");
  assert.equal(alias.includeInSitemap, false);
});

test("seo admin route mutations strip canonicalRouteId and force aliases out of sitemap", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method, body: options.init?.body });
    return ok({
      routeId: "route-alias",
      path: "/alias-demo/p",
      entityType: "PRODUCT",
      entityId: "product-demo",
      routeKind: "ALIAS",
      canonicalRouteId: "route-product",
      status: "ACTIVE",
      includeInSitemap: false,
      createdAt: "2026-06-30T00:00:00.000Z",
      updatedAt: "2026-06-30T00:00:00.000Z",
    }, options);
  };
  const { createSeoRoute, patchSeoRoute } = loadSeoAdminModule(requestBff);

  await createSeoRoute(context, {
    path: "/alias-demo/p",
    entityType: "PRODUCT",
    entityId: "product-demo",
    routeKind: "ALIAS",
    canonicalRouteId: "route-product",
    includeInSitemap: true,
  }, "es-ES");
  await patchSeoRoute(context, "route-alias", {
    path: "/alias-editado/p",
    routeKind: "ALIAS",
    canonicalRouteId: "route-product",
    includeInSitemap: true,
  }, "es-ES");

  const createBody = JSON.parse(calls[0].body);
  assert.equal(createBody.routeKind, "ALIAS");
  assert.equal(createBody.includeInSitemap, false);
  assert.equal("canonicalRouteId" in createBody, false);

  const patchBody = JSON.parse(calls[1].body);
  assert.equal(patchBody.includeInSitemap, false);
  assert.equal("canonicalRouteId" in patchBody, false);
  assert.equal("routeKind" in patchBody, false);
});

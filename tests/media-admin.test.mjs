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

function loadMediaAdminModule(requestBff) {
  const source = readFileSync(path.resolve(root, "src/modules/catalogo/media-admin.ts"), "utf8");
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
    correlationId: "corr-media",
  };
}

function assertScoped(pathValue) {
  assert.match(pathValue, /[?&]organizationId=org-barcelona(?:&|$)/);
  assert.match(pathValue, /[?&]shopId=shop-barcelona(?:&|$)/);
  assert.match(pathValue, /[?&]locale=es-ES(?:&|$)/);
}

test("media admin lists collections through scoped Admin BFF endpoint", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method ?? "GET" });
    return ok({
      total: 1,
      items: [{
        mediaCollectionId: "collection-1",
        productId: "product-1",
        title: { "es-ES": "Galeria Producto" },
        active: true,
        itemCount: 1,
        items: [{
          mediaAssetId: "asset-1",
          fileName: "cover.png",
          mimeType: "image/png",
          fileSize: 2048,
          isMain: true,
          active: true,
          alt: { "es-ES": "Portada accesible" },
          title: { "es-ES": "Portada" },
        }],
      }],
    }, options);
  };
  const { listMediaCollections } = loadMediaAdminModule(requestBff);

  const result = await listMediaCollections(context, { q: "galeria", status: "all", limit: 25, offset: 5 });

  assert.equal(result.source, "bff");
  assert.equal(result.total, 1);
  assert.equal(result.items[0].title, "Galeria Producto");
  assert.equal(result.items[0].items[0].alt["es-ES"], "Portada accesible");
  assert.equal(calls[0].method, "GET");
  assert.match(calls[0].path, /^\/admin\/media\/collections\?/);
  assert.match(calls[0].path, /[?&]q=galeria(?:&|$)/);
  assert.match(calls[0].path, /[?&]includeInactive=true(?:&|$)/);
  assertScoped(calls[0].path);
});

test("media admin reads collection detail and soft deletes only with mode soft", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method ?? "GET" });
    if ((options.init?.method ?? "GET") === "DELETE") {
      return ok({ deleted: true }, options);
    }
    return ok({
      mediaCollectionId: "collection-2",
      title: "Detalle",
      mediaAssetIds: ["asset-2"],
      assets: [{
        idImage: "asset-2",
        filename: "detail.jpg",
        contentType: "image/jpeg",
        active: false,
      }],
    }, options);
  };
  const { getMediaCollection, softDeleteMediaCollection } = loadMediaAdminModule(requestBff);

  const detail = await getMediaCollection(context, "collection-2");
  const deleted = await softDeleteMediaCollection(context, "collection-2");

  assert.equal(detail.ok, true);
  assert.equal(detail.data.items[0].mediaAssetId, "asset-2");
  assert.equal(detail.data.items[0].fileName, "detail.jpg");
  assert.equal(deleted.ok, true);
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[1].method, "DELETE");
  assert.match(calls[1].path, /^\/admin\/media\/collections\/collection-2\?/);
  assert.match(calls[1].path, /[?&]mode=soft(?:&|$)/);
  assert.doesNotMatch(calls[1].path, /mode=hard/);
  calls.forEach((call) => assertScoped(call.path));
});

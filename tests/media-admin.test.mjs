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
    File,
    FormData,
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

test("media admin hydrates listed collections so thumbnails are available", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method ?? "GET" });
    if (pathValue.startsWith("/admin/media/collections/collection-with-preview?")) {
      return ok({
        collection: {
          mediaCollectionId: "collection-with-preview",
          productId: "product-preview",
          title: "Galeria con preview",
          itemCount: 1,
          items: [{
            mediaAssetId: "asset-preview",
            mimeType: "image/jpeg",
            bytes: 4096,
            isActive: true,
            isMain: true,
            metadata: {
              alt: { "es-ES": "Imagen hidratada" },
              title: { "es-ES": "Preview hidratado" },
            },
          }],
        },
      }, options);
    }

    return ok({
      total: 1,
      items: [{
        mediaCollectionId: "collection-with-preview",
        productId: "product-preview",
        title: "Resumen sin items",
        itemCount: 1,
        mediaAssetIds: ["asset-preview"],
      }],
    }, options);
  };
  const { listMediaCollections } = loadMediaAdminModule(requestBff);

  const result = await listMediaCollections(context, { limit: 50, offset: 0 });

  assert.equal(result.items[0].items.length, 1);
  assert.equal(result.items[0].items[0].mediaAssetId, "asset-preview");
  assert.equal(result.items[0].items[0].fileSize, 4096);
  assert.equal(result.items[0].items[0].alt["es-ES"], "Imagen hidratada");
  assert.equal(calls.length, 2);
  assert.match(calls[0].path, /^\/admin\/media\/collections\?/);
  assert.match(calls[1].path, /^\/admin\/media\/collections\/collection-with-preview\?/);
  calls.forEach((call) => assertScoped(call.path));
});

test("media admin creates collections using the multipart BFF endpoint", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method ?? "GET", body: options.init?.body });
    return ok({
      collection: {
        mediaCollectionId: "collection-created",
        productId: "product-created",
        title: "Galeria nueva",
        itemCount: 1,
        items: [{
          mediaAssetId: "asset-created",
          fileName: "new.jpg",
          mimeType: "image/jpeg",
        }],
      },
    }, options);
  };
  const { createMediaCollection } = loadMediaAdminModule(requestBff);
  const file = new File(["binary"], "new.jpg", { type: "image/jpeg" });

  const result = await createMediaCollection(context, {
    productId: "product-created",
    title: "Galeria nueva",
    files: [file],
    defaultLocale: "es-ES",
    alt: "Alt nuevo",
    assetTitle: "Title nuevo",
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.mediaCollectionId, "collection-created");
  assert.equal(calls[0].method, "POST");
  assert.match(calls[0].path, /^\/admin\/media\/collections\?/);
  assertScoped(calls[0].path);
  assert.equal(calls[0].body.get("shopId"), context.shopId);
  assert.equal(calls[0].body.get("productId"), "product-created");
  assert.equal(calls[0].body.get("title"), "Galeria nueva");
  assert.equal(calls[0].body.get("files").name, "new.jpg");
  assert.deepEqual(JSON.parse(calls[0].body.get("metadata")), [{
    isMain: true,
    alt: { "es-ES": "Alt nuevo" },
    title: { "es-ES": "Title nuevo" },
  }]);
});

test("media admin appends assets to existing collections using multipart", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method ?? "GET", body: options.init?.body });
    return ok({
      collection: {
        mediaCollectionId: "collection-append",
        title: "Galeria existente",
        itemCount: 2,
      },
    }, options);
  };
  const { addMediaCollectionItems } = loadMediaAdminModule(requestBff);
  const file = new File(["binary"], "append.png", { type: "image/png" });

  const result = await addMediaCollectionItems(context, {
    mediaCollectionId: "collection-append",
    files: [file],
    defaultLocale: "es-ES",
  });

  assert.equal(result.ok, true);
  assert.equal(calls[0].method, "POST");
  assert.match(calls[0].path, /^\/admin\/media\/collections\/collection-append\/items\?/);
  assertScoped(calls[0].path);
  assert.equal(calls[0].body.get("shopId"), context.shopId);
  assert.equal(calls[0].body.get("files").name, "append.png");
  assert.deepEqual(JSON.parse(calls[0].body.get("metadata")), [{ isMain: false }]);
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

test("media admin updates collection and asset through scoped patch endpoints", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({
      path: pathValue,
      method: options.init?.method ?? "GET",
      body: options.init?.body ? JSON.parse(options.init.body) : undefined,
    });
    return ok({
      collection: {
        mediaCollectionId: "collection-patch",
        title: "Galeria patch",
        itemCount: 1,
      },
    }, options);
  };
  const { updateMediaAsset, updateMediaCollection } = loadMediaAdminModule(requestBff);

  await updateMediaCollection(context, "collection-patch", { title: "Galeria patch" });
  await updateMediaAsset(context, {
    mediaCollectionId: "collection-patch",
    mediaAssetId: "asset-patch",
    position: 2,
    isMain: true,
    isActive: false,
    alt: "Alt patch",
    title: "Title patch",
    locale: "es-ES",
  });

  assert.equal(calls[0].method, "PATCH");
  assert.match(calls[0].path, /^\/admin\/media\/collections\/collection-patch\?/);
  assert.deepEqual(calls[0].body, { title: "Galeria patch" });
  assert.equal(calls[1].method, "PATCH");
  assert.match(calls[1].path, /^\/admin\/media\/collections\/collection-patch\/items\/asset-patch\?/);
  assert.deepEqual(calls[1].body, {
    position: 2,
    isMain: true,
    isActive: false,
    metadata: {
      alt: { "es-ES": "Alt patch" },
      title: { "es-ES": "Title patch" },
    },
  });
  calls.forEach((call) => assertScoped(call.path));
});

test("media admin soft deletes assets only with mode soft", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method ?? "GET" });
    return ok({ deleted: true }, options);
  };
  const { softDeleteMediaAsset } = loadMediaAdminModule(requestBff);

  const result = await softDeleteMediaAsset(context, "collection-delete", "asset-delete");

  assert.equal(result.ok, true);
  assert.equal(calls[0].method, "DELETE");
  assert.match(calls[0].path, /^\/admin\/media\/collections\/collection-delete\/items\/asset-delete\?/);
  assert.match(calls[0].path, /[?&]mode=soft(?:&|$)/);
  assert.doesNotMatch(calls[0].path, /mode=hard/);
  assertScoped(calls[0].path);
});

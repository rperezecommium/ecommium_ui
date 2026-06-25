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

function loadProductActionsModule({ requestBff, getAdminContext }) {
  const source = readFileSync(path.resolve(root, "src/modules/catalogo/product-actions.ts"), "utf8");
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
    FormData,
    Blob,
    crypto,
    console,
    exports: commonJsExports,
    module: { exports: commonJsExports },
    require(specifier) {
      if (specifier.endsWith("/shared/config/admin-context")) {
        return { getAdminContext };
      }
      if (specifier.endsWith("/shared/bff/client")) {
        return { requestBff };
      }
      if (specifier === "./catalog-taxonomy") {
        return {
          createCatalogEntity: async () => ({ ok: true, data: { id: "entity-1", label: "Entity" } }),
          listCatalogEntities: async () => ({ items: [], total: 0, source: "bff" }),
          toLookupOptions: () => [],
        };
      }
      if (specifier === "./products") {
        return {
          makeProductGateway: () => ({}),
        };
      }

      throw new Error(`Unexpected test require: ${specifier}`);
    },
  };

  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
}

function productDraft() {
  return {
    basic: {
      name: "Producto UI",
      slug: "producto-ui",
      categoryId: "category-1",
      brandId: "brand-1",
      shortDescription: "Producto UI",
      description: "Producto UI",
      isVisible: true,
      isActive: false,
      keywords: "ui",
      metaTitle: "Producto UI",
      metaDescription: "Producto UI",
      taxCode: "standard",
    },
    mode: "simple",
    defaultVariant: {
      refId: "PRODUCTO-UI",
      name: "Producto UI",
      ean: null,
    },
    media: {
      items: [],
      removedItems: [],
      assignments: {},
      mainByVariant: {},
    },
    variants: [],
    pricing: {
      productPrice: undefined,
      variantPrices: {},
    },
    inventory: {
      stockByVariant: {},
    },
    shipping: {
      package: {
        weightGrams: 1000,
        widthMm: null,
        heightMm: null,
        depthMm: null,
      },
      additionalShippingCostMinor: null,
      allowedCarrierIds: [],
      deliveryTimeMode: "default",
      deliveryTimeNotes: {
        inStock: {},
        outOfStock: {},
      },
    },
    saveState: {
      catalog: "pending",
      variants: "pending",
      media: "pending",
      variantMedia: "pending",
      pricing: "pending",
      inventory: "pending",
      shipping: "pending",
      publish: "pending",
    },
  };
}

test("saveProductDraftAction sends one idempotent product save operation to BFF", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, options });
    assert.equal(pathValue.startsWith("/admin/product-save-operations?"), true);
    assert.match(pathValue, /[?&]organizationId=org-barcelona(?:&|$)/);
    assert.match(pathValue, /[?&]shopId=shop-barcelona(?:&|$)/);
    assert.match(pathValue, /[?&]locale=es-ES(?:&|$)/);
    assert.equal(options.init?.method, "POST");
    assert.equal(options.init?.headers?.["idempotency-key"], "ui-save-key-1");
    assert.equal(options.init?.body instanceof FormData, true);
    assert.equal(options.init.body.get("idempotencyKey"), "ui-save-key-1");
    assert.deepEqual(
      JSON.parse(options.init.body.get("draft")),
      JSON.parse(JSON.stringify(productDraft())),
    );
    assert.deepEqual([...options.init.body.getAll("fileLocalIds")], ["local-media-1"]);
    assert.equal(options.init.body.getAll("files").length, 1);

    const raw = {
      ok: true,
      operationId: "pso-test",
      productId: "product-1",
      defaultVariantId: "variant-default",
      mediaCollectionId: null,
      status: "saved_unpublished",
      retryable: false,
      blocks: {
        catalog: "success",
        variants: "skipped",
        media: "skipped",
        variantMedia: "skipped",
        pricing: "skipped",
        inventory: "skipped",
        shipping: "success",
        publish: "skipped",
      },
      messages: ["Producto creado."],
      fieldErrors: {},
      recoveryActions: [],
      correlationIds: ["bff-corr"],
    };

    return {
      ok: true,
      data: options.parse ? options.parse(raw) : raw,
      status: 200,
      correlationId: "ui-corr",
    };
  };
  const { saveProductDraftAction } = loadProductActionsModule({
    requestBff,
    getAdminContext: async () => context,
  });
  const formData = new FormData();
  formData.set("draft", JSON.stringify(productDraft()));
  formData.set("idempotencyKey", "ui-save-key-1");
  formData.append("fileLocalIds", "local-media-1");
  formData.append("files", new Blob(["image-bytes"], { type: "image/png" }), "demo.png");

  const result = await saveProductDraftAction(formData);

  assert.equal(calls.length, 1);
  assert.equal(result.ok, true);
  assert.equal(result.operationId, "pso-test");
  assert.equal(result.blocks.publish, "skipped");
  assert.deepEqual(result.recoveryActions, []);
  assert.deepEqual([...result.correlationIds], ["bff-corr", "ui-corr"]);
});

test("saveProductDraftAction preserves BFF recovery actions for partial failures", async () => {
  const requestBff = async (pathValue, options = {}) => {
    assert.equal(pathValue.startsWith("/admin/product-save-operations?"), true);
    const raw = {
      ok: false,
      operationId: "pso-retry",
      productId: "product-1",
      defaultVariantId: "variant-default",
      status: "partial_failed",
      retryable: true,
      blocks: {
        catalog: "success",
        variants: "success",
        media: "success",
        variantMedia: "failed",
        pricing: "skipped",
        inventory: "skipped",
        shipping: "success",
        publish: "blocked",
      },
      messages: ["Producto guardado parcialmente."],
      fieldErrors: {
        "media:variant-default": "No se pudo asociar la imagen a la variante.",
      },
      recoveryActions: [{
        code: "retry_variant_media",
        label: "Reintentar asociacion de imagenes",
        targetBlock: "variantMedia",
        retryable: true,
      }],
      correlationIds: ["bff-corr"],
    };

    return {
      ok: true,
      data: options.parse ? options.parse(raw) : raw,
      status: 200,
      correlationId: "ui-corr",
    };
  };
  const { saveProductDraftAction } = loadProductActionsModule({
    requestBff,
    getAdminContext: async () => context,
  });
  const formData = new FormData();
  formData.set("draft", JSON.stringify(productDraft()));
  formData.set("idempotencyKey", "ui-save-key-retry");

  const result = await saveProductDraftAction(formData);

  assert.equal(result.ok, false);
  assert.equal(result.retryable, true);
  assert.equal(result.blocks.publish, "blocked");
  assert.equal(result.recoveryActions[0].code, "retry_variant_media");
  assert.equal(result.recoveryActions[0].targetBlock, "variantMedia");
  assert.deepEqual([...result.correlationIds], ["bff-corr", "ui-corr"]);
});

test("saveProductDraftAction fails before BFF when Admin context is missing", async () => {
  let called = false;
  const { saveProductDraftAction } = loadProductActionsModule({
    requestBff: async () => {
      called = true;
      throw new Error("requestBff should not be called");
    },
    getAdminContext: async () => ({ ...context, organizationId: "", shopId: "" }),
  });
  const formData = new FormData();
  formData.set("draft", JSON.stringify(productDraft()));

  const result = await saveProductDraftAction(formData);

  assert.equal(called, false);
  assert.equal(result.ok, false);
  assert.equal(result.fieldErrors.context, "Selecciona Organization y Shop antes de guardar productos.");
});

test("readProductDraftMediaStateAction rehydrates persisted draft media through BFF", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, options });
    assert.equal(pathValue.startsWith("/admin/product-drafts/client-draft-1?"), true);
    assert.match(pathValue, /[?&]organizationId=org-barcelona(?:&|$)/);
    assert.match(pathValue, /[?&]shopId=shop-barcelona(?:&|$)/);
    assert.match(pathValue, /[?&]locale=es-ES(?:&|$)/);
    assert.equal(options.init?.method, "GET");

    const raw = {
      ok: true,
      clientDraftId: "client-draft-1",
      productId: "product-1",
      defaultVariantId: "variant-default",
      mediaCollectionId: "collection-1",
      status: "incomplete",
      expiresAt: "2026-06-25T00:00:00.000Z",
      mediaItems: [{
        localId: "asset-1",
        mediaAssetId: "asset-1",
        fileName: "demo.png",
        mimeType: "image/png",
        fileSize: 11,
        previewUrl: "https://media.test/demo.png",
        thumbnailUrl: "https://media.test/demo-thumb.png",
        isMain: true,
        position: 1,
        active: true,
        persisted: true,
        uploadStatus: "uploaded",
        alt: { "es-ES": "Demo" },
        title: { "es-ES": "Demo" },
      }],
      warnings: [],
      draftPatch: {
        clientDraftId: "client-draft-1",
        productId: "product-1",
      },
    };

    return {
      ok: true,
      data: options.parse ? options.parse(raw) : raw,
      status: 200,
      correlationId: "ui-corr",
    };
  };
  const { readProductDraftMediaStateAction } = loadProductActionsModule({
    requestBff,
    getAdminContext: async () => context,
  });

  const result = await readProductDraftMediaStateAction("client-draft-1");

  assert.equal(calls.length, 1);
  assert.equal(result.ok, true);
  assert.equal(result.productId, "product-1");
  assert.equal(result.mediaItems[0].mediaAssetId, "asset-1");
  assert.deepEqual([...result.correlationIds], ["ui-corr"]);
});

test("uploadProductDraftMediaAction sends one idempotent draft media upload to BFF", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, options });
    assert.equal(pathValue.startsWith("/admin/product-drafts/client-draft-1/media?"), true);
    assert.match(pathValue, /[?&]organizationId=org-barcelona(?:&|$)/);
    assert.match(pathValue, /[?&]shopId=shop-barcelona(?:&|$)/);
    assert.match(pathValue, /[?&]locale=es-ES(?:&|$)/);
    assert.equal(options.init?.method, "POST");
    assert.equal(options.init?.headers?.["idempotency-key"], "upload-key-1");
    assert.equal(options.init?.body instanceof FormData, true);
    assert.equal(options.init.body.get("fileLocalId"), "local-media-1");
    assert.equal(options.init.body.get("idempotencyKey"), "upload-key-1");
    assert.equal(options.init.body.get("file") instanceof Blob, true);

    const raw = {
      ok: true,
      uploadOperationId: "pdmu-test",
      idempotencyKey: "upload-key-1",
      clientDraftId: "client-draft-1",
      productId: "product-1",
      defaultVariantId: "variant-default",
      mediaCollectionId: "collection-1",
      mediaItem: {
        localId: "local-media-1",
        mediaAssetId: "asset-1",
        fileName: "demo.png",
        mimeType: "image/png",
        fileSize: 11,
        previewUrl: "https://media.test/demo.png",
        isMain: true,
        persisted: true,
        uploadStatus: "uploaded",
        alt: {},
        title: {},
      },
      status: "incomplete",
      correlationIds: ["bff-corr"],
      draftPatch: {
        productId: "product-1",
        mediaCollectionId: "collection-1",
      },
    };

    return {
      ok: true,
      data: options.parse ? options.parse(raw) : raw,
      status: 200,
      correlationId: "ui-corr",
    };
  };
  const { uploadProductDraftMediaAction } = loadProductActionsModule({
    requestBff,
    getAdminContext: async () => context,
  });
  const formData = new FormData();
  formData.set("fileLocalId", "local-media-1");
  formData.set("idempotencyKey", "upload-key-1");
  formData.set("metadata", JSON.stringify({ isMain: true }));
  formData.set("file", new Blob(["image-bytes"], { type: "image/png" }));

  const result = await uploadProductDraftMediaAction("client-draft-1", formData);

  assert.equal(calls.length, 1);
  assert.equal(result.ok, true);
  assert.equal(result.mediaItem.mediaAssetId, "asset-1");
  assert.deepEqual([...result.correlationIds], ["bff-corr", "ui-corr"]);
});

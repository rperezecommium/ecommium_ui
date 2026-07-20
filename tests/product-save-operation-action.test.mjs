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

function loadProductActionsModule({
  requestBff,
  getAdminContext,
  makeProductGateway = () => ({}),
  getAdminProductEditorData = async () => ({ ok: false, error: "not mocked" }),
  revalidatePath = () => {},
  redirect = (url) => {
    const error = new Error("NEXT_REDIRECT");
    error.url = url;
    throw error;
  },
}) {
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
      if (specifier === "next/cache") {
        return { revalidatePath };
      }
      if (specifier === "next/navigation") {
        return { redirect };
      }
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
          getAdminProductEditorData,
          makeProductGateway,
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
      specificPrices: [],
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

test("saveProductDraftAction strips read-only routing SEO fields before BFF", async () => {
  const calls = [];
  const dirtyDraft = productDraft();
  dirtyDraft.routingSeo = {
    canonicalRouteId: "route-canonical",
    canonicalPath: "/producto-ui/p",
    status: "ACTIVE",
    includeInSitemap: true,
    createRedirectFromPreviousPath: true,
    resolvedCanonical: {
      kind: "ROUTE",
      requestedPath: "/producto-ui/p",
      canonicalPath: "/producto-ui/p",
    },
    updatedAt: "2026-07-01T00:00:00.000Z",
    aliases: [
      {
        routeId: "route-alias",
        path: "/producto-ui",
        routeKind: "ALIAS",
        canonicalRouteId: "route-canonical",
        status: "ACTIVE",
        includeInSitemap: true,
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    ],
  };
  const requestBff = async (_pathValue, options = {}) => {
    const sentDraft = JSON.parse(options.init.body.get("draft"));
    calls.push(sentDraft);

    assert.equal("canonicalRouteId" in sentDraft.routingSeo, false);
    assert.equal("resolvedCanonical" in sentDraft.routingSeo, false);
    assert.equal("updatedAt" in sentDraft.routingSeo, false);
    assert.equal(sentDraft.routingSeo.aliases[0].includeInSitemap, false);
    assert.equal("canonicalRouteId" in sentDraft.routingSeo.aliases[0], false);
    assert.equal("updatedAt" in sentDraft.routingSeo.aliases[0], false);

    const raw = {
      ok: true,
      operationId: "pso-seo",
      productId: "product-1",
      defaultVariantId: "variant-default",
      mediaCollectionId: null,
      status: "saved_unpublished",
      retryable: false,
      blocks: { catalog: "success", routingSeo: "success" },
      messages: ["Producto actualizado."],
      fieldErrors: {},
      recoveryActions: [],
      correlationIds: [],
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
  formData.set("draft", JSON.stringify(dirtyDraft));
  formData.set("idempotencyKey", "ui-save-key-seo");

  const result = await saveProductDraftAction(formData);

  assert.equal(calls.length, 1);
  assert.equal(result.ok, true);
});

test("saveProductDraftAction forwards product specification selections to BFF", async () => {
  const calls = [];
  const draft = productDraft();
  draft.specifications = {
    productId: "product-1",
    selections: [
      {
        fieldId: "field-material",
        fieldValueId: "value-carbon",
        groupId: "group-technical",
        fieldName: "Material",
        valueName: "Carbono",
      },
    ],
  };
  const requestBff = async (_pathValue, options = {}) => {
    calls.push({ body: options.init.body });
    const sentDraft = JSON.parse(options.init.body.get("draft"));

    assert.deepEqual(sentDraft.specifications, draft.specifications);

    const raw = {
      ok: true,
      operationId: "pso-specifications",
      productId: "product-1",
      status: "saved_unpublished",
      retryable: false,
      blocks: { catalog: "success", specifications: "success" },
      messages: ["Caracteristicas guardadas."],
      fieldErrors: {},
      recoveryActions: [],
      correlationIds: ["bff-specifications"],
    };

    return {
      ok: true,
      data: options.parse ? options.parse(raw) : raw,
      status: 200,
      correlationId: "ui-specifications",
    };
  };
  const { saveProductDraftAction } = loadProductActionsModule({
    requestBff,
    getAdminContext: async () => context,
  });
  const formData = new FormData();
  formData.set("draft", JSON.stringify(draft));
  formData.set("idempotencyKey", "ui-save-specifications");

  const result = await saveProductDraftAction(formData);

  assert.equal(calls.length, 1);
  assert.equal(result.ok, true);
  assert.equal(result.blocks.specifications, "success");
  assert.deepEqual([...result.correlationIds], ["bff-specifications", "ui-specifications"]);
});

test("previewAppliedProductPriceAction delegates to product gateway with Admin context", async () => {
  const calls = [];
  const makeProductGateway = (gatewayContext) => ({
    previewAppliedPrice: async (input) => {
      calls.push({ gatewayContext, input });
      return {
        ok: true,
        data: {
          ok: true,
          status: "APPLIED",
          reason: null,
          requested: {
            productId: input.productId,
            variantId: input.variantId,
            defaultVariantId: input.defaultVariantId,
            currency: "EUR",
            country: "ES",
            tradePolicy: "default",
            channel: "web",
            customerGroup: null,
            priceTableId: "vip-table",
            quantity: 1,
            at: null,
          },
          resolution: {
            source: "PRODUCT_FALLBACK",
            usedFallback: true,
          },
          price: {
            pricingId: "pricing-specific-product",
            targetType: "PRODUCT",
            productId: "product-1",
            variantId: null,
            priceTableId: "vip-table",
            tradePolicy: "default",
            channel: "web",
            customerGroup: null,
            country: "ES",
            currency: "EUR",
            basePrice: { currency: "EUR", amountMinor: 700 },
            listPrice: null,
            fixedPrice: { currency: "EUR", amountMinor: 500 },
            tiers: [{ minQuantity: 1, price: { currency: "EUR", amountMinor: 500 } }],
            taxIncluded: true,
            active: true,
            priority: 100,
            source: "FIXED",
            resolved: {
              currency: "EUR",
              netAmountMinor: 413,
              taxAmountMinor: 87,
              grossAmountMinor: 500,
              taxIncluded: true,
            },
          },
          conditions: [{
            key: "priceTableId",
            requested: "vip-table",
            matched: "vip-table",
            status: "MATCH",
          }],
        },
        status: 200,
        correlationId: "corr-preview",
      };
    },
  });
  const { previewAppliedProductPriceAction } = loadProductActionsModule({
    requestBff: async () => {
      throw new Error("requestBff should not be called directly");
    },
    getAdminContext: async () => context,
    makeProductGateway,
  });

  const result = await previewAppliedProductPriceAction({
    productId: "product-1",
    variantId: "variant-1",
    defaultVariantId: "default-variant",
    currency: "EUR",
    country: "ES",
    tradePolicy: "default",
    channel: "web",
    priceTableId: "vip-table",
    quantity: 1,
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].gatewayContext, context);
  assert.equal(calls[0].input.productId, "product-1");
  assert.equal(calls[0].input.variantId, "variant-1");
  assert.equal(result.ok, true);
  assert.equal(result.resolution.source, "PRODUCT_FALLBACK");
  assert.deepEqual([...result.correlationIds], ["corr-preview"]);
});

test("deactivateProductAction hides product through BFF and inactivates SEO routes", async () => {
  const gatewayCalls = [];
  const routeCalls = [];
  const revalidated = [];
  const requestBff = async (pathValue, options = {}) => {
    routeCalls.push({ path: pathValue, options });
    assert.match(pathValue, /^\/admin\/routing-seo\/routes\/route-/);
    assert.equal(options.init?.method, "PATCH");
    assert.deepEqual(JSON.parse(options.init.body), {
      status: "INACTIVE",
      includeInSitemap: false,
    });

    return {
      ok: true,
      data: {},
      status: 200,
      correlationId: "corr-route",
    };
  };
  const makeProductGateway = (gatewayContext) => {
    assert.equal(gatewayContext.organizationId, context.organizationId);

    return {
      updateProduct: async (productId, payload) => {
        gatewayCalls.push({ productId, payload });
        return {
          ok: true,
          data: {
            productId,
            name: payload.name,
            slug: payload.slug,
            isActive: payload.isActive,
            isVisible: payload.isVisible,
          },
          status: 200,
          correlationId: "corr-product",
        };
      },
    };
  };
  const getAdminProductEditorData = async (editorContext, productId) => {
    assert.equal(editorContext.shopId, context.shopId);
    assert.equal(productId, "product-1");

    return {
      ok: true,
      data: {
        product: {
          productId,
          name: "Producto a retirar",
          slug: "producto-a-retirar",
          reference: "SKU-RETIRAR",
          categoryId: "category-1",
          brandId: "brand-1",
          isActive: true,
          isVisible: true,
          metaTitle: "Producto a retirar",
          metaDescription: "Descripcion",
          taxCode: "standard",
        },
        routingSeo: {
          canonicalRoute: {
            routeId: "route-canonical",
            path: "/producto-a-retirar/p",
            status: "ACTIVE",
            includeInSitemap: true,
          },
          aliases: [{
            routeId: "route-alias",
            path: "/producto-a-retirar",
            status: "ACTIVE",
            includeInSitemap: false,
          }],
        },
      },
    };
  };
  const { deactivateProductAction } = loadProductActionsModule({
    requestBff,
    getAdminContext: async () => context,
    getAdminProductEditorData,
    makeProductGateway,
    revalidatePath: (pathValue) => revalidated.push(pathValue),
  });
  const formData = new FormData();
  formData.set("productId", "product-1");
  formData.set("confirmDeactivate", "yes");
  formData.set("returnTo", "/admin/products?limit=20&offset=0");

  await assert.rejects(() => deactivateProductAction(formData), (error) => {
    assert.equal(error.url.startsWith("/admin/products?"), true);
    assert.match(error.url, /productMessage=Producto\+desactivado/);
    return true;
  });

  assert.equal(gatewayCalls.length, 1);
  assert.equal(gatewayCalls[0].productId, "product-1");
  assert.equal(gatewayCalls[0].payload.isActive, false);
  assert.equal(gatewayCalls[0].payload.isVisible, false);
  assert.equal(gatewayCalls[0].payload.name, "Producto a retirar");
  assert.equal(routeCalls.length, 2);
  assert.deepEqual(revalidated, ["/admin/products"]);
});

test("bulkDeactivateProductsAction hides selected products through BFF", async () => {
  const gatewayCalls = [];
  const routeCalls = [];
  const productsById = {
    "product-1": {
      productId: "product-1",
      name: "Producto uno",
      slug: "producto-uno",
      reference: "SKU-UNO",
      categoryId: "category-1",
      brandId: "brand-1",
      isActive: true,
      isVisible: true,
      metaTitle: "Producto uno",
      metaDescription: "Descripcion uno",
      taxCode: "standard",
    },
    "product-2": {
      productId: "product-2",
      name: "Producto dos",
      slug: "producto-dos",
      reference: "SKU-DOS",
      categoryId: "category-1",
      brandId: "brand-1",
      isActive: true,
      isVisible: true,
      metaTitle: "Producto dos",
      metaDescription: "Descripcion dos",
      taxCode: "standard",
    },
  };
  const requestBff = async (pathValue, options = {}) => {
    routeCalls.push({ path: pathValue, options });
    assert.match(pathValue, /^\/admin\/routing-seo\/routes\/route-product-/);
    assert.equal(options.init?.method, "PATCH");

    return {
      ok: true,
      data: {},
      status: 200,
      correlationId: "corr-route",
    };
  };
  const makeProductGateway = () => ({
    updateProduct: async (productId, payload) => {
      gatewayCalls.push({ productId, payload });
      return {
        ok: true,
        data: {
          productId,
          name: payload.name,
          slug: payload.slug,
          isActive: payload.isActive,
          isVisible: payload.isVisible,
        },
        status: 200,
        correlationId: "corr-product",
      };
    },
  });
  const getAdminProductEditorData = async (_editorContext, productId) => ({
    ok: true,
    data: {
      product: productsById[productId],
      routingSeo: {
        canonicalRoute: {
          routeId: `route-${productId}`,
          path: `/${productsById[productId].slug}/p`,
          status: "ACTIVE",
          includeInSitemap: true,
        },
        aliases: [],
      },
    },
  });
  const { bulkDeactivateProductsAction } = loadProductActionsModule({
    requestBff,
    getAdminContext: async () => context,
    getAdminProductEditorData,
    makeProductGateway,
  });
  const formData = new FormData();
  formData.append("productIds", "product-1");
  formData.append("productIds", "product-2");
  formData.set("confirmBulkDeactivate", "yes");
  formData.set("returnTo", "/admin/products?limit=20&offset=0");

  await assert.rejects(() => bulkDeactivateProductsAction(formData), (error) => {
    assert.equal(error.url.startsWith("/admin/products?"), true);
    assert.match(error.url, /productMessage=2\+productos\+desactivados\+y\+ocultos/);
    return true;
  });

  assert.deepEqual(gatewayCalls.map((call) => call.productId), ["product-1", "product-2"]);
  assert.equal(gatewayCalls.every((call) => call.payload.isActive === false && call.payload.isVisible === false), true);
  assert.equal(routeCalls.length, 2);
});

test("saveProductDraftAction forwards product-centric specific prices to BFF", async () => {
  const draft = productDraft();
  draft.pricing.productPrice = {
    basePriceMinor: 10999,
    listPriceMinor: null,
    costPriceMinor: null,
    currency: "EUR",
    taxIncluded: true,
    taxCode: "standard",
    tax: null,
    priceTableId: null,
    tradePolicy: "default",
    channel: "web",
    customerGroup: null,
    country: "ES",
  };
  draft.pricing.specificPrices = [{
    targetType: "PRODUCT",
    currency: "EUR",
    country: "ES",
    customerGroup: null,
    channel: "web",
    tradePolicy: "default",
    priceTableId: null,
    minQuantity: 2,
    validFrom: "2026-06-26T00:00:00.000Z",
    validUntil: null,
    unlimited: true,
    impactType: "FIXED_PRICE",
    basePriceMinor: 10999,
    fixedPriceMinor: 8999,
    reductionValue: null,
    reductionTaxIncluded: true,
    taxIncluded: true,
    tax: null,
    active: true,
    priority: 100,
  }];

  const requestBff = async (pathValue, options = {}) => {
    assert.equal(pathValue.startsWith("/admin/product-save-operations?"), true);
    const sentDraft = JSON.parse(options.init.body.get("draft"));
    assert.equal(sentDraft.pricing.specificPrices.length, 1);
    assert.equal(sentDraft.pricing.specificPrices[0].targetType, "PRODUCT");
    assert.equal(sentDraft.pricing.specificPrices[0].fixedPriceMinor, 8999);
    assert.equal(sentDraft.pricing.specificPrices[0].minQuantity, 2);

    const raw = {
      ok: true,
      operationId: "pso-specific",
      productId: "product-1",
      defaultVariantId: "variant-default",
      retryable: false,
      blocks: {
        catalog: "success",
        variants: "skipped",
        media: "skipped",
        variantMedia: "skipped",
        pricing: "success",
        inventory: "skipped",
        shipping: "success",
        publish: "skipped",
      },
      messages: ["Precio guardado."],
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
  formData.set("draft", JSON.stringify(draft));
  formData.set("idempotencyKey", "ui-save-specific");

  const result = await saveProductDraftAction(formData);

  assert.equal(result.ok, true);
  assert.equal(result.blocks.pricing, "success");
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

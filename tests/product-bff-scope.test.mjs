import {loadTs} from "./helpers/load-ts.mjs";
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

function asRecord(value) {
  return typeof value === "object" && value !== null ? value : {};
}

function loadProductsModule(requestAdminBff) {
  const source = readFileSync(path.resolve(root, "src/modules/catalogo/products.ts"), "utf8");
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
    console,
    exports: commonJsExports,
    module: { exports: commonJsExports },
    require(specifier) {
      if (["./product-warehouses", "./product-variant-shipping"].includes(specifier)) return loadTs(`src/modules/catalogo/${specifier.slice(2)}.ts`);
      if (specifier === "./product-specification-fields") return loadTs("src/modules/catalogo/product-specification-fields.ts");
      if (specifier.endsWith("/shared/bff/admin-client")) {
        return { requestAdminBff };
      }
      if (specifier === "./catalog-taxonomy") {
        return {
          listCatalogEntities: async () => ({ items: [], total: 0, source: "bff" }),
          toLookupOptions: () => [],
        };
      }
      if (specifier === "./catalog-attributes-features") {
        return {
          listCatalogAttributeFeatureData: async () => ({
            groups: [],
            fields: [],
            source: "bff",
          }),
        };
      }
      if (specifier === "./pricing-admin") {
        return {
          getPricingEditorLookups: async () => ({ taxes: [], priceTables: [], warnings: [] }),
        };
      }
      if (specifier === "./product-status") {
        return {
          productStatusIsActive(value, fallback = false) {
            const record = asRecord(value);
            if (typeof record.isActive === "boolean") {
              return record.isActive;
            }
            if (typeof record.active === "boolean") {
              return record.active;
            }
            return typeof record.status === "string" ? record.status === "ACTIVE" : fallback;
          },
        };
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
}

test("product list and editor-state use Admin BFF endpoints scoped by active shop", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method ?? "GET", body: options.init?.body });

    if (pathValue.startsWith("/admin/products?")) {
      return ok({
        items: [{
          productId: "product-1",
          name: "Producto Barcelona",
          slug: "producto-barcelona",
          isActive: false,
          isVisible: true,
          defaultVariantId: "variant-1",
          price: {
            currentAmountMinor: 1299,
            currency: "EUR",
          },
          quantity: 7,
          readIndexPrepared: true,
        }],
        total: 1,
      }, options);
    }
    if (pathValue.startsWith("/admin/products/product-1/editor-state?")) {
      return ok({
        product: { productId: "product-1", name: "Producto Barcelona", slug: "producto-barcelona", isActive: false, isVisible: true },
        variants: [{ variantId: "variant-1", refId: "PRODUCTO-BARCELONA", isActive: true, isVisible: true, isDefault: true }],
        prices: {
          items: [],
          specificPrices: [{
            pricingId: "specific-product-1",
            targetType: "PRODUCT",
            productId: "product-1",
            variantId: null,
            currency: "EUR",
            country: "ES",
            minQuantity: 2,
            fixedPriceMinor: 899,
            active: true,
          }],
        },
        availability: { items: [] },
      }, options);
    }
    if (pathValue.startsWith("/admin/offerings/variants/resolve-batch?")) {
      return ok({ variants: [] }, options);
    }

    throw new Error(`Unexpected BFF path: ${pathValue}`);
  };
  const { getAdminProducts, getAdminProductEditorData } = loadProductsModule(requestAdminBff);

  await getAdminProducts(context, { limit: 20, offset: 0 });
  const editorData = await getAdminProductEditorData(context, "product-1");

  assert.equal(calls.some((call) => call.path.startsWith("/inventory/")), false);
  assert.ok(calls.some((call) => call.path.startsWith("/admin/products?")));
  assert.equal(calls.some((call) => call.path.startsWith("/admin/prices?")), false);
  assert.equal(calls.some((call) => call.path.startsWith("/admin/inventory/availability/resolve-batch?")), false);
  assert.equal(calls.some((call) => /\/admin\/products\/[^/]+\/variants\?/.test(call.path)), false);
  assert.ok(calls.some((call) => call.path.startsWith("/admin/products/product-1/editor-state?")));
  const editorRequest = calls.find((call) => call.path.startsWith("/admin/products/product-1/editor-state?"));
  assert.equal(new URLSearchParams(editorRequest.path.split("?")[1]).has("warehouseId"), false);
  assert.equal(editorData.ok, true);
  assert.equal(editorData.data.specificPrices[0].pricingId, "specific-product-1");
  assert.equal(editorData.data.specificPrices[0].fixedPriceMinor, 899);
  assert.equal(calls.every((call) => call.path.startsWith("/admin/")), true);
  calls.forEach((call) => assertScopedPath(call.path));
});

test("product gateway sends organizationId and shopId on related Admin BFF paths", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method ?? "GET", body: options.init?.body });

    if (pathValue.includes("/media/collections")) {
      return ok({ mediaCollectionId: "collection-1", mediaAssetIds: ["media-1"] }, options);
    }
    if (pathValue.includes("/variants") && !pathValue.includes("/media")) {
      return ok({ variantId: "variant-1", refId: "SKU-1", isActive: true, isVisible: true }, options);
    }
    if (pathValue.includes("/inventory/stock-levels")) {
      return ok({ warehouseId: "main-warehouse", onHandQuantity: 3, reservedQuantity: 0, safetyStockQuantity: 0 }, options);
    }
    if (pathValue.includes("/prices")) {
      return ok({ pricingId: "price-1" }, options);
    }
    if (pathValue.includes("/media")) {
      return ok({ assigned: true }, options);
    }

    return ok({ productId: "product-1", name: "Producto Barcelona", slug: "producto-barcelona", isActive: false, isVisible: true }, options);
  };
  const { makeProductGateway } = loadProductsModule(requestAdminBff);
  const gateway = makeProductGateway(context);
  const productPayload = {
    locale: "es-ES",
    name: "Producto Barcelona",
    slug: "producto-barcelona",
    linkId: "producto-barcelona",
    defaultVariant: { refId: "SKU-1" },
    isVisible: true,
    isActive: false,
  };
  const variantPayload = {
    locale: "es-ES",
    name: "Producto Barcelona",
    refId: "SKU-1",
    ean: null,
    isVisible: true,
    isActive: true,
  };
  const price = {
    basePriceMinor: 1299,
    currency: "EUR",
    taxIncluded: true,
    taxCode: "BIKE_STANDARD",
    tax: {
      taxCode: "BIKE_STANDARD",
      name: "Bike VAT Included",
      calculationType: "PERCENTAGE",
      rate: 0.21,
      amountMinor: null,
      isCompound: false,
      isActive: true,
      validFrom: "2025-01-01T00:00:00.000Z",
      validUntil: null,
    },
  };

  await gateway.createProduct(productPayload);
  await gateway.updateProduct("product-1", productPayload);
  await gateway.getProduct("product-1");
  await gateway.listVariants("product-1");
  await gateway.createVariant("product-1", variantPayload);
  await gateway.updateVariant("variant-1", variantPayload);
  const createdCollection = await gateway.createMediaCollection({ productId: "product-1", shopId: context.shopId, title: "Producto", defaultLocale: "es-ES", files: [], metadata: [] });
  const appendedCollection = await gateway.appendMediaItems({ mediaCollectionId: "collection-1", defaultLocale: "es-ES", files: [], metadata: [] });
  await gateway.deleteMediaItem({ mediaCollectionId: "collection-1", mediaAssetId: "media-1" });
  await gateway.assignVariantMedia({ variantId: "variant-1", mediaAssetIds: ["media-1"], mainMediaAssetId: "media-1" });
  await gateway.createProductPrice({ productId: "product-1", price });
  await gateway.updatePrice({ pricingId: "price-1", price });
  await gateway.createVariantPrice({ productId: "product-1", variantId: "variant-1", price });
  await gateway.putStockLevel({
    variantId: "variant-1",
    stock: { warehouseId: "main-warehouse", onHandQuantity: 3, reservedQuantity: 0, safetyStockQuantity: 0 },
  });

  assert.equal(JSON.stringify(createdCollection.data.mediaAssetIds), JSON.stringify(["media-1"]));
  assert.equal(JSON.stringify(appendedCollection.data.mediaAssetIds), JSON.stringify(["media-1"]));

  calls.forEach((call) => assertScopedPath(call.path));

  for (const call of calls.filter((item) => typeof item.body === "string")) {
    const payload = JSON.parse(call.body);
    assert.equal(payload.organizationId, context.organizationId, call.path);
    assert.equal(payload.shopId, context.shopId, call.path);
  }

  for (const call of calls.filter((item) => typeof item.body === "string" && item.path.includes("/prices"))) {
    const payload = JSON.parse(call.body);
    assert.equal(payload.tax.taxCode, "BIKE_STANDARD", call.path);
    assert.equal(payload.tax.calculationType, "PERCENTAGE", call.path);
    assert.equal(payload.tax.rate, 0.21, call.path);
  }

  for (const call of calls.filter((item) => item.body && typeof item.body.get === "function")) {
    assert.equal(call.body.get("organizationId"), context.organizationId, call.path);
    assert.equal(call.body.get("shopId"), context.shopId, call.path);
  }
});

test("product editor local drafts are keyed by active Admin context", () => {
  const source = readFileSync(path.resolve(root, "src/modules/catalogo/product-editor-client.tsx"), "utf8");

  assert.match(source, /ecommium-product-draft:v4:\$\{contextIdentity\}/);
  assert.match(source, /const editorInstanceKey = `\$\{contextIdentity\}:/);
  assert.match(source, /<ProductEditorClientInner\s+key=\{editorInstanceKey\}/);
  assert.match(source, /result\.blocks\.variants === "success"[\s\S]*setVariantMessage\(null\)/);
  assert.match(source, /updateSelectedPanelPrice/);
  assert.match(source, /netMinorFromPrice\(selectedPanelPrice, selectedPanelTax\)/);
  assert.match(source, /grossMinorFromPrice\(selectedPanelPrice, selectedPanelTax\)/);
  assert.doesNotMatch(source, /Override de variante adicional/);
  assert.match(source, /productSavingOverlay/);
  assert.match(source, /productSavingRing/);
  assert.match(source, /Guardando producto/);
  assert.match(source, /Añadir imagen/);
  assert.match(source, /onRemove=\{removeMedia\}/);
  assert.match(source, /Trash2/);
  assert.match(source, /effectiveVariantImage\(draft, variantKey\)/);
  assert.match(source, /\{ id: "audit", label: "Auditoria" \}/);
  assert.match(source, /activeTab === "audit"/);
  assert.match(source, /draft\.clientDraftId/);
  assert.match(source, /Precios fijados del producto y variantes/);
  assert.match(source, /Resumen de Routing y SEO/);
  assert.doesNotMatch(source, /productAuditPanel|Operacion de guardado|Correlacion BFF/);
  assert.match(source, /fieldErrorSummary\(report\.fieldErrors\)/);
  assert.doesNotMatch(source, /auditProductAction/);
  assert.doesNotMatch(source, /\/admin\/products\/\$\{[^}]+}\}\/audit/);
});

test("product list exposes only backed actions and opens local preview through editor", () => {
  const listSource = readFileSync(path.resolve(root, "src/modules/catalogo/product-list-page.tsx"), "utf8");
  const routeSource = readFileSync(path.resolve(root, "app/(admin)/admin/products/[productId]/page.tsx"), "utf8");
  const pageSource = readFileSync(path.resolve(root, "src/modules/catalogo/product-editor-page.tsx"), "utf8");
  const editorSource = readFileSync(path.resolve(root, "src/modules/catalogo/product-editor-client.tsx"), "utf8");

  assert.match(listSource, /export function normalizeProductListColumns/);
  assert.match(listSource, /href=\{`\/admin\/products\/\$\{product\.productId\}\?preview=1`\}/);
  assert.match(listSource, /href=\{`\/admin\/products\/new\?duplicateFrom=\$\{encodeURIComponent\(product\.productId\)\}`\}/);
  assert.match(listSource, /action=\{deactivateProductAction\}/);
  assert.match(listSource, /action=\{bulkDeactivateProductsAction\}/);
  assert.match(listSource, /name="productIds"/);
  assert.match(listSource, /confirmBulkDeactivate/);
  assert.match(listSource, /Confirmo la desactivacion/);
  assert.match(listSource, /Confirmo la desactivacion agrupada/);
  assert.match(listSource, /Desactivar de forma segura/);
  assert.doesNotMatch(listSource, /Proceso UI Productos 3\.2/);
  assert.doesNotMatch(listSource, /MoreVertical/);
  assert.match(routeSource, /initialPreviewOpen=\{query\?\.preview === "1"\}/);
  assert.match(pageSource, /initialPreviewOpen = false/);
  assert.match(editorSource, /const \[previewOpen, setPreviewOpen\] = useState\(initialPreviewOpen\)/);
  assert.match(editorSource, /function ProductSaveDecision/);
  assert.match(editorSource, /validateProductPublicationReadiness\(savingDraft\)/);
  assert.match(editorSource, /Guardar borrador/);
  assert.match(editorSource, /Producto preparado para publicar/);
  assert.doesNotMatch(editorSource, /variantFilterQuery/);
  assert.doesNotMatch(editorSource, /function applyVariantBulkAction/);
  assert.match(editorSource, /draft\.variants\.map/);
  assert.match(editorSource, /function handleRecoveryAction/);
  assert.match(editorSource, /recoveryActionShouldRetry/);
  assert.match(editorSource, /Continuar editando/);
  assert.doesNotMatch(editorSource, /<span className="adminBadge adminBadgeWarn" key=\{`\$\{action\.code\}/);
});

test("editor base price never takes the identity of a specific VIP rule returned first", async () => {
  const { getAdminProductEditorData } = loadProductsModule(async (endpoint, options) => {
    if (endpoint.includes('/editor-state?')) return ok({
      product: { productId:'p',name:'QA' }, variants: [],
      prices:{ product:{items:[
        {pricingId:'vip-rule',targetType:'PRODUCT',basePrice:{amountMinor:12100,currency:'EUR'},fixedPrice:{amountMinor:9900,currency:'EUR'},customerGroup:'vip',source:'FIXED',active:true},
        {pricingId:'base-price',targetType:'PRODUCT',basePrice:{amountMinor:12100,currency:'EUR'},source:'BASE',active:true},
      ]}, specificPrices:[] },
    }, options);
    throw Error('Unexpected endpoint');
  });
  const result = await getAdminProductEditorData(context,'p');
  assert.equal(result.ok,true);
  assert.equal(result.data.productPrice.pricingId,'base-price');
  assert.equal(result.data.productPrice.customerGroup,null);
});

test("editor retains legacy contextual BASE table identities, amounts and hidden metadata", async () => {
  const legacy = {
    pricingId: "legacy-base", targetType: "PRODUCT", productId: "p", source: "BASE", active: true,
    basePriceMinor: 2000, currency: "EUR", taxIncluded: true,
    priceTableId: "legacy-table", country: "FR", channel: "marketplace", tradePolicy: "b2b", customerGroup: "VIP",
    validFrom: "2026-01-01T00:00:00Z", validUntil: "2027-01-01T00:00:00Z", timezone: "Europe/Madrid", priority: 37,
  };
  const { getAdminProductEditorData } = loadProductsModule(async (endpoint, options) => {
    if (endpoint.includes("/editor-state?")) return ok({
      product: { productId: "p", name: "Legacy" }, variants: [],
      prices: { product: [legacy], variants: [{ ...legacy, pricingId: "legacy-own", targetType: "VARIANT", variantId: "v", basePriceMinor: 3500 }] },
    }, options);
    throw Error("Unexpected endpoint");
  });
  const result = await getAdminProductEditorData(context, "p");
  assert.equal(result.ok, true);
  assert.equal(result.data.productPrice, undefined);
  assert.equal(result.data.variantPrices.v, undefined);
  assert.equal(result.data.specificPrices.length, 2);
  const preserved = result.data.specificPrices.find(price => price.pricingId === 'legacy-base');
  for (const key of ['pricingId','basePriceMinor','currency','taxIncluded','priceTableId','country','channel','tradePolicy','customerGroup','validFrom','validUntil','priority','source']) {
    assert.equal(preserved[key], legacy[key], key);
  }
  assert.equal(preserved.dirty, false);

});

test('normal price create/update never adds selectors from Admin defaults',async()=>{
 const calls=[];const {makeProductGateway}=loadProductsModule(async(path,options)=>{calls.push(JSON.parse(options.init.body));return ok({pricingId:'regular'},options);});
 const gateway=makeProductGateway(context);const price={priceKind:'REGULAR',source:'BASE',basePriceMinor:0,currency:'GBP',taxIncluded:false};
 await gateway.createProductPrice({productId:'p',price});await gateway.updatePrice({pricingId:'regular',price});
 for(const body of calls){assert.equal(body.priceKind,'REGULAR');assert.equal(body.currency,'GBP');assert.equal(body.basePriceMinor,0);for(const key of ['tradePolicy','channel','country','priceTableId','customerGroup'])assert.equal(body[key],null);}
});


test("price preview omits missing market dimensions instead of fabricating ES web EUR default", async () => {
  let requested;
  const { makeProductGateway } = loadProductsModule(async (endpoint, options) => {
    requested = new URL(endpoint, "http://bff.test");
    return ok({}, options);
  });
  await makeProductGateway({ ...context, currency: undefined, country: undefined, channel: undefined })
    .previewAppliedPrice({ productId: "p" });
  for (const key of ["currency", "country", "channel", "tradePolicy"]) {
    assert.equal(requested.searchParams.has(key), false, key);
  }
});

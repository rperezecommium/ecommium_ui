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

function loadProductsModule(requestBff) {
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
      if (specifier.endsWith("/shared/bff/client")) {
        return { requestBff };
      }
      if (specifier === "./catalog-taxonomy") {
        return {
          listCatalogEntities: async () => ({ items: [], total: 0, source: "bff" }),
          toLookupOptions: () => [],
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
  const requestBff = async (pathValue, options = {}) => {
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
        }],
        total: 1,
      }, options);
    }
    if (pathValue.startsWith("/admin/prices?")) {
      return ok({ items: [{ pricingId: "price-1", basePriceMinor: 1299, currency: "EUR", taxIncluded: true }] }, options);
    }
    if (pathValue.startsWith("/admin/inventory/availability/resolve-batch?")) {
      return ok({ items: [{ variantId: "variant-1", onHandQuantity: 7, reservedQuantity: 0, safetyStockQuantity: 1 }] }, options);
    }
    if (pathValue.startsWith("/admin/products/product-1/editor-state?")) {
      return ok({
        product: { productId: "product-1", name: "Producto Barcelona", slug: "producto-barcelona", isActive: false, isVisible: true },
        variants: [{ variantId: "variant-1", refId: "PRODUCTO-BARCELONA", isActive: true, isVisible: true, isDefault: true }],
        prices: { items: [] },
        availability: { items: [] },
      }, options);
    }
    if (pathValue.startsWith("/admin/offerings/variants/resolve-batch?")) {
      return ok({ variants: [] }, options);
    }

    throw new Error(`Unexpected BFF path: ${pathValue}`);
  };
  const { getAdminProducts, getAdminProductEditorData } = loadProductsModule(requestBff);

  await getAdminProducts(context, { limit: 20, offset: 0 });
  await getAdminProductEditorData(context, "product-1");

  assert.equal(calls.some((call) => call.path.startsWith("/inventory/")), false);
  assert.ok(calls.some((call) => call.path.startsWith("/admin/inventory/availability/resolve-batch?")));
  assert.ok(calls.some((call) => call.path.startsWith("/admin/products/product-1/editor-state?")));
  assert.equal(calls.every((call) => call.path.startsWith("/admin/")), true);
  calls.forEach((call) => assertScopedPath(call.path));
});

test("product gateway sends organizationId and shopId on related Admin BFF paths", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
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
  const { makeProductGateway } = loadProductsModule(requestBff);
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
  assert.match(source, /Precio del producto \/ defaultVariant/);
  assert.match(source, /Variante adicional a editar/);
  assert.match(source, /productVariantDefault se gestiona con el precio superior/);
  assert.match(source, /Editar precio de/);
  assert.match(source, /productSavingOverlay/);
  assert.match(source, /productSavingRing/);
  assert.match(source, /Guardando producto/);
  assert.match(source, /Anadir imagenes/);
  assert.match(source, /productMediaDeleteButton/);
  assert.match(source, /Trash2/);
  assert.match(source, /onClick=\{\(\) => removeMedia\(item\.localId\)\}/);
  assert.match(source, /assigned\.length[\s\S]*draft\.media\.items\.filter\(\(item\) => item\.isMain\)\.slice\(0, 1\)/);
  assert.match(source, /Usar stock propio/);
  assert.match(source, /Heredar default/);
  assert.match(source, /Stock propio guardado/);
  assert.match(source, /Inventory no expone borrado de stock persistido todavia/);
  assert.match(source, /Variantes heredando/);
  assert.match(source, /disabled=\{!hasOwnStock\}/);
});

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

function loadStockAdminModule(productsModule) {
  const source = readFileSync(path.resolve(root, "src/modules/catalogo/stock-admin.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const commonJsExports = {};
  const moduleContext = {
    console,
    exports: commonJsExports,
    module: { exports: commonJsExports },
    require(specifier) {
      if (specifier === "./products") {
        return productsModule;
      }
      throw new Error(`Unexpected test require: ${specifier}`);
    },
  };

  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
}

test("stock admin lists products through existing product BFF composition", async () => {
  const calls = [];
  const stockAdmin = loadStockAdminModule({
    async getAdminProducts(receivedContext, filters) {
      calls.push({ receivedContext, filters });
      return { items: [], total: 0, limit: filters.limit, offset: filters.offset, source: "bff" };
    },
  });

  await stockAdmin.getStockAdminProducts(context, { q: "bike", status: "active", limit: 10, offset: 5 });

  assert.equal(calls[0].receivedContext, context);
  assert.equal(calls[0].filters.q, "bike");
  assert.equal(calls[0].filters.isActive, true);
  assert.equal(calls[0].filters.limit, 10);
  assert.equal(calls[0].filters.offset, 5);
});

test("stock admin maps product editor state into editable stock rows", async () => {
  const stockAdmin = loadStockAdminModule({
    async getAdminProductEditorData() {
      return {
        ok: true,
        data: {
          product: { productId: "product-1", name: "Bike", slug: "bike", isActive: true, isVisible: true, defaultVariantId: "variant-1" },
          variantRows: [{
            variantId: "variant-1",
            role: "PRODUCT_DEFAULT",
            isDefault: true,
            isVisible: true,
            isActive: true,
            refId: "BIKE-1",
            name: "Bike",
            displayLabel: "Bike default",
            selectorLabel: "Bike default",
            directMediaCount: 0,
            effectiveMediaSource: "NONE",
          }],
          stockByVariant: {
            "variant-1": {
              warehouseId: "main-warehouse",
              onHandQuantity: 7,
              reservedQuantity: 2,
              safetyStockQuantity: 1,
            },
          },
          warnings: [],
          correlationIds: ["corr-editor"],
        },
        correlationId: "corr-editor",
      };
    },
  });

  const result = await stockAdmin.getStockAdminProductDetail(context, "product-1");

  assert.equal(result.ok, true);
  assert.equal(result.data.rows[0].variantId, "variant-1");
  assert.equal(result.data.rows[0].availableQuantity, 4);
  assert.equal(result.data.rows[0].available, true);
});

test("stock admin updates stock through product gateway putStockLevel", async () => {
  const calls = [];
  const stockAdmin = loadStockAdminModule({
    makeProductGateway(receivedContext) {
      return {
        putStockLevel(input) {
          calls.push({ receivedContext, input });
          return Promise.resolve({ ok: true, data: { ...input.stock, availableQuantity: 3 }, status: 200, correlationId: "corr-stock" });
        },
      };
    },
  });

  const result = await stockAdmin.updateStockLevel(context, {
    variantId: "variant-1",
    stock: {
      warehouseId: "main-warehouse",
      onHandQuantity: 5,
      reservedQuantity: 1,
      safetyStockQuantity: 1,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(calls[0].receivedContext, context);
  assert.equal(calls[0].input.variantId, "variant-1");
  assert.equal(calls[0].input.stock.onHandQuantity, 5);
});

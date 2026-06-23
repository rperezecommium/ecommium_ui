import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(new URL("..", import.meta.url).pathname);

function loadPricingAdminModule(requestBff) {
  const source = readFileSync(path.resolve(root, "src/modules/catalogo/pricing-admin.ts"), "utf8");
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
    encodeURIComponent,
    exports: commonJsExports,
    module: { exports: commonJsExports },
    require(specifier) {
      if (specifier.endsWith("/shared/bff/client")) {
        return { requestBff };
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

test("pricing governance uses scoped BFF endpoints and maps read 403 permissions", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method ?? "GET" });

    if (pathValue.startsWith("/admin/pricing/taxes?")) {
      return { ok: false, status: 403, error: "Forbidden" };
    }

    const raw = pathValue.includes("/price-tables?")
      ? { items: [{ priceTableId: "default", name: "Default", active: true }] }
      : pathValue.includes("/rules?")
        ? { items: [{ ruleId: "rule-1", active: true, priority: 10 }] }
        : pathValue.includes("/fixed?")
          ? { items: [{ itemId: "item-1", priceTableId: "default", basePriceMinor: 1234 }] }
          : pathValue.includes("/pipeline/catalog?")
            ? { items: [{ priceTableId: "default", active: true }] }
            : { itemId: "item-1", priceTableId: "default", grossMinor: 1499 };

    return {
      ok: true,
      data: options.parse ? options.parse(raw) : raw,
    };
  };
  const { getPricingGovernanceData } = loadPricingAdminModule(requestBff);

  const data = await getPricingGovernanceData(context, {
    tab: "computed",
    priceTableId: "default",
    itemId: "item-1",
  });

  assert.equal(data.taxes.source, "unavailable");
  assert.equal(data.taxes.message, "Falta permiso pricing.admin.read.");
  assert.equal(calls.every((call) => call.path.includes("organizationId=org-1")), true);
  assert.equal(calls.every((call) => call.path.includes("shopId=shop-1")), true);
  assert.ok(calls.some((call) => call.path === "/admin/pricing/config?organizationId=org-1&shopId=shop-1"));
  assert.ok(calls.some((call) => call.path === "/admin/pricing/prices/computed/default/resolve-batch?organizationId=org-1&shopId=shop-1" && call.method === "POST"));
  assert.ok(calls.some((call) => call.path === "/admin/pricing/prices/computed-auto/resolve-batch?organizationId=org-1&shopId=shop-1" && call.method === "POST"));
});

test("pricing editor lookups preserve complete tax rules and collapse duplicates", async () => {
  const requestBff = async (pathValue, options = {}) => {
    const raw = pathValue.startsWith("/admin/pricing/taxes?")
      ? {
          items: [
            {
              taxId: "tax-1",
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
            {
              taxId: "tax-2",
              taxCode: "BIKE_STANDARD",
              name: "Bike VAT Included",
              calculationType: "PERCENTAGE",
              rate: 0.21,
              amountMinor: null,
              isCompound: false,
              isActive: true,
              validFrom: "2025-02-01T00:00:00.000Z",
              validUntil: null,
            },
            {
              taxId: "tax-3",
              taxCode: "BIKE_REDUCED",
              name: "Bike Reduced",
              calculationType: "PERCENTAGE",
              rate: 0.1,
              amountMinor: null,
              isCompound: false,
              isActive: true,
              validFrom: null,
              validUntil: null,
            },
          ],
        }
      : { items: [{ priceTableId: "default", name: "Default" }] };

    return {
      ok: true,
      data: options.parse ? options.parse(raw) : raw,
    };
  };
  const { getPricingEditorLookups } = loadPricingAdminModule(requestBff);

  const lookups = await getPricingEditorLookups(context);

  assert.equal(lookups.taxes.length, 2);
  assert.equal(JSON.stringify(lookups.taxes.map((tax) => [tax.taxCode, tax.calculationType, tax.rate])), JSON.stringify([
    ["BIKE_STANDARD", "PERCENTAGE", 0.21],
    ["BIKE_REDUCED", "PERCENTAGE", 0.1],
  ]));
  assert.equal(lookups.taxes[0].id, "tax-1");
  assert.match(lookups.taxes[0].label, /21/);
});

test("pricing editor lookups infer percentage taxes from partial BFF records", async () => {
  const requestBff = async (pathValue, options = {}) => {
    const raw = pathValue.startsWith("/admin/pricing/taxes?")
      ? {
          items: [
            {
              taxCode: "standard",
              name: "Standard",
              rate: 0.21,
            },
          ],
        }
      : { items: [{ priceTableId: "default", name: "Default" }] };

    return {
      ok: true,
      data: options.parse ? options.parse(raw) : raw,
    };
  };
  const { getPricingEditorLookups } = loadPricingAdminModule(requestBff);

  const lookups = await getPricingEditorLookups(context);

  assert.equal(lookups.taxes.length, 1);
  assert.equal(lookups.taxes[0].taxCode, "standard");
  assert.equal(lookups.taxes[0].calculationType, "PERCENTAGE");
  assert.equal(lookups.taxes[0].rate, 0.21);
});

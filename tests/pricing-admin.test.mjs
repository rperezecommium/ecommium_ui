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

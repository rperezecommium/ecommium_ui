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

test("pricing governance lives under configuration navigation with catalog redirect compatibility", () => {
  const shellSource = readFileSync(path.resolve(root, "src/app-shell/admin-shell.tsx"), "utf8");
  const catalogPageSource = readFileSync(path.resolve(root, "app/(admin)/admin/catalogo/page.tsx"), "utf8");
  const configurationPageSource = readFileSync(path.resolve(root, "app/(admin)/admin/configuracion/page.tsx"), "utf8");
  const pricingPageSource = readFileSync(path.resolve(root, "src/modules/catalogo/pricing-admin-page.tsx"), "utf8");
  const oldRouteSource = readFileSync(path.resolve(root, "app/(admin)/admin/catalogo/precios/page.tsx"), "utf8");

  assert.match(shellSource, /href: "\/admin\/configuracion\/precios"/);
  assert.doesNotMatch(shellSource, /href: "\/admin\/catalogo\/precios", label: "Precios"/);
  assert.doesNotMatch(catalogPageSource, /\/admin\/catalogo\/precios/);
  assert.match(configurationPageSource, /\/admin\/configuracion\/precios/);
  assert.match(pricingPageSource, /Admin \/ Configuracion \/ Precios/);
  assert.match(pricingPageSource, /\/admin\/configuracion\/precios/);
  assert.match(pricingPageSource, /Parametros/);
  assert.match(pricingPageSource, /customer-groups/);
  assert.match(pricingPageSource, /trade-policies/);
  assert.match(oldRouteSource, /redirect\(`\/admin\/configuracion\/precios/);
});

test("pricing governance uses scoped BFF endpoints and maps read 403 permissions", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({
      path: pathValue,
      method: options.init?.method ?? "GET",
      body: options.init?.body ? JSON.parse(options.init.body) : undefined,
    });

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
  assert.ok(calls.some((call) => call.path === "/admin/pricing/customer-groups?organizationId=org-1&shopId=shop-1"));
  assert.ok(calls.some((call) => call.path === "/admin/pricing/channels?organizationId=org-1&shopId=shop-1"));
  assert.ok(calls.some((call) => call.path === "/admin/pricing/trade-policies?organizationId=org-1&shopId=shop-1"));
  assert.ok(calls.some((call) => call.path === "/admin/pricing/countries?organizationId=org-1&shopId=shop-1"));
  assert.ok(calls.some((call) => call.path === "/admin/pricing/prices/computed/default/resolve-batch?organizationId=org-1&shopId=shop-1" && call.method === "POST"));
  assert.ok(calls.some((call) => call.path === "/admin/pricing/prices/computed-auto/resolve-batch?organizationId=org-1&shopId=shop-1" && call.method === "POST"));
  assert.ok(calls.some((call) => call.method === "POST" && JSON.stringify(call.body) === JSON.stringify({ itemIds: ["item-1"] })));
});

test("pricing governance flattens fixed price records for table rendering", async () => {
  const requestBff = async (pathValue, options = {}) => {
    const raw = pathValue.includes("/fixed?")
      ? {
          items: [
            {
              productId: "product-1",
              variantId: "variant-1",
              priceTableId: "vip_table",
              fixedPrice: { amountMinor: 12345, currency: "EUR" },
              basePrice: { amountMinor: 12345, currency: "EUR" },
              listPrice: { amountMinor: 15000, currency: "EUR" },
              currency: "EUR",
              active: true,
            },
          ],
        }
      : pathValue.includes("/price-tables?")
        ? { items: [{ priceTableId: "vip_table", name: "VIP table" }] }
        : { items: [] };

    return {
      ok: true,
      data: options.parse ? options.parse(raw) : raw,
    };
  };
  const { getPricingGovernanceData } = loadPricingAdminModule(requestBff);

  const data = await getPricingGovernanceData(context, {
    tab: "fixed",
    priceTableId: "vip_table",
    itemId: "variant-1",
  });

  assert.equal(data.fixedPrices.data[0].itemId, "variant-1");
  assert.equal(data.fixedPrices.data[0].fixedPriceMinor, 12345);
  assert.equal(data.fixedPrices.data[0].basePriceMinor, 12345);
  assert.equal(data.fixedPrices.data[0].listPriceMinor, 15000);
});

test("pricing governance flattens computed-auto responses for table rendering", async () => {
  const requestBff = async (pathValue, options = {}) => {
    const raw = pathValue.includes("/computed-auto/resolve-batch?")
      ? {
          items: [{
            itemId: "product-1",
            source: "AUTO_TABLE_MATCH",
            appliedPriceTableId: "vip_table",
            price: {
              targetType: "PRODUCT",
              productId: "product-1",
              variantId: null,
              priceTableId: "vip_table",
              currency: "EUR",
              basePrice: { amountMinor: 12345, currency: "EUR" },
              fixedPrice: { amountMinor: 9999, currency: "EUR" },
              resolved: {
                currency: "EUR",
                netAmountMinor: 8264,
                taxAmountMinor: 1735,
                grossAmountMinor: 9999,
              },
              source: "FIXED",
            },
          }],
        }
      : pathValue.includes("/computed-auto?")
        ? {
            source: "AUTO_TABLE_MATCH",
            appliedPriceTableId: "vip_table",
            price: {
              targetType: "PRODUCT",
              productId: "product-1",
              variantId: null,
              priceTableId: "vip_table",
              currency: "EUR",
              basePrice: { amountMinor: 12345, currency: "EUR" },
              fixedPrice: { amountMinor: 9999, currency: "EUR" },
              resolved: {
                currency: "EUR",
                netAmountMinor: 8264,
                taxAmountMinor: 1735,
                grossAmountMinor: 9999,
              },
              source: "FIXED",
            },
          }
        : pathValue.includes("/price-tables?")
          ? { items: [{ priceTableId: "vip_table", name: "VIP table" }] }
          : { items: [] };

    return {
      ok: true,
      data: options.parse ? options.parse(raw) : raw,
    };
  };
  const { getPricingGovernanceData } = loadPricingAdminModule(requestBff);

  const data = await getPricingGovernanceData(context, {
    tab: "computed-auto",
    itemId: "product-1",
  });

  assert.equal(data.computedAuto.data.itemId, "product-1");
  assert.equal(data.computedAuto.data.priceTableId, "vip_table");
  assert.equal(data.computedAuto.data.netMinor, 8264);
  assert.equal(data.computedAuto.data.taxMinor, 1735);
  assert.equal(data.computedAuto.data.grossMinor, 9999);
  assert.equal(data.computedAutoBatch.data[0].itemId, "product-1");
  assert.equal(data.computedAutoBatch.data[0].source, "AUTO_TABLE_MATCH");
});

test("pricing governance forwards commercial context to computed-auto endpoints", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({
      path: pathValue,
      method: options.init?.method ?? "GET",
    });

    return {
      ok: true,
      data: options.parse ? options.parse(pathValue.includes("resolve-batch") ? { items: [] } : {}) : {},
    };
  };
  const { getPricingGovernanceData } = loadPricingAdminModule(requestBff);

  await getPricingGovernanceData(context, {
    tab: "computed-auto",
    itemId: "variant-1",
    currency: "USD",
    country: "ES",
    channel: "web",
    tradePolicy: "b2c",
    customerGroup: "vip",
    quantity: "2",
  });

  assert.ok(calls.some((call) =>
    call.path === "/admin/pricing/prices/variant-1/computed-auto?organizationId=org-1&shopId=shop-1&currency=USD&country=ES&tradePolicy=b2c&channel=web&customerGroup=vip&quantity=2"
  ));
  assert.ok(calls.some((call) =>
    call.path === "/admin/pricing/prices/computed-auto/resolve-batch?organizationId=org-1&shopId=shop-1&currency=USD&country=ES&tradePolicy=b2c&channel=web&customerGroup=vip&quantity=2" &&
    call.method === "POST"
  ));
});

test("fixed prices UI sends the canonical BFF payload fields", () => {
  const pageSource = readFileSync(path.resolve(root, "src/modules/catalogo/pricing-admin-page.tsx"), "utf8");
  const actionsSource = readFileSync(path.resolve(root, "src/modules/catalogo/pricing-admin-actions.ts"), "utf8");

  assert.match(pageSource, /name="productId"/);
  assert.match(pageSource, /name="fixedPriceMinor"/);
  assert.match(pageSource, /name="timezone"/);
  assert.match(pageSource, /placeholder="variantId"/);
  assert.match(pageSource, /"fixedPriceMinor"/);
  assert.match(actionsSource, /const productId = asString\(formData\.get\("productId"\)\)/);
  assert.match(actionsSource, /const fixedPriceMinor = asNumber\(formData\.get\("fixedPriceMinor"\)\)/);
  assert.match(actionsSource, /productId,/);
  assert.match(actionsSource, /fixedPriceMinor,/);
  assert.match(actionsSource, /timezone:/);
  assert.doesNotMatch(actionsSource, /Falta itemId o priceTableId\./);
});

test("price table row actions stay compact in one line", () => {
  const pageSource = readFileSync(path.resolve(root, "src/modules/catalogo/pricing-admin-page.tsx"), "utf8");
  const cssSource = readFileSync(path.resolve(root, "app/globals.css"), "utf8");

  assert.match(pageSource, /className="pricingPriceTableActions"/);
  assert.match(pageSource, /className="pricingPriceTableActivationForm"/);
  assert.match(pageSource, /className="pricingPriceTableDeleteForm"/);
  assert.match(pageSource, /maxLength=\{6\}/);
  assert.doesNotMatch(pageSource, /<div className="pricingActionStack">\s*<form action={updatePriceTableActivationAction} className="pricingInlineForm"/);
  assert.match(cssSource, /\.pricingPriceTableActions[\s\S]*?flex-wrap: nowrap;/);
  assert.match(cssSource, /\.pricingPriceTableActions \.adminButton[\s\S]*?width: 100px;/);
  assert.match(cssSource, /\.pricingPriceTableDeleteForm input[\s\S]*?width: 76px;/);
});

test("pricing editor lookups preserve complete tax rules and collapse duplicates", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push(pathValue);
    let raw;

    if (pathValue.startsWith("/admin/pricing/taxes?")) {
      raw = {
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
      };
    } else if (pathValue.startsWith("/admin/pricing/price-tables?")) {
      raw = { items: [{ priceTableId: "vip-table", name: "VIP table" }] };
    } else if (pathValue.startsWith("/admin/pricing/customer-groups?")) {
      raw = { items: [{ code: "vip", name: "VIP" }] };
    } else if (pathValue.startsWith("/admin/pricing/channels?")) {
      raw = { items: [{ code: "web", name: "Web" }, { code: "marketplace", name: "Marketplace" }] };
    } else if (pathValue.startsWith("/admin/pricing/trade-policies?")) {
      raw = { items: [{ code: "default", name: "Default" }] };
    } else if (pathValue.startsWith("/admin/pricing/countries?")) {
      raw = { items: [{ code: "ES", name: "Espana" }] };
    } else {
      raw = { items: [] };
    }

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
  assert.deepEqual(lookups.priceTables.map((item) => item.id), ["vip-table"]);
  assert.deepEqual(lookups.customerGroups.map((item) => item.id), ["vip"]);
  assert.deepEqual(lookups.channels.map((item) => item.id), ["web", "marketplace"]);
  assert.deepEqual(lookups.tradePolicies.map((item) => item.id), ["default"]);
  assert.deepEqual(lookups.countries.map((item) => item.id), ["ES"]);
  assert.ok(calls.some((call) => call === "/admin/pricing/customer-groups?organizationId=org-1&shopId=shop-1"));
  assert.ok(calls.some((call) => call === "/admin/pricing/channels?organizationId=org-1&shopId=shop-1"));
  assert.ok(calls.some((call) => call === "/admin/pricing/trade-policies?organizationId=org-1&shopId=shop-1"));
  assert.ok(calls.some((call) => call === "/admin/pricing/countries?organizationId=org-1&shopId=shop-1"));
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

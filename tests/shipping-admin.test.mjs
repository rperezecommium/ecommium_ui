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

function loadShippingAdminModule(requestBff) {
  const source = readFileSync(path.resolve(root, "src/modules/transporte/shipping-admin.ts"), "utf8");
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
    correlationId: "corr-test",
  };
}

function assertScopedPath(pathValue) {
  assert.match(pathValue, /[?&]organizationId=org-barcelona(?:&|$)/);
  assert.match(pathValue, /[?&]shopId=shop-barcelona(?:&|$)/);
}

test("shipping admin reads configuration through scoped Admin BFF", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method ?? "GET" });
    assert.equal(pathValue.startsWith("/admin/shipping/configuration?"), true);
    return ok({
      organizationId: context.organizationId,
      shopId: context.shopId,
      zones: [{ zoneId: "zone-es", name: "Espana", countries: ["ES"], states: [], postalCodePrefixes: [], active: true }],
      carriers: [{ carrierId: "carrier-standard", name: "Standard", trackingUrlTemplate: null, logoUrl: null, active: true }],
      carrierServices: [],
      rateRules: [],
    }, options);
  };
  const { getShippingAdminData } = loadShippingAdminModule(requestBff);

  const data = await getShippingAdminData(context, { tab: "summary", includeInactive: false });

  assert.equal(data.configuration.source, "bff");
  assert.equal(data.quote, null);
  assert.equal(data.configuration.data.zones[0].zoneId, "zone-es");
  assert.equal(data.configuration.data.carriers[0].carrierId, "carrier-standard");
  assert.equal(calls.length, 1);
  assertScopedPath(calls[0].path);
  assert.match(calls[0].path, /[?&]includeInactive=false(?:&|$)/);
});

test("shipping admin quote simulator posts to shipping options through BFF", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method ?? "GET", body: options.init?.body });

    if (pathValue.startsWith("/admin/shipping/configuration?")) {
      return ok({
        organizationId: context.organizationId,
        shopId: context.shopId,
        zones: [],
        carriers: [],
        carrierServices: [],
        rateRules: [],
      }, options);
    }

    if (pathValue.startsWith("/shipping/options/resolve?")) {
      return ok({
        organizationId: context.organizationId,
        shopId: context.shopId,
        currency: "EUR",
        selectedAddress: {
          postalCode: "28001",
          city: "Madrid",
          state: "MD",
          country: "ES",
        },
        logisticsInfo: [{
          itemIndex: 0,
          itemId: "variant-1",
          selectedSla: "standard",
          selectedDeliveryChannel: "delivery",
          shipsTo: ["ES"],
          slas: [{
            id: "standard",
            carrierId: "carrier-standard",
            carrierServiceId: "standard-service",
            name: "Standard",
            deliveryChannel: "delivery",
            shippingEstimate: "3-5bd",
            priceMinor: 499,
            taxMinor: 105,
            totalMinor: 604,
            warehouseId: "main-warehouse",
          }],
        }],
        calculatedAt: "2026-06-23T12:00:00.000Z",
      }, options);
    }

    throw new Error(`Unexpected BFF path: ${pathValue}`);
  };
  const { getShippingAdminData } = loadShippingAdminModule(requestBff);

  const data = await getShippingAdminData(context, {
    tab: "quote",
    quoteRequested: true,
    postalCode: "28001",
    city: "Madrid",
    state: "MD",
    country: "ES",
    variantId: "variant-1",
    quantity: "2",
    priceMinor: "4000",
    weightGrams: "1500",
  });

  const quoteCall = calls.find((call) => call.path.startsWith("/shipping/options/resolve?"));
  assert.ok(quoteCall);
  assert.equal(quoteCall.method, "POST");
  assertScopedPath(quoteCall.path);
  const body = JSON.parse(quoteCall.body);
  assert.equal(body.selectedAddress.postalCode, "28001");
  assert.equal(body.items[0].variantId, "variant-1");
  assert.equal(body.items[0].quantity, 2);
  assert.equal(body.items[0].weightGrams, 1500);
  assert.equal(data.quote.source, "bff");
  assert.equal(data.quote.data.logisticsInfo[0].slas[0].carrierId, "carrier-standard");
});

test("shipping admin mutations use PUT through scoped Admin BFF", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method, body: options.init?.body });
    return ok({ carrierId: "carrier-standard", active: false }, options);
  };
  const { mutateShipping } = loadShippingAdminModule(requestBff);

  await mutateShipping(
    context,
    "/admin/shipping/carriers?organizationId=org-barcelona&shopId=shop-barcelona",
    {
      carrier: {
        carrierId: "carrier-standard",
        name: "Standard",
        trackingUrlTemplate: null,
        logoUrl: null,
        active: false,
      },
    },
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "PUT");
  assertScopedPath(calls[0].path);
  assert.equal(JSON.parse(calls[0].body).carrier.carrierId, "carrier-standard");
  assert.equal(JSON.parse(calls[0].body).carrier.active, false);
});

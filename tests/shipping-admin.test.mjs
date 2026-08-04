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

function loadShippingActionsModule({
  transitionShippingFulfillment,
  getAdminContext = async () => context,
  revalidatePath = () => undefined,
  redirect = (url) => {
    throw Object.assign(new Error("redirect"), { url });
  },
}) {
  const source = readFileSync(path.resolve(root, "src/modules/transporte/shipping-admin-actions.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const commonJsExports = {};
  const moduleContext = {
    FormData,
    URLSearchParams,
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
      if (specifier === "./shipping-admin" || specifier.endsWith("/transporte/shipping-admin")) {
        return {
          shippingFulfillmentStatuses: ["PENDING_FULFILLMENT", "READY_TO_PICK", "PICKING", "PACKED", "SHIPPED", "DELIVERED", "FAILED"],
          mutateShipping: async () => ({ ok: true }),
          patchShippingActive: async () => ({ ok: true }),
          transitionShippingFulfillment,
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

test("shipping admin hides fulfillment from configuration tabs", () => {
  const pageSource = readFileSync(path.resolve(root, "src/modules/transporte/shipping-admin-page.tsx"), "utf8");
  const tabsSource = pageSource.slice(pageSource.indexOf("const tabs:"), pageSource.indexOf("function tabHref"));

  assert.doesNotMatch(tabsSource, /fulfillments/);
  assert.doesNotMatch(tabsSource, /Fulfillments/);
  assert.match(pageSource, /activeTab === "fulfillments"/);
});

test("shipping admin loads only the fulfillment queue when its tab is active", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method ?? "GET" });
    assert.equal(pathValue.startsWith("/admin/shipping/fulfillments?"), true);
    return ok({ items: [], total: 0, limit: 25, offset: 50 }, options);
  };
  const { getShippingAdminData } = loadShippingAdminModule(requestBff);

  const data = await getShippingAdminData(context, {
    tab: "fulfillments",
    fulfillmentStatus: "PACKED",
    fulfillmentsLimit: 25,
    fulfillmentsOffset: 50,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "GET");
  assertScopedPath(calls[0].path);
  assert.match(calls[0].path, /[?&]status=PACKED(?:&|$)/);
  assert.match(calls[0].path, /[?&]limit=25(?:&|$)/);
  assert.match(calls[0].path, /[?&]offset=50(?:&|$)/);
  assert.equal(data.configuration.source, "bff");
  assert.equal(data.configuration.data.carriers.length, 0);
  assert.equal(data.quote, null);
  assert.equal(data.fulfillments.source, "bff");
  assert.equal(data.fulfillments.data.offset, 50);
  assert.equal(data.selectedFulfillment, null);
});

test("shipping admin reads the selected fulfillment alongside its queue", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push(pathValue);
    if (pathValue.startsWith("/admin/shipping/fulfillments?")) {
      return ok({ items: [], total: 1, limit: 25, offset: 0 }, options);
    }
    if (pathValue.startsWith("/admin/shipping/fulfillments/fulfillment-1?")) {
      return ok({
        fulfillmentId: "fulfillment-1",
        version: 1,
        orderId: "order-1",
        orderReference: "#0000001",
        customerId: null,
        organizationId: context.organizationId,
        shopId: context.shopId,
        warehouseId: "warehouse-main",
        dockId: "dock-a",
        carrierId: "carrier-standard",
        status: "PACKED",
        trackingNumber: null,
        trackingUrl: null,
        carrier: null,
        deliveryAddress: null,
        logisticsSnapshot: null,
        items: [],
        createdAt: "2026-07-16T10:00:00.000Z",
        updatedAt: "2026-07-16T10:00:00.000Z",
        shippedAt: null,
        deliveredAt: null,
      }, options);
    }

    throw new Error(`Unexpected BFF path: ${pathValue}`);
  };
  const { getShippingAdminData } = loadShippingAdminModule(requestBff);

  const data = await getShippingAdminData(context, {
    tab: "fulfillments",
    fulfillmentId: "fulfillment-1",
  });

  assert.equal(calls.length, 2);
  assert.ok(calls.some((pathValue) => pathValue.startsWith("/admin/shipping/fulfillments?")));
  assert.ok(calls.some((pathValue) => pathValue.startsWith("/admin/shipping/fulfillments/fulfillment-1?")));
  assert.equal(data.selectedFulfillment.source, "bff");
  assert.equal(data.selectedFulfillment.data.fulfillmentId, "fulfillment-1");
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

test("shipping admin active updates use PATCH through scoped Admin BFF", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method, body: options.init?.body });
    return ok({ carrierId: "carrier-standard", active: false }, options);
  };
  const { patchShippingActive } = loadShippingAdminModule(requestBff);

  await patchShippingActive(
    context,
    "/admin/shipping/carriers/carrier-standard/active?organizationId=org-barcelona&shopId=shop-barcelona",
    false,
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "PATCH");
  assertScopedPath(calls[0].path);
  assert.equal(JSON.parse(calls[0].body).active, false);
});

test("shipping admin lists scoped fulfillments with the exact status and pagination", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method ?? "GET" });
    return ok({
      items: [{
        fulfillmentId: "fulfillment-1",
        version: 2,
        orderId: "order-1",
        orderReference: "#0000001",
        customerId: "customer-1",
        organizationId: context.organizationId,
        shopId: context.shopId,
        warehouseId: "warehouse-main",
        dockId: "dock-a",
        carrierId: "carrier-standard",
        status: "PACKED",
        trackingNumber: null,
        trackingUrl: null,
        carrier: {
          id: "carrier-standard",
          label: "Standard",
          logoUrl: null,
          trackingUrlTemplate: "https://carrier.test/track/{trackingNumber}",
        },
        deliveryAddress: {
          addressType: "residential",
          receiverName: "Ada Lovelace",
          addressId: "address-1",
          isDisposable: false,
          postalCode: "08001",
          city: "Barcelona",
          state: "Barcelona",
          country: "ES",
          street: "Carrer de la Pau",
          number: "1",
          neighborhood: null,
          complement: null,
          reference: null,
          geoCoordinates: [2.17, 41.38],
        },
        logisticsSnapshot: { sourceOrderFormId: "orderform-1", items: [] },
        items: [{
          lineId: "line-1",
          productId: "product-1",
          variantId: "variant-1",
          name: "Bicicleta",
          quantity: 2,
        }],
        createdAt: "2026-07-16T10:00:00.000Z",
        updatedAt: "2026-07-16T11:00:00.000Z",
        shippedAt: null,
        deliveredAt: null,
      }],
      total: 12,
      limit: 25,
      offset: 25,
    }, options);
  };
  const { getShippingFulfillments } = loadShippingAdminModule(requestBff);

  const result = await getShippingFulfillments(context, {
    status: "PACKED",
    limit: 25,
    offset: 25,
  });

  assert.equal(result.source, "bff");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "GET");
  assertScopedPath(calls[0].path);
  assert.match(calls[0].path, /[?&]status=PACKED(?:&|$)/);
  assert.match(calls[0].path, /[?&]limit=25(?:&|$)/);
  assert.match(calls[0].path, /[?&]offset=25(?:&|$)/);
  assert.equal(result.data.total, 12);
  assert.equal(result.data.items[0].carrier.label, "Standard");
  assert.equal(result.data.items[0].deliveryAddress.receiverName, "Ada Lovelace");
  assert.deepEqual(Array.from(result.data.items[0].deliveryAddress.geoCoordinates), [2.17, 41.38]);
});

test("shipping admin reads one fulfillment through BFF and reports its logistic permission", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method ?? "GET" });
    if (pathValue.includes("/fulfillments/denied?")) {
      return {
        ok: false,
        error: "Forbidden",
        status: 403,
        correlationId: "corr-denied",
      };
    }

    return ok({
      fulfillmentId: "fulfillment with spaces",
      version: 1,
      orderId: "order-1",
      orderReference: null,
      customerId: null,
      organizationId: context.organizationId,
      shopId: context.shopId,
      warehouseId: "warehouse-main",
      dockId: "dock-a",
      carrierId: "carrier-standard",
      status: "SHIPPED",
      trackingNumber: "TRACK-1",
      trackingUrl: "https://carrier.test/track/TRACK-1",
      carrier: null,
      deliveryAddress: null,
      logisticsSnapshot: null,
      items: [],
      createdAt: "2026-07-16T10:00:00.000Z",
      updatedAt: "2026-07-16T11:00:00.000Z",
      shippedAt: "2026-07-16T11:00:00.000Z",
      deliveredAt: null,
    }, options);
  };
  const { getShippingFulfillment } = loadShippingAdminModule(requestBff);

  const result = await getShippingFulfillment(context, "fulfillment with spaces");

  assert.equal(result.source, "bff");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "GET");
  assert.match(calls[0].path, /\/admin\/shipping\/fulfillments\/fulfillment%20with%20spaces\?/);
  assertScopedPath(calls[0].path);
  assert.equal(result.data.status, "SHIPPED");
  assert.equal(result.data.trackingNumber, "TRACK-1");

  const denied = await getShippingFulfillment(context, "denied");
  assert.equal(denied.source, "unavailable");
  assert.equal(denied.permission, "shipping.logistics.write");
});

test("shipping admin transitions a fulfillment through the scoped BFF endpoint", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method, body: JSON.parse(options.init?.body ?? "{}") });
    return ok({
      fulfillment: {
        fulfillmentId: "fulfillment-1",
        version: 3,
        orderId: "order-1",
        orderReference: "#0000001",
        customerId: null,
        organizationId: context.organizationId,
        shopId: context.shopId,
        warehouseId: "warehouse-main",
        dockId: "dock-a",
        carrierId: "carrier-standard",
        status: "SHIPPED",
        trackingNumber: "TRACK-1",
        trackingUrl: null,
        carrier: null,
        deliveryAddress: null,
        logisticsSnapshot: null,
        items: [],
        createdAt: "2026-07-16T10:00:00.000Z",
        updatedAt: "2026-07-16T11:00:00.000Z",
        shippedAt: "2026-07-16T11:00:00.000Z",
        deliveredAt: null,
      },
    }, options);
  };
  const { transitionShippingFulfillment } = loadShippingAdminModule(requestBff);

  const result = await transitionShippingFulfillment(context, "fulfillment-1", {
    status: "SHIPPED",
    trackingNumber: "TRACK-1",
    carrierId: "carrier-standard",
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.status, "SHIPPED");
  assert.deepEqual(calls, [{
    path: "/admin/shipping/fulfillments/fulfillment-1/status?organizationId=org-barcelona&shopId=shop-barcelona",
    method: "PATCH",
    body: { status: "SHIPPED", trackingNumber: "TRACK-1", carrierId: "carrier-standard" },
  }]);
});

test("shipping fulfillment action preserves queue context and requires tracking before shipping", async () => {
  const calls = [];
  const { transitionShippingFulfillmentAction } = loadShippingActionsModule({
    transitionShippingFulfillment: async (...args) => {
      calls.push(args);
      return { ok: true, data: {}, status: 200, correlationId: "corr-transition" };
    },
  });
  const formData = new FormData();
  formData.set("fulfillmentId", "fulfillment-1");
  formData.set("status", "SHIPPED");
  formData.set("trackingNumber", "TRACK-1");
  formData.set("carrierId", "carrier-standard");
  formData.set("fulfillmentStatus", "PACKED");
  formData.set("fulfillmentsLimit", "50");
  formData.set("fulfillmentsOffset", "25");

  await assert.rejects(() => transitionShippingFulfillmentAction(formData), {
    url: "/admin/configuracion/transporte?tab=fulfillments&shippingMessage=Estado+log%C3%ADstico+actualizado+a+SHIPPED.&fulfillmentStatus=PACKED&fulfillmentsLimit=50&fulfillmentsOffset=25&fulfillmentId=fulfillment-1",
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0].organizationId, context.organizationId);
  assert.equal(calls[0][1], "fulfillment-1");
  assert.deepEqual({ ...calls[0][2] }, {
    status: "SHIPPED",
    trackingNumber: "TRACK-1",
    carrierId: "carrier-standard",
  });

  const missingTracking = new FormData();
  missingTracking.set("fulfillmentId", "fulfillment-1");
  missingTracking.set("status", "SHIPPED");
  await assert.rejects(() => transitionShippingFulfillmentAction(missingTracking), {
    url: "/admin/configuracion/transporte?tab=fulfillments&shippingMessage=N%C3%BAmero+de+tracking+requerido+para+marcar+como+enviado.&fulfillmentId=fulfillment-1",
  });
  assert.equal(calls.length, 1);
});

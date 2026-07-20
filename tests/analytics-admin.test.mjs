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
  shopName: "Barcelona",
  shopAlias: "barcelona",
  locale: "es-ES",
  currency: "EUR",
  country: "ES",
  channel: "web",
};

function loadModule(requestBff) {
  const source = readFileSync(path.resolve(root, "src/modules/analitica/analytics-admin.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const exports = {};
  const moduleContext = {
    URLSearchParams,
    exports,
    module: { exports },
    require(specifier) {
      if (specifier.endsWith("/shared/bff/client")) return { requestBff };
      if (specifier.endsWith("/shared/config/admin-context")) {
        return { hasRequiredAdminContext: (value) => Boolean(value.organizationId && value.shopId) };
      }
      throw new Error(`Unexpected dependency: ${specifier}`);
    },
  };
  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
}

test("Analytics queries its health, summary and filtered events through the BFF", async () => {
  const calls = [];
  const analytics = loadModule(async (pathValue, options) => {
    calls.push({ pathValue, options });
    const payload = pathValue.includes("/health")
      ? { status: "ok", service: "analytics", databaseConfigured: true }
      : pathValue.includes("/summary")
        ? { totalEvents: 8, uniqueVisitors: 5, eventsByType: { add_to_cart: 3, "purchase-complete": 2 }, revenue: 45.5, purchases: 2, addToCart: 3, conversionRate: 0.4 }
        : { total: 1, limit: 25, offset: 0, events: [{ eventId: "event-1", eventType: "purchase-complete", source: "storefront", context: { locale: "es-ES", country: "ES", channel: "web" }, payload: { orderReference: "ORD-1" }, occurredAt: "2026-07-19T10:00:00.000Z", receivedAt: "2026-07-19T10:00:01.000Z" }] };
    return { ok: true, data: options.parse(payload), status: 200, correlationId: "corr-analytics" };
  });
  const filters = analytics.resolveAnalyticsAdminFilters({ from: "2026-07-01", to: "2026-07-19", eventType: "purchase-complete" });
  const data = await analytics.getAnalyticsAdminData(context, filters);

  assert.equal(calls.length, 3);
  assert.equal(calls[0].pathValue, "/admin/analytics/health");
  assert.match(calls[1].pathValue, /\/admin\/analytics\/reports\/summary\?organizationId=org-barcelona&shopId=shop-barcelona/);
  assert.match(calls[2].pathValue, /eventType=purchase-complete/);
  assert.match(calls[2].pathValue, /from=2026-07-01T00%3A00%3A00.000Z/);
  assert.equal(data.summary.data.revenue, 45.5);
  assert.equal(data.eventGroups.data[0].eventType, "purchase-complete");
  assert.equal(data.eventGroups.data[0].page.events[0].eventId, "event-1");
});

test("Analytics normalizes a safe date range and pagination", () => {
  const analytics = loadModule(async () => ({ ok: false, error: "not used", correlationId: "corr" }));
  const filters = analytics.resolveAnalyticsAdminFilters({ from: "2026-07-20", to: "2026-07-01", limit: "999", offset: "-2", drawer: "event", eventId: "event-1" }, new Date("2026-07-19T12:00:00.000Z"));

  assert.equal(filters.from, "2026-06-20");
  assert.equal(filters.to, "2026-07-19");
  assert.equal(filters.limit, 200);
  assert.equal(filters.offset, 0);
  assert.equal(filters.drawer, "event");
});

test("Analytics creates one paginated query per event type when no type is selected", async () => {
  const calls = [];
  const analytics = loadModule(async (pathValue, options) => {
    calls.push(pathValue);
    const payload = pathValue.includes("/health")
      ? { status: "ok" }
      : pathValue.includes("/summary")
        ? { totalEvents: 3, eventsByType: { "add-to-cart": 1, "purchase-complete": 2 } }
        : { total: 0, limit: 25, offset: 0, events: [] };
    return { ok: true, data: options.parse(payload), status: 200, correlationId: "corr-analytics" };
  });

  const data = await analytics.getAnalyticsAdminData(context, analytics.resolveAnalyticsAdminFilters({
    from: "2026-07-01",
    to: "2026-07-19",
  }));

  assert.equal(data.eventGroups.data.length, 2);
  assert.ok(calls.some((pathValue) => pathValue.includes("eventType=add-to-cart")));
  assert.ok(calls.some((pathValue) => pathValue.includes("eventType=purchase-complete")));
});

test("Analytics page uses a side drawer and keeps technical payload collapsed", () => {
  const page = readFileSync(path.resolve(root, "src/modules/analitica/analytics-admin-page.tsx"), "utf8");
  assert.match(page, /adminDrawerBackdrop analyticsDrawerBackdrop/);
  assert.match(page, /aria-modal="true"/);
  assert.match(page, /<details className="analyticsTechnicalDetails">/);
  assert.match(page, /<summary>Datos técnicos<\/summary>/);
  assert.match(page, /<details className="adminCard analyticsEventGroup"/);
  assert.match(page, /<th>Producto<\/th><th>Cantidad<\/th><th>Precio<\/th><th>Fecha<\/th>/);
  assert.match(page, /<th>Compra<\/th><th>Productos<\/th><th>Importe<\/th><th>Fecha<\/th>/);
  assert.doesNotMatch(page, /customerId/);
  assert.doesNotMatch(page, /visitorId/);
});

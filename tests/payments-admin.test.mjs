import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(new URL("..", import.meta.url).pathname);

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

function loadPaymentsAdminModule(requestBff) {
  const source = readFileSync(path.resolve(root, "src/modules/pagos/payments-admin.ts"), "utf8");
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
    exports: commonJsExports,
    module: { exports: commonJsExports },
    require(specifier) {
      if (specifier.endsWith("/shared/bff/client")) {
        return { requestBff };
      }
      if (specifier.endsWith("/shared/config/admin-context")) {
        return {
          hasRequiredAdminContext(value) {
            return Boolean(value.organizationId && value.shopId);
          },
        };
      }
      return {};
    },
  };

  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
}

function loadPaymentsActionsModule({
  getAdminContext = async () => context,
  redirect = (url) => {
    throw Object.assign(new Error("redirect"), { url });
  },
  requestBff,
  revalidatePath = () => undefined,
}) {
  const source = readFileSync(path.resolve(root, "src/modules/pagos/payments-admin-actions.ts"), "utf8");
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
      if (specifier.endsWith("/shared/bff/client")) {
        return { requestBff };
      }
      if (specifier.endsWith("/shared/config/admin-context")) {
        return { getAdminContext };
      }
      return {};
    },
  };

  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
}

test("payments admin route exposes methods affiliations rules diagnostics and invoices tab", () => {
  const routeSource = readFileSync(path.resolve(root, "app/(admin)/admin/pagos/page.tsx"), "utf8");
  const pageSource = readFileSync(path.resolve(root, "src/modules/pagos/payments-admin-page.tsx"), "utf8");
  const dataSource = readFileSync(path.resolve(root, "src/modules/pagos/payments-admin.ts"), "utf8");
  const actionsSource = readFileSync(path.resolve(root, "src/modules/pagos/payments-admin-actions.ts"), "utf8");

  assert.match(routeSource, /getPaymentsAdminData/);
  assert.match(routeSource, /PaymentsAdminPage/);
  assert.match(pageSource, /Metodos/);
  assert.match(pageSource, /Afiliaciones/);
  assert.match(pageSource, /Reglas/);
  assert.match(pageSource, /Diagnostico/);
  assert.match(pageSource, /Facturas/);
  assert.match(pageSource, /PAN\/CVV/);
  assert.match(dataSource, /\/admin\/payments\/payment-systems/);
  assert.match(dataSource, /\/admin\/payments\/affiliations/);
  assert.match(dataSource, /\/admin\/payments\/rules/);
  assert.match(dataSource, /\/admin\/payments\/card-lookup/);
  assert.match(actionsSource, /createPaymentSystemAction/);
  assert.match(actionsSource, /createPaymentAffiliationAction/);
  assert.match(actionsSource, /createPaymentRuleAction/);
  assert.match(actionsSource, /setPaymentResourceActiveAction/);
  assert.match(actionsSource, /resourcePath/);
  assert.match(pageSource, /Mostrar inactivos/);
  assert.match(pageSource, /Desactivar/);
  assert.match(pageSource, /Reactivar/);
});

test("payments admin capabilities map payments permissions", () => {
  const { getPaymentsAdminCapabilities } = loadPaymentsAdminModule(async () => ({ ok: true, data: {} }));

  const empty = getPaymentsAdminCapabilities(null);
  const viewer = getPaymentsAdminCapabilities({ scope: "admin", permissions: ["admin:payments:view"] });
  const manager = getPaymentsAdminCapabilities({ scope: "admin", permissions: ["payments.manage"] });
  const storefront = getPaymentsAdminCapabilities({ scope: "storefront", permissions: ["payments.manage"] });

  assert.equal(empty.canManagePayments, false);
  assert.equal(empty.canViewPayments, false);
  assert.equal(viewer.canManagePayments, false);
  assert.equal(viewer.canViewPayments, true);
  assert.equal(manager.canManagePayments, true);
  assert.equal(manager.canViewPayments, true);
  assert.equal(storefront.canManagePayments, false);
  assert.equal(storefront.canViewPayments, false);
});

test("payments admin loads payment systems affiliations rules and card lookup through scoped BFF", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({
      body: options.init?.body ? JSON.parse(options.init.body) : undefined,
      method: options.init?.method ?? "GET",
      path: pathValue,
    });
    const raw = pathValue.includes("/payment-systems")
      ? { items: [{ paymentSystemId: "stripe-card", name: "Tarjeta", provider: "stripe", active: true }] }
      : pathValue.includes("/affiliations")
        ? { items: [{ affiliationId: "stripe-main", name: "Stripe", provider: "stripe", active: true }] }
        : pathValue.includes("/rules")
          ? { items: [{ ruleId: "rule-1", name: "Stripe ES", paymentSystemId: "stripe-card", affiliationId: "stripe-main", active: true }] }
          : { bin: "424242", brand: "visa", paymentSystems: [{ paymentSystemId: "stripe-card", name: "Tarjeta", provider: "stripe" }] };
    return { ok: true, data: options.parse ? options.parse(raw) : raw, status: 200, correlationId: "corr-payments" };
  };
  const { getPaymentsAdminData } = loadPaymentsAdminModule(requestBff);

  const data = await getPaymentsAdminData(context, { cardBin: "424242", includeInactive: "true" }, { canManagePayments: true, canViewPayments: true });

  assert.equal(data.paymentSystems.data[0].paymentSystemId, "stripe-card");
  assert.equal(data.affiliations.data[0].affiliationId, "stripe-main");
  assert.equal(data.rules.data[0].ruleId, "rule-1");
  assert.equal(data.cardLookup.data.brand, "visa");
  assert.deepEqual(calls, [
    { path: "/admin/payments/payment-systems?organizationId=org-1&shopId=shop-1&includeInactive=true", method: "GET", body: undefined },
    { path: "/admin/payments/affiliations?organizationId=org-1&shopId=shop-1&includeInactive=true", method: "GET", body: undefined },
    { path: "/admin/payments/rules?organizationId=org-1&shopId=shop-1&includeInactive=true", method: "GET", body: undefined },
    { path: "/admin/payments/card-lookup?organizationId=org-1&shopId=shop-1", method: "POST", body: { bin: "424242" } },
  ]);
});

test("payments admin create actions post canonical scoped payloads", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({
      body: options.init?.body ? JSON.parse(options.init.body) : undefined,
      method: options.init?.method,
      path: pathValue,
    });
    return { ok: true, data: {}, status: 201, correlationId: "corr-payments" };
  };
  const { createPaymentAffiliationAction, createPaymentRuleAction, createPaymentSystemAction } = loadPaymentsActionsModule({ requestBff });
  const method = new FormData();
  method.set("paymentSystemId", "stripe-card");
  method.set("name", "Tarjeta");
  method.set("provider", "stripe");
  method.set("groupName", "cards");
  method.set("methodType", "CREDIT_CARD");
  method.set("supportsInstallments", "on");
  method.set("maxInstallments", "3");
  method.set("active", "on");
  const affiliation = new FormData();
  affiliation.set("affiliationId", "stripe-main");
  affiliation.set("name", "Stripe");
  affiliation.set("provider", "stripe");
  affiliation.set("merchantId", "acct_1");
  affiliation.set("active", "on");
  const rule = new FormData();
  rule.set("ruleId", "stripe-es");
  rule.set("name", "Stripe ES");
  rule.set("paymentSystemId", "stripe-card");
  rule.set("affiliationId", "stripe-main");
  rule.set("priority", "100");
  rule.set("country", "ES");
  rule.set("currency", "EUR");
  rule.set("minValueMinor", "1");
  rule.set("maxValueMinor", "999999");
  rule.set("active", "on");

  await assert.rejects(() => createPaymentSystemAction(method), { url: "/admin/pagos?tab=metodos&notice=Metodo+de+pago+creado." });
  await assert.rejects(() => createPaymentAffiliationAction(affiliation), { url: "/admin/pagos?tab=afiliaciones&notice=Afiliacion+de+pago+creada." });
  await assert.rejects(() => createPaymentRuleAction(rule), { url: "/admin/pagos?tab=reglas&notice=Regla+de+pago+creada." });

  assert.deepEqual(calls.map((call) => ({ path: call.path, method: call.method })), [
    { path: "/admin/payments/payment-systems?organizationId=org-1&shopId=shop-1", method: "POST" },
    { path: "/admin/payments/affiliations?organizationId=org-1&shopId=shop-1", method: "POST" },
    { path: "/admin/payments/rules?organizationId=org-1&shopId=shop-1", method: "POST" },
  ]);
  assert.equal(calls[0].body.provider, "stripe");
  assert.equal(calls[0].body.maxInstallments, 3);
  assert.equal(calls[1].body.merchantId, "acct_1");
  assert.equal(calls[2].body.priority, 100);
});

test("payments admin activation actions patch only allowed resources", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({
      body: options.init?.body ? JSON.parse(options.init.body) : undefined,
      method: options.init?.method,
      path: pathValue,
    });
    return { ok: true, data: {}, status: 200, correlationId: "corr-payments" };
  };
  const { setPaymentResourceActiveAction } = loadPaymentsActionsModule({ requestBff });
  const method = new FormData();
  method.set("tab", "metodos");
  method.set("resource", "payment-systems");
  method.set("id", "stripe/card");
  method.set("active", "false");
  method.set("includeInactive", "true");
  const affiliation = new FormData();
  affiliation.set("tab", "afiliaciones");
  affiliation.set("resource", "affiliations");
  affiliation.set("id", "stripe-main");
  affiliation.set("active", "true");
  const rule = new FormData();
  rule.set("tab", "reglas");
  rule.set("resource", "rules");
  rule.set("id", "stripe-es");
  rule.set("active", "false");
  const invalid = new FormData();
  invalid.set("tab", "metodos");
  invalid.set("resource", "../secrets");
  invalid.set("id", "nope");
  invalid.set("active", "false");

  await assert.rejects(() => setPaymentResourceActiveAction(method), {
    url: "/admin/pagos?tab=metodos&notice=Recurso+Payments+desactivado.&includeInactive=true",
  });
  await assert.rejects(() => setPaymentResourceActiveAction(affiliation), {
    url: "/admin/pagos?tab=afiliaciones&notice=Recurso+Payments+reactivado.",
  });
  await assert.rejects(() => setPaymentResourceActiveAction(rule), {
    url: "/admin/pagos?tab=reglas&notice=Recurso+Payments+desactivado.",
  });
  await assert.rejects(() => setPaymentResourceActiveAction(invalid), /Recurso Payments no permitido/);

  assert.deepEqual(calls, [
    {
      path: "/admin/payments/payment-systems/stripe%2Fcard?organizationId=org-1&shopId=shop-1",
      method: "PATCH",
      body: { active: false },
    },
    {
      path: "/admin/payments/affiliations/stripe-main?organizationId=org-1&shopId=shop-1",
      method: "PATCH",
      body: { active: true },
    },
    {
      path: "/admin/payments/rules/stripe-es?organizationId=org-1&shopId=shop-1",
      method: "PATCH",
      body: { active: false },
    },
  ]);
});

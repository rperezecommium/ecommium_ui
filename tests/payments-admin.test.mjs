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

test("payments admin route separates payment operation from configuration", () => {
  const routeSource = readFileSync(path.resolve(root, "app/(admin)/admin/pagos/page.tsx"), "utf8");
  const pageSource = readFileSync(path.resolve(root, "src/modules/pagos/payments-admin-page.tsx"), "utf8");
  const dataSource = readFileSync(path.resolve(root, "src/modules/pagos/payments-admin.ts"), "utf8");
  const actionsSource = readFileSync(path.resolve(root, "src/modules/pagos/payments-admin-actions.ts"), "utf8");
  const refundFormSource = readFileSync(path.resolve(root, "src/modules/pagos/payment-refund-request-form.tsx"), "utf8");
  const refundRefreshSource = readFileSync(path.resolve(root, "src/modules/pagos/payment-refund-evidence-auto-refresh.tsx"), "utf8");

  assert.match(routeSource, /getPaymentsAdminData/);
  assert.match(routeSource, /PaymentsAdminPage/);
  assert.match(pageSource, /Metodos/);
  assert.match(pageSource, /Resumen/);
  assert.match(pageSource, /Operaciones/);
  assert.match(pageSource, /Reembolsos/);
  assert.match(pageSource, /Proveedores/);
  assert.match(pageSource, /Routing/);
  assert.match(pageSource, /Diagnóstico/);
  assert.match(pageSource, /Facturación/);
  assert.match(pageSource, /Bandeja de operaciones/);
  assert.match(pageSource, /Reembolsos y cancelaciones/);
  assert.match(pageSource, /Evidencia del reembolso/);
  assert.match(pageSource, /Timeline auditable/);
  assert.match(pageSource, /Ver evidencia/);
  assert.match(pageSource, /adminSideDrawer paymentsRefundEvidenceDrawer/);
  assert.match(pageSource, /refund-evidence/);
  assert.match(pageSource, /PaymentRefundRequestForm/);
  assert.match(pageSource, /randomUUID/);
  assert.match(refundFormSource, /Solicitar reembolso/);
  assert.match(refundFormSource, /Confirmo que este importe se devolverá al método de pago original/);
  assert.match(refundRefreshSource, /router\.refresh/);
  assert.match(refundRefreshSource, /2000/);
  assert.match(refundRefreshSource, /Confirmación en curso/);
  assert.match(pageSource, /No se muestra respuesta cruda ni secretos del PSP/);
  assert.match(pageSource, /paymentsOperationsTable/);
  assert.match(dataSource, /\/admin\/payments\/transactions/);
  assert.match(dataSource, /normalizePaymentOperationsPage/);
  assert.match(dataSource, /normalizePaymentTransactionEvidence/);
  assert.match(dataSource, /\/admin\/payments\/transactions\/\$\{encodeURIComponent\(selectedTransactionId\)\}/);
  assert.match(pageSource, /PAN\/CVV/);
  assert.match(dataSource, /\/admin\/payments\/payment-systems/);
  assert.match(dataSource, /\/admin\/payments\/affiliations/);
  assert.match(dataSource, /\/admin\/payments\/rules/);
  assert.match(dataSource, /\/admin\/payments\/card-lookup/);
  assert.match(actionsSource, /createPaymentSystemAction/);
  assert.match(actionsSource, /createPaymentAffiliationAction/);
  assert.match(actionsSource, /createPaymentRuleAction/);
  assert.match(actionsSource, /setPaymentResourceActiveAction/);
  assert.match(actionsSource, /createPaymentRefundAction/);
  assert.match(actionsSource, /createPaymentCancellationAction/);
  assert.match(actionsSource, /resourcePath/);
  assert.match(pageSource, /Mostrar inactivos/);
  assert.match(pageSource, /Desactivar/);
  assert.match(pageSource, /Reactivar/);
  assert.match(pageSource, /ConfigurationKpis/);
  assert.match(pageSource, /paymentsConfigurationTable/);
  assert.match(pageSource, /paymentSystemName/);
  assert.match(pageSource, /affiliationName/);
  assert.match(pageSource, /item\.currency \?\? currency/);
  assert.match(pageSource, /item\.paymentReference \?\? item\.referenceId/);
  assert.match(pageSource, /Estado de configuración/);
  assert.match(pageSource, /Identificador interno/);
  assert.match(pageSource, /Nuevo método/);
  assert.match(pageSource, /Nuevo proveedor/);
  assert.match(pageSource, /Nueva regla/);
  assert.match(pageSource, /create-payment-system/);
  assert.match(pageSource, /create-affiliation/);
  assert.match(pageSource, /create-payment-rule/);
  assert.match(pageSource, /adminSideDrawer paymentsConfigurationDrawer/);
  assert.doesNotMatch(pageSource, /CreatePaymentSystemForm/);
  assert.doesNotMatch(pageSource, /CreateAffiliationForm/);
  assert.doesNotMatch(pageSource, /CreateRuleForm/);
  assert.match(routeSource, /create-payment-system/);
  assert.match(routeSource, /create-affiliation/);
  assert.match(routeSource, /create-payment-rule/);
});

test("payments admin capabilities map payments permissions", () => {
  const { getPaymentsAdminCapabilities } = loadPaymentsAdminModule(async () => ({ ok: true, data: {} }));

  const empty = getPaymentsAdminCapabilities(null);
  const viewer = getPaymentsAdminCapabilities({ scope: "admin", permissions: ["admin:payments:view"] });
  const manager = getPaymentsAdminCapabilities({ scope: "admin", permissions: ["payments.manage"] });
  const storefront = getPaymentsAdminCapabilities({ scope: "storefront", permissions: ["payments.manage"] });

  assert.equal(empty.canManagePayments, false);
  assert.equal(empty.canViewPayments, false);
  assert.equal(empty.canViewOperations, false);
  assert.equal(empty.canProcessTransactions, false);
  assert.equal(empty.canRefundPayments, false);
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

  const data = await getPaymentsAdminData(context, { cardBin: "424242", includeInactive: "true" }, {
    canManagePayments: true,
    canViewPayments: true,
    canViewOperations: false,
    canProcessTransactions: false,
    canRefundPayments: false,
  });

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

test("payments admin loads tenant-scoped operations and normalizes their commercial data", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push(pathValue);
    const raw = pathValue.includes("/transactions")
      ? {
          items: [{
            transactionId: "transaction-1",
            referenceId: "ORDER-1024",
            status: "SETTLED",
            valueMinor: 1275,
            currency: "EUR",
            paymentMethods: [{ name: "Tarjeta", methodType: "CARD", status: "SETTLED" }],
            settledMinor: 1275,
            refundedMinor: 250,
            refundableMinor: 1025,
            cancellableMinor: 0,
            refundsCount: 1,
            cancellationsCount: 0,
            updatedAt: "2026-07-22T10:00:00.000Z",
          }],
          total: 1,
          limit: 25,
          offset: 0,
          summary: { capturedMinor: 1275, pendingCount: 0, failedCount: 0, refundedMinor: 250 },
        }
      : { items: [] };
    return { ok: true, data: options.parse ? options.parse(raw) : raw, status: 200, correlationId: "corr-operations" };
  };
  const { getPaymentsAdminData } = loadPaymentsAdminModule(requestBff);
  const data = await getPaymentsAdminData(context, {
    tab: "operaciones",
    transactionReference: "ORDER-1024",
    transactionStatus: "SETTLED",
  }, {
    canManagePayments: true,
    canViewPayments: true,
    canViewOperations: true,
    canProcessTransactions: true,
    canRefundPayments: true,
  });

  assert.equal(data.transactions.ok, true);
  assert.equal(data.transactions.data.items[0].referenceId, "ORDER-1024");
  assert.equal(data.transactions.data.items[0].refundableMinor, 1025);
  assert.equal(data.transactions.data.summary.capturedMinor, 1275);
  assert.ok(calls.includes("/admin/payments/transactions?organizationId=org-1&shopId=shop-1&status=SETTLED&referenceId=ORDER-1024&limit=25&offset=0"));
});

test("payments admin loads safe refund evidence only for the selected transaction", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push(pathValue);
    const raw = pathValue.includes("/transactions/transaction-1")
      ? {
          transaction: {
            transactionId: "transaction-1",
            referenceId: "ORDER-1024",
            status: "PARTIALLY_REFUNDED",
            valueMinor: 1275,
            currency: "EUR",
            settledMinor: 1275,
            refundedMinor: 250,
            refundableMinor: 1025,
            refunds: [{
              refundId: "refund-1",
              transactionId: "transaction-1",
              valueMinor: 250,
              currency: "EUR",
              status: "SUCCEEDED",
              providerName: "stripe",
              providerStatus: "succeeded",
              providerRefundId: "re_123",
              requestedAt: "2026-07-22T10:00:00.000Z",
              succeededAt: "2026-07-22T10:01:00.000Z",
              providerResponseSnapshot: { secret: "must-not-be-exposed" },
            }, {
              refundId: "refund-older",
              transactionId: "transaction-1",
              valueMinor: 100,
              currency: "EUR",
              status: "SUCCEEDED",
              requestedAt: "2026-07-22T09:00:00.000Z",
              succeededAt: "2026-07-22T09:01:00.000Z",
            }],
          },
          events: [{ payloadJson: { secret: "must-not-be-exposed" } }],
        }
      : { items: [], summary: {} };
    return { ok: true, data: options.parse ? options.parse(raw) : raw, status: 200, correlationId: "corr-refund-evidence" };
  };
  const { getPaymentsAdminData } = loadPaymentsAdminModule(requestBff);
  const data = await getPaymentsAdminData(context, { tab: "reembolsos", transactionId: "transaction-1" }, {
    canManagePayments: true,
    canViewPayments: true,
    canViewOperations: true,
    canProcessTransactions: false,
    canRefundPayments: false,
  });

  assert.equal(data.transactionEvidence.ok, true);
  assert.equal(data.transactionEvidence.data.referenceId, "ORDER-1024");
  assert.equal(data.transactionEvidence.data.refunds[0].refundId, "refund-1");
  assert.equal(data.transactionEvidence.data.refunds[1].refundId, "refund-older");
  assert.equal(data.transactionEvidence.data.refunds[0].providerRefundId, "re_123");
  assert.equal(data.transactionEvidence.data.refunds[0].succeededAt, "2026-07-22T10:01:00.000Z");
  assert.equal("providerResponseSnapshot" in data.transactionEvidence.data.refunds[0], false);
  assert.ok(calls.includes("/admin/payments/transactions/transaction-1?organizationId=org-1&shopId=shop-1"));
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
  await assert.rejects(() => createPaymentAffiliationAction(affiliation), { url: "/admin/pagos?tab=proveedores&notice=Proveedor+de+pago+creado." });
  await assert.rejects(() => createPaymentRuleAction(rule), { url: "/admin/pagos?tab=routing&notice=Regla+de+routing+creada." });

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

test("payments admin sends confirmed refund and cancellation requests to the canonical transaction endpoints", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({
      path: pathValue,
      method: options.init?.method,
      body: JSON.parse(options.init?.body ?? "{}"),
    });
    return { ok: true, data: {}, status: 202, correlationId: "corr-operation-action" };
  };
  const { createPaymentCancellationAction, createPaymentRefundAction } = loadPaymentsActionsModule({ requestBff });
  const refund = new FormData();
  refund.set("transactionId", "transaction/1");
  refund.set("refundId", "8b4fae3f-9dea-453e-8f33-dba2a7e7f65e");
  refund.set("valueMinor", "1299");
  refund.set("currency", "EUR");
  refund.set("referenceId", "ORDER-1024");
  refund.set("confirmed", "on");
  const cancellation = new FormData();
  cancellation.set("transactionId", "transaction/2");
  cancellation.set("cancellationId", "10f7ba5d-20f5-41cd-91a9-fc0c5223b6e4");
  cancellation.set("valueMinor", "899");
  cancellation.set("currency", "EUR");
  cancellation.set("referenceId", "ORDER-1025");
  cancellation.set("confirmed", "on");

  await assert.rejects(() => createPaymentRefundAction(refund), {
    url: "/admin/pagos?tab=reembolsos&notice=Solicitud+creada.+El+importe+qued%C3%B3+reservado%3B+Payments+est%C3%A1+comprobando+la+confirmaci%C3%B3n+del+proveedor.&transactionReference=ORDER-1024&transactionId=transaction%2F1&drawer=refund-evidence",
  });
  await assert.rejects(() => createPaymentCancellationAction(cancellation), {
    url: "/admin/pagos?tab=reembolsos&notice=Solicitud+de+cancelaci%C3%B3n+enviada+a+Payments.&transactionReference=ORDER-1025&transactionId=transaction%2F2",
  });
  assert.deepEqual(calls, [
    {
      path: "/admin/payments/transactions/transaction%2F1/refunds?organizationId=org-1&shopId=shop-1",
      method: "POST",
      body: { refundId: "8b4fae3f-9dea-453e-8f33-dba2a7e7f65e", valueMinor: 1299, currency: "EUR" },
    },
    {
      path: "/admin/payments/transactions/transaction%2F2/cancellations?organizationId=org-1&shopId=shop-1",
      method: "POST",
      body: { cancellationId: "10f7ba5d-20f5-41cd-91a9-fc0c5223b6e4", valueMinor: 899, currency: "EUR" },
    },
  ]);
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
  affiliation.set("tab", "proveedores");
  affiliation.set("resource", "affiliations");
  affiliation.set("id", "stripe-main");
  affiliation.set("active", "true");
  const rule = new FormData();
  rule.set("tab", "routing");
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
    url: "/admin/pagos?tab=proveedores&notice=Recurso+Payments+reactivado.",
  });
  await assert.rejects(() => setPaymentResourceActiveAction(rule), {
    url: "/admin/pagos?tab=routing&notice=Recurso+Payments+desactivado.",
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

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(new URL("..", import.meta.url).pathname);

function loadPaymentsModule(storage = createStorage()) {
  const source = readFileSync(path.resolve(root, "src/modules/storefront/payments.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const commonJsExports = {};
  const moduleContext = {
    Headers,
    Response,
    URL,
    URLSearchParams,
    crypto: {
      randomUUID: () => "uuid-test",
    },
    exports: commonJsExports,
    fetch: async () => {
      throw new Error("fetch should be injected in tests");
    },
    localStorage: storage.localStorage,
    module: { exports: commonJsExports },
    sessionStorage: storage.sessionStorage,
    window: {},
  };

  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
}

function createStorage() {
  const local = new Map();
  const session = new Map();

  return {
    localStorage: {
      getItem: (key) => local.get(key) ?? null,
      removeItem: (key) => local.delete(key),
      setItem: (key, value) => local.set(key, String(value)),
    },
    sessionStorage: {
      getItem: (key) => session.get(key) ?? null,
      removeItem: (key) => session.delete(key),
      setItem: (key, value) => session.set(key, String(value)),
    },
  };
}

test("storefront payments normalize installed PayPal and Stripe systems only", () => {
  const {
    installedStorefrontPaymentMethods,
    normalizeStorefrontPaymentMethods,
  } = loadPaymentsModule();

  const methods = normalizeStorefrontPaymentMethods({
    paymentSystems: [
      { paymentSystemId: "paypal-main", name: "PayPal", provider: "paypal", active: true },
      { id: "stripe-card", name: "Tarjeta", affiliation: { provider: "stripe" }, installments: [{ count: 1 }, { count: 3 }] },
      { id: "transfer", name: "Transferencia bancaria", active: true },
      { id: "old-paypal", name: "PayPal antiguo", provider: "paypal", active: false },
    ],
  });

  assert.equal(methods.length, 4);
  assert.equal(methods[0].provider, "paypal");
  assert.equal(methods[1].provider, "stripe");
  assert.deepEqual(methods[1].installments, [1, 3]);
  assert.deepEqual(installedStorefrontPaymentMethods(methods).map((method) => method.paymentSystemId), ["paypal-main", "stripe-card"]);
});

test("storefront payments decide redirect and reject missing redirect urls", () => {
  const {
    decideStorefrontPaymentAction,
    normalizeStorefrontPaymentTransaction,
  } = loadPaymentsModule();

  const transaction = normalizeStorefrontPaymentTransaction({
    transaction: {
      id: "tx-1",
      nextAction: {
        type: "REDIRECT",
        redirectUrl: "https://www.paypal.com/checkoutnow?token=token-1",
      },
    },
  });

  const decision = decideStorefrontPaymentAction({ provider: "paypal" }, transaction);
  assert.equal(decision.kind, "redirect");
  assert.equal(decision.provider, "paypal");
  assert.equal(decision.redirectUrl, "https://www.paypal.com/checkoutnow?token=token-1");

  const missingUrl = normalizeStorefrontPaymentTransaction({
    transactionId: "tx-2",
    nextAction: {
      type: "REDIRECT",
    },
  });

  assert.equal(decideStorefrontPaymentAction({ provider: "stripe" }, missingUrl).kind, "unsupported");
});

test("storefront payments accept only exact HTTPS redirect hosts for each PSP", () => {
  const { decideStorefrontPaymentAction, validateStorefrontPaymentRedirectUrl } = loadPaymentsModule();
  const invalidUrls = [
    "javascript:alert(1)",
    "data:text/html,alert(1)",
    "http://www.paypal.com/checkoutnow",
    "https://paypal.com.evil.test/checkoutnow",
    "https://www.paypal.com@evil.test/checkoutnow",
    "https://www.paypal.com:444/checkoutnow",
    "//www.paypal.com/checkoutnow",
    "/checkoutnow",
    "https://www.paypal.com/checkout\nnow",
  ];

  for (const value of invalidUrls) {
    assert.equal(validateStorefrontPaymentRedirectUrl("paypal", value), undefined, value);
    assert.equal(decideStorefrontPaymentAction(
      { provider: "paypal" },
      { nextAction: { type: "REDIRECT", redirectUrl: value } },
    ).kind, "unsupported", value);
  }

  assert.equal(
    validateStorefrontPaymentRedirectUrl("paypal", "https://www.paypal.com/checkoutnow?token=ok"),
    "https://www.paypal.com/checkoutnow?token=ok",
  );
  assert.equal(
    validateStorefrontPaymentRedirectUrl("stripe", "https://checkout.stripe.com/c/pay/test"),
    "https://checkout.stripe.com/c/pay/test",
  );
  assert.equal(validateStorefrontPaymentRedirectUrl("stripe", "https://www.paypal.com/checkoutnow"), undefined);
});

test("storefront payments normalize composed complete-return responses", () => {
  const {
    normalizeStorefrontPaymentTransaction,
  } = loadPaymentsModule();

  const transaction = normalizeStorefrontPaymentTransaction({
    additionalData: { transactionId: "tx-ignored" },
    authorization: {
      transaction: {
        status: "AUTHORIZED",
        transactionId: "tx-auth",
      },
    },
    settlement: {
      transaction: {
        currency: "USD",
        status: "SETTLED",
        transactionId: "tx-settled",
        valueMinor: 40505,
      },
    },
  });

  assert.equal(transaction.transactionId, "tx-settled");
  assert.equal(transaction.status, "SETTLED");
  assert.equal(transaction.amountMinor, 40505);
  assert.equal(transaction.currency, "USD");
});

test("storefront payments build UI proxy paths without PSP secrets", async () => {
  const {
    buildStorefrontPaymentCancelPath,
    buildStorefrontPaymentCompleteReturnPath,
    buildStorefrontPaymentSystemsPath,
    cancelStorefrontPendingPaymentTransaction,
    completeStorefrontPaymentReturn,
    createStorefrontPaymentTransaction,
  } = loadPaymentsModule();
  const calls = [];
  const paymentsFetch = async (pathValue, init = {}) => {
    calls.push({
      body: init.body ? JSON.parse(init.body) : undefined,
      headers: init.headers,
      method: init.method ?? "GET",
      path: pathValue,
    });
    return Response.json({
      transaction: {
        transactionId: "tx-1",
        nextAction: { type: "AWAIT_WEBHOOK" },
        status: "PENDING",
      },
    }, { headers: { "x-correlation-id": "corr-bff" } });
  };

  assert.equal(
    buildStorefrontPaymentSystemsPath({
      currency: "EUR",
      guestSessionId: "guest-1",
      locale: "es-ES",
      organizationId: "org-1",
      shopId: "shop-1",
    }),
    "/api/storefront/payments/payment-systems?organizationId=org-1&shopId=shop-1&locale=es-ES&currency=EUR&guestSessionId=guest-1",
  );
  assert.equal(
    buildStorefrontPaymentCompleteReturnPath("stripe", {
      body: {},
      organizationId: "org-1",
      shopAlias: "demo",
      transactionId: "tx/1",
    }),
    "/api/storefront/payments/transactions/tx%2F1/stripe/complete-return?organizationId=org-1&shopAlias=demo",
  );
  assert.equal(
    buildStorefrontPaymentCancelPath({
      guestSessionId: "guest-1",
      organizationId: "org-1",
      shopId: "shop-1",
      transactionId: "tx/1",
    }),
    "/api/storefront/payments/transactions/tx%2F1/cancel?organizationId=org-1&shopId=shop-1&guestSessionId=guest-1",
  );

  await createStorefrontPaymentTransaction({
    body: { amountMinor: 1299 },
    correlationId: "corr-ui",
    organizationId: "org-1",
    shopId: "shop-1",
  }, paymentsFetch);
  await completeStorefrontPaymentReturn("paypal", {
    body: { token: "paypal-token" },
    organizationId: "org-1",
    shopId: "shop-1",
    transactionId: "tx-1",
  }, paymentsFetch);
  await cancelStorefrontPendingPaymentTransaction({
    body: { reason: "CUSTOMER_CANCELLED" },
    guestSessionId: "guest-1",
    transactionId: "tx-1",
  }, paymentsFetch);

  assert.equal(calls[0].path, "/api/storefront/payments/transactions?organizationId=org-1&shopId=shop-1");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].headers.get("x-correlation-id"), "corr-ui");
  assert.equal(calls[1].path, "/api/storefront/payments/transactions/tx-1/paypal/complete-return?organizationId=org-1&shopId=shop-1");
  assert.equal(calls[2].path, "/api/storefront/payments/transactions/tx-1/cancel?guestSessionId=guest-1");
  assert.equal(calls[2].method, "POST");
  assert.doesNotMatch(JSON.stringify(calls), /secret|sk_|client_secret/i);
});

test("storefront payments refetch transaction when complete-return is idempotent", async () => {
  const {
    completeStorefrontPaymentReturn,
  } = loadPaymentsModule();
  const calls = [];
  const paymentsFetch = async (pathValue, init = {}) => {
    calls.push({
      method: init.method ?? "GET",
      path: pathValue,
    });
    if ((init.method ?? "GET") === "POST") {
      return Response.json({
        additionalData: { transactionId: "tx-1" },
        authorization: null,
        settlement: null,
        idempotentReplay: true,
      });
    }
    return Response.json({
      transactionId: "tx-1",
      status: "SETTLED",
      valueMinor: 40505,
      currency: "USD",
    });
  };

  const transaction = await completeStorefrontPaymentReturn("stripe", {
    body: { sessionId: "cs_test_123" },
    transactionId: "tx-1",
  }, paymentsFetch);

  assert.equal(transaction.status, "SETTLED");
  assert.equal(transaction.amountMinor, 40505);
  assert.deepEqual(calls.map((call) => call.method), ["POST", "GET"]);
  assert.equal(calls[1].path, "/api/storefront/payments/transactions/tx-1");
});

test("storefront payments can call UI proxy with only guest context", () => {
  const {
    buildStorefrontPaymentTransactionPath,
  } = loadPaymentsModule();

  assert.equal(
    buildStorefrontPaymentTransactionPath({
      guestSessionId: "guest-1",
    }),
    "/api/storefront/payments/transactions?guestSessionId=guest-1",
  );
});

test("storefront payments expose thin UI proxies to BFF Payments", () => {
  const paymentSystemsRouteSource = readFileSync(path.resolve(root, "app/api/storefront/payments/payment-systems/route.ts"), "utf8");
  const transactionsRouteSource = readFileSync(path.resolve(root, "app/api/storefront/payments/transactions/route.ts"), "utf8");
  const transactionDetailRouteSource = readFileSync(path.resolve(root, "app/api/storefront/payments/transactions/[transactionId]/route.ts"), "utf8");
  const completeReturnRouteSource = readFileSync(
    path.resolve(root, "app/api/storefront/payments/transactions/[transactionId]/[provider]/complete-return/route.ts"),
    "utf8",
  );
  const cancelRouteSource = readFileSync(
    path.resolve(root, "app/api/storefront/payments/transactions/[transactionId]/cancel/route.ts"),
    "utf8",
  );

  assert.match(paymentSystemsRouteSource, /\/payments\/payment-systems/);
  assert.match(transactionsRouteSource, /\/payments\/transactions/);
  assert.match(transactionDetailRouteSource, /\/payments\/transactions\/\$\{encodeURIComponent\(transactionId\)\}/);
  assert.match(transactionDetailRouteSource, /method: "GET"|export async function GET/);
  assert.match(transactionDetailRouteSource, /x-correlation-id/);
  assert.match(transactionDetailRouteSource, /withAuth: false/);
  assert.match(completeReturnRouteSource, /\/payments\/transactions\/\$\{encodeURIComponent\(transactionId\)\}\/\$\{provider\}\/complete-return/);
  assert.match(completeReturnRouteSource, /provider !== "paypal" && provider !== "stripe"/);
  assert.match(transactionsRouteSource, /stripUiOnlyFields/);
  assert.match(completeReturnRouteSource, /stripUiOnlyFields/);
  assert.match(transactionsRouteSource, /x-correlation-id/);
  assert.match(completeReturnRouteSource, /x-correlation-id/);
  assert.match(transactionsRouteSource, /withAuth: false/);
  assert.match(completeReturnRouteSource, /withAuth: false/);
  assert.match(cancelRouteSource, /\/payments\/transactions\/\$\{encodeURIComponent\(transactionId\)\}\/cancel/);
  assert.match(cancelRouteSource, /reason: asString\(input\.reason\) \|\| "CUSTOMER_CANCELLED"/);
  assert.match(cancelRouteSource, /x-guest-session-id/);
  assert.match(cancelRouteSource, /withAuth: false/);
});

test("storefront payment return pages complete PSP returns idempotently", () => {
  const returnClientSource = readFileSync(path.resolve(root, "src/modules/storefront/payment-return-client.tsx"), "utf8");
  const confirmationClientSource = readFileSync(path.resolve(root, "src/modules/storefront/payment-confirmation-client.tsx"), "utf8");
  const paypalReturnPageSource = readFileSync(path.resolve(root, "app/checkout/payments/paypal/return/page.tsx"), "utf8");
  const paypalCancelPageSource = readFileSync(path.resolve(root, "app/checkout/payments/paypal/cancel/page.tsx"), "utf8");
  const stripeReturnPageSource = readFileSync(path.resolve(root, "app/checkout/payments/stripe/return/page.tsx"), "utf8");
  const stripeCancelPageSource = readFileSync(path.resolve(root, "app/checkout/payments/stripe/cancel/page.tsx"), "utf8");

  assert.match(returnClientSource, /completeStorefrontPaymentReturn/);
  assert.match(returnClientSource, /cancelStorefrontPendingPaymentTransaction/);
  assert.match(returnClientSource, /clearStorefrontPaymentReceipt/);
  assert.match(returnClientSource, /sanitizePspReturnSearchParams/);
  assert.match(returnClientSource, /useRouter/);
  assert.match(returnClientSource, /router\.replace/);
  assert.match(returnClientSource, /makeStorefrontPaymentReturnOnceKey/);
  assert.match(returnClientSource, /hasProcessedStorefrontPaymentReturn/);
  assert.match(returnClientSource, /markStorefrontPaymentReturnProcessed/);
  assert.match(returnClientSource, /getStorefrontPaymentTransaction/);
  assert.match(returnClientSource, /paymentReturnAttemptFromParams/);
  assert.match(returnClientSource, /attempt\.provider !== provider/);
  assert.match(returnClientSource, /saveStorefrontPaymentReceipt/);
  assert.match(returnClientSource, /createStorefrontPaymentReceipt/);
  assert.match(returnClientSource, /paymentReturnOutcome\(transaction\.status\)/);
  assert.match(returnClientSource, /paymentAttemptStatusForOutcome\(outcome\)/);
  assert.match(returnClientSource, /finalizePaidCheckoutWithRetry/);
  assert.match(returnClientSource, /Pago realizado\. Estamos preparando la confirmación del pedido/);
  assert.match(returnClientSource, /PaymentReturnSteps/);
  assert.match(returnClientSource, /status: completed \? "completed" : outcome/);
  assert.match(returnClientSource, /if \(completed && finalizeResult\) \{/);
  assert.match(returnClientSource, /if \(completed && result\) \{/);
  assert.doesNotMatch(returnClientSource, /Pago en proceso\. Te avisaremos cuando se confirme/);
  assert.doesNotMatch(returnClientSource, /No vuelvas a pagar|no vuelvas a pagar/);
  assert.doesNotMatch(returnClientSource, /state\.status === "pending" \? \(\n\s+<Link href="\/checkout">Volver al checkout<\/Link>/);
  assert.match(returnClientSource, /normalized === "DENIED" \|\| normalized === "FAILED"/);
  assert.match(returnClientSource, /updateStorefrontPaymentAttemptStatus\("CANCELLED"\)/);
  assert.match(returnClientSource, /params\.transactionId/);
  assert.match(returnClientSource, /params\.orderFormId/);
  assert.match(returnClientSource, /params\.PayerID/);
  assert.match(returnClientSource, /params\.session_id/);
  assert.match(returnClientSource, /params\.set\("guestSessionId", guestSessionId\)/);
  assert.match(returnClientSource, /finalizePaidCheckout/);
  assert.match(returnClientSource, /orderStatusForPaymentStatus/);
  assert.match(returnClientSource, /status: orderStatus/);
  assert.match(returnClientSource, /paymentTransactionId: transactionId/);
  assert.match(returnClientSource, /paymentData/);
  assert.doesNotMatch(returnClientSource, /status: "SETTLED",\n            transactionId: attempt\.transactionId/);
  assert.doesNotMatch(returnClientSource, /normalized === "AUTHORIZED" \|\|\n    normalized === "SUCCEEDED"/);
  assert.match(returnClientSource, /source: "storefront-payment-return"/);
  assert.match(returnClientSource, /forceNewCart: "true"/);
  assert.match(returnClientSource, /cart-updated/);
  assert.doesNotMatch(returnClientSource, /Ver confirmación/);
  assert.doesNotMatch(returnClientSource, /Cerrar intento local/);
  assert.doesNotMatch(returnClientSource, /storefrontCheckoutMiniSummary/);
  assert.doesNotMatch(returnClientSource, />Transacción</);
  assert.doesNotMatch(returnClientSource, />Correlation</);
  assert.match(confirmationClientSource, /createStorefrontPaymentReceipt/);
  assert.match(confirmationClientSource, /saveStorefrontPaymentReceipt/);
  assert.match(confirmationClientSource, /getStorefrontPaymentTransaction/);
  assert.match(confirmationClientSource, /PaymentConfirmationSummary/);
  assert.match(confirmationClientSource, /Total pagado/);
  assert.match(confirmationClientSource, /Artículos/);
  assert.match(confirmationClientSource, /Tu pago quedó confirmado\. Te mostraremos el seguimiento cuando el pedido esté disponible en tu cuenta/);
  assert.match(confirmationClientSource, /Compra recibida/);
  assert.match(confirmationClientSource, /state\.status === "completed" \? \(/);
  assert.doesNotMatch(confirmationClientSource, /readStorefrontPaymentReceipt/);
  assert.doesNotMatch(confirmationClientSource, /state\.status === "completed" \? \(\n\s+<Link href="\/checkout">Volver al checkout<\/Link>/);
  assert.match(confirmationClientSource, /clearStorefrontPaymentAttempt/);
  assert.match(confirmationClientSource, /attempt\?\.guestSessionId \?\? guestSessionId/);
  assert.match(confirmationClientSource, /orderId/);
  assert.doesNotMatch(confirmationClientSource, /Confirmando pedido/);
  assert.match(confirmationClientSource, /Pago realizado/);
  assert.match(confirmationClientSource, /Pago no confirmado/);
  assert.match(confirmationClientSource, /Seguir comprando/);
  assert.doesNotMatch(confirmationClientSource, /Limpiar referencia local/);
  assert.doesNotMatch(confirmationClientSource, /Referencia soporte/);
  assert.doesNotMatch(confirmationClientSource, /Estado Payments/);
  assert.doesNotMatch(confirmationClientSource, />Provider</);
  assert.doesNotMatch(confirmationClientSource, />Transacción</);
  assert.match(paypalReturnPageSource, /mode="return" provider="paypal"/);
  assert.match(paypalCancelPageSource, /mode="cancel" provider="paypal"/);
  assert.match(stripeReturnPageSource, /mode="return" provider="stripe"/);
  assert.match(stripeCancelPageSource, /mode="cancel" provider="stripe"/);
});

test("checkout gates review on server-confirmed settlement, not on a saved payment method", () => {
  const checkoutSource = readFileSync(path.resolve(root, "src/modules/storefront/checkout-client.tsx"), "utf8");

  assert.match(checkoutSource, /payment: paymentStatusAllowsOrder\(paymentVerification\.status\)/);
  assert.match(checkoutSource, /getStorefrontPaymentTransaction/);
  assert.match(checkoutSource, /transaction,\n\s+transactionId: transaction\.transactionId \|\| reference\.transactionId/);
  assert.match(checkoutSource, /cancelStorefrontPendingPaymentTransaction/);
  assert.match(checkoutSource, /currentStatus !== "PAYMENT_DATA_RECEIVED"/);
  assert.match(checkoutSource, /return "Pendiente de confirmación"/);
  assert.match(checkoutSource, /current\.review \? \{ \.\.\.current, review: undefined \} : current/);
  assert.match(checkoutSource, /<CheckoutStateGrid orderform=\{orderform\} paymentConfirmed=\{completion\.payment\} \/>/);
  assert.match(checkoutSource, /paymentConfirmed \? "Confirmado" : hasPayment\(orderform\) \? "Seleccionado" : "Pendiente"/);
  assert.match(checkoutSource, /confirmedCheckoutPaymentReference\(\n\s+orderform,\n\s+totals\.grandTotal,\n\s+paymentVerification/);
  assert.match(checkoutSource, /const transaction = verification\.transaction/);
  assert.doesNotMatch(checkoutSource, /const receipt = readStorefrontPaymentReceipt\(\);\n\s+if \(\n\s+receipt/);
  assert.doesNotMatch(checkoutSource, /payment: hasPayment\(orderform\)/);
});

test("paid checkout only resets the cart after Checkout confirms both transitions", () => {
  const checkoutSource = readFileSync(path.resolve(root, "src/modules/storefront/checkout-client.tsx"), "utf8");
  const returnClientSource = readFileSync(path.resolve(root, "src/modules/storefront/payment-return-client.tsx"), "utf8");

  assert.match(checkoutSource, /El pedido se creó, pero no pudimos vaciar el carrito/);
  assert.match(checkoutSource, /forceNewCart: "true", guestSessionId/);
  assert.match(checkoutSource, /El pedido se creó, pero no pudimos preparar un carrito nuevo/);
  assert.match(checkoutSource, /nextOrderform\.items\.length > 0/);
  assert.doesNotMatch(checkoutSource, /if \(!response\.ok\) \{\n\s+return;\n\s+\}/);
  assert.match(returnClientSource, /El pago fue confirmado, pero no pudimos vaciar el carrito/);
  assert.match(returnClientSource, /El pago fue confirmado, pero no pudimos preparar un carrito nuevo/);
  assert.match(returnClientSource, /if \(!deleteResponse\.ok\) \{/);
  assert.match(returnClientSource, /if \(!nextResponse\.ok\) \{/);
});

test("storefront payment attempts expire and return processing is idempotent per session", () => {
  const storage = createStorage();
  const {
    clearStorefrontPaymentReceipt,
    createStorefrontPaymentAttempt,
    createStorefrontPaymentReceipt,
    hasProcessedStorefrontPaymentReturn,
    makeStorefrontPaymentReturnOnceKey,
    markStorefrontPaymentReturnProcessed,
    readStorefrontPaymentAttempt,
    readStorefrontPaymentReceipt,
    saveStorefrontPaymentReceipt,
    saveStorefrontPaymentAttempt,
    updateStorefrontPaymentAttemptStatus,
  } = loadPaymentsModule(storage);

  const attempt = createStorefrontPaymentAttempt({
    actor: "guest",
    amountMinor: 2599,
    correlationId: "corr-1",
    createdAt: new Date(),
    currency: "EUR",
    guestSessionId: "guest-1",
    itemsCount: 2,
    orderFormId: "of-1",
    paymentSystemId: "paypal-main",
    paymentSystemName: "PayPal",
    provider: "paypal",
    transactionId: "tx-1",
  });

  saveStorefrontPaymentAttempt(attempt);
  assert.equal(readStorefrontPaymentAttempt(new Date()).transactionId, "tx-1");
  assert.equal(updateStorefrontPaymentAttemptStatus("REDIRECTED").status, "REDIRECTED");

  const receipt = createStorefrontPaymentReceipt({
    attempt,
    capturedAt: new Date("2026-07-11T10:00:00.000Z"),
    transaction: {
      amountMinor: 2599,
      currency: "EUR",
      nextAction: { raw: {}, type: "NONE" },
      paymentSystemId: "paypal-main",
      raw: { provider: "paypal" },
      status: "SETTLED",
      transactionId: "tx-1",
    },
  });
  saveStorefrontPaymentReceipt(receipt);
  assert.equal(readStorefrontPaymentReceipt(new Date("2026-07-11T10:01:00.000Z")).supportReference, "tx-1:corr-1");
  assert.equal(readStorefrontPaymentReceipt(new Date("2026-08-11T10:01:00.000Z")), null);
  saveStorefrontPaymentReceipt(receipt);
  clearStorefrontPaymentReceipt();
  assert.equal(readStorefrontPaymentReceipt(new Date("2026-07-11T10:01:00.000Z")), null);
  assert.equal(readStorefrontPaymentAttempt(new Date(Date.now() + 91 * 60 * 1000)), null);

  const key = makeStorefrontPaymentReturnOnceKey({
    provider: "paypal",
    pspReference: "token-1:payer-1",
    transactionId: "tx-1",
  });
  assert.equal(hasProcessedStorefrontPaymentReturn(key), false);
  markStorefrontPaymentReturnProcessed(key);
  assert.equal(hasProcessedStorefrontPaymentReturn(key), true);
});

test("storefront payments sanitize PSP return params", () => {
  const { sanitizePspReturnSearchParams } = loadPaymentsModule();
  const params = new URLSearchParams();
  params.set("session_id", "cs_test_" + "x".repeat(3000));
  params.set("PayerID", "payer-1");
  params.set("bad key", "ignored");

  for (let index = 0; index < 50; index += 1) {
    params.set(`extra_${index}`, String(index));
  }

  const sanitized = sanitizePspReturnSearchParams(params);

  assert.equal(sanitized.session_id.length, 2048);
  assert.equal(sanitized.PayerID, "payer-1");
  assert.equal("bad key" in sanitized, false);
  assert.equal(Object.keys(sanitized).length, 40);
});

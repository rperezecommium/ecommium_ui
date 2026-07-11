import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("storefront checkout exposes a UI proxy for BFF checkout context", () => {
  const routeSource = readFileSync(path.resolve(root, "app/api/storefront/checkout/context/route.ts"), "utf8");

  assert.match(routeSource, /\/storefront\/checkout\/context/);
  assert.match(routeSource, /getStorefrontCustomerAuthorizationHeader/);
  assert.match(routeSource, /x-guest-session-id/);
  assert.match(routeSource, /guestSessionId/);
  assert.match(routeSource, /forceNewCart/);
  assert.match(routeSource, /Cache-Control/);
  assert.match(routeSource, /withAuth: false/);
});

test("storefront checkout client hydrates from checkout context", () => {
  const clientSource = readFileSync(path.resolve(root, "src/modules/storefront/checkout-client.tsx"), "utf8");

  assert.match(clientSource, /StorefrontCheckoutContextResponse/);
  assert.match(clientSource, /useState<StorefrontCheckoutContextResponse \| null>/);
  assert.match(clientSource, /fetchCheckoutContext/);
  assert.match(clientSource, /\/api\/storefront\/checkout\/context/);
  assert.match(clientSource, /setCheckoutContext/);
  assert.match(clientSource, /syncCheckoutFormsFromContext/);
  assert.doesNotMatch(clientSource, /Puedes continuar como invitado o usar una cuenta ya iniciada/);
});

test("storefront checkout splits guest and authenticated contact UX", () => {
  const clientSource = readFileSync(path.resolve(root, "src/modules/storefront/checkout-client.tsx"), "utf8");
  const cssSource = readFileSync(path.resolve(root, "app/globals.css"), "utf8");

  assert.match(clientSource, /GuestContactStep/);
  assert.match(clientSource, /AuthenticatedContactStep/);
  assert.match(clientSource, /identity\.state === "AUTHENTICATED"/);
  assert.match(clientSource, /Cuenta conectada/);
  assert.match(clientSource, /Telefono para este pedido/);
  assert.match(clientSource, /Este cambio solo se utilizará para este pedido/);
  assert.match(clientSource, /Realizarás esta compra con tu cuenta/);
  assert.match(cssSource, /\.storefrontCheckoutIdentitySummary/);
  assert.match(cssSource, /\.storefrontCheckoutContactRows/);
  assert.match(cssSource, /\.storefrontCheckoutIdentityBadge/);
});

test("storefront checkout lets unauthenticated buyers choose guest login or signup", () => {
  const clientSource = readFileSync(path.resolve(root, "src/modules/storefront/checkout-client.tsx"), "utf8");
  const authActionsSource = readFileSync(path.resolve(root, "src/modules/storefront/storefront-auth-actions.ts"), "utf8");
  const cssSource = readFileSync(path.resolve(root, "app/globals.css"), "utf8");

  assert.match(clientSource, /type GuestCheckoutMode = "guest" \| "login" \| "signup"/);
  assert.match(clientSource, /GuestCheckoutModeSelector/);
  assert.match(clientSource, /Comprar como invitado/);
  assert.match(clientSource, /Iniciar sesión/);
  assert.match(clientSource, /Crear cuenta/);
  assert.match(clientSource, /CheckoutAuthPanel/);
  assert.match(clientSource, /loginStorefrontCustomer/);
  assert.match(clientSource, /signupStorefrontCustomer/);
  assert.match(clientSource, /name="redirectTo" type="hidden" value="\/checkout"/);
  assert.match(authActionsSource, /safeRedirectPath/);
  assert.match(authActionsSource, /formString\(formData, "redirectTo"\)/);
  assert.match(cssSource, /\.storefrontCheckoutChoiceGrid/);
  assert.match(cssSource, /\.storefrontCheckoutChoiceCardActive/);
  assert.match(cssSource, /\.storefrontCheckoutAuthInline/);
});

test("storefront checkout renders editable section cards with compact summaries", () => {
  const clientSource = readFileSync(path.resolve(root, "src/modules/storefront/checkout-client.tsx"), "utf8");
  const cssSource = readFileSync(path.resolve(root, "app/globals.css"), "utf8");

  assert.match(clientSource, /CheckoutSectionCard/);
  assert.match(clientSource, /ContactSectionSummary/);
  assert.match(clientSource, /ShippingSectionSummary/);
  assert.match(clientSource, /PaymentSectionSummary/);
  assert.match(clientSource, /ReviewSectionSummary/);
  assert.match(clientSource, /storefrontCheckoutMiniSummary/);
  assert.match(clientSource, /actionLabel=\{completion\.profile \? "Editar" : "Completar"\}/);
  assert.match(clientSource, /active=\{activeStep === "shipping"\}/);
  assert.doesNotMatch(clientSource, /function CheckoutStepper/);
  assert.match(cssSource, /\.storefrontCheckoutSections/);
  assert.match(cssSource, /\.storefrontCheckoutSectionCardActive/);
  assert.match(cssSource, /\.storefrontCheckoutSectionStatusOk/);
  assert.match(cssSource, /\.storefrontCheckoutSectionSummary/);
  assert.match(cssSource, /\.storefrontCheckoutMiniSummary/);
});

test("storefront checkout respects BFF contact mutation scope", () => {
  const clientSource = readFileSync(path.resolve(root, "src/modules/storefront/checkout-client.tsx"), "utf8");
  const routeSource = readFileSync(path.resolve(root, "app/api/storefront/checkout/route.ts"), "utf8");

  assert.match(clientSource, /contactMutationAction/);
  assert.match(clientSource, /sections\?\.contact\?\.mutationScope/);
  assert.match(clientSource, /allowedCheckoutAction\(context, "profile"\)/);
  assert.match(clientSource, /applyOrderformAction\(action,/);
  assert.match(clientSource, /updateCheckoutContact/);
  assert.match(clientSource, /contactMutationNotice/);
  assert.match(clientSource, /perfil de cliente/);
  assert.match(routeSource, /case "profile"/);
  assert.match(routeSource, /method: "PATCH"/);
  assert.match(routeSource, /\/orderforms\/\$\{encodeURIComponent\(orderFormId\)\}\/profile/);
  assert.match(routeSource, /method: endpoint\.method/);
});

test("storefront checkout validates section payloads before BFF mutations", () => {
  const clientSource = readFileSync(path.resolve(root, "src/modules/storefront/checkout-client.tsx"), "utf8");
  const cssSource = readFileSync(path.resolve(root, "app/globals.css"), "utf8");

  assert.match(clientSource, /type CheckoutValidationErrors/);
  assert.match(clientSource, /validateProfile\(profile, isAuthenticatedCheckout\(checkoutContext\)\)/);
  assert.match(clientSource, /validateShippingAddress\(address\)/);
  assert.match(clientSource, /validatePaymentSelection\(orderform, paymentSystem, paymentSystems, totals\.grandTotal\)/);
  assert.match(clientSource, /CheckoutValidationList/);
  assert.match(clientSource, /role="alert"/);
  assert.match(clientSource, /Introduce un email válido/);
  assert.match(clientSource, /Introduce un código postal válido/);
  assert.match(clientSource, /Selecciona un método de pago válido/);
  assert.match(cssSource, /\.storefrontCheckoutValidation/);
});

test("storefront checkout loads payment methods from Payments BFF proxy", () => {
  const clientSource = readFileSync(path.resolve(root, "src/modules/storefront/checkout-client.tsx"), "utf8");
  const paymentSystemsRouteSource = readFileSync(path.resolve(root, "app/api/storefront/payments/payment-systems/route.ts"), "utf8");

  assert.match(clientSource, /loadPaymentSystems/);
  assert.match(clientSource, /\/api\/storefront\/payments\/payment-systems/);
  assert.match(clientSource, /installedStorefrontPaymentMethods/);
  assert.match(clientSource, /paymentSystems\.map/);
  assert.match(clientSource, /No hay métodos de pago activos para esta tienda/);
  assert.doesNotMatch(clientSource, /\["credit-card", "paypal", "bank-transfer"\]/);
  assert.doesNotMatch(clientSource, /bank-transfer/);
  assert.match(paymentSystemsRouteSource, /\/payments\/payment-systems/);
  assert.match(paymentSystemsRouteSource, /getStorefrontCustomerAuthorizationHeader/);
  assert.match(paymentSystemsRouteSource, /x-guest-session-id/);
  assert.match(paymentSystemsRouteSource, /withAuth: false/);
  assert.match(paymentSystemsRouteSource, /Cache-Control/);
});

test("storefront checkout starts payment transactions and persists redirect attempts", () => {
  const clientSource = readFileSync(path.resolve(root, "src/modules/storefront/checkout-client.tsx"), "utf8");
  const transactionsRouteSource = readFileSync(path.resolve(root, "app/api/storefront/payments/transactions/route.ts"), "utf8");

  assert.match(clientSource, /createStorefrontPaymentTransaction/);
  assert.match(clientSource, /decideStorefrontPaymentAction/);
  assert.match(clientSource, /saveStorefrontPaymentAttempt/);
  assert.match(clientSource, /createStorefrontPaymentCorrelationId/);
  assert.match(clientSource, /buildPaymentTransactionPayload/);
  assert.match(clientSource, /buildPaymentInventorySnapshot/);
  assert.match(clientSource, /window\.location\.assign\(decision\.redirectUrl\)/);
  assert.match(clientSource, /\/checkout\/payments\/\$\{provider\}\/return/);
  assert.match(clientSource, /\/checkout\/payments\/\$\{provider\}\/cancel/);
  assert.match(clientSource, /No se pudo preparar el inventario para iniciar el pago/);
  assert.match(transactionsRouteSource, /\/payments\/transactions/);
  assert.match(transactionsRouteSource, /x-correlation-id/);
  assert.match(transactionsRouteSource, /stripUiOnlyFields/);
  assert.match(transactionsRouteSource, /withAuth: false/);
});

test("storefront checkout guides the next actionable section before review", () => {
  const clientSource = readFileSync(path.resolve(root, "src/modules/storefront/checkout-client.tsx"), "utf8");
  const cssSource = readFileSync(path.resolve(root, "app/globals.css"), "utf8");

  assert.match(clientSource, /CheckoutProgressPrompt/);
  assert.match(clientSource, /checkoutNextStep/);
  assert.match(clientSource, /checkoutStepLabel/);
  assert.match(clientSource, /Pedido listo para revisar/);
  assert.match(clientSource, /Siguiente paso/);
  assert.match(clientSource, /setActiveStep\(canReview \? "review" : nextStep\)/);
  assert.match(clientSource, /Completa contacto, entrega y pago antes de confirmar el pedido/);
  assert.match(cssSource, /\.storefrontCheckoutProgressPrompt/);
  assert.match(cssSource, /\.storefrontCheckoutProgressPromptReady/);
});

test("storefront checkout context types model identity, sections and allowed actions", () => {
  const typesSource = readFileSync(path.resolve(root, "src/modules/storefront/checkout-types.ts"), "utf8");

  assert.match(typesSource, /AUTHENTICATED/);
  assert.match(typesSource, /GUEST/);
  assert.match(typesSource, /allowedActions/);
  assert.match(typesSource, /contact/);
  assert.match(typesSource, /sections/);
  assert.match(typesSource, /mutationScope/);
  assert.match(typesSource, /StorefrontCheckoutAddressBook/);
  assert.match(typesSource, /maxAddresses/);
  assert.match(typesSource, /addressBook/);
  assert.match(typesSource, /selectedAddress/);
  assert.match(typesSource, /section\?: string/);
});

test("storefront checkout consumes authenticated address book by alias", () => {
  const clientSource = readFileSync(path.resolve(root, "src/modules/storefront/checkout-client.tsx"), "utf8");
  const cssSource = readFileSync(path.resolve(root, "app/globals.css"), "utf8");

  assert.match(clientSource, /AddressBookSelector/);
  assert.match(clientSource, /AddressBookSavePanel/);
  assert.match(clientSource, /selectedAddressBookId/);
  assert.match(clientSource, /sections\?\.shipping\?\.addressBook/);
  assert.match(clientSource, /<select value=\{selectedAddressId\}/);
  assert.match(clientSource, /addressBookItemLabel/);
  assert.match(clientSource, /addressFormFromCheckoutAddress/);
  assert.match(clientSource, /buildSelectedAddress\(address, selectedSavedAddress\)/);
  assert.match(clientSource, /addressId: savedAddress\?\.addressId/);
  assert.match(clientSource, /alias: savedAddress\?\.alias/);
  assert.match(clientSource, /isDisposable: !savedAddress\?\.addressId/);
  assert.match(clientSource, /Límite de direcciones alcanzado/);
  assert.match(cssSource, /\.storefrontCheckoutAddressBook/);
  assert.match(cssSource, /\.storefrontCheckoutSaveAddressPanel/);
});

test("storefront checkout saves new addresses through Storefront me proxy", () => {
  const clientSource = readFileSync(path.resolve(root, "src/modules/storefront/checkout-client.tsx"), "utf8");
  const routeSource = readFileSync(path.resolve(root, "app/api/storefront/me/addresses/route.ts"), "utf8");

  assert.match(clientSource, /\/api\/storefront\/me\/addresses/);
  assert.match(clientSource, /validateAddressAlias/);
  assert.match(clientSource, /buildAddressBookPayload/);
  assert.match(clientSource, /normalizeAddressBookPayload/);
  assert.match(clientSource, /updateCheckoutAddressBook/);
  assert.match(routeSource, /\/storefront\/me\/addresses/);
  assert.match(routeSource, /getStorefrontCustomerAuthorizationHeader/);
  assert.match(routeSource, /organizationId/);
  assert.match(routeSource, /alias/);
  assert.match(routeSource, /validateAddressPayload/);
  assert.match(routeSource, /withAuth: false/);
  assert.doesNotMatch(routeSource, /customerId/);
});

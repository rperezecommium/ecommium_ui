import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);

function source(relativePath) {
  return readFileSync(path.resolve(root, relativePath), "utf8");
}

test("canonical tracking page uses the BFF response and keeps private links out of the URL", () => {
  const page = source("app/pedido/[orderReference]/seguimiento/page.tsx");
  const tracking = source("src/modules/storefront/order-tracking.ts");
  const client = source("src/modules/storefront/order-tracking-page.tsx");
  const loading = source("app/pedido/[orderReference]/seguimiento/loading.tsx");

  assert.match(page, /getStorefrontOrderTracking/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(page, /referrer: "no-referrer"/);
  assert.match(tracking, /\/storefront\/order-tracking\//);
  assert.match(tracking, /trackingAccessToken/);
  assert.match(tracking, /getStorefrontCustomerAuthorizationHeader/);
  assert.doesNotMatch(tracking, /orderId: string;/);
  assert.match(tracking, /status: 401/);
  assert.match(client, /tracking\.timeline\.map/);
  assert.match(client, /tracking\.shippingModule\.visible/);
  assert.match(client, /window\.history\.replaceState/);
  assert.match(client, /errorStatus === 503/);
  assert.match(loading, /aria-busy="true"/);
});

test("active tracking step has a subtle, accessible progress animation", () => {
  const css = source("app/globals.css");

  assert.match(css, /storefrontOrderTrackingStepCurrent > span::after[\s\S]*inset: 4px[\s\S]*animation: storefront-order-tracking-inner-ring-fade/);
  assert.match(css, /@keyframes storefront-order-tracking-inner-ring-fade[\s\S]*opacity: 0\.25[\s\S]*opacity: 0\.9/);
  assert.match(css, /storefrontOrderTrackingStep:has\(\+ \.storefrontOrderTrackingStepCurrent\)::before/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*storefrontOrderTrackingStepCurrent > span[\s\S]*animation: none/);
});

test("tracking access helpers use only the BFF recovery contract without browser persistence", () => {
  const tracking = source("src/modules/storefront/order-tracking.ts");

  assert.match(tracking, /requestStorefrontTrackingAccessRecovery/);
  assert.match(tracking, /\/storefront\/order-tracking\/access-recovery\?/);
  assert.match(tracking, /withAuth: false/);
  assert.doesNotMatch(tracking, /guest-claim/);
  assert.doesNotMatch(tracking, /claimStorefrontGuestOrder/);
  assert.doesNotMatch(tracking, /localStorage|sessionStorage/);
});

test("private tracking access is removed from the URL and never persisted for association", () => {
  const page = source("app/pedido/[orderReference]/seguimiento/page.tsx");
  const client = source("src/modules/storefront/order-tracking-page.tsx");

  assert.doesNotMatch(page, /GuestOrderClaim|claimIntent|claimNotice/);
  assert.match(client, /removePrivateAccessFromUrl\(\)/);
  assert.doesNotMatch(client, /rememberStorefrontGuestOrderClaimIntent/);
  assert.match(client, /searchParams\.delete\("trackingAccessToken"\)/);
});

test("account activation relies on automatic linkage rather than a client claim", () => {
  const page = source("app/pedido/[orderReference]/seguimiento/page.tsx");
  const client = source("src/modules/storefront/order-tracking-page.tsx");
  const actions = source("src/modules/storefront/storefront-order-tracking-actions.ts");
  const drawer = source("src/modules/storefront/storefront-auth-drawer.tsx");
  const authActions = source("src/modules/storefront/storefront-auth-actions.ts");

  assert.doesNotMatch(page, /getStorefrontCustomerSession|GuestOrderClaim/);
  assert.doesNotMatch(client, /TrackingGuestClaim|vinculación|vinculacion/);
  assert.doesNotMatch(actions, /claimStorefrontGuestOrder|trackingAccessToken/);
  assert.match(drawer, /pedidos se añadirán automáticamente/);
  assert.match(authActions, /verás tus pedidos automáticamente/);
  assert.doesNotMatch(actions, /trackingAccessToken/);
});

test("tracking errors offer the right next action", () => {
  const client = source("src/modules/storefront/order-tracking-page.tsx");
  const drawer = source("src/modules/storefront/storefront-auth-drawer.tsx");
  const authActions = source("src/modules/storefront/storefront-auth-actions.ts");
  const recoveryAction = source("src/modules/storefront/storefront-order-tracking-actions.ts");

  assert.match(client, /Este enlace ya no esta disponible/);
  assert.match(client, /Inicia sesión para ver este pedido/);
  assert.match(client, /StorefrontAuthEntry purpose="tracking"/);
  assert.match(client, /trackingReturnTo/);
  assert.doesNotMatch(client, /href="\/auth\/login"/);
  assert.match(drawer, /name="redirectTo" type="hidden" value=\{redirectTo\}/);
  assert.match(drawer, /consultar este pedido y tus compras/);
  assert.match(authActions, /verás tus pedidos automáticamente/);
  assert.match(client, /TrackingAccessRecoveryForm orderReference=\{orderReference\}/);
  assert.match(client, /Email usado al comprar/);
  assert.match(recoveryAction, /requestStorefrontTrackingAccessRecovery/);
  assert.match(recoveryAction, /Si los datos coinciden con una compra/);
  assert.doesNotMatch(recoveryAction, /result\.error/);
  assert.match(client, /Reintentar/);
  assert.match(client, /window\.location\.reload/);
});

test("payment confirmation requests a link through the local protected endpoint", () => {
  const confirmation = source("src/modules/storefront/payment-confirmation-client.tsx");
  const route = source("app/api/storefront/orders/[orderId]/tracking-link/route.ts");

  assert.match(confirmation, /resolveTrackingPath/);
  assert.match(confirmation, /Ver seguimiento del pedido/);
  assert.match(confirmation, /\/api\/storefront\/orders\//);
  assert.match(route, /\/tracking-link\?/);
  assert.match(route, /getStorefrontCustomerAuthorizationHeader/);
  assert.match(route, /x-guest-session-id/);
  assert.match(route, /private, no-store, max-age=0/);
});

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
  assert.match(tracking, /status: 401/);
  assert.match(client, /tracking\.timeline\.map/);
  assert.match(client, /tracking\.shippingModule\.visible/);
  assert.match(client, /window\.history\.replaceState/);
  assert.match(client, /errorStatus === 503/);
  assert.match(loading, /aria-busy="true"/);
});

test("tracking errors offer the right next action", () => {
  const client = source("src/modules/storefront/order-tracking-page.tsx");

  assert.match(client, /Este enlace ya no esta disponible/);
  assert.match(client, /Inicia sesión para ver este pedido/);
  assert.match(client, /Iniciar sesión/);
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

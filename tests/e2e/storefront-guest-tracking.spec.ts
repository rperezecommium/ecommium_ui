import { expect, test } from "@playwright/test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import net from "node:net";

const organizationId = "11111111-1111-4111-8111-111111111111";
const shopId = "22222222-2222-4222-8222-222222222222";
const orderReference = "guest-ui-cert-001";
const validTrackingToken = "a".repeat(43);

let bffServer: Server;
let bffPort = 0;
let nextPort = 0;
let nextProcess: ChildProcessWithoutNullStreams;
let recoveryRequests = 0;
let claimRequests = 0;
let activationRequests = 0;

test.describe.configure({ mode: "serial" });

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(payload));
}

async function freePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  server.close();
  return typeof address === "object" && address ? address.port : 0;
}

async function waitForNext(url: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      // Next is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Next server did not become ready at ${url}`);
}

function trackingPayload() {
  return {
    orderReference,
    status: "IN_TRANSIT",
    title: "Tu pedido está en camino",
    message: "El transportista ya tiene el paquete.",
    placedAt: "2026-07-16T10:00:00.000Z",
    timeline: [{ code: "IN_TRANSIT", label: "En tránsito", completed: true, current: true, occurredAt: "2026-07-16T10:00:00.000Z" }],
    shippingModule: { visible: false, reason: "NOT_AVAILABLE", shipping: null },
  };
}

async function startBffMock() {
  bffPort = await freePort();
  bffServer = createServer((request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
    const tenantMatches = url.searchParams.get("organizationId") === organizationId
      && url.searchParams.get("shopId") === shopId;

    if (request.method === "POST" && url.pathname === "/api/v1/auth/activate") {
      activationRequests += 1;
      sendJson(response, 200, {
        status: "activated",
        profile: { principalId: "customer-ui-id", principalType: "CUSTOMER", email: "guest@example.test" },
      });
      return;
    }

    if (!tenantMatches) {
      sendJson(response, 400, { message: "missing tenant" });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/storefront/order-tracking/access-recovery") {
      recoveryRequests += 1;
      sendJson(response, 202, { accepted: true });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/storefront/me/orders/guest-claim") {
      claimRequests += 1;
      if (request.headers.authorization !== "Bearer customer-ui-token") {
        sendJson(response, 401, { message: "customer token required" });
        return;
      }
      sendJson(response, 201, { orderReference, claimed: true, claimedAt: "2026-07-16T10:01:00.000Z" });
      return;
    }

    if (request.method === "GET" && url.pathname === `/api/v1/storefront/order-tracking/${orderReference}`) {
      if (
        url.searchParams.get("trackingAccessToken") === validTrackingToken
        || request.headers.authorization === "Bearer customer-ui-token"
      ) {
        sendJson(response, 200, trackingPayload());
        return;
      }
      sendJson(response, 404, { message: "order not found" });
      return;
    }

    sendJson(response, 404, { message: "not found" });
  });
  bffServer.listen(bffPort, "127.0.0.1");
  await once(bffServer, "listening");
}

async function startNext() {
  nextPort = await freePort();
  nextProcess = spawn("npx", ["next", "start", "-p", String(nextPort)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ECOMMIUM_BFF_BASE_URL: `http://127.0.0.1:${bffPort}/api/v1`,
      ECOMMIUM_STOREFRONT_ORGANIZATION_ID: organizationId,
      ECOMMIUM_STOREFRONT_SHOP_ID: shopId,
      NEXT_PUBLIC_ECOMMIUM_PUBLIC_BASE_URL: `http://127.0.0.1:${nextPort}`,
    },
  });
  await waitForNext(`http://127.0.0.1:${nextPort}/pedido/${orderReference}/seguimiento`);
}

test.beforeAll(async () => {
  await startBffMock();
  await startNext();
});

test.afterAll(async () => {
  nextProcess?.kill();
  bffServer?.close();
});

test("recovers an expired guest link without revealing order existence", async ({ page }) => {
  await page.goto(`http://127.0.0.1:${nextPort}/pedido/${orderReference}/seguimiento?access=invalid_tracking_token_for_ui_certification_0000000000000`);

  await expect(page.getByRole("heading", { name: "Este enlace ya no esta disponible" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recuperar acceso" })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/pedido/${orderReference}/seguimiento$`));

  await page.getByLabel("Email usado al comprar").fill("guest@example.test");
  await page.getByRole("button", { name: "Enviar nuevo enlace" }).click();

  await expect(page.getByText("Si los datos coinciden con una compra, recibirás un nuevo enlace de seguimiento por email.")).toBeVisible();
  expect(recoveryRequests).toBe(1);
});

test("offers Storefront authentication instead of the Admin login", async ({ page }) => {
  await page.goto(`http://127.0.0.1:${nextPort}/pedido/${orderReference}/seguimiento`);

  const errorPanel = page.locator(".storefrontOrderTrackingError");
  await expect(errorPanel.getByRole("heading", { name: "Inicia sesión para ver este pedido" })).toBeVisible();
  await errorPanel.locator(".storefrontAuthLoginButton").click();
  await expect(errorPanel.getByRole("dialog", { name: "Cuenta cliente" })).toBeVisible();
  await expect(errorPanel.getByText("Inicia sesión para consultar este pedido y tus compras.")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/pedido/${orderReference}/seguimiento$`));
});

test("opens authenticated guest tracking without a manual claim and keeps the private token out of the URL", async ({ page }) => {
  await page.context().addCookies([{
    name: "ecommium_customer_session",
    value: JSON.stringify({
      accessToken: "customer-ui-token",
      refreshToken: "customer-ui-refresh",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      sessionId: "customer-ui-session",
      customerId: "customer-ui-id",
      email: "guest@example.test",
      scope: "storefront",
    }),
    url: `http://127.0.0.1:${nextPort}`,
    httpOnly: true,
    sameSite: "Lax",
  }]);

  await page.goto(`http://127.0.0.1:${nextPort}/pedido/${orderReference}/seguimiento?access=${validTrackingToken}`);

  await expect(page.getByRole("heading", { name: `Pedido #${orderReference}` })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/pedido/${orderReference}/seguimiento$`));
  expect(claimRequests).toBe(0);
});

test("activation links require an explicit user confirmation before calling the BFF", async ({ page }) => {
  await page.goto(`http://127.0.0.1:${nextPort}/auth/activate?token=${validTrackingToken}`);

  await expect(page.getByRole("heading", { name: "Activa tu cuenta" })).toBeVisible();
  expect(activationRequests).toBe(0);

  await page.getByRole("button", { name: "Activar cuenta" }).click();

  await expect(page.getByRole("heading", { name: "Cuenta activada" })).toBeVisible();
  expect(activationRequests).toBe(1);
});

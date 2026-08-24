import { expect, test, type Page } from "@playwright/test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import net from "node:net";

const organizationId = "11111111-1111-4111-8111-111111111111";
const shopId = "22222222-2222-4222-8222-222222222222";
const customerId = "customer-after-sales-wizard";
const customerEmail = "postventa@example.test";
const caseId = "case-after-sales-wizard";

let bffServer: Server;
let bffPort = 0;
let nextPort = 0;
let nextProcess: ChildProcessWithoutNullStreams;
let nextOutput = "";
const capturedCasePayloads: Record<string, unknown>[] = [];

function purchase() {
  return {
    purchaseId: "purchase-after-sales-wizard",
    orderId: "ORD-WIZARD-001",
    orderReference: "ORD-WIZARD-001",
    customerId,
    organizationId,
    shopId,
    status: "DELIVERED",
    isPaid: true,
    currency: "EUR",
    totalAmountMinor: 8990,
    itemsCount: 2,
    items: [{
      lineId: "line-blender",
      productId: "product-blender",
      variantId: "variant-blender",
      productSlug: "batidora-demo",
      productUrlPath: "/pdp/batidora-demo",
      name: "Batidora demo",
      imageUrl: null,
      quantity: 1,
      unitPriceMinor: 5990,
      lineTotalMinor: 5990,
    }, {
      lineId: "line-toaster",
      productId: "product-toaster",
      variantId: "variant-toaster",
      productSlug: "tostadora-demo",
      productUrlPath: "/pdp/tostadora-demo",
      name: "Tostadora demo",
      imageUrl: null,
      quantity: 1,
      unitPriceMinor: 3000,
      lineTotalMinor: 3000,
    }],
    placedAt: "2026-08-01T10:00:00.000Z",
    sourceEventId: "event-after-sales-wizard",
    recordedAt: "2026-08-01T10:01:00.000Z",
  };
}

async function freePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  server.close();
  return typeof address === "object" && address ? address.port : 0;
}

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "private, no-store",
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) as Record<string, unknown> : {};
}

function requireStorefrontAuth(request: IncomingMessage, response: ServerResponse) {
  if (request.headers.authorization !== "Bearer storefront-token") {
    sendJson(response, 401, { message: "storefront token required" });
    return false;
  }
  return true;
}

async function startBffMock() {
  bffPort = await freePort();
  bffServer = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/api/v1/storefront/context/resolve") {
      sendJson(response, 200, {
        organizationId,
        shopId,
        shopAlias: "postventa-e2e",
        locale: "es-ES",
        currency: "EUR",
        country: "ES",
        channel: "web",
      });
      return;
    }

    if (url.pathname.startsWith("/api/v1/storefront/me") && !requireStorefrontAuth(request, response)) {
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/storefront/me/profile") {
      sendJson(response, 200, {
        profile: {
          customerId,
          organizationId,
          shopId,
          email: customerEmail,
          firstName: "Clara",
          lastName: "Cliente",
          avatarId: "human-01",
          phone: null,
          clientPreferencesData: { locale: "es-ES", optinNewsLetter: false },
        },
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/storefront/me/avatar-options") {
      sendJson(response, 200, { items: [] });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/storefront/me/addresses") {
      sendJson(response, 200, { maxAddresses: 5, count: 0, items: [] });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/storefront/me/purchases") {
      sendJson(response, 200, { customerId, total: 1, limit: 5, offset: 0, items: [purchase()] });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/storefront/me/invoices") {
      sendJson(response, 200, { customerId, total: 0, limit: 5, offset: 0, items: [] });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/auth/sessions") {
      sendJson(response, 200, { sessions: [], total: 0 });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/storefront/me/after-sales/cases") {
      sendJson(response, 200, { items: [], total: 0, limit: 10, offset: 0 });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/storefront/me/after-sales/cases") {
      const body = await readJsonBody(request);
      capturedCasePayloads.push(body);
      sendJson(response, 201, {
        caseId,
        caseType: "DAMAGED",
        status: "OPEN",
        lifecycleStatus: "OPEN",
        autoCloseAt: null,
        reasonCode: "DAMAGED",
        submittedAt: "2026-08-22T12:00:00.000Z",
        updatedAt: "2026-08-22T12:00:00.000Z",
        lastMessagePreview: "La batidora llegó con daños visibles.",
        canReply: true,
      });
      return;
    }

    sendJson(response, 404, { message: `Unhandled mock route ${request.method} ${url.pathname}` });
  });
  bffServer.listen(bffPort, "127.0.0.1");
  await once(bffServer, "listening");
}

async function waitForNext(url: string) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      // Next is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Next server did not become ready at ${url}`);
}

async function startNext() {
  nextPort = await freePort();
  nextProcess = spawn("npx", ["next", "start", "-p", String(nextPort)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "development",
      ECOMMIUM_ADMIN_BFF_BASE_URL: "http://127.0.0.1:1/api/v1",
      ECOMMIUM_STOREFRONT_BFF_BASE_URL: `http://127.0.0.1:${bffPort}/api/v1`,
      ECOMMIUM_STOREFRONT_ORGANIZATION_ID: organizationId,
      ECOMMIUM_STOREFRONT_SHOP_ID: shopId,
    },
  });
  nextProcess.stdout.on("data", (chunk) => { nextOutput += chunk.toString(); });
  nextProcess.stderr.on("data", (chunk) => { nextOutput += chunk.toString(); });

  try {
    await waitForNext(`http://127.0.0.1:${nextPort}/account`);
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nNext output:\n${nextOutput}`);
  }
}

async function authenticateStorefront(page: Page) {
  await page.context().addCookies([{
    name: "ecommium_customer_session",
    value: JSON.stringify({
      accessToken: "storefront-token",
      refreshToken: "storefront-refresh",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      sessionId: "storefront-session",
      customerId,
      email: customerEmail,
      organizationId,
      shopId,
      scope: "storefront",
    }),
    domain: "127.0.0.1",
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  }]);
}

test.beforeAll(async () => {
  await startBffMock();
  await startNext();
});

test.beforeEach(() => {
  capturedCasePayloads.length = 0;
  nextOutput = "";
});

test.afterAll(async () => {
  nextProcess?.kill();
  bffServer?.close();
});

test("guía la apertura de un caso sin obligar evidencias y envía solo la línea elegida", async ({ page }) => {
  await authenticateStorefront(page);
  await page.goto(`http://127.0.0.1:${nextPort}/account?section=afterSales`);

  await expect(page.getByRole("heading", { name: "¿Qué necesitas hacer?" })).toBeVisible();
  await page.getByRole("link", { name: "Abrir un caso nuevo" }).click();

  await expect(page.getByRole("heading", { name: "¿En qué compra ocurrió?" })).toBeVisible();
  const purchaseStep = page.getByRole("region", { name: "¿En qué compra ocurrió?" });
  await purchaseStep.locator("select").selectOption("ORD-WIZARD-001");
  await purchaseStep.locator("input[type=checkbox]").first().check();
  await page.getByRole("button", { name: "Siguiente" }).click();

  await expect(page.getByRole("heading", { name: "Cuéntanos qué ha ocurrido" })).toBeVisible();
  const detailsStep = page.getByRole("region", { name: "Cuéntanos qué ha ocurrido" });
  await detailsStep.locator("select").nth(0).selectOption("DAMAGED");
  await detailsStep.locator("select").nth(1).selectOption("REPLACEMENT");
  await detailsStep.locator("textarea").fill("La batidora llegó con daños visibles y necesito un reemplazo.");
  await page.getByRole("button", { name: "Siguiente" }).click();

  await expect(page.getByRole("heading", { name: "¿Deseas aportar evidencias?" })).toBeVisible();
  await expect(page.getByText("Batidora demo · 1 unidad")).toBeVisible();
  await expect(page.getByText("Producto dañado")).toBeVisible();
  await expect(page.getByText("Reemplazo")).toBeVisible();
  await page.getByRole("button", { name: "Abrir caso" }).click();

  await expect(page.getByRole("heading", { name: "Tu caso ya está abierto" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver caso" })).toHaveAttribute("href", new RegExp(`caseId=${caseId}$`));
  expect(capturedCasePayloads).toEqual([{
    orderId: "ORD-WIZARD-001",
    reasonCode: "DAMAGED",
    requestedResolution: "REPLACEMENT",
    customerMessage: "La batidora llegó con daños visibles y necesito un reemplazo.",
    items: [{ orderLineId: "line-blender", quantityRequested: 1 }],
    source: "storefront_account",
  }]);
});

import { expect, test, type Page } from "@playwright/test";
import { once } from "node:events";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import net from "node:net";

const organizationId = "11111111-1111-4111-8111-111111111111";
const shopId = "22222222-2222-4222-8222-222222222222";

let bffServer: Server;
let bffPort = 0;
let nextPort = 0;
let nextProcess: ChildProcessWithoutNullStreams;
let patchBodies: Array<Record<string, unknown>> = [];

let configuration = {
  organizationId,
  shopId,
  version: 1,
  storeContext: {
    defaultLocale: "es-ES",
    defaultCurrency: "EUR",
    defaultCountry: "ES",
  },
  orderFormConfiguration: {
    recaptchaValidation: true,
    recaptchaMinScore: 0.5,
    allowManualPrice: false,
    savePersonalDataAsOptIn: true,
    paymentSystemToCheckFirstInstallment: ["visa", "mastercard"],
  },
  isActive: true,
  createdAt: "2026-07-17T10:00:00.000Z",
  updatedAt: "2026-07-17T10:00:00.000Z",
};
let configurationState: "INITIAL" | "PERSISTED" = "INITIAL";

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) as Record<string, unknown> : {};
}

async function freePort() {
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Unable to allocate a local port"));
        return;
      }
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

function checkoutResponse() {
  return {
    configurationState,
    configuration,
    checkoutResponseMessages: [{
      code: configuration.isActive ? "CHECKOUT_CONFIGURATION_ACTIVE" : "CHECKOUT_CONFIGURATION_INACTIVE",
      message: configuration.isActive ? "Checkout habilitado para esta tienda." : "Checkout deshabilitado para esta tienda.",
      scope: "ORDER_PLACEMENT",
    }],
  };
}

async function startBffMock() {
  bffPort = await freePort();
  bffServer = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

    if (request.method === "POST" && url.pathname === "/api/v1/auth/login") {
      sendJson(response, 200, {
        profile: { principalId: "employee-checkout", principalType: "EMPLOYEE", email: "admin@example.com" },
        session: { sessionId: "session-checkout", principalType: "EMPLOYEE", scope: "admin" },
        tokens: { accessToken: "access-token", refreshToken: "refresh-token", expiresInSeconds: 900 },
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/auth/me") {
      sendJson(response, 200, {
        principal: {
          sub: "employee-checkout",
          principalType: "EMPLOYEE",
          email: "admin@example.com",
          roles: ["admin"],
          permissions: ["checkout.configuration.write"],
          scope: "admin",
        },
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/context/available") {
      sendJson(response, 200, {
        organizations: [{ organizationId, name: "Ecommium Demo" }],
        shops: [{
          shopId,
          organizationId,
          name: "Madrid",
          shopAlias: "madrid",
          primaryDomain: "madrid.test",
          status: "ACTIVE",
          defaultLocale: "es-ES",
          defaultCurrency: "EUR",
          defaultCountry: "ES",
        }],
        defaultContext: { organizationId, shopId },
        selectionRequired: false,
      });
      return;
    }

    if (url.pathname === "/api/v1/admin/checkout/configuration/orderform") {
      if (url.searchParams.get("organizationId") !== organizationId || url.searchParams.get("shopId") !== shopId) {
        sendJson(response, 400, { message: "invalid tenant context" });
        return;
      }
      if (request.headers.authorization !== "Bearer access-token") {
        sendJson(response, 401, { message: "missing authorization" });
        return;
      }

      if (request.method === "GET") {
        sendJson(response, 200, checkoutResponse());
        return;
      }

      if (request.method === "PATCH") {
        const body = await readJson(request);
        patchBodies.push(body);
        const storeContext = body.storeContext as typeof configuration.storeContext;
        const orderFormConfiguration = body.orderFormConfiguration as typeof configuration.orderFormConfiguration;

        configuration = {
          ...configuration,
          ...body,
          storeContext,
          orderFormConfiguration,
          version: configurationState === "INITIAL" ? 1 : configuration.version + 1,
          updatedAt: "2026-07-17T10:05:00.000Z",
        };
        configurationState = "PERSISTED";
        sendJson(response, 200, checkoutResponse());
        return;
      }
    }

    sendJson(response, 404, { message: `Unhandled mock route ${request.method} ${url.pathname}` });
  });

  bffServer.listen(bffPort, "127.0.0.1");
  await once(bffServer, "listening");
}

async function waitForNext(url: string) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      // Next is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Next did not become ready at ${url}`);
}

async function startNext() {
  nextPort = await freePort();
  nextProcess = spawn("npx", ["next", "start", "-p", String(nextPort)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ECOMMIUM_ADMIN_BFF_BASE_URL: `http://127.0.0.1:${bffPort}/api/v1`,
    },
  });
  await waitForNext(`http://127.0.0.1:${nextPort}/auth/login`);
}

async function login(page: Page) {
  await page.goto(`http://127.0.0.1:${nextPort}/auth/login`);
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password").fill("secret123");
  await page.getByRole("button", { name: "Entrar con BFF Auth" }).click();
  await page.waitForURL(`http://127.0.0.1:${nextPort}/admin`);
}

test.beforeAll(async () => {
  await startBffMock();
  await startNext();
});

test.beforeEach(() => {
  patchBodies = [];
  configurationState = "INITIAL";
  configuration = {
    ...configuration,
    version: 1,
    storeContext: { defaultLocale: "es-ES", defaultCurrency: "EUR", defaultCountry: "ES" },
    orderFormConfiguration: {
      recaptchaValidation: true,
      recaptchaMinScore: 0.5,
      allowManualPrice: false,
      savePersonalDataAsOptIn: true,
      paymentSystemToCheckFirstInstallment: ["visa", "mastercard"],
    },
    isActive: true,
  };
});

test.afterAll(async () => {
  nextProcess?.kill();
  bffServer?.close();
});

test("admin materializes an initial checkout configuration and confirms a later deactivation", async ({ page }) => {
  await login(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/checkout`);

  await expect(page.getByText("Aún no hay configuración guardada para esta tienda.")).toBeVisible();
  await page.getByRole("link", { name: "Editar configuración" }).click();
  await expect(page.getByRole("complementary", { name: "Editar configuración de Checkout" })).toBeVisible();
  await expect(page.getByLabel("Moneda predeterminada")).toHaveCount(0);
  await page.getByRole("button", { name: "Guardar configuración" }).click();

  await expect(page.getByText("Configuración de Checkout guardada. Versión 1.")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Editar configuración de Checkout" })).toHaveCount(0);
  expect(patchBodies).toHaveLength(1);
  expect(patchBodies[0]).toMatchObject({
    isActive: true,
    storeContext: { defaultCurrency: "EUR" },
  });

  await page.getByRole("link", { name: "Editar configuración" }).click();
  await page.getByLabel("Checkout activo para esta tienda").uncheck();
  await expect(page.getByText("Vas a desactivar Checkout.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmar desactivación" })).toBeDisabled();
  await page.getByLabel("Confirmar desactivación de Checkout").fill("DESACTIVAR CHECKOUT");
  await page.getByRole("button", { name: "Confirmar desactivación" }).click();

  await expect(page.getByText("Configuración de Checkout guardada. Versión 2.")).toBeVisible();
  expect(patchBodies).toHaveLength(2);
  expect(patchBodies[1]).toMatchObject({ isActive: false });
});

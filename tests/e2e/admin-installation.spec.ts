import { expect, test, type Page } from "@playwright/test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { once } from "node:events";
import net from "node:net";

type InstallationState =
  | "NOT_INITIALIZED"
  | "FRESH_CLAIM_REQUIRED"
  | "FRESH_READY"
  | "ADOPTION_REQUIRED"
  | "REVIEW_REQUIRED"
  | "COMPLETED";

type CapturedMutation = {
  path: string;
  body: Record<string, unknown>;
};

const organizationId = "11111111-1111-4111-8111-111111111111";
const shopId = "22222222-2222-4222-8222-222222222222";
const accessToken = makeJwt({
  sub: "admin-zero",
  principalType: "EMPLOYEE",
  scope: "admin",
  roles: ["admin", "superadmin"],
  permissions: ["*", "system.admin"],
  sessionId: "session-admin-zero",
  exp: Math.floor(Date.now() / 1000) + 3600,
});

let bffServer: Server;
let bffPort = 0;
let nextPort = 0;
let nextProcess: ChildProcessWithoutNullStreams;
let installationState: InstallationState = "COMPLETED";
let organizationCreated = false;
let shopCreated = false;
const mutations: CapturedMutation[] = [];

function makeJwt(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.signature`;
}

function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function readBody(request: IncomingMessage) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("error", reject);
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<string, unknown>);
      } catch (error) {
        reject(error);
      }
    });
  });
}

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, {
    "cache-control": "private, no-store, max-age=0",
    "content-type": "application/json",
  });
  response.end(JSON.stringify(payload));
}

function installationActions(state: InstallationState) {
  return {
    completeFresh: state === "FRESH_READY",
    completeAdoption: state === "ADOPTION_REQUIRED",
    contactOperator: ["NOT_INITIALIZED", "FRESH_CLAIM_REQUIRED", "REVIEW_REQUIRED"].includes(state),
  };
}

function isAuthenticated(request: IncomingMessage) {
  return request.headers.authorization === `Bearer ${accessToken}`;
}

async function startBffMock() {
  bffPort = await freePort();
  bffServer = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${bffPort}`);

    if (request.method === "GET" && url.pathname === "/api/v1/admin/installation/status") {
      sendJson(response, 200, {
        schema: "admin-installation-public-status.v1",
        state: installationState,
        actions: installationActions(installationState),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/installation/fresh-completion") {
      const body = await readBody(request);
      mutations.push({ path: url.pathname, body });
      if (installationState !== "FRESH_READY") {
        sendJson(response, 409, { code: "ADMIN_INSTALLATION_STATE_CONFLICT" });
        return;
      }
      installationState = "COMPLETED";
      sendJson(response, 200, {
        schema: "admin-installation-public-fresh-completion.v1",
        outcome: "CREATED",
        state: "COMPLETED",
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/auth/login") {
      const body = await readBody(request);
      mutations.push({ path: url.pathname, body });
      sendJson(response, 200, {
        profile: {
          principalId: "admin-zero",
          principalType: "EMPLOYEE",
          email: body.email,
        },
        session: {
          sessionId: "session-admin-zero",
          principalType: "EMPLOYEE",
          scope: "admin",
        },
        tokens: {
          accessToken,
          refreshToken: "refresh-token",
          expiresInSeconds: 3600,
        },
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/auth/me" && isAuthenticated(request)) {
      sendJson(response, 200, {
        principal: {
          sub: "admin-zero",
          principalType: "EMPLOYEE",
          scope: "admin",
          email: "admin.zero@example.test",
          roles: ["admin", "superadmin"],
          permissions: ["*", "system.admin"],
          tenantAccess: { level: "SYSTEM", shopScopes: [] },
        },
        session: { sessionId: "session-admin-zero" },
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/context/available" && isAuthenticated(request)) {
      sendJson(response, 200, {
        tenantAccess: { level: "SYSTEM", shopScopes: [] },
        organizations: organizationCreated
          ? [{ organizationId, name: "Organization Playwright" }]
          : [],
        shops: shopCreated
          ? [{
              organizationId,
              organizationName: "Organization Playwright",
              shopId,
              shopName: "Tienda Playwright",
              shopAlias: "tienda-playwright",
              status: "ACTIVE",
              effectiveSettings: {
                defaultLocale: "es-ES",
                defaultCurrency: "EUR",
                defaultCountry: "ES",
              },
            }]
          : [],
        ...(shopCreated ? { defaultContext: { organizationId, shopId } } : {}),
        selectionRequired: false,
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/session/step-up" && isAuthenticated(request)) {
      const body = await readBody(request);
      mutations.push({ path: url.pathname, body });
      sendJson(response, 200, {
        status: "VERIFIED",
        method: "PASSWORD",
        verifiedAt: "2026-08-14T10:00:00.000Z",
        expiresAt: "2026-08-14T10:10:00.000Z",
        enforcement: "ENABLED",
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/installation/adoption-completion" && isAuthenticated(request)) {
      const body = await readBody(request);
      mutations.push({ path: url.pathname, body });
      if (installationState !== "ADOPTION_REQUIRED") {
        sendJson(response, 409, { code: "ADMIN_INSTALLATION_STATE_CONFLICT" });
        return;
      }
      installationState = "COMPLETED";
      sendJson(response, 200, {
        schema: "admin-installation-public-adoption-completion.v1",
        outcome: "ADOPTED",
        state: "COMPLETED",
        security: {
          revokedSessions: 2,
          currentSessionRevoked: true,
          requiresLogin: true,
        },
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/organizations-shops/organizations" && isAuthenticated(request)) {
      const body = await readBody(request);
      mutations.push({ path: url.pathname, body });
      organizationCreated = true;
      sendJson(response, 201, {
        organizationId,
        name: body.name,
        legalName: body.legalName ?? null,
        defaultSettings: body.defaultSettings,
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/organizations-shops/shops" && isAuthenticated(request)) {
      const body = await readBody(request);
      mutations.push({ path: url.pathname, body });
      expect(url.searchParams.get("organizationId")).toBe(organizationId);
      shopCreated = true;
      sendJson(response, 201, {
        organizationId,
        shopId,
        name: body.name,
        shopAlias: body.shopAlias,
        status: body.status,
        effectiveSettings: body.settingsOverride,
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/organizations-shops/shops/context/resolve" && isAuthenticated(request)) {
      sendJson(response, 200, {
        organizationId,
        shopId,
        name: "Tienda Playwright",
        shopAlias: "tienda-playwright",
        status: "ACTIVE",
        settings: {},
      });
      return;
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
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`Next server did not become ready at ${url}`);
}

async function startNext() {
  nextPort = await freePort();
  nextProcess = spawn("npx", ["next", "start", "-p", String(nextPort)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ECOMMIUM_ADMIN_BFF_BASE_URL: `http://127.0.0.1:${bffPort}/api/v1`,
      ECOMMIUM_UI_ADMIN_SESSION_SECRET: "playwright-admin-session-secret-2026",
      ECOMMIUM_STOREFRONT_BFF_BASE_URL: "https://storefront.example.test/api/v1",
      ECOMMIUM_STOREFRONT_ORGANIZATION_ID: "organization-playwright",
      ECOMMIUM_STOREFRONT_SHOP_ID: "shop-playwright",
    },
  });
  await waitForNext(`http://127.0.0.1:${nextPort}/admin/installation`);
}

async function loginSystemAdmin(page: Page, next = "/admin") {
  await page.goto(`http://127.0.0.1:${nextPort}/auth/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill("admin.zero@example.test");
  await page.getByLabel("Password").fill("Current Password 2026!");
  await page.getByRole("button", { name: "Entrar con BFF Auth" }).click();
}

async function expectNoUnlabelledFields(page: Page) {
  const count = await page.locator("input:not([type=hidden]), select, textarea").evaluateAll((elements) =>
    elements.filter((element) => {
      const field = element as HTMLInputElement;
      return field.labels?.length === 0 && !field.getAttribute("aria-label") && !field.getAttribute("aria-labelledby");
    }).length,
  );
  expect(count).toBe(0);
}

test.beforeAll(async () => {
  await startBffMock();
  await startNext();
});

test.beforeEach(async ({ context }) => {
  installationState = "COMPLETED";
  organizationCreated = false;
  shopCreated = false;
  mutations.length = 0;
  await context.clearCookies();
});

test.afterAll(async () => {
  nextProcess?.kill();
  bffServer?.close();
});

test("fresh creates only Admin 0 and then requires normal login", async ({ page }) => {
  installationState = "FRESH_READY";
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`http://127.0.0.1:${nextPort}/auth/login`);
  await page.waitForURL(`http://127.0.0.1:${nextPort}/admin/installation`);

  await expect(page.getByRole("heading", { name: "Crear el primer SuperAdmin SYSTEM" })).toBeVisible();
  await expectNoUnlabelledFields(page);
  await page.getByLabel("Nombre").fill("Admin");
  await page.getByLabel("Apellidos").fill("Zero");
  await page.getByLabel("Email de Admin 0").fill("admin.zero@example.test");
  await page.getByLabel("Claim de instalación").fill("one-time-claim");
  await page.getByLabel("Contraseña", { exact: true }).fill(" Fresh Password 2026! ");
  await page.getByLabel("Confirmar contraseña").fill(" Fresh Password 2026! ");
  await page.getByRole("button", { name: "Crear Admin 0" }).click();

  await page.waitForURL(/\/auth\/login\?authNotice=/);
  await expect(page.getByText(/Admin 0 fue creado/)).toBeVisible();
  expect(mutations.find((item) => item.path.endsWith("fresh-completion"))?.body).toEqual({
    claim: "one-time-claim",
    email: "admin.zero@example.test",
    password: " Fresh Password 2026! ",
    firstName: "Admin",
    lastName: "Zero",
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("review blocks automation without exposing candidate details", async ({ page }) => {
  installationState = "REVIEW_REQUIRED";
  await page.goto(`http://127.0.0.1:${nextPort}/admin/installation`);

  await expect(page.getByRole("heading", { name: "Contacta con el operador de plataforma" })).toBeVisible();
  await expect(page.getByText(/no muestra candidatos, emails, IDs ni motivos internos/i)).toBeVisible();
  await expect(page.locator("input")).toHaveCount(0);
  await expect(page.getByRole("button")).toHaveCount(0);
});

test("adoption performs step-up, changes password and clears the revoked session", async ({ page }) => {
  installationState = "ADOPTION_REQUIRED";
  await page.goto(`http://127.0.0.1:${nextPort}/admin/installation`);
  await page.getByRole("link", { name: "Iniciar sesión para adoptar" }).click();
  await page.getByLabel("Email").fill("admin.zero@example.test");
  await page.getByLabel("Password").fill(" Current Password 2026! ");
  await page.getByRole("button", { name: "Entrar con BFF Auth" }).click();
  await page.waitForURL(`http://127.0.0.1:${nextPort}/admin/installation`);

  await expect(page.getByRole("heading", { name: "Adoptar el administrador existente" })).toBeVisible();
  await expectNoUnlabelledFields(page);
  await page.getByLabel("Contraseña actual").fill(" Current Password 2026! ");
  await page.getByLabel("Nueva contraseña", { exact: true }).fill(" New Password 2026! ");
  await page.getByLabel("Confirmar nueva contraseña").fill(" New Password 2026! ");
  await page.getByRole("button", { name: "Adoptar Admin 0 y revocar sesiones" }).click();

  await page.waitForURL(/\/auth\/login\?authNotice=/);
  await expect(page.getByText(/todas sus sesiones se revocaron/)).toBeVisible();
  expect(mutations.find((item) => item.path.endsWith("session/step-up"))?.body).toEqual({
    currentPassword: " Current Password 2026! ",
  });
  expect(mutations.find((item) => item.path.endsWith("adoption-completion"))?.body).toEqual({
    newPassword: " New Password 2026! ",
  });

  await page.goto(`http://127.0.0.1:${nextPort}/admin`);
  await page.waitForURL(/\/auth\/login\?next=\/admin/);
});

test("SYSTEM session without a shop enters separate Organization and Shop onboarding", async ({ page }) => {
  installationState = "COMPLETED";
  await loginSystemAdmin(page);
  await page.waitForURL(/\/admin\/configuracion\/contexto\?tab=create-organization/);

  await expect(page.getByText(/Tu sesión SYSTEM está activa/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Crear Organization" })).toBeVisible();
  await expectNoUnlabelledFields(page);
  const organizationForm = page.locator("#create-organization-form");
  await organizationForm.getByLabel("Nombre", { exact: true }).fill("Organization Playwright");
  await organizationForm.getByLabel("Razón social").fill("Organization Playwright SL");
  await organizationForm.getByRole("button", { name: "Crear Organization y continuar" }).click();

  await page.waitForURL(/\/admin\/configuracion\/contexto\?tab=create-shop/);
  await expect(page.getByText(/fue creada\. Crea ahora su primera tienda/)).toBeVisible();
  const shopForm = page.locator("#create-shop-form");
  await shopForm.getByLabel("Organization").selectOption(organizationId);
  await shopForm.getByLabel("Nombre", { exact: true }).fill("Tienda Playwright");
  await shopForm.getByLabel("shopAlias", { exact: true }).fill("tienda-playwright");
  await shopForm.getByLabel("Estado operativo").selectOption("ACTIVE");
  await shopForm.getByRole("button", { name: "Crear tienda", exact: true }).click();

  await page.waitForURL(/\/admin\/configuracion\/contexto\?contextNotice=/);
  await expect(page.getByText("Tienda creada y marcada como contexto activo.")).toBeVisible();
  await expect(
    page.locator(".adminKpi").filter({ hasText: "Shop activa" }).getByText("Tienda Playwright"),
  ).toBeVisible();
  expect(mutations.find((item) => item.path.endsWith("organizations"))?.body).toMatchObject({
    name: "Organization Playwright",
    legalName: "Organization Playwright SL",
  });
  expect(mutations.find((item) => item.path.endsWith("shops"))?.body).toMatchObject({
    name: "Tienda Playwright",
    shopAlias: "tienda-playwright",
    status: "ACTIVE",
  });
  expect(mutations.some((item) => item.path.includes("installation") && item.path.endsWith("organizations"))).toBe(false);
});

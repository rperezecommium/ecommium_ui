import { expect, test, type Page } from "@playwright/test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { createServer, type Server, type ServerResponse } from "node:http";
import net from "node:net";

const organizationId = "11111111-1111-4111-8111-111111111111";
const shopId = "22222222-2222-4222-8222-222222222222";
const locale = "es-ES";

let bffServer: Server;
let bffPort = 0;
let nextPort = 0;
let nextProcess: ChildProcessWithoutNullStreams;
let nextOutput = "";
let configurationVersion = 1;
let snapshotFingerprint = "sha256:consent-v1";
let policyUnavailable = false;
let currentDecision: Record<string, unknown> | null = null;
let policyRequests: URL[] = [];
let decisionRequests: Array<Record<string, unknown>> = [];
let googleScriptRequests: string[] = [];
let metaPixelScriptRequests: string[] = [];
let matomoScriptRequests: string[] = [];
let clarityScriptRequests: string[] = [];

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "cache-control": "no-store", "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function policyResponse() {
  return {
    status: "AVAILABLE",
    effectiveLocale: locale,
    snapshotFingerprint,
    renewalRequired: currentDecision === null,
    snapshot: {
      configurationVersionId: "consent-configuration-version",
      version: configurationVersion,
      effectiveLocale: locale,
      policy: {
        firstLayerRejectAction: true,
        purposes: [
          {
            purposeKey: "necessary",
            necessary: true,
            content: { [locale]: { title: "Necesarias", description: "Mantienen la tienda operativa." } },
          },
          {
            purposeKey: "analytics",
            necessary: false,
            content: { [locale]: { title: "Analítica", description: "Mide el uso de la tienda." } },
          },
          {
            purposeKey: "marketing",
            necessary: false,
            content: { [locale]: { title: "Marketing", description: "Mide campañas publicitarias." } },
          },
        ],
        services: [
          { serviceKey: "core", purposeKeys: ["necessary"] },
          {
            serviceKey: "analytics",
            purposeKeys: ["analytics"],
            integration: {
              providerKey: "google-analytics",
              contractVersion: 1,
              enabled: true,
              publicConfig: { measurementId: "G-ABCDE123" },
            },
          },
          {
            serviceKey: "meta-pixel",
            purposeKeys: ["marketing"],
            integration: {
              providerKey: "meta-pixel",
              contractVersion: 1,
              enabled: true,
              publicConfig: { pixelId: "123456789012345" },
            },
          },
          {
            serviceKey: "matomo-cloud",
            purposeKeys: ["analytics"],
            integration: {
              providerKey: "matomo-cloud",
              contractVersion: 1,
              enabled: true,
              publicConfig: { cloudHost: "tienda.matomo.cloud", siteId: "7" },
            },
          },
          {
            serviceKey: "microsoft-clarity",
            purposeKeys: ["analytics"],
            integration: {
              providerKey: "microsoft-clarity",
              contractVersion: 1,
              enabled: true,
              publicConfig: { projectId: "abc123" },
            },
          },
        ],
      },
    },
    decision: currentDecision,
  };
}

function resetConsentState() {
  configurationVersion = 1;
  snapshotFingerprint = "sha256:consent-v1";
  policyUnavailable = false;
  currentDecision = null;
  policyRequests = [];
  decisionRequests = [];
  googleScriptRequests = [];
  metaPixelScriptRequests = [];
  matomoScriptRequests = [];
  clarityScriptRequests = [];
}

function selectionsFor(action: string) {
  if (action === "ACCEPT_ALL") return [{ purposeKey: "analytics", status: "GRANTED" }, { purposeKey: "marketing", status: "GRANTED" }];
  if (action === "SAVE_PREFERENCES") return [];
  return [];
}

async function freePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  server.close();
  return typeof address === "object" && address ? address.port : 0;
}

async function startBffMock() {
  bffPort = await freePort();
  bffServer = createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${bffPort}`);
    if (url.pathname === "/api/v1/storefront/context/resolve") {
      return sendJson(response, 200, {
        organizationId,
        shopId,
        shopAlias: "tienda-prueba",
        locale,
        currency: "EUR",
        country: "ES",
        channel: "web",
      });
    }
    if (url.pathname === "/api/v1/storefront/navigation/categories/tree/3") {
      return sendJson(response, 200, { categories: [] });
    }
    if (url.pathname === "/api/v1/storefront/plp/bike-drivetrain") {
      return sendJson(response, 200, {
        categorySlug: "bike-drivetrain",
        resolvedLocale: locale,
        total: 0,
        limit: 16,
        offset: 0,
        products: [],
        cmsBlocks: { beforeList: [], afterList: [] },
      });
    }
    return sendJson(response, 404, { message: "not found" });
  });
  bffServer.listen(bffPort, "127.0.0.1");
  await once(bffServer, "listening");
}

async function waitForNext(url: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      // El servidor todavía está iniciando.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Next no quedó disponible en ${url}: ${nextOutput}`);
}

async function startNext() {
  nextPort = await freePort();
  nextProcess = spawn("npx", ["next", "start", "-p", String(nextPort)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      // El proceso publicado se usa solo como servidor aislado de la prueba;
      // el mock BFF HTTP es local y no representa una configuración productiva.
      NODE_ENV: "development",
      ECOMMIUM_ADMIN_BFF_BASE_URL: "http://127.0.0.1:1/api/v1",
      ECOMMIUM_STOREFRONT_BFF_BASE_URL: `http://127.0.0.1:${bffPort}/api/v1`,
      ECOMMIUM_STOREFRONT_ORGANIZATION_ID: organizationId,
      ECOMMIUM_STOREFRONT_SHOP_ID: shopId,
      ECOMMIUM_STOREFRONT_LOCALE: locale,
      NEXT_PUBLIC_ECOMMIUM_PUBLIC_BASE_URL: `http://127.0.0.1:${nextPort}`,
    },
  });
  nextProcess.stdout.on("data", (data: Buffer) => { nextOutput += data.toString(); });
  nextProcess.stderr.on("data", (data: Buffer) => { nextOutput += data.toString(); });
  await waitForNext(`http://127.0.0.1:${nextPort}/plp/bike-drivetrain`);
}

async function installConsentMock(page: Page) {
  await page.route(/\/api\/v1\/storefront\/consent\/policy\?/, async (route) => {
    policyRequests.push(new URL(route.request().url()));
    if (policyUnavailable) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "UNAVAILABLE" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(policyResponse()) });
  });
  await page.route(/\/api\/v1\/storefront\/consent\/decisions\?/, async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    decisionRequests.push(body);
    currentDecision = {
      action: body.action,
      selections: selectionsFor(String(body.action)),
    };
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ receiptId: "receipt-test" }) });
  });
  await page.route(/^https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-ABCDE123$/, async (route) => {
    googleScriptRequests.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "text/javascript", body: "" });
  });
  await page.route("https://connect.facebook.net/en_US/fbevents.js", async (route) => {
    metaPixelScriptRequests.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "text/javascript", body: "" });
  });
  await page.route("https://tienda.matomo.cloud/matomo.js", async (route) => {
    matomoScriptRequests.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "text/javascript", body: "" });
  });
  await page.route("https://www.clarity.ms/tag/abc123", async (route) => {
    clarityScriptRequests.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "text/javascript", body: "" });
  });
}

async function openStorefront(page: Page, externalRequests: string[]) {
  const ownOrigin = `http://127.0.0.1:${nextPort}`;
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== ownOrigin) externalRequests.push(request.url());
  });
  await installConsentMock(page);
  await page.goto(`${ownOrigin}/plp/bike-drivetrain`);
}

test.beforeAll(async () => {
  await startBffMock();
  await startNext();
});

test.beforeEach(() => resetConsentState());

test.afterAll(async () => {
  nextProcess?.kill();
  bffServer?.close();
});

test("aceptar registra el contrato, bloquea proveedores antes y carga cada adapter una única vez después", async ({ page }) => {
  const externalRequests: string[] = [];
  await openStorefront(page, externalRequests);

  await expect(page.getByRole("heading", { name: "Tus decisiones de privacidad" })).toBeVisible();
  expect(policyRequests).toHaveLength(1);
  expect(policyRequests[0].searchParams.get("organizationId")).toBe(organizationId);
  expect(policyRequests[0].searchParams.get("shopId")).toBe(shopId);
  expect(policyRequests[0].searchParams.get("locale")).toBe(locale);
  expect(externalRequests).toEqual([]);
  expect(googleScriptRequests).toEqual([]);
  expect(metaPixelScriptRequests).toEqual([]);
  expect(matomoScriptRequests).toEqual([]);
  expect(clarityScriptRequests).toEqual([]);

  await page.getByRole("button", { name: "Aceptar todo" }).click();
  await expect(page.getByRole("button", { name: "Privacidad y cookies" })).toBeVisible();
  await expect.poll(() => googleScriptRequests).toEqual(["https://www.googletagmanager.com/gtag/js?id=G-ABCDE123"]);
  await expect.poll(() => metaPixelScriptRequests).toEqual(["https://connect.facebook.net/en_US/fbevents.js"]);
  await expect.poll(() => matomoScriptRequests).toEqual(["https://tienda.matomo.cloud/matomo.js"]);
  await expect.poll(() => clarityScriptRequests).toEqual(["https://www.clarity.ms/tag/abc123"]);
  expect(decisionRequests).toHaveLength(1);
  expect(decisionRequests[0]).toMatchObject({
    configurationVersionId: "consent-configuration-version",
    configurationVersion: 1,
    snapshotFingerprint: "sha256:consent-v1",
    effectiveLocale: locale,
    action: "ACCEPT_ALL",
    origin: "BANNER",
  });
  expect(decisionRequests[0].idempotencyKey).toEqual(expect.any(String));
});

test("rechazar mantiene el storefront operativo y deniega Analítica y Marketing", async ({ page }) => {
  await openStorefront(page, []);
  await page.getByRole("button", { name: "Rechazar opcionales" }).click();

  await expect(page.getByRole("button", { name: "Privacidad y cookies" })).toBeVisible();
  expect(decisionRequests[0]).toMatchObject({ action: "REJECT_ALL", selections: [], origin: "BANNER" });
  expect(googleScriptRequests).toEqual([]);
  expect(metaPixelScriptRequests).toEqual([]);
  expect(matomoScriptRequests).toEqual([]);
  expect(clarityScriptRequests).toEqual([]);
});

test("retirar consentimiento envía WITHDRAW_ALL desde el centro de preferencias", async ({ page }) => {
  currentDecision = { action: "ACCEPT_ALL", selections: [{ purposeKey: "analytics", status: "GRANTED" }] };
  await openStorefront(page, []);

  await page.getByRole("button", { name: "Privacidad y cookies" }).click();
  await expect(page.getByRole("dialog", { name: "Preferencias de privacidad" })).toBeVisible();
  await page.getByRole("button", { name: "Retirar consentimiento" }).click();

  await expect(page.getByRole("button", { name: "Privacidad y cookies" })).toBeVisible();
  expect(decisionRequests[0]).toMatchObject({ action: "WITHDRAW_ALL", selections: [], origin: "PREFERENCE_CENTER" });
});

test("retirar consentimiento limpia solo las cookies propias controladas de cada proveedor", async ({ page }) => {
  currentDecision = { action: "ACCEPT_ALL", selections: [{ purposeKey: "analytics", status: "GRANTED" }, { purposeKey: "marketing", status: "GRANTED" }] };
  const ownOrigin = `http://127.0.0.1:${nextPort}`;
  await page.context().addCookies([
    { name: "_ga", value: "test", url: ownOrigin },
    { name: "_ga_ABCDE123", value: "test", url: ownOrigin },
    { name: "_fbp", value: "test", url: ownOrigin },
    { name: "_fbc", value: "test", url: ownOrigin },
    { name: "_pk_id.7.abcd", value: "test", url: ownOrigin },
    { name: "_pk_ses.7.abcd", value: "test", url: ownOrigin },
    { name: "_clck", value: "test", url: ownOrigin },
    { name: "_clsk", value: "test", url: ownOrigin },
    { name: "shop_session", value: "preserve", url: ownOrigin },
  ]);
  await openStorefront(page, []);
  await expect.poll(() => googleScriptRequests).toHaveLength(1);
  await expect.poll(() => metaPixelScriptRequests).toHaveLength(1);
  await expect.poll(() => matomoScriptRequests).toHaveLength(1);
  await expect.poll(() => clarityScriptRequests).toHaveLength(1);
  await expect(page.locator('script[data-ecommium-consent-service="analytics"]')).toHaveCount(1);
  await expect(page.locator('script[data-ecommium-consent-service="meta-pixel"]')).toHaveCount(1);
  await expect(page.locator('script[data-ecommium-consent-service="matomo-cloud"]')).toHaveCount(1);
  await expect(page.locator('script[data-ecommium-consent-service="microsoft-clarity"]')).toHaveCount(1);
  expect((await page.context().cookies(ownOrigin)).map((cookie) => cookie.name)).toEqual(expect.arrayContaining(["_ga", "_ga_ABCDE123", "_fbp", "_fbc", "shop_session"]));

  await page.getByRole("button", { name: "Privacidad y cookies" }).click();
  await page.getByRole("button", { name: "Retirar consentimiento" }).click();
  await expect(page.getByRole("button", { name: "Privacidad y cookies" })).toBeVisible();
  await expect(page.locator('script[data-ecommium-consent-service="analytics"]')).toHaveCount(0);
  await expect(page.locator('script[data-ecommium-consent-service="meta-pixel"]')).toHaveCount(0);
  await expect(page.locator('script[data-ecommium-consent-service="matomo-cloud"]')).toHaveCount(0);
  await expect(page.locator('script[data-ecommium-consent-service="microsoft-clarity"]')).toHaveCount(0);

  await expect.poll(async () => (await page.context().cookies(ownOrigin)).map((cookie) => cookie.name)).not.toEqual(expect.arrayContaining(["_ga", "_ga_ABCDE123", "_fbp", "_fbc", "_pk_id.7.abcd", "_pk_ses.7.abcd", "_clck", "_clsk"]));
  expect((await page.context().cookies(ownOrigin)).map((cookie) => cookie.name)).toEqual(expect.arrayContaining(["shop_session"]));
});

test("una nueva versión vuelve a solicitar una decisión", async ({ page }) => {
  currentDecision = { action: "ACCEPT_ALL", selections: [{ purposeKey: "analytics", status: "GRANTED" }] };
  await openStorefront(page, []);
  await expect(page.getByRole("button", { name: "Privacidad y cookies" })).toBeVisible();

  configurationVersion = 2;
  snapshotFingerprint = "sha256:consent-v2";
  currentDecision = null;
  await page.reload();

  await expect(page.getByRole("heading", { name: "Tus decisiones de privacidad" })).toBeVisible();
});

test("un error de política muestra reintento y no permite asumir consentimiento", async ({ page }) => {
  policyUnavailable = true;
  await openStorefront(page, []);
  await expect(page.getByText("No pudimos cargar las preferencias de privacidad. Las tecnologías opcionales permanecen desactivadas.")).toBeVisible();

  policyUnavailable = false;
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByRole("heading", { name: "Tus decisiones de privacidad" })).toBeVisible();
  expect(decisionRequests).toHaveLength(0);
});

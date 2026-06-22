import { expect, test } from "@playwright/test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import net from "node:net";

const defaultOrganizationId = "11111111-1111-4111-8111-111111111111";
const barcelonaShopId = "22222222-2222-4222-8222-222222222222";

type CapturedLoginPayload = {
  email?: string;
  password?: string;
  organizationId?: string;
  shopId?: string;
  shopAlias?: string;
  scope?: string;
};

let bffServer: Server;
let bffPort = 0;
let nextPort = 0;
let nextProcess: ChildProcessWithoutNullStreams;
const capturedLoginPayloads: CapturedLoginPayload[] = [];

async function freePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  server.close();
  await once(server, "close");
  return port;
}

function readJsonBody(request: Parameters<Parameters<typeof createServer>[0]>[0]) {
  return new Promise<Record<string, unknown>>((resolve) => {
    let body = "";
    request.on("data", (chunk) => {
      body += String(chunk);
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) as Record<string, unknown> : {});
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(response: Parameters<Parameters<typeof createServer>[0]>[1], status: number, payload: unknown) {
  response.writeHead(status, {
    "content-type": "application/json",
  });
  response.end(JSON.stringify(payload));
}

async function startBffMock() {
  bffPort = await freePort();
  bffServer = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${bffPort}`);

    if (
      url.pathname.startsWith("/api/v1/admin/") &&
      request.headers.authorization !== "Bearer server-admin-token" &&
      request.headers.authorization !== "Bearer access-token"
    ) {
      sendJson(response, 401, { message: "authorization header is required" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/context/available") {
      sendJson(response, 200, {
        tenantAccess: {
          level: "SHOP",
          shopScopes: [
            { organizationId: defaultOrganizationId, shopId: barcelonaShopId },
          ],
        },
        organizations: [{
          organizationId: defaultOrganizationId,
          name: "Ecommium Default Organization",
        }],
        shops: [
          {
            shopId: barcelonaShopId,
            organizationId: defaultOrganizationId,
            organizationName: "Ecommium Default Organization",
            shopName: "Tienda Barcelona",
            shopAlias: "tienda-barcelona",
            primaryDomain: "barcelona.local",
            status: "ACTIVE",
            effectiveSettings: {
              defaultLocale: "es-ES",
              defaultCurrency: "EUR",
              defaultCountry: "ES",
            },
          },
        ],
        selectionRequired: false,
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/organizations-shops/organizations") {
      sendJson(response, 200, {
        items: [{
          organizationId: defaultOrganizationId,
          name: "Ecommium Default Organization",
        }],
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/organizations-shops/shop-groups") {
      sendJson(response, 200, { items: [] });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/organizations-shops/shops") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      sendJson(response, 200, {
        items: [
          {
            shopId: barcelonaShopId,
            organizationId: defaultOrganizationId,
            name: "Tienda Barcelona",
            shopAlias: "tienda-barcelona",
            primaryDomain: "barcelona.local",
            status: "ACTIVE",
          },
        ],
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/organizations-shops/shops/context/resolve") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      const shopAlias = url.searchParams.get("shopAlias");
      sendJson(response, 200, {
        shopId: barcelonaShopId,
        organizationId: defaultOrganizationId,
        name: "Tienda Barcelona",
        shopAlias,
        status: "ACTIVE",
        effectiveSettings: {
          defaultLocale: "es-ES",
          defaultCurrency: "EUR",
          defaultCountry: "ES",
        },
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/auth/login") {
      const body = await readJsonBody(request);
      capturedLoginPayloads.push(body);
      sendJson(response, 200, {
        profile: {
          principalId: "employee-1",
          principalType: "EMPLOYEE",
          email: body.email,
        },
        session: {
          sessionId: "session-1",
          principalType: "EMPLOYEE",
          scope: "admin",
        },
        tokens: {
          accessToken: "access-token",
          refreshToken: "refresh-token",
          expiresInSeconds: 900,
        },
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/auth/me") {
      if (request.headers.authorization !== "Bearer access-token") {
        sendJson(response, 401, { message: "invalid access token" });
        return;
      }

      sendJson(response, 200, {
        principal: {
          sub: "employee-1",
          principalType: "EMPLOYEE",
          email: "admin@example.com",
          roles: ["admin"],
          permissions: ["admin:*"],
          tenantAccess: {
            level: "SHOP",
            shopScopes: [
              { organizationId: defaultOrganizationId, shopId: barcelonaShopId },
            ],
          },
          scope: "admin",
        },
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
      if (response.status < 500) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error(`Next dev server did not become ready at ${url}`);
}

async function startNext() {
  nextPort = await freePort();
  nextProcess = spawn("npx", ["next", "start", "-p", String(nextPort)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ECOMMIUM_BFF_BASE_URL: `http://127.0.0.1:${bffPort}/api/v1`,
      ECOMMIUM_ADMIN_BFF_TOKEN: "server-admin-token",
    },
  });
  await waitForNext(`http://127.0.0.1:${nextPort}/auth/login`);
}

test.beforeAll(async () => {
  await startBffMock();
  await startNext();
});

test.afterAll(async () => {
  nextProcess?.kill();
  bffServer?.close();
});

test("admin login authenticates without tenant fields and loads context afterwards", async ({ page }) => {
  await page.goto(`http://127.0.0.1:${nextPort}/auth/login`);

  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByLabel("Tienda")).toHaveCount(0);
  await expect(page.getByLabel("Organization ID")).toHaveCount(0);
  await expect(page.getByLabel("Shop ID")).toHaveCount(0);

  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password").fill("secret123");
  await page.getByRole("button", { name: "Entrar con BFF Auth" }).click();
  await page.waitForURL(`http://127.0.0.1:${nextPort}/admin`);

  expect(capturedLoginPayloads.at(-1)).toEqual({
    email: "admin@example.com",
    password: "secret123",
    scope: "admin",
  });
  expect(capturedLoginPayloads.at(-1)).not.toHaveProperty("organizationId");
  expect(capturedLoginPayloads.at(-1)).not.toHaveProperty("shopId");
  expect(capturedLoginPayloads.at(-1)).not.toHaveProperty("shopAlias");
});

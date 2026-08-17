import { expect, test } from "@playwright/test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import net from "node:net";

const accessToken = makeJwt({
  sub: "employee-1",
  principalType: "EMPLOYEE",
  scope: "admin",
  roles: ["superadmin"],
  permissions: ["system.admin"],
  exp: Math.floor(Date.now() / 1000) + 3600,
});

let bffServer: Server;
let bffPort = 0;
let nextPort = 0;
let nextProcess: ChildProcessWithoutNullStreams;
let nextOutput = "";
let credentialState: "NORMAL" | "MUST_CHANGE_PASSWORD" = "NORMAL";
let passwordRecoveryAvailable = true;
const mutations: Array<{ body: Record<string, unknown>; path: string }> = [];

function appendNextOutput(chunk: unknown) {
  nextOutput = `${nextOutput}${Buffer.from(chunk as Uint8Array).toString("utf8")}`.slice(-12_000);
}

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

function isAuthenticated(request: IncomingMessage) {
  return request.headers.authorization === `Bearer ${accessToken}`;
}

async function startBffMock() {
  bffPort = await freePort();
  bffServer = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${bffPort}`);

    if (request.method === "GET" && url.pathname === "/api/v1/admin/auth/password-recovery/availability") {
      sendJson(response, 200, { available: passwordRecoveryAvailable });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/auth/password-recovery/request") {
      mutations.push({ body: await readBody(request), path: url.pathname });
      sendJson(response, 202, { accepted: true });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/auth/password-recovery/complete") {
      mutations.push({ body: await readBody(request), path: url.pathname });
      sendJson(response, 200, { status: "password_reset", security: { requiresLogin: true } });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/auth/login") {
      const body = await readBody(request);
      mutations.push({ body, path: url.pathname });
      sendJson(response, 200, {
        profile: { principalId: "employee-1", principalType: "EMPLOYEE", email: body.email },
        session: { principalType: "EMPLOYEE", scope: "admin", credentialState },
        tokens: { accessToken, refreshToken: "refresh-token", expiresInSeconds: 3600 },
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/auth/me" && isAuthenticated(request)) {
      sendJson(response, 200, {
        principal: {
          sub: "employee-1",
          principalType: "EMPLOYEE",
          scope: "admin",
          email: "employee@example.test",
          roles: ["superadmin"],
          permissions: ["system.admin"],
          credentialState,
        },
        session: { sessionId: "session-1" },
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/session/step-up" && isAuthenticated(request)) {
      mutations.push({ body: await readBody(request), path: url.pathname });
      sendJson(response, 200, { status: "VERIFIED", method: "PASSWORD" });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/auth/password/change" && isAuthenticated(request)) {
      mutations.push({ body: await readBody(request), path: url.pathname });
      credentialState = "NORMAL";
      sendJson(response, 200, {
        status: "password_changed",
        security: { currentSessionRetained: true, requiresLogin: false, revokedOtherSessions: 1 },
      });
      return;
    }

    sendJson(response, 404, { code: "NOT_FOUND" });
  });
  bffServer.listen(bffPort, "127.0.0.1");
  await once(bffServer, "listening");
}

async function waitForNext(url: string) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (nextProcess.exitCode !== null) {
      throw new Error(`Next server exited before becoming ready: ${nextOutput}`);
    }
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`Next server did not become ready at ${url}: ${nextOutput}`);
}

async function startNext() {
  nextPort = await freePort();
  nextProcess = spawn("npx", ["next", "start", "-p", String(nextPort)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ECOMMIUM_ADMIN_BFF_BASE_URL: `http://127.0.0.1:${bffPort}/api/v1`,
      ECOMMIUM_UI_ADMIN_SESSION_SECRET: "playwright-admin-credential-secret-2026",
      ECOMMIUM_STOREFRONT_BFF_BASE_URL: "https://storefront.example.test/api/v1",
      ECOMMIUM_STOREFRONT_ORGANIZATION_ID: "organization-playwright",
      ECOMMIUM_STOREFRONT_SHOP_ID: "shop-playwright",
    },
  });
  nextProcess.stdout.on("data", (chunk) => {
    appendNextOutput(chunk);
  });
  nextProcess.stderr.on("data", (chunk) => {
    appendNextOutput(chunk);
  });
  await waitForNext(`http://127.0.0.1:${nextPort}/auth/admin/password-recovery`);
}

test.beforeAll(async () => {
  await startBffMock();
  await startNext();
});

test.beforeEach(async ({ context }) => {
  credentialState = "NORMAL";
  passwordRecoveryAvailable = true;
  mutations.length = 0;
  nextOutput = "";
  await context.clearCookies();
});

test.afterAll(async () => {
  nextProcess?.kill();
  bffServer?.close();
});

test("recovery keeps the response uniform and removes the token from the URL", async ({ page }) => {
  await page.goto(`http://localhost:${nextPort}/auth/admin/password-recovery`);
  await page.getByLabel("Email de empleado").fill("employee@example.test");
  await page.getByRole("button", { name: "Enviar instrucciones" }).click();
  await expect(page.getByText(/Si existe una cuenta elegible/)).toBeVisible();

  expect(mutations.at(-1)).toEqual({
    path: "/api/v1/admin/auth/password-recovery/request",
    body: { email: "employee@example.test", locale: "es-ES" },
  });

  const token = "a".repeat(43);
  await page.goto(`http://localhost:${nextPort}/auth/admin/password-recovery/consume?token=${token}`);
  await expect(page).toHaveURL(new RegExp(`^http://(?:127\\.0\\.0\\.1|localhost):${nextPort}/auth/admin/password-recovery/complete$`));
  expect(page.url()).not.toContain("token=");
  await expect(page.getByText(/El enlace se retiró de la dirección/)).toBeVisible();

  await page.getByLabel("Nueva contraseña", { exact: true }).fill("New Password 2026!");
  await page.getByLabel("Repite la nueva contraseña").fill("New Password 2026!");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await page.waitForURL(/\/auth\/login\?authNotice=/);
  expect(mutations.at(-1)).toEqual({
    path: "/api/v1/admin/auth/password-recovery/complete",
    body: { token, newPassword: "New Password 2026!" },
  });
});

test("recovery is hidden and cannot be requested when the BFF capability is unavailable", async ({ page }) => {
  passwordRecoveryAvailable = false;

  await page.goto(`http://localhost:${nextPort}/auth/login`);
  await expect(page.getByRole("link", { name: "¿Olvidaste tu contraseña?" })).toHaveCount(0);

  await page.goto(`http://localhost:${nextPort}/auth/admin/password-recovery`);
  await expect(page.getByText(/La recuperación de contraseña no está disponible/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar instrucciones" })).toHaveCount(0);
  expect(mutations).toHaveLength(0);
});

test("a temporary Admin credential is blocked until its owner changes it", async ({ page }) => {
  credentialState = "MUST_CHANGE_PASSWORD";
  await page.goto(`http://127.0.0.1:${nextPort}/auth/login`);
  await page.getByLabel("Email").fill("employee@example.test");
  await page.getByLabel("Password").fill("Temporary Password 2026!");
  await page.getByRole("button", { name: "Entrar con BFF Auth" }).click();
  await page.waitForURL(`http://127.0.0.1:${nextPort}/admin/password`);
  await expect(page.getByText(/No podrás acceder al resto del Admin/)).toBeVisible();

  await page.getByLabel("Contraseña temporal actual").fill("Temporary Password 2026!");
  await page.getByLabel("Nueva contraseña", { exact: true }).fill("Personal Password 2026!");
  await page.getByLabel("Repite la nueva contraseña").fill("Personal Password 2026!");
  await page.getByRole("button", { name: "Crear contraseña y continuar" }).click();
  await page.waitForURL(`http://127.0.0.1:${nextPort}/admin/configuracion/seguridad`);

  expect(mutations.filter((mutation) => mutation.path.endsWith("session/step-up")).at(-1)?.body).toEqual({
    currentPassword: "Temporary Password 2026!",
  });
  expect(mutations.filter((mutation) => mutation.path.endsWith("password/change")).at(-1)?.body).toEqual({
    currentPassword: "Temporary Password 2026!",
    newPassword: "Personal Password 2026!",
    revokeOtherSessions: true,
  });
});

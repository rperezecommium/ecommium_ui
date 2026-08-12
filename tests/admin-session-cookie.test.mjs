import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/shared/auth/admin-session-cookie.ts", import.meta.url), "utf8");
const sessionSource = readFileSync(new URL("../src/shared/auth/session.ts", import.meta.url), "utf8");

function loadCookieModule(secret, previousSecret) {
  const outputText = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const commonJsExports = {};
  const moduleContext = {
    Buffer,
    exports: commonJsExports,
    module: { exports: commonJsExports },
    process: { env: { ECOMMIUM_UI_ADMIN_SESSION_SECRET: secret, ECOMMIUM_UI_ADMIN_SESSION_PREVIOUS_SECRET: previousSecret } },
    require(specifier) {
      if (specifier === "node:crypto") return awaitCrypto;
      throw new Error(`Unexpected dependency: ${specifier}`);
    },
  };
  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
}

const awaitCrypto = await import("node:crypto");
const validSecret = "0123456789abcdef0123456789abcdef";

function encodeJwtPayload(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" }), "utf8").toString("base64url");
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${header}.${body}.signature`;
}

function loadSessionModule({ sealedValue } = {}) {
  let savedCookie = null;
  const outputText = ts.transpileModule(sessionSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const commonJsExports = {};
  const moduleContext = {
    Buffer,
    exports: commonJsExports,
    module: { exports: commonJsExports },
    process: { env: { NODE_ENV: "development" } },
    require(specifier) {
      if (specifier === "next/headers") {
        return {
          cookies: async () => ({
            get: () => sealedValue ? { value: sealedValue } : undefined,
            set: (name, value, options) => {
              savedCookie = { name, value, options };
            },
            delete: () => {},
          }),
        };
      }
      if (specifier === "./admin-session-cookie") {
        return {
          sealAdminSessionCookie: (payload) => `sealed:${payload}`,
          unsealAdminSessionCookie: (value) => value?.startsWith("sealed:") ? value.slice("sealed:".length) : null,
        };
      }
      if (specifier === "./admin-request-session") {
        return {
          getAdminRequestSession: () => null,
        };
      }
      throw new Error(`Unexpected dependency: ${specifier}`);
    },
  };
  vm.runInNewContext(outputText, moduleContext);
  return {
    exports: moduleContext.module.exports,
    getSavedCookie: () => savedCookie,
  };
}

test("Admin session cookies are signed and reject tampering", () => {
  const cookie = loadCookieModule(validSecret);
  const sealed = cookie.sealAdminSessionCookie('{"employeeId":"employee-1"}');

  assert.equal(cookie.unsealAdminSessionCookie(sealed), '{"employeeId":"employee-1"}');
  assert.equal(cookie.unsealAdminSessionCookie(`${sealed}tampered`), null);
});

test("Admin session cookies fail closed without a strong signing secret", () => {
  const cookie = loadCookieModule("too-short");

  assert.equal(cookie.hasAdminSessionCookieSecret(), false);
  assert.throws(() => cookie.sealAdminSessionCookie("payload"));
  assert.equal(cookie.unsealAdminSessionCookie("v1.payload.signature"), null);
});

test("Admin session cookies accept the prior key only during explicit rotation", () => {
  const oldCookie = loadCookieModule(validSecret);
  const sealed = oldCookie.sealAdminSessionCookie("payload");
  const rotated = loadCookieModule("fedcba9876543210fedcba9876543210", validSecret);

  assert.equal(rotated.unsealAdminSessionCookie(sealed), "payload");
  assert.notEqual(rotated.sealAdminSessionCookie("payload"), sealed);
});

test("Admin session persistence keeps large permission sets out of the cookie payload", async () => {
  const permissions = Array.from({ length: 180 }, (_, index) => `admin.permission.${index}.read`);
  const roles = ["admin", "operator"];
  const accessToken = encodeJwtPayload({
    principalType: "EMPLOYEE",
    scope: "admin",
    roles,
    permissions: ["*"],
  });
  const { exports: sessionModule, getSavedCookie } = loadSessionModule();

  await sessionModule.saveAdminSession({
    accessToken,
    refreshToken: "refresh-token",
    expiresAt: new Date(Date.now() + 900_000).toISOString(),
    sessionId: "session-1",
    employeeId: "employee-1",
    name: "Ricardo",
    email: "ricardo@lavour.es",
    profile: "Operator",
    principalType: "EMPLOYEE",
    scope: "admin",
    roles,
    permissions,
  });

  const saved = getSavedCookie();
  assert.equal(saved.name, "ecommium_employee_session");
  assert.equal(saved.options.httpOnly, true);
  assert.ok(Buffer.byteLength(saved.value, "utf8") < 4096);
  assert.doesNotMatch(saved.value, /admin\.permission\.179\.read/);
});

test("Admin session persistence keeps compact superadmin wildcard permissions", async () => {
  const accessToken = encodeJwtPayload({
    principalType: "EMPLOYEE",
    scope: "admin",
  });
  const { exports: sessionModule, getSavedCookie } = loadSessionModule();

  await sessionModule.saveAdminSession({
    accessToken,
    refreshToken: "refresh-token",
    expiresAt: new Date(Date.now() + 900_000).toISOString(),
    sessionId: "session-1",
    employeeId: "employee-1",
    name: "Ricardo",
    email: "ricardo@lavour.es",
    profile: "SuperAdmin",
    principalType: "EMPLOYEE",
    scope: "admin",
    roles: ["admin"],
    permissions: ["*"],
  });

  const saved = getSavedCookie();
  const session = await loadSessionModule({ sealedValue: saved.value }).exports.getAdminSession();

  assert.equal(JSON.stringify(session.permissions), JSON.stringify(["*"]));
});

test("Admin session parsing restores roles and permissions from the access token", async () => {
  const accessToken = encodeJwtPayload({
    principalType: "EMPLOYEE",
    scope: "admin",
    roles: ["admin"],
    permissions: ["catalog.products.read"],
  });
  const sealedValue = `sealed:${JSON.stringify({
    accessToken,
    refreshToken: "refresh-token",
    sessionId: "session-1",
    employeeId: "employee-1",
    name: "Ricardo",
    email: "ricardo@lavour.es",
    profile: "Operator",
    principalType: "EMPLOYEE",
    scope: "admin",
  })}`;
  const { exports: sessionModule } = loadSessionModule({ sealedValue });

  const session = await sessionModule.getAdminSession();

  assert.deepEqual([...session.roles], ["admin"]);
  assert.deepEqual([...session.permissions], ["catalog.products.read"]);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/modules/auth/auth-session-payload.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});

const commonJsExports = {};
const moduleContext = {
  Buffer,
  Headers,
  exports: commonJsExports,
  module: { exports: commonJsExports },
};

vm.runInNewContext(outputText, moduleContext);

const { mergeAuthSessions, parseAuthSessionPayload } = moduleContext.module.exports;

test("parses the current BFF auth payload shape", () => {
  const session = parseAuthSessionPayload(
    {
      profile: {
        principalId: "employee-1",
        principalType: "EMPLOYEE",
        email: "employee@example.com",
      },
      session: {
        sessionId: "session-1",
        organizationId: "org-1",
        shopId: "shop-1",
        principalType: "EMPLOYEE",
        scope: "admin",
      },
      tokens: {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 900,
      },
    },
    { requireAccessToken: true },
  );

  assert.equal(session.accessToken, "access-token");
  assert.equal(session.refreshToken, "refresh-token");
  assert.equal(session.employeeId, "employee-1");
  assert.equal(session.email, "employee@example.com");
  assert.equal(session.principalType, "EMPLOYEE");
  assert.equal(session.scope, "admin");
  assert.equal(session.organizationId, "org-1");
  assert.equal(session.shopId, "shop-1");
  assert.equal(session.profile, "Operator");
  assert.ok(session.expiresAt);
});

test("keeps permissions and roles from auth/me over login defaults", () => {
  const loginSession = parseAuthSessionPayload(
    {
      profile: { principalId: "admin-1", principalType: "ADMIN", email: "admin@example.com" },
      session: { scope: "admin" },
      tokens: { accessToken: "login-token", refreshToken: "refresh-token" },
    },
    { requireAccessToken: true },
  );
  const meSession = parseAuthSessionPayload(
    {
      principal: {
        sub: "admin-1",
        principalType: "ADMIN",
        email: "admin@example.com",
        roles: ["admin"],
        permissions: ["catalog.products.write"],
        organizationId: "org-1",
        shopId: "shop-1",
        scope: "admin",
      },
      session: { sessionId: "session-1" },
    },
    { requireAccessToken: false },
  );

  const merged = mergeAuthSessions(loginSession, meSession);

  assert.equal(merged.accessToken, "login-token");
  assert.equal(merged.refreshToken, "refresh-token");
  assert.deepEqual(merged.roles, ["admin"]);
  assert.deepEqual(merged.permissions, ["catalog.products.write"]);
  assert.equal(merged.organizationId, "org-1");
  assert.equal(merged.shopId, "shop-1");
});

test("rejects admin principals without admin scope", () => {
  assert.throws(
    () =>
      parseAuthSessionPayload(
        {
          profile: { principalId: "employee-1", principalType: "EMPLOYEE" },
          session: { scope: "storefront" },
          tokens: { accessToken: "token" },
        },
        { requireAccessToken: true },
      ),
    /scope invalido/,
  );
});

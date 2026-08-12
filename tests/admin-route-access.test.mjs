import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function loadAccessModule({ session, currentSession, context, availableContexts }) {
  const source = readFileSync(new URL("../src/shared/auth/require-admin-route-access.ts", import.meta.url), "utf8");
  const outputText = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const commonJsExports = {};
  const moduleContext = {
    Response,
    exports: commonJsExports,
    module: { exports: commonJsExports },
    require(specifier) {
      if (specifier.endsWith("/bff/admin-client")) return { requestAdminBff: currentSession };
      if (specifier.endsWith("/config/admin-context")) return {
        getAdminContext: async () => context,
        hasRequiredAdminContext: (value) => Boolean(value.organizationId && value.shopId),
      };
      if (specifier.endsWith("/configuracion/organization-shop")) return { getAvailableAdminContexts: availableContexts };
      if (specifier === "./session") return { getAdminSession: async () => session };
      throw new Error(`Unexpected dependency: ${specifier}`);
    },
  };
  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
}

const context = { organizationId: "org-1", shopId: "shop-1", locale: "es-ES" };
const allowedContexts = async () => ({
  ok: true,
  directory: { organizations: [{ id: "org-1", shops: [{ id: "shop-1" }] }] },
});

test("Admin route access rejects a cookie without an employee bearer", async () => {
  const { requireAdminRouteAccess } = loadAccessModule({
    session: { employeeId: "forged", permissions: ["media.assets.write"] },
    currentSession: async () => { throw new Error("BFF must not be called"); },
    context,
    availableContexts: allowedContexts,
  });

  const result = await requireAdminRouteAccess("media.assets.write");
  assert.equal(result.ok, false);
  assert.equal(result.response.status, 401);
});

test("Admin route access requires a current Employee/admin identity and exact permission", async () => {
  const calls = [];
  const { requireAdminRouteAccess } = loadAccessModule({
    session: { accessToken: "employee-token" },
    currentSession: async (path, options) => {
      calls.push({ path, options });
      return {
        ok: true,
        data: { principal: { sub: "employee-1", principalType: "EMPLOYEE", scope: "admin", permissions: ["media.assets.write"] } },
      };
    },
    context,
    availableContexts: allowedContexts,
  });

  const result = await requireAdminRouteAccess("media.assets.write");
  assert.equal(result.ok, true);
  assert.equal(result.data.accessToken, "employee-token");
  assert.equal(calls[0].path, "/auth/me");
  assert.equal(calls[0].options.withAuth, false);
  assert.equal(calls[0].options.init.headers.authorization, "Bearer employee-token");
});

test("Admin route access blocks a Customer, missing permission, and a tenant outside the BFF allowlist", async () => {
  const makeAccess = (principal, availableContexts = allowedContexts) => loadAccessModule({
    session: { accessToken: "employee-token" },
    currentSession: async () => ({ ok: true, data: { principal } }),
    context,
    availableContexts,
  }).requireAdminRouteAccess;

  const customer = await makeAccess({ sub: "customer-1", principalType: "CUSTOMER", scope: "storefront", permissions: ["media.assets.write"] })("media.assets.write");
  assert.equal(customer.ok, false);
  assert.equal(customer.response.status, 403);

  const noPermission = await makeAccess({ sub: "employee-1", principalType: "EMPLOYEE", scope: "admin", permissions: [] })("media.assets.write");
  assert.equal(noPermission.ok, false);
  assert.equal(noPermission.response.status, 403);

  const crossTenant = await makeAccess(
    { sub: "employee-1", principalType: "EMPLOYEE", scope: "admin", permissions: ["media.assets.write"] },
    async () => ({ ok: true, directory: { organizations: [{ id: "org-2", shops: [{ id: "shop-2" }] }] } }),
  )("media.assets.write");
  assert.equal(crossTenant.ok, false);
  assert.equal(crossTenant.response.status, 404);
});

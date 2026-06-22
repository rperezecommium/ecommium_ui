import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(new URL("..", import.meta.url).pathname);

function loadOrganizationShopModule(requestBff, adminBffToken = "server-admin-token") {
  const source = readFileSync(path.resolve(root, "src/modules/configuracion/organization-shop.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const commonJsExports = {};
  const moduleContext = {
    URLSearchParams,
    exports: commonJsExports,
    module: { exports: commonJsExports },
    require(specifier) {
      if (specifier.endsWith("/shared/bff/client")) {
        return { requestBff };
      }
      if (specifier.endsWith("/shared/config/env")) {
        return { adminBffToken };
      }

      return {};
    },
  };

  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
}

test("admin context directory uses post-login available context endpoint", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({
      path: pathValue,
      withAuth: options.withAuth,
      authorization: options.init?.headers?.authorization,
    });

    if (pathValue === "/admin/context/available") {
      return {
        ok: true,
        data: options.parse({
          organizations: [{
            organizationId: "11111111-1111-4111-8111-111111111111",
            name: "Ecommium Default Organization",
          }],
          shops: [{
            shopId: "22222222-2222-4222-8222-222222222222",
            organizationId: "11111111-1111-4111-8111-111111111111",
            shopName: "Tienda Barcelona",
            shopAlias: "tienda-barcelona",
            status: "ACTIVE",
          }],
          defaultContext: {
            organizationId: "11111111-1111-4111-8111-111111111111",
            shopId: "22222222-2222-4222-8222-222222222222",
          },
          selectionRequired: false,
        }),
        correlationId: "corr-available",
      };
    }

    throw new Error(`Unexpected BFF path: ${pathValue}`);
  };
  const { getOrganizationShopDirectory } = loadOrganizationShopModule(requestBff);

  const directory = await getOrganizationShopDirectory({ withSessionAuth: false });

  assert.equal(directory.source, "bff");
  assert.equal(directory.organizations[0].shops[0].shopAlias, "tienda-barcelona");
  assert.equal(calls.length, 1);
  assert.equal(calls.every((call) => call.withAuth === false), true);
  assert.equal(calls.every((call) => call.authorization === "Bearer server-admin-token"), true);
});

test("admin context directory reports unavailable when authorization is missing", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({
      path: pathValue,
      withAuth: options.withAuth,
      authorization: options.init?.headers?.authorization,
    });

    return {
      ok: false,
      error: "authorization header is required",
      correlationId: "corr-missing-auth",
    };
  };
  const { getOrganizationShopDirectory } = loadOrganizationShopModule(requestBff, "");

  const directory = await getOrganizationShopDirectory({ withSessionAuth: false });

  assert.equal(directory.source, "unavailable");
  assert.equal(directory.message, "authorization header is required");
  assert.equal(calls[0].withAuth, false);
  assert.equal(calls[0].authorization, undefined);
});

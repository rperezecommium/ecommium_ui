import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

let bffCalls = [];
let bffResponses = [];
let cachedContext = {};
let clearCalls = 0;
let savedContext = null;

function resetMocks() {
  bffCalls = [];
  bffResponses = [];
  cachedContext = {};
  clearCalls = 0;
  savedContext = null;
}

const source = readFileSync(new URL("../src/modules/configuracion/admin-context-resolution.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});

const commonJsExports = {};
const moduleContext = {
  exports: commonJsExports,
  module: { exports: commonJsExports },
  require: (id) => {
    if (id.includes("admin-context")) {
      return {
        clearAdminContext: async () => {
          clearCalls += 1;
        },
        getAdminContext: async () => cachedContext,
        pendingAdminContextShopId: "__admin_context_pending__",
        saveAdminContext: async (context) => {
          savedContext = context;
        },
      };
    }
    if (id.includes("env")) {
      return {
        defaultAdminContext: {
          locale: "es-ES",
          currency: "EUR",
          country: "ES",
          channel: "admin",
        },
      };
    }
    if (id.includes("client")) {
      return {
        requestBff: async (path, options) => {
          bffCalls.push({ path, options });

          const response = bffResponses.shift();
          if (!response) {
            return { ok: false, error: "not mocked", correlationId: "test" };
          }

          if (response.ok && options.parse) {
            return {
              ...response,
              data: options.parse(response.data),
            };
          }

          return response;
        },
      };
    }
    throw new Error(`Unexpected require: ${id}`);
  },
};

moduleContext.URLSearchParams = URLSearchParams;
moduleContext.Promise = Promise;

vm.runInNewContext(outputText, moduleContext);

const { decideAdminContextResolution, findCachedAvailableContext, resolveAdminContextAfterLogin } = moduleContext.module.exports;

const contexts = [
  {
    organizationId: "org-1",
    organizationName: "Org Uno",
    shopId: "shop-1",
    shopName: "Tienda Uno",
    shopAlias: "tienda-uno",
  },
  {
    organizationId: "org-2",
    organizationName: "Org Dos",
    shopId: "shop-2",
    shopName: "Tienda Dos",
    shopAlias: "tienda-dos",
  },
];

test("keeps a valid cached context and redirects to configuration", () => {
  const decision = decideAdminContextResolution(
    { organizationId: "org-1", shopId: "shop-1" },
    contexts,
  );

  assert.equal(decision.kind, "resolved");
  assert.equal(decision.redirectTo, "/admin/configuracion");
  assert.equal(decision.context.shopName, "Tienda Uno");
});

test("auto-selects a single available shop", () => {
  const decision = decideAdminContextResolution(
    { organizationId: "", shopId: "" },
    [contexts[0]],
  );

  assert.equal(decision.kind, "resolved");
  assert.equal(decision.context.shopId, "shop-1");
});

test("requires selection when multiple shops are available", () => {
  const decision = decideAdminContextResolution(
    { organizationId: "", shopId: "" },
    contexts,
  );

  assert.equal(decision.kind, "select");
  assert.equal(decision.contexts.length, 2);
  assert.match(decision.redirectTo, /\/admin\/configuracion\/contexto/);
});

test("invalid cache does not match available contexts", () => {
  const decision = decideAdminContextResolution(
    { organizationId: "org-missing", shopId: "shop-missing" },
    contexts,
  );

  assert.equal(decision.kind, "select");
});

test("pending marker does not count as shopId", () => {
  const match = findCachedAvailableContext(
    { organizationId: "org-1", shopId: "__admin_context_pending__" },
    contexts,
  );

  assert.equal(match, null);
});

test("returns empty when no shops are available", () => {
  const decision = decideAdminContextResolution(
    { organizationId: "", shopId: "" },
    [],
  );

  assert.equal(decision.kind, "empty");
});

test("post-login resolution saves the only available shop and redirects to configuration", async () => {
  resetMocks();
  cachedContext = {
    organizationId: "",
    shopId: "",
    locale: "es-ES",
    currency: "EUR",
    country: "ES",
    channel: "admin",
  };
  bffResponses = [
    {
      ok: true,
      data: {
        items: [
          {
            organizationId: "org-1",
            name: "Org Uno",
          },
        ],
      },
    },
    {
      ok: true,
      data: {
        items: [
          {
            shopId: "shop-1",
            name: "Tienda Uno",
            shopAlias: "tienda-uno",
            status: "ACTIVE",
            effectiveSettings: {
              defaultLocale: "es-ES",
              defaultCurrency: "EUR",
              defaultCountry: "ES",
            },
          },
        ],
      },
    },
  ];

  const decision = await resolveAdminContextAfterLogin("access-token-1");

  assert.equal(decision.kind, "resolved");
  assert.equal(decision.redirectTo, "/admin/configuracion");
  assert.equal(savedContext.organizationId, "org-1");
  assert.equal(savedContext.shopId, "shop-1");
  assert.equal(savedContext.shopAlias, "tienda-uno");
  assert.equal(savedContext.channel, "admin");
  assert.equal(clearCalls, 0);
  assert.equal(bffCalls[0].path, "/admin/organizations-shops/organizations?limit=100&offset=0");
  assert.equal(bffCalls[1].path, "/admin/organizations-shops/shops?organizationId=org-1&status=ACTIVE&limit=100&offset=0");
  assert.equal(bffCalls[0].options.init.headers.authorization, "Bearer access-token-1");
  assert.equal(bffCalls[1].options.init.headers.authorization, "Bearer access-token-1");
});

test("post-login resolution clears stale cache and asks for shop selection when several shops exist", async () => {
  resetMocks();
  cachedContext = {
    organizationId: "org-missing",
    shopId: "shop-missing",
    locale: "es-ES",
    currency: "EUR",
    country: "ES",
    channel: "admin",
  };
  bffResponses = [
    {
      ok: true,
      data: {
        items: [
          {
            organizationId: "org-1",
            name: "Org Uno",
          },
        ],
      },
    },
    {
      ok: true,
      data: {
        items: [
          {
            shopId: "shop-1",
            name: "Tienda Uno",
            shopAlias: "tienda-uno",
          },
          {
            shopId: "shop-2",
            name: "Tienda Dos",
            shopAlias: "tienda-dos",
          },
        ],
      },
    },
  ];

  const decision = await resolveAdminContextAfterLogin("access-token-2");

  assert.equal(decision.kind, "select");
  assert.equal(decision.contexts.length, 2);
  assert.match(decision.redirectTo, /\/admin\/configuracion\/contexto/);
  assert.equal(savedContext, null);
  assert.equal(clearCalls, 1);
});

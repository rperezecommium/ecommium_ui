import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/modules/auth/admin-session-actions.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});

let events = [];
let savedSession = null;
let savedContext = null;
let clearContextCalls = 0;
let currentSession = null;
let scenario = {};

function resetScenario(nextScenario = {}) {
  events = [];
  savedSession = null;
  savedContext = null;
  clearContextCalls = 0;
  currentSession = nextScenario.currentSession ?? null;
  scenario = nextScenario;
}

function parseSession(value) {
  const tokens = value.tokens ?? {};
  const session = value.session ?? {};
  const principal = value.principal ?? {};
  const profile = value.profile ?? {};
  const email = profile.email ?? principal.email ?? "employee@example.com";

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    sessionId: session.sessionId,
    organizationId: session.organizationId ?? principal.organizationId,
    shopId: session.shopId ?? principal.shopId,
    employeeId: profile.principalId ?? principal.sub ?? "employee-1",
    name: profile.email ?? principal.email ?? "Employee",
    email,
    profile: "Operator",
    principalType: "EMPLOYEE",
    scope: "admin",
    roles: principal.roles ?? ["admin"],
    permissions: principal.permissions ?? ["catalog.products.read"],
  };
}

function okRaw(data, options) {
  return {
    ok: true,
    data: options.parse ? options.parse(data) : data,
    status: 200,
    correlationId: "test-correlation",
  };
}

const oneShopAvailableContext = {
  tenantAccess: {
    level: "SHOP",
    shopScopes: [
      {
        organizationId: "11111111-1111-4111-8111-111111111111",
        shopId: "22222222-2222-4222-8222-222222222222",
      },
    ],
  },
  organizations: [
    {
      organizationId: "11111111-1111-4111-8111-111111111111",
      name: "Mercadona",
    },
  ],
  shops: [
    {
      organizationId: "11111111-1111-4111-8111-111111111111",
      organizationName: "Mercadona",
      shopId: "22222222-2222-4222-8222-222222222222",
      shopAlias: "tienda-barcelona",
      shopName: "Barcelona",
      status: "ACTIVE",
      effectiveSettings: {
        defaultLocale: "es-ES",
        defaultCurrency: "EUR",
        defaultCountry: "ES",
      },
    },
  ],
  selectionRequired: false,
};

const multipleShopsAvailableContext = {
  ...oneShopAvailableContext,
  shops: [
    ...oneShopAvailableContext.shops,
    {
      organizationId: "11111111-1111-4111-8111-111111111111",
      organizationName: "Mercadona",
      shopId: "07071977-aa11-4f34-b030-b7efed2e2cd6",
      shopAlias: "tienda-ui-1780565845946",
      shopName: "Tienda UI",
      status: "ACTIVE",
    },
  ],
  selectionRequired: true,
};

const multipleShopsWithDefaultContext = {
  ...multipleShopsAvailableContext,
  defaultContext: {
    organizationId: "11111111-1111-4111-8111-111111111111",
    shopId: "07071977-aa11-4f34-b030-b7efed2e2cd6",
  },
};

const emptyAvailableContext = {
  tenantAccess: {
    level: "NONE",
    shopScopes: [],
  },
  organizations: [
    {
      organizationId: "11111111-1111-4111-8111-111111111111",
      name: "Mercadona",
    },
  ],
  shops: [],
  selectionRequired: false,
};

const defaultOnlyAvailableContext = {
  ...emptyAvailableContext,
  defaultContext: {
    organizationId: "11111111-1111-4111-8111-111111111111",
    shopId: "22222222-2222-4222-8222-222222222222",
  },
};

const commonJsExports = {};
const moduleContext = {
  FormData,
  URLSearchParams,
  exports: commonJsExports,
  module: { exports: commonJsExports },
  require(specifier) {
    if (specifier === "next/navigation") {
      return {
        redirect(url) {
          throw Object.assign(new Error("redirect"), { url });
        },
      };
    }
    if (specifier.endsWith("/shared/bff/admin-client")) {
      return {
        requestAdminBff: async (path, options = {}) => {
          events.push({ type: "bff", path, options });

          if (path === "/auth/login") {
            if (scenario.loginStatus) {
              return {
                ok: false,
                error: scenario.loginError ?? "too many requests",
                status: scenario.loginStatus,
                correlationId: "test-correlation",
              };
            }

            return okRaw({
              profile: {
                principalId: "employee-1",
                principalType: "EMPLOYEE",
                email: "ricardo@lavour.es",
              },
              session: {
                sessionId: "session-1",
                principalType: "EMPLOYEE",
                scope: "admin",
              },
              tokens: {
                accessToken: "access-token-1",
                refreshToken: "refresh-token-1",
                expiresInSeconds: 900,
              },
            }, options);
          }

          if (path === "/auth/me") {
            const meCallCount = events.filter((event) => event.type === "bff" && event.path === "/auth/me").length;
            if (scenario.meStatus && meCallCount <= (scenario.meFailures ?? 1)) {
              return {
                ok: false,
                error: scenario.meError ?? "token expired",
                status: scenario.meStatus,
                correlationId: "test-correlation",
              };
            }

            return okRaw({
              principal: {
                sub: "employee-1",
                principalType: "EMPLOYEE",
                roles: ["admin"],
                permissions: ["catalog.products.read"],
                scope: "admin",
                email: "ricardo@lavour.es",
              },
              session: {
                sessionId: "session-1",
              },
            }, options);
          }

          if (path.startsWith("/admin/context/available")) {
            if (scenario.availableStatus) {
              return {
                ok: false,
                error: scenario.availableError ?? "context unavailable",
                status: scenario.availableStatus,
                correlationId: "test-correlation",
              };
            }

            return okRaw(scenario.availableContext ?? oneShopAvailableContext, options);
          }

          throw new Error(`Unexpected BFF path: ${path}`);
        },
      };
    }
    if (specifier.endsWith("/shared/auth/admin-session-refresh")) {
      return {
        refreshAdminTokens: async (refreshToken) => {
          events.push({ type: "refresh", refreshToken });

          if (scenario.refreshStatus) {
            return { ok: false, status: scenario.refreshStatus };
          }

          return {
            ok: true,
            accessToken: scenario.refreshedAccessToken ?? "access-token-2",
            refreshToken: scenario.refreshedRefreshToken ?? "refresh-token-2",
            expiresAt: scenario.refreshedExpiresAt ?? "2026-07-25T12:15:00.000Z",
          };
        },
      };
    }
    if (specifier.endsWith("/shared/config/env")) {
      return { adminBffToken: "" };
    }
    if (specifier.endsWith("/shared/auth/admin-bearer")) {
      return { hasUsableAdminBearer: () => true };
    }
    if (specifier.endsWith("/shared/config/admin-context")) {
      return {
        clearAdminContext: async () => {
          clearContextCalls += 1;
        },
        getAdminContext: async () => ({ locale: "es-ES", currency: "EUR", country: "ES", channel: "admin" }),
        getAdminContextForPrincipal: async () => scenario.preferredContext ?? ({
          organizationId: "",
          shopId: "",
          locale: "es-ES",
          currency: "EUR",
          country: "ES",
          channel: "admin",
        }),
        hasRequiredAdminContext: (context) => Boolean(context.organizationId && context.shopId),
        saveAdminContext: async (context) => {
          savedContext = context;
        },
      };
    }
    if (specifier.endsWith("/shared/auth/session")) {
      return {
        clearAdminSession: async () => undefined,
        getAdminSession: async () => currentSession,
        saveAdminSession: async (session) => {
          savedSession = session;
          currentSession = session;
        },
      };
    }
    if (specifier.endsWith("/modules/configuracion/organization-shop") || specifier === "../configuracion/organization-shop") {
      const realSource = readFileSync(new URL("../src/modules/configuracion/organization-shop.ts", import.meta.url), "utf8");
      const { outputText: realOutput } = ts.transpileModule(realSource, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      });
      const realExports = {};
      const realContext = {
        URLSearchParams,
        exports: realExports,
        module: { exports: realExports },
        require(realSpecifier) {
          if (realSpecifier.endsWith("/shared/bff/admin-client")) {
            return moduleContext.require("../../shared/bff/admin-client");
          }
          if (realSpecifier.endsWith("/shared/config/env")) {
            return { adminBffToken: "" };
          }
          return {};
        },
      };
      vm.runInNewContext(realOutput, realContext);

      return {
        getAvailableAdminContexts: realContext.module.exports.getAvailableAdminContexts,
        shopToContext: realContext.module.exports.shopToContext,
      };
    }
    if (specifier === "./admin-login-payload") {
      return {
        buildAdminLoginPayload: (email, password) => ({
          email,
          password,
          scope: "admin",
        }),
      };
    }
    if (specifier === "./auth-session-payload") {
      return {
        parseAuthSessionPayload: parseSession,
        mergeAuthSessions: (loginSession, meSession) => ({
          ...loginSession,
          ...meSession,
          accessToken: loginSession.accessToken,
          refreshToken: loginSession.refreshToken,
        }),
      };
    }

    throw new Error(`Unexpected require: ${specifier}`);
  },
};

vm.runInNewContext(outputText, moduleContext);

const { loginAdminEmployee, refreshAdminEmployeeSession } = moduleContext.module.exports;

async function submitLogin(next = "/admin/products") {
  const formData = new FormData();
  formData.set("email", "ricardo@lavour.es");
  formData.set("password", "Elapache_3030");
  formData.set("next", next);

  await loginAdminEmployee(formData);
}

test("admin layout refreshes tokens when auth me rejects the stored access token", async () => {
  resetScenario({
    currentSession: {
      accessToken: "access-token-1",
      refreshToken: "refresh-token-1",
      expiresAt: "2026-07-25T12:00:00.000Z",
      sessionId: "session-1",
      employeeId: "employee-1",
      name: "Employee",
      email: "ricardo@lavour.es",
      profile: "Operator",
      principalType: "EMPLOYEE",
      scope: "admin",
      roles: ["admin"],
      permissions: ["catalog.products.read"],
    },
    meStatus: 401,
  });

  const session = await refreshAdminEmployeeSession();

  assert.equal(session.accessToken, "access-token-2");
  assert.equal(session.refreshToken, "refresh-token-2");
  assert.equal(savedSession.accessToken, "access-token-2");
  assert.equal(savedSession.refreshToken, "refresh-token-2");
  assert.deepEqual(events.map((event) => event.type === "bff" ? event.path : event.type), [
    "/auth/me",
    "refresh",
    "/auth/me",
  ]);
  assert.equal(events[0].options.init, undefined);
  assert.equal(events[1].refreshToken, "refresh-token-1");
  assert.equal(events[2].options.withAuth, false);
  assert.equal(events[2].options.init.headers.authorization, "Bearer access-token-2");
});

test("admin login payload omits organizationId shopId and shopAlias", async () => {
  resetScenario();

  await assert.rejects(() => submitLogin(), { url: "/admin/products" });

  const loginCall = events.find((event) => event.type === "bff" && event.path === "/auth/login");
  const loginPayload = JSON.parse(loginCall.options.init.body);

  assert.deepEqual(loginPayload, {
    email: "ricardo@lavour.es",
    password: "Elapache_3030",
    scope: "admin",
  });
  assert.equal("organizationId" in loginPayload, false);
  assert.equal("shopId" in loginPayload, false);
  assert.equal("shopAlias" in loginPayload, false);
});

test("admin login works without session organizationId or shopId and loads available contexts afterwards", async () => {
  resetScenario();

  await assert.rejects(() => submitLogin(), { url: "/admin/products" });

  const loginEventIndex = events.findIndex((event) => event.type === "bff" && event.path === "/auth/login");
  const availableContextIndex = events.findIndex((event) => event.type === "bff" && event.path === "/admin/context/available");
  const availableCall = events[availableContextIndex];

  assert.ok(loginEventIndex >= 0);
  assert.ok(availableContextIndex > loginEventIndex);
  assert.equal(availableCall.options.withAuth, false);
  assert.equal(availableCall.options.init.headers.authorization, "Bearer access-token-1");
  assert.equal(savedSession.organizationId, undefined);
  assert.equal(savedSession.shopId, undefined);
});

test("admin login keeps operational context diagnostics visible", async () => {
  resetScenario({ availableStatus: 500 });

  await assert.rejects(() => submitLogin("/admin"), (error) => {
    const message = decodeURIComponent(error.url);
    assert.match(message, /No se pudo cargar el contexto operativo del Admin/);
    assert.match(message, /codigo BFF 500/);
    assert.match(message, /correlation ID test-correlation/);
    return true;
  });
});

test("admin login auto-selects a single available shop", async () => {
  resetScenario({ availableContext: oneShopAvailableContext });

  await assert.rejects(() => submitLogin("/admin"), { url: "/admin" });

  assert.equal(savedContext.organizationId, "11111111-1111-4111-8111-111111111111");
  assert.equal(savedContext.shopId, "22222222-2222-4222-8222-222222222222");
  assert.equal(savedContext.shopAlias, "tienda-barcelona");
  assert.equal(clearContextCalls, 0);
});

test("admin login redirects to context selector when several shops are available", async () => {
  resetScenario({ availableContext: multipleShopsAvailableContext });

  await assert.rejects(() => submitLogin("/admin/products"), (error) => {
    assert.match(error.url, /^\/admin\/configuracion\/contexto\?contextNotice=/);
    return true;
  });

  assert.equal(savedSession.employeeId, "employee-1");
  assert.equal(savedContext, null);
  assert.equal(clearContextCalls, 1);
});

test("admin login always prefers BFF defaultContext over manual shop selection", async () => {
  resetScenario({ availableContext: multipleShopsWithDefaultContext });

  await assert.rejects(() => submitLogin("/admin/pedidos"), { url: "/admin/pedidos" });

  assert.equal(savedSession.employeeId, "employee-1");
  assert.equal(savedContext.organizationId, "11111111-1111-4111-8111-111111111111");
  assert.equal(savedContext.shopId, "07071977-aa11-4f34-b030-b7efed2e2cd6");
  assert.equal(savedContext.shopAlias, "tienda-ui-1780565845946");
  assert.equal(clearContextCalls, 0);
});

test("admin login sends the remembered shop to the BFF as a validated preference", async () => {
  resetScenario({
    availableContext: multipleShopsWithDefaultContext,
    preferredContext: {
      organizationId: "11111111-1111-4111-8111-111111111111",
      shopId: "07071977-aa11-4f34-b030-b7efed2e2cd6",
      locale: "es-ES",
      currency: "EUR",
      country: "ES",
      channel: "admin",
    },
  });

  await assert.rejects(() => submitLogin("/admin"), { url: "/admin" });

  const availableCall = events.find((event) => (
    event.type === "bff" && event.path.startsWith("/admin/context/available?")
  ));
  assert.ok(availableCall);
  assert.match(availableCall.path, /preferredOrganizationId=11111111-1111-4111-8111-111111111111/);
  assert.match(availableCall.path, /preferredShopId=07071977-aa11-4f34-b030-b7efed2e2cd6/);
  assert.equal(savedContext.shopId, "07071977-aa11-4f34-b030-b7efed2e2cd6");
});

test("admin login persists BFF defaultContext even when directory omits shop details", async () => {
  resetScenario({ availableContext: defaultOnlyAvailableContext });

  await assert.rejects(() => submitLogin("/admin/pedidos"), { url: "/admin/pedidos" });

  assert.equal(savedSession.employeeId, "employee-1");
  assert.equal(savedContext.organizationId, "11111111-1111-4111-8111-111111111111");
  assert.equal(savedContext.shopId, "22222222-2222-4222-8222-222222222222");
  assert.equal(savedContext.locale, "es-ES");
  assert.equal(savedContext.currency, "EUR");
  assert.equal(clearContextCalls, 0);
});

test("admin login blocks operational access when no shops are available", async () => {
  resetScenario({ availableContext: emptyAvailableContext });

  await assert.rejects(() => submitLogin("/admin/products"), (error) => {
    assert.match(error.url, /^\/auth\/login\?next=%2Fadmin%2Fproducts&authError=/);
    assert.match(decodeURIComponent(error.url), /Acceso denegado operativo/);
    return true;
  });

  assert.equal(savedSession, null);
  assert.equal(savedContext, null);
  assert.equal(clearContextCalls, 1);
});

test("admin login handles 429 with a generic retry message", async () => {
  resetScenario({ loginStatus: 429, loginError: "email exists but rate limited" });

  await assert.rejects(() => submitLogin("/admin"), (error) => {
    assert.match(error.url, /^\/auth\/login\?next=%2Fadmin&authError=/);
    assert.match(decodeURIComponent(error.url), /Demasiados intentos/);
    assert.doesNotMatch(decodeURIComponent(error.url), /email exists/);
    return true;
  });

  assert.equal(events.some((event) => event.path === "/auth/me"), false);
  assert.equal(events.some((event) => event.path === "/admin/context/available"), false);
});

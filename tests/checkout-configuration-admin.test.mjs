import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(new URL("..", import.meta.url).pathname);

const context = {
  organizationId: "org-barcelona",
  shopId: "shop-barcelona",
  shopAlias: "barcelona",
  shopName: "Barcelona",
  primaryDomain: "barcelona.test",
  shopStatus: "ACTIVE",
  locale: "es-ES",
  currency: "EUR",
  country: "ES",
  channel: "web",
};

function configurationPayload(configurationState = "PERSISTED") {
  return {
    configurationState,
    configuration: {
      organizationId: context.organizationId,
      shopId: context.shopId,
      version: 1,
      storeContext: {
        defaultLocale: "es-ES",
        defaultCurrency: "EUR",
        defaultCountry: "ES",
      },
      orderFormConfiguration: {
        recaptchaValidation: true,
        recaptchaMinScore: 0.5,
        allowManualPrice: false,
        savePersonalDataAsOptIn: true,
        paymentSystemToCheckFirstInstallment: ["visa", "mastercard"],
      },
      isActive: true,
      createdAt: "2026-07-17T10:00:00.000Z",
      updatedAt: "2026-07-17T10:00:00.000Z",
    },
    checkoutResponseMessages: [
      {
        code: "CHECKOUT_CONFIGURATION_ACTIVE",
        message: "Checkout habilitado para esta tienda.",
        scope: "ORDER_PLACEMENT",
      },
    ],
  };
}

function loadModule(requestAdminBff) {
  const source = readFileSync(
    path.resolve(root, "src/modules/configuracion/checkout-configuration-admin.ts"),
    "utf8",
  );
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
      if (specifier.endsWith("/shared/bff/admin-client")) {
        return { requestAdminBff };
      }
      if (specifier.endsWith("/shared/config/admin-context")) {
        return {
          hasRequiredAdminContext: (value) => Boolean(value.organizationId && value.shopId),
        };
      }

      throw new Error(`Unexpected test require: ${specifier}`);
    },
  };

  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
}

function loadActionsModule({
  getAdminContext = async () => context,
  getAdminSession = async () => ({ scope: "admin", permissions: ["checkout.configuration.write"] }),
  can = () => true,
  patchCheckoutConfigurationAdminData = async () => ({
    ok: true,
    data: configurationPayload(),
    status: 200,
    correlationId: "corr-checkout",
  }),
  revalidatePath = () => undefined,
  redirect = (url) => {
    throw Object.assign(new Error("redirect"), { url });
  },
} = {}) {
  const formModule = loadFormModule();
  const source = readFileSync(
    path.resolve(root, "src/modules/configuracion/checkout-configuration-admin-actions.ts"),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const commonJsExports = {};
  const moduleContext = {
    FormData,
    URLSearchParams,
    exports: commonJsExports,
    module: { exports: commonJsExports },
    require(specifier) {
      if (specifier === "next/cache") return { revalidatePath };
      if (specifier === "next/navigation") return { redirect };
      if (specifier.endsWith("/shared/config/admin-context")) return { getAdminContext };
      if (specifier.endsWith("/shared/auth/session")) return { getAdminSession };
      if (specifier.endsWith("/shared/permissions/permissions")) return { can };
      if (specifier === "./checkout-configuration-admin") {
        return { patchCheckoutConfigurationAdminData };
      }
      if (specifier === "./checkout-configuration-form") {
        return formModule;
      }

      throw new Error(`Unexpected test require: ${specifier}`);
    },
  };

  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
}

function loadFormModule() {
  const source = readFileSync(
    path.resolve(root, "src/modules/configuracion/checkout-configuration-form.ts"),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const commonJsExports = {};
  const moduleContext = {
    FormData,
    exports: commonJsExports,
    module: { exports: commonJsExports },
  };

  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
}

function configurationFormData(overrides = {}) {
  const values = {
    recaptchaMinScore: "0.75",
    paymentSystemToCheckFirstInstallment: "visa, mastercard, visa",
    isActive: "on",
    recaptchaValidation: "on",
    allowManualPrice: "on",
    savePersonalDataAsOptIn: "on",
    ...overrides,
  };
  const formData = new FormData();

  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined) formData.set(key, value);
  });

  return formData;
}

test("checkout configuration reads the Admin BFF endpoint with tenant scope", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({ pathValue, options });
    return {
      ok: true,
      data: options.parse(configurationPayload("INITIAL")),
      status: 200,
      correlationId: "corr-checkout",
    };
  };
  const { getCheckoutConfigurationAdminData } = loadModule(requestAdminBff);

  const result = await getCheckoutConfigurationAdminData(context);

  assert.equal(result.ok, true);
  assert.equal(result.data.configurationState, "INITIAL");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].pathValue.startsWith("/admin/checkout/configuration/orderform?"), true);
  assert.match(calls[0].pathValue, /[?&]organizationId=org-barcelona(?:&|$)/);
  assert.match(calls[0].pathValue, /[?&]shopId=shop-barcelona(?:&|$)/);
  assert.deepEqual(calls[0].options.context, context);
});

test("checkout configuration rejects incomplete BFF payloads", () => {
  const { parseCheckoutConfigurationResponse } = loadModule(async () => undefined);
  const invalid = configurationPayload();
  delete invalid.configuration.orderFormConfiguration.recaptchaMinScore;

  assert.throws(
    () => parseCheckoutConfigurationResponse(invalid),
    /recaptchaMinScore/,
  );
});

test("checkout configuration does not call BFF without an active shop context", async () => {
  let called = false;
  const { getCheckoutConfigurationAdminData } = loadModule(async () => {
    called = true;
    throw new Error("must not be called");
  });

  const result = await getCheckoutConfigurationAdminData({ ...context, shopId: "" });

  assert.equal(result.ok, false);
  assert.equal(result.status, 428);
  assert.equal(called, false);
});

test("checkout configuration PATCH is tenant scoped and validates the returned contract", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({ pathValue, options });
    return {
      ok: true,
      data: options.parse(configurationPayload()),
      status: 200,
      correlationId: "corr-checkout",
    };
  };
  const { patchCheckoutConfigurationAdminData } = loadModule(requestAdminBff);
  const patch = {
    storeContext: { defaultLocale: "es-ES", defaultCurrency: "EUR", defaultCountry: "ES" },
    orderFormConfiguration: {
      recaptchaValidation: true,
      recaptchaMinScore: 0.5,
      allowManualPrice: false,
      savePersonalDataAsOptIn: true,
      paymentSystemToCheckFirstInstallment: ["visa"],
    },
    isActive: true,
  };

  const result = await patchCheckoutConfigurationAdminData(context, patch);

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.init.method, "PATCH");
  assert.equal(calls[0].options.init.headers["content-type"], "application/json");
  assert.deepEqual(JSON.parse(calls[0].options.init.body), patch);
  assert.match(calls[0].pathValue, /[?&]organizationId=org-barcelona(?:&|$)/);
  assert.match(calls[0].pathValue, /[?&]shopId=shop-barcelona(?:&|$)/);
});

test("checkout configuration action normalizes the complete form before PATCH", () => {
  const { checkoutConfigurationPatchFromForm } = loadFormModule();

  assert.deepEqual(JSON.parse(JSON.stringify(checkoutConfigurationPatchFromForm(configurationFormData({
    defaultCurrency: "usd",
    defaultCountry: "us",
    defaultLocale: "en-US",
  }), context))), {
    storeContext: { defaultLocale: "es-ES", defaultCurrency: "EUR", defaultCountry: "ES" },
    orderFormConfiguration: {
      recaptchaValidation: true,
      recaptchaMinScore: 0.75,
      allowManualPrice: true,
      savePersonalDataAsOptIn: true,
      paymentSystemToCheckFirstInstallment: ["visa", "mastercard"],
    },
    isActive: true,
  });
});

test("checkout configuration action blocks invalid score before BFF PATCH", async () => {
  let called = false;
  const { updateCheckoutConfigurationAction } = loadActionsModule({
    patchCheckoutConfigurationAdminData: async () => {
      called = true;
      throw new Error("must not be called");
    },
  });

  await assert.rejects(
    updateCheckoutConfigurationAction(configurationFormData({ recaptchaMinScore: "1.2" })),
    (error) => error?.url?.startsWith("/admin/configuracion/checkout?notice="),
  );
  assert.equal(called, false);
});

test("checkout configuration action rejects callers without Checkout permission before PATCH", async () => {
  let called = false;
  const { updateCheckoutConfigurationAction } = loadActionsModule({
    getAdminSession: async () => ({ scope: "admin", permissions: [] }),
    can: () => false,
    patchCheckoutConfigurationAdminData: async () => {
      called = true;
      throw new Error("must not be called");
    },
  });

  await assert.rejects(
    updateCheckoutConfigurationAction(configurationFormData()),
    (error) => error?.url?.includes("No%20tienes%20permiso"),
  );
  assert.equal(called, false);
});

test("checkout configuration action requires an explicit confirmation before deactivation", async () => {
  let called = false;
  const { updateCheckoutConfigurationAction } = loadActionsModule({
    patchCheckoutConfigurationAdminData: async () => {
      called = true;
      throw new Error("must not be called");
    },
  });

  await assert.rejects(
    updateCheckoutConfigurationAction(configurationFormData({ isActive: undefined })),
    (error) => error?.url?.includes("DESACTIVAR%20CHECKOUT"),
  );
  assert.equal(called, false);
});

test("checkout configuration action permits a confirmed deactivation", async () => {
  const calls = [];
  const { updateCheckoutConfigurationAction } = loadActionsModule({
    patchCheckoutConfigurationAdminData: async (actualContext, patch) => {
      calls.push({ actualContext, patch });
      return {
        ok: true,
        data: configurationPayload(),
        status: 200,
        correlationId: "corr-checkout",
      };
    },
  });

  await assert.rejects(
    updateCheckoutConfigurationAction(configurationFormData({
      isActive: undefined,
      confirmDeactivate: "DESACTIVAR CHECKOUT",
    })),
    (error) => error?.url?.includes("Configuraci%C3%B3n%20de%20Checkout%20guardada"),
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].patch.isActive, false);
});

test("checkout configuration action persists the validated payload and revalidates its route", async () => {
  const calls = [];
  const revalidated = [];
  const { updateCheckoutConfigurationAction } = loadActionsModule({
    patchCheckoutConfigurationAdminData: async (actualContext, patch) => {
      calls.push({ actualContext, patch });
      return {
        ok: true,
        data: {
          ...configurationPayload(),
          configuration: { ...configurationPayload().configuration, version: 2 },
        },
        status: 200,
        correlationId: "corr-checkout",
      };
    },
    revalidatePath: (pathValue) => revalidated.push(pathValue),
  });

  await assert.rejects(
    updateCheckoutConfigurationAction(configurationFormData()),
    (error) => error?.url === "/admin/configuracion/checkout?notice=Configuraci%C3%B3n%20de%20Checkout%20guardada.%20Versi%C3%B3n%202.",
  );

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].actualContext, context);
  assert.equal(calls[0].patch.orderFormConfiguration.recaptchaMinScore, 0.75);
  assert.deepEqual(revalidated, ["/admin/configuracion/checkout"]);
});

test("checkout configuration is exposed from the protected Admin configuration area", () => {
  const shell = readFileSync(path.resolve(root, "src/app-shell/admin-shell.tsx"), "utf8");
  const permissions = readFileSync(path.resolve(root, "src/shared/permissions/permissions.ts"), "utf8");
  const route = readFileSync(path.resolve(root, "app/(admin)/admin/configuracion/checkout/page.tsx"), "utf8");

  assert.match(shell, /href: "\/admin\/configuracion\/checkout"/);
  assert.match(shell, /permission: "admin:checkout:view"/);
  assert.match(permissions, /"admin:checkout:view": \["admin:checkout:view", "checkout\.configuration\.write"\]/);
  assert.match(route, /getCheckoutConfigurationAdminData/);
  assert.match(route, /drawer/);
  assert.doesNotMatch(route, /requestAdminBff/);
  assert.match(route, /getAdminSession/);
  assert.match(route, /can\(session, "admin:checkout:view"\)/);

  const form = readFileSync(
    path.resolve(root, "src/modules/configuracion/checkout-configuration-form-client.tsx"),
    "utf8",
  );
  assert.match(form, /useFormStatus/);
  assert.match(form, /DESACTIVAR CHECKOUT/);
  assert.match(form, /Confirmar desactivación/);

  const page = readFileSync(
    path.resolve(root, "src/modules/configuracion/checkout-configuration-admin-page.tsx"),
    "utf8",
  );
  assert.match(page, /adminSideDrawer/);
  assert.match(page, /Editar configuración/);
  assert.match(page, /checkoutHref\("edit"\)/);
  assert.doesNotMatch(page, /Impacto operativo/);
  assert.doesNotMatch(page, /checkoutResponseMessages/);
});

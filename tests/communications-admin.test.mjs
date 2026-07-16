import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(new URL("..", import.meta.url).pathname);

function source(relativePath) {
  return readFileSync(path.resolve(root, relativePath), "utf8");
}

function loadCommunicationsAdminModule(requestBff) {
  const moduleSource = source("src/modules/configuracion/communications-admin.ts");
  const { outputText } = ts.transpileModule(moduleSource, {
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
      if (specifier.endsWith("/shared/config/admin-context")) {
        return {
          hasRequiredAdminContext(value) {
            return Boolean(value.organizationId && value.shopId);
          },
        };
      }

      return {};
    },
  };

  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
}

function loadCommunicationsActionsModule({ getEmailDelivery, retryEmailDelivery }) {
  const moduleSource = source("src/modules/configuracion/communications-admin-actions.ts");
  const { outputText } = ts.transpileModule(moduleSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const calls = [];
  const commonJsExports = {};
  const moduleContext = {
    URLSearchParams,
    exports: commonJsExports,
    module: { exports: commonJsExports },
    require(specifier) {
      if (specifier === "next/cache") {
        return { revalidatePath(pathValue) { calls.push(["revalidatePath", pathValue]); } };
      }
      if (specifier === "next/navigation") {
        return { redirect(url) { throw { url }; } };
      }
      if (specifier.endsWith("/shared/config/admin-context")) {
        return {
          getAdminContext: async () => ({ organizationId: "org-1", shopId: "shop-1", locale: "es-ES" }),
        };
      }
      if (specifier === "./communications-admin") {
        return {
          bootstrapAuthEmailTemplates: async () => ({ ok: true, data: {} }),
          getEmailDelivery,
          patchEmailProviderSettings: async () => ({ ok: true, data: {} }),
          retryEmailDelivery,
          sendCommunicationsTestEmail: async () => ({ ok: true, data: {} }),
        };
      }

      return {};
    },
  };

  vm.runInNewContext(outputText, moduleContext);
  return { ...moduleContext.module.exports, calls };
}

test("communications admin is exposed under configuration navigation", () => {
  const shellSource = source("src/app-shell/admin-shell.tsx");
  const configSource = source("app/(admin)/admin/configuracion/page.tsx");
  const routeSource = source("app/(admin)/admin/configuracion/comunicaciones/page.tsx");
  const permissionsSource = source("src/shared/permissions/permissions.ts");

  assert.match(shellSource, /\/admin\/configuracion\/comunicaciones/);
  assert.match(shellSource, /communications:view/);
  assert.match(configSource, /Abrir comunicaciones/);
  assert.match(routeSource, /getCommunicationsAdminData/);
  assert.match(permissionsSource, /communications\.manage/);
});

test("communications admin uses BFF endpoints for email provider and auth templates", () => {
  const dataSource = source("src/modules/configuracion/communications-admin.ts");
  const actionsSource = source("src/modules/configuracion/communications-admin-actions.ts");
  const pageSource = source("src/modules/configuracion/communications-admin-page.tsx");

  assert.match(dataSource, /\/admin\/communications\/settings\/email-provider/);
  assert.match(dataSource, /\/admin\/communications\/templates\/email/);
  assert.match(dataSource, /\/admin\/communications\/templates\/email\/auth-defaults/);
  assert.match(dataSource, /\/admin\/communications\/email\/send/);
  assert.match(actionsSource, /secret/);
  assert.match(actionsSource, /clearSecret/);
  assert.match(actionsSource, /sendCommunicationsTestEmailAction/);
  assert.match(actionsSource, /recipientEmail/);
  assert.match(actionsSource, /admin-communications-test/);
  assert.match(actionsSource, /communications\.manage/);
  assert.match(pageSource, /drawer: "provider"/);
  assert.match(pageSource, /adminSideDrawer/);
  assert.match(pageSource, /Configurar proveedor/);
  assert.match(pageSource, /Secret ya configurado/);
  assert.match(pageSource, /Password \/ API key/);
  assert.match(pageSource, /Destinatario de prueba/);
  assert.match(pageSource, /Enviar prueba/);
  assert.match(pageSource, /Crear defaults auth/);
  assert.match(pageSource, /customer\.account\.activation/);
  assert.doesNotMatch(pageSource, /adminBadge">test/);
  assert.doesNotMatch(pageSource, /adminBadge">auth/);
  assert.doesNotMatch(dataSource, /localStorage/);
});

test("communications admin models the full email delivery audit response", () => {
  const dataSource = source("src/modules/configuracion/communications-admin.ts");

  assert.match(dataSource, /export type EmailDeliveryRecipient/);
  assert.match(dataSource, /export type EmailDeliveryAttempt/);
  assert.match(dataSource, /export type EmailRenderedSnapshot/);
  assert.match(dataSource, /export type EmailDeliveryList/);
  assert.match(dataSource, /renderedSnapshot/);
  assert.match(dataSource, /skippedAt/);
});

test("communications audit filters use isolated and validated URL parameters", () => {
  const routeSource = source("app/(admin)/admin/configuracion/comunicaciones/page.tsx");

  assert.match(routeSource, /deliveryStatus: normalizeDeliveryStatus/);
  assert.match(routeSource, /deliveryTemplateKey: normalizeFilterValue/);
  assert.match(routeSource, /deliverySourceEventId: normalizeFilterValue/);
  assert.match(routeSource, /deliveryCustomerId: normalizeFilterValue/);
  assert.match(routeSource, /deliveriesLimit: normalizeLimit/);
  assert.match(routeSource, /deliveriesOffset: normalizeOffset/);
  assert.match(routeSource, /function normalizeDeliveryStatus/);
  assert.match(routeSource, /parsed >= 1 && parsed <= 100/);
});

test("communications admin renders the global delivery audit as an operational table", () => {
  const pageSource = source("src/modules/configuracion/communications-admin-page.tsx");

  assert.match(pageSource, /function DeliveryFilters/);
  assert.match(pageSource, /function DeliveryAuditTable/);
  assert.match(pageSource, /function DeliveryPagination/);
  assert.match(pageSource, /Auditoría de entregas/);
  assert.match(pageSource, /deliveryStatus/);
  assert.match(pageSource, /deliveryTemplateKey/);
  assert.match(pageSource, /deliverySourceEventId/);
  assert.match(pageSource, /deliveryCustomerId/);
  assert.match(pageSource, /No hay entregas para los filtros seleccionados/);
  assert.match(pageSource, /Ver fallidas/);
});

test("communications audit opens a safe delivery detail drawer", () => {
  const routeSource = source("app/(admin)/admin/configuracion/comunicaciones/page.tsx");
  const dataSource = source("src/modules/configuracion/communications-admin.ts");
  const pageSource = source("src/modules/configuracion/communications-admin-page.tsx");

  assert.match(routeSource, /deliveryId: normalizeFilterValue/);
  assert.match(routeSource, /value === "provider" \|\| value === "delivery"/);
  assert.match(dataSource, /selectedDelivery/);
  assert.match(pageSource, /function DeliveryDrawer/);
  assert.match(pageSource, /Detalle de entrega/);
  assert.match(pageSource, /Intentos del proveedor/);
  assert.match(pageSource, /HTML, el texto, los datos y los adjuntos no se representan/);
  assert.match(pageSource, /drawer: "delivery", deliveryId: delivery.deliveryId/);
});

test("communications audit only exposes a retry control for failed deliveries", () => {
  const actionsSource = source("src/modules/configuracion/communications-admin-actions.ts");
  const pageSource = source("src/modules/configuracion/communications-admin-page.tsx");

  assert.match(actionsSource, /retryEmailDelivery/);
  assert.match(actionsSource, /current\.data\.status !== "FAILED"/);
  assert.match(actionsSource, /Falta permiso communications\.manage/);
  assert.match(pageSource, /function DeliveryRetryForm/);
  assert.match(pageSource, /delivery\.status !== "FAILED"/);
  assert.match(pageSource, /Reintentar email/);
});

test("communications retry rechecks the delivery and preserves the audit filters", async () => {
  const getCalls = [];
  const retryCalls = [];
  const { retryEmailDeliveryAction, calls } = loadCommunicationsActionsModule({
    getEmailDelivery: async (_context, deliveryId) => {
      getCalls.push(deliveryId);
      return { ok: true, status: 200, correlationId: "corr-get", data: { status: "FAILED" } };
    },
    retryEmailDelivery: async (_context, deliveryId) => {
      retryCalls.push(deliveryId);
      return { ok: true, status: 200, correlationId: "corr-retry", data: { deliveryId, status: "SENT" } };
    },
  });
  const formData = new FormData();
  formData.set("deliveryId", "delivery-1");
  formData.set("deliveryStatus", "FAILED");
  formData.set("deliveryTemplateKey", "shipping.delivered");
  formData.set("deliveryCustomerId", "customer-1");
  formData.set("deliveriesLimit", "50");
  formData.set("deliveriesOffset", "20");

  await assert.rejects(() => retryEmailDeliveryAction(formData), (error) => {
    assert.match(error.url, /drawer=delivery/);
    assert.match(error.url, /deliveryId=delivery-1/);
    assert.match(error.url, /deliveryStatus=FAILED/);
    assert.match(error.url, /deliveryTemplateKey=shipping.delivered/);
    assert.match(error.url, /Estado\+actual%3A\+SENT/);
    return true;
  });
  assert.deepEqual(getCalls, ["delivery-1"]);
  assert.deepEqual(retryCalls, ["delivery-1"]);
  assert.deepEqual(calls, [["revalidatePath", "/admin/configuracion/comunicaciones"]]);
});

test("communications admin reads deliveries through the scoped BFF contract", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, context: options.context, init: options.init });
    return {
      ok: true,
      status: 200,
      correlationId: "corr-communications",
      data: { items: [], total: 0, limit: 20, offset: 0 },
    };
  };
  const context = {
    organizationId: "org-1",
    shopId: "shop-1",
    locale: "es-ES",
  };
  const { getCommunicationsAdminData, getEmailDelivery, retryEmailDelivery } = loadCommunicationsAdminModule(requestBff);

  await getCommunicationsAdminData(context, {
    deliveryStatus: "FAILED",
    deliveryTemplateKey: "shipping.delivered",
    deliverySourceEventId: "event-1",
    deliveryCustomerId: "customer-1",
    deliveriesLimit: "50",
    deliveriesOffset: "20",
  });
  await getEmailDelivery(context, "delivery/1");
  await retryEmailDelivery(context, "delivery/1");

  assert.equal(calls.length, 5);
  assert.equal(calls[2].path, "/admin/communications/deliveries?organizationId=org-1&shopId=shop-1&status=FAILED&templateKey=shipping.delivered&sourceEventId=event-1&customerId=customer-1&limit=50&offset=20");
  assert.equal(calls[3].path, "/admin/communications/deliveries/delivery%2F1?organizationId=org-1&shopId=shop-1");
  assert.equal(calls[4].path, "/admin/communications/deliveries/delivery%2F1/retry?organizationId=org-1&shopId=shop-1");
  assert.equal(calls[4].init.method, "POST");
  assert.deepEqual(calls[2].context, context);
});

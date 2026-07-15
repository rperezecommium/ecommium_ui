import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const context = {
  organizationId: "org-1",
  shopId: "shop-1",
  shopAlias: "shop",
  shopName: "Shop",
  primaryDomain: "shop.test",
  shopStatus: "ACTIVE",
  locale: "es-ES",
  currency: "EUR",
  country: "ES",
  channel: "web",
};

function source(relativePath) {
  return readFileSync(path.resolve(root, relativePath), "utf8");
}

function loadAutomationAdminModule(requestBff) {
  const moduleSource = source("src/modules/configuracion/automation-admin.ts");
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

function loadAutomationActionsModule({
  adminContext = context,
  trackingResult = {
    ok: true,
    status: 200,
    correlationId: "corr-tracking",
    data: { locale: "es-ES", created: 1, updated: 2, existing: 3, archived: 1, items: [] },
  },
  invoiceResult = {
    ok: true,
    status: 200,
    correlationId: "corr-invoice",
    data: { locale: "es-ES", created: 0, updated: 0, existing: 1, items: [] },
  },
  transitionResult = {
    ok: true,
    status: 200,
    correlationId: "corr-transition",
    data: {
      ruleId: "rule-1",
      organizationId: "org-1",
      shopId: "shop-1",
      name: "Tracking enviado",
      status: "PAUSED",
      trigger: { eventType: "shipping.fulfillment.shipped.v1" },
      conditions: [],
      actions: [],
      version: 2,
      createdAt: "2026-07-14T10:00:00.000Z",
      updatedAt: "2026-07-14T10:05:00.000Z",
    },
  },
  saveRuleResult = {
    ok: true,
    status: 200,
    correlationId: "corr-save",
    data: {
      ruleId: "rule-1",
      organizationId: "org-1",
      shopId: "shop-1",
      name: "Tracking enviado",
      status: "DRAFT",
      trigger: { eventType: "shipping.fulfillment.shipped.v1", filters: { country: "ES" } },
      conditions: [{ field: "payload.customerId", operator: "exists" }],
      actions: [{ actionId: "action-1", type: "BUSINESS_LOG", name: "Log", config: { eventName: "custom" }, position: 0 }],
      version: 1,
      createdAt: "2026-07-14T10:00:00.000Z",
      updatedAt: "2026-07-14T10:05:00.000Z",
    },
  },
  retryResult = {
    ok: true,
    status: 200,
    correlationId: "corr-retry",
    data: {
      executionId: "execution-1",
      ruleId: "rule-1",
      organizationId: "org-1",
      shopId: "shop-1",
      eventId: "event-1",
      eventType: "shipping.fulfillment.shipped.v1",
      eventOccurredAt: null,
      eventPayload: { orderId: "order-1" },
      correlationId: "corr-event",
      causationId: null,
      aggregateId: "order-1",
      aggregateVersion: 2,
      status: "SUCCEEDED",
      errorMessage: null,
      startedAt: "2026-07-14T10:01:00.000Z",
      finishedAt: "2026-07-14T10:02:00.000Z",
      createdAt: "2026-07-14T10:01:00.000Z",
      updatedAt: "2026-07-14T10:02:00.000Z",
      steps: [],
    },
  },
  emailTemplatesResult = {
    ok: true,
    status: 200,
    correlationId: "corr-templates",
    data: {
      items: [{
        templateId: "template-1",
        templateKey: "shipping.delivered",
        locale: "es-ES",
        status: "ACTIVE",
        subjectTemplate: "Pedido entregado",
        updatedAt: "2026-07-15T10:00:00.000Z",
      }, {
        templateId: "template-2",
        templateKey: "invoice.available",
        locale: "es-ES",
        status: "ACTIVE",
        subjectTemplate: "Factura disponible",
        updatedAt: "2026-07-15T10:00:00.000Z",
      }],
      total: 2,
      limit: 100,
      offset: 0,
    },
  },
} = {}) {
  const moduleSource = source("src/modules/configuracion/automation-admin-actions.ts");
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
        return {
          revalidatePath(pathValue) {
            calls.push(["revalidatePath", pathValue]);
          },
        };
      }
      if (specifier === "next/navigation") {
        return {
          redirect(url) {
            calls.push(["redirect", url]);
            const error = new Error("NEXT_REDIRECT");
            error.url = url;
            throw error;
          },
        };
      }
      if (specifier.endsWith("/shared/config/admin-context")) {
        return {
          getAdminContext: async () => adminContext,
        };
      }
      if (specifier === "./automation-admin" || specifier.endsWith("/automation-admin")) {
        return {
          bootstrapAutomationTrackingEmailDefaults: async (ctx, payload) => {
            calls.push(["tracking", ctx, payload]);
            return trackingResult;
          },
          bootstrapAutomationInvoiceEmailDefaults: async (ctx, payload) => {
            calls.push(["invoice", ctx, payload]);
            return invoiceResult;
          },
          transitionAutomationRule: async (ctx, ruleId, transition) => {
            calls.push(["transition", ctx, ruleId, transition]);
            return transitionResult;
          },
          createAutomationRule: async (ctx, payload) => {
            calls.push(["create", ctx, payload]);
            return saveRuleResult;
          },
          patchAutomationRule: async (ctx, ruleId, payload) => {
            calls.push(["patch", ctx, ruleId, payload]);
            return saveRuleResult;
          },
          retryAutomationExecution: async (ctx, executionId) => {
            calls.push(["retry", ctx, executionId]);
            return retryResult;
          },
          listAutomationEmailTemplates: async (ctx) => {
            calls.push(["templates", ctx]);
            return emailTemplatesResult;
          },
          recommendedAutomationDraft(id) {
            if (id !== "delivery-email") {
              return undefined;
            }

            return {
              id,
              name: "Avisar al cliente cuando se entrega un pedido",
              templateKey: "shipping.delivered",
              templateLabel: "Pedido entregado",
              payload: {
                name: "Avisar al cliente cuando se entrega un pedido",
                trigger: { eventType: "shipping.fulfillment.delivered.v1" },
                conditions: [],
                actions: [{
                  type: "SEND_EMAIL",
                  name: "Enviar aviso de entrega",
                  config: { templateKey: "shipping.delivered" },
                  position: 0,
                }],
              },
            };
          },
          automationBusinessEvents: [{
            area: "Envios",
            eventType: "shipping.fulfillment.delivered.v1",
            label: "Pedido entregado",
          }, {
            area: "Facturacion",
            eventType: "invoice.issued.v1",
            label: "Factura disponible",
          }],
          recommendedAutomationDrafts: [{
            id: "delivery-email",
            templateKey: "shipping.delivered",
            templateLabel: "Pedido entregado",
            payload: {
              name: "Avisar al cliente cuando se entrega un pedido",
              trigger: { eventType: "shipping.fulfillment.delivered.v1" },
              conditions: [],
              actions: [{
                type: "SEND_EMAIL",
                name: "Enviar aviso de entrega",
                config: { templateKey: "shipping.delivered", recipient: { customerIdPath: "payload.customerId" } },
                position: 0,
              }],
            },
          }],
        };
      }

      return {};
    },
  };

  vm.runInNewContext(outputText, moduleContext);
  return { ...moduleContext.module.exports, calls };
}

test("automation admin is exposed under configuration navigation", () => {
  const shellSource = source("src/app-shell/admin-shell.tsx");
  const configSource = source("app/(admin)/admin/configuracion/page.tsx");
  const routeSource = source("app/(admin)/admin/configuracion/automatizacion/page.tsx");
  const pageSource = source("src/modules/configuracion/automation-admin-page.tsx");
  const permissionsSource = source("src/shared/permissions/permissions.ts");

  assert.match(shellSource, /\/admin\/configuracion\/automatizacion/);
  assert.match(shellSource, /automation:view/);
  assert.match(configSource, /Abrir automatizacion/);
  assert.match(routeSource, /getAutomationAdminData/);
  assert.match(routeSource, /AutomationAdminPage/);
  assert.match(pageSource, /Admin \/ Configuracion \/ Automatizacion/);
  assert.match(pageSource, /Automatizaciones de esta tienda/);
  assert.match(pageSource, /Que puedes automatizar/);
  assert.match(pageSource, /Activación avanzada de avisos existentes/);
  assert.match(permissionsSource, /admin:automation:view/);
  assert.match(permissionsSource, /automation\.manage/);
});

test("automation phase one keeps the canonical events while exposing business labels", () => {
  const dataSource = source("src/modules/configuracion/automation-admin.ts");
  const pageSource = source("src/modules/configuracion/automation-admin-page.tsx");

  assert.match(dataSource, /orders\.order\.confirmed\.v1/);
  assert.match(dataSource, /shipping\.fulfillment\.delivered\.v1/);
  assert.match(dataSource, /invoice\.issued\.v1/);
  assert.match(dataSource, /after-sales\.case\.submitted\.v1/);
  assert.match(dataSource, /automationEventLabel/);
  assert.match(pageSource, /AutomationEventText/);
  assert.match(pageSource, /Ver nombres tecnicos de los eventos/);
  assert.match(pageSource, /Filtros del trigger JSON/);
  assert.match(pageSource, /Acciones JSON/);
});

test("automation phase two provides three safe guided creation journeys", () => {
  const routeSource = source("app/(admin)/admin/configuracion/automatizacion/page.tsx");
  const dataSource = source("src/modules/configuracion/automation-admin.ts");
  const pageSource = source("src/modules/configuracion/automation-admin-page.tsx");

  assert.match(routeSource, /rule-guided/);
  assert.match(routeSource, /normalizeStarter/);
  assert.match(dataSource, /AutomationGuidedStarter/);
  assert.match(pageSource, /Diseña una automatización/);
  assert.match(pageSource, /Avisar cuando se entrega un pedido/);
  assert.match(pageSource, /Avisar cuando la factura esta disponible/);
  assert.match(pageSource, /Avisar al equipo de una solicitud postventa/);
  assert.match(pageSource, /Este es un recorrido de revisión\. No crea, modifica ni activa una regla\./);
  assert.match(pageSource, /Abrir modo avanzado/);
});

test("automation phase three creates recommended email rules as drafts only when the template is active", () => {
  const dataSource = source("src/modules/configuracion/automation-admin.ts");
  const actionsSource = source("src/modules/configuracion/automation-admin-actions.ts");
  const pageSource = source("src/modules/configuracion/automation-admin-page.tsx");

  assert.match(dataSource, /recommendedAutomationDrafts/);
  assert.match(dataSource, /shipping\.delivered/);
  assert.match(dataSource, /invoice\.available/);
  assert.match(dataSource, /listAutomationEmailTemplates/);
  assert.match(actionsSource, /createRecommendedAutomationDraftAction/);
  assert.match(actionsSource, /template\.status === "ACTIVE"/);
  assert.match(pageSource, /Automatizaciones recomendadas/);
  assert.match(pageSource, /Crear borrador para revisar/);
  assert.match(pageSource, /Revisar lo que se creará/);
});

test("automation phase four makes simple rules visual and preserves the advanced editor", () => {
  const routeSource = source("app/(admin)/admin/configuracion/automatizacion/page.tsx");
  const pageSource = source("src/modules/configuracion/automation-admin-page.tsx");
  const actionsSource = source("src/modules/configuracion/automation-admin-actions.ts");
  const builderSource = source("src/modules/configuracion/automation-visual-rule-builder.tsx");

  assert.match(routeSource, /rule-visual-create/);
  assert.match(pageSource, /AutomationVisualRuleBuilder/);
  assert.match(pageSource, /drawer: "rule-visual-create"/);
  assert.match(pageSource, /RuleEditorForm/);
  assert.match(builderSource, /1\. Cuando ocurre/);
  assert.match(builderSource, /2\. Si se cumple/);
  assert.match(builderSource, /3\. Qué queremos hacer/);
  assert.match(builderSource, /4\. Revisar antes de crear/);
  assert.match(builderSource, /Crear borrador para revisar/);
  assert.match(builderSource, /Abrir modo avanzado/);
  assert.match(actionsSource, /createVisualAutomationRuleAction/);
  assert.match(actionsSource, /template\.status === "ACTIVE"/);
});

test("automation phase five explains activation readiness and execution outcomes", () => {
  const pageSource = source("src/modules/configuracion/automation-admin-page.tsx");
  const phaseSource = source("docs/automation-ux-phase-5.md");

  assert.match(pageSource, /AutomationRuleConfidencePanel/);
  assert.match(pageSource, /Antes de activar/);
  assert.match(pageSource, /ruleOutcomeText/);
  assert.match(pageSource, /Servicio preparado para ejecutar/);
  assert.match(pageSource, /Plantillas de email/);
  assert.match(pageSource, /RuleActivationAction/);
  assert.match(pageSource, /Confirmar activación/);
  assert.match(pageSource, /ExecutionConfidencePanel/);
  assert.match(pageSource, /Qué ha ocurrido/);
  assert.match(pageSource, /Siguiente paso/);
  assert.match(pageSource, /Revisar plantilla y proveedor de email/);
  assert.match(phaseSource, /confianza de ejecución/);
  assert.match(phaseSource, /Activar continúa siendo una decisión manual/);
});

test("automation phase six keeps advanced rules intact and migrates only exact visual equivalents", () => {
  const dataSource = source("src/modules/configuracion/automation-admin.ts");
  const routeSource = source("app/(admin)/admin/configuracion/automatizacion/page.tsx");
  const pageSource = source("src/modules/configuracion/automation-admin-page.tsx");
  const builderSource = source("src/modules/configuracion/automation-visual-rule-builder.tsx");
  const phaseSource = source("docs/automation-ux-phase-6.md");

  assert.match(dataSource, /rule-migrate/);
  assert.match(routeSource, /rule-migrate/);
  assert.match(pageSource, /visualMigrationPlan/);
  assert.match(pageSource, /sameJsonValue/);
  assert.match(pageSource, /AutomationAdvancedCompatibility/);
  assert.match(pageSource, /Visual compatible/);
  assert.match(pageSource, /Configuración avanzada/);
  assert.match(pageSource, /AutomationRuleMigrationDrawer/);
  assert.match(pageSource, /Crear copia visual para revisar/);
  assert.match(builderSource, /migrationSourceRuleId/);
  assert.match(phaseSource, /copia visual en borrador/);
  assert.match(phaseSource, /Solo se ofrece una copia visual/);
});

test("automation admin route delegates reads to the data layer without direct BFF calls", () => {
  const routeSource = source("app/(admin)/admin/configuracion/automatizacion/page.tsx");

  assert.doesNotMatch(routeSource, /requestBff/);
  assert.match(routeSource, /normalizeDrawer/);
  assert.match(routeSource, /rule-create/);
  assert.match(routeSource, /rule-edit/);
  assert.match(routeSource, /executionId/);
  assert.match(routeSource, /rulesLimit/);
  assert.match(routeSource, /rulesOffset/);
  assert.match(routeSource, /executionsLimit/);
  assert.match(routeSource, /executionsOffset/);
  assert.match(routeSource, /normalizeListLimit/);
  assert.match(routeSource, /normalizeListOffset/);
  assert.match(routeSource, /normalizeRuleStatus/);
  assert.match(routeSource, /normalizeExecutionStatus/);
  assert.doesNotMatch(routeSource, /fetch\(/);
});

test("automation admin data layer uses scoped BFF endpoints for health rules executions and defaults", async () => {
  const dataSource = source("src/modules/configuracion/automation-admin.ts");
  const calls = [];
  const requestBff = async (pathValue) => {
    calls.push(pathValue);
    if (pathValue === "/admin/automation/health") {
      return {
        ok: true,
        status: 200,
        correlationId: "corr-health",
        data: {
          status: "ok",
          service: "automation",
          consumerEnabled: true,
          readiness: {
            consumerRequired: true,
            ready: true,
            requiredEventTypes: ["shipping.fulfillment.shipped.v1"],
            missingRequiredEventTypes: [],
          },
        },
      };
    }
    if (pathValue.startsWith("/admin/automation/rules?")) {
      return {
        ok: true,
        status: 200,
        correlationId: "corr-rules",
        data: {
          items: [{
            ruleId: "rule-1",
            organizationId: "org-1",
            shopId: "shop-1",
            name: "Tracking enviado",
            status: "ACTIVE",
            trigger: { eventType: "shipping.fulfillment.shipped.v1" },
            conditions: [],
            actions: [{ actionId: "action-1", type: "SEND_EMAIL", name: "Email tracking", config: {}, position: 0 }],
            version: 1,
            createdAt: "2026-07-14T10:00:00.000Z",
            updatedAt: "2026-07-14T10:00:00.000Z",
          }],
          total: 1,
          limit: 10,
          offset: 5,
        },
      };
    }
    return {
      ok: true,
      status: 200,
      correlationId: "corr-executions",
      data: {
        items: [{
          executionId: "execution-1",
          ruleId: "rule-1",
          organizationId: "org-1",
          shopId: "shop-1",
          eventId: "event-1",
          eventType: "shipping.fulfillment.shipped.v1",
          eventOccurredAt: null,
          eventPayload: {},
          correlationId: null,
          causationId: null,
          aggregateId: null,
          aggregateVersion: null,
          status: "FAILED",
          errorMessage: "smtp unavailable",
          startedAt: "2026-07-14T10:01:00.000Z",
          finishedAt: null,
          createdAt: "2026-07-14T10:01:00.000Z",
          updatedAt: "2026-07-14T10:01:00.000Z",
        }],
        total: 1,
        limit: 30,
        offset: 2,
      },
    };
  };
  const { getAutomationAdminData } = loadAutomationAdminModule(requestBff);

  const data = await getAutomationAdminData(context, {
    eventType: "shipping.fulfillment.shipped.v1",
    executionStatus: "FAILED",
    executionsLimit: "30",
    executionsOffset: "2",
    ruleId: "rule-1",
    ruleStatus: "ACTIVE",
    rulesLimit: "10",
    rulesOffset: "5",
  });

  assert.match(dataSource, /\/admin\/automation\/health/);
  assert.match(dataSource, /\/admin\/automation\/rules/);
  assert.match(dataSource, /\/admin\/automation\/executions/);
  assert.match(dataSource, /\/admin\/automation\/rules\/\$\{encodeURIComponent\(normalizedRuleId\)\}/);
  assert.match(dataSource, /\/admin\/automation\/rules\/\$\{encodeURIComponent\(normalizedRuleId\)\}\/\$\{transition\}/);
  assert.match(dataSource, /\/admin\/automation\/executions\/\$\{encodeURIComponent\(normalizedExecutionId\)\}/);
  assert.match(dataSource, /\/admin\/automation\/executions\/\$\{encodeURIComponent\(normalizedExecutionId\)\}\/retry/);
  assert.match(dataSource, /\/admin\/automation\/rules\/tracking-email-defaults/);
  assert.match(dataSource, /\/admin\/automation\/rules\/invoice-email-defaults/);
  assert.doesNotMatch(dataSource, /localhost:3019|AUTOMATION_SERVICE_URL|localStorage/);
  assert.deepEqual(calls, [
    "/admin/automation/health",
    "/admin/automation/rules?organizationId=org-1&shopId=shop-1&status=ACTIVE&eventType=shipping.fulfillment.shipped.v1&limit=10&offset=5",
    "/admin/automation/executions?organizationId=org-1&shopId=shop-1&status=FAILED&ruleId=rule-1&eventType=shipping.fulfillment.shipped.v1&limit=30&offset=2",
    "/admin/communications/templates/email?organizationId=org-1&shopId=shop-1&locale=es-ES&limit=100&offset=0",
  ]);
  assert.equal(data.health.data.service, "automation");
  assert.equal(data.rules.data.items[0].actions[0].type, "SEND_EMAIL");
  assert.equal(data.executions.data.items[0].status, "FAILED");
});

test("automation admin reads selected rule and execution details through scoped BFF", async () => {
  const calls = [];
  const requestBff = async (pathValue) => {
    calls.push(pathValue);
    if (pathValue.startsWith("/admin/automation/rules/rule-1?")) {
      return {
        ok: true,
        status: 200,
        correlationId: "corr-rule-detail",
        data: {
          ruleId: "rule-1",
          organizationId: "org-1",
          shopId: "shop-1",
          name: "Tracking enviado",
          status: "ACTIVE",
          trigger: { eventType: "shipping.fulfillment.shipped.v1", filters: { country: "ES" } },
          conditions: [{ field: "payload.customerId", operator: "exists" }],
          actions: [{ actionId: "action-1", type: "SEND_EMAIL", name: "Email tracking", config: { templateKey: "shipping.shipped" }, position: 0 }],
          version: 1,
          createdAt: "2026-07-14T10:00:00.000Z",
          updatedAt: "2026-07-14T10:00:00.000Z",
        },
      };
    }
    if (pathValue.startsWith("/admin/automation/executions/execution-1?")) {
      return {
        ok: true,
        status: 200,
        correlationId: "corr-execution-detail",
        data: {
          executionId: "execution-1",
          ruleId: "rule-1",
          organizationId: "org-1",
          shopId: "shop-1",
          eventId: "event-1",
          eventType: "shipping.fulfillment.shipped.v1",
          eventOccurredAt: null,
          eventPayload: { orderId: "order-1" },
          correlationId: "corr-event",
          causationId: null,
          aggregateId: "order-1",
          aggregateVersion: 2,
          status: "FAILED",
          errorMessage: "smtp unavailable",
          startedAt: "2026-07-14T10:01:00.000Z",
          finishedAt: null,
          createdAt: "2026-07-14T10:01:00.000Z",
          updatedAt: "2026-07-14T10:01:00.000Z",
          steps: [{
            stepId: "step-1",
            executionId: "execution-1",
            actionId: "action-1",
            type: "SEND_EMAIL",
            status: "FAILED",
            input: { templateKey: "shipping.shipped" },
            output: null,
            errorMessage: "smtp unavailable",
            startedAt: "2026-07-14T10:01:00.000Z",
            finishedAt: null,
          }],
        },
      };
    }
    return {
      ok: true,
      status: 200,
      correlationId: "corr-list",
      data: { status: "ok", service: "automation", items: [], total: 0, limit: 20, offset: 0 },
    };
  };
  const {
    getAutomationAdminData,
    getAutomationRule,
    getAutomationExecution,
  } = loadAutomationAdminModule(requestBff);

  const rule = await getAutomationRule(context, "rule-1");
  const execution = await getAutomationExecution(context, "execution-1");
  const data = await getAutomationAdminData(context, { drawer: "rule", ruleId: "rule-1" });

  assert.deepEqual(calls.slice(0, 2), [
    "/admin/automation/rules/rule-1?organizationId=org-1&shopId=shop-1",
    "/admin/automation/executions/execution-1?organizationId=org-1&shopId=shop-1",
  ]);
  assert.ok(calls.includes("/admin/automation/rules/rule-1?organizationId=org-1&shopId=shop-1"));
  assert.equal(rule.data.trigger.filters.country, "ES");
  assert.equal(execution.data.steps[0].type, "SEND_EMAIL");
  assert.equal(data.selectedRule.data.ruleId, "rule-1");
  assert.equal(data.selectedExecution, undefined);
});

test("automation admin transitions selected rules through scoped BFF", async () => {
  const calls = [];
  const requestBff = async (pathValue, options) => {
    calls.push([pathValue, options?.init]);
    return {
      ok: true,
      status: 200,
      correlationId: "corr-transition",
      data: {
        ruleId: "rule-1",
        organizationId: "org-1",
        shopId: "shop-1",
        name: "Tracking enviado",
        status: "PAUSED",
        trigger: { eventType: "shipping.fulfillment.shipped.v1" },
        conditions: [],
        actions: [],
        version: 2,
        createdAt: "2026-07-14T10:00:00.000Z",
        updatedAt: "2026-07-14T10:05:00.000Z",
      },
    };
  };
  const { transitionAutomationRule } = loadAutomationAdminModule(requestBff);

  const result = await transitionAutomationRule(context, "rule-1", "pause");

  assert.equal(result.data.status, "PAUSED");
  assert.deepEqual(calls.map(([pathValue]) => pathValue), [
    "/admin/automation/rules/rule-1/pause?organizationId=org-1&shopId=shop-1",
  ]);
  assert.deepEqual(calls.map(([, init]) => JSON.parse(JSON.stringify(init))), [
    { method: "POST" },
  ]);
});

test("automation admin creates and edits rule definitions through scoped BFF", async () => {
  const calls = [];
  const requestBff = async (pathValue, options) => {
    calls.push([pathValue, options?.init]);
    return {
      ok: true,
      status: 200,
      correlationId: "corr-save",
      data: {
        ruleId: "rule-1",
        organizationId: "org-1",
        shopId: "shop-1",
        name: "Tracking enviado",
        status: "DRAFT",
        trigger: { eventType: "shipping.fulfillment.shipped.v1", filters: { country: "ES" } },
        conditions: [{ field: "payload.customerId", operator: "exists" }],
        actions: [{ actionId: "action-1", type: "BUSINESS_LOG", name: "Log", config: { eventName: "custom" }, position: 0 }],
        version: 1,
        createdAt: "2026-07-14T10:00:00.000Z",
        updatedAt: "2026-07-14T10:05:00.000Z",
      },
    };
  };
  const { createAutomationRule, patchAutomationRule } = loadAutomationAdminModule(requestBff);
  const payload = {
    name: "Tracking enviado",
    description: "Aviso al cliente",
    trigger: { eventType: "shipping.fulfillment.shipped.v1", filters: { country: "ES" } },
    conditions: [{ field: "payload.customerId", operator: "exists" }],
    actions: [{ type: "BUSINESS_LOG", name: "Log", config: { eventName: "custom" }, position: 0 }],
  };

  await createAutomationRule(context, payload);
  await patchAutomationRule(context, "rule-1", payload);

  assert.deepEqual(calls.map(([pathValue]) => pathValue), [
    "/admin/automation/rules?organizationId=org-1&shopId=shop-1",
    "/admin/automation/rules/rule-1?organizationId=org-1&shopId=shop-1",
  ]);
  assert.deepEqual(calls.map(([, init]) => [
    init.method,
    JSON.parse(JSON.stringify(init.headers)),
    JSON.parse(init.body),
  ]), [
    ["POST", { "content-type": "application/json" }, payload],
    ["PATCH", { "content-type": "application/json" }, payload],
  ]);
});

test("automation admin retries selected executions through scoped BFF", async () => {
  const calls = [];
  const requestBff = async (pathValue, options) => {
    calls.push([pathValue, options?.init]);
    return {
      ok: true,
      status: 200,
      correlationId: "corr-retry",
      data: {
        executionId: "execution-1",
        ruleId: "rule-1",
        organizationId: "org-1",
        shopId: "shop-1",
        eventId: "event-1",
        eventType: "shipping.fulfillment.shipped.v1",
        eventOccurredAt: null,
        eventPayload: { orderId: "order-1" },
        correlationId: null,
        causationId: null,
        aggregateId: "order-1",
        aggregateVersion: 2,
        status: "SUCCEEDED",
        errorMessage: null,
        startedAt: "2026-07-14T10:01:00.000Z",
        finishedAt: "2026-07-14T10:02:00.000Z",
        createdAt: "2026-07-14T10:01:00.000Z",
        updatedAt: "2026-07-14T10:02:00.000Z",
        steps: [],
      },
    };
  };
  const { retryAutomationExecution } = loadAutomationAdminModule(requestBff);

  const result = await retryAutomationExecution(context, "execution-1");

  assert.equal(result.data.status, "SUCCEEDED");
  assert.deepEqual(calls.map(([pathValue]) => pathValue), [
    "/admin/automation/executions/execution-1/retry?organizationId=org-1&shopId=shop-1",
  ]);
  assert.deepEqual(calls.map(([, init]) => JSON.parse(JSON.stringify(init))), [
    { method: "POST" },
  ]);
});

test("automation admin default bootstraps post tenant-scoped payloads through BFF", async () => {
  const calls = [];
  const requestBff = async (pathValue, options) => {
    calls.push([pathValue, options?.init]);
    return {
      ok: true,
      status: 200,
      correlationId: "corr-defaults",
      data: { locale: "es-ES", created: 1, updated: 0, existing: 0, items: [] },
    };
  };
  const {
    bootstrapAutomationTrackingEmailDefaults,
    bootstrapAutomationInvoiceEmailDefaults,
  } = loadAutomationAdminModule(requestBff);

  await bootstrapAutomationTrackingEmailDefaults(context, { locale: "es-ES", overwrite: true });
  await bootstrapAutomationInvoiceEmailDefaults(context, { locale: "es-ES", overwrite: false });

  assert.deepEqual(calls.map(([pathValue]) => pathValue), [
    "/admin/automation/rules/tracking-email-defaults?organizationId=org-1&shopId=shop-1",
    "/admin/automation/rules/invoice-email-defaults?organizationId=org-1&shopId=shop-1",
  ]);
  assert.deepEqual(calls.map(([, init]) => [
    init.method,
    JSON.parse(JSON.stringify(init.headers)),
    JSON.parse(init.body),
  ]), [
    ["POST", { "content-type": "application/json" }, { locale: "es-ES", overwrite: true }],
    ["POST", { "content-type": "application/json" }, { locale: "es-ES", overwrite: false }],
  ]);
});

test("automation admin default bootstraps remain blocked without tenant context", async () => {
  const calls = [];
  const requestBff = async (pathValue) => {
    calls.push(pathValue);
    return {
      ok: true,
      status: 200,
      correlationId: "corr-defaults",
      data: { locale: "es-ES", created: 1, updated: 0, existing: 0, items: [] },
    };
  };
  const {
    bootstrapAutomationTrackingEmailDefaults,
    bootstrapAutomationInvoiceEmailDefaults,
  } = loadAutomationAdminModule(requestBff);

  const tracking = await bootstrapAutomationTrackingEmailDefaults(
    { ...context, organizationId: "", shopId: "" },
    { locale: "es-ES", overwrite: false },
  );
  const invoice = await bootstrapAutomationInvoiceEmailDefaults(
    { ...context, organizationId: "", shopId: "" },
    { locale: "es-ES", overwrite: false },
  );

  assert.deepEqual(calls, []);
  assert.equal(tracking.ok, false);
  assert.equal(tracking.status, 428);
  assert.equal(invoice.ok, false);
  assert.equal(invoice.status, 428);
});

test("automation admin data layer keeps tenant-scoped reads blocked without admin context", async () => {
  const calls = [];
  const requestBff = async (pathValue) => {
    calls.push(pathValue);
    return {
      ok: true,
      status: 200,
      correlationId: "corr-health",
      data: { status: "ok", service: "automation" },
    };
  };
  const { getAutomationAdminData } = loadAutomationAdminModule(requestBff);
  const data = await getAutomationAdminData({ ...context, organizationId: "", shopId: "" });

  assert.deepEqual(calls, ["/admin/automation/health"]);
  assert.equal(data.health.ok, true);
  assert.equal(data.rules.ok, false);
  assert.equal(data.rules.status, 428);
  assert.equal(data.executions.ok, false);
  assert.equal(data.executions.status, 428);
});

test("automation admin dashboard renders health rules executions and controlled default forms", () => {
  const pageSource = source("src/modules/configuracion/automation-admin-page.tsx");
  const actionsSource = source("src/modules/configuracion/automation-admin-actions.ts");

  assert.match(pageSource, /Resumen automatizacion/);
  assert.match(pageSource, /Estado operativo/);
  assert.match(pageSource, /Operacion segura/);
  assert.match(pageSource, /AutomationOperationalGuide/);
  assert.match(pageSource, /Antes de activar/);
  assert.match(pageSource, /Revisar Comunicaciones/);
  assert.match(pageSource, /Ver ejecuciones fallidas/);
  assert.match(pageSource, /Reglas/);
  assert.match(pageSource, /Ejecuciones recientes/);
  assert.match(pageSource, /AutomationPagination/);
  assert.match(pageSource, /productListPagination/);
  assert.match(pageSource, /adminButtonDisabled/);
  assert.match(pageSource, /pageSizeOptions/);
  assert.match(pageSource, /rulesLimit/);
  assert.match(pageSource, /rulesOffset/);
  assert.match(pageSource, /executionsLimit/);
  assert.match(pageSource, /executionsOffset/);
  assert.match(pageSource, /\["10", "20", "50"\]/);
  assert.match(pageSource, /\{pageSize\} por pagina/);
  assert.match(pageSource, /Activación avanzada de avisos existentes/);
  assert.match(pageSource, /AutomationDetailDrawer/);
  assert.match(pageSource, /Detalle de regla/);
  assert.match(pageSource, /Detalle de ejecucion/);
  assert.match(pageSource, /Crear regla/);
  assert.match(pageSource, /Editar regla/);
  assert.match(pageSource, /RuleEditorForm/);
  assert.match(pageSource, /adminSideDrawer/);
  assert.match(pageSource, /JsonPreview/);
  assert.match(pageSource, /Payload del evento/);
  assert.match(pageSource, /Ver detalle/);
  assert.match(pageSource, /drawer: "rule"/);
  assert.match(pageSource, /drawer: "execution"/);
  assert.match(pageSource, /drawer: "rule-create"/);
  assert.match(pageSource, /drawer: "rule-edit"/);
  assert.match(pageSource, /saveAutomationRuleAction/);
  assert.match(pageSource, /RuleEditorExamples/);
  assert.match(pageSource, /Ver ejemplos JSON seguros/);
  assert.match(pageSource, /sendEmailExampleActions/);
  assert.match(pageSource, /invoiceEmailExampleActions/);
  assert.match(pageSource, /shipping\.shipped/);
  assert.match(pageSource, /invoice\.available/);
  assert.match(pageSource, /customerIdPath/);
  assert.match(pageSource, /dataPaths/);
  assert.match(pageSource, /name="triggerFiltersJson"/);
  assert.match(pageSource, /name="conditionsJson"/);
  assert.match(pageSource, /name="actionsJson"/);
  assert.match(pageSource, /BUSINESS_LOG/);
  assert.match(pageSource, /HTTP_REQUEST/);
  assert.match(pageSource, /EMIT_EVENT/);
  assert.match(pageSource, /SEND_EMAIL/);
  assert.match(pageSource, /ExecutionRetryAction/);
  assert.match(pageSource, /retryAutomationExecutionAction/);
  assert.match(pageSource, /Reintentar ejecucion/);
  assert.match(pageSource, /Confirmar reintento/);
  assert.match(pageSource, /FAILED o DLQ/);
  assert.match(pageSource, /RuleLifecycleActions/);
  assert.match(pageSource, /transitionAutomationRuleAction/);
  assert.match(pageSource, /Activar regla/);
  assert.match(pageSource, /Pausar regla/);
  assert.match(pageSource, /Archivar regla/);
  assert.match(pageSource, /Confirmar archivo/);
  assert.match(pageSource, /productDangerMenu/);
  assert.match(pageSource, /Activar avisos de pedido y entrega/);
  assert.match(pageSource, /Activar aviso de factura/);
  assert.match(pageSource, /bootstrapAutomationTrackingEmailDefaultsAction/);
  assert.match(pageSource, /bootstrapAutomationInvoiceEmailDefaultsAction/);
  assert.match(pageSource, /\/admin\/configuracion\/comunicaciones/);
  assert.match(pageSource, /overwrite/);
  assert.match(pageSource, /Aplicar filtros/);
  assert.match(pageSource, /method="get"/);
  assert.match(pageSource, /adminKpiGrid/);
  assert.match(pageSource, /adminTable/);
  assert.match(pageSource, /consumer\.counters\.processed/);
  assert.match(pageSource, /missingRequiredEventTypes/);
  assert.match(pageSource, /automationHref\(filters, \{ ruleStatus: "ACTIVE" \}\)/);
  assert.match(pageSource, /automationHref\(filters, \{ executionStatus: "FAILED" \}\)/);
  assert.match(actionsSource, /automation\.manage/);
  assert.match(actionsSource, /transitionAutomationRule/);
  assert.match(actionsSource, /retryAutomationExecution/);
  assert.match(actionsSource, /createAutomationRule/);
  assert.match(actionsSource, /patchAutomationRule/);
  assert.match(actionsSource, /parseAutomationRulePayload/);
  assert.match(actionsSource, /automationActionTypes/);
  assert.match(actionsSource, /automationConditionOperators/);
  assert.match(actionsSource, /automationRuleTransitions/);
  assert.match(actionsSource, /revalidatePath\("\/admin\/configuracion\/automatizacion"\)/);
});

test("automation admin default actions redirect with operation summaries", async () => {
  const actions = loadAutomationActionsModule();
  const trackingForm = new FormData();
  trackingForm.set("locale", "es-ES");
  trackingForm.set("overwrite", "on");

  await assert.rejects(
    async () => actions.bootstrapAutomationTrackingEmailDefaultsAction(trackingForm),
    (error) => {
      const url = new URL(error.url, "http://admin.test");
      assert.equal(url.pathname, "/admin/configuracion/automatizacion");
      assert.equal(
        url.searchParams.get("notice"),
        "Reglas tracking listas: 1 creadas, 2 actualizadas, 3 existentes, 1 archivadas.",
      );
      return true;
    },
  );

  const invoiceForm = new FormData();
  await assert.rejects(
    async () => actions.bootstrapAutomationInvoiceEmailDefaultsAction(invoiceForm),
    (error) => {
      const url = new URL(error.url, "http://admin.test");
      assert.equal(url.pathname, "/admin/configuracion/automatizacion");
      assert.equal(url.searchParams.get("notice"), "Reglas factura listas: 0 creadas, 0 actualizadas, 1 existentes.");
      return true;
    },
  );

  assert.deepEqual(
    actions.calls
      .filter(([kind]) => kind === "tracking" || kind === "invoice")
      .map(([kind, ctx, payload]) => [
        kind,
        JSON.parse(JSON.stringify(ctx)),
        JSON.parse(JSON.stringify(payload)),
      ]),
    [
      ["tracking", context, { locale: "es-ES", overwrite: true }],
      ["invoice", context, { locale: "es-ES", overwrite: false }],
    ],
  );
  assert.deepEqual(
    actions.calls.filter(([kind]) => kind === "revalidatePath").map(([, pathValue]) => pathValue),
    ["/admin/configuracion/automatizacion", "/admin/configuracion/automatizacion"],
  );
});

test("recommended automation draft checks the active template and opens the draft for review", async () => {
  const actions = loadAutomationActionsModule();
  const form = new FormData();
  form.set("recommendedAutomation", "delivery-email");

  await assert.rejects(
    async () => actions.createRecommendedAutomationDraftAction(form),
    (error) => {
      const url = new URL(error.url, "http://admin.test");
      assert.equal(url.searchParams.get("drawer"), "rule");
      assert.equal(url.searchParams.get("ruleId"), "rule-1");
      assert.match(url.searchParams.get("notice"), /Borrador creado/);
      return true;
    },
  );

  assert.deepEqual(actions.calls.slice(0, 2).map((call) => call[0]), ["templates", "create"]);
  assert.equal(actions.calls[1][2].trigger.eventType, "shipping.fulfillment.delivered.v1");
  assert.equal(actions.calls[1][2].actions[0].config.templateKey, "shipping.delivered");
  assert.equal(actions.calls[1][2].actions[0].config.locale, "es-ES");
});

test("recommended automation draft does not create a rule when its template is inactive", async () => {
  const actions = loadAutomationActionsModule({
    emailTemplatesResult: {
      ok: true,
      status: 200,
      correlationId: "corr-templates",
      data: {
        items: [{
          templateId: "template-1",
          templateKey: "shipping.delivered",
          locale: "es-ES",
          status: "INACTIVE",
          subjectTemplate: "Pedido entregado",
          updatedAt: "2026-07-15T10:00:00.000Z",
        }],
        total: 1,
        limit: 100,
        offset: 0,
      },
    },
  });
  const form = new FormData();
  form.set("recommendedAutomation", "delivery-email");

  await assert.rejects(
    async () => actions.createRecommendedAutomationDraftAction(form),
    (error) => {
      const url = new URL(error.url, "http://admin.test");
      assert.match(url.searchParams.get("notice"), /Activa la plantilla Pedido entregado/);
      return true;
    },
  );

  assert.deepEqual(actions.calls.map((call) => call[0]), ["templates", "revalidatePath", "redirect"]);
});

test("visual rule builder creates an email draft only after template verification", async () => {
  const actions = loadAutomationActionsModule();
  const form = new FormData();
  form.set("name", "Entrega: aviso al cliente");
  form.set("eventType", "shipping.fulfillment.delivered.v1");
  form.set("conditionMode", "customer-exists");
  form.set("actionType", "SEND_EMAIL");
  form.set("templateKey", "shipping.delivered");

  await assert.rejects(
    async () => actions.createVisualAutomationRuleAction(form),
    (error) => {
      const url = new URL(error.url, "http://admin.test");
      assert.equal(url.searchParams.get("drawer"), "rule");
      assert.equal(url.searchParams.get("ruleId"), "rule-1");
      assert.match(url.searchParams.get("notice"), /Borrador creado/);
      return true;
    },
  );

  assert.deepEqual(actions.calls.slice(0, 2).map((call) => call[0]), ["templates", "create"]);
  assert.equal(actions.calls[1][2].trigger.eventType, "shipping.fulfillment.delivered.v1");
  assert.deepEqual(JSON.parse(JSON.stringify(actions.calls[1][2].conditions)), [{ field: "payload.customerId", operator: "exists" }]);
  assert.equal(actions.calls[1][2].actions[0].config.templateKey, "shipping.delivered");
  assert.equal(actions.calls[1][2].actions[0].config.locale, "es-ES");
});

test("visual rule builder can create a draft that records an event without checking templates", async () => {
  const actions = loadAutomationActionsModule();
  const form = new FormData();
  form.set("name", "Registrar entrega");
  form.set("eventType", "shipping.fulfillment.delivered.v1");
  form.set("conditionMode", "always");
  form.set("actionType", "BUSINESS_LOG");

  await assert.rejects(
    async () => actions.createVisualAutomationRuleAction(form),
    (error) => {
      const url = new URL(error.url, "http://admin.test");
      assert.equal(url.searchParams.get("drawer"), "rule");
      return true;
    },
  );

  assert.deepEqual(actions.calls.slice(0, 1).map((call) => call[0]), ["create"]);
  assert.deepEqual(JSON.parse(JSON.stringify(actions.calls[0][2].actions)), [{
    type: "BUSINESS_LOG",
    name: "Registrar: Pedido entregado",
    config: { eventName: "shipping.fulfillment.delivered.v1" },
    position: 0,
  }]);
});

test("visual migration creates a separate traceable draft without changing the source rule", async () => {
  const actions = loadAutomationActionsModule();
  const form = new FormData();
  form.set("name", "Copia para revisar: Entrega");
  form.set("eventType", "shipping.fulfillment.delivered.v1");
  form.set("conditionMode", "always");
  form.set("actionType", "BUSINESS_LOG");
  form.set("migrationSourceRuleId", "rule-original");

  await assert.rejects(
    async () => actions.createVisualAutomationRuleAction(form),
    (error) => {
      const url = new URL(error.url, "http://admin.test");
      assert.equal(url.searchParams.get("drawer"), "rule");
      assert.equal(url.searchParams.get("ruleId"), "rule-1");
      return true;
    },
  );

  const createCall = actions.calls.find(([kind]) => kind === "create");
  assert.equal(createCall[2].description, "Copia en borrador de la regla rule-original. Revisar antes de activar.");
  assert.equal(actions.calls.some(([kind]) => kind === "transition" || kind === "patch"), false);
});

test("automation admin default actions show automation permission errors", async () => {
  const actions = loadAutomationActionsModule({
    trackingResult: {
      ok: false,
      status: 403,
      correlationId: "corr-forbidden",
      error: "Forbidden",
    },
  });
  const formData = new FormData();

  await assert.rejects(
    async () => actions.bootstrapAutomationTrackingEmailDefaultsAction(formData),
    (error) => {
      const url = new URL(error.url, "http://admin.test");
      assert.equal(url.searchParams.get("notice"), "Falta permiso automation.manage.");
      return true;
    },
  );
});

test("automation admin save rule action creates and edits validated rule payloads", async () => {
  const createActions = loadAutomationActionsModule();
  const createForm = new FormData();
  createForm.set("mode", "create");
  createForm.set("name", "Tracking enviado");
  createForm.set("description", "Aviso al cliente");
  createForm.set("eventType", "shipping.fulfillment.shipped.v1");
  createForm.set("triggerFiltersJson", '{"country":"ES"}');
  createForm.set("conditionsJson", '[{"field":"payload.customerId","operator":"exists"}]');
  createForm.set("actionsJson", '[{"type":"BUSINESS_LOG","name":"Log","config":{"eventName":"custom"},"position":0}]');

  await assert.rejects(
    async () => createActions.saveAutomationRuleAction(createForm),
    (error) => {
      const url = new URL(error.url, "http://admin.test");
      assert.equal(url.pathname, "/admin/configuracion/automatizacion");
      assert.equal(url.searchParams.get("drawer"), "rule");
      assert.equal(url.searchParams.get("ruleId"), "rule-1");
      assert.equal(url.searchParams.get("notice"), "Regla Tracking enviado guardada.");
      return true;
    },
  );

  assert.deepEqual(
    createActions.calls
      .filter(([kind]) => kind === "create")
      .map(([kind, ctx, payload]) => [
        kind,
        JSON.parse(JSON.stringify(ctx)),
        JSON.parse(JSON.stringify(payload)),
      ]),
    [[
      "create",
      context,
      {
        name: "Tracking enviado",
        description: "Aviso al cliente",
        trigger: { eventType: "shipping.fulfillment.shipped.v1", filters: { country: "ES" } },
        conditions: [{ field: "payload.customerId", operator: "exists" }],
        actions: [{ type: "BUSINESS_LOG", name: "Log", config: { eventName: "custom" }, position: 0 }],
      },
    ]],
  );

  const editActions = loadAutomationActionsModule();
  const editForm = new FormData();
  editForm.set("mode", "edit");
  editForm.set("ruleId", "rule-1");
  editForm.set("name", "Tracking enviado");
  editForm.set("eventType", "shipping.fulfillment.shipped.v1");
  editForm.set("triggerFiltersJson", "{}");
  editForm.set("conditionsJson", "[]");
  editForm.set("actionsJson", '[{"actionId":"action-1","type":"BUSINESS_LOG","name":"Log","config":{"eventName":"custom"},"position":0}]');

  await assert.rejects(
    async () => editActions.saveAutomationRuleAction(editForm),
    (error) => {
      const url = new URL(error.url, "http://admin.test");
      assert.equal(url.searchParams.get("drawer"), "rule");
      assert.equal(url.searchParams.get("ruleId"), "rule-1");
      assert.equal(url.searchParams.get("notice"), "Regla Tracking enviado guardada.");
      return true;
    },
  );

  assert.deepEqual(
    editActions.calls
      .filter(([kind]) => kind === "patch")
      .map(([kind, ctx, ruleId, payload]) => [
        kind,
        JSON.parse(JSON.stringify(ctx)),
        ruleId,
        JSON.parse(JSON.stringify(payload)),
      ]),
    [[
      "patch",
      context,
      "rule-1",
      {
        name: "Tracking enviado",
        description: null,
        trigger: { eventType: "shipping.fulfillment.shipped.v1", filters: {} },
        conditions: [],
        actions: [{ actionId: "action-1", type: "BUSINESS_LOG", name: "Log", config: { eventName: "custom" }, position: 0 }],
      },
    ]],
  );
});

test("automation admin save rule action blocks invalid JSON and maps permissions", async () => {
  const invalidActions = loadAutomationActionsModule();
  const invalidForm = new FormData();
  invalidForm.set("mode", "create");
  invalidForm.set("name", "Tracking enviado");
  invalidForm.set("eventType", "shipping.fulfillment.shipped.v1");
  invalidForm.set("actionsJson", "{bad-json");

  await assert.rejects(
    async () => invalidActions.saveAutomationRuleAction(invalidForm),
    (error) => {
      const url = new URL(error.url, "http://admin.test");
      assert.equal(url.searchParams.get("drawer"), "rule-create");
      assert.equal(url.searchParams.get("notice"), "Acciones debe ser JSON valido.");
      return true;
    },
  );
  assert.equal(invalidActions.calls.some(([kind]) => kind === "create" || kind === "patch"), false);

  const forbiddenActions = loadAutomationActionsModule({
    saveRuleResult: {
      ok: false,
      status: 403,
      correlationId: "corr-forbidden",
      error: "Forbidden",
    },
  });
  const forbiddenForm = new FormData();
  forbiddenForm.set("mode", "create");
  forbiddenForm.set("name", "Tracking enviado");
  forbiddenForm.set("eventType", "shipping.fulfillment.shipped.v1");
  forbiddenForm.set("conditionsJson", "[]");
  forbiddenForm.set("actionsJson", '[{"type":"BUSINESS_LOG","name":"Log","config":{"eventName":"custom"},"position":0}]');

  await assert.rejects(
    async () => forbiddenActions.saveAutomationRuleAction(forbiddenForm),
    (error) => {
      const url = new URL(error.url, "http://admin.test");
      assert.equal(url.searchParams.get("drawer"), "rule-create");
      assert.equal(url.searchParams.get("notice"), "Falta permiso automation.manage.");
      return true;
    },
  );
});

test("automation admin rule transition action redirects with selected rule context", async () => {
  const actions = loadAutomationActionsModule();
  const formData = new FormData();
  formData.set("ruleId", "rule-1");
  formData.set("transition", "pause");

  await assert.rejects(
    async () => actions.transitionAutomationRuleAction(formData),
    (error) => {
      const url = new URL(error.url, "http://admin.test");
      assert.equal(url.pathname, "/admin/configuracion/automatizacion");
      assert.equal(url.searchParams.get("drawer"), "rule");
      assert.equal(url.searchParams.get("ruleId"), "rule-1");
      assert.equal(url.searchParams.get("notice"), "Regla Tracking enviado pausada.");
      return true;
    },
  );

  assert.deepEqual(
    actions.calls
      .filter(([kind]) => kind === "transition")
      .map(([kind, ctx, ruleId, transition]) => [
        kind,
        JSON.parse(JSON.stringify(ctx)),
        ruleId,
        transition,
      ]),
    [["transition", context, "rule-1", "pause"]],
  );
  assert.deepEqual(
    actions.calls.filter(([kind]) => kind === "revalidatePath").map(([, pathValue]) => pathValue),
    ["/admin/configuracion/automatizacion"],
  );
});

test("automation admin rule transition action blocks invalid transitions and maps permissions", async () => {
  const invalidActions = loadAutomationActionsModule();
  const invalidForm = new FormData();
  invalidForm.set("ruleId", "rule-1");
  invalidForm.set("transition", "delete");

  await assert.rejects(
    async () => invalidActions.transitionAutomationRuleAction(invalidForm),
    (error) => {
      const url = new URL(error.url, "http://admin.test");
      assert.equal(url.searchParams.get("notice"), "Transicion de regla no permitida.");
      assert.equal(url.searchParams.get("drawer"), "rule");
      assert.equal(url.searchParams.get("ruleId"), "rule-1");
      return true;
    },
  );
  assert.equal(invalidActions.calls.some(([kind]) => kind === "transition"), false);

  const forbiddenActions = loadAutomationActionsModule({
    transitionResult: {
      ok: false,
      status: 403,
      correlationId: "corr-forbidden",
      error: "Forbidden",
    },
  });
  const forbiddenForm = new FormData();
  forbiddenForm.set("ruleId", "rule-1");
  forbiddenForm.set("transition", "archive");

  await assert.rejects(
    async () => forbiddenActions.transitionAutomationRuleAction(forbiddenForm),
    (error) => {
      const url = new URL(error.url, "http://admin.test");
      assert.equal(url.searchParams.get("notice"), "Falta permiso automation.manage.");
      assert.equal(url.searchParams.get("drawer"), "rule");
      assert.equal(url.searchParams.get("ruleId"), "rule-1");
      return true;
    },
  );
});

test("automation admin execution retry action redirects with selected execution context", async () => {
  const actions = loadAutomationActionsModule();
  const formData = new FormData();
  formData.set("executionId", "execution-1");

  await assert.rejects(
    async () => actions.retryAutomationExecutionAction(formData),
    (error) => {
      const url = new URL(error.url, "http://admin.test");
      assert.equal(url.pathname, "/admin/configuracion/automatizacion");
      assert.equal(url.searchParams.get("drawer"), "execution");
      assert.equal(url.searchParams.get("executionId"), "execution-1");
      assert.equal(url.searchParams.get("notice"), "Ejecucion execution-1 reintentada. Estado actual: SUCCEEDED.");
      return true;
    },
  );

  assert.deepEqual(
    actions.calls
      .filter(([kind]) => kind === "retry")
      .map(([kind, ctx, executionId]) => [
        kind,
        JSON.parse(JSON.stringify(ctx)),
        executionId,
      ]),
    [["retry", context, "execution-1"]],
  );
  assert.deepEqual(
    actions.calls.filter(([kind]) => kind === "revalidatePath").map(([, pathValue]) => pathValue),
    ["/admin/configuracion/automatizacion"],
  );
});

test("automation admin execution retry action validates selection and maps permissions", async () => {
  const missingActions = loadAutomationActionsModule();
  const missingForm = new FormData();

  await assert.rejects(
    async () => missingActions.retryAutomationExecutionAction(missingForm),
    (error) => {
      const url = new URL(error.url, "http://admin.test");
      assert.equal(url.searchParams.get("notice"), "Selecciona una ejecucion fallida para reintentar.");
      return true;
    },
  );
  assert.equal(missingActions.calls.some(([kind]) => kind === "retry"), false);

  const forbiddenActions = loadAutomationActionsModule({
    retryResult: {
      ok: false,
      status: 403,
      correlationId: "corr-forbidden",
      error: "Forbidden",
    },
  });
  const forbiddenForm = new FormData();
  forbiddenForm.set("executionId", "execution-1");

  await assert.rejects(
    async () => forbiddenActions.retryAutomationExecutionAction(forbiddenForm),
    (error) => {
      const url = new URL(error.url, "http://admin.test");
      assert.equal(url.searchParams.get("notice"), "Falta permiso automation.manage.");
      assert.equal(url.searchParams.get("drawer"), "execution");
      assert.equal(url.searchParams.get("executionId"), "execution-1");
      return true;
    },
  );
});

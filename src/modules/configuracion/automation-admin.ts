import { requestBff } from "../../shared/bff/client";
import type { BffResult } from "../../shared/bff/types";
import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";

export type AutomationRuleStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
export type AutomationRuleTransition = "activate" | "pause" | "archive";
export type AutomationExecutionStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "SKIPPED"
  | "RETRYING"
  | "DLQ";
export type AutomationActionType = "BUSINESS_LOG" | "HTTP_REQUEST" | "EMIT_EVENT" | "SEND_EMAIL";
export type AutomationJsonObject = Record<string, unknown>;

export type AutomationConsumerHealth = {
  enabled: boolean;
  status: "disabled" | "connecting" | "connected" | "degraded" | "stopped";
  connected: boolean;
  channelReady: boolean;
  exchangeName: string;
  exchangeType: string;
  queueName: string;
  retryQueueName: string;
  dlqQueueName: string;
  prefetch: number;
  retryMaxAttempts: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
  allowedEventTypes: string[];
  startupAttempts: number;
  counters: {
    received: number;
    ignored: number;
    processed: number;
    duplicates: number;
    retried: number;
    dlq: number;
    failed: number;
  };
  lastEventAt: string | null;
  lastProcessedAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
};

export type AutomationHealth = {
  status: "ok" | "degraded" | "warning" | string;
  service?: "automation" | string;
  persistenceDriver?: string;
  consumerEnabled?: boolean;
  databaseConfigured?: boolean;
  directDatabaseConfigured?: boolean;
  observability?: {
    severity: "ok" | "warn" | "alert";
    alerts: string[];
  };
  readiness?: {
    consumerRequired: boolean;
    ready: boolean;
    requiredEventTypes: string[];
    missingRequiredEventTypes: string[];
  };
  consumer?: AutomationConsumerHealth;
};

export type AutomationTrigger = {
  eventType: string;
  filters?: AutomationJsonObject;
};

export type AutomationCondition = {
  field: string;
  operator: "equals" | "not_equals" | "exists" | "in";
  value?: unknown;
};

export type AutomationAction = {
  actionId: string;
  type: AutomationActionType;
  name: string | null;
  config: AutomationJsonObject;
  position: number;
};

export type AutomationRuleWriteAction = {
  actionId?: string;
  type: AutomationActionType;
  name?: string | null;
  config: AutomationJsonObject;
  position?: number;
};

export type AutomationRuleWritePayload = {
  name: string;
  description?: string | null;
  trigger: AutomationTrigger;
  conditions?: AutomationCondition[];
  actions: AutomationRuleWriteAction[];
};

export type AutomationRulePatchPayload = Partial<AutomationRuleWritePayload>;

export type AutomationRule = {
  ruleId: string;
  organizationId: string;
  shopId: string;
  name: string;
  description?: string | null;
  status: AutomationRuleStatus;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  version: number;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string | null;
  archivedAt?: string | null;
};

export type AutomationEmailDefaultsResultItem = {
  name: string;
  eventType: string;
  templateKey: string;
  action: "created" | "updated" | "exists";
  rule: AutomationRule;
};

export type AutomationEmailDefaultsResponse = {
  locale: string;
  created: number;
  updated: number;
  existing: number;
  archived?: number;
  archivedRuleIds?: string[];
  items: AutomationEmailDefaultsResultItem[];
};

export type AutomationEmailTemplateStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type AutomationEmailTemplate = {
  templateId: string;
  templateKey: string;
  locale: string;
  status: AutomationEmailTemplateStatus;
  subjectTemplate: string | null;
  updatedAt: string;
};

export type AutomationEmailTemplateList = {
  items: AutomationEmailTemplate[];
  total: number;
  limit: number;
  offset: number;
};

export type AutomationRuleList = {
  items: AutomationRule[];
  total: number;
  limit: number;
  offset: number;
};

export type AutomationExecutionSummary = {
  executionId: string;
  ruleId: string;
  organizationId: string;
  shopId: string;
  eventId: string;
  eventType: string;
  eventOccurredAt: string | null;
  eventPayload: AutomationJsonObject;
  correlationId: string | null;
  causationId: string | null;
  aggregateId: string | null;
  aggregateVersion: number | null;
  status: AutomationExecutionStatus;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AutomationExecutionStep = {
  stepId: string;
  executionId: string;
  actionId: string;
  type: AutomationActionType;
  status: "SUCCEEDED" | "FAILED";
  input: AutomationJsonObject;
  output: AutomationJsonObject | null;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type AutomationExecutionDetail = AutomationExecutionSummary & {
  steps: AutomationExecutionStep[];
};

export type AutomationExecutionList = {
  items: AutomationExecutionSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type AutomationAdminFilters = {
  drawer?: "rule" | "execution" | "rule-create" | "rule-edit" | "rule-guided" | "rule-visual-create" | "rule-migrate";
  eventType?: string;
  executionId?: string;
  executionStatus?: AutomationExecutionStatus;
  notice?: string;
  ruleId?: string;
  ruleStatus?: AutomationRuleStatus;
  rulesLimit?: string;
  rulesOffset?: string;
  starter?: AutomationGuidedStarter;
  executionsLimit?: string;
  executionsOffset?: string;
};

export type AutomationGuidedStarter = "delivery-email" | "invoice-email" | "post-sales-notice";

export type AutomationAdminData = {
  context: AdminContext;
  health: BffResult<AutomationHealth>;
  rules: BffResult<AutomationRuleList>;
  executions: BffResult<AutomationExecutionList>;
  emailTemplates: BffResult<AutomationEmailTemplateList>;
  selectedRule?: BffResult<AutomationRule>;
  selectedExecution?: BffResult<AutomationExecutionDetail>;
};

export type RecommendedAutomationDraft = {
  id: "delivery-email" | "invoice-email";
  description: string;
  name: string;
  templateKey: string;
  templateLabel: string;
  payload: AutomationRuleWritePayload;
};

export const recommendedAutomationDrafts: RecommendedAutomationDraft[] = [
  {
    id: "delivery-email",
    name: "Avisar al cliente cuando se entrega un pedido",
    description: "Envia el aviso de entrega al cliente cuando el envio se marca como entregado.",
    templateKey: "shipping.delivered",
    templateLabel: "Pedido entregado",
    payload: {
      name: "Avisar al cliente cuando se entrega un pedido",
      description: "Aviso preparado desde Admin. Revisar antes de activar.",
      trigger: { eventType: "shipping.fulfillment.delivered.v1" },
      conditions: [],
      actions: [{
        type: "SEND_EMAIL",
        name: "Enviar aviso de entrega",
        config: {
          templateKey: "shipping.delivered",
          locale: "es-ES",
          recipient: { customerIdPath: "payload.customerId" },
          dataPaths: {
            orderId: "payload.orderId",
            fulfillmentId: "payload.fulfillmentId",
            trackingNumber: "payload.trackingNumber",
            carrierId: "payload.carrierId",
          },
        },
        position: 0,
      }],
    },
  },
  {
    id: "invoice-email",
    name: "Avisar al cliente cuando la factura esta disponible",
    description: "Envia el aviso de factura disponible al cliente cuando se emite una factura.",
    templateKey: "invoice.available",
    templateLabel: "Factura disponible",
    payload: {
      name: "Avisar al cliente cuando la factura esta disponible",
      description: "Aviso preparado desde Admin. Revisar antes de activar.",
      trigger: { eventType: "invoice.issued.v1" },
      conditions: [],
      actions: [{
        type: "SEND_EMAIL",
        name: "Enviar aviso de factura",
        config: {
          templateKey: "invoice.available",
          locale: "es-ES",
          recipient: { customerIdPath: "payload.customerId" },
          data: { invoiceAreaUrl: "/account/invoices" },
          dataPaths: {
            invoiceId: "payload.invoiceId",
            orderId: "payload.orderId",
            invoiceNumberFormatted: "payload.invoiceNumberFormatted",
            totalMinor: "payload.totalMinor",
            currency: "payload.currency",
          },
        },
        position: 0,
      }],
    },
  },
];

export function recommendedAutomationDraft(id: string | undefined) {
  return recommendedAutomationDrafts.find((draft) => draft.id === id);
}

export type AutomationBusinessEvent = {
  area: "Pedidos" | "Pagos" | "Envios" | "Facturacion" | "Postventa";
  eventType: string;
  label: string;
};

// Catalogo de lenguaje de negocio para Admin. No modifica la allowlist ni crea
// acciones: conserva el eventType canonico que entiende Automation.
export const automationBusinessEvents: AutomationBusinessEvent[] = [
  { area: "Pedidos", eventType: "orders.order.confirmed.v1", label: "Pedido confirmado" },
  { area: "Pagos", eventType: "payments.transaction.settled.v1", label: "Pago confirmado" },
  { area: "Envios", eventType: "shipping.fulfillment.created.v1", label: "Envio en preparacion" },
  { area: "Envios", eventType: "shipping.fulfillment.ready-to-pick.v1", label: "Envio listo para recogida" },
  { area: "Envios", eventType: "shipping.fulfillment.packed.v1", label: "Envio empaquetado" },
  { area: "Envios", eventType: "shipping.fulfillment.shipped.v1", label: "Envio enviado" },
  { area: "Envios", eventType: "shipping.fulfillment.delivered.v1", label: "Envio entregado" },
  { area: "Facturacion", eventType: "invoice.issued.v1", label: "Factura disponible" },
  { area: "Postventa", eventType: "after-sales.case.submitted.v1", label: "Solicitud postventa recibida" },
  { area: "Postventa", eventType: "after-sales.refund-completed.v1", label: "Reembolso completado" },
];

export function automationEventLabel(eventType: string) {
  return automationBusinessEvents.find((event) => event.eventType === eventType)?.label ?? eventType;
}

function scopedPath(path: string, context: AdminContext, extra?: Record<string, string | undefined>) {
  const params = new URLSearchParams({
    organizationId: context.organizationId,
    shopId: context.shopId,
  });

  Object.entries(extra ?? {}).forEach(([key, value]) => {
    if (value?.trim()) {
      params.set(key, value.trim());
    }
  });

  return `${path}?${params.toString()}`;
}

function missingContext<T>(message: string): BffResult<T> {
  return {
    ok: false,
    status: 428,
    error: message,
    correlationId: "automation-context-missing",
  };
}

function invalidSelection<T>(message: string): BffResult<T> {
  return {
    ok: false,
    status: 400,
    error: message,
    correlationId: "automation-selection-missing",
  };
}

export async function getAutomationHealth(context: AdminContext) {
  return requestBff<AutomationHealth>("/admin/automation/health", { context });
}

export async function listAutomationEmailTemplates(context: AdminContext): Promise<BffResult<AutomationEmailTemplateList>> {
  if (!hasRequiredAdminContext(context)) {
    return missingContext("Define organizationId y shopId para consultar plantillas de email.");
  }

  return requestBff<AutomationEmailTemplateList>(
    scopedPath("/admin/communications/templates/email", context, {
      locale: context.locale,
      limit: "100",
      offset: "0",
    }),
    { context },
  );
}

export async function listAutomationRules(
  context: AdminContext,
  filters: AutomationAdminFilters = {},
): Promise<BffResult<AutomationRuleList>> {
  if (!hasRequiredAdminContext(context)) {
    return missingContext("Define organizationId y shopId para consultar reglas de automatizacion.");
  }

  return requestBff<AutomationRuleList>(
    scopedPath("/admin/automation/rules", context, {
      status: filters.ruleStatus,
      eventType: filters.eventType,
      limit: filters.rulesLimit ?? "20",
      offset: filters.rulesOffset ?? "0",
    }),
    { context },
  );
}

export async function getAutomationRule(
  context: AdminContext,
  ruleId: string | undefined,
): Promise<BffResult<AutomationRule>> {
  if (!hasRequiredAdminContext(context)) {
    return missingContext("Define organizationId y shopId para consultar la regla de automatizacion.");
  }

  const normalizedRuleId = ruleId?.trim();
  if (!normalizedRuleId) {
    return invalidSelection("Selecciona una regla para ver su detalle.");
  }

  return requestBff<AutomationRule>(
    scopedPath(`/admin/automation/rules/${encodeURIComponent(normalizedRuleId)}`, context),
    { context },
  );
}

export async function createAutomationRule(
  context: AdminContext,
  payload: AutomationRuleWritePayload,
): Promise<BffResult<AutomationRule>> {
  if (!hasRequiredAdminContext(context)) {
    return missingContext("Define organizationId y shopId para crear la regla de automatizacion.");
  }

  return requestBff<AutomationRule>(
    scopedPath("/admin/automation/rules", context),
    {
      context,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    },
  );
}

export async function patchAutomationRule(
  context: AdminContext,
  ruleId: string | undefined,
  payload: AutomationRulePatchPayload,
): Promise<BffResult<AutomationRule>> {
  if (!hasRequiredAdminContext(context)) {
    return missingContext("Define organizationId y shopId para editar la regla de automatizacion.");
  }

  const normalizedRuleId = ruleId?.trim();
  if (!normalizedRuleId) {
    return invalidSelection("Selecciona una regla para editar.");
  }

  return requestBff<AutomationRule>(
    scopedPath(`/admin/automation/rules/${encodeURIComponent(normalizedRuleId)}`, context),
    {
      context,
      init: {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    },
  );
}

export async function transitionAutomationRule(
  context: AdminContext,
  ruleId: string | undefined,
  transition: AutomationRuleTransition,
): Promise<BffResult<AutomationRule>> {
  if (!hasRequiredAdminContext(context)) {
    return missingContext("Define organizationId y shopId para cambiar el estado de la regla.");
  }

  const normalizedRuleId = ruleId?.trim();
  if (!normalizedRuleId) {
    return invalidSelection("Selecciona una regla para cambiar su estado.");
  }

  return requestBff<AutomationRule>(
    scopedPath(`/admin/automation/rules/${encodeURIComponent(normalizedRuleId)}/${transition}`, context),
    {
      context,
      init: {
        method: "POST",
      },
    },
  );
}

export async function listAutomationExecutions(
  context: AdminContext,
  filters: AutomationAdminFilters = {},
): Promise<BffResult<AutomationExecutionList>> {
  if (!hasRequiredAdminContext(context)) {
    return missingContext("Define organizationId y shopId para consultar ejecuciones de automatizacion.");
  }

  return requestBff<AutomationExecutionList>(
    scopedPath("/admin/automation/executions", context, {
      status: filters.executionStatus,
      ruleId: filters.ruleId,
      eventType: filters.eventType,
      limit: filters.executionsLimit ?? "20",
      offset: filters.executionsOffset ?? "0",
    }),
    { context },
  );
}

export async function getAutomationExecution(
  context: AdminContext,
  executionId: string | undefined,
): Promise<BffResult<AutomationExecutionDetail>> {
  if (!hasRequiredAdminContext(context)) {
    return missingContext("Define organizationId y shopId para consultar la ejecucion de automatizacion.");
  }

  const normalizedExecutionId = executionId?.trim();
  if (!normalizedExecutionId) {
    return invalidSelection("Selecciona una ejecucion para ver su detalle.");
  }

  return requestBff<AutomationExecutionDetail>(
    scopedPath(`/admin/automation/executions/${encodeURIComponent(normalizedExecutionId)}`, context),
    { context },
  );
}

export async function retryAutomationExecution(
  context: AdminContext,
  executionId: string | undefined,
): Promise<BffResult<AutomationExecutionDetail>> {
  if (!hasRequiredAdminContext(context)) {
    return missingContext("Define organizationId y shopId para reintentar la ejecucion de automatizacion.");
  }

  const normalizedExecutionId = executionId?.trim();
  if (!normalizedExecutionId) {
    return invalidSelection("Selecciona una ejecucion fallida para reintentar.");
  }

  return requestBff<AutomationExecutionDetail>(
    scopedPath(`/admin/automation/executions/${encodeURIComponent(normalizedExecutionId)}/retry`, context),
    {
      context,
      init: {
        method: "POST",
      },
    },
  );
}

export async function bootstrapAutomationTrackingEmailDefaults(
  context: AdminContext,
  payload: { locale: string; overwrite: boolean },
): Promise<BffResult<AutomationEmailDefaultsResponse>> {
  if (!hasRequiredAdminContext(context)) {
    return missingContext("Define organizationId y shopId para activar reglas tracking de automatizacion.");
  }

  return requestBff<AutomationEmailDefaultsResponse>(
    scopedPath("/admin/automation/rules/tracking-email-defaults", context),
    {
      context,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    },
  );
}

export async function bootstrapAutomationInvoiceEmailDefaults(
  context: AdminContext,
  payload: { locale: string; overwrite: boolean },
): Promise<BffResult<AutomationEmailDefaultsResponse>> {
  if (!hasRequiredAdminContext(context)) {
    return missingContext("Define organizationId y shopId para activar reglas de factura de automatizacion.");
  }

  return requestBff<AutomationEmailDefaultsResponse>(
    scopedPath("/admin/automation/rules/invoice-email-defaults", context),
    {
      context,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    },
  );
}

export async function getAutomationAdminData(
  context: AdminContext,
  filters: AutomationAdminFilters = {},
): Promise<AutomationAdminData> {
  const [health, rules, executions, emailTemplates, selectedRule, selectedExecution] = await Promise.all([
    getAutomationHealth(context),
    listAutomationRules(context, filters),
    listAutomationExecutions(context, filters),
    listAutomationEmailTemplates(context),
    filters.drawer === "rule" || filters.drawer === "rule-edit" || filters.drawer === "rule-migrate"
      ? getAutomationRule(context, filters.ruleId)
      : Promise.resolve(undefined),
    filters.drawer === "execution" ? getAutomationExecution(context, filters.executionId) : Promise.resolve(undefined),
  ]);

  return {
    context,
    health,
    rules,
    executions,
    emailTemplates,
    selectedRule,
    selectedExecution,
  };
}

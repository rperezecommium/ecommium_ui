"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "../../shared/config/admin-context";
import {
  bootstrapAutomationInvoiceEmailDefaults,
  bootstrapAutomationTrackingEmailDefaults,
  createAutomationRule,
  listAutomationEmailTemplates,
  automationBusinessEvents,
  patchAutomationRule,
  recommendedAutomationDraft,
  recommendedAutomationDrafts,
  retryAutomationExecution,
  transitionAutomationRule,
  type AutomationActionType,
  type AutomationAdminFilters,
  type AutomationCondition,
  type AutomationEmailDefaultsResponse,
  type AutomationJsonObject,
  type AutomationRuleWriteAction,
  type AutomationRuleWritePayload,
  type AutomationRuleTransition,
} from "./automation-admin";

const automationRuleTransitions = new Set<AutomationRuleTransition>(["activate", "pause", "archive"]);
const automationActionTypes = new Set<AutomationActionType>(["BUSINESS_LOG", "HTTP_REQUEST", "EMIT_EVENT", "SEND_EMAIL"]);
const automationConditionOperators = new Set<AutomationCondition["operator"]>(["equals", "not_equals", "exists", "in"]);

const automationRuleTransitionLabels: Record<AutomationRuleTransition, string> = {
  activate: "activada",
  pause: "pausada",
  archive: "archivada",
};

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function asRuleTransition(value: FormDataEntryValue | null): AutomationRuleTransition | undefined {
  const normalized = asString(value);
  return automationRuleTransitions.has(normalized as AutomationRuleTransition)
    ? normalized as AutomationRuleTransition
    : undefined;
}

function isPlainObject(value: unknown): value is AutomationJsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonInput(value: FormDataEntryValue | null, label: string, fallback: unknown) {
  const raw = asString(value);
  if (!raw) {
    return { ok: true as const, value: fallback };
  }

  try {
    return { ok: true as const, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false as const, error: `${label} debe ser JSON valido.` };
  }
}

function validateTriggerFilters(value: unknown) {
  if (typeof value === "undefined") {
    return { ok: true as const, value: undefined };
  }

  if (!isPlainObject(value)) {
    return { ok: false as const, error: "Filtros del trigger debe ser un objeto JSON." };
  }

  return { ok: true as const, value };
}

function validateConditions(value: unknown) {
  if (!Array.isArray(value)) {
    return { ok: false as const, error: "Condiciones debe ser un arreglo JSON." };
  }

  const conditions: AutomationCondition[] = [];
  for (const [index, item] of value.entries()) {
    if (!isPlainObject(item)) {
      return { ok: false as const, error: `Condicion ${index + 1} debe ser un objeto.` };
    }

    const field = typeof item.field === "string" ? item.field.trim() : "";
    const operator = typeof item.operator === "string" ? item.operator.trim() : "";

    if (!field) {
      return { ok: false as const, error: `Condicion ${index + 1} necesita field.` };
    }

    if (!automationConditionOperators.has(operator as AutomationCondition["operator"])) {
      return { ok: false as const, error: `Condicion ${index + 1} usa un operador no permitido.` };
    }

    const condition: AutomationCondition = {
      field,
      operator: operator as AutomationCondition["operator"],
    };
    if ("value" in item) {
      condition.value = item.value;
    }
    conditions.push(condition);
  }

  return { ok: true as const, value: conditions };
}

function validateActions(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false as const, error: "Acciones debe contener al menos una accion." };
  }

  const actions: AutomationRuleWriteAction[] = [];
  for (const [index, item] of value.entries()) {
    if (!isPlainObject(item)) {
      return { ok: false as const, error: `Accion ${index + 1} debe ser un objeto.` };
    }

    const type = typeof item.type === "string" ? item.type.trim() : "";
    if (!automationActionTypes.has(type as AutomationActionType)) {
      return { ok: false as const, error: `Accion ${index + 1} usa un tipo no permitido.` };
    }

    if (!isPlainObject(item.config)) {
      return { ok: false as const, error: `Accion ${index + 1} necesita config como objeto JSON.` };
    }

    const position = typeof item.position === "undefined" ? index : item.position;
    if (!Number.isInteger(position) || Number(position) < 0) {
      return { ok: false as const, error: `Accion ${index + 1} necesita position entero positivo.` };
    }

    actions.push({
      actionId: asString(item.actionId as FormDataEntryValue | null),
      type: type as AutomationActionType,
      name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : null,
      config: item.config,
      position: Number(position),
    });
  }

  return { ok: true as const, value: actions };
}

function parseAutomationRulePayload(formData: FormData) {
  const name = asString(formData.get("name"));
  const eventType = asString(formData.get("eventType"));
  const description = asString(formData.get("description")) ?? null;

  if (!name) {
    return { ok: false as const, error: "La regla necesita un nombre." };
  }

  if (!eventType) {
    return { ok: false as const, error: "La regla necesita un evento disparador." };
  }

  const filtersJson = parseJsonInput(formData.get("triggerFiltersJson"), "Filtros del trigger", undefined);
  if (!filtersJson.ok) {
    return filtersJson;
  }
  const filters = validateTriggerFilters(filtersJson.value);
  if (!filters.ok) {
    return filters;
  }

  const conditionsJson = parseJsonInput(formData.get("conditionsJson"), "Condiciones", []);
  if (!conditionsJson.ok) {
    return conditionsJson;
  }
  const conditions = validateConditions(conditionsJson.value);
  if (!conditions.ok) {
    return conditions;
  }

  const actionsJson = parseJsonInput(formData.get("actionsJson"), "Acciones", undefined);
  if (!actionsJson.ok) {
    return actionsJson;
  }
  const actions = validateActions(actionsJson.value);
  if (!actions.ok) {
    return actions;
  }

  const trigger = typeof filters.value === "undefined"
    ? { eventType }
    : { eventType, filters: filters.value };
  const payload: AutomationRuleWritePayload = {
    name,
    description,
    trigger,
    conditions: conditions.value,
    actions: actions.value,
  };

  return { ok: true as const, payload };
}

function automationReturnPath(
  notice: string,
  options: { drawer?: AutomationAdminFilters["drawer"]; executionId?: string; ruleId?: string } = {},
) {
  const params = new URLSearchParams({ notice });

  if (options.drawer) {
    params.set("drawer", options.drawer);
  } else if (options.ruleId) {
    params.set("drawer", "rule");
  } else if (options.executionId) {
    params.set("drawer", "execution");
  }

  if (options.ruleId) {
    params.set("ruleId", options.ruleId);
  }
  if (options.executionId) {
    params.set("executionId", options.executionId);
  }

  return `/admin/configuracion/automatizacion?${params.toString()}`;
}

function finish(
  notice: string,
  options: { drawer?: AutomationAdminFilters["drawer"]; executionId?: string; ruleId?: string } = {},
): never {
  revalidatePath("/admin/configuracion/automatizacion");
  redirect(automationReturnPath(notice, options));
}

function formatDefaultsResult(prefix: string, data: AutomationEmailDefaultsResponse) {
  const archived = data.archived ? `, ${data.archived} archivadas` : "";

  return `${prefix}: ${data.created} creadas, ${data.updated} actualizadas, ${data.existing} existentes${archived}.`;
}

export async function bootstrapAutomationTrackingEmailDefaultsAction(formData: FormData): Promise<never> {
  const context = await getAdminContext();
  const result = await bootstrapAutomationTrackingEmailDefaults(context, {
    locale: asString(formData.get("locale")) ?? context.locale,
    overwrite: asBoolean(formData.get("overwrite")),
  });

  if (!result.ok) {
    finish(result.status === 403 ? "Falta permiso automation.manage." : result.error);
  }

  finish(formatDefaultsResult("Reglas tracking listas", result.data));
}

export async function bootstrapAutomationInvoiceEmailDefaultsAction(formData: FormData): Promise<never> {
  const context = await getAdminContext();
  const result = await bootstrapAutomationInvoiceEmailDefaults(context, {
    locale: asString(formData.get("locale")) ?? context.locale,
    overwrite: asBoolean(formData.get("overwrite")),
  });

  if (!result.ok) {
    finish(result.status === 403 ? "Falta permiso automation.manage." : result.error);
  }

  finish(formatDefaultsResult("Reglas factura listas", result.data));
}

export async function saveAutomationRuleAction(formData: FormData): Promise<never> {
  const mode = asString(formData.get("mode")) === "edit" ? "edit" : "create";
  const ruleId = asString(formData.get("ruleId"));
  const drawer = mode === "edit" ? "rule-edit" : "rule-create";

  if (mode === "edit" && !ruleId) {
    finish("Selecciona una regla para editar.", { drawer });
  }

  const parsed = parseAutomationRulePayload(formData);
  if (!parsed.ok) {
    finish(parsed.error, { drawer, ruleId });
  }

  const context = await getAdminContext();
  const result = mode === "edit"
    ? await patchAutomationRule(context, ruleId, parsed.payload)
    : await createAutomationRule(context, parsed.payload);

  if (!result.ok) {
    finish(result.status === 403 ? "Falta permiso automation.manage." : result.error, { drawer, ruleId });
  }

  finish(`Regla ${result.data.name || result.data.ruleId} guardada.`, {
    drawer: "rule",
    ruleId: result.data.ruleId,
  });
}

export async function createRecommendedAutomationDraftAction(formData: FormData): Promise<never> {
  const selectedDraft = recommendedAutomationDraft(asString(formData.get("recommendedAutomation")));

  if (!selectedDraft) {
    finish("Selecciona una automatizacion preparada para crear el borrador.");
  }

  const context = await getAdminContext();
  const templates = await listAutomationEmailTemplates(context);

  if (!templates.ok) {
    finish(templates.status === 403
      ? "Falta permiso para comprobar las plantillas de Comunicaciones."
      : templates.error);
  }

  const templateReady = templates.data.items.some((template) => (
    template.templateKey === selectedDraft.templateKey
    && template.locale === context.locale
    && template.status === "ACTIVE"
  ));

  if (!templateReady) {
    finish(`Activa la plantilla ${selectedDraft.templateLabel} en Comunicaciones antes de crear este borrador.`);
  }

  const payload = {
    ...selectedDraft.payload,
    actions: selectedDraft.payload.actions.map((action) => ({
      ...action,
      config: { ...action.config, locale: context.locale },
    })),
  };
  const result = await createAutomationRule(context, payload);

  if (!result.ok) {
    finish(result.status === 403 ? "Falta permiso automation.manage." : result.error);
  }

  finish(`Borrador creado: ${result.data.name}. Revísalo antes de activarlo.`, {
    drawer: "rule",
    ruleId: result.data.ruleId,
  });
}

export async function createVisualAutomationRuleAction(formData: FormData): Promise<never> {
  const name = asString(formData.get("name"));
  const eventType = asString(formData.get("eventType"));
  const actionType = asString(formData.get("actionType"));
  const conditionMode = asString(formData.get("conditionMode"));
  const migrationSourceRuleId = asString(formData.get("migrationSourceRuleId"));

  if (!name) {
    finish("Escribe un nombre para el borrador.", { drawer: "rule-visual-create" });
  }

  const event = automationBusinessEvents.find((item) => item.eventType === eventType);
  if (!event) {
    finish("Elige una situación válida para iniciar la automatización.", { drawer: "rule-visual-create" });
  }

  if (actionType !== "SEND_EMAIL" && actionType !== "BUSINESS_LOG") {
    finish("Elige qué debe hacer la automatización.", { drawer: "rule-visual-create" });
  }

  if (conditionMode !== "always" && conditionMode !== "customer-exists") {
    finish("Elige una condición válida.", { drawer: "rule-visual-create" });
  }

  const context = await getAdminContext();
  const conditions: AutomationCondition[] = conditionMode === "customer-exists"
    ? [{ field: "payload.customerId", operator: "exists" }]
    : [];
  let actions: AutomationRuleWriteAction[];

  if (actionType === "BUSINESS_LOG") {
    actions = [{
      type: "BUSINESS_LOG",
      name: `Registrar: ${event.label}`,
      config: { eventName: event.eventType },
      position: 0,
    }];
  } else {
    const templateKey = asString(formData.get("templateKey"));
    const selectedDraft = recommendedAutomationDrafts.find((draft) => (
      draft.payload.trigger.eventType === event.eventType && draft.templateKey === templateKey
    ));

    if (!selectedDraft) {
      finish("Esta combinación de situación y plantilla todavía no está preparada. Usa el modo avanzado.", {
        drawer: "rule-visual-create",
      });
    }

    const templates = await listAutomationEmailTemplates(context);
    if (!templates.ok) {
      finish(templates.status === 403
        ? "Falta permiso para comprobar las plantillas de Comunicaciones."
        : templates.error, { drawer: "rule-visual-create" });
    }

    const templateReady = templates.data.items.some((template) => (
      template.templateKey === selectedDraft.templateKey
      && template.locale === context.locale
      && template.status === "ACTIVE"
    ));
    if (!templateReady) {
      finish(`Activa la plantilla ${selectedDraft.templateLabel} en Comunicaciones antes de crear este borrador.`, {
        drawer: "rule-visual-create",
      });
    }

    actions = selectedDraft.payload.actions.map((action) => ({
      ...action,
      config: { ...action.config, locale: context.locale },
    }));
  }

  const result = await createAutomationRule(context, {
    name,
    description: migrationSourceRuleId
      ? `Copia en borrador de la regla ${migrationSourceRuleId}. Revisar antes de activar.`
      : "Regla creada con el asistente visual. Revisar antes de activar.",
    trigger: { eventType: event.eventType },
    conditions,
    actions,
  });

  if (!result.ok) {
    finish(result.status === 403 ? "Falta permiso automation.manage." : result.error, { drawer: "rule-visual-create" });
  }

  finish(`Borrador creado: ${result.data.name}. Revísalo antes de activarlo.`, {
    drawer: "rule",
    ruleId: result.data.ruleId,
  });
}

export async function transitionAutomationRuleAction(formData: FormData): Promise<never> {
  const context = await getAdminContext();
  const ruleId = asString(formData.get("ruleId"));
  const transition = asRuleTransition(formData.get("transition"));

  if (!ruleId) {
    finish("Selecciona una regla para cambiar su estado.");
  }

  if (!transition) {
    finish("Transicion de regla no permitida.", { ruleId });
  }

  const result = await transitionAutomationRule(context, ruleId, transition);

  if (!result.ok) {
    finish(result.status === 403 ? "Falta permiso automation.manage." : result.error, { ruleId });
  }

  finish(`Regla ${result.data.name || result.data.ruleId} ${automationRuleTransitionLabels[transition]}.`, {
    ruleId: result.data.ruleId,
  });
}

export async function retryAutomationExecutionAction(formData: FormData): Promise<never> {
  const context = await getAdminContext();
  const executionId = asString(formData.get("executionId"));

  if (!executionId) {
    finish("Selecciona una ejecucion fallida para reintentar.");
  }

  const result = await retryAutomationExecution(context, executionId);

  if (!result.ok) {
    finish(result.status === 403 ? "Falta permiso automation.manage." : result.error, { executionId });
  }

  finish(`Ejecucion ${result.data.executionId} reintentada. Estado actual: ${result.data.status}.`, {
    executionId: result.data.executionId,
  });
}

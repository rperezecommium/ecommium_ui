import Link from "next/link";
import type {
  AutomationBusinessEvent,
  AutomationAdminData,
  AutomationAdminFilters,
  AutomationExecutionDetail,
  AutomationExecutionStatus,
  AutomationGuidedStarter,
  AutomationRule,
  AutomationRuleStatus,
} from "./automation-admin";
import { automationBusinessEvents, automationEventLabel, recommendedAutomationDrafts } from "./automation-admin";
import { AutomationVisualRuleBuilder } from "./automation-visual-rule-builder";
import {
  bootstrapAutomationInvoiceEmailDefaultsAction,
  bootstrapAutomationTrackingEmailDefaultsAction,
  createRecommendedAutomationDraftAction,
  retryAutomationExecutionAction,
  saveAutomationRuleAction,
  transitionAutomationRuleAction,
} from "./automation-admin-actions";

type Props = {
  data: AutomationAdminData;
  filters: AutomationAdminFilters;
};

const ruleStatuses: AutomationRuleStatus[] = ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"];
const executionStatuses: AutomationExecutionStatus[] = [
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "SKIPPED",
  "RETRYING",
  "DLQ",
];
const pageSizeOptions = ["10", "20", "50"];
const defaultRuleActions = [{
  type: "BUSINESS_LOG",
  name: "Registrar evento",
  config: { eventName: "automation.custom" },
  position: 0,
}];
const sendEmailExampleActions = [{
  type: "SEND_EMAIL",
  name: "Email tracking enviado",
  config: {
    templateKey: "shipping.shipped",
    locale: "es-ES",
    recipient: {
      customerIdPath: "payload.customerId",
    },
    dataPaths: {
      orderId: "payload.orderId",
      fulfillmentId: "payload.fulfillmentId",
      trackingNumber: "payload.trackingNumber",
      carrierId: "payload.carrierId",
    },
  },
  position: 0,
}];
const invoiceEmailExampleActions = [{
  type: "SEND_EMAIL",
  name: "Email factura disponible",
  config: {
    templateKey: "invoice.available",
    locale: "es-ES",
    recipient: {
      customerIdPath: "payload.customerId",
    },
    data: {
      invoiceAreaUrl: "/account/invoices",
    },
    dataPaths: {
      invoiceId: "payload.invoiceId",
      orderId: "payload.orderId",
      invoiceNumberFormatted: "payload.invoiceNumberFormatted",
      totalMinor: "payload.totalMinor",
      currency: "payload.currency",
    },
  },
  position: 0,
}];

type ConfidenceStatus = "ready" | "review";

type RuleActivationCheck = {
  detail: string;
  label: string;
  status: ConfidenceStatus;
};

type RuleActivationReadiness = {
  checks: RuleActivationCheck[];
  ready: boolean;
};

type VisualMigrationPlan = {
  actionType: "SEND_EMAIL" | "BUSINESS_LOG";
  conditionMode: "always" | "customer-exists";
  eventType: string;
  name: string;
  templateKey?: string;
};

type RuleCompatibility = {
  migration?: VisualMigrationPlan;
  reason?: string;
};

function valueText(value: string | number | boolean | null | undefined) {
  if (typeof value === "boolean") {
    return value ? "Si" : "No";
  }
  if (value === null || typeof value === "undefined" || value === "") {
    return "-";
  }
  return String(value);
}

function dateText(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function truncateText(value: string | null | undefined, max = 96) {
  if (!value) {
    return "-";
  }

  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function configuredTemplateKey(action: AutomationRule["actions"][number]) {
  const templateKey = action.config.templateKey;
  return typeof templateKey === "string" && templateKey.trim() ? templateKey : undefined;
}

function ruleConditionText(rule: AutomationRule) {
  if (!rule.conditions.length) {
    return "siempre";
  }

  if (rule.conditions.length === 1 && rule.conditions[0].field === "payload.customerId" && rule.conditions[0].operator === "exists") {
    return "si hay un cliente identificado";
  }

  return `si se cumplen ${rule.conditions.length} condiciones`;
}

function ruleActionText(action: AutomationRule["actions"][number]) {
  if (action.type === "SEND_EMAIL") {
    const template = recommendedAutomationDrafts.find((draft) => draft.templateKey === configuredTemplateKey(action));
    return template ? `enviará el email “${template.templateLabel}”` : "enviará un email";
  }
  if (action.type === "BUSINESS_LOG") {
    return "registrará el evento para el equipo";
  }
  if (action.type === "HTTP_REQUEST") {
    return "avisará a una integración externa";
  }
  return "avisará a otro proceso";
}

function ruleOutcomeText(rule: AutomationRule) {
  const actions = [...rule.actions]
    .sort((left, right) => left.position - right.position)
    .map(ruleActionText);
  const actionText = actions.length ? actions.join(" y después ") : "no realizará ninguna acción";

  return `Cuando ocurra “${automationEventLabel(rule.trigger.eventType)}”, ${ruleConditionText(rule)}, Automation ${actionText}.`;
}

function sameJsonValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((item, index) => sameJsonValue(item, right[index]));
  }
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) {
    return false;
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => key in rightRecord && sameJsonValue(leftRecord[key], rightRecord[key]));
}

function visualMigrationPlan(rule: AutomationRule): RuleCompatibility {
  const eventExists = automationBusinessEvents.some((event) => event.eventType === rule.trigger.eventType);
  if (!eventExists) {
    return { reason: "usa un evento técnico que no tiene un equivalente visual todavía" };
  }
  if (Object.keys(rule.trigger.filters ?? {}).length) {
    return { reason: "incluye filtros de evento personalizados" };
  }

  let conditionMode: VisualMigrationPlan["conditionMode"];
  if (!rule.conditions.length) {
    conditionMode = "always";
  } else if (rule.conditions.length === 1 && rule.conditions[0].field === "payload.customerId" && rule.conditions[0].operator === "exists") {
    conditionMode = "customer-exists";
  } else {
    return { reason: "incluye condiciones avanzadas" };
  }

  if (rule.actions.length !== 1) {
    return { reason: "tiene varias acciones o una secuencia personalizada" };
  }

  const action = rule.actions[0];
  if (action.type === "BUSINESS_LOG") {
    if (!sameJsonValue(action.config, { eventName: rule.trigger.eventType })) {
      return { reason: "incluye una configuración de registro personalizada" };
    }
    return {
      migration: {
        actionType: "BUSINESS_LOG",
        conditionMode,
        eventType: rule.trigger.eventType,
        name: `Copia para revisar: ${rule.name}`,
      },
    };
  }

  if (action.type !== "SEND_EMAIL") {
    return { reason: "usa una acción técnica que se mantiene en modo avanzado" };
  }

  const templateKey = configuredTemplateKey(action);
  const draft = recommendedAutomationDrafts.find((item) => (
    item.templateKey === templateKey && item.payload.trigger.eventType === rule.trigger.eventType
  ));
  if (!draft || !sameJsonValue(action.config, draft.payload.actions[0].config)) {
    return { reason: "usa una plantilla o datos de email personalizados" };
  }

  return {
    migration: {
      actionType: "SEND_EMAIL",
      conditionMode,
      eventType: rule.trigger.eventType,
      name: `Copia para revisar: ${rule.name}`,
      templateKey,
    },
  };
}

function ruleActivationReadiness(data: AutomationAdminData, rule: AutomationRule): RuleActivationReadiness {
  const checks: RuleActivationCheck[] = [];
  const health = data.health.ok ? data.health.data : undefined;
  const hasActions = rule.actions.length > 0;
  checks.push({
    label: "Acciones de la regla",
    status: hasActions ? "ready" : "review",
    detail: hasActions ? `${rule.actions.length} acción(es) configurada(s).` : "La regla no tiene ninguna acción que ejecutar.",
  });

  const consumerReady = Boolean(
    health
    && health.readiness?.ready !== false
    && (!health.consumer || (health.consumer.connected && health.consumer.channelReady)),
  );
  checks.push({
    label: "Servicio preparado para ejecutar",
    status: consumerReady ? "ready" : "review",
    detail: consumerReady
      ? "El servicio informa que puede recibir y procesar eventos."
      : data.health.ok
        ? "El servicio aún no confirma que pueda procesar eventos. Revisa el estado operativo."
        : "No se pudo comprobar el estado operativo ahora mismo.",
  });

  const emailTemplateKeys = rule.actions
    .filter((action) => action.type === "SEND_EMAIL")
    .map(configuredTemplateKey);
  if (!emailTemplateKeys.length) {
    checks.push({
      label: "Plantillas de email",
      status: "ready",
      detail: "Esta regla no envía emails.",
    });
  } else if (emailTemplateKeys.some((templateKey) => !templateKey)) {
    checks.push({
      label: "Plantillas de email",
      status: "review",
      detail: "Hay una acción de email sin plantilla configurada.",
    });
  } else if (!data.emailTemplates.ok) {
    checks.push({
      label: "Plantillas de email",
      status: "review",
      detail: "No se pudo comprobar si las plantillas están activas.",
    });
  } else {
    const activeTemplates = data.emailTemplates.data.items;
    const missingTemplates = emailTemplateKeys.filter((templateKey) => !activeTemplates.some((template) => (
      template.templateKey === templateKey && template.locale === data.context.locale && template.status === "ACTIVE"
    )));
    checks.push({
      label: "Plantillas de email",
      status: missingTemplates.length ? "review" : "ready",
      detail: missingTemplates.length
        ? `Activa en Comunicaciones: ${missingTemplates.join(", ")}.`
        : "Las plantillas de email necesarias están activas.",
    });
  }

  return { checks, ready: checks.every((check) => check.status === "ready") };
}

function statusBadgeClass(status: string | undefined) {
  if (status === "ACTIVE" || status === "SUCCEEDED" || status === "ok" || status === "connected") {
    return "adminBadge adminBadgeOk";
  }
  if (status === "PAUSED" || status === "DRAFT" || status === "RETRYING" || status === "PENDING" || status === "RUNNING") {
    return "adminBadge adminBadgeWarn";
  }
  if (status === "FAILED" || status === "DLQ" || status === "alert" || status === "degraded" || status === "stopped") {
    return "adminBadge adminBadgeError";
  }

  return "adminBadge";
}

function automationHref(filters: AutomationAdminFilters, patch: Partial<AutomationAdminFilters>) {
  const next = { ...filters, ...patch };
  const params = new URLSearchParams();

  if (next.eventType) {
    params.set("eventType", next.eventType);
  }
  if (next.ruleStatus) {
    params.set("ruleStatus", next.ruleStatus);
  }
  if (next.executionStatus) {
    params.set("executionStatus", next.executionStatus);
  }
  if (next.drawer) {
    params.set("drawer", next.drawer);
  }
  if (next.ruleId) {
    params.set("ruleId", next.ruleId);
  }
  if (next.executionId) {
    params.set("executionId", next.executionId);
  }
  if (next.notice) {
    params.set("notice", next.notice);
  }
  if (next.rulesLimit) {
    params.set("rulesLimit", next.rulesLimit);
  }
  if (next.rulesOffset) {
    params.set("rulesOffset", next.rulesOffset);
  }
  if (next.starter) {
    params.set("starter", next.starter);
  }
  if (next.executionsLimit) {
    params.set("executionsLimit", next.executionsLimit);
  }
  if (next.executionsOffset) {
    params.set("executionsOffset", next.executionsOffset);
  }

  const query = params.toString();
  return query ? `/admin/configuracion/automatizacion?${query}` : "/admin/configuracion/automatizacion";
}

function positiveNumber(value: string | number | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeNumber(value: string | number | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function ResultBanner({ error }: { error?: string }) {
  if (!error) {
    return null;
  }

  return <div className="adminBanner adminBannerError">{error}</div>;
}

function JsonPreview({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="adminSection">
      <h3>{title}</h3>
      <pre className="adminCodePreview">{JSON.stringify(value ?? {}, null, 2)}</pre>
    </div>
  );
}

function AutomationPagination({
  count,
  filters,
  kind,
  label,
  limit,
  offset,
  total,
}: {
  count: number;
  filters: AutomationAdminFilters;
  kind: "rules" | "executions";
  label: string;
  limit: number;
  offset: number;
  total: number;
}) {
  const currentLimit = positiveNumber(limit, count || 20);
  const currentOffset = nonNegativeNumber(offset);
  const firstItem = total > 0 ? currentOffset + 1 : 0;
  const lastItem = Math.min(currentOffset + count, total);
  const previousOffset = Math.max(0, currentOffset - currentLimit);
  const nextOffset = currentOffset + currentLimit;
  const hasPrevious = currentOffset > 0;
  const hasNext = nextOffset < total;
  const offsetKey = kind === "rules" ? "rulesOffset" : "executionsOffset";
  const limitKey = kind === "rules" ? "rulesLimit" : "executionsLimit";

  function pageHref(nextLimit: string | number, nextOffsetValue: string | number) {
    return automationHref(filters, {
      drawer: undefined,
      executionId: undefined,
      notice: undefined,
      ruleId: undefined,
      [limitKey]: String(nextLimit),
      [offsetKey]: String(nextOffsetValue),
    });
  }

  return (
    <nav className="productListPagination" aria-label={`Paginacion de ${label}`}>
      <p>
        Mostrando {firstItem}-{lastItem} de {total} {label}
      </p>
      <div className="productListPaginationControls">
        <Link
          aria-disabled={!hasPrevious}
          className={`adminButton adminButtonTiny${hasPrevious ? "" : " adminButtonDisabled"}`}
          href={hasPrevious ? pageHref(currentLimit, previousOffset) : pageHref(currentLimit, currentOffset)}
        >
          Anterior
        </Link>
        <Link
          aria-disabled={!hasNext}
          className={`adminButton adminButtonTiny${hasNext ? "" : " adminButtonDisabled"}`}
          href={hasNext ? pageHref(currentLimit, nextOffset) : pageHref(currentLimit, currentOffset)}
        >
          Siguiente
        </Link>
      </div>
      <div className="productListPaginationControls" aria-label={`Tamano de pagina ${label}`}>
        {pageSizeOptions.map((pageSize) => (
          <Link
            className={`adminButton adminButtonTiny${String(currentLimit) === pageSize ? " adminButtonDisabled" : ""}`}
            href={pageHref(pageSize, 0)}
            key={pageSize}
          >
            {pageSize} por pagina
          </Link>
        ))}
      </div>
    </nav>
  );
}

function jsonFormValue(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function ruleActionsFormValue(rule: AutomationRule | undefined) {
  const actions = rule?.actions.length
    ? rule.actions.map((action) => ({
        actionId: action.actionId,
        type: action.type,
        name: action.name,
        config: action.config,
        position: action.position,
      }))
    : defaultRuleActions;

  return jsonFormValue(actions);
}

function RuleEditorExamples() {
  return (
    <details className="adminSection">
      <summary className="adminButton adminButtonTiny">
        Ver ejemplos JSON seguros
      </summary>
      <p className="adminMuted">
        Copia solo el bloque de acciones que necesites. La plantilla debe existir y estar activa en Comunicaciones.
      </p>
      <JsonPreview title="Accion SEND_EMAIL tracking enviado" value={sendEmailExampleActions} />
      <JsonPreview title="Accion SEND_EMAIL factura disponible" value={invoiceEmailExampleActions} />
      <JsonPreview title="Accion BUSINESS_LOG diagnostico" value={defaultRuleActions} />
    </details>
  );
}

function AutomationScope({ data }: Pick<Props, "data">) {
  const { context } = data;
  const shopLabel = context.shopName || context.shopAlias || "Sin tienda seleccionada";
  const shopAlias = context.shopAlias && context.shopAlias !== context.shopName
    ? ` (${context.shopAlias})`
    : "";

  return (
    <section className="adminCard" aria-label="Alcance de automatizaciones">
      <div className="adminCardHeader">
        <div>
          <h2>Automatizaciones de esta tienda</h2>
          <p>Las reglas, los avisos preparados y el historial de esta pantalla solo aplican a la tienda activa.</p>
        </div>
        <span className="adminBadge adminBadgeOk">Contexto activo</span>
      </div>
      <dl className="adminDefinitionList">
        <div><dt>Tienda</dt><dd>{shopLabel}{shopAlias}</dd></div>
        <div><dt>Canal</dt><dd>{context.channel || "web"}</dd></div>
        <div><dt>Idioma y mercado</dt><dd>{context.locale} · {context.country} · {context.currency}</dd></div>
      </dl>
      {context.organizationId ? (
        <details className="adminSection">
          <summary className="adminButton adminButtonTiny">Ver referencia de organizacion</summary>
          <p className="adminMuted">La organizacion seleccionada se identifica internamente como {context.organizationId}.</p>
        </details>
      ) : null}
    </section>
  );
}

function businessEventsByArea() {
  return automationBusinessEvents.reduce<Record<AutomationBusinessEvent["area"], AutomationBusinessEvent[]>>(
    (areas, event) => {
      areas[event.area].push(event);
      return areas;
    },
    { Pedidos: [], Pagos: [], Envios: [], Facturacion: [], Postventa: [] },
  );
}

function AutomationBusinessCatalog() {
  const eventsByArea = businessEventsByArea();

  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h2>Que puedes automatizar</h2>
          <p>Automation reacciona a situaciones de negocio. Las acciones disponibles siguen siendo email, registro, integracion o aviso a otro proceso.</p>
        </div>
      </div>
      <div className="adminGrid">
        {Object.entries(eventsByArea).map(([area, events]) => (
          <article className="adminSection" key={area}>
            <h3>{area}</h3>
            <ul className="adminMuted">
              {events.map((event) => <li key={event.eventType}>{event.label}</li>)}
            </ul>
          </article>
        ))}
      </div>
      <details className="adminSection">
        <summary className="adminButton adminButtonTiny">Ver nombres tecnicos de los eventos</summary>
        <div className="adminTableScroller">
          <table className="adminTable adminTableCompact">
            <thead><tr><th>Situacion</th><th>Evento tecnico</th></tr></thead>
            <tbody>
              {automationBusinessEvents.map((event) => (
                <tr key={event.eventType}><td>{event.label}</td><td>{event.eventType}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

type GuidedAutomationScenario = {
  action: string;
  condition: string;
  event: string;
  label: string;
  starter: AutomationGuidedStarter;
  title: string;
};

const guidedAutomationScenarios: GuidedAutomationScenario[] = [
  {
    starter: "delivery-email",
    title: "Avisar cuando se entrega un pedido",
    label: "Aviso de entrega al cliente",
    event: "Envio entregado",
    condition: "Se ejecuta siempre que se confirme una entrega.",
    action: "Enviar al cliente el aviso de pedido entregado.",
  },
  {
    starter: "invoice-email",
    title: "Avisar cuando la factura esta disponible",
    label: "Aviso de factura al cliente",
    event: "Factura disponible",
    condition: "Se ejecuta siempre que se emita una factura.",
    action: "Enviar al cliente el aviso de factura disponible.",
  },
  {
    starter: "post-sales-notice",
    title: "Avisar al equipo de una solicitud postventa",
    label: "Aviso de nueva solicitud postventa",
    event: "Solicitud postventa recibida",
    condition: "Se ejecuta siempre que un cliente abra una solicitud.",
    action: "Notificar al equipo para que revise el caso.",
  },
];

function guidedScenario(starter: AutomationGuidedStarter | undefined) {
  return guidedAutomationScenarios.find((scenario) => scenario.starter === starter) ?? guidedAutomationScenarios[0];
}

function AutomationGuidedStart({ filters }: Pick<Props, "filters">) {
  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h2>Diseña una automatización</h2>
          <p>Recorre un caso habitual antes de crear una regla. Esta vista no cambia nada.</p>
        </div>
        <Link className="adminButton adminButtonTiny" href={automationHref(filters, { drawer: "rule-create", starter: undefined })}>
          Crear en modo avanzado
        </Link>
      </div>
      <div className="adminGrid">
        {guidedAutomationScenarios.map((scenario) => (
          <article className="adminSection" key={scenario.starter}>
            <h3>{scenario.title}</h3>
            <p className="adminMuted">{scenario.action}</p>
            <Link
              className="adminButton adminButtonPrimary adminButtonTiny"
              href={automationHref(filters, { drawer: "rule-guided", starter: scenario.starter, notice: undefined, ruleId: undefined })}
            >
              Ver recorrido
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

function AutomationAdvancedCompatibility({ data, filters }: Props) {
  const rules = data.rules.ok ? data.rules.data.items : [];
  const visualCopies = rules.filter((rule) => Boolean(visualMigrationPlan(rule).migration)).length;
  const advancedRules = rules.length - visualCopies;

  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h2>Reglas avanzadas y existentes</h2>
          <p>La nueva experiencia no reemplaza ni cambia las reglas que ya están en funcionamiento.</p>
        </div>
        <Link className="adminButton adminButtonTiny" href={automationHref(filters, { drawer: "rule-create", notice: undefined, ruleId: undefined })}>
          Crear en modo avanzado
        </Link>
      </div>
      <div className="adminGrid">
        <article className="adminSection">
          <h3>Compatibles con el asistente</h3>
          <p><strong>{visualCopies}</strong> reglas de esta página pueden convertirse en una copia visual para revisar.</p>
        </article>
        <article className="adminSection">
          <h3>Configuración avanzada</h3>
          <p><strong>{advancedRules}</strong> reglas conservan sus filtros, integraciones o acciones personalizadas sin ninguna modificación.</p>
        </article>
      </div>
      <p className="adminMuted">La migración siempre crea un borrador independiente. La regla original sigue activa, pausada o archivada exactamente como estaba.</p>
    </section>
  );
}

function AutomationGuidedPreview({ data, filters }: Props) {
  const scenario = guidedScenario(filters.starter);
  const shopLabel = data.context.shopName || data.context.shopAlias || "la tienda activa";
  const closeHref = automationHref(filters, { drawer: undefined, starter: undefined, notice: undefined });

  return (
    <div className="adminDrawerBackdrop">
      <aside className="adminSideDrawer" aria-label="Disenar automatizacion" aria-modal="true" role="dialog">
        <div className="adminSideDrawerHeader">
          <div>
            <h2>Diseñar automatización</h2>
            <p>{scenario.label}</p>
          </div>
          <Link className="adminButton adminButtonTiny" href={closeHref}>Cerrar</Link>
        </div>

        <div className="adminBanner">
          Este es un recorrido de revisión. No crea, modifica ni activa una regla.
        </div>

        <ol className="adminDefinitionList">
          <li><strong>1. Cuando ocurre</strong><br />{scenario.event}</li>
          <li><strong>2. Si se cumple</strong><br />{scenario.condition}</li>
          <li><strong>3. Qué queremos hacer</strong><br />{scenario.action}</li>
          <li><strong>4. Dónde aplica</strong><br />Solo en {shopLabel}, con {data.context.locale} y mercado {data.context.country}.</li>
        </ol>

        <section className="adminSection">
          <h3>Resultado esperado</h3>
          <p>Cuando ocurra “{scenario.event}”, Automation realizará: “{scenario.action}”.</p>
          <p className="adminMuted">Antes de activar una regla real, las siguientes fases comprobarán la plantilla, el destinatario y el estado operativo.</p>
        </section>

        <div className="adminButtonRow">
          <Link className="adminButton" href={closeHref}>Volver a automatizaciones</Link>
          <Link className="adminButton adminButtonTiny" href={automationHref(filters, { drawer: "rule-create", starter: undefined, notice: undefined })}>
            Abrir modo avanzado
          </Link>
        </div>
      </aside>
    </div>
  );
}

function AutomationEventText({ eventType }: { eventType: string }) {
  const label = automationEventLabel(eventType);
  const isKnownEvent = label !== eventType;

  return (
    <>
      <strong>{label}</strong>
      {isKnownEvent ? <div className="adminMuted">{eventType}</div> : null}
    </>
  );
}

function AutomationFilters({ filters }: { filters: AutomationAdminFilters }) {
  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h2>Filtros</h2>
          <p>Consulta reglas y ejecuciones por evento o estado sin modificar Automation.</p>
        </div>
        <Link className="adminButton adminButtonTiny" href="/admin/configuracion/automatizacion">
          Limpiar
        </Link>
      </div>
      <form className="pricingDenseForm" method="get">
        <input name="rulesLimit" type="hidden" value={filters.rulesLimit ?? ""} />
        <input name="executionsLimit" type="hidden" value={filters.executionsLimit ?? ""} />
        <div className="adminFormGrid">
          <label className="adminField">
            <span>Evento</span>
            <input name="eventType" placeholder="shipping.fulfillment.shipped.v1" defaultValue={filters.eventType ?? ""} />
          </label>
          <label className="adminField">
            <span>Estado regla</span>
            <select name="ruleStatus" defaultValue={filters.ruleStatus ?? ""}>
              <option value="">Todos</option>
              {ruleStatuses.map((status) => (
                <option value={status} key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label className="adminField">
            <span>Estado ejecucion</span>
            <select name="executionStatus" defaultValue={filters.executionStatus ?? ""}>
              <option value="">Todos</option>
              {executionStatuses.map((status) => (
                <option value={status} key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label className="adminField">
            <span>Rule ID</span>
            <input name="ruleId" placeholder="ruleId" defaultValue={filters.ruleId ?? ""} />
          </label>
        </div>
        <button className="adminButton adminButtonPrimary" type="submit">
          Aplicar filtros
        </button>
      </form>
    </section>
  );
}

function AutomationDefaultsPanel({ data }: Pick<Props, "data">) {
  const shopLabel = data.context.shopName || data.context.shopAlias || "la tienda activa";

  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h2>Activación avanzada de avisos existentes</h2>
          <p>Operación masiva para reglas ya conocidas en {shopLabel}. Para una configuración segura, usa primero los borradores recomendados.</p>
        </div>
        <Link className="adminButton adminButtonTiny" href="/admin/configuracion/comunicaciones">
          Ver comunicaciones
        </Link>
      </div>

      <p className="adminMuted">
        Automation decide cuando enviar. Las plantillas, el proveedor y las pruebas de entrega se gestionan en Comunicaciones.
        Si las reglas ya existen, esta operacion las conserva o las actualiza segun indiques.
      </p>

      <div className="adminGrid">
        <form action={bootstrapAutomationTrackingEmailDefaultsAction} className="pricingDenseForm">
          <div>
            <h3>Avisos de pedido y entrega</h3>
            <p className="adminMuted">
              Crea reglas para pedido confirmado, preparacion, despacho, enviado y entregado.
            </p>
          </div>
          <label className="adminField">
            <span>Locale</span>
            <input name="locale" defaultValue={data.context.locale} />
          </label>
          <label className="adminCheckbox">
            <input name="overwrite" type="checkbox" />
            Actualizar avisos preparados existentes
          </label>
          <button className="adminButton adminButtonPrimary" type="submit">
            Activar avisos de pedido y entrega
          </button>
        </form>

        <form action={bootstrapAutomationInvoiceEmailDefaultsAction} className="pricingDenseForm">
          <div>
            <h3>Aviso de factura disponible</h3>
            <p className="adminMuted">
              Crea la regla que avisa al cliente cuando una factura queda emitida y disponible.
            </p>
          </div>
          <label className="adminField">
            <span>Locale</span>
            <input name="locale" defaultValue={data.context.locale} />
          </label>
          <label className="adminCheckbox">
            <input name="overwrite" type="checkbox" />
            Actualizar aviso preparado existente
          </label>
          <button className="adminButton" type="submit">
            Activar aviso de factura
          </button>
        </form>
      </div>
    </section>
  );
}

function RecommendedAutomationsPanel({ data }: Pick<Props, "data">) {
  const shopLabel = data.context.shopName || data.context.shopAlias || "la tienda activa";
  const activeTemplates = data.emailTemplates.ok
    ? new Set(data.emailTemplates.data.items
      .filter((template) => template.status === "ACTIVE" && template.locale === data.context.locale)
      .map((template) => template.templateKey))
    : new Set<string>();

  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h2>Automatizaciones recomendadas</h2>
          <p>Crea un borrador para {shopLabel}, revísalo y actívalo solo cuando esté listo.</p>
        </div>
        <Link className="adminButton adminButtonTiny" href="/admin/configuracion/comunicaciones">
          Revisar plantillas
        </Link>
      </div>

      <div className="adminGrid">
        {recommendedAutomationDrafts.map((draft) => {
          const templateReady = activeTemplates.has(draft.templateKey);
          const templateState = data.emailTemplates.ok
            ? templateReady
              ? "Plantilla preparada"
              : "Plantilla pendiente de activar"
            : "No se pudo comprobar la plantilla";

          return (
            <article className="adminSection" key={draft.id}>
              <h3>{draft.name}</h3>
              <p>{draft.description}</p>
              <dl className="adminDefinitionList">
                <div><dt>Plantilla</dt><dd>{draft.templateLabel}</dd></div>
                <div><dt>Estado</dt><dd><span className={statusBadgeClass(templateReady ? "ACTIVE" : "DRAFT")}>{templateState}</span></dd></div>
                <div><dt>Al crear</dt><dd>Se guardará como borrador en {shopLabel}.</dd></div>
              </dl>
              <details className="adminSection">
                <summary className="adminButton adminButtonTiny">Revisar lo que se creará</summary>
                <p className="adminMuted">Cuando ocurra “{automationEventLabel(draft.payload.trigger.eventType)}”, se solicitará “{draft.templateLabel}”. La regla quedará en borrador.</p>
              </details>
              <form action={createRecommendedAutomationDraftAction}>
                <input name="recommendedAutomation" type="hidden" value={draft.id} />
                <button className="adminButton adminButtonPrimary" disabled={!templateReady} type="submit">
                  Crear borrador para revisar
                </button>
              </form>
            </article>
          );
        })}
      </div>
      {!data.emailTemplates.ok ? <ResultBanner error={data.emailTemplates.error} /> : null}
    </section>
  );
}

function AutomationOperationalGuide({ data, filters }: Props) {
  const health = data.health.ok ? data.health.data : null;
  const consumerReady = Boolean(health?.consumer?.connected && health.consumer.channelReady);
  const readinessReady = Boolean(health?.readiness?.ready);
  const missingEvents = health?.readiness?.missingRequiredEventTypes ?? [];
  const activeRules = data.rules.ok ? data.rules.data.items.filter((rule) => rule.status === "ACTIVE").length : 0;

  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h2>Operacion segura</h2>
          <p>Checklist para activar reglas sin Postman y con menor riesgo de emails perdidos.</p>
        </div>
        <span className={statusBadgeClass(consumerReady && readinessReady ? "ok" : "degraded")}>
          {consumerReady && readinessReady ? "listo" : "revisar"}
        </span>
      </div>

      <div className="adminGrid">
        <article className="adminCard">
          <h3>Antes de activar</h3>
          <ol className="adminMuted">
            <li>Confirma que el consumer aparece conectado y la cola esta ready.</li>
            <li>Valida en Comunicaciones que la plantilla existe, esta activa y el proveedor esta configurado.</li>
            <li>Crea o edita la regla en DRAFT/PAUSED, revisa acciones y activa solo al final.</li>
            <li>Después del primer evento, revisa ejecuciones y deliveries para confirmar el envio real.</li>
          </ol>
        </article>

        <article className="adminCard">
          <h3>Estado actual</h3>
          <dl className="adminDefinitionList">
            <div><dt>Consumer</dt><dd>{consumerReady ? "Conectado" : "No confirmado"}</dd></div>
            <div><dt>Readiness</dt><dd>{readinessReady ? "Ready" : "Pendiente"}</dd></div>
            <div><dt>Reglas activas en pagina</dt><dd>{activeRules}</dd></div>
            <div><dt>Eventos faltantes</dt><dd>{missingEvents.length ? missingEvents.join(", ") : "Sin faltantes"}</dd></div>
          </dl>
        </article>
      </div>

      <div className="adminButtonRow adminSection">
        <Link className="adminButton adminButtonTiny" href="/admin/configuracion/comunicaciones">
          Revisar Comunicaciones
        </Link>
        <Link
          className="adminButton adminButtonTiny"
          href={automationHref(filters, { executionStatus: "FAILED", executionsOffset: "0", drawer: undefined, executionId: undefined, notice: undefined, ruleId: undefined })}
        >
          Ver ejecuciones fallidas
        </Link>
      </div>
    </section>
  );
}

function AutomationKpis({ data }: Props) {
  const health = data.health.ok ? data.health.data : null;
  const rules = data.rules.ok ? data.rules.data.items : [];
  const executions = data.executions.ok ? data.executions.data.items : [];
  const activeRules = rules.filter((rule) => rule.status === "ACTIVE").length;
  const failedExecutions = executions.filter((execution) => execution.status === "FAILED" || execution.status === "DLQ").length;
  const readiness = health?.readiness;

  return (
    <section className="adminKpiGrid" aria-label="Resumen automatizacion">
      <article className="adminKpi">
        <span>Servicio</span>
        <strong>{health ? valueText(health.status) : "Sin conexion"}</strong>
        <div className="adminMuted">{health?.service ?? data.health.correlationId}</div>
      </article>
      <article className="adminKpi">
        <span>Consumer</span>
        <strong>{health?.consumer?.status ?? (health?.consumerEnabled ? "enabled" : "disabled")}</strong>
        <div className="adminMuted">{health?.consumer?.connected ? "Conectado" : "Sin conexion confirmada"}</div>
      </article>
      <article className="adminKpi">
        <span>Readiness</span>
        <strong>{readiness ? (readiness.ready ? "Ready" : "No ready") : "-"}</strong>
        <div className="adminMuted">
          {readiness?.missingRequiredEventTypes.length
            ? `${readiness.missingRequiredEventTypes.length} eventos faltantes`
            : "Sin faltantes reportados"}
        </div>
      </article>
      <article className="adminKpi">
        <span>Reglas activas</span>
        <strong>{data.rules.ok ? `${activeRules}/${data.rules.data.total}` : "-"}</strong>
        <div className="adminMuted">Listado tenant actual</div>
      </article>
      <article className="adminKpi">
        <span>Ejecuciones con alerta</span>
        <strong>{data.executions.ok ? failedExecutions : "-"}</strong>
        <div className="adminMuted">FAILED o DLQ en el filtro</div>
      </article>
    </section>
  );
}

function HealthPanel({ data }: Pick<Props, "data">) {
  const health = data.health.ok ? data.health.data : null;
  const consumer = health?.consumer;

  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h2>Estado operativo</h2>
          <p>Lectura del health BFF de Automation. No ejecuta cambios.</p>
        </div>
        <span className={statusBadgeClass(health?.observability?.severity ?? health?.status)}>
          {health?.observability?.severity ?? health?.status ?? "unavailable"}
        </span>
      </div>
      <ResultBanner error={data.health.ok ? undefined : data.health.error} />
      <table className="adminTable adminTableCompact">
        <tbody>
          <tr><th>Persistence</th><td>{valueText(health?.persistenceDriver)}</td></tr>
          <tr><th>DB configurada</th><td>{valueText(health?.databaseConfigured)}</td></tr>
          <tr><th>Consumer requerido</th><td>{valueText(health?.readiness?.consumerRequired)}</td></tr>
          <tr><th>Queue</th><td>{valueText(consumer?.queueName)}</td></tr>
          <tr><th>Retry/DLQ</th><td>{consumer ? `${consumer.retryQueueName} / ${consumer.dlqQueueName}` : "-"}</td></tr>
          <tr><th>Contadores</th><td>{consumer ? `processed ${consumer.counters.processed}, failed ${consumer.counters.failed}, dlq ${consumer.counters.dlq}` : "-"}</td></tr>
          <tr><th>Ultimo error</th><td>{truncateText(consumer?.lastErrorMessage)}</td></tr>
        </tbody>
      </table>
      {health?.observability?.alerts.length ? (
        <div className="adminBanner adminBannerError">
          {health.observability.alerts.join(" · ")}
        </div>
      ) : null}
    </section>
  );
}

function RulesTable({ data, filters }: Props) {
  if (!data.rules.ok) {
    return <ResultBanner error={data.rules.error} />;
  }

  const rules = data.rules.data.items;

  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h2>Reglas</h2>
          <p>{data.rules.data.total} reglas encontradas.</p>
        </div>
        <div className="adminButtonRow">
          <Link className="adminButton adminButtonPrimary adminButtonTiny" href={automationHref(filters, { drawer: "rule-visual-create", ruleId: undefined, notice: undefined })}>
            Crear regla
          </Link>
          <Link className="adminButton adminButtonTiny" href={automationHref(filters, { ruleStatus: "ACTIVE" })}>
            Ver activas
          </Link>
        </div>
      </div>
      {rules.length ? (
        <div className="adminTableScroller">
          <table className="adminTable">
            <thead>
              <tr>
                <th>Regla</th>
                <th>Estado</th>
                <th>Evento</th>
                <th>Acciones</th>
                <th>Edición</th>
                <th>Actualizada</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.ruleId}>
                  {(() => {
                    const compatibility = visualMigrationPlan(rule);
                    return <>
                  <td>
                    <strong>{rule.name}</strong>
                    <div className="adminMuted">{rule.ruleId}</div>
                  </td>
                  <td><span className={statusBadgeClass(rule.status)}>{rule.status}</span></td>
                  <td><AutomationEventText eventType={rule.trigger.eventType} /></td>
                  <td>{rule.actions.map((action) => action.type).join(", ") || "-"}</td>
                  <td>
                    <span className={statusBadgeClass(compatibility.migration ? "ACTIVE" : "DRAFT")}>
                      {compatibility.migration ? "Visual compatible" : "Avanzada"}
                    </span>
                  </td>
                  <td>{dateText(rule.updatedAt)}</td>
                  <td>
                    <div className="adminButtonRow">
                      <Link className="adminButton adminButtonTiny" href={automationHref(filters, { drawer: "rule", ruleId: rule.ruleId, notice: undefined })}>
                        Ver detalle
                      </Link>
                      <Link className="adminButton adminButtonTiny" href={automationHref(filters, { drawer: "rule-edit", ruleId: rule.ruleId, notice: undefined })}>
                        Editar
                      </Link>
                    </div>
                  </td>
                    </>;
                  })()}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="adminEmptyState">No hay reglas para el filtro actual.</div>
      )}
      <AutomationPagination
        count={rules.length}
        filters={filters}
        kind="rules"
        label="reglas"
        limit={data.rules.data.limit}
        offset={data.rules.data.offset}
        total={data.rules.data.total}
      />
    </section>
  );
}

function ExecutionsTable({ data, filters }: Props) {
  if (!data.executions.ok) {
    return <ResultBanner error={data.executions.error} />;
  }

  const executions = data.executions.data.items;

  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h2>Ejecuciones recientes</h2>
          <p>{data.executions.data.total} ejecuciones encontradas.</p>
        </div>
        <Link className="adminButton adminButtonTiny" href={automationHref(filters, { executionStatus: "FAILED" })}>
          Ver fallidas
        </Link>
      </div>
      {executions.length ? (
        <div className="adminTableScroller">
          <table className="adminTable">
            <thead>
              <tr>
                <th>Ejecucion</th>
                <th>Estado</th>
                <th>Evento</th>
                <th>Regla</th>
                <th>Error</th>
                <th>Inicio</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((execution) => (
                <tr key={execution.executionId}>
                  <td>
                    <strong>{execution.executionId}</strong>
                    <div className="adminMuted">{execution.eventId}</div>
                  </td>
                  <td><span className={statusBadgeClass(execution.status)}>{execution.status}</span></td>
                  <td><AutomationEventText eventType={execution.eventType} /></td>
                  <td>{execution.ruleId}</td>
                  <td>{truncateText(execution.errorMessage, 72)}</td>
                  <td>{dateText(execution.startedAt)}</td>
                  <td>
                    <Link
                      className="adminButton adminButtonTiny"
                      href={automationHref(filters, { drawer: "execution", executionId: execution.executionId, notice: undefined })}
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="adminEmptyState">No hay ejecuciones para el filtro actual.</div>
      )}
      <AutomationPagination
        count={executions.length}
        filters={filters}
        kind="executions"
        label="ejecuciones"
        limit={data.executions.data.limit}
        offset={data.executions.data.offset}
        total={data.executions.data.total}
      />
    </section>
  );
}

function RuleTransitionForm({
  buttonClassName = "adminButton adminButtonTiny",
  label,
  ruleId,
  transition,
}: {
  buttonClassName?: string;
  label: string;
  ruleId: string;
  transition: "activate" | "pause" | "archive";
}) {
  return (
    <form action={transitionAutomationRuleAction}>
      <input name="ruleId" type="hidden" value={ruleId} />
      <input name="transition" type="hidden" value={transition} />
      <button className={buttonClassName} type="submit">
        {label}
      </button>
    </form>
  );
}

function RuleActivationAction({
  readiness,
  rule,
}: {
  readiness: RuleActivationReadiness;
  rule: AutomationRule;
}) {
  if (rule.status === "ACTIVE" || rule.status === "ARCHIVED") {
    return null;
  }

  return (
    <details className="productDangerMenu">
      <summary className="adminButton adminButtonTiny">
        {readiness.ready ? "Activar regla" : "Revisar antes de activar"}
      </summary>
      <div className="productDangerPanel">
        <p>
          {readiness.ready
            ? "Las comprobaciones visibles están listas. La activación sigue siendo una decisión manual."
            : "Hay comprobaciones pendientes. Puedes resolverlas primero o activar bajo tu responsabilidad."}
        </p>
        <ul className="adminMuted">
          {readiness.checks.map((check) => (
            <li key={check.label}>{check.status === "ready" ? "Listo" : "Revisar"}: {check.label} — {check.detail}</li>
          ))}
        </ul>
        <RuleTransitionForm
          buttonClassName="adminButton adminButtonPrimary adminButtonTiny"
          label={readiness.ready ? "Confirmar activación" : "Activar tras revisar"}
          ruleId={rule.ruleId}
          transition="activate"
        />
      </div>
    </details>
  );
}

function RuleLifecycleActions({ readiness, rule }: { readiness: RuleActivationReadiness; rule: AutomationRule }) {
  if (rule.status === "ARCHIVED") {
    return (
      <section className="adminSection">
        <h3>Operacion</h3>
        <div className="adminEmptyState">La regla esta archivada y no admite nuevas transiciones operativas.</div>
      </section>
    );
  }

  return (
    <section className="adminSection">
      <h3>Operacion</h3>
      <p className="adminMuted">
        Cambios controlados via BFF. Pausar detiene nuevas ejecuciones; archivar retira la regla de operacion.
      </p>
      <div className="adminButtonRow">
        <RuleActivationAction readiness={readiness} rule={rule} />
        {rule.status === "ACTIVE" ? (
          <RuleTransitionForm label="Pausar regla" ruleId={rule.ruleId} transition="pause" />
        ) : null}
        <details className="productDangerMenu">
          <summary className="adminButton adminButtonDanger adminButtonTiny">
            Archivar regla
          </summary>
          <div className="productDangerPanel">
            <p>Archivar evita nuevas ejecuciones y deja la regla fuera de operacion.</p>
            <RuleTransitionForm
              buttonClassName="adminButton adminButtonDanger adminButtonTiny"
              label="Confirmar archivo"
              ruleId={rule.ruleId}
              transition="archive"
            />
          </div>
        </details>
      </div>
    </section>
  );
}

function RuleEditorForm({
  filters,
  mode,
  rule,
}: {
  filters: AutomationAdminFilters;
  mode: "create" | "edit";
  rule?: AutomationRule;
}) {
  const isEdit = mode === "edit";
  const cancelHref = isEdit && rule
    ? automationHref(filters, { drawer: "rule", ruleId: rule.ruleId, notice: undefined })
    : automationHref(filters, { drawer: undefined, notice: undefined });

  return (
    <form action={saveAutomationRuleAction} className="pricingDenseForm">
      <input name="mode" type="hidden" value={mode} />
      {rule ? <input name="ruleId" type="hidden" value={rule.ruleId} /> : null}

      <div className="adminBanner">
        Las reglas nuevas quedan listas para revisar. Activalas desde el detalle cuando la definicion este correcta.
      </div>

      <div className="adminFormGrid">
        <label className="adminField">
          <span>Nombre</span>
          <input name="name" required defaultValue={rule?.name ?? ""} placeholder="Email tracking enviado" />
        </label>
        <label className="adminField">
          <span>Evento disparador</span>
          <input
            name="eventType"
            required
            defaultValue={rule?.trigger.eventType ?? filters.eventType ?? ""}
            placeholder="shipping.fulfillment.shipped.v1"
          />
        </label>
      </div>

      <label className="adminField">
        <span>Descripcion</span>
        <input name="description" defaultValue={rule?.description ?? ""} placeholder="Uso operativo de esta regla" />
      </label>

      <label className="adminField">
        <span>Filtros del trigger JSON</span>
        <textarea
          name="triggerFiltersJson"
          rows={6}
          defaultValue={jsonFormValue(rule?.trigger.filters ?? {})}
          placeholder='{"country":"ES"}'
        />
      </label>

      <label className="adminField">
        <span>Condiciones JSON</span>
        <textarea
          name="conditionsJson"
          rows={8}
          defaultValue={jsonFormValue(rule?.conditions ?? [])}
          placeholder='[{"field":"payload.customerId","operator":"exists"}]'
        />
      </label>

      <label className="adminField">
        <span>Acciones JSON</span>
        <textarea
          name="actionsJson"
          rows={14}
          defaultValue={ruleActionsFormValue(rule)}
          placeholder='[{"type":"BUSINESS_LOG","name":"Registrar evento","config":{"eventName":"automation.custom"},"position":0}]'
        />
      </label>

      <p className="adminMuted">
        Tipos permitidos: BUSINESS_LOG, HTTP_REQUEST, EMIT_EVENT y SEND_EMAIL. Operadores permitidos:
        equals, not_equals, exists e in.
      </p>

      <RuleEditorExamples />

      <div className="adminButtonRow">
        <button className="adminButton adminButtonPrimary" type="submit">
          {isEdit ? "Guardar cambios" : "Crear regla"}
        </button>
        <Link className="adminButton" href={cancelHref}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}

function AutomationRuleConfidencePanel({
  data,
  rule,
}: {
  data: AutomationAdminData;
  rule: AutomationRule;
}) {
  const readiness = ruleActivationReadiness(data, rule);

  return (
    <section className="adminSection">
      <h3>Antes de activar</h3>
      <p>{ruleOutcomeText(rule)}</p>
      <p className="adminMuted">Estas comprobaciones no activan ni cambian la regla.</p>
      <dl className="adminDefinitionList">
        {readiness.checks.map((check) => (
          <div key={check.label}>
            <dt>{check.label}</dt>
            <dd><span className={statusBadgeClass(check.status === "ready" ? "ACTIVE" : "DRAFT")}>{check.status === "ready" ? "Listo" : "Revisar"}</span> {check.detail}</dd>
          </div>
        ))}
      </dl>
      {!readiness.ready ? (
        <Link className="adminButton adminButtonTiny" href="/admin/configuracion/comunicaciones">Revisar Comunicaciones</Link>
      ) : null}
    </section>
  );
}

function AutomationRuleMigrationPanel({ filters, rule }: { filters: AutomationAdminFilters; rule: AutomationRule }) {
  const compatibility = visualMigrationPlan(rule);

  return (
    <section className="adminSection">
      <h3>Compatibilidad con el asistente visual</h3>
      {compatibility.migration ? (
        <>
          <p>Esta regla puede pasar por el asistente visual sin perder su definición. Se creará una copia en borrador; la original no cambia.</p>
          <Link
            className="adminButton adminButtonTiny"
            href={automationHref(filters, { drawer: "rule-migrate", ruleId: rule.ruleId, notice: undefined })}
          >
            Crear copia visual para revisar
          </Link>
        </>
      ) : (
        <>
          <p>Esta regla sigue necesitando modo avanzado porque {compatibility.reason ?? "tiene una configuración personalizada"}.</p>
          <p className="adminMuted">Sus datos técnicos se conservan tal como están.</p>
        </>
      )}
    </section>
  );
}

function RuleDetailContent({ data, filters, rule }: { data: AutomationAdminData; filters: AutomationAdminFilters; rule: AutomationRule }) {
  const readiness = ruleActivationReadiness(data, rule);

  return (
    <>
      <dl className="adminDefinitionList">
        <div><dt>Rule ID</dt><dd>{rule.ruleId}</dd></div>
        <div><dt>Estado</dt><dd><span className={statusBadgeClass(rule.status)}>{rule.status}</span></dd></div>
        <div><dt>Evento</dt><dd>{rule.trigger.eventType}</dd></div>
        <div><dt>Version</dt><dd>{rule.version}</dd></div>
        <div><dt>Creada</dt><dd>{dateText(rule.createdAt)}</dd></div>
        <div><dt>Actualizada</dt><dd>{dateText(rule.updatedAt)}</dd></div>
        <div><dt>Activada</dt><dd>{dateText(rule.activatedAt)}</dd></div>
        <div><dt>Archivada</dt><dd>{dateText(rule.archivedAt)}</dd></div>
      </dl>

      {rule.description ? <p className="adminMuted adminSection">{rule.description}</p> : null}

      <div className="adminButtonRow adminSection">
        <Link className="adminButton adminButtonTiny" href={automationHref(filters, { drawer: "rule-edit", ruleId: rule.ruleId, notice: undefined })}>
          Editar regla
        </Link>
      </div>

      <AutomationRuleConfidencePanel data={data} rule={rule} />
      <AutomationRuleMigrationPanel filters={filters} rule={rule} />
      <RuleLifecycleActions readiness={readiness} rule={rule} />

      <div className="adminSection">
        <h3>Acciones configuradas</h3>
        {rule.actions.length ? (
          <table className="adminTable adminTableCompact">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Tipo</th>
                <th>Nombre</th>
                <th>Action ID</th>
              </tr>
            </thead>
            <tbody>
              {rule.actions.map((action) => (
                <tr key={action.actionId}>
                  <td>{action.position}</td>
                  <td>{action.type}</td>
                  <td>{action.name ?? "-"}</td>
                  <td>{action.actionId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="adminEmptyState">Sin acciones configuradas.</div>
        )}
      </div>

      <JsonPreview title="Filtros del trigger" value={rule.trigger.filters ?? {}} />
      <JsonPreview title="Condiciones" value={rule.conditions} />
      <JsonPreview title="Configuracion de acciones" value={rule.actions.map((action) => ({
        actionId: action.actionId,
        type: action.type,
        config: action.config,
      }))} />
    </>
  );
}

function ExecutionRetryAction({ execution }: { execution: AutomationExecutionDetail }) {
  if (execution.status !== "FAILED" && execution.status !== "DLQ") {
    return (
      <section className="adminSection">
        <h3>Operacion</h3>
        <div className="adminEmptyState">Solo las ejecuciones FAILED o DLQ admiten reintento manual.</div>
      </section>
    );
  }

  return (
    <section className="adminSection">
      <h3>Operacion</h3>
      <p className="adminMuted">
        Reintenta esta ejecucion usando el snapshot original del evento. Usa esta accion despues de corregir proveedor,
        plantilla o regla asociada.
      </p>
      <details className="productDangerMenu">
        <summary className="adminButton adminButtonTiny">
          Reintentar ejecucion
        </summary>
        <div className="productDangerPanel">
          <p>El reintento volvera a ejecutar las acciones configuradas para la regla asociada.</p>
          <form action={retryAutomationExecutionAction}>
            <input name="executionId" type="hidden" value={execution.executionId} />
            <button className="adminButton adminButtonPrimary adminButtonTiny" type="submit">
              Confirmar reintento
            </button>
          </form>
        </div>
      </details>
    </section>
  );
}

function executionConfidence(execution: AutomationExecutionDetail) {
  const failedStep = execution.steps.find((step) => step.status === "FAILED");

  if (execution.status === "SUCCEEDED") {
    return {
      title: "La automatización terminó correctamente",
      detail: "Todas las acciones registradas para esta ejecución terminaron sin error.",
      nextStep: "No tienes que hacer nada. Puedes revisar el detalle si necesitas una comprobación adicional.",
    };
  }
  if (execution.status === "FAILED" || execution.status === "DLQ") {
    return {
      title: "La automatización necesita atención",
      detail: failedStep
        ? `Falló el paso “${failedStep.type}”. ${failedStep.errorMessage ?? "Revisa su configuración antes de reintentar."}`
        : execution.errorMessage ?? "La ejecución falló antes de completar sus acciones.",
      nextStep: "Corrige la causa y después usa el reintento. El reintento utiliza el mismo evento original.",
    };
  }
  if (execution.status === "SKIPPED") {
    return {
      title: "La regla no llegó a ejecutarse",
      detail: "El evento se recibió, pero no se aplicó ninguna acción. Revisa las condiciones de la regla.",
      nextStep: "Abre la regla asociada y confirma que sus condiciones coinciden con el evento recibido.",
    };
  }
  return {
    title: "La automatización sigue en curso",
    detail: "Aún no hay un resultado definitivo para esta ejecución.",
    nextStep: "Espera a que cambie el estado antes de realizar un reintento manual.",
  };
}

function ExecutionConfidencePanel({ execution }: { execution: AutomationExecutionDetail }) {
  const confidence = executionConfidence(execution);
  const hasEmailStep = execution.steps.some((step) => step.type === "SEND_EMAIL");

  return (
    <section className="adminSection">
      <h3>Qué ha ocurrido</h3>
      <p><strong>{confidence.title}</strong></p>
      <p>{confidence.detail}</p>
      <p className="adminMuted">Siguiente paso: {confidence.nextStep}</p>
      {hasEmailStep && (execution.status === "FAILED" || execution.status === "DLQ") ? (
        <Link className="adminButton adminButtonTiny" href="/admin/configuracion/comunicaciones">Revisar plantilla y proveedor de email</Link>
      ) : null}
    </section>
  );
}

function ExecutionDetailContent({ execution, filters }: { execution: AutomationExecutionDetail; filters: AutomationAdminFilters }) {
  return (
    <>
      <dl className="adminDefinitionList">
        <div><dt>Execution ID</dt><dd>{execution.executionId}</dd></div>
        <div><dt>Estado</dt><dd><span className={statusBadgeClass(execution.status)}>{execution.status}</span></dd></div>
        <div><dt>Evento</dt><dd>{execution.eventType}</dd></div>
        <div><dt>Event ID</dt><dd>{execution.eventId}</dd></div>
        <div><dt>Rule ID</dt><dd>{execution.ruleId}</dd></div>
        <div><dt>Aggregate</dt><dd>{execution.aggregateId ?? "-"}</dd></div>
        <div><dt>Inicio</dt><dd>{dateText(execution.startedAt)}</dd></div>
        <div><dt>Fin</dt><dd>{dateText(execution.finishedAt)}</dd></div>
      </dl>

      <div className="adminButtonRow adminSection">
        <Link
          className="adminButton adminButtonTiny"
          href={automationHref(filters, { drawer: "rule", ruleId: execution.ruleId, executionId: undefined, notice: undefined })}
        >
          Ver regla asociada
        </Link>
      </div>

      {execution.errorMessage ? (
        <div className="adminBanner adminBannerError adminSection">{execution.errorMessage}</div>
      ) : null}

      <ExecutionConfidencePanel execution={execution} />
      <ExecutionRetryAction execution={execution} />

      <div className="adminSection">
        <h3>Pasos ejecutados</h3>
        {execution.steps.length ? (
          <table className="adminTable adminTableCompact">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Action ID</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {execution.steps.map((step) => (
                <tr key={step.stepId}>
                  <td>{step.type}</td>
                  <td><span className={statusBadgeClass(step.status)}>{step.status}</span></td>
                  <td>{step.actionId}</td>
                  <td>{truncateText(step.errorMessage, 72)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="adminEmptyState">Sin pasos registrados para esta ejecucion.</div>
        )}
      </div>

      <JsonPreview title="Payload del evento" value={execution.eventPayload} />
      <JsonPreview title="Detalle de pasos" value={execution.steps} />
    </>
  );
}

function AutomationRuleMigrationDrawer({
  data,
  filters,
  rule,
}: {
  data: AutomationAdminData;
  filters: AutomationAdminFilters;
  rule: AutomationRule;
}) {
  const compatibility = visualMigrationPlan(rule);
  const closeHref = automationHref(filters, { drawer: "rule", ruleId: rule.ruleId, notice: undefined });
  const advancedHref = automationHref(filters, { drawer: "rule-edit", ruleId: rule.ruleId, notice: undefined });

  if (!compatibility.migration) {
    return (
      <section className="adminSection">
        <h3>Esta regla se mantiene avanzada</h3>
        <p>No se puede crear una copia visual porque {compatibility.reason ?? "tiene una configuración personalizada"}.</p>
        <div className="adminButtonRow">
          <Link className="adminButton adminButtonTiny" href={advancedHref}>Editar en modo avanzado</Link>
          <Link className="adminButton adminButtonTiny" href={closeHref}>Volver al detalle</Link>
        </div>
      </section>
    );
  }

  const shopLabel = data.context.shopName || data.context.shopAlias || "la tienda activa";
  return (
    <AutomationVisualRuleBuilder
      advancedHref={advancedHref}
      cancelHref={closeHref}
      country={data.context.country}
      emailOptions={recommendedAutomationDrafts.map((draft) => ({
        eventType: draft.payload.trigger.eventType,
        templateKey: draft.templateKey,
        templateLabel: draft.templateLabel,
      }))}
      events={automationBusinessEvents}
      initialRule={compatibility.migration}
      locale={data.context.locale}
      migrationSourceRuleId={rule.ruleId}
      shopLabel={shopLabel}
    />
  );
}

function AutomationDetailDrawer({ data, filters }: Props) {
  if (filters.drawer === "rule-guided") {
    return <AutomationGuidedPreview data={data} filters={filters} />;
  }

  if (filters.drawer === "rule-visual-create") {
    const closeHref = automationHref(filters, { drawer: undefined, notice: undefined });
    const advancedHref = automationHref(filters, { drawer: "rule-create", notice: undefined });
    const shopLabel = data.context.shopName || data.context.shopAlias || "la tienda activa";

    return (
      <div className="adminDrawerBackdrop">
        <aside className="adminSideDrawer" aria-label="Crear regla con asistente" aria-modal="true" role="dialog">
          <div className="adminSideDrawerHeader">
            <div>
              <h2>Crear una regla</h2>
              <p>Elige qué sucede, qué comprobar y qué debe hacer Automation.</p>
            </div>
            <Link className="adminButton adminButtonTiny" href={closeHref}>Cerrar</Link>
          </div>
          <AutomationVisualRuleBuilder
            advancedHref={advancedHref}
            cancelHref={closeHref}
            country={data.context.country}
            emailOptions={recommendedAutomationDrafts.map((draft) => ({
              eventType: draft.payload.trigger.eventType,
              templateKey: draft.templateKey,
              templateLabel: draft.templateLabel,
            }))}
            events={automationBusinessEvents}
            locale={data.context.locale}
            shopLabel={shopLabel}
          />
        </aside>
      </div>
    );
  }

  if (
    filters.drawer !== "rule" &&
    filters.drawer !== "execution" &&
    filters.drawer !== "rule-create" &&
    filters.drawer !== "rule-edit" &&
    filters.drawer !== "rule-migrate"
  ) {
    return null;
  }

  const closeHref = automationHref(filters, {
    drawer: undefined,
    executionId: filters.drawer === "execution" ? undefined : filters.executionId,
    notice: undefined,
  });
  const isRuleDetailDrawer = filters.drawer === "rule";
  const isRuleCreateDrawer = filters.drawer === "rule-create";
  const isRuleEditDrawer = filters.drawer === "rule-edit";
  const isRuleMigrationDrawer = filters.drawer === "rule-migrate";
  const isExecutionDrawer = filters.drawer === "execution";
  const title = isRuleCreateDrawer
    ? "Crear regla"
    : isRuleEditDrawer
      ? "Editar regla"
      : isRuleMigrationDrawer
        ? "Crear copia visual"
      : isRuleDetailDrawer
        ? "Detalle de regla"
        : "Detalle de ejecucion";
  const result = isExecutionDrawer ? data.selectedExecution : data.selectedRule;

  return (
    <div className="adminDrawerBackdrop">
      <aside className="adminSideDrawer" aria-label={title} aria-modal="true" role="dialog">
        <div className="adminSideDrawerHeader">
          <div>
            <h2>{title}</h2>
            <p>Operacion directa sobre Automation via BFF, sin exponer servicios internos a la UI.</p>
          </div>
          <Link className="adminButton adminButtonTiny" href={closeHref}>Cerrar</Link>
        </div>

        {isRuleCreateDrawer ? <RuleEditorForm filters={filters} mode="create" /> : null}
        {!isRuleCreateDrawer && !result ? <div className="adminEmptyState">Selecciona un registro para abrir el detalle.</div> : null}
        {!isRuleCreateDrawer && result && !result.ok ? <ResultBanner error={result.error} /> : null}
        {result?.ok && isRuleDetailDrawer ? (
          <RuleDetailContent data={data} filters={filters} rule={result.data as AutomationRule} />
        ) : null}
        {result?.ok && isRuleEditDrawer ? (
          <RuleEditorForm filters={filters} mode="edit" rule={result.data as AutomationRule} />
        ) : null}
        {result?.ok && isRuleMigrationDrawer ? (
          <AutomationRuleMigrationDrawer data={data} filters={filters} rule={result.data as AutomationRule} />
        ) : null}
        {result?.ok && isExecutionDrawer ? (
          <ExecutionDetailContent execution={result.data as AutomationExecutionDetail} filters={filters} />
        ) : null}
      </aside>
    </div>
  );
}

export function AutomationAdminPage({ data, filters }: Props) {
  return (
    <main className="adminPage">
      <div className="adminPageHeader">
        <div>
          <div className="adminBreadcrumb">Admin / Configuracion / Automatizacion</div>
          <h1 className="adminPageTitle">Automatizacion</h1>
          <p className="adminPageIntro">
            Configura y revisa automatizaciones para la tienda activa. Los detalles tecnicos siguen disponibles cuando los necesites.
          </p>
        </div>
        <div className="adminButtonRow">
          <Link className="adminButton" href="/admin/configuracion">
            Volver
          </Link>
        </div>
      </div>

      {filters.notice ? <div className="adminBanner">{filters.notice}</div> : null}

      <AutomationScope data={data} />
      <AutomationKpis data={data} filters={filters} />
      <AutomationBusinessCatalog />
      <AutomationGuidedStart filters={filters} />
      <AutomationAdvancedCompatibility data={data} filters={filters} />
      <RecommendedAutomationsPanel data={data} />
      <AutomationFilters filters={filters} />
      <AutomationOperationalGuide data={data} filters={filters} />
      <AutomationDefaultsPanel data={data} />

      <section className="adminGrid">
        <HealthPanel data={data} />
        <RulesTable data={data} filters={filters} />
      </section>

      <ExecutionsTable data={data} filters={filters} />
      <AutomationDetailDrawer data={data} filters={filters} />
    </main>
  );
}

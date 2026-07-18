"use client";

import { useMemo, useState } from "react";
import { createVisualAutomationRuleAction } from "./automation-admin-actions";

type VisualEvent = {
  area: string;
  eventType: string;
  label: string;
};

type EmailOption = {
  eventType: string;
  templateKey: string;
  templateLabel: string;
};

type InitialRule = {
  actionType: "SEND_EMAIL" | "BUSINESS_LOG";
  conditionMode: "always" | "customer-exists";
  eventType: string;
  name: string;
  templateKey?: string;
};

type Props = {
  cancelHref: string;
  country: string;
  emailOptions: EmailOption[];
  events: VisualEvent[];
  initialRule?: InitialRule;
  locale: string;
  migrationSourceRuleId?: string;
  shopLabel: string;
  advancedHref: string;
};

export function AutomationVisualRuleBuilder({
  advancedHref,
  cancelHref,
  country,
  emailOptions,
  events,
  initialRule,
  locale,
  migrationSourceRuleId,
  shopLabel,
}: Props) {
  const [eventType, setEventType] = useState(initialRule?.eventType ?? emailOptions[0]?.eventType ?? events[0]?.eventType ?? "");
  const [actionType, setActionType] = useState<"SEND_EMAIL" | "BUSINESS_LOG">(initialRule?.actionType ?? "SEND_EMAIL");
  const [conditionMode, setConditionMode] = useState<"always" | "customer-exists">(initialRule?.conditionMode ?? "always");
  const emailChoices = useMemo(
    () => emailOptions.filter((option) => option.eventType === eventType),
    [emailOptions, eventType],
  );
  const [templateKey, setTemplateKey] = useState(initialRule?.templateKey ?? "");
  const selectedEvent = events.find((event) => event.eventType === eventType);
  const selectedTemplate = emailChoices.find((option) => option.templateKey === templateKey) ?? emailChoices[0];
  const canCreate = Boolean(eventType) && (actionType !== "SEND_EMAIL" || Boolean(selectedTemplate));

  const eventsByArea = useMemo(() => events.reduce<Record<string, VisualEvent[]>>((groups, event) => {
    groups[event.area] = [...(groups[event.area] ?? []), event];
    return groups;
  }, {}), [events]);

  return (
    <form action={createVisualAutomationRuleAction} className="pricingDenseForm">
      <div className="adminBanner">
        {migrationSourceRuleId
          ? "Crearás una copia en borrador para revisarla. La regla original no se modifica ni se desactiva."
          : "Crea una primera versión de la regla con palabras sencillas. Se guardará como borrador y no se activará sola."}
      </div>
      {migrationSourceRuleId ? <input name="migrationSourceRuleId" type="hidden" value={migrationSourceRuleId} /> : null}

      <section className="adminSection">
        <h3>1. Cuando ocurre</h3>
        <label className="adminField">
          <span>Elige la situación que inicia la automatización</span>
          <select name="eventType" value={eventType} onChange={(event) => {
            setEventType(event.target.value);
            setTemplateKey("");
          }} required>
            {Object.entries(eventsByArea).map(([area, areaEvents]) => (
              <optgroup key={area} label={area}>
                {areaEvents.map((event) => <option key={event.eventType} value={event.eventType}>{event.label}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
      </section>

      <section className="adminSection">
        <h3>2. Si se cumple</h3>
        <label className="adminField">
          <span>Condición</span>
          <select name="conditionMode" value={conditionMode} onChange={(event) => setConditionMode(event.target.value as "always" | "customer-exists")}>
            <option value="always">Siempre que ocurra</option>
            <option value="customer-exists">Solo si el pedido identifica al cliente</option>
          </select>
        </label>
      </section>

      <section className="adminSection">
        <h3>3. Qué queremos hacer</h3>
        <div className="adminButtonRow" role="radiogroup" aria-label="Acción de la regla">
          <label className="adminCheckbox">
            <input checked={actionType === "SEND_EMAIL"} name="actionType" onChange={() => setActionType("SEND_EMAIL")} type="radio" value="SEND_EMAIL" />
            <span>Enviar un email al cliente</span>
          </label>
          <label className="adminCheckbox">
            <input checked={actionType === "BUSINESS_LOG"} name="actionType" onChange={() => setActionType("BUSINESS_LOG")} type="radio" value="BUSINESS_LOG" />
            <span>Registrar el evento para el equipo</span>
          </label>
        </div>

        {actionType === "SEND_EMAIL" && emailChoices.length ? (
          <label className="adminField">
            <span>Plantilla de email activa</span>
            <select name="templateKey" value={selectedTemplate?.templateKey ?? ""} onChange={(event) => setTemplateKey(event.target.value)}>
              {emailChoices.map((option) => <option key={option.templateKey} value={option.templateKey}>{option.templateLabel}</option>)}
            </select>
            <small className="adminMuted">Solo se muestran plantillas activas del locale de la tienda. Verifica que sus variables existan en el evento elegido.</small>
          </label>
        ) : null}

        {actionType === "SEND_EMAIL" && !emailChoices.length ? (
          <div className="adminBanner adminBannerError">
            Aún no hay una plantilla de email preparada para esta situación. Puedes registrar el evento o continuar en el modo avanzado.
          </div>
        ) : null}
      </section>

      <section className="adminSection" aria-live="polite">
        <h3>4. Revisar antes de crear</h3>
        <label className="adminField">
          <span>Nombre de la regla</span>
          <input defaultValue={initialRule?.name ?? (selectedEvent ? `${selectedEvent.label}: aviso` : "Nueva automatización")} name="name" required />
        </label>
        <p>
          Cuando ocurra <strong>{selectedEvent?.label ?? "la situación elegida"}</strong>,
          {conditionMode === "always" ? " siempre" : " si existe un cliente identificado"}, Automation {actionType === "SEND_EMAIL"
            ? ` enviará el email “${selectedTemplate?.templateLabel ?? "sin plantilla"}”.`
            : " registrará el evento para que el equipo pueda revisarlo."}
        </p>
        <p className="adminMuted">Aplicará solo a {shopLabel}, en {locale} y mercado {country}.</p>
      </section>

      <div className="adminButtonRow">
        <button className="adminButton adminButtonPrimary" disabled={!canCreate} type="submit">Crear borrador para revisar</button>
        <a className="adminButton adminButtonTiny" href={advancedHref}>Abrir modo avanzado</a>
        <a className="adminButton adminButtonTiny" href={cancelHref}>Cancelar</a>
      </div>
    </form>
  );
}

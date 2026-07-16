import Link from "next/link";
import type { AdminContext } from "../../shared/config/admin-context";
import type {
  CommunicationsAdminData,
  CommunicationsAdminFilters,
  EmailDeliveryRecord,
  EmailDeliveryStatus,
  EmailProviderSettings,
} from "./communications-admin";
import {
  bootstrapAuthEmailTemplatesAction,
  retryEmailDeliveryAction,
  sendCommunicationsTestEmailAction,
  updateEmailProviderSettingsAction,
} from "./communications-admin-actions";

type Props = {
  context: AdminContext;
  data: CommunicationsAdminData;
  filters: CommunicationsAdminFilters;
};

const providerLabels: Record<string, string> = {
  stub: "Stub",
  smtp: "SMTP",
  sendgrid: "SendGrid",
  resend: "Resend",
};

const authTemplateKeys = new Set([
  "customer.account.activation",
  "customer.account.activation.reminder",
  "customer.account.activation.expiring",
  "customer.account.password-reset",
  "customer.account.password-changed",
]);
const deliveryStatuses: EmailDeliveryStatus[] = ["PENDING", "SENT", "FAILED", "SKIPPED", "RETRYING"];
const deliveryPageSizeOptions = ["10", "20", "50"];

function valueText(value: string | number | boolean | null | undefined) {
  if (typeof value === "boolean") {
    return value ? "Si" : "No";
  }
  if (value === null || typeof value === "undefined" || value === "") {
    return "-";
  }
  return String(value);
}

function statusBadge(status: string) {
  if (status === "ACTIVE") {
    return "adminBadge adminBadgeOk";
  }
  if (status === "DRAFT") {
    return "adminBadge adminBadgeWarn";
  }
  if (status === "ARCHIVED") {
    return "adminBadge";
  }
  return "adminBadge adminBadgeError";
}

function deliveryStatusBadge(status: EmailDeliveryStatus) {
  if (status === "SENT") {
    return "adminBadge adminBadgeOk";
  }
  if (status === "FAILED") {
    return "adminBadge adminBadgeError";
  }
  if (status === "PENDING" || status === "RETRYING") {
    return "adminBadge adminBadgeWarn";
  }
  return "adminBadge";
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

function defaultSettings(context: AdminContext): EmailProviderSettings {
  return {
    organizationId: context.organizationId,
    shopId: context.shopId,
    provider: "stub",
    active: false,
    fromEmail: null,
    replyToEmail: null,
    smtpHost: null,
    smtpPort: null,
    smtpSecure: false,
    smtpUser: null,
    secretConfigured: false,
    secretUpdatedAt: null,
    createdAt: "",
    updatedAt: "",
  };
}

function communicationsHref(filters: CommunicationsAdminFilters, overrides: Partial<CommunicationsAdminFilters>) {
  const params = new URLSearchParams();
  const next = { ...filters, ...overrides };

  if (next.drawer) {
    params.set("drawer", next.drawer);
  }
  if (next.status) {
    params.set("status", next.status);
  }
  if (next.deliveryStatus) {
    params.set("deliveryStatus", next.deliveryStatus);
  }
  if (next.deliveryId) {
    params.set("deliveryId", next.deliveryId);
  }
  if (next.deliveryTemplateKey) {
    params.set("deliveryTemplateKey", next.deliveryTemplateKey);
  }
  if (next.deliverySourceEventId) {
    params.set("deliverySourceEventId", next.deliverySourceEventId);
  }
  if (next.deliveryCustomerId) {
    params.set("deliveryCustomerId", next.deliveryCustomerId);
  }
  if (next.deliveriesLimit) {
    params.set("deliveriesLimit", next.deliveriesLimit);
  }
  if (next.deliveriesOffset) {
    params.set("deliveriesOffset", next.deliveriesOffset);
  }
  if (next.notice) {
    params.set("notice", next.notice);
  }

  const query = params.toString();
  return query ? `/admin/configuracion/comunicaciones?${query}` : "/admin/configuracion/comunicaciones";
}

function deliveryLastAttempt(delivery: EmailDeliveryRecord) {
  return [...delivery.attempts]
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())[0];
}

function deliveryStatusDate(delivery: EmailDeliveryRecord) {
  return delivery.sentAt ?? delivery.failedAt ?? delivery.skippedAt ?? delivery.updatedAt;
}

function DeliveryFilters({ filters }: { filters: CommunicationsAdminFilters }) {
  const clearHref = communicationsHref(filters, {
    drawer: undefined,
    notice: undefined,
    deliveryStatus: undefined,
    deliveryTemplateKey: undefined,
    deliverySourceEventId: undefined,
    deliveryCustomerId: undefined,
    deliveriesLimit: undefined,
    deliveriesOffset: undefined,
  });

  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h2>Filtros de entregas</h2>
          <p>Consulta emails por estado, plantilla, evento o cliente dentro de la tienda activa.</p>
        </div>
        <Link className="adminButton adminButtonTiny" href={clearHref}>Limpiar</Link>
      </div>
      <form className="pricingDenseForm" method="get">
        <input name="status" type="hidden" value={filters.status ?? ""} />
        <input name="deliveriesLimit" type="hidden" value={filters.deliveriesLimit ?? ""} />
        <div className="adminFormGrid">
          <label className="adminField">
            <span>Estado</span>
            <select name="deliveryStatus" defaultValue={filters.deliveryStatus ?? ""}>
              <option value="">Todos</option>
              {deliveryStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label className="adminField">
            <span>Plantilla</span>
            <input name="deliveryTemplateKey" placeholder="shipping.delivered" defaultValue={filters.deliveryTemplateKey ?? ""} />
          </label>
          <label className="adminField">
            <span>Evento origen</span>
            <input name="deliverySourceEventId" placeholder="sourceEventId" defaultValue={filters.deliverySourceEventId ?? ""} />
          </label>
          <label className="adminField">
            <span>Cliente</span>
            <input name="deliveryCustomerId" placeholder="customerId" defaultValue={filters.deliveryCustomerId ?? ""} />
          </label>
        </div>
        <button className="adminButton adminButtonPrimary" type="submit">Aplicar filtros</button>
      </form>
    </section>
  );
}

function DeliveryPagination({
  count,
  filters,
  limit,
  offset,
  total,
}: {
  count: number;
  filters: CommunicationsAdminFilters;
  limit: number;
  offset: number;
  total: number;
}) {
  const currentLimit = Number.isInteger(limit) && limit > 0 ? limit : count || 20;
  const currentOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0;
  const firstItem = total > 0 ? currentOffset + 1 : 0;
  const lastItem = Math.min(currentOffset + count, total);
  const hasPrevious = currentOffset > 0;
  const nextOffset = currentOffset + currentLimit;
  const hasNext = nextOffset < total;
  const pageHref = (nextLimit: number | string, nextOffsetValue: number) => communicationsHref(filters, {
    drawer: undefined,
    notice: undefined,
    deliveriesLimit: String(nextLimit),
    deliveriesOffset: String(nextOffsetValue),
  });

  return (
    <nav className="productListPagination" aria-label="Paginacion de entregas">
      <p>Mostrando {firstItem}-{lastItem} de {total} entregas</p>
      <div className="productListPaginationControls">
        <Link aria-disabled={!hasPrevious} className={`adminButton adminButtonTiny${hasPrevious ? "" : " adminButtonDisabled"}`} href={pageHref(currentLimit, hasPrevious ? Math.max(0, currentOffset - currentLimit) : currentOffset)}>Anterior</Link>
        <Link aria-disabled={!hasNext} className={`adminButton adminButtonTiny${hasNext ? "" : " adminButtonDisabled"}`} href={pageHref(currentLimit, hasNext ? nextOffset : currentOffset)}>Siguiente</Link>
      </div>
      <div className="productListPaginationControls" aria-label="Tamano de pagina entregas">
        {deliveryPageSizeOptions.map((pageSize) => (
          <Link className={`adminButton adminButtonTiny${String(currentLimit) === pageSize ? " adminButtonDisabled" : ""}`} href={pageHref(pageSize, 0)} key={pageSize}>{pageSize} por pagina</Link>
        ))}
      </div>
    </nav>
  );
}

function DeliveryAuditTable({ data, filters }: Pick<Props, "data" | "filters">) {
  if (!data.deliveries.ok) {
    return <div className="adminBanner adminBannerError">No se pudieron cargar las entregas: {data.deliveries.error}</div>;
  }

  const deliveries = data.deliveries.data;

  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h2>Auditoría de entregas</h2>
          <p>{deliveries.total} emails registrados para la tienda activa.</p>
        </div>
        <Link className="adminButton adminButtonTiny" href={communicationsHref(filters, { deliveryStatus: "FAILED", deliveriesOffset: "0", notice: undefined })}>Ver fallidas</Link>
      </div>
      {deliveries.items.length ? (
        <div className="adminTableScroller">
          <table className="adminTable">
            <thead>
              <tr><th>Entrega</th><th>Estado</th><th>Destinatario</th><th>Último intento</th><th>Fecha</th><th>Error</th><th>Detalle</th></tr>
            </thead>
            <tbody>
              {deliveries.items.map((delivery) => {
                const attempt = deliveryLastAttempt(delivery);
                return (
                  <tr key={delivery.deliveryId}>
                    <td><strong>{delivery.templateKey}</strong><div className="adminMuted">{delivery.deliveryId}</div></td>
                    <td><span className={deliveryStatusBadge(delivery.status)}>{delivery.status}</span></td>
                    <td>{valueText(delivery.recipient.email)}<div className="adminMuted">{valueText(delivery.recipient.customerId)}</div></td>
                    <td>{attempt ? <><strong>{attempt.provider}</strong><div className="adminMuted">{attempt.status} · {dateText(attempt.occurredAt)}</div></> : "Sin intento"}</td>
                    <td>{dateText(deliveryStatusDate(delivery))}</td>
                    <td>{truncateText(delivery.errorMessage ?? attempt?.errorMessage, 88)}</td>
                    <td>
                      <Link className="adminButton adminButtonTiny" href={communicationsHref(filters, { drawer: "delivery", deliveryId: delivery.deliveryId, notice: undefined })}>Ver detalle</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="adminEmptyState">No hay entregas para los filtros seleccionados.</div>
      )}
      <DeliveryPagination count={deliveries.items.length} filters={filters} limit={deliveries.limit} offset={deliveries.offset} total={deliveries.total} />
    </section>
  );
}

function ProviderDrawer({
  settings,
  closeHref,
}: {
  settings: EmailProviderSettings;
  closeHref: string;
}) {
  return (
    <div className="adminDrawerBackdrop">
      <aside className="adminSideDrawer communicationsProviderDrawer" aria-label="Configurar proveedor email" aria-modal="true" role="dialog">
        <div className="adminSideDrawerHeader">
          <div>
            <h2>Proveedor email</h2>
            <p>SMTP o proveedor externo por Organization/Shop. La password/API key nunca se muestra.</p>
          </div>
          <Link className="adminButton adminButtonTiny" href={closeHref}>Cerrar</Link>
        </div>

        <form action={updateEmailProviderSettingsAction} className="pricingDenseForm">
          <label className="adminField">
            <span>Proveedor</span>
            <select name="provider" defaultValue={settings.provider}>
              <option value="stub">Stub</option>
              <option value="smtp">SMTP</option>
              <option value="sendgrid">SendGrid</option>
              <option value="resend">Resend</option>
            </select>
          </label>
          <label className="adminCheckbox">
            <input name="active" type="checkbox" defaultChecked={settings.active} />
            Activo
          </label>
          <label className="adminField">
            <span>Email remitente</span>
            <input name="fromEmail" type="text" defaultValue={settings.fromEmail ?? ""} placeholder="Tienda <no-reply@empresa.com>" />
          </label>
          <label className="adminField">
            <span>Reply-To</span>
            <input name="replyToEmail" type="email" defaultValue={settings.replyToEmail ?? ""} placeholder="soporte@empresa.com" />
          </label>
          <div className="adminFormGrid">
            <label className="adminField">
              <span>SMTP host</span>
              <input name="smtpHost" type="text" defaultValue={settings.smtpHost ?? ""} placeholder="smtp.empresa.com" />
            </label>
            <label className="adminField">
              <span>SMTP port</span>
              <input name="smtpPort" type="number" defaultValue={settings.smtpPort ?? 587} min={1} max={65535} />
            </label>
          </div>
          <label className="adminCheckbox">
            <input name="smtpSecure" type="checkbox" defaultChecked={settings.smtpSecure === true} />
            TLS/SSL directo
          </label>
          <label className="adminField">
            <span>Usuario SMTP / API user</span>
            <input name="smtpUser" type="text" defaultValue={settings.smtpUser ?? ""} autoComplete="username" />
          </label>
          <label className="adminField">
            <span>Password / API key</span>
            <input name="secret" type="password" autoComplete="new-password" placeholder={settings.secretConfigured ? "Secret ya configurado" : "Nuevo secret"} />
          </label>
          <label className="adminCheckbox">
            <input name="clearSecret" type="checkbox" />
            Borrar secret actual
          </label>
          <button className="adminButton adminButtonPrimary" type="submit">
            Guardar email
          </button>
        </form>
      </aside>
    </div>
  );
}

function DeliveryRetryForm({ delivery, filters }: { delivery: EmailDeliveryRecord; filters: CommunicationsAdminFilters }) {
  if (delivery.status !== "FAILED") {
    return null;
  }

  return (
    <form action={retryEmailDeliveryAction} className="pricingDenseForm adminSection">
      <input name="deliveryId" type="hidden" value={delivery.deliveryId} />
      <input name="status" type="hidden" value={filters.status ?? ""} />
      <input name="deliveryStatus" type="hidden" value={filters.deliveryStatus ?? ""} />
      <input name="deliveryTemplateKey" type="hidden" value={filters.deliveryTemplateKey ?? ""} />
      <input name="deliverySourceEventId" type="hidden" value={filters.deliverySourceEventId ?? ""} />
      <input name="deliveryCustomerId" type="hidden" value={filters.deliveryCustomerId ?? ""} />
      <input name="deliveriesLimit" type="hidden" value={filters.deliveriesLimit ?? ""} />
      <input name="deliveriesOffset" type="hidden" value={filters.deliveriesOffset ?? ""} />
      <div>
        <h3>Reintentar entrega</h3>
        <p className="adminMuted">BFF reutilizará el snapshot persistido y devolverá el estado resultante.</p>
      </div>
      <button className="adminButton adminButtonPrimary" type="submit">Reintentar email</button>
    </form>
  );
}

function DeliveryDrawer({ data, filters, closeHref }: { data: CommunicationsAdminData; filters: CommunicationsAdminFilters; closeHref: string }) {
  const deliveryResult = data.selectedDelivery;

  return (
    <div className="adminDrawerBackdrop">
      <aside className="adminSideDrawer communicationsProviderDrawer" aria-label="Detalle de entrega email" aria-modal="true" role="dialog">
        <div className="adminSideDrawerHeader">
          <div>
            <h2>Detalle de entrega</h2>
            <p>Trazabilidad del proveedor sin renderizar contenido sensible del email.</p>
          </div>
          <Link className="adminButton adminButtonTiny" href={closeHref}>Cerrar</Link>
        </div>
        {!deliveryResult ? <div className="adminEmptyState">Selecciona una entrega para consultar su detalle.</div> : null}
        {deliveryResult && !deliveryResult.ok ? <div className="adminBanner adminBannerError">No se pudo cargar la entrega: {deliveryResult.error}</div> : null}
        {deliveryResult?.ok ? (() => {
          const delivery = deliveryResult.data;
          return <>
            <div className="adminSection">
              <span className={deliveryStatusBadge(delivery.status)}>{delivery.status}</span>
              <dl className="adminDefinitionList">
                <div><dt>Entrega</dt><dd>{delivery.deliveryId}</dd></div>
                <div><dt>Plantilla</dt><dd>{delivery.templateKey}</dd></div>
                <div><dt>Destinatario</dt><dd>{valueText(delivery.recipient.email)}</dd></div>
                <div><dt>Cliente</dt><dd>{valueText(delivery.recipient.customerId)}</dd></div>
                <div><dt>Evento origen</dt><dd>{valueText(delivery.sourceEventId)}</dd></div>
                <div><dt>Locale</dt><dd>{delivery.locale}</dd></div>
                <div><dt>Creada</dt><dd>{dateText(delivery.createdAt)}</dd></div>
                <div><dt>Última actualización</dt><dd>{dateText(delivery.updatedAt)}</dd></div>
              </dl>
            </div>
            {delivery.errorMessage ? <div className="adminBanner adminBannerError">{delivery.errorMessage}</div> : null}
            <DeliveryRetryForm delivery={delivery} filters={filters} />
            <section className="adminSection">
              <h3>Intentos del proveedor</h3>
              {delivery.attempts.length ? (
                <div className="adminTableScroller">
                  <table className="adminTable adminTableCompact">
                    <thead><tr><th>Proveedor</th><th>Estado</th><th>Fecha</th><th>Error</th></tr></thead>
                    <tbody>{delivery.attempts.map((attempt) => (
                      <tr key={attempt.attemptId}>
                        <td>{attempt.provider}</td>
                        <td><span className={attempt.status === "SENT" ? "adminBadge adminBadgeOk" : "adminBadge adminBadgeError"}>{attempt.status}</span></td>
                        <td>{dateText(attempt.occurredAt)}</td>
                        <td>{truncateText(attempt.errorMessage, 160)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <div className="adminEmptyState">La entrega todavía no tiene intentos registrados.</div>}
            </section>
            <section className="adminSection">
              <h3>Snapshot registrado</h3>
              <p className="adminMuted">{delivery.renderedSnapshot?.subject ? `Asunto: ${delivery.renderedSnapshot.subject}` : "No hay asunto disponible."}</p>
              <p className="adminMuted">El HTML, el texto, los datos y los adjuntos no se representan aquí para evitar exponer enlaces privados o contenido sensible.</p>
            </section>
          </>;
        })() : null}
      </aside>
    </div>
  );
}

export function CommunicationsAdminPage({ context, data, filters }: Props) {
  const settings = data.settings.ok ? data.settings.data : defaultSettings(context);
  const providerDrawerHref = communicationsHref(filters, { drawer: "provider", deliveryId: undefined, notice: undefined });
  const closeDrawerHref = communicationsHref(filters, { drawer: undefined, deliveryId: undefined, notice: undefined });
  const templates = data.authTemplates.ok
    ? data.authTemplates.data.items.filter((item) => authTemplateKeys.has(item.templateKey))
    : [];
  const testTemplateOptions = Array.from(new Set([
    ...templates.filter((template) => template.status === "ACTIVE").map((template) => template.templateKey),
    "customer.account.activation",
    "customer.account.password-reset",
  ]));

  return (
    <main className="adminPage">
      <div className="adminPageHeader">
        <div>
          <div className="adminBreadcrumb">Admin / Configuracion / Comunicaciones</div>
          <h1 className="adminPageTitle">Comunicaciones email</h1>
          <p className="adminPageIntro">
            Configura el proveedor de confianza para emails transaccionales, activacion de cuenta y recuperacion de password.
          </p>
        </div>
        <div className="adminButtonRow">
          <Link className="adminButton" href="/admin/configuracion">
            Volver
          </Link>
        </div>
      </div>

      {filters.notice ? <div className="adminBanner">{filters.notice}</div> : null}
      {!data.settings.ok ? <div className="adminBanner">{data.settings.error}</div> : null}

      <section className="adminKpiGrid" aria-label="Resumen comunicaciones">
        <article className="adminKpi">
          <span>Proveedor</span>
          <strong>{providerLabels[settings.provider] ?? settings.provider}</strong>
          <div className="adminMuted">{settings.active ? "Activo" : "Inactivo"}</div>
        </article>
        <article className="adminKpi">
          <span>Email remitente</span>
          <strong>{settings.fromEmail || "Pendiente"}</strong>
          <div className="adminMuted">fromEmail</div>
        </article>
        <article className="adminKpi">
          <span>Secret</span>
          <strong>{settings.secretConfigured ? "Configurado" : "Pendiente"}</strong>
          <div className="adminMuted">{settings.secretUpdatedAt || "No expuesto en UI"}</div>
        </article>
        <article className="adminKpi">
          <span>Plantillas auth</span>
          <strong>{templates.length}</strong>
          <div className="adminMuted">Activacion y recuperacion</div>
        </article>
      </section>

      <section className="adminGrid">
        <article className="adminCard">
          <div className="adminCardHeader">
            <div>
              <h2>Proveedor email</h2>
              <p>Gestiona SMTP, remitente y credenciales desde el panel lateral.</p>
            </div>
            <span className={settings.active ? "adminBadge adminBadgeOk" : "adminBadge"}>
              {settings.active ? "Activo" : "Inactivo"}
            </span>
          </div>

          <div className="adminButtonRow">
            <Link className="adminButton adminButtonPrimary" href={providerDrawerHref}>
              Configurar proveedor
            </Link>
          </div>

          <div className="adminSection">
            <div className="adminCardHeader">
              <div>
                <h2>Enviar prueba</h2>
                <p>Valida la configuracion guardada contra BFF y Communications con un destinatario real.</p>
              </div>
            </div>
            <form action={sendCommunicationsTestEmailAction} className="communicationsTestForm">
              <label className="adminField">
                <span>Destinatario de prueba</span>
                <input name="recipientEmail" type="email" placeholder="tu-email@empresa.com" required />
              </label>
              <label className="adminField">
                <span>Plantilla</span>
                <select name="templateKey" defaultValue={testTemplateOptions[0]}>
                  {testTemplateOptions.map((templateKey) => (
                    <option key={templateKey} value={templateKey}>{templateKey}</option>
                  ))}
                </select>
              </label>
              <label className="adminField">
                <span>Locale</span>
                <input name="locale" defaultValue={context.locale} />
              </label>
              <button className="adminButton" type="submit">
                Enviar prueba
              </button>
            </form>
            <p className="adminMuted">
              Con proveedor Stub se registra el delivery pero no sale a una bandeja externa.
            </p>
          </div>
        </article>

        <aside className="adminCard">
          <div className="adminCardHeader">
            <div>
              <h2>Plantillas de cuenta</h2>
              <p>Activacion, recordatorios y recuperacion de password.</p>
            </div>
          </div>
          <form action={bootstrapAuthEmailTemplatesAction} className="pricingDenseForm">
            <label className="adminField">
              <span>Locale</span>
              <input name="locale" defaultValue={context.locale} />
            </label>
            <label className="adminCheckbox">
              <input name="overwrite" type="checkbox" />
              Sobrescribir defaults existentes
            </label>
            <button className="adminButton" type="submit">
              Crear defaults auth
            </button>
          </form>

          {data.authTemplates.ok ? (
            <table className="adminTable adminTableCompact">
              <thead>
                <tr>
                  <th>Template</th>
                  <th>Estado</th>
                  <th>Version</th>
                </tr>
              </thead>
              <tbody>
                {templates.length ? templates.map((template) => (
                  <tr key={template.templateId}>
                    <td>
                      <strong>{template.templateKey}</strong>
                      <div className="adminMuted">{template.subjectTemplate ?? "Sin asunto"}</div>
                    </td>
                    <td><span className={statusBadge(template.status)}>{template.status}</span></td>
                    <td>{template.version}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3}>No hay plantillas auth para {context.locale}.</td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <div className="adminEmptyState">{data.authTemplates.error}</div>
          )}
        </aside>
      </section>

      <DeliveryFilters filters={filters} />
      <DeliveryAuditTable data={data} filters={filters} />

      <section className="adminCard">
        <h2>Estado tecnico</h2>
        <table className="adminTable">
          <tbody>
            <tr><th>Organization</th><td>{context.organizationId || "Pendiente"}</td></tr>
            <tr><th>Shop</th><td>{context.shopId || "Pendiente"}</td></tr>
            <tr><th>Host SMTP</th><td>{valueText(settings.smtpHost)}</td></tr>
            <tr><th>Usuario SMTP</th><td>{valueText(settings.smtpUser)}</td></tr>
            <tr><th>Ultima actualizacion</th><td>{valueText(settings.updatedAt)}</td></tr>
          </tbody>
        </table>
      </section>

      {filters.drawer === "provider" ? (
        <ProviderDrawer settings={settings} closeHref={closeDrawerHref} />
      ) : null}
      {filters.drawer === "delivery" ? <DeliveryDrawer data={data} filters={filters} closeHref={closeDrawerHref} /> : null}
    </main>
  );
}

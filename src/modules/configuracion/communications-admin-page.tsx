import Link from "next/link";
import type { AdminContext } from "../../shared/config/admin-context";
import type { CommunicationsAdminData, CommunicationsAdminFilters, EmailProviderSettings } from "./communications-admin";
import {
  bootstrapAuthEmailTemplatesAction,
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
  if (next.notice) {
    params.set("notice", next.notice);
  }

  const query = params.toString();
  return query ? `/admin/configuracion/comunicaciones?${query}` : "/admin/configuracion/comunicaciones";
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

export function CommunicationsAdminPage({ context, data, filters }: Props) {
  const settings = data.settings.ok ? data.settings.data : defaultSettings(context);
  const providerDrawerHref = communicationsHref(filters, { drawer: "provider", notice: undefined });
  const closeDrawerHref = communicationsHref(filters, { drawer: undefined, notice: undefined });
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
    </main>
  );
}

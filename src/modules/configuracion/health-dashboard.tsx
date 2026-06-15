import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";
import type { AdminHealth, ServiceHealthStatus } from "./health";

type HealthDashboardProps = {
  context: AdminContext;
  health: AdminHealth;
};

const statusLabels: Record<ServiceHealthStatus, string> = {
  ok: "OK",
  degraded: "Degradado",
  unavailable: "Sin conexion",
  skipped: "Pendiente",
};

const statusClasses: Record<ServiceHealthStatus, string> = {
  ok: "adminBadge adminBadgeOk",
  degraded: "adminBadge adminBadgeWarn",
  unavailable: "adminBadge adminBadgeError",
  skipped: "adminBadge",
};

function countStatus(health: AdminHealth, status: ServiceHealthStatus) {
  return health.services.filter((service) => service.status === status).length;
}

export function HealthDashboard({ context, health }: HealthDashboardProps) {
  const missingContext = !hasRequiredAdminContext(context);

  return (
    <main className="adminPage">
      <div className="adminPageHeader">
        <div>
          <div className="adminBreadcrumb">Admin / Configuracion / Health</div>
          <h1 className="adminPageTitle">Centro de configuracion inicial</h1>
          <p className="adminPageIntro">
            Primer proceso de servicio_configuracion: shell Admin, contexto
            Organization/Shop, permisos base y visibilidad operativa del BFF.
          </p>
        </div>
        <div className="adminButtonRow">
          <button className="adminButton" type="button">
            Ver tienda
          </button>
          <button className="adminButton adminButtonPrimary" type="button">
            Guardar contexto
          </button>
        </div>
      </div>

      {missingContext ? (
        <div className="adminBanner">
          Falta organizationId o shopId. Definelos en el selector superior para
          habilitar pantallas Admin scopeadas por tienda.
        </div>
      ) : null}

      <section className="adminKpiGrid" aria-label="Resumen operativo">
        <article className="adminKpi">
          <span>Servicios OK</span>
          <strong>{countStatus(health, "ok")}</strong>
          <div className="adminMuted">Responden desde BFF</div>
        </article>
        <article className="adminKpi">
          <span>Degradados</span>
          <strong>{countStatus(health, "degraded")}</strong>
          <div className="adminMuted">Requieren revision</div>
        </article>
        <article className="adminKpi">
          <span>Sin conexion</span>
          <strong>{countStatus(health, "unavailable")}</strong>
          <div className="adminMuted">BFF no disponible o endpoint ausente</div>
        </article>
        <article className="adminKpi">
          <span>Contexto</span>
          <strong>{missingContext ? "Incompleto" : "Listo"}</strong>
          <div className="adminMuted">{context.locale} / {context.currency}</div>
        </article>
      </section>

      <section className="adminGrid">
        <article className="adminCard">
          <div className="adminCardHeader">
            <div>
              <h2>Health BFF</h2>
              <p>Ultima lectura: {health.generatedAt}</p>
            </div>
            <span className="adminBadge">no-store</span>
          </div>

          <div className="adminStatusList">
            {health.services.map((service) => (
              <div className="adminStatusRow" key={service.key}>
                <strong>{service.label}</strong>
                <span className={statusClasses[service.status]}>
                  {statusLabels[service.status]}
                </span>
                <span className="adminMuted">{service.message}</span>
              </div>
            ))}
          </div>
        </article>

        <aside className="adminCard">
          <h2>Base Admin</h2>
          <table className="adminTable">
            <tbody>
              <tr>
                <th scope="row">Organization</th>
                <td>{context.organizationId || "Pendiente"}</td>
              </tr>
              <tr>
                <th scope="row">Shop</th>
                <td>{context.shopId || "Pendiente"}</td>
              </tr>
              <tr>
                <th scope="row">Locale</th>
                <td>{context.locale}</td>
              </tr>
              <tr>
                <th scope="row">Country</th>
                <td>{context.country}</td>
              </tr>
              <tr>
                <th scope="row">Channel</th>
                <td>{context.channel}</td>
              </tr>
            </tbody>
          </table>

          <div className="adminEmptyState">
            Siguiente paso: conectar Organizations/Shops y Employees cuando el
            contrato BFF este confirmado.
          </div>
        </aside>
      </section>
    </main>
  );
}

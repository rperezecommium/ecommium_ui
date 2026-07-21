import Link from "next/link";
import { getAdminSecurityData } from "../../../../../src/modules/configuracion/admin-security";
import {
  logoutOtherAdminSessionsAction,
  revokeAdminDeviceSessionAction,
  verifyAdminStepUpAction,
} from "../../../../../src/modules/configuracion/admin-security-actions";

type SecurityPageProps = {
  searchParams?: Promise<{ error?: string; notice?: string }>;
};

function date(value: string | null) {
  return value ? new Date(value).toLocaleString() : "-";
}

export default async function SeguridadPage({ searchParams }: SecurityPageProps) {
  const [data, params] = await Promise.all([getAdminSecurityData(), searchParams]);
  const stepUpReady = data.stepUp?.status === "VERIFIED";

  return (
    <main className="adminPage">
      <div className="adminPageHeader">
        <div>
          <div className="adminBreadcrumb">Admin / Configuracion / Seguridad</div>
          <h1 className="adminPageTitle">Seguridad de tu cuenta</h1>
          <p className="adminPageIntro">
            Revisa dónde está abierta tu cuenta y confirma tu identidad antes de operaciones especialmente sensibles.
          </p>
        </div>
        <Link className="adminButton" href="/admin/configuracion">Volver a configuración</Link>
      </div>

      {params?.notice ? <div className="adminBanner">{params.notice}</div> : null}
      {params?.error ? <div className="adminBanner adminBannerError">{params.error}</div> : null}
      {data.errors.map((error) => <div className="adminBanner adminBannerError" key={error}>{error}</div>)}

      <section className="adminCard">
        <h2>Confirmación para acciones sensibles</h2>
        <p>
          {stepUpReady
            ? `Tu identidad se confirmó mediante ${data.stepUp?.method === "PASSWORD" ? "contraseña actual" : data.stepUp?.method} hasta ${date(data.stepUp?.expiresAt ?? null)}.`
            : "Antes de cambiar cuentas de empleado, permisos o credenciales sensibles, confirma que sigues siendo tú."}
        </p>
        {data.stepUp?.enforcement === "DISABLED" ? (
          <p className="adminMuted">La protección está en observación: todavía no bloquea operaciones existentes. Se activará por grupos durante el rollout.</p>
        ) : null}
        <form action={verifyAdminStepUpAction} className="adminInlineForm">
          <label>
            Contraseña actual
            <input autoComplete="current-password" name="currentPassword" required type="password" />
          </label>
          <button className="adminButton adminButtonPrimary" type="submit">Confirmar identidad</button>
        </form>
        <p className="adminMuted">La contraseña se valida en servidor y no se guarda. El contrato ya admite TOTP y passkeys para la siguiente evolución.</p>
      </section>

      <section className="adminCard">
        <div className="adminSectionHeading">
          <div>
            <h2>Dispositivos con acceso</h2>
            <p>Si no reconoces uno, ciérralo. La sesión actual no se cerrará desde esta pantalla.</p>
          </div>
          <form action={logoutOtherAdminSessionsAction}>
            <button className="adminButton adminButtonDanger" type="submit">Cerrar todos los demás</button>
          </form>
        </div>
        {data.sessions.length === 0 ? <p className="adminMuted">No se pudo obtener la lista de dispositivos.</p> : (
          <div className="adminTableWrap">
            <table className="adminTable">
              <thead><tr><th>Dispositivo</th><th>Última actividad</th><th>Origen</th><th>Acción</th></tr></thead>
              <tbody>
                {data.sessions.map((session) => (
                  <tr key={session.sessionId}>
                    <td><strong>{session.device.deviceName || "Navegador sin nombre"}</strong><br /><span className="adminMuted">{session.device.userAgent || session.device.deviceId || "Identificador no disponible"}</span></td>
                    <td>{date(session.lastSeenAt)}<br /><span className="adminMuted">Abierta: {date(session.createdAt)}</span></td>
                    <td>{session.device.ipAddress || "IP no disponible"}</td>
                    <td>{session.isCurrent ? <span className="adminBadge adminBadgeOk">Sesión actual</span> : (
                      <form action={revokeAdminDeviceSessionAction}><input name="sessionId" type="hidden" value={session.sessionId} /><button className="adminButton adminButtonTiny adminButtonDanger" type="submit">Cerrar dispositivo</button></form>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

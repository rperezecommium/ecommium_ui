"use client";

import { useRouter } from "next/navigation";
import { AdminResourceDrawer } from "../../shared/ui/admin-resource-drawer";
import { changeOwnAdminPasswordAction } from "../auth/admin-credential-actions";
import { logoutOtherAdminSessionsAction, revokeAdminDeviceSessionAction, verifyAdminStepUpAction } from "./admin-security-actions";
import type { AdminSecurityData } from "./admin-security";

const securityPath = "/admin/configuracion/equipo?tab=security";
const date = (value: string | null) => value ? new Date(value).toLocaleString("es-ES") : "-";

export function AdminSecurityPanel({ data, drawer }: { data: AdminSecurityData; drawer?: "password" | "step-up" }) {
  const router = useRouter();
  return <>
    {data.errors.map(error => <div className="adminBanner adminBannerError" role="alert" key={error}>{error}</div>)}
    <div className="employeesToolbar securityAccountToolbar">
      <div><h2>Dispositivos con acceso</h2><p className="adminMuted">Revisa dónde está abierta tu cuenta. La sesión actual no se cerrará desde esta lista.</p></div>
      <div className="adminButtonRow">
        <button className="employeesTextAction" type="button" onClick={() => router.push(`${securityPath}&securityDrawer=password`, {scroll:false})}>Cambiar contraseña</button>
        <button className="employeesTextAction" type="button" onClick={() => router.push(`${securityPath}&securityDrawer=step-up`, {scroll:false})}>Confirmaciones para acciones sensibles</button>
      </div>
    </div>
    <div className="employeesListActions">
      <form action={logoutOtherAdminSessionsAction}>
        <button className="adminButton adminButtonTiny adminButtonDanger" disabled={!data.sessions.some(session => !session.isCurrent)} type="submit">Cerrar todos los demás</button>
      </form>
    </div>
    <div className="adminTableScroller">
      <table className="adminTable">
        <thead><tr><th>Dispositivo</th><th>Última actividad</th><th>Origen</th><th>Acción</th></tr></thead>
        <tbody>{data.sessions.length ? data.sessions.map(session => <tr key={session.sessionId}>
          <td><strong>{session.device.deviceName || "Navegador sin nombre"}</strong><div className="adminMuted">{session.device.userAgent || session.device.deviceId || "Identificador no disponible"}</div></td>
          <td>{date(session.lastSeenAt)}<div className="adminMuted">Abierta: {date(session.createdAt)}</div></td>
          <td>{session.device.ipAddress || "IP no disponible"}</td>
          <td>{session.isCurrent ? <span className="adminBadge adminBadgeOk">Sesión actual</span> : <form action={revokeAdminDeviceSessionAction}><input type="hidden" name="sessionId" value={session.sessionId} /><button className="adminButton adminButtonTiny adminButtonDanger" type="submit">Cerrar dispositivo</button></form>}</td>
        </tr>) : <tr><td colSpan={4}>{data.errors.length ? "No se pudo obtener la lista de dispositivos." : "No hay dispositivos disponibles."}</td></tr>}</tbody>
      </table>
    </div>
    {drawer === "password" ? <AdminResourceDrawer drawerId="admin-security-panel-1" title="Cambiar contraseña" description="Confirma tu contraseña actual. El cambio cierra las demás sesiones activas; esta sesión puede continuar si el BFF lo permite." closeHref={securityPath}>
      <form action={changeOwnAdminPasswordAction} className="adminForm">
        <input type="hidden" name="returnTo" value="/admin/configuracion/seguridad" />
        <label className="adminField"><span>Contraseña actual</span><input name="currentPassword" type="password" autoComplete="current-password" required /></label>
        <label className="adminField"><span>Nueva contraseña</span><input name="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={256} required /></label>
        <label className="adminField"><span>Repite la nueva contraseña</span><input name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={256} required /></label>
        <button type="submit" className="adminButton adminButtonPrimary">Cambiar contraseña</button>
      </form>
    </AdminResourceDrawer> : null}
    {drawer === "step-up" ? <AdminResourceDrawer drawerId="admin-security-panel-2" title="Confirmaciones para acciones sensibles" description="Confirma tu identidad antes de modificar empleados, permisos o credenciales sensibles." closeHref={securityPath}>
      <p>{data.stepUp?.status === "VERIFIED" ? `Tu identidad está confirmada hasta ${date(data.stepUp.expiresAt)}.` : "Confirma que sigues siendo tú con tu contraseña actual."}</p>
      {data.stepUp?.enforcement === "DISABLED" ? <p className="adminMuted">La protección está en observación: todavía no bloquea operaciones existentes.</p> : null}
      <form action={verifyAdminStepUpAction} className="adminForm">
        <label className="adminField"><span>Contraseña actual</span><input name="currentPassword" type="password" autoComplete="current-password" required /></label>
        <button type="submit" className="adminButton adminButtonPrimary">Confirmar identidad</button>
      </form>
      <p className="adminMuted">La contraseña se valida en servidor y no se guarda.</p>
    </AdminResourceDrawer> : null}
  </>;
}

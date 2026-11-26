import styles from "./customer-commercial.module.css";
import { requestAdminBff } from "../../shared/bff/admin-client";
import { getAdminSession } from "../../shared/auth/session";
import type { AdminContext } from "../../shared/config/admin-context";
import { AdminMutationForm } from "../../shared/ui/admin-mutation-form";
import { parseCommercialPolicy } from "./customer-commercial-policy";
import { saveCommercialPolicyAction } from "./customer-commercial-policy-actions";
import type { Group } from "./customer-commercial-fields";
export async function CustomerCommercialPolicyPanel({context,groups}:{context:AdminContext;groups:Group[]}) {
  const session = await getAdminSession();
  const canWrite = session?.scope === "admin" && session.permissions.some(permission=>["*","admin:*","system.admin","customers.addresses.write"].includes(permission.trim().toLowerCase()));
  const result = await requestAdminBff(`/admin/customers/commercial-segment-policy?${new URLSearchParams({organizationId:context.organizationId,shopId:context.shopId})}`,{context,parse:parseCommercialPolicy});
  const policy = result.ok ? result.data.policy : null;
  const currentCodes = policy ? [policy.registeredGroup,policy.b2bGroup,...policy.allowedGroups].filter((code):code is string=>code !== null) : [];
  const options = [...groups,...[...new Set(currentCodes)].filter(code=>!groups.some(group=>group.code===code)).map(code=>({code,name:`${code} (inactivo o no disponible)`}))];
  return <section className={`pricingPanel ${styles.panel}`}><h2>Asignación comercial de clientes</h2><p>Organization: {context.organizationId} · Tienda: {context.shopName || context.shopAlias}</p>
    <p>Permite usar grupos asignados manualmente en el perfil. Sin grupo predeterminado, los clientes sin asignación conservan sus condiciones habituales.</p>
    {!result.ok || !policy ? <p>No se ha podido cargar la política de segmentación comercial.</p> : canWrite ? <AdminMutationForm resetOnSuccess={false} action={saveCommercialPolicyAction} label="Política de segmentación comercial" className="adminFormGrid">
      <input type="hidden" name="revision" value={result.data.revision} />
      <fieldset className="adminFieldset"><legend>Grupos permitidos</legend>{options.map(group=><label key={group.code}><input type="checkbox" name="allowedGroups" value={group.code} defaultChecked={policy.allowedGroups.includes(group.code)} /> {group.name} ({group.code})</label>)}</fieldset>
      <label className="adminField"><span>Grupo predeterminado de registrados</span><select name="registeredGroup" defaultValue={policy.registeredGroup ?? ""}><option value="">Sin grupo predeterminado</option>{options.map(group=><option key={group.code} value={group.code}>{group.name}</option>)}</select></label>
      <label className="adminField"><span>Grupo que requiere aprobación B2B</span><select name="b2bGroup" defaultValue={policy.b2bGroup ?? ""}><option value="">Sin grupo B2B</option>{options.map(group=><option key={group.code} value={group.code}>{group.name}</option>)}</select></label>
      <p>El grupo B2B exige tipo Empresa y aprobación explícita. Esta configuración no asigna grupos a clientes ni modifica reglas de precios.</p>
      <button type="submit" className="adminButton adminButtonPrimary">Guardar política comercial</button>
    </AdminMutationForm> : <p>Grupos permitidos: {policy.allowedGroups.join(", ") || "ninguno"}. Consulta de solo lectura.</p>}
  </section>;
}

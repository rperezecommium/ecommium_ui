"use server";
import { revalidatePath } from "next/cache";
import { requestAdminBff } from "../../shared/bff/admin-client";
import { getAdminSession } from "../../shared/auth/session";
import { getAdminContext } from "../../shared/config/admin-context";
import type { AdminFormState } from "../../shared/validation/admin-form-state";
import { parseCommercialPolicy } from "./customer-commercial-policy";

export async function saveCommercialPolicyAction(_state:AdminFormState,form:FormData):Promise<AdminFormState> {
  const session = await getAdminSession();
  if (!session?.employeeId || session.scope !== "admin" || !session.permissions.some(permission=>["*","admin:*","system.admin","customers.addresses.write"].includes(permission.trim().toLowerCase()))) return {error:"Falta permiso customers.addresses.write."};
  let snapshot;
  try {
    const revision = form.get("revision");
    if (typeof revision !== "string" || !/^\d+$/.test(revision)) throw new Error("Revisión inválida");
    snapshot = parseCommercialPolicy({revision:Number(revision),policy:{allowedGroups:form.getAll("allowedGroups"),registeredGroup:form.get("registeredGroup") || null,b2bGroup:form.get("b2bGroup") || null}});
  } catch { return {error:"Revisa los grupos permitidos y la revisión. El grupo B2B no puede ser el predeterminado de registrados."}; }
  const context = await getAdminContext();
  const result = await requestAdminBff(`/admin/customers/commercial-segment-policy?${new URLSearchParams({organizationId:context.organizationId,shopId:context.shopId})}`,{context,parse:parseCommercialPolicy,init:{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({policy:snapshot.policy,expectedRevision:snapshot.revision,reason:"Configuración manual de segmentación comercial desde Admin"})}});
  if (!result.ok) return {error:result.status === 409 ? "La política ha cambiado. Recarga para consultar su revisión actual." : "No se ha podido confirmar la política comercial. Consulta su estado antes de reintentar."};
  revalidatePath("/admin/configuracion/precios");
  return {success:"Política comercial guardada."};
}

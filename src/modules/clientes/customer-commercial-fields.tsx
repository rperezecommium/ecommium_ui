import styles from "./customer-commercial.module.css";
import type { AdminContext } from "../../shared/config/admin-context";
import { CustomerCommercialEditor, CustomerCommercialReloadButton } from "./customer-commercial-editor";
import { requestAdminBff } from "../../shared/bff/admin-client";

export type Group = { code: string; name: string };
export type Membership = { groupCode: string | null; b2bApproved: boolean; revision: number; buyerType: "PRIVATE_BUYER" | "BUSINESS_BUYER" };
export function parseCommercialGroups(value: unknown): Group[] {
  if (!value || typeof value !== "object") throw new Error("Respuesta de grupos inválida");
  const data = value as Record<string, unknown>;
  const items = data.items ?? data.customerGroups;
  if (!Array.isArray(items)) throw new Error("Respuesta de grupos inválida");
  return items.map((item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Grupo inválido");
    const record = item as Record<string, unknown>;
    if (typeof record.active !== "boolean") throw new Error("Estado de grupo inválido");
    return record;
  }).filter(item => item.active === true).map((item) => {
    if (typeof item.code !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(item.code) || typeof item.name !== "string") throw new Error("Grupo inválido");
    return { code: item.code, name: item.name };
  });
}
export function invalidMembershipFields(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["respuesta"];
  const data = value as Record<string,unknown>;
  const invalid: string[] = [];
  if (data.groupCode !== null && (typeof data.groupCode !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(data.groupCode))) invalid.push("groupCode");
  if (data.buyerType !== "PRIVATE_BUYER" && data.buyerType !== "BUSINESS_BUYER") invalid.push("buyerType");
  if (typeof data.b2bApproved !== "boolean") invalid.push("b2bApproved");
  if (typeof data.revision !== "number" || !Number.isSafeInteger(data.revision) || data.revision < 0) invalid.push("revision");
  return invalid;
}
export function parseCommercialMembership(value: unknown): Membership {
  if (invalidMembershipFields(value).length) throw new Error("Respuesta de grupo inválida");
  const data = value as Membership;
  return { groupCode: data.groupCode, b2bApproved: data.b2bApproved, revision: data.revision, buyerType: data.buyerType };
}
function BuyerTypeField({ value }: { value?: string }) {
  return <label className="adminField"><span>Tipo comprador</span><select aria-label="Tipo comprador" name="buyerType" defaultValue={value === "BUSINESS_BUYER" ? "BUSINESS_BUYER" : "PRIVATE_BUYER"}><option value="PRIVATE_BUYER">Particular</option><option value="BUSINESS_BUYER">Empresa</option></select></label>;
}
export function commercialReadFailure(status?: number) {
  if (status === 401) return "La sesión no permite consultar esta información. Recarga para renovar la sesión.";
  if (status === 403) return "Tu sesión no tiene permiso para consultar esta información.";
  if (status === 404) return "El recurso comercial no está disponible en el BFF de este entorno.";
  if (status !== undefined && status >= 200 && status < 300) return "El BFF devolvió una respuesta incompatible con el contrato comercial.";
  if (status === 409) return "La información comercial presenta un conflicto.";
  if (status === 429) return "Se ha alcanzado el límite de consultas. Inténtalo de nuevo más tarde.";
  return "El servicio comercial no está disponible. Inténtalo de nuevo más tarde.";
}

export async function CustomerCommercialFields({ context, customerId, buyerType, readOnly = false }: { context: AdminContext; customerId?: string; buyerType?: string; readOnly?: boolean }) {
  const query = new URLSearchParams({ organizationId: context.organizationId, shopId: context.shopId });
  const groupsEndpoint = `/admin/pricing/customer-groups?${query}&includeInactive=false`;
  const membershipEndpoint = customerId ? `/admin/customers/${encodeURIComponent(customerId)}/commercial-membership?${query}` : undefined;
  let invalidFields: string[] = [];

  const [groups, membership] = await Promise.all([
    requestAdminBff(groupsEndpoint, { context, parse: parseCommercialGroups }),
    membershipEndpoint ? requestAdminBff(membershipEndpoint, { context, parse: value => { invalidFields = invalidMembershipFields(value); return parseCommercialMembership(value); } }) : Promise.resolve({ ok: true as const, data: { groupCode: null, b2bApproved: false, revision: 0, buyerType: "PRIVATE_BUYER" as const } }),
  ]);
  return <fieldset className={`adminFieldset customerProfileFieldset ${styles.panel}`}>
    <legend>Condiciones comerciales</legend>
    <div className="customerProfileFields">
      {!groups.ok || !membership.ok ? <>
        {readOnly ? <p>Tipo comprador: {(membership.ok ? membership.data.buyerType : buyerType) === "BUSINESS_BUYER" ? "Empresa" : "Particular"}</p> : <BuyerTypeField value={membership.ok ? membership.data.buyerType : buyerType} />}
        <div className="adminNotice" role="status">
          <p>No se ha podido cargar el grupo comercial. No se modificará al guardar el resto del perfil.</p>
          {[{ label: "Grupos disponibles", endpoint: groupsEndpoint, result: groups }, { label: "Asignación del cliente", endpoint: membershipEndpoint, result: membership }].map(({label, endpoint, result}) => !result.ok ? <div key={label}>
            <p>{label}: {commercialReadFailure(result.status)}</p>
            <details><summary>Detalles de diagnóstico</summary><p>GET {endpoint}</p><p>Estado: {result.status ?? "sin respuesta"}</p>{endpoint === membershipEndpoint && invalidFields.length ? <p>Campos incompatibles: {invalidFields.join(", ")}</p> : null}</details>
          </div> : null)}
          <CustomerCommercialReloadButton />
        </div>
      </> : <CustomerCommercialEditor key={`${customerId ?? "new"}:${membership.data.revision}`} groups={groups.data} current={membership.data} readOnly={readOnly} />}
    </div>
  </fieldset>;
}

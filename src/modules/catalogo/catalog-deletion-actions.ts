"use server";
import { getCurrentAdminSession } from "../auth/current-admin-session";
import { getAdminContext } from "../../shared/config/admin-context";
import { requestAdminBff } from "../../shared/bff/admin-client";
import {
  catalogDeletionId,
  parseCatalogDeletionOperation,
  parseCatalogDeletionReview,
  validCatalogDeletionTarget,
  type CatalogDeletionTarget,
  type CatalogDeletionContext,
} from "./catalog-deletion-contract";
async function authorizedContext(t: CatalogDeletionContext) {
  if (
    !t ||
    !catalogDeletionId(t.organizationId) ||
    !catalogDeletionId(t.shopId)
  )
    return null;
  const session = await getCurrentAdminSession();
  if (
    !session?.permissions.some((p) =>
      ["*", "system.admin", "catalog.products.delete"].includes(p),
    )
  )
    return null;
  const c = await getAdminContext();
  return c.organizationId === t.organizationId &&
    c.shopId === t.shopId &&
    c.locale === t.locale
    ? c
    : null;
}
async function authorized(t: CatalogDeletionTarget) {
  return validCatalogDeletionTarget(t) ? authorizedContext(t) : null;
}
const query = (t: CatalogDeletionContext) =>
  new URLSearchParams({
    organizationId: t.organizationId,
    shopId: t.shopId,
    locale: t.locale,
  }).toString();
const targetPath = (t: CatalogDeletionTarget) =>
  `/admin/products/${encodeURIComponent(t.productId)}${t.variantId ? `/variants/${encodeURIComponent(t.variantId)}` : ""}`;
export async function loadCatalogDeletionReview(t: CatalogDeletionTarget) {
  const c = await authorized(t);
  if (!c)
    return {
      ok: false as const,
      error: "No tienes permiso para eliminar o el contexto ha cambiado.",
    };
  const capability = await requestAdminBff(
    `/admin/catalog-retirements/capability?${query(t)}`,
    {
      context: c,
      parse: (v) =>
        Boolean(
          v &&
          typeof v === "object" &&
          (v as { available?: unknown }).available === true,
        ),
    },
  );
  if (!capability.ok || !capability.data)
    return {
      ok: false as const,
      error:
        "La eliminación coordinada no está disponible. No se ha eliminado ningún dato.",
    };
  const r = await requestAdminBff(
    `${targetPath(t)}/deletion-preview?${query(t)}`,
    {
      context: c,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      },
      parse: (v) => parseCatalogDeletionReview(v, t),
    },
  );
  return r.ok
    ? { ok: true as const, review: r.data }
    : {
        ok: false as const,
        error:
          "No se pudo revisar el impacto. No se ha iniciado la eliminación.",
        reference: r.correlationId,
      };
}
export async function confirmCatalogDeletion(
  t: CatalogDeletionTarget,
  input: {
    reviewId: string;
    version: string;
    confirmationRefId: string;
    idempotencyKey: string;
  },
) {
  const c = await authorized(t);
  if (
    !c ||
    !input ||
    !catalogDeletionId(input.reviewId) ||
    !/^[0-9a-f]{64}$/.test(input.version) ||
    typeof input.confirmationRefId !== "string" ||
    !input.confirmationRefId ||
    input.confirmationRefId.length > 255 ||
    !/^[a-zA-Z0-9_-]{16,100}$/.test(input.idempotencyKey)
  )
    return {
      ok: false as const,
      error: "La confirmación o el contexto no son válidos.",
    };
  const r = await requestAdminBff(
    `${targetPath(t)}/deletion-operations?${query(t)}`,
    {
      context: c,
      init: {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": input.idempotencyKey,
        },
        body: JSON.stringify({
          reviewId: input.reviewId,
          version: input.version,
          confirmationRefId: input.confirmationRefId,
        }),
      },
      parse: (v) => parseCatalogDeletionOperation(v, t),
    },
  );
  return r.ok
    ? { ok: true as const, operation: r.data }
    : {
        ok: false as const,
        rejected: [400, 401, 403, 404, 409].includes(r.status ?? 0),
        error:
          r.status === 409
            ? "La revisión ha cambiado o existe una operación en curso. Revisa el impacto o recupera la operación anterior."
            : "No se pudo confirmar el resultado. Recupera la misma operación antes de iniciar otra.",
        reference: r.correlationId,
      };
}
export async function readCatalogDeletion(
  t: CatalogDeletionTarget,
  operationId: string,
) {
  const c = await authorized(t);
  if (!c || !catalogDeletionId(operationId))
    return { ok: false as const, error: "Operación o contexto no válidos." };
  const r = await requestAdminBff(
    `/admin/catalog-retirements/${operationId}?${query(t)}`,
    {
      context: c,
      parse: (v) => parseCatalogDeletionOperation(v, t, operationId),
    },
  );
  return r.ok
    ? { ok: true as const, operation: r.data }
    : {
        ok: false as const,
        error: "No se pudo recuperar el estado de la eliminación.",
        reference: r.correlationId,
      };
}
export async function advanceCatalogDeletion(
  t: CatalogDeletionTarget,
  operationId: string,
) {
  const c = await authorized(t);
  if (!c || !catalogDeletionId(operationId))
    return { ok: false as const, error: "Operación o contexto no válidos." };
  const r = await requestAdminBff(
    `/admin/catalog-retirements/${operationId}/retry?${query(t)}`,
    {
      context: c,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      },
      parse: (v) => parseCatalogDeletionOperation(v, t, operationId),
    },
  );
  return r.ok
    ? { ok: true as const, operation: r.data }
    : {
        ok: false as const,
        error:
          "La eliminación sigue pendiente. Puedes consultar o reintentar la misma operación.",
        reference: r.correlationId,
      };
}

export async function listCatalogDeletionOperations(context:CatalogDeletionContext,offset=0){
 const c=await authorizedContext(context);if(!c||!Number.isSafeInteger(offset)||offset<0||offset>1000000)return {ok:false as const,items:[],total:0,limit:25,offset};
 const r=await requestAdminBff(`/admin/catalog-retirements?${query(context)}&limit=25&offset=${offset}`,{context:c,parse:v=>{
  if(!v||typeof v!=='object'||Array.isArray(v))throw Error('DELETION_LIST_INVALID');const page=v as {items:unknown[];total:number;limit:number;offset:number};
  if(!Array.isArray(page.items)||page.items.length>25||!Number.isSafeInteger(page.total)||page.total<0||page.limit!==25||page.offset!==offset)throw Error('DELETION_LIST_INVALID');
  const items=page.items.map(item=>{const row=item as {target?:{productId?:string;variantId?:string|null;name?:string;refId?:string}};const target={...context,productId:row.target?.productId??'',...(row.target?.variantId?{variantId:row.target.variantId}:{})};if(!validCatalogDeletionTarget(target))throw Error('DELETION_LIST_INVALID');const operation=parseCatalogDeletionOperation(item,target);return {target,operationId:operation.operationId,name:row.target?.name||row.target?.refId||'Producto'};});
  return {items,total:page.total,limit:page.limit,offset:page.offset};
 }});
 return r.ok?{ok:true as const,...r.data}:{ok:false as const,items:[],total:0,limit:25,offset};
}

"use server";
import { getAdminContext, hasRequiredAdminContext } from "../../shared/config/admin-context";
import { requestAdminBff } from "../../shared/bff/admin-client";
import { resolveShopContextById, shopToContext } from "./organization-shop";
import { parseShopReadPreparation } from "./shop-read-preparation";

async function requestPreparation(retry?: boolean, target?: { organizationId: string; shopId: string }) {
  let context=await getAdminContext();
  if (target) {
    if (typeof target.organizationId !== "string" || typeof target.shopId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(target.organizationId) || !/^[A-Za-z0-9_-]{1,128}$/.test(target.shopId)) {
      return {ok:false as const,error:"Referencia de tienda no válida."};
    }
    const resolved = await resolveShopContextById(target.organizationId, target.shopId);
    if (!resolved.ok) return {ok:false as const,error:resolved.error};
    if (resolved.shop.id !== target.shopId || resolved.shop.organizationId !== target.organizationId || !resolved.shop.locale || !resolved.shop.currency || !resolved.shop.country) {
      return {ok:false as const,error:"No se pudo confirmar el contexto de la tienda."};
    }
    context=shopToContext(resolved.shop, context);
    context={...context, channel:"web"};
  }
  if(!hasRequiredAdminContext(context))return {ok:false as const,error:"Selecciona una tienda para consultar su preparación."};
  const channel=["admin","test","events-cert","benchmark"].includes(context.channel)?"web":context.channel||"web";
  const query=new URLSearchParams({organizationId:context.organizationId,locale:context.locale,currency:context.currency,country:context.country,channel});
  return requestAdminBff(`/admin/organizations-shops/shops/${encodeURIComponent(context.shopId)}/read-preparation?${query}`,{
    context,parse:value=>{const data=parseShopReadPreparation(value);if(data.organizationId!==context.organizationId||data.shopId!==context.shopId||data.context.locale!==context.locale||data.context.currency!==context.currency||data.context.country!==context.country||data.context.channel!==channel)throw Error("Contexto de preparación no válido.");return data;},
    ...(retry===undefined?{}:{init:{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({retry})}}),
  });
}
export async function getShopReadPreparationAction(target?: { organizationId: string; shopId: string }){return requestPreparation(undefined, target);}
export async function prepareShopReadsAction(target?: { organizationId: string; shopId: string }){return requestPreparation(true, target);}

"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentAdminSession } from "../auth/current-admin-session";
import { getAdminContext } from "../../shared/config/admin-context";
import { requestAdminBff } from "../../shared/bff/admin-client";
import type { AdminFormState } from "../../shared/validation/admin-form-state";
import { conditionalPricePayload } from "./pricing-conditional-price-schema";

export async function createConditionalPriceAction(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  const session = await getCurrentAdminSession();
  if (!session || session.scope !== "admin" || !session.permissions.some(p => ["*", "admin:*", "system.admin", "catalog.products.write"].includes(p))) {
    return { error: "No tienes permiso para crear precios de catálogo." };
  }
  let payload: ReturnType<typeof conditionalPricePayload>;
  try { payload = conditionalPricePayload(form); }
  catch (error) { return { error: error instanceof Error ? error.message : "Revisa los datos." }; }
  const context = await getAdminContext();
  const query = new URLSearchParams({ organizationId: context.organizationId, shopId: context.shopId });
  const result = await requestAdminBff(`/admin/prices?${query}`, {
    context, init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) },
    parse: value => {
      if (!value || typeof value !== "object") throw Error("Recibo inválido");
      const row = value as Record<string, unknown>;
      if (typeof row.pricingId !== "string" || !row.pricingId || row.productId !== payload.productId || row.priceTableId !== payload.priceTableId) throw Error("Recibo incompatible");
      return { pricingId: row.pricingId };
    },
  });
  if (!result.ok) return { error: "No se pudo confirmar la creación del precio. Revisa el listado antes de reintentar; tu borrador se conserva." };
  revalidatePath("/admin/configuracion/precios");
  redirect(`/admin/configuracion/precios?${new URLSearchParams({ tab: "rules", priceTableId: payload.priceTableId, pricingMessage: "Precio creado. Rules lo agrupa según sus condiciones; la actualización del listado puede tardar unos instantes." })}`);
}

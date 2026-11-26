"use server";

import { getAdminContext } from "../../shared/config/admin-context";
import { requestAdminBff } from "../../shared/bff/admin-client";
import { getCurrentAdminSession } from "../auth/current-admin-session";
import { parseProductWarehouses, parseWarehouseStock, warehouseCreatePayload } from "./product-warehouses";
import type { ProductLookupOption } from "./product-editor-types";

export async function createProductWarehouseAction(input: { name: string; dockId: string; countries: string }): Promise<{ ok: boolean; warehouse?: ProductLookupOption; message?: string }> {
  const session = await getCurrentAdminSession();
  if (!session?.permissions.some(permission => ["*", "admin:*", "system.admin", "shipping.logistics.write"].includes(permission))) return { ok: false, message: "No tienes permiso para administrar almacenes." };
  let payload;
  try { payload = warehouseCreatePayload(input); } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Datos inválidos." }; }
  const context = await getAdminContext();
  const query = new URLSearchParams({ organizationId: context.organizationId, shopId: context.shopId });
  const result = await requestAdminBff(`/admin/shipping/warehouses?${query}`, {
    context,
    init: { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) },
    parse: (value) => {
      const record = value as { warehouse?: unknown };
      return parseProductWarehouses({ warehouses: [record?.warehouse] })[0];
    },
  });
  return result.ok ? { ok: true, warehouse: result.data } : { ok: false, message: result.error };
}

export async function loadProductWarehouseStockAction(input: { variantId: string; warehouseId: string }) {
  if (!input.variantId.trim() || !input.warehouseId.trim()) return { ok: false as const, message: "Selecciona un almacén." };
  const context = await getAdminContext();
  const query = new URLSearchParams({ organizationId: context.organizationId, shopId: context.shopId, ...input });
  const result = await requestAdminBff(`/admin/inventory/stock-levels?${query}`, {
    context,
    parse: (value) => parseWarehouseStock(value, input.warehouseId),
  });
  return result.ok ? { ok: true as const, stock: result.data } : { ok: false as const, message: result.error };
}

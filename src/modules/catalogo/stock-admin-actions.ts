"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "../../shared/config/admin-context";
import { updateStockLevel } from "./stock-admin";

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function numberField(value: FormDataEntryValue | null) {
  const parsed = Number(text(value));
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function finish(productId: string, message: string): never {
  revalidatePath("/admin/catalogo/stock");
  const params = new URLSearchParams({ stockMessage: message });
  if (productId) {
    params.set("productId", productId);
  }
  redirect(`/admin/catalogo/stock?${params.toString()}`);
}

export async function updateStockLevelAction(formData: FormData) {
  const context = await getAdminContext();
  const productId = text(formData.get("productId"));
  const variantId = text(formData.get("variantId"));
  const warehouseId = text(formData.get("warehouseId")) || "main-warehouse";

  if (!variantId) {
    finish(productId, "Falta variantId para actualizar stock.");
  }

  const result = await updateStockLevel(context, {
    variantId,
    stock: {
      warehouseId,
      onHandQuantity: numberField(formData.get("onHandQuantity")),
      reservedQuantity: numberField(formData.get("reservedQuantity")),
      safetyStockQuantity: numberField(formData.get("safetyStockQuantity")),
    },
  });

  finish(productId, result.ok ? "Stock actualizado." : result.error);
}

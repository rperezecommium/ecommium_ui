"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "../../shared/config/admin-context";
import { softDeleteMediaCollection } from "./media-admin";

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function softDeleteMediaCollectionAction(formData: FormData) {
  const mediaCollectionId = text(formData.get("mediaCollectionId"));
  const confirmed = text(formData.get("confirmSoftDelete")) === "yes";

  if (!mediaCollectionId || !confirmed) {
    redirect("/admin/catalogo/media?mediaMessage=Confirma la baja segura de la coleccion.");
  }

  const context = await getAdminContext();
  const result = await softDeleteMediaCollection(context, mediaCollectionId);
  const message = result.ok ? "Coleccion media desactivada." : result.error;

  revalidatePath("/admin/catalogo/media");
  redirect(`/admin/catalogo/media?mediaMessage=${encodeURIComponent(message)}`);
}

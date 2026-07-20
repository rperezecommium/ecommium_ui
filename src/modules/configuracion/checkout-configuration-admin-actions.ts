"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "../../shared/config/admin-context";
import { getAdminSession } from "../../shared/auth/session";
import { can } from "../../shared/permissions/permissions";
import {
  patchCheckoutConfigurationAdminData,
  type CheckoutConfigurationPatch,
} from "./checkout-configuration-admin";
import { checkoutConfigurationPatchFromForm } from "./checkout-configuration-form";

function finish(notice: string): never {
  revalidatePath("/admin/configuracion/checkout");
  redirect(`/admin/configuracion/checkout?notice=${encodeURIComponent(notice)}`);
}

export async function updateCheckoutConfigurationAction(formData: FormData): Promise<never> {
  const session = await getAdminSession();
  if (!session || session.scope !== "admin" || !can(session, "admin:checkout:view")) {
    finish("No tienes permiso para modificar la configuración de Checkout.");
  }

  const context = await getAdminContext();
  let patch: CheckoutConfigurationPatch;

  try {
    patch = checkoutConfigurationPatchFromForm(formData, context);
  } catch (error) {
    finish(error instanceof Error ? error.message : "No se pudo validar la configuración de Checkout.");
  }

  if (!patch.isActive && formData.get("confirmDeactivate") !== "DESACTIVAR CHECKOUT") {
    finish("Para desactivar Checkout escribe DESACTIVAR CHECKOUT y vuelve a guardar.");
  }

  const result = await patchCheckoutConfigurationAdminData(context, patch);

  if (!result.ok) {
    finish(result.status === 403 ? "Falta permiso checkout.configuration.write." : result.error);
  }

  finish(
    `Configuración de Checkout guardada. Versión ${result.data.configuration.version}.`,
  );
}

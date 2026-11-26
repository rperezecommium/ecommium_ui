"use server";
import { getCurrentAdminSession } from "../auth/current-admin-session";
import { getAdminContext } from "../../shared/config/admin-context";
import { commandIndependentModule, getIndependentModule } from "./cms-independent-modules";
import { waitForCmsReceiptVisibility } from "./cms-receipt-visibility";
import type {
  CmsModuleCommand,
  CmsModuleReceipt,
} from "./cms-independent-module-types";
export async function saveIndependentModuleAction(
  operation: "create" | "update" | "archive",
  id: string | undefined,
  body: CmsModuleCommand,
  expectedContext: { organizationId: string; shopId: string },
): Promise<
  | { ok: true; receipt: CmsModuleReceipt; readReady:boolean }
  | { ok: false; message: string; status?: number }
> {
  const session = await getCurrentAdminSession();
  if (
    !session ||
    session.scope !== "admin" ||
    !session.permissions.some((p) =>
      ["*", "admin:*", "system.admin", "cms.pages.write"].includes(p),
    )
  )
    return {
      ok: false,
      status: 403,
      message: "No tienes permiso para modificar módulos.",
    };
  const context = await getAdminContext();
  if (
    context.organizationId !== expectedContext.organizationId ||
    context.shopId !== expectedContext.shopId
  )
    return {
      ok: false,
      status: 409,
      message:
        "El contexto ha cambiado. Conserva tus cambios y vuelve a abrir el módulo en su tienda.",
    };
  if (!["create", "update", "archive"].includes(operation))
    return { ok: false, status: 400, message: "Operación no válida." };
  try {
    const result = await commandIndependentModule(context, operation, id, body);
    return result.ok
      ? { ok: true, receipt: result.data, readReady:await waitForCmsReceiptVisibility(()=>getIndependentModule(context,result.data.resourceId),result.data.revisionToken) }
      : { ok: false, message: result.error, status: result.status };
  } catch (error) {
    return {
      ok: false,
      status: 400,
      message:
        error instanceof Error
          ? error.message
          : "No se pudo validar el módulo.",
    };
  }
}

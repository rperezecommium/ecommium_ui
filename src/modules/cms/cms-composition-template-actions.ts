"use server";
import { getCurrentAdminSession } from "../auth/current-admin-session";
import { getAdminContext } from "../../shared/config/admin-context";
import { commandCompositionTemplate, getCompositionTemplate } from "./cms-composition-templates";
import { waitForCmsReceiptVisibility } from "./cms-receipt-visibility";
import type {
  CmsTemplateCommand,
  CmsTemplateReceipt,
} from "./cms-composition-template-types";
export async function saveCompositionTemplateAction(
  operation: "create" | "update" | "archive",
  id: string | undefined,
  body: CmsTemplateCommand,
  expectedContext: { organizationId: string; shopId: string; locale: string },
): Promise<
  | { ok: true; receipt: CmsTemplateReceipt; readReady:boolean }
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
      message: "No tienes permiso para modificar plantillas.",
    };
  const context = await getAdminContext();
  if (
    context.organizationId !== expectedContext.organizationId ||
    context.shopId !== expectedContext.shopId ||
    context.locale !== expectedContext.locale
  )
    return {
      ok: false,
      status: 409,
      message:
        "El contexto ha cambiado. Conserva tus cambios y vuelve a abrir la plantilla en su tienda.",
    };
  if (!["create", "update", "archive"].includes(operation))
    return { ok: false, status: 400, message: "Operación no válida." };
  try {
    const result = await commandCompositionTemplate(
      context,
      operation,
      id,
      body,
    );
    return result.ok
      ? { ok: true, receipt: result.data, readReady:await waitForCmsReceiptVisibility(()=>getCompositionTemplate(context,result.data.resourceId),result.data.revisionToken) }
      : { ok: false, message: result.error, status: result.status };
  } catch (error) {
    return {
      ok: false,
      status: 400,
      message:
        error instanceof Error
          ? error.message
          : "No se pudo validar la plantilla.",
    };
  }
}

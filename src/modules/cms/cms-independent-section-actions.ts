"use server";
import { getCurrentAdminSession } from "../auth/current-admin-session";
import { getAdminContext } from "../../shared/config/admin-context";
import { commandIndependentSection, getIndependentSection } from "./cms-independent-sections";
import { waitForCmsReceiptVisibility } from "./cms-receipt-visibility";
import type {
  CmsSectionCommand,
  CmsSectionReceipt,
} from "./cms-independent-section-types";
export async function saveIndependentSectionAction(
  operation: "create" | "update",
  id: string | undefined,
  body: CmsSectionCommand,
  expectedContext: { organizationId: string; shopId: string; locale: string },
): Promise<
  | { ok: true; receipt: CmsSectionReceipt; readReady:boolean }
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
      message: "No tienes permiso para modificar secciones.",
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
        "El contexto ha cambiado. Conserva tus cambios y vuelve a abrir el sección en su tienda.",
    };
  if (!["create", "update"].includes(operation))
    return { ok: false, status: 400, message: "Operación no válida." };
  try {
    const result = await commandIndependentSection(
      context,
      operation,
      id,
      body,
    );
    return result.ok
      ? { ok: true, receipt: result.data, readReady:await waitForCmsReceiptVisibility(()=>getIndependentSection(context,result.data.resourceId),result.data.revisionToken) }
      : { ok: false, message: result.error, status: result.status };
  } catch (error) {
    return {
      ok: false,
      status: 400,
      message:
        error instanceof Error
          ? error.message
          : "No se pudo validar el sección.",
    };
  }
}

export async function loadSectionModulesAction(
  expectedContext: { organizationId: string; shopId: string; locale: string },
  offset: number,
) {
  const session = await getCurrentAdminSession(),
    context = await getAdminContext();
  if (
    session?.scope !== "admin" ||
    !session.permissions.some((p) =>
      [
        "*",
        "admin:*",
        "system.admin",
        "cms.pages.read",
        "cms.pages.write",
      ].includes(p),
    )
  )
    return {
      ok: false as const,
      message: "No tienes permiso para leer módulos.",
    };
  if (
    context.organizationId !== expectedContext.organizationId ||
    context.shopId !== expectedContext.shopId ||
    context.locale !== expectedContext.locale
  )
    return { ok: false as const, message: "El contexto ha cambiado." };
  if (!Number.isSafeInteger(offset) || offset < 0)
    return { ok: false as const, message: "Página no válida." };
  const { listIndependentModules } = await import("./cms-independent-modules");
  const result = await listIndependentModules(context, "DRAFT", offset);
  return result.ok
    ? { ok: true as const, data: result.data }
    : { ok: false as const, message: result.error };
}

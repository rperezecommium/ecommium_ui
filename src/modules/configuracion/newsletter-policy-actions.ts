"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "../../shared/auth/session";
import { getAdminContext } from "../../shared/config/admin-context";
import { can } from "../../shared/permissions/permissions";
import { requestAdminBff } from "../../shared/bff/admin-client";
import {
  newsletterPolicyQuery,
  parseNewsletterPolicy,
} from "./newsletter-policy-admin";
const route = "/admin/configuracion/consent/newsletter";
function finish(message: string): never {
  revalidatePath(route);
  redirect(route + "?notice=" + encodeURIComponent(message));
}
export async function publishNewsletterPolicy(form: FormData): Promise<never> {
  const session = await getAdminSession();
  if (
    !session ||
    session.scope !== "admin" ||
    !can(session, "admin:consent:write") ||
    !can(session, "admin:consent:publish")
  )
    finish("Faltan permisos para publicar el consentimiento comercial.");
  const context = await getAdminContext(),
    text = String(form.get("text") ?? "").trim(),
    privacyPath = String(form.get("privacyPath") ?? "").trim();
  if (
    form.get("confirm") !== "PUBLICAR" ||
    text.length < 20 ||
    text.length > 2000 ||
    /[<>\u0000-\u001f]/.test(text) ||
    privacyPath.startsWith("//") ||
    !/^\/[a-zA-Z0-9\/_-]+$/.test(privacyPath)
  )
    finish("Revisa el texto, el enlace y escribe PUBLICAR.");
  const r = await requestAdminBff(
    "/admin/consent/commercial/policies?" + newsletterPolicyQuery(context),
    {
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale: context.locale, text, privacyPath }),
      },
      parse: parseNewsletterPolicy,
    },
  );
  if (!r.ok) finish("No se pudo publicar el consentimiento comercial.");
  finish(
    "Consentimiento comercial publicado. Las nuevas altas usarán esta versión.",
  );
}

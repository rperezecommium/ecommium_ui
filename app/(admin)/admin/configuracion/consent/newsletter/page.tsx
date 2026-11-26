import Link from "next/link";
import { getCurrentAdminSession as getAdminSession } from "../../../../../../src/modules/auth/current-admin-session";
import { getAdminContext } from "../../../../../../src/shared/config/admin-context";
import { can } from "../../../../../../src/shared/permissions/permissions";
import { readNewsletterPolicy } from "../../../../../../src/modules/configuracion/newsletter-policy-admin";
import { publishNewsletterPolicy } from "../../../../../../src/modules/configuracion/newsletter-policy-actions";
export default async function NewsletterPolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const session = await getAdminSession();
  if (
    !session ||
    session.scope !== "admin" ||
    !can(session, "admin:consent:view")
  )
    return (
      <main className="adminPage">
        <p>No tienes acceso al consentimiento comercial.</p>
      </main>
    );
  const context = await getAdminContext(),
    result = await readNewsletterPolicy(context),
    params = await searchParams;
  const editable =
    can(session, "admin:consent:write") &&
    can(session, "admin:consent:publish");
  return (
    <main className="adminPage">
      <div className="adminBreadcrumb">
        <Link href="/admin/configuracion/consent">Admin / Consentimiento</Link>{" "}
        / Newsletter
      </div>
      <h1>Consentimiento del newsletter</h1>
      <p>
        {context.shopName} · {context.locale}
      </p>
      {params.notice && <p role="status">{params.notice}</p>}
      <p>
        El texto publicado aparecerá junto a la casilla del formulario. Cada
        publicación crea una versión; cambiarla requiere renovar el
        consentimiento.
      </p>
      {!result.ok && (
        <p role="status">
          Todavía no se puede leer una política comercial publicada.
        </p>
      )}
      <form action={publishNewsletterPolicy} className="adminPanel">
        <label>
          Texto del consentimiento
          <textarea
            name="text"
            required
            minLength={20}
            maxLength={2000}
            rows={5}
            defaultValue={result.ok ? result.data.text : ""}
            disabled={!editable}
          />
        </label>
        <label>
          Ruta de la política de privacidad
          <input
            name="privacyPath"
            required
            pattern="/[a-zA-Z0-9/_-]+"
            defaultValue={result.ok ? result.data.privacyPath : ""}
            placeholder="/privacidad"
            disabled={!editable}
          />
        </label>
        <p>
          Verifica que la página exista y describa el tratamiento de los datos
          de esta tienda.
        </p>
        <label>
          Escribe PUBLICAR para crear una nueva versión
          <input
            name="confirm"
            required
            pattern="PUBLICAR"
            disabled={!editable}
          />
        </label>
        <button
          className="adminButton adminButtonPrimary"
          type="submit"
          disabled={!editable}
        >
          Publicar consentimiento
        </button>
      </form>
    </main>
  );
}

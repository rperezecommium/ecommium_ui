import { redirect } from "next/navigation";
import { changeOwnAdminPasswordAction } from "../../../../src/modules/auth/admin-credential-actions";
import { refreshAdminEmployeeSession } from "../../../../src/modules/auth/admin-session-actions";

type AdminPasswordPageProps = {
  searchParams?: Promise<{ error?: string; notice?: string }>;
};

export default async function AdminPasswordPage({ searchParams }: AdminPasswordPageProps) {
  const [session, params] = await Promise.all([refreshAdminEmployeeSession(), searchParams]);

  if (!session) {
    redirect("/auth/login?next=/admin/password");
  }

  if (session.credentialState !== "MUST_CHANGE_PASSWORD") {
    redirect("/admin/configuracion/seguridad");
  }

  return (
    <main className="loginPage">
      <section className="loginCard" aria-labelledby="admin-must-change-password-title">
        <p className="adminBreadcrumb">Admin / Seguridad / Contraseña obligatoria</p>
        <h1 id="admin-must-change-password-title">Crea tu contraseña</h1>
        <p className="adminHelpText">
          Tu credencial actual es temporal. No podrás acceder al resto del Admin
          hasta elegir una contraseña personal.
        </p>

        <form action={changeOwnAdminPasswordAction} className="adminForm">
          <input name="returnTo" type="hidden" value="/admin/password" />
          <label className="adminField">
            <span>Contraseña temporal actual</span>
            <input autoComplete="current-password" name="currentPassword" required type="password" />
          </label>
          <label className="adminField">
            <span>Nueva contraseña</span>
            <input autoComplete="new-password" maxLength={256} minLength={8} name="newPassword" required type="password" />
          </label>
          <label className="adminField">
            <span>Repite la nueva contraseña</span>
            <input autoComplete="new-password" maxLength={256} minLength={8} name="confirmation" required type="password" />
          </label>
          <button className="adminButton adminButtonPrimary" type="submit">
            Crear contraseña y continuar
          </button>
        </form>

        {params?.notice ? <div className="adminBanner" role="status">{params.notice}</div> : null}
        {params?.error ? <div className="adminBanner adminBannerError" role="alert">{params.error}</div> : null}
      </section>
    </main>
  );
}

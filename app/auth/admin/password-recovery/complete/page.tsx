import Link from "next/link";
import { completeAdminPasswordRecoveryAction } from "../../../../../src/modules/auth/admin-credential-actions";

type PasswordRecoveryCompletePageProps = {
  searchParams?: Promise<{ error?: string; notice?: string }>;
};

export default async function AdminPasswordRecoveryCompletePage({
  searchParams,
}: PasswordRecoveryCompletePageProps) {
  const params = await searchParams;

  return (
    <main className="loginPage">
      <section className="loginCard" aria-labelledby="admin-password-recovery-complete-title">
        <p className="adminBreadcrumb">Admin / Acceso / Crear contraseña</p>
        <h1 id="admin-password-recovery-complete-title">Crea una contraseña nueva</h1>
        <p className="adminHelpText">
          El enlace se retiró de la dirección antes de mostrar este formulario. Al
          terminar, tendrás que iniciar sesión de nuevo.
        </p>

        <form action={completeAdminPasswordRecoveryAction} className="adminForm">
          <label className="adminField">
            <span>Nueva contraseña</span>
            <input autoComplete="new-password" maxLength={256} minLength={8} name="newPassword" required type="password" />
          </label>
          <label className="adminField">
            <span>Repite la nueva contraseña</span>
            <input autoComplete="new-password" maxLength={256} minLength={8} name="confirmation" required type="password" />
          </label>
          <button className="adminButton adminButtonPrimary" type="submit">
            Guardar contraseña
          </button>
        </form>

        {params?.notice ? <div className="adminBanner" role="status">{params.notice}</div> : null}
        {params?.error ? <div className="adminBanner adminBannerError" role="alert">{params.error}</div> : null}

        <p className="adminHelpText">
          <Link href="/auth/admin/password-recovery">Solicitar un enlace nuevo</Link>
        </p>
      </section>
    </main>
  );
}

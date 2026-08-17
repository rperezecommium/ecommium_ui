import Link from "next/link";
import { requestAdminPasswordRecoveryAction } from "../../../../src/modules/auth/admin-credential-actions";
import { getAdminPasswordRecoveryAvailability } from "../../../../src/modules/auth/admin-password-recovery-availability";

type PasswordRecoveryPageProps = {
  searchParams?: Promise<{ error?: string; notice?: string }>;
};

export default async function AdminPasswordRecoveryPage({ searchParams }: PasswordRecoveryPageProps) {
  const params = await searchParams;
  const passwordRecoveryAvailable = await getAdminPasswordRecoveryAvailability();

  return (
    <main className="loginPage">
      <section className="loginCard" aria-labelledby="admin-password-recovery-title">
        <p className="adminBreadcrumb">Admin / Acceso / Recuperar contraseña</p>
        <h1 id="admin-password-recovery-title">Recupera el acceso a tu cuenta</h1>
        {passwordRecoveryAvailable ? (
          <>
            <p className="adminHelpText">
              Te enviaremos instrucciones solo si existe una cuenta de empleado elegible.
              Por seguridad, este formulario no confirma si un email está registrado.
            </p>

            <form action={requestAdminPasswordRecoveryAction} className="adminForm">
              <label className="adminField">
                <span>Email de empleado</span>
                <input autoComplete="email" name="email" required type="email" />
              </label>
              <button className="adminButton adminButtonPrimary" type="submit">
                Enviar instrucciones
              </button>
            </form>

            {params?.notice ? <div className="adminBanner" role="status">{params.notice}</div> : null}
            {params?.error ? <div className="adminBanner adminBannerError" role="alert">{params.error}</div> : null}
          </>
        ) : (
          <p className="adminHelpText">
            La recuperación de contraseña no está disponible en este momento.
          </p>
        )}

        <p className="adminHelpText">
          <Link href="/auth/login" style={{ display: "block", marginTop: 10 }}>
            Volver al acceso de empleado
          </Link>
        </p>
      </section>
    </main>
  );
}

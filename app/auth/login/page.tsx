import { redirect } from "next/navigation";
import Link from "next/link";
import { loginAdminEmployee } from "../../../src/modules/auth/admin-session-actions";
import { getAdminPasswordRecoveryAvailability } from "../../../src/modules/auth/admin-password-recovery-availability";
import { getAdminInstallationStatus } from "../../../src/modules/configuracion/admin-installation";

type LoginPageProps = {
  searchParams?: Promise<{
    authError?: string;
    authNotice?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = params?.next ?? "/admin";
  const installation = await getAdminInstallationStatus();
  const passwordRecoveryAvailable = await getAdminPasswordRecoveryAvailability();

  if (
    installation.ok &&
    ["NOT_INITIALIZED", "FRESH_CLAIM_REQUIRED", "FRESH_READY", "REVIEW_REQUIRED"].includes(installation.data.state)
  ) {
    redirect("/admin/installation");
  }

  return (
    <main className="loginPage">
      <section className="loginCard" aria-labelledby="login-title">
        <p className="adminBreadcrumb">Admin / Acceso</p>
        <h1 id="login-title">Acceso de empleado</h1>
        <p className="adminHelpText">
          La autenticacion real se valida contra el BFF en /auth/login y
          /auth/me. La UI guarda la sesion en cookie httpOnly y envia
          Authorization solo desde el servidor.
        </p>

        <form action={loginAdminEmployee} className="adminForm">
          <input type="hidden" name="next" value={nextPath} />
          <label className="adminField">
            <span>Email</span>
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <label className="adminField">
            <span>Password</span>
            <input type="password" name="password" autoComplete="current-password" required />
          </label>
          <button className="adminButton adminButtonPrimary" type="submit">
            Entrar con BFF Auth
          </button>
        </form>

        {passwordRecoveryAvailable ? (
          <p className="adminHelpText">
            <Link href="/auth/admin/password-recovery" style={{ display: "block", marginTop: 10 }}>
              ¿Olvidaste tu contraseña?
            </Link>
          </p>
        ) : null}

        {params?.authError ? (
          <div className="adminBanner adminBannerError" role="alert">{params.authError}</div>
        ) : null}

        {params?.authNotice ? (
          <div className="adminBanner">{params.authNotice}</div>
        ) : null}

      </section>
    </main>
  );
}

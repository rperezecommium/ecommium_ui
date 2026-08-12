import { loginAdminEmployee } from "../../../src/modules/auth/admin-session-actions";

type LoginPageProps = {
  searchParams?: Promise<{
    authError?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = params?.next ?? "/admin";

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

        {params?.authError ? (
          <div className="adminBanner adminBannerError">{params.authError}</div>
        ) : null}

      </section>
    </main>
  );
}

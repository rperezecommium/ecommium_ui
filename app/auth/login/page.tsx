import { redirect } from "next/navigation";
import { createDevSession, getAdminSession } from "../../../src/shared/auth/session";
import { loginAdminEmployee } from "../../../src/modules/auth/admin-session-actions";

type LoginPageProps = {
  searchParams?: Promise<{
    authError?: string;
    next?: string;
  }>;
};

async function startDevSession() {
  "use server";

  await createDevSession();
  redirect("/admin");
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const session = await getAdminSession();
  const nextPath = params?.next ?? "/admin";
  const devSessionEnabled = process.env.ECOMMIUM_ADMIN_DEV_SESSION === "1";

  if (session) {
    redirect(nextPath);
  }

  return (
    <main className="loginPage">
      <section className="loginCard" aria-labelledby="login-title">
        <p className="adminBreadcrumb">Admin / Acceso</p>
        <h1 id="login-title">Acceso de empleado</h1>
        <p className="adminHelpText">
          La autenticacion real debe resolverla el BFF de Sessions y emitir una
          cookie httpOnly. Esta pantalla deja preparado el punto de entrada sin
          crear un backend paralelo en Next.js.
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
            Entrar con BFF Sessions
          </button>
        </form>

        {params?.authError ? (
          <div className="adminBanner adminBannerError">{params.authError}</div>
        ) : null}

        {devSessionEnabled ? (
          <form action={startDevSession}>
            <button className="adminButton" type="submit">
              Crear sesion local de desarrollo
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}

import { redirect } from "next/navigation";
import { canUseDevAdminSession } from "../../../src/shared/auth/admin-bearer";
import { createDevSession } from "../../../src/shared/auth/session";
import { loginAdminEmployee } from "../../../src/modules/auth/admin-session-actions";

type LoginPageProps = {
  searchParams?: Promise<{
    authError?: string;
    next?: string;
  }>;
};

async function startDevSession() {
  "use server";

  const created = await createDevSession();

  if (!created) {
    redirect(`/auth/login?authError=${encodeURIComponent("La sesion local de desarrollo requiere ECOMMIUM_ADMIN_BFF_TOKEN server-side para llamar al BFF protegido.")}`);
  }

  redirect("/admin");
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = params?.next ?? "/admin";
  const devSessionRequested = process.env.ECOMMIUM_ADMIN_DEV_SESSION === "1";
  const devSessionEnabled = canUseDevAdminSession();

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

        {devSessionRequested && !devSessionEnabled ? (
          <div className="adminBanner">
            <strong>Sesion local deshabilitada.</strong>
            <p>
              <code>ECOMMIUM_ADMIN_DEV_SESSION=1</code> esta activo, pero falta
              <code> ECOMMIUM_ADMIN_BFF_TOKEN</code>. Sin bearer server-side la
              sesion local solo desbloquearia la UI y el BFF responderia 401.
            </p>
          </div>
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

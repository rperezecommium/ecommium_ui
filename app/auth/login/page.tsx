import { redirect } from "next/navigation";
import { createDevSession, getAdminSession } from "../../../src/shared/auth/session";

type LoginPageProps = {
  searchParams?: Promise<{
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

        <form className="adminForm">
          <label className="adminField">
            <span>Email</span>
            <input type="email" name="email" autoComplete="email" disabled />
          </label>
          <label className="adminField">
            <span>Password</span>
            <input type="password" name="password" autoComplete="current-password" disabled />
          </label>
          <button className="adminButton adminButtonPrimary" type="button" disabled>
            Entrar con BFF Sessions
          </button>
        </form>

        <div className="adminBanner">
          Falta confirmar el endpoint BFF de login/introspection para employees.
          Hasta entonces no se guarda ningun token en el navegador.
        </div>

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

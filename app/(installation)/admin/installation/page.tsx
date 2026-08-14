import Link from "next/link";
import { getAdminSession } from "../../../../src/shared/auth/session";
import {
  completeAdoptionAdminInstallationAction,
  completeFreshAdminInstallationAction,
} from "../../../../src/modules/configuracion/admin-installation-actions";
import {
  getAdminInstallationStatus,
  type AdminInstallationState,
} from "../../../../src/modules/configuracion/admin-installation";

type AdminInstallationPageProps = {
  searchParams?: Promise<{ error?: string; notice?: string }>;
};

const stateLabels: Record<AdminInstallationState, string> = {
  NOT_INITIALIZED: "Preflight pendiente",
  FRESH_CLAIM_REQUIRED: "Claim pendiente",
  FRESH_READY: "Alta inicial disponible",
  ADOPTION_REQUIRED: "Adopción requerida",
  REVIEW_REQUIRED: "Revisión operativa requerida",
  COMPLETED: "Instalación completada",
};

function FreshCompletionForm() {
  return (
    <form action={completeFreshAdminInstallationAction} className="adminForm">
      <div className="adminFormGrid">
        <label className="adminField">
          <span>Nombre</span>
          <input autoComplete="given-name" maxLength={100} name="firstName" />
        </label>
        <label className="adminField">
          <span>Apellidos</span>
          <input autoComplete="family-name" maxLength={100} name="lastName" />
        </label>
      </div>
      <label className="adminField">
        <span>Email de Admin 0</span>
        <input autoComplete="email" maxLength={320} name="email" required type="email" />
      </label>
      <label className="adminField">
        <span>Claim de instalación</span>
        <input autoComplete="off" maxLength={512} name="claim" required spellCheck={false} type="password" />
        <small>Se muestra una sola vez al emitirlo por CLI. La UI no lo guarda.</small>
      </label>
      <div className="adminFormGrid">
        <label className="adminField">
          <span>Contraseña</span>
          <input autoComplete="new-password" maxLength={256} minLength={8} name="password" required type="password" />
        </label>
        <label className="adminField">
          <span>Confirmar contraseña</span>
          <input autoComplete="new-password" maxLength={256} minLength={8} name="passwordConfirmation" required type="password" />
        </label>
      </div>
      <button className="adminButton adminButtonPrimary" type="submit">Crear Admin 0</button>
    </form>
  );
}

function AdoptionCompletionForm() {
  return (
    <form action={completeAdoptionAdminInstallationAction} className="adminForm">
      <label className="adminField">
        <span>Contraseña actual</span>
        <input autoComplete="current-password" maxLength={256} name="currentPassword" required type="password" />
      </label>
      <div className="adminFormGrid">
        <label className="adminField">
          <span>Nueva contraseña</span>
          <input autoComplete="new-password" maxLength={256} minLength={8} name="newPassword" required type="password" />
        </label>
        <label className="adminField">
          <span>Confirmar nueva contraseña</span>
          <input autoComplete="new-password" maxLength={256} minLength={8} name="passwordConfirmation" required type="password" />
        </label>
      </div>
      <div className="adminBanner adminBannerInfo">
        Al confirmar, el BFF cambiará la credencial y revocará todas las sesiones, incluida esta. Tendrás que iniciar sesión de nuevo.
      </div>
      <button className="adminButton adminButtonPrimary" type="submit">Adoptar Admin 0 y revocar sesiones</button>
    </form>
  );
}

export default async function AdminInstallationPage({ searchParams }: AdminInstallationPageProps) {
  const [result, params, session] = await Promise.all([
    getAdminInstallationStatus(),
    searchParams,
    getAdminSession(),
  ]);

  return (
    <main className="loginPage">
      <section className="loginCard adminInstallationCard" aria-labelledby="admin-installation-title">
        <p className="adminBreadcrumb">Admin / Instalación segura</p>
        <div className="adminPageHeader">
          <div>
            <h1 id="admin-installation-title">Instalación de Admin 0</h1>
            <p className="adminHelpText">
              Este flujo crea o adopta una sola cuenta SYSTEM. La primera Organization y tienda se configuran después desde el Admin normal.
            </p>
          </div>
          {result.ok ? <span className="adminBadge">{stateLabels[result.data.state]}</span> : null}
        </div>

        {params?.notice ? <div className="adminBanner">{params.notice}</div> : null}
        {params?.error ? <div className="adminBanner adminBannerError" role="alert">{params.error}</div> : null}

        {!result.ok ? (
          <div className="adminBanner adminBannerError" role="alert">
            No se pudo consultar el estado de instalación en StoreAdmin BFF. No se habilitó ningún flujo alternativo.
          </div>
        ) : null}

        {result.ok && result.data.state === "NOT_INITIALIZED" ? (
          <div className="adminEmptyState">
            <h2>Ejecuta primero el preflight</h2>
            <p>Un operador debe clasificar la base desde la CLI de Employees. La UI no crea estado ni selecciona candidatos.</p>
            <code>npm run admin-installation -- preflight</code>
          </div>
        ) : null}

        {result.ok && result.data.state === "FRESH_CLAIM_REQUIRED" ? (
          <div className="adminEmptyState">
            <h2>Emite un claim efímero</h2>
            <p>La instalación es fresh, pero todavía no hay un claim activo. Emítelo por CLI y vuelve a cargar esta pantalla.</p>
            <code>npm run admin-installation -- issue-claim</code>
          </div>
        ) : null}

        {result.ok && result.data.state === "FRESH_READY" ? (
          <section aria-labelledby="fresh-installation-title">
            <h2 id="fresh-installation-title">Crear el primer SuperAdmin SYSTEM</h2>
            <p>El claim es de un solo uso. Roles, permisos, IDs y tenant no son configurables desde este formulario.</p>
            <FreshCompletionForm />
          </section>
        ) : null}

        {result.ok && result.data.state === "ADOPTION_REQUIRED" ? (
          <section aria-labelledby="adoption-installation-title">
            <h2 id="adoption-installation-title">Adoptar el administrador existente</h2>
            <p>Inicia sesión con el candidato SYSTEM, confirma su contraseña actual y elige una credencial nueva.</p>
            {session ? (
              <AdoptionCompletionForm />
            ) : (
              <Link className="adminButton adminButtonPrimary" href="/auth/login?next=/admin/installation">
                Iniciar sesión para adoptar
              </Link>
            )}
          </section>
        ) : null}

        {result.ok && result.data.state === "REVIEW_REQUIRED" ? (
          <div className="adminEmptyState">
            <h2>Contacta con el operador de plataforma</h2>
            <p>Los datos existentes requieren revisión manual auditada. Esta pantalla no muestra candidatos, emails, IDs ni motivos internos.</p>
          </div>
        ) : null}

        {result.ok && result.data.state === "COMPLETED" ? (
          <div className="adminEmptyState">
            <h2>Admin 0 ya está instalado</h2>
            <p>El instalador quedó cerrado. La Organization y la tienda se gestionan como recursos normales y separados.</p>
            <Link className="adminButton adminButtonPrimary" href={session ? "/admin/configuracion/contexto" : "/auth/login?next=/admin"}>
              {session ? "Continuar al contexto Admin" : "Iniciar sesión"}
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}

import Link from "next/link";

export default function ConfiguracionPage() {
  return (
    <main className="adminPage">
      <div className="adminPageHeader">
        <div>
          <div className="adminBreadcrumb">Admin / Configuracion</div>
          <h1 className="adminPageTitle">Configuracion</h1>
          <p className="adminPageIntro">
            Base del backoffice para Organization, Shop, empleados, permisos,
            defaults regionales y health operativo.
          </p>
        </div>
      </div>

      <section className="adminCard">
        <h2>Configuracion operativa</h2>
        <p>
          El shell Admin, login, selector de contexto, permisos base y health
          general ya estan preparados. Desde aqui puedes operar contexto
          multistore y equipo de backoffice.
        </p>
        <div className="adminButtonRow">
          <Link className="adminButton adminButtonPrimary" href="/admin/configuracion/contexto">
            Abrir contexto multistore
          </Link>
          <Link className="adminButton" href="/admin/configuracion/equipo">
            Abrir equipo y permisos
          </Link>
        </div>
      </section>
    </main>
  );
}

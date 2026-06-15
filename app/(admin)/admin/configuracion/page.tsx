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
        <h2>Proceso 1 completado</h2>
        <p>
          El shell Admin, login, selector de contexto, permisos base y health
          general ya estan preparados. El siguiente proceso conectara
          Organizations/Shops y herencia de settings.
        </p>
        <div className="adminButtonRow">
          <Link className="adminButton adminButtonPrimary" href="/admin/configuracion/contexto">
            Abrir contexto multistore
          </Link>
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";
import type {
  SeoAdminData,
  SeoAdminResult,
  SeoAdminTab,
  SeoResolveResult,
  SeoRoute,
  SeoSitemapEntry,
} from "./seo-admin";
import {
  createSeoRedirectAction,
  createSeoRouteAction,
  patchSeoRouteAction,
} from "./seo-admin-actions";

type SeoAdminPageProps = {
  context: AdminContext;
  data: SeoAdminData;
  filters: {
    tab: SeoAdminTab;
    locale?: string;
    status?: string;
    entityType?: string;
    entityId?: string;
    path?: string;
    limit?: string;
    offset?: string;
    resolveRequested?: boolean;
    seoMessage?: string;
    drawer?: "create" | "edit";
    recordId?: string;
  };
};

const tabs: Array<{ id: SeoAdminTab; label: string }> = [
  { id: "summary", label: "Resumen" },
  { id: "routes", label: "Rutas" },
  { id: "redirects", label: "Redirecciones" },
  { id: "resolve", label: "Resolver" },
  { id: "sitemap", label: "Sitemap" },
];

function tabHref(tab: SeoAdminTab, filters: SeoAdminPageProps["filters"]) {
  const params = new URLSearchParams({ tab });
  if (filters.locale) {
    params.set("locale", filters.locale);
  }
  if (filters.status && tab !== "summary" && tab !== "resolve" && tab !== "sitemap") {
    params.set("status", filters.status);
  }

  return `/admin/configuracion/seo?${params.toString()}`;
}

function drawerHref(
  tab: SeoAdminTab,
  filters: SeoAdminPageProps["filters"],
  drawer: "create" | "edit",
  id?: string,
) {
  const params = new URLSearchParams({ tab, drawer });
  if (filters.locale) {
    params.set("locale", filters.locale);
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (id) {
    params.set("recordId", id);
  }

  return `/admin/configuracion/seo?${params.toString()}`;
}

function valueText(value: string | number | boolean | null | undefined) {
  if (typeof value === "boolean") {
    return value ? "Si" : "No";
  }
  if (value === null || typeof value === "undefined" || value === "") {
    return "-";
  }

  return String(value);
}

function boolFormValue(value: boolean | undefined, fallback = true) {
  return typeof value === "boolean" ? String(value) : String(fallback);
}

function DrawerField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="adminField">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ResultBanner<T>({ result }: { result: SeoAdminResult<T> }) {
  if (result.source === "bff") {
    return null;
  }

  return (
    <div className="adminBanner adminBannerError">
      <p>{result.message}</p>
      {result.failedEndpoint ? <p className="adminContextHint">{result.failedEndpoint}</p> : null}
    </div>
  );
}

function SeoDrawer({
  title,
  description,
  closeHref,
  children,
}: {
  title: string;
  description: string;
  closeHref: string;
  children: ReactNode;
}) {
  return (
    <div className="adminDrawerBackdrop">
      <aside className="adminSideDrawer" aria-label={title}>
        <div className="adminSideDrawerHeader">
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <Link className="adminButton adminButtonTiny" href={closeHref}>Cerrar</Link>
        </div>
        {children}
      </aside>
    </div>
  );
}

function SeoFilters({
  filters,
  context,
}: {
  filters: SeoAdminPageProps["filters"];
  context: AdminContext;
}) {
  if (filters.tab === "resolve" || filters.tab === "sitemap") {
    return null;
  }

  return (
    <form className="pricingFilterBar" action="/admin/configuracion/seo">
      <input type="hidden" name="tab" value={filters.tab} />
      <DrawerField label="Locale">
        <input name="locale" defaultValue={filters.locale ?? context.locale} placeholder="es-ES" />
      </DrawerField>
      <DrawerField label="Estado">
        <select name="status" defaultValue={filters.status ?? ""}>
          <option value="">Todos</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
      </DrawerField>
      {filters.tab === "routes" ? (
        <>
          <DrawerField label="Entity type">
            <select name="entityType" defaultValue={filters.entityType ?? ""}>
              <option value="">Todos</option>
              <option value="PRODUCT">PRODUCT</option>
              <option value="CATEGORY">CATEGORY</option>
              <option value="CMS_PAGE">CMS_PAGE</option>
            </select>
          </DrawerField>
          <DrawerField label="Entity ID">
            <input name="entityId" defaultValue={filters.entityId ?? ""} placeholder="product-123" />
          </DrawerField>
        </>
      ) : null}
      <button className="adminButton adminButtonPrimary" type="submit">Aplicar</button>
    </form>
  );
}

function RouteForm({
  record,
  context,
  locale,
}: {
  record?: SeoRoute;
  context: AdminContext;
  locale?: string;
}) {
  const isEditing = Boolean(record);
  const routeKind = record?.routeKind === "ALIAS" ? "ALIAS" : "CANONICAL";

  return (
    <form action={isEditing ? patchSeoRouteAction : createSeoRouteAction} className="pricingDenseForm">
      <input type="hidden" name="locale" value={locale ?? context.locale} />
      {record ? <input type="hidden" name="routeId" value={record.routeId} /> : null}
      {record ? <input type="hidden" name="routeKind" value={routeKind} /> : null}
      <DrawerField label="Path">
        <input name="path" defaultValue={record?.path ?? ""} placeholder="/producto-demo/p" title="Path SEO publicado" />
      </DrawerField>
      {!isEditing ? (
        <>
          <DrawerField label="Entity type">
            <select name="entityType" defaultValue={record?.entityType ?? "PRODUCT"} title="Tipo de entidad resuelta por Routing/SEO">
              <option value="PRODUCT">PRODUCT</option>
              <option value="CATEGORY">CATEGORY</option>
              <option value="CMS_PAGE">CMS_PAGE</option>
            </select>
          </DrawerField>
          <DrawerField label="Entity ID">
            <input name="entityId" defaultValue={record?.entityId ?? ""} placeholder="product-123" title="ID de la entidad owner" />
          </DrawerField>
          <DrawerField label="Tipo de ruta">
            <select name="routeKind" defaultValue={record?.routeKind ?? "CANONICAL"} title="CANONICAL o ALIAS">
              <option value="CANONICAL">CANONICAL</option>
              <option value="ALIAS">ALIAS</option>
            </select>
          </DrawerField>
        </>
      ) : null}
      {record?.canonicalRouteId ? (
        <DrawerField label="Canonical route ID">
          <output>{record.canonicalRouteId}</output>
        </DrawerField>
      ) : null}
      {routeKind === "ALIAS" ? (
        <input type="hidden" name="includeInSitemap" value="false" />
      ) : (
        <DrawerField label="Incluir en sitemap">
          <select name="includeInSitemap" defaultValue={boolFormValue(record?.includeInSitemap, true)} title="Controla si la ruta participa en sitemap">
            <option value="true">Si</option>
            <option value="false">No</option>
          </select>
        </DrawerField>
      )}
      {isEditing ? (
        <>
          <DrawerField label="Estado">
            <select name="status" defaultValue={record?.status ?? "ACTIVE"} title="Estado operativo de la ruta">
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </DrawerField>
          <DrawerField label="Redirect automatico">
            <select name="createRedirectFromPreviousPath" defaultValue="false" title="Crea redirect desde el path anterior al guardar">
              <option value="false">No</option>
              <option value="true">Si</option>
            </select>
          </DrawerField>
        </>
      ) : null}
      <button className="adminButton adminButtonPrimary" type="submit">{isEditing ? "Guardar ruta" : "Crear ruta"}</button>
    </form>
  );
}

function RedirectForm({
  context,
  locale,
}: {
  context: AdminContext;
  locale?: string;
}) {
  return (
    <form action={createSeoRedirectAction} className="pricingDenseForm">
      <input type="hidden" name="locale" value={locale ?? context.locale} />
      <DrawerField label="Origen">
        <input name="fromPath" placeholder="/ruta-antigua" title="Path origen que recibira redirect" />
      </DrawerField>
      <DrawerField label="Destino">
        <input name="toPath" placeholder="/ruta-nueva" title="Path destino del redirect" />
      </DrawerField>
      <DrawerField label="Status code">
        <select name="statusCode" defaultValue="301" title="Codigo HTTP de redireccion">
          <option value="301">301</option>
          <option value="302">302</option>
        </select>
      </DrawerField>
      <DrawerField label="Motivo">
        <input name="reason" placeholder="Cambio de slug" title="Motivo operativo opcional" />
      </DrawerField>
      <DrawerField label="Expira en">
        <input name="expiresAt" placeholder="2026-12-31T23:59:59.000Z" title="Fecha de expiracion opcional ISO" />
      </DrawerField>
      <button className="adminButton adminButtonPrimary" type="submit">Crear redirect</button>
    </form>
  );
}

function SeoResourceDrawer({
  context,
  data,
  filters,
}: {
  context: AdminContext;
  data: SeoAdminData;
  filters: SeoAdminPageProps["filters"];
}) {
  if (!filters.drawer || (filters.tab !== "routes" && filters.tab !== "redirects")) {
    return null;
  }

  const closeHref = tabHref(filters.tab, filters);
  const isEditing = filters.drawer === "edit";

  if (filters.tab === "routes") {
    const record = isEditing
      ? data.routes.data.items.find((route) => route.routeId === filters.recordId)
      : undefined;

    return (
      <SeoDrawer
        closeHref={closeHref}
        description="Gestiona paths canonicos y aliases publicados por Routing/SEO."
        title={isEditing ? "Editar ruta SEO" : "Crear ruta SEO"}
      >
        {isEditing && !record ? (
          <div className="adminBanner adminBannerError"><p>No se encontro la ruta seleccionada.</p></div>
        ) : (
          <RouteForm record={record} context={context} locale={filters.locale} />
        )}
      </SeoDrawer>
    );
  }

  return (
    <SeoDrawer
      closeHref={closeHref}
      description="Crea redirects manuales para preservar trafico y senales SEO."
      title="Crear redirect SEO"
    >
      <RedirectForm context={context} locale={filters.locale} />
    </SeoDrawer>
  );
}

function RoutesTable({
  data,
  filters,
}: {
  data: SeoAdminData;
  filters: SeoAdminPageProps["filters"];
}) {
  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <div>
          <h2>Rutas</h2>
          <p>{data.routes.data.total} registros</p>
        </div>
        <Link className="adminButton adminButtonPrimary" href={drawerHref("routes", filters, "create")}>Crear ruta</Link>
      </div>
      <ResultBanner result={data.routes} />
      {data.routes.data.items.length === 0 ? (
        <p className="adminContextHint">No hay rutas SEO para el filtro actual.</p>
      ) : (
        <div className="adminTableScroller">
          <table className="adminTable pricingTable seoTable">
            <thead>
              <tr>
                <th scope="col">routeId</th>
                <th scope="col">path</th>
                <th scope="col">entityType</th>
                <th scope="col">entityId</th>
                <th scope="col">routeKind</th>
                <th scope="col">canonicalRouteId</th>
                <th scope="col">sitemap</th>
                <th scope="col">status</th>
                <th scope="col">updatedAt</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.routes.data.items.map((route) => (
                <tr key={route.routeId}>
                  <td>{valueText(route.routeId)}</td>
                  <td>{valueText(route.path)}</td>
                  <td>{valueText(route.entityType)}</td>
                  <td>{valueText(route.entityId)}</td>
                  <td>{valueText(route.routeKind)}</td>
                  <td>{valueText(route.canonicalRouteId)}</td>
                  <td>{valueText(route.includeInSitemap)}</td>
                  <td>{valueText(route.status)}</td>
                  <td>{valueText(route.updatedAt)}</td>
                  <td>
                    <Link className="adminButton adminButtonTiny" href={drawerHref("routes", filters, "edit", route.routeId)}>Editar</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RedirectsTable({
  data,
  filters,
}: {
  data: SeoAdminData;
  filters: SeoAdminPageProps["filters"];
}) {
  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <div>
          <h2>Redirecciones</h2>
          <p>{data.redirects.data.total} registros</p>
        </div>
        <Link className="adminButton adminButtonPrimary" href={drawerHref("redirects", filters, "create")}>Crear redirect</Link>
      </div>
      <ResultBanner result={data.redirects} />
      {data.redirects.data.items.length === 0 ? (
        <p className="adminContextHint">No hay redirecciones SEO para el filtro actual.</p>
      ) : (
        <div className="adminTableScroller">
          <table className="adminTable pricingTable seoTable">
            <thead>
              <tr>
                <th scope="col">redirectId</th>
                <th scope="col">fromPath</th>
                <th scope="col">toPath</th>
                <th scope="col">statusCode</th>
                <th scope="col">status</th>
                <th scope="col">reason</th>
                <th scope="col">expiresAt</th>
                <th scope="col">updatedAt</th>
              </tr>
            </thead>
            <tbody>
              {data.redirects.data.items.map((redirect) => (
                <tr key={redirect.redirectId}>
                  <td>{valueText(redirect.redirectId)}</td>
                  <td>{valueText(redirect.fromPath)}</td>
                  <td>{valueText(redirect.toPath)}</td>
                  <td>{valueText(redirect.statusCode)}</td>
                  <td>{valueText(redirect.status)}</td>
                  <td>{valueText(redirect.reason)}</td>
                  <td>{valueText(redirect.expiresAt)}</td>
                  <td>{valueText(redirect.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ResolveForm({
  filters,
  context,
}: {
  filters: SeoAdminPageProps["filters"];
  context: AdminContext;
}) {
  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <h2>Resolver path</h2>
        <p>GET /admin/routing-seo/resolve</p>
      </div>
      <form className="pricingDenseForm" action="/admin/configuracion/seo">
        <input type="hidden" name="tab" value="resolve" />
        <input type="hidden" name="resolve" value="1" />
        <DrawerField label="Locale">
          <input name="locale" defaultValue={filters.locale ?? context.locale} placeholder="es-ES" title="Locale de Routing/SEO" />
        </DrawerField>
        <DrawerField label="Path">
          <input name="path" defaultValue={filters.path ?? "/"} placeholder="/producto-demo/p" title="Path a resolver" />
        </DrawerField>
        <button className="adminButton adminButtonPrimary" type="submit">Resolver</button>
      </form>
    </section>
  );
}

function ResolveResult({ result }: { result: SeoAdminResult<SeoResolveResult | null> | null }) {
  if (!result) {
    return (
      <section className="pricingPanel">
        <div className="pricingPanelHeader">
          <h2>Resultado</h2>
        </div>
        <p className="adminContextHint">Introduce un path para ver si resuelve como ruta o redirect.</p>
      </section>
    );
  }

  if (result.source === "unavailable") {
    return (
      <section className="pricingPanel">
        <div className="pricingPanelHeader">
          <h2>Resultado</h2>
        </div>
        <ResultBanner result={result} />
      </section>
    );
  }

  if (!result.data) {
    return (
      <section className="pricingPanel">
        <div className="pricingPanelHeader">
          <h2>Resultado</h2>
        </div>
        <p className="adminContextHint">Routing/SEO no devolvio una ruta o redirect para el path.</p>
      </section>
    );
  }

  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <h2>Resultado</h2>
        <p>{result.data.kind}</p>
      </div>
      <div className="adminDefinitionList">
        {Object.entries(result.data).map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{valueText(value)}</dd>
          </div>
        ))}
      </div>
    </section>
  );
}

function SitemapTable({ entries }: { entries: SeoSitemapEntry[] }) {
  if (entries.length === 0) {
    return <p className="adminContextHint">No hay entradas indexables para este contexto.</p>;
  }

  return (
    <div className="adminTableScroller">
      <table className="adminTable pricingTable seoTable">
        <thead>
          <tr>
            <th scope="col">path</th>
            <th scope="col">entityType</th>
            <th scope="col">entityId</th>
            <th scope="col">routeId</th>
            <th scope="col">updatedAt</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={`${entry.routeId}-${entry.path}`}>
              <td>{valueText(entry.path)}</td>
              <td>{valueText(entry.entityType)}</td>
              <td>{valueText(entry.entityId)}</td>
              <td>{valueText(entry.routeId)}</td>
              <td>{valueText(entry.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SeoAdminPage({ context, data, filters }: SeoAdminPageProps) {
  const activeTab = filters.tab;
  const activeLocale = filters.locale ?? context.locale;

  if (!hasRequiredAdminContext(context)) {
    return (
      <main className="adminPage seoAdminPage">
        <div className="adminBreadcrumb">Admin / Configuracion / SEO</div>
        <div className="adminBanner adminBannerError">
          <p>Selecciona Organization y Shop antes de configurar SEO.</p>
          <Link className="adminButton" href="/admin/configuracion/contexto">Ir a contexto</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="adminPage pricingAdminPage seoAdminPage">
      <div className="adminBreadcrumb">Admin / Configuracion / SEO</div>
      <div className="adminPageHeader">
        <div>
          <h1 className="adminPageTitle">SEO</h1>
          <p className="adminPageIntro">Gestiona rutas canonicas, aliases, redirecciones y sitemap desde la fachada Admin de Routing/SEO.</p>
        </div>
        <Link className="adminButton" href="/admin/products">Volver a productos</Link>
      </div>
      <div className="adminContextHint">
        {context.organizationId} / {context.shopId} / {activeLocale} / {context.currency} / {context.country} / {context.channel}
      </div>
      {filters.seoMessage ? <div className="adminBanner"><p>{filters.seoMessage}</p></div> : null}

      <nav className="adminTabs pricingTabs" aria-label="SEO">
        {tabs.map((tab) => (
          <Link
            className={`productEditorTab ${tab.id === activeTab ? "productEditorTabActive" : ""}`}
            href={tabHref(tab.id, filters)}
            key={tab.id}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <SeoFilters filters={filters} context={context} />

      {activeTab === "summary" ? (
        <div className="pricingGridTwo">
          <section className="pricingPanel">
            <div className="pricingPanelHeader">
              <h2>Resumen</h2>
              <p>{data.routes.source === "bff" && data.redirects.source === "bff" ? "BFF conectado" : "BFF no disponible"}</p>
            </div>
            <ResultBanner result={data.routes} />
            <ResultBanner result={data.redirects} />
            <div className="productPriceSummary productPriceSummaryWide">
              <strong>{data.routes.data.total}</strong>
              <span>Rutas</span>
              <strong>{data.redirects.data.total}</strong>
              <span>Redirects</span>
              <strong>{activeLocale}</strong>
              <span>Locale</span>
              <strong>{filters.status || "Todos"}</strong>
              <span>Estado</span>
            </div>
          </section>
          <section className="pricingPanel">
            <div className="pricingPanelHeader">
              <h2>Operaciones</h2>
            </div>
            <div className="adminButtonRow">
              <Link className="adminButton adminButtonPrimary" href={drawerHref("routes", filters, "create")}>Crear ruta</Link>
              <Link className="adminButton" href={drawerHref("redirects", filters, "create")}>Crear redirect</Link>
              <Link className="adminButton" href={tabHref("resolve", filters)}>Resolver path</Link>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "routes" ? <RoutesTable data={data} filters={filters} /> : null}
      {activeTab === "redirects" ? <RedirectsTable data={data} filters={filters} /> : null}
      {activeTab === "resolve" ? (
        <>
          <ResolveForm filters={filters} context={context} />
          <ResolveResult result={data.resolved} />
        </>
      ) : null}
      {activeTab === "sitemap" ? (
        <section className="pricingPanel">
          <div className="pricingPanelHeader">
            <div>
              <h2>Sitemap</h2>
              <p>{data.sitemap?.data.entries.length ?? 0} entradas</p>
            </div>
          </div>
          {data.sitemap ? <ResultBanner result={data.sitemap} /> : null}
          <SitemapTable entries={data.sitemap?.data.entries ?? []} />
        </section>
      ) : null}

      <SeoResourceDrawer context={context} data={data} filters={filters} />
    </main>
  );
}

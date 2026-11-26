import Link from "next/link";
import { AdminResourceDrawer } from "../../shared/ui/admin-resource-drawer";
import { OfferingActionsMenu } from "./offering-actions-menu";
import type { ProductOfferingRecord } from "./product-editor-types";

type Action = (formData: FormData) => Promise<void>;

type OfferingFilters = {
  q?: string;
  type?: string;
  status?: string;
  panel?: "create" | "edit" | "";
  offeringId?: string;
  offeringMessage?: string;
  createdOfferingId?: string;
};

type Props = {
  canManage: boolean;
  defaultCurrency: string;
  error?: string;
  offerings: ProductOfferingRecord[];
  filters: OfferingFilters;
  createAction: Action;
  updateAction: Action;
  deactivateAction: Action;
};

function offeringHref(filters: OfferingFilters, overrides: Partial<OfferingFilters> = {}) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.type) params.set("type", next.type);
  if (next.status && next.status !== "active") params.set("status", next.status);
  if (next.panel) params.set("panel", next.panel);
  if (next.offeringId) params.set("offeringId", next.offeringId);
  const query = params.toString();
  return query ? `/admin/catalogo/offerings?${query}` : "/admin/catalogo/offerings";
}

function offeringName(offering: ProductOfferingRecord) {
  return offering.localizedName[0]?.value ?? offering.name;
}

function formatMoney(minor: number, currency: string) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
  }).format(minor / 100);
}

function priceValue(offering?: ProductOfferingRecord) {
  if (!offering) {
    return "";
  }
  return (offering.priceMinor / 100).toFixed(2);
}

export function CatalogOfferingsPage({
  canManage,
  defaultCurrency,
  error,
  offerings,
  filters,
  createAction,
  updateAction,
  deactivateAction,
}: Props) {
  const selectedOffering = filters.offeringId
    ? offerings.find((offering) => offering.offeringId === filters.offeringId)
    : undefined;
  const isCreatePanel = filters.panel === "create";
  const isEditPanel = filters.panel === "edit" && selectedOffering;
  const showDrawer = canManage && (isCreatePanel || Boolean(isEditPanel));
  const closeDrawerHref = offeringHref(filters, { panel: "", offeringId: "" });

  return (
    <main className="adminPage catalogEntityListPage offeringsListPage">
      <div>
        <div className="adminBreadcrumb">Admin / Catalogo / Offerings</div>
        <div className="adminPageHeader">
          <div>
            <h1 className="adminPageTitle">Offerings / Servicios adicionales</h1>
            <p className="adminPageIntro">Crea servicios vendibles reutilizables y asignables a variantes de producto.</p>
          </div>
        </div>

        <section className="offeringsListArea" aria-label="Offerings">
          {error ? <div className="adminBanner adminBannerError" role="alert">{error}</div> : null}
          {filters.offeringMessage ? <div className="adminBanner">{filters.offeringMessage}</div> : null}
          {filters.createdOfferingId ? <div className="adminBanner adminBannerInfo" role="status">
            <p>Servicio creado. Referencia: <code>{filters.createdOfferingId}</code>.</p>
            {!offerings.some(item => item.offeringId === filters.createdOfferingId) ? <p>La creación está confirmada; el listado aún no refleja este servicio. Puedes volver a buscar por su referencia sin repetir el alta.</p> : null}
          </div> : null}
          <div className="employeesToolbar">
            <p className="adminMuted">{offerings.length} servicios encontrados.</p>
            {canManage ? <Link className="employeesTextAction" href={offeringHref(filters, {panel:"create",offeringId:""})}>Crear nueva</Link> : null}
          </div>
          <form aria-label="Filtros de offerings" className="offeringsSearchForm" method="get">
            <label className="adminField adminFeatureFilterName">
              <span>Nombre</span>
              <input aria-label="Filtrar offering por nombre" defaultValue={filters.q ?? ""} name="q" placeholder="Garantia" />
            </label>
            <label className="adminField">
              <span>Tipo</span>
              <select aria-label="Filtrar offering por tipo" defaultValue={filters.type ?? ""} name="type">
                <option value="">Todos</option>
                <option value="service">Servicio</option>
                <option value="warranty">Garantia</option>
                <option value="addon">Add-on</option>
              </select>
            </label>
            <label className="adminField">
              <span>Estado</span>
              <select aria-label="Filtrar offering por estado" defaultValue={filters.status ?? "active"} name="status">
                <option value="active">Activos</option>
                <option value="all">Todos</option>
              </select>
            </label>
            <button className="adminButton adminButtonPrimary" type="submit">Buscar</button>
            <Link className="adminButton" href="/admin/catalogo/offerings">
              Limpiar
            </Link>
          </form>

          <div className="employeesWorkspace"><div className="adminTableScroller">
            <table className="adminTable">
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Offering</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Precio</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {offerings.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No hay servicios adicionales.</td>
                  </tr>
                ) : offerings.map((offering) => (
                  <tr key={offering.offeringId}>
                    <td><strong>{offering.offeringId.slice(0, 8)}</strong></td>
                    <td>
                      {canManage ? <form action={updateAction} className="adminTableEditForm offeringInlineEdit">
                        <input type="hidden" name="offeringId" value={offering.offeringId} />
                        <input type="hidden" name="type" value={offering.type} />
                        <input type="hidden" name="price" value={priceValue(offering)} />
                        <input type="hidden" name="currency" value={offering.currency} />
                        <input type="hidden" name="active" value={String(offering.active)} />
                        <input type="hidden" name="returnPath" value={closeDrawerHref} />
                        <input name="name" aria-label={`Nombre ${offeringName(offering)}`} defaultValue={offeringName(offering)} required />
                        <button className="adminButton adminButtonTiny" type="submit">Guardar</button>
                      </form> : <strong>{offeringName(offering)}</strong>}
                    </td>
                    <td>{offering.type}</td>
                    <td>{formatMoney(offering.priceMinor, offering.currency)}</td>
                    <td>
                      <span className={`adminBadge ${offering.active ? "adminBadgeOk" : "adminBadgeWarn"}`}>
                        {offering.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>
                      {canManage ? <OfferingActionsMenu name={offeringName(offering)} offeringId={offering.offeringId} editHref={offeringHref(filters,{panel:"edit",offeringId:offering.offeringId})} returnPath={closeDrawerHref} deactivateAction={deactivateAction} /> : "Solo lectura"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></div>
        </section>
      </div>

      {showDrawer ? <AdminResourceDrawer drawerId="catalog-offerings-page-1" title={isCreatePanel ? "Crear offering" : `Editar offering: ${selectedOffering?.offeringId.slice(0,8)}`} description="Configura el servicio para la tienda y el locale activos." closeHref={closeDrawerHref}>
            <form action={isCreatePanel ? createAction : updateAction} aria-label={isCreatePanel ? "Crear offering" : `Editar ${selectedOffering ? offeringName(selectedOffering) : "offering"}`} className="adminForm offeringEditorForm">
              <input type="hidden" name="returnPath" value={isCreatePanel ? "/admin/catalogo/offerings" : closeDrawerHref} />
              {selectedOffering ? <input name="offeringId" type="hidden" value={selectedOffering.offeringId} /> : null}
              <div className="adminFeatureReadOnlyLine">
                <span>ID</span>
                <strong>{selectedOffering?.offeringId.slice(0, 8) ?? "Nuevo"}</strong>
              </div>
              <label className="adminField">
                <span>Nombre</span>
                <input name="name" defaultValue={selectedOffering ? offeringName(selectedOffering) : ""} placeholder="Garantia extendida" required />
              </label>
              <label className="adminField">
                <span>Tipo</span>
                <select name="type" defaultValue={selectedOffering?.type ?? "service"}>
                  <option value="service">Servicio</option>
                  <option value="warranty">Garantia</option>
                  <option value="addon">Add-on</option>
                </select>
              </label>
              <label className="adminField">
                <span>Precio</span>
                <input type="number" min="0" step="0.01" inputMode="decimal" name="price" defaultValue={priceValue(selectedOffering)} placeholder="9.99" />
              </label>
              <label className="adminField">
                <span>Moneda</span>
                <input name="currency" defaultValue={selectedOffering?.currency ?? defaultCurrency} maxLength={3} />
              </label>
              <div className="adminFeatureToggleGroup">
                <label className="adminSwitch">
                  <input defaultChecked={selectedOffering?.active ?? true} name="active" type="checkbox" />
                  <span>Activo</span>
                </label>
              </div>
              <button className="adminButton adminButtonPrimary" type="submit">
                Guardar cambios
              </button>
            </form>
      </AdminResourceDrawer> : null}
    </main>
  );
}

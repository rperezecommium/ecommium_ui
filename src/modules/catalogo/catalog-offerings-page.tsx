import Link from "next/link";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import type { ProductOfferingRecord } from "./product-editor-types";

type Action = (formData: FormData) => Promise<void>;

type OfferingFilters = {
  q?: string;
  type?: string;
  status?: string;
  panel?: "create" | "edit" | "";
  offeringId?: string;
};

type Props = {
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
  const showDrawer = isCreatePanel || Boolean(isEditPanel);
  const closeDrawerHref = offeringHref(filters, { panel: "", offeringId: "" });

  return (
    <main className={`adminPage adminFeaturePage ${showDrawer ? "adminFeaturePageWithDrawer" : ""}`}>
      <div className="adminFeatureContent">
        <div className="adminBreadcrumb">Admin / Catalogo / Offerings</div>
        <div className="adminPageHeader">
          <div>
            <h1 className="adminPageTitle">Offerings / Servicios adicionales</h1>
            <p className="adminPageIntro">Crea servicios vendibles reutilizables y asignables a variantes de producto.</p>
          </div>
          <Link className="adminButton adminButtonPrimary" href={offeringHref(filters, { panel: "create", offeringId: "" })}>
            <Plus aria-hidden="true" size={16} />
            Crear offering
          </Link>
        </div>

        <section className="adminFeatureListArea" aria-label="Offerings">
          <div className="adminFeatureListHeader">
            <div>
              <h2>Servicios adicionales</h2>
              <p>{offerings.length} registros encontrados.</p>
            </div>
            <Link className="adminButton" href="/admin/catalogo/offerings">
              Refrescar
            </Link>
          </div>

          <form aria-label="Filtros de offerings" className="adminFeatureFilterBar" method="get">
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

          <div className="adminFeatureTableShell">
            <table className="adminTable adminFeatureTable">
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
                      <div className="adminFeatureNameCell">
                        <strong>{offeringName(offering)}</strong>
                        <span>{offering.offeringId}</span>
                      </div>
                    </td>
                    <td>{offering.type}</td>
                    <td>{formatMoney(offering.priceMinor, offering.currency)}</td>
                    <td>
                      <span className={`adminBadge ${offering.active ? "adminBadgeOk" : "adminBadgeWarn"}`}>
                        {offering.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>
                      <div className="adminFeatureRowActions">
                        <Link
                          aria-label={`Editar ${offeringName(offering)}`}
                          className="adminIconButton"
                          href={offeringHref(filters, { panel: "edit", offeringId: offering.offeringId })}
                          title="Editar"
                        >
                          <Pencil aria-hidden="true" size={16} />
                        </Link>
                        <form action={deactivateAction} aria-label={`Eliminar ${offeringName(offering)}`}>
                          <input name="offeringId" type="hidden" value={offering.offeringId} />
                          <button aria-label={`Eliminar ${offeringName(offering)}`} className="adminIconButton adminIconButtonDanger" title="Eliminar" type="submit">
                            <Trash2 aria-hidden="true" size={16} />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {showDrawer ? (
        <>
          <div aria-hidden="true" className="adminFeatureDrawerBackdrop" />
          <aside aria-labelledby="offering-drawer-title" aria-modal="true" className="adminFeatureDrawer" role="dialog">
            <div className="adminFeatureDrawerHeader">
              <h2 id="offering-drawer-title">
                {isCreatePanel ? "Crear offering" : `Editar offering: ${selectedOffering?.offeringId.slice(0, 8)}`}
              </h2>
              <Link aria-label="Cerrar panel" className="adminIconButton" href={closeDrawerHref}>
                <X aria-hidden="true" size={18} />
              </Link>
            </div>

            <form action={isCreatePanel ? createAction : updateAction} aria-label={isCreatePanel ? "Crear offering" : `Editar ${selectedOffering ? offeringName(selectedOffering) : "offering"}`} className="adminFeatureDrawerBody">
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
                <input inputMode="decimal" name="price" defaultValue={priceValue(selectedOffering)} placeholder="9.99" />
              </label>
              <label className="adminField">
                <span>Moneda</span>
                <input name="currency" defaultValue={selectedOffering?.currency ?? "EUR"} maxLength={3} />
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
          </aside>
        </>
      ) : null}
    </main>
  );
}

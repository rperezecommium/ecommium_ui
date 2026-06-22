"use client";

import Link from "next/link";
import type { CatalogEntityListResult } from "./catalog-taxonomy";

type EntityAction = (formData: FormData) => Promise<void>;

type CatalogEntityAdminPageProps = {
  title: string;
  description: string;
  breadcrumb: string;
  list: CatalogEntityListResult;
  q: string;
  status: string;
  createAction: EntityAction;
  updateAction: EntityAction;
  softDeleteAction: EntityAction;
  hardDeleteAction: EntityAction;
};

export function CatalogEntityAdminPage({
  title,
  description,
  breadcrumb,
  list,
  q,
  status,
  createAction,
  updateAction,
  softDeleteAction,
  hardDeleteAction,
}: CatalogEntityAdminPageProps) {
  return (
    <main className="adminPage">
      <div className="adminBreadcrumb">Admin / Catalogo / {breadcrumb}</div>
      <div className="adminPageHeader">
        <div>
          <h1 className="adminPageTitle">{title}</h1>
          <p className="adminPageIntro">{description}</p>
        </div>
        <Link className="adminButton" href="/admin/products">
          Volver a productos
        </Link>
      </div>

      {list.source === "unavailable" ? (
        <div className="adminBanner adminBannerError">
          <p>No se pudo conectar con el BFF para {breadcrumb.toLowerCase()}.</p>
          <p className="adminContextHint">{list.failedEndpoint}: {list.message}</p>
        </div>
      ) : null}

      <section className="adminCard">
        <div className="adminCardHeader">
          <div>
            <h2>Listado</h2>
            <p>{list.total} registros encontrados.</p>
          </div>
          <form className="adminButtonRow" method="get">
            <input aria-label="Buscar" className="adminFilterInput" defaultValue={q} name="q" placeholder="Buscar por nombre" />
            <select aria-label="Estado" defaultValue={status} name="status">
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
              <option value="all">Todos</option>
            </select>
            <button className="adminButton" type="submit">Filtrar</button>
          </form>
        </div>

        <form action={createAction} className="adminInlineCreateForm">
          <label className="adminField">
            <span>Nombre</span>
            <input name="name" placeholder={`Nueva ${breadcrumb.toLowerCase()}`} />
          </label>
          <label className="adminCheckbox">
            <input defaultChecked name="isActive" type="checkbox" />
            Activa
          </label>
          <button className="adminButton adminButtonPrimary" type="submit">
            Crear nueva
          </button>
        </form>

        {list.items.length === 0 ? (
          <div className="adminEmptyState">
            <h2>Sin registros</h2>
            <p>Crea el primer registro o revisa los filtros activos.</p>
          </div>
        ) : (
          <div className="adminTableScroller">
            <table className="adminTable">
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Slug</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Productos</th>
                  <th scope="col">Actualizado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <form action={updateAction} className="adminTableEditForm">
                        <input name="id" type="hidden" value={item.id} />
                        <input aria-label={`Nombre ${item.label}`} defaultValue={item.label} name="name" />
                        <label className="adminCheckbox">
                          <input defaultChecked={item.isActive} name="isActive" type="checkbox" />
                          Activa
                        </label>
                        <button className="adminButton" type="submit">Guardar</button>
                      </form>
                    </td>
                    <td>{item.slug ?? "-"}</td>
                    <td>
                      <span className={`adminBadge ${item.isActive ? "adminBadgeOk" : "adminBadgeWarn"}`}>
                        {item.isActive ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td>{item.productCount ?? 0}</td>
                    <td>{item.updatedAt ?? "-"}</td>
                    <td>
                      <div className="adminButtonRow">
                        <form action={softDeleteAction}>
                          <input name="id" type="hidden" value={item.id} />
                          <button className="adminButton" type="submit">Eliminar soft</button>
                        </form>
                        <form
                          action={hardDeleteAction}
                          onSubmit={(event) => {
                            if (!window.confirm(`Eliminar definitivamente "${item.label}"?`)) {
                              event.preventDefault();
                            }
                          }}
                        >
                          <input name="id" type="hidden" value={item.id} />
                          <button className="adminButton adminButtonDanger" type="submit">Eliminar hard</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

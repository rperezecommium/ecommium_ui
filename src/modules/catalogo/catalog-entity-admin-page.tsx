"use client";
import { useId, useRef, useState } from "react";
import { AdminResourceDrawer } from "../../shared/ui/admin-resource-drawer";
import {AdminMutationForm} from "../../shared/ui/admin-mutation-form";
import type {AdminFormState} from "../../shared/validation/admin-form-state";

import Link from "next/link";
import { CatalogEntityFields } from "./catalog-entity-fields";
import type { CatalogEntityListResult } from "./catalog-taxonomy";

type EntityAction = (formData: FormData) => Promise<void>;

type CatalogEntityAdminPageProps = {
  kind: "categories"|"brands";
  createDrawerOpen?: boolean;
  canCreate: boolean;
  title: string;
  description: string;
  breadcrumb: string;
  list: CatalogEntityListResult;
  q: string;
  status: string;
  createAction: (state:AdminFormState,data:FormData)=>Promise<AdminFormState>;
  updateAction: EntityAction;
  softDeleteAction: EntityAction;
  hardDeleteAction: EntityAction;
};

export function CatalogEntityAdminPage({
  kind,
  createDrawerOpen = false,
  canCreate,
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
  const isCategories = kind === "categories";
  const query = new URLSearchParams({ q, status });
  const listHref = `/admin/catalogo/${isCategories ? "categorias" : "marcas"}?${query}`;
  const creationForm = (<AdminMutationForm action={createAction} label={kind==='categories'?'Crear categoría':'Crear marca'} className="adminForm">
          <CatalogEntityFields kind={kind} />
          <button className="adminButton adminButtonPrimary" type="submit">Crear nueva</button>
        </AdminMutationForm>);
  return (
    <main className={`adminPage catalogEntityListPage ${isCategories ? "categoryListPage" : "brandListPage"}`}>
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

      <>
        <div className="employeesToolbar">
          <p className="adminMuted">{list.total} {isCategories ? "categorías encontradas" : "marcas / proveedores encontrados"}.</p>
          {canCreate ? <Link className="employeesTextAction" href={`${listHref}&drawer=create`}>Crear nueva</Link> : null}
        </div>
        <form className="catalogEntitySearchForm" method="get" aria-label={isCategories ? "Buscar categorías" : "Buscar marcas / proveedores"}>
          <label className="adminField"><span>Buscar</span><input defaultValue={q} name="q" placeholder="Buscar por nombre" /></label>
          <label className="adminField"><span>Estado</span><select defaultValue={status} name="status"><option value="active">Activos</option><option value="inactive">Inactivos</option><option value="all">Todos</option></select></label>
          <button className="adminButton adminButtonPrimary" type="submit">Buscar</button>
        </form>
      </>
      <section className="employeesWorkspace">
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
                      {canCreate?<form action={updateAction} className="adminTableEditForm">
                        <input name="id" type="hidden" value={item.id} />
                        <input aria-label={`Nombre ${item.label}`} defaultValue={item.label} name="name" />
                        <label className="adminCheckbox">
                          <input defaultChecked={item.isActive} name="isActive" type="checkbox" />
                          Activa
                        </label>
                        <button className="adminButton" type="submit">Guardar</button>
                      </form>:item.label}
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
                      {canCreate ? <CatalogEntityActionsMenu id={item.id} label={item.label} softDeleteAction={softDeleteAction} hardDeleteAction={hardDeleteAction} /> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {canCreate && createDrawerOpen ? <AdminResourceDrawer drawerId="catalog-entity-admin-page-1" title={isCategories ? "Crear categoría" : "Crear marca"} description={isCategories ? "Añade los datos de la categoría para la tienda y el locale activos." : "Añade los datos de la marca o proveedor para la tienda y el locale activos."} closeHref={listHref}>
        {creationForm}
      </AdminResourceDrawer> : null}
    </main>
  );
}

function CatalogEntityActionsMenu({ id, label, softDeleteAction, hardDeleteAction }: {
  id: string; label: string; softDeleteAction: EntityAction; hardDeleteAction: EntityAction;
}) {
  const popupId = useId();
  const popup = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({left:0,top:0});
  return <>
    <button type="button" className="adminButton adminButtonTiny" aria-label={`Acciones de ${label}`} popoverTarget={popupId}
      onClick={event => {
        const rect=event.currentTarget.getBoundingClientRect();
        setPosition({left:Math.max(8,Math.min(rect.right-190,window.innerWidth-198)),top:Math.max(8,Math.min(rect.bottom+4,window.innerHeight-112))});
      }}>…</button>
    <div id={popupId} ref={popup} popover="auto" className="catalogEntityActionsPopover" style={position}>
      <form action={softDeleteAction} onSubmit={() => popup.current?.hidePopover()}>
        <input name="id" type="hidden" value={id} />
        <button className="adminButton" type="submit">Eliminar soft</button>
      </form>
      <form action={hardDeleteAction} onSubmit={event => {
        if (!window.confirm(`Eliminar definitivamente "${label}"? Esta acción no se puede deshacer.`)) event.preventDefault();
        else popup.current?.hidePopover();
      }}>
        <input name="id" type="hidden" value={id} />
        <button className="adminButton adminButtonDanger" type="submit">Eliminar hard</button>
      </form>
    </div>
  </>;
}

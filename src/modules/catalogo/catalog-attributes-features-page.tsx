import Link from "next/link";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import type { CatalogEntityListResult } from "./catalog-taxonomy";
import {
  filterAttributeFeatureFields,
  type CatalogAttributeFeatureData,
  type CatalogAttributeFeatureFilters,
  type CatalogSpecificationField,
} from "./catalog-attributes-features";

type Action = (formData: FormData) => Promise<void>;

type Props = {
  data: CatalogAttributeFeatureData;
  categories: CatalogEntityListResult;
  filters: CatalogAttributeFeatureFilters;
  createAction: Action;
  updateAction: Action;
  addValueAction: Action;
  removeValueAction: Action;
  deactivateAction: Action;
};

function featureHref(filters: CatalogAttributeFeatureFilters, overrides: Partial<CatalogAttributeFeatureFilters> = {}) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();
  params.set("tab", "features");
  if (next.id) params.set("id", next.id);
  if (next.q) params.set("q", next.q);
  if (next.group) params.set("group", next.group);
  if (next.status && next.status !== "active") params.set("status", next.status);
  if (next.panel) params.set("panel", next.panel);
  if (next.fieldId) params.set("fieldId", next.fieldId);
  return `/admin/catalogo/atributos-caracteristicas?${params.toString()}`;
}

function activeValues(field: CatalogSpecificationField) {
  return field.values.filter((value) => value.isActive);
}

function FieldValueChips({
  field,
  removeValueAction,
}: {
  field: CatalogSpecificationField;
  removeValueAction: Action;
}) {
  const values = activeValues(field);
  if (values.length === 0) {
    return <span className="adminMuted">Sin valores</span>;
  }

  return (
    <div className="adminFeatureChipList" aria-label={`Valores de ${field.name}`}>
      {values.map((value) => (
        <div className="adminFeatureChip" key={value.fieldValueId}>
          {value.name}
          <form action={removeValueAction}>
            <input name="groupId" type="hidden" value={field.groupId} />
            <input name="fieldId" type="hidden" value={field.fieldId} />
            <input name="fieldValueId" type="hidden" value={value.fieldValueId} />
            <button aria-label={`Quitar valor ${value.name}`} className="adminFeatureChipRemove" type="submit">
              <X aria-hidden="true" size={12} />
            </button>
          </form>
        </div>
      ))}
    </div>
  );
}

function FeatureToggles({ field }: { field?: CatalogSpecificationField }) {
  return (
    <div className="adminFeatureToggleGroup">
      <label className="adminSwitch">
        <input defaultChecked={field?.isActive ?? true} name="isActive" type="checkbox" />
        <span>Activa</span>
      </label>
      <label className="adminSwitch">
        <input defaultChecked={field?.isFilter ?? true} name="isFilter" type="checkbox" />
        <span>Filtrable</span>
      </label>
      <label className="adminSwitch">
        <input defaultChecked={field?.isOnProductDetails ?? true} name="isOnProductDetails" type="checkbox" />
        <span>Visible en ficha</span>
      </label>
    </div>
  );
}

export function CatalogAttributesFeaturesPage({
  data,
  categories,
  filters,
  createAction,
  updateAction,
  addValueAction,
  removeValueAction,
  deactivateAction,
}: Props) {
  const activeFields = filterAttributeFeatureFields(data.fields, filters);
  const selectedField = filters.fieldId ? data.fields.find((field) => field.fieldId === filters.fieldId) : undefined;
  const isCreatePanel = filters.panel === "create";
  const isEditPanel = filters.panel === "edit" && selectedField;
  const showDrawer = isCreatePanel || Boolean(isEditPanel);
  const tab = "features" as const;
  const emptyCopy = "Crea caracteristicas tecnicas visibles en la ficha, comparadores y filtros.";
  const closeDrawerHref = featureHref(filters, { panel: "", fieldId: "" });

  return (
    <main className={`adminPage adminFeaturePage ${showDrawer ? "adminFeaturePageWithDrawer" : ""}`}>
      <div className="adminFeatureContent">
        <div className="adminBreadcrumb">Admin / Catalogo / Caracteristicas</div>
        <div className="adminPageHeader">
          <div>
            <h1 className="adminPageTitle">Caracteristicas Tecnicas</h1>
            <p className="adminPageIntro">Gestiona la ficha tecnica reutilizable del producto sin mezclar atributos de combinacion.</p>
          </div>
          <div className="adminButtonRow">
            <Link className="adminButton" href="/admin/products">
              Volver a productos
            </Link>
            <Link className="adminButton adminButtonPrimary" href={featureHref(filters, { panel: "create", fieldId: "" })}>
              <Plus aria-hidden="true" size={16} />
              Crear caracteristica
            </Link>
          </div>
        </div>

        {data.source === "unavailable" ? (
          <div className="adminBanner adminBannerError">
            <p>No se pudo conectar con el BFF para caracteristicas.</p>
            <p className="adminContextHint">{data.failedEndpoint}: {data.message}</p>
          </div>
        ) : null}

        <section className="adminFeatureListArea" aria-label="Caracteristicas tecnicas">
          <div className="adminFeatureListHeader">
            <div>
              <h2>Caracteristicas tecnicas</h2>
              <p>{activeFields.length} registros encontrados.</p>
            </div>
            <div className="adminButtonRow">
              <Link className="adminButton" href={`/admin/catalogo/atributos-caracteristicas?tab=${tab}`}>
                Refrescar
              </Link>
              <Link className="adminButton" href="/admin/products/new">
                Usar en producto
              </Link>
            </div>
          </div>

          <form aria-label="Filtros superiores" className="adminFeatureFilterBar" method="get">
            <input name="tab" type="hidden" value={tab} />
            <label className="adminField">
              <span>ID</span>
              <input aria-label="Filtrar por ID superior" defaultValue={filters.id ?? ""} name="id" placeholder="ID" />
            </label>
            <label className="adminField adminFeatureFilterName">
              <span>Nombre</span>
              <input aria-label="Filtrar por nombre superior" defaultValue={filters.q ?? ""} name="q" placeholder="Nombre" />
            </label>
            <label className="adminField">
              <span>Grupo</span>
              <input aria-label="Filtrar por grupo superior" defaultValue={filters.group ?? ""} name="group" placeholder="Ficha tecnica" />
            </label>
            <label className="adminField">
              <span>Estado</span>
              <select aria-label="Filtrar por estado superior" defaultValue={filters.status ?? "active"} name="status">
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
                <option value="all">Todos</option>
              </select>
            </label>
            <button className="adminButton adminButtonPrimary" type="submit">Buscar</button>
            <Link className="adminButton" href={`/admin/catalogo/atributos-caracteristicas?tab=${tab}`}>
              Limpiar
            </Link>
          </form>

          {activeFields.length === 0 ? (
            <div className="adminEmptyState">
              <h2>Sin registros</h2>
              <p>{emptyCopy}</p>
            </div>
          ) : (
            <div className="adminFeatureTableShell">
              <table className="adminTable adminFeatureTable">
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col">Caracteristica</th>
                    <th scope="col">Grupo</th>
                    <th scope="col">Valores</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {activeFields.map((field) => (
                    <tr className="adminFeatureResultRow" key={field.fieldId}>
                      <td>
                        <strong>{field.fieldId.slice(0, 8)}</strong>
                      </td>
                      <td>
                        <div className="adminFeatureNameCell">
                          <strong>{field.name}</strong>
                          <span>Pos. {field.position}</span>
                        </div>
                      </td>
                      <td>{field.groupName}</td>
                      <td>
                        <FieldValueChips field={field} removeValueAction={removeValueAction} />
                      </td>
                      <td>
                        <span className={`adminBadge ${field.isActive ? "adminBadgeOk" : "adminBadgeWarn"}`}>
                          {field.isActive ? "Activa" : "Inactiva"}
                        </span>
                      </td>
                      <td>
                        <div className="adminFeatureRowActions">
                          <Link
                            aria-label={`Editar ${field.name}`}
                            className="adminIconButton"
                            href={featureHref(filters, { panel: "edit", fieldId: field.fieldId })}
                            title="Editar"
                          >
                            <Pencil aria-hidden="true" size={16} />
                          </Link>
                          <form action={deactivateAction} aria-label={`Eliminar ${field.name}`}>
                            <input name="groupId" type="hidden" value={field.groupId} />
                            <input name="fieldId" type="hidden" value={field.fieldId} />
                            <input name="name" type="hidden" value={field.name} />
                            <input name="isFilter" type="hidden" value={String(field.isFilter)} />
                            <input name="isOnProductDetails" type="hidden" value={String(field.isOnProductDetails)} />
                            <button aria-label={`Eliminar ${field.name}`} className="adminIconButton adminIconButtonDanger" title="Eliminar" type="submit">
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
          )}
        </section>
      </div>

      {showDrawer ? (
        <>
          <div aria-hidden="true" className="adminFeatureDrawerBackdrop" />
          <aside aria-labelledby="feature-drawer-title" aria-modal="true" className="adminFeatureDrawer" role="dialog">
            <div className="adminFeatureDrawerHeader">
              <h2 id="feature-drawer-title">
                {isCreatePanel ? "Crear caracteristica" : `Editar Caracteristica: ${selectedField?.fieldId.slice(0, 8)}`}
              </h2>
              <Link aria-label="Cerrar panel" className="adminIconButton" href={closeDrawerHref}>
                <X aria-hidden="true" size={18} />
              </Link>
            </div>

            {isCreatePanel ? (
              <form action={createAction} aria-label="Crear caracteristica" className="adminFeatureDrawerBody">
                <input name="tab" type="hidden" value={tab} />
                <div className="adminFeatureReadOnlyLine">
                  <span>ID</span>
                  <strong>Nuevo</strong>
                </div>
                <label className="adminField">
                  <span>Nombre</span>
                  <input name="name" placeholder="durabilidad" required />
                </label>
                <label className="adminField">
                  <span>Grupo</span>
                  <select name="groupId">
                    <option value="">Crear grupo nuevo</option>
                    {data.groups.map((group) => (
                      <option key={group.specificationGroupId} value={group.specificationGroupId}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="adminField">
                  <span>Grupo nuevo</span>
                  <input name="groupName" placeholder="Ficha tecnica" />
                </label>
                <label className="adminField">
                  <span>Categoria</span>
                  <select name="categoryId" required>
                    <option value="">Seleccionar categoria</option>
                    {categories.items.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="adminField">
                  <span>Valores</span>
                  <input name="values" placeholder="Algodon, Poliester" />
                </label>
                <FeatureToggles />
                <button className="adminButton adminButtonPrimary" type="submit">
                  Guardar cambios
                </button>
              </form>
            ) : null}

            {isEditPanel && selectedField ? (
              <div className="adminFeatureDrawerBody">
                <div className="adminFeatureReadOnlyLine">
                  <span>ID</span>
                  <strong>{selectedField.fieldId.slice(0, 8)}</strong>
                </div>
                <form action={updateAction} aria-label={`Editar ${selectedField.name}`} className="adminFeatureDrawerStack">
                  <input name="groupId" type="hidden" value={selectedField.groupId} />
                  <input name="fieldId" type="hidden" value={selectedField.fieldId} />
                  <label className="adminField">
                    <span>Nombre</span>
                    <input name="name" defaultValue={selectedField.name} required />
                  </label>
                  <label className="adminField">
                    <span>Grupo</span>
                    <input readOnly value={selectedField.groupName} />
                  </label>
                  <label className="adminField">
                    <span>Categoria</span>
                    <select disabled defaultValue={selectedField.categoryId}>
                      <option value={selectedField.categoryId}>
                        {categories.items.find((category) => category.id === selectedField.categoryId)?.label ?? "Categoria actual"}
                      </option>
                    </select>
                  </label>
                  <FeatureToggles field={selectedField} />
                  <button className="adminButton adminButtonPrimary" type="submit">
                    Guardar cambios
                  </button>
                </form>

                <section className="adminFeatureDrawerStack" aria-label={`Valores de ${selectedField.name}`}>
                  <span className="adminFeatureDrawerLabel">Valores</span>
                  <FieldValueChips field={selectedField} removeValueAction={removeValueAction} />
                  <form action={addValueAction} aria-label={`Anadir valor ${selectedField.name}`} className="adminFeatureAddValueForm">
                    <input name="groupId" type="hidden" value={selectedField.groupId} />
                    <input name="fieldId" type="hidden" value={selectedField.fieldId} />
                    <input aria-label={`Nuevo valor ${selectedField.name}`} name="value" placeholder="Nuevo valor" />
                    <button aria-label={`Anadir valor ${selectedField.name}`} className="adminIconButton" title="Anadir valor" type="submit">
                      <Plus aria-hidden="true" size={16} />
                    </button>
                  </form>
                </section>

                <form action={deactivateAction} aria-label={`Eliminar ${selectedField.name}`}>
                  <input name="groupId" type="hidden" value={selectedField.groupId} />
                  <input name="fieldId" type="hidden" value={selectedField.fieldId} />
                  <input name="name" type="hidden" value={selectedField.name} />
                  <input name="isFilter" type="hidden" value={String(selectedField.isFilter)} />
                  <input name="isOnProductDetails" type="hidden" value={String(selectedField.isOnProductDetails)} />
                  <button className="adminButton adminButtonDanger" type="submit">
                    Eliminar caracteristica
                  </button>
                </form>
              </div>
            ) : null}
          </aside>
        </>
      ) : null}
    </main>
  );
}

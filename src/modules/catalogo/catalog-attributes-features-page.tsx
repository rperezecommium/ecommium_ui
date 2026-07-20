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
  params.set("tab", next.tab ?? "features");
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
  const tab = filters.tab;
  const isAttributesTab = tab === "attributes";
  const copy = isAttributesTab
    ? {
        breadcrumb: "Admin / Catalogo / Atributos de combinacion",
        title: "Atributos de combinacion",
        intro: "Gestiona atributos vendibles como color, talla o formato para construir combinaciones.",
        listTitle: "Atributos de combinacion",
        create: "Crear atributo",
        edit: "Editar atributo",
        delete: "Eliminar atributo",
        itemColumn: "Atributo",
        empty: "Crea atributos SKU reutilizables para que las variantes mantengan combinaciones consistentes.",
        values: "Valores de combinacion",
        namePlaceholder: "color",
        valuePlaceholder: "Rojo, Azul",
        groupPlaceholder: "Variantes",
      }
    : {
        breadcrumb: "Admin / Catalogo / Caracteristicas",
        title: "Caracteristicas Tecnicas",
        intro: "Gestiona la ficha tecnica reutilizable del producto sin mezclar atributos de combinacion.",
        listTitle: "Caracteristicas tecnicas",
        create: "Crear caracteristica",
        edit: "Editar caracteristica",
        delete: "Eliminar caracteristica",
        itemColumn: "Caracteristica",
        empty: "Crea caracteristicas tecnicas visibles en la ficha, comparadores y filtros.",
        values: "Valores",
        namePlaceholder: "durabilidad",
        valuePlaceholder: "Algodon, Poliester",
        groupPlaceholder: "Ficha tecnica",
      };
  const closeDrawerHref = featureHref(filters, { panel: "", fieldId: "" });

  return (
    <main className={`adminPage adminFeaturePage ${showDrawer ? "adminFeaturePageWithDrawer" : ""}`}>
      <div className="adminFeatureContent">
        <div className="adminBreadcrumb">{copy.breadcrumb}</div>
        <div className="adminPageHeader">
          <div>
            <h1 className="adminPageTitle">{copy.title}</h1>
            <p className="adminPageIntro">{copy.intro}</p>
          </div>
          <div className="adminButtonRow">
            <Link className="adminButton" href="/admin/products">
              Volver a productos
            </Link>
            <Link className="adminButton adminButtonPrimary" href={featureHref(filters, { panel: "create", fieldId: "" })}>
              <Plus aria-hidden="true" size={16} />
              {copy.create}
            </Link>
          </div>
        </div>

        <nav aria-label="Tipo de dato catalogo" className="adminFeatureModeNav">
          <Link className={`adminFeatureModeLink ${isAttributesTab ? "adminFeatureModeLinkActive" : ""}`} href={featureHref(filters, { tab: "attributes", panel: "", fieldId: "" })}>
            Atributos
          </Link>
          <Link className={`adminFeatureModeLink ${!isAttributesTab ? "adminFeatureModeLinkActive" : ""}`} href={featureHref(filters, { tab: "features", panel: "", fieldId: "" })}>
            Caracteristicas
          </Link>
        </nav>

        {data.source === "unavailable" ? (
          <div className="adminBanner adminBannerError">
            <p>No se pudo conectar con el BFF para {isAttributesTab ? "atributos de combinacion" : "caracteristicas"}.</p>
            <p className="adminContextHint">{data.failedEndpoint}: {data.message}</p>
          </div>
        ) : null}

        <section className="adminFeatureListArea" aria-label={copy.listTitle}>
          <div className="adminFeatureListHeader">
            <div>
              <h2>{copy.listTitle}</h2>
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
              <input aria-label="Filtrar por nombre superior" defaultValue={filters.q ?? ""} name="q" placeholder={isAttributesTab ? "Color" : "Nombre"} />
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
              <p>{copy.empty}</p>
            </div>
          ) : (
            <div className="adminFeatureTableShell">
              <table className="adminTable adminFeatureTable">
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col">{copy.itemColumn}</th>
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
                      <td>
                        <div className="adminFeatureNameCell">
                          <strong>{field.groupName}</strong>
                          <span>{field.isStockKeepingUnit ? "Combinacion" : "Ficha tecnica"}</span>
                        </div>
                      </td>
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
                {isCreatePanel ? copy.create : `${copy.edit}: ${selectedField?.fieldId.slice(0, 8)}`}
              </h2>
              <Link aria-label="Cerrar panel" className="adminIconButton" href={closeDrawerHref}>
                <X aria-hidden="true" size={18} />
              </Link>
            </div>

            {isCreatePanel ? (
              <form action={createAction} aria-label={copy.create} className="adminFeatureDrawerBody">
                <input name="tab" type="hidden" value={tab} />
                <div className="adminFeatureReadOnlyLine">
                  <span>ID</span>
                  <strong>Nuevo</strong>
                </div>
                <label className="adminField">
                  <span>Nombre</span>
                  <input name="name" placeholder={copy.namePlaceholder} required />
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
                  <input name="groupName" placeholder={copy.groupPlaceholder} />
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
                  <span>{copy.values}</span>
                  <input name="values" placeholder={copy.valuePlaceholder} />
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

                <section className="adminFeatureDrawerStack" aria-label={`${copy.values} de ${selectedField.name}`}>
                  <span className="adminFeatureDrawerLabel">{copy.values}</span>
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
                    {copy.delete}
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

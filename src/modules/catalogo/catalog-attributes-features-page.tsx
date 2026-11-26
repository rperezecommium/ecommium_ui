import {FeatureDeletionButton} from './feature-deletion-button';
import {FeatureDeletionStatusPanel} from './feature-deletion-status';
import { FeatureDeactivationButton } from './feature-deactivation-button';
import { AdminResourceDrawer } from "../../shared/ui/admin-resource-drawer";
import { CatalogFeatureCreateFields, FeatureToggles } from "./catalog-feature-create-fields";
import Link from "next/link";
import { AdminMutationForm } from "../../shared/ui/admin-mutation-form";
import type { AdminFormState } from "../../shared/validation/admin-form-state";
import { Pencil, Plus, X } from "lucide-react";
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
  createdFieldId?: string;
  mutationError?: string;
  updatedFieldId?: string;
  expectedActive?: string;
  createAction: (state: AdminFormState, data: FormData) => Promise<AdminFormState>;
  updateAction: Action;
  addValueAction: Action;
  removeValueAction: Action;
  deletionEnabled?: boolean;
  deletionOperationId?: string;
  deletionContext?: {organizationId:string;shopId:string;locale:string;shopName:string};
  deactivationContext?: {organizationId:string;shopId:string;locale:string;shopName:string};
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

export function CatalogAttributesFeaturesPage({
  data,
  categories,
  filters,
  createdFieldId,
  mutationError,
  updatedFieldId,
  expectedActive,
  createAction,
  updateAction,
  addValueAction,
  removeValueAction,
  deactivationContext,
  deletionContext,
  deletionOperationId,
  deletionEnabled,
}: Props) {
  const updatedField = updatedFieldId ? data.fields.find(field => field.fieldId === updatedFieldId) : undefined;
  const updateConfirmed = Boolean(updatedFieldId && (expectedActive === "true" || expectedActive === "false"));
  const updatePending = updateConfirmed && (!updatedField || updatedField.isActive !== (expectedActive === "true"));
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
  const createdFieldVisible = Boolean(createdFieldId && data.fields.some(field => field.fieldId === createdFieldId));
  const refreshCreationHref = `${closeDrawerHref}${createdFieldId ? `&createdFieldId=${encodeURIComponent(createdFieldId)}` : ""}`;

  return (
    <main className={`adminPage productListPage adminFeaturePage ${showDrawer ? "adminFeaturePageWithDrawer" : ""}`}>
      <div className="adminFeatureContent">
        {createdFieldId ? <div className="adminBanner adminBannerInfo" role="status">
          <p>{createdFieldVisible ? "Registro creado y disponible en el listado." : "Creación confirmada. El registro todavía no está disponible en el listado. No lo crees de nuevo."}</p>
          {!createdFieldVisible ? <Link className="adminButton adminButtonTiny" href={refreshCreationHref}>Actualizar listado</Link> : null}
        </div> : null}
        <div className="adminBreadcrumb">{copy.breadcrumb}</div>
        <div className="adminPageHeader">
          <div>
            <h1 className="adminPageTitle">{copy.title}</h1>
          </div>
        </div>

        <div className="employeesToolbar adminFeatureToolbar">
          <nav aria-label="Tipo de dato catalogo" className="productEditorTabs pricingTabs">
            <Link aria-current={isAttributesTab ? "page" : undefined} className={`productEditorTab ${isAttributesTab ? "productEditorTabActive" : ""}`} href={featureHref(filters, { tab: "attributes", panel: "", fieldId: "" })}>
              Atributos
            </Link>
            <Link aria-current={!isAttributesTab ? "page" : undefined} className={`productEditorTab ${!isAttributesTab ? "productEditorTabActive" : ""}`} href={featureHref(filters, { tab: "features", panel: "", fieldId: "" })}>
              Caracteristicas
            </Link>
          </nav>
          <Link className="employeesTextAction" href={featureHref(filters, { panel: "create", fieldId: "" })}>
            {copy.create}
          </Link>
        </div>

        {deletionContext && deletionOperationId ? <FeatureDeletionStatusPanel key={`${deletionOperationId}:${deletionContext.shopId}`} operationId={deletionOperationId} {...deletionContext}/> : null}
        {updateConfirmed ? <div className={`adminBanner ${updatePending ? "adminBannerWarning" : "adminBannerSuccess"}`} role="status">
          {updatePending ? "El BFF confirmó el cambio de estado, pero el listado todavía no lo refleja. No repitas la operación; pulsa Refrescar para comprobar la lectura." : "El listado refleja el cambio de estado confirmado por el BFF."}
        </div> : null}
        {mutationError ? <div className="adminBanner adminBannerError" role="alert">{mutationError}</div> : null}

        {data.source === "unavailable" ? (
          <div className="adminBanner adminBannerError">
            <p>No se pudo conectar con el BFF para {isAttributesTab ? "atributos de combinacion" : "caracteristicas"}.</p>
            <p className="adminContextHint">{data.failedEndpoint}: {data.message}</p>
          </div>
        ) : null}

        <form aria-label="Filtros superiores" className="productListSearchPanel adminFeatureFilterBar" method="get">
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
          <Link className="productListToolbarTrigger" href={`/admin/catalogo/atributos-caracteristicas?${new URLSearchParams({tab, ...(updateConfirmed ? {updatedFieldId: updatedFieldId!, expectedActive: expectedActive!} : {})})}`}>
            Limpiar
          </Link>
        </form>

        <section className="productListGrid adminFeatureListArea" aria-label={copy.listTitle}>
          <div className="adminCardHeader productListGridHeader adminFeatureListHeader">
            <div>
              <h2>{copy.listTitle} ({activeFields.length})</h2>
            </div>
            <div className="adminButtonRow">
              <Link className="productListToolbarTrigger" href={`/admin/catalogo/atributos-caracteristicas?${new URLSearchParams({tab, ...(updateConfirmed ? {updatedFieldId: updatedFieldId!, expectedActive: expectedActive!} : {})})}`}>
                Refrescar
              </Link>
            </div>
          </div>


          {activeFields.length === 0 ? (
            <div className="adminEmptyState">
              <h2>Sin registros</h2>
              <p>{copy.empty}</p>
            </div>
          ) : (
            <div className="adminTableScroller adminFeatureTableShell">
              <table className="adminTable productListTable adminFeatureTable">
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
                        </div>
                      </td>
                      <td>
                        <div className="adminFeatureNameCell">
                          <strong>{field.groupName}</strong>
                        </div>
                      </td>
                      <td>
                        {activeValues(field).length > 0 ? (
                          <select
                            aria-label={`Valores de ${field.name}`}
                            className="adminFeatureValueSelect"
                            defaultValue=""
                          >
                            <option disabled value="">Ver valores ({activeValues(field).length})</option>
                            {activeValues(field).map((value) => (
                              <option key={value.fieldValueId} value={value.fieldValueId}>{value.name}</option>
                            ))}
                          </select>
                        ) : <span className="adminMuted">Sin valores</span>}
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
                          {field.isActive && deactivationContext ? <FeatureDeactivationButton key={`${field.fieldId}:${deactivationContext.shopId}:${deactivationContext.locale}`} {...deactivationContext} groupId={field.groupId} fieldId={field.fieldId} name={field.name} compact /> : null}
                          {deletionContext && deletionEnabled ? <FeatureDeletionButton key={`delete:${field.fieldId}:${deletionContext.shopId}`} {...deletionContext} groupId={field.groupId} fieldId={field.fieldId} name={field.name} compact/> : null}
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
        <AdminResourceDrawer drawerId={`catalog-definition-${tab}`} title={isCreatePanel ? copy.create : `${copy.edit}: ${selectedField?.fieldId.slice(0, 8)}`} description="Define los campos y valores del catálogo de la tienda actual." closeHref={closeDrawerHref}>
            {isCreatePanel ? (
              <AdminMutationForm action={createAction} label={copy.create} className="adminFeatureDrawerBody">
                <input name="tab" type="hidden" value={tab} />
                <div className="adminFeatureReadOnlyLine">
                  <span>ID</span>
                  <strong>Nuevo</strong>
                </div>
                <CatalogFeatureCreateFields categories={categories.items} groups={data.groups.map(group => ({ id: group.specificationGroupId, label: group.name, categoryIds: [group.categoryId, ...group.linkedCategoryIds] }))} namePlaceholder={copy.namePlaceholder} valuesLabel={copy.values} valuePlaceholder={copy.valuePlaceholder} groupPlaceholder={copy.groupPlaceholder} />
                <button className="adminButton adminButtonPrimary" type="submit">
                  Guardar cambios
                </button>
              </AdminMutationForm>
            ) : null}

            {isEditPanel && selectedField ? (
              <div className="adminFeatureDrawerBody">
                <div className="adminFeatureReadOnlyLine">
                  <span>ID</span>
                  <strong>{selectedField.fieldId.slice(0, 8)}</strong>
                </div>
                <form action={updateAction} aria-label={`Editar ${selectedField.name}`} className="adminFeatureDrawerStack">
                  <input name="tab" type="hidden" value={tab} />
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
                  <FeatureToggles field={selectedField} preventDeactivation />
                  <button className="adminButton adminButtonPrimary" type="submit">
                    Guardar cambios
                  </button>
                </form>

                <section className="adminFeatureDrawerStack" aria-label={`${copy.values} de ${selectedField.name}`}>
                  <span className="adminFeatureDrawerLabel">{copy.values}</span>
                  <FieldValueChips field={selectedField} removeValueAction={removeValueAction} />
                  <form action={addValueAction} aria-label={`Anadir valor ${selectedField.name}`} className="adminFeatureAddValueForm">
                    <input name="tab" type="hidden" value={tab} />
                    <input name="groupId" type="hidden" value={selectedField.groupId} />
                    <input name="fieldId" type="hidden" value={selectedField.fieldId} />
                    <input aria-label={`Nuevo valor ${selectedField.name}`} name="value" placeholder="Nuevo valor" />
                    <button aria-label={`Anadir valor ${selectedField.name}`} className="adminIconButton" title="Anadir valor" type="submit">
                      <Plus aria-hidden="true" size={16} />
                    </button>
                  </form>
                </section>

                {selectedField.isActive && deactivationContext ? <FeatureDeactivationButton key={`${selectedField.fieldId}:${deactivationContext.shopId}:${deactivationContext.locale}`} {...deactivationContext} groupId={selectedField.groupId} fieldId={selectedField.fieldId} name={selectedField.name} /> : null}
                {deletionContext && deletionEnabled ? <FeatureDeletionButton key={`delete:${selectedField.fieldId}:${deletionContext.shopId}`} {...deletionContext} groupId={selectedField.groupId} fieldId={selectedField.fieldId} name={selectedField.name}/> : null}
              </div>
            ) : null}
        </AdminResourceDrawer>
      ) : null}
    </main>
  );
}

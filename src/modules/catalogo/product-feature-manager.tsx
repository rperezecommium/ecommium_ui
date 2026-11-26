"use client";
import { useState } from "react";
import { AdminResourceDrawer } from "../../shared/ui/admin-resource-drawer";
import { AdminMutationForm } from "../../shared/ui/admin-mutation-form";
import { CatalogFeatureCreateFields } from "./catalog-feature-create-fields";
import {
  addProductFeatureValueAction,
  linkProductFeatureGroupAction,
  createProductFeatureAction,
} from "./product-feature-actions";
import type { productSpecificationCatalog } from "./product-specification-fields";
import type {
  ProductLookupOption,
  ProductSpecificationLookupField,
} from "./product-editor-types";

type Catalog = ReturnType<typeof productSpecificationCatalog>;
export function ProductFeatureManager({
  mode = "features",
  categoryId,
  categories,
  groups,
  fields,
  onChange,
  onClose,
}: {
  mode?: "features" | "attributes";
  categoryId: string;
  categories: ProductLookupOption[];
  groups: Catalog["groups"];
  fields: ProductSpecificationLookupField[];
  onChange: (catalog: Catalog) => void;
  onClose: () => void;
}) {
  const itemLabel = mode === "attributes" ? "atributo" : "característica";
  const [tab, setTab] = useState<"create" | "values" | "link">("create");
  return (
    <AdminResourceDrawer drawerId={`product-${mode}-manager`}
      className="productFeatureManager"
      title={mode === "attributes" ? "Administrar atributos" : "Administrar características"}
      description="Los cambios se guardan en el catálogo de la tienda actual. Tu producto permanece en edición."
      onClose={onClose}
    >
      <div className="adminFeatureDrawerBody">
        <div className="adminButtonRow">
          <button
            type="button"
            className="adminButton"
            aria-pressed={tab === "create"}
            onClick={() => setTab("create")}
          >
            Crear {itemLabel}
          </button>
          <button
            type="button"
            className="adminButton"
            aria-pressed={tab === "values"}
            onClick={() => setTab("values")}
          >
            Añadir valores
          </button>
          <button
            type="button"
            className="adminButton"
            aria-pressed={tab === "link"}
            onClick={() => setTab("link")}
          >
            Vincular grupo
          </button>
        </div>
        {tab === "create" ? (
          <AdminMutationForm
            label={`Crear ${itemLabel} desde producto`}
            action={async (_state, form) => {
              const result = await createProductFeatureAction(form);
              if (result.catalog) onChange(result.catalog);
              return result.state;
            }}
          >
            <input name="tab" type="hidden" value={mode} />
            <CatalogFeatureCreateFields
              categories={categories}
              groups={groups.map((group) => ({
                id: group.groupId,
                label: group.name,
                categoryIds: group.categoryIds,
              }))}
              defaultCategoryId={categoryId}
            />
            <button type="submit" className="adminButton adminButtonPrimary">
              Crear {itemLabel}
            </button>
          </AdminMutationForm>
        ) : tab === "link" ? (
          <AdminMutationForm
            label="Vincular grupo a la categoría"
            action={async (_state, form) => {
              const result = await linkProductFeatureGroupAction(form);
              if (result.catalog) onChange(result.catalog);
              return result.state;
            }}
          >
            <p>
              Comparte un grupo existente con{" "}
              {categories.find((category) => category.id === categoryId)
                ?.label ?? "la categoría del producto"}
              . Sus campos estarán disponibles para todos los productos de esta
              categoría. Los valores de cada producto se completan por separado.
            </p>
            <input name="tab" type="hidden" value={mode} />
            <input name="categoryId" type="hidden" value={categoryId} />
            <label className="adminField">
              <span>Grupo para compartir</span>
              <select name="groupId" required disabled={!categoryId}>
                <option value="">Seleccionar grupo</option>
                {groups
                  .filter(
                    (group) =>
                      !group.categoryIds.includes(categoryId) &&
                      fields.some((field) => field.groupId === group.groupId),
                  )
                  .map((group) => (
                    <option key={group.groupId} value={group.groupId}>
                      {group.name} ·{" "}
                      {fields
                        .filter((field) => field.groupId === group.groupId)
                        .map((field) => field.name)
                        .join(", ")}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="submit"
              className="adminButton adminButtonPrimary"
              disabled={!categoryId}
            >
              Vincular a esta categoría
            </button>
          </AdminMutationForm>
        ) : (
          <div className="adminFeatureDrawerStack">
            {fields.length === 0 ? (
              <p>No hay campos disponibles.</p>
            ) : (
              fields.map((field) => (
                <section key={field.fieldId}>
                  <h3>
                    {field.groupName} · {field.name}
                  </h3>
                  <p className="adminContextHint">
                    {field.values.map((value) => value.name).join(", ") ||
                      "Sin valores"}
                  </p>
                  <AdminMutationForm
                    label={`Añadir valor a ${field.name}`}
                    action={async (_state, form) => {
                      const result = await addProductFeatureValueAction(form);
                      if (result.catalog) onChange(result.catalog);
                      return result.state;
                    }}
                  >
                    <input name="tab" type="hidden" value={mode} />
                    <input name="groupId" type="hidden" value={field.groupId} />
                    <input name="fieldId" type="hidden" value={field.fieldId} />
                    <label className="adminField">
                      <span>Nuevo valor para {field.name}</span>
                      <input name="value" required maxLength={200} />
                    </label>
                    <button className="adminButton" type="submit">
                      Añadir valor
                    </button>
                  </AdminMutationForm>
                </section>
              ))
            )}
          </div>
        )}
      </div>
    </AdminResourceDrawer>
  );
}

"use client";
import { useState } from "react";
import { MutationField } from "../../shared/ui/admin-mutation-form";

type Option = { id: string; label: string };
export function FeatureToggles({
  field,
  preventDeactivation = false,
}: {
  preventDeactivation?: boolean;
  field?: { isActive: boolean; isFilter: boolean; isOnProductDetails: boolean };
}) {
  return (
    <div className="adminFeatureToggleGroup">
      <label className="adminSwitch">
        <input
          disabled={preventDeactivation && field?.isActive}
          defaultChecked={field?.isActive ?? true}
          name="isActive"
          type="checkbox"
        />
        {preventDeactivation && field?.isActive ? <input type="hidden" name="isActive" value="true" /> : null}
        <span>Activa</span>
      </label>
      <label className="adminSwitch">
        <input
          defaultChecked={field?.isFilter ?? true}
          name="isFilter"
          type="checkbox"
        />
        <span>Filtrable</span>
      </label>
      <label className="adminSwitch">
        <input
          defaultChecked={field?.isOnProductDetails ?? true}
          name="isOnProductDetails"
          type="checkbox"
        />
        <span>Visible en ficha</span>
      </label>
    </div>
  );
}
export function CatalogFeatureCreateFields({
  categories,
  groups,
  defaultCategoryId = "",
  namePlaceholder = "Material",
  valuesLabel = "Valores disponibles",
  valuePlaceholder = "Aluminio, carbono",
  groupPlaceholder = "Datos técnicos",
}: {
  categories: Option[];
  groups: Array<Option & { categoryIds?: string[] }>;
  defaultCategoryId?: string;
  namePlaceholder?: string;
  valuesLabel?: string;
  valuePlaceholder?: string;
  groupPlaceholder?: string;
}) {
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [groupId, setGroupId] = useState("");
  const availableGroups = groups.filter(
    (group) => !group.categoryIds || group.categoryIds.includes(categoryId),
  );
  return (
    <>
      <MutationField name="name" label="Nombre">
        <input
          name="name"
          placeholder={namePlaceholder}
          required
          maxLength={200}
        />
      </MutationField>
      <MutationField name="categoryId" label="Categoría">
        <select
          name="categoryId"
          required
          value={categoryId}
          onChange={(event) => {
            setCategoryId(event.target.value);
            setGroupId("");
          }}
        >
          <option value="">Seleccionar categoría</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>
      </MutationField>
      <label className="adminField">
        <span>Grupo</span>
        <select
          name="groupId"
          value={groupId}
          onChange={(event) => setGroupId(event.target.value)}
        >
          <option value="">Crear grupo nuevo</option>
          {availableGroups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.label}
            </option>
          ))}
        </select>
      </label>
      {!groupId ? (
        <MutationField name="groupName" label="Nombre del grupo nuevo">
          <input
            name="groupName"
            placeholder={groupPlaceholder}
            required
            maxLength={200}
          />
        </MutationField>
      ) : null}
      <MutationField name="values" label={valuesLabel}>
        <input
          name="values"
          placeholder={valuePlaceholder}
          required
          maxLength={4000}
        />
      </MutationField>
      <p className="adminContextHint">
        Separa los valores con comas. Incluye la unidad cuando corresponda, por
        ejemplo «10 kg».
      </p>
      <FeatureToggles />
    </>
  );
}

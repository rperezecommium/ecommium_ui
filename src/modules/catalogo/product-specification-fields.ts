import type { ProductSpecificationLookupField } from "./product-editor-types";
import type { CatalogSpecificationGroup } from "./catalog-attributes-features";

export function productSpecificationCatalog(
  groups: CatalogSpecificationGroup[],
  tab: "features" | "attributes" = "features",
) {
  const activeGroups = groups.filter((group) => group.isActive);
  return {
    groups: activeGroups.map((group) => ({
      groupId: group.specificationGroupId,
      name: group.name,
      categoryIds: [
        ...new Set(
          [group.categoryId, ...group.linkedCategoryIds].filter(Boolean),
        ),
      ],
    })),
    fields: activeGroups.flatMap((group) =>
      group.fields
        .filter((field) => field.isActive && (tab === "attributes" ? field.isStockKeepingUnit : !field.isStockKeepingUnit))
        .map((field) => ({
          fieldId: field.fieldId,
          groupId: group.specificationGroupId,
          groupName: group.name,
          categoryIds: [
            ...new Set(
              [group.categoryId, ...group.linkedCategoryIds].filter(Boolean),
            ),
          ],
          name: field.name,
          isStockKeepingUnit: field.isStockKeepingUnit,
          isActive: true,
          values: field.values
            .filter((value) => value.isActive)
            .map((value) => ({
              fieldValueId: value.fieldValueId,
              name: value.name,
              isActive: true,
            })),
        })),
    ),
  };
}

export function groupProductSpecificationFields(
  fields: ProductSpecificationLookupField[],
  categoryId: string,
  selectedIds: string[],
) {
  const suggested = fields.filter(
    (field) =>
      field.isActive &&
      !field.isStockKeepingUnit &&
      Boolean(categoryId) &&
      field.categoryIds?.includes(categoryId),
  );
  const additional = fields.filter(
    (field) =>
      selectedIds.includes(field.fieldId) &&
      !suggested.some((item) => item.fieldId === field.fieldId),
  );
  function grouped(items: ProductSpecificationLookupField[]) {
    const groups = new Map<
      string,
      {
        groupId: string;
        name: string;
        fields: ProductSpecificationLookupField[];
      }
    >();
    for (const field of items) {
      const group = groups.get(field.groupId) ?? {
        groupId: field.groupId,
        name: field.groupName,
        fields: [],
      };
      group.fields.push(field);
      groups.set(field.groupId, group);
    }
    return [...groups.values()];
  }
  return { suggested: grouped(suggested), additional: grouped(additional) };
}

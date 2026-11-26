"use server";
import { getCurrentAdminSession } from "../auth/current-admin-session";
import { getAdminContext } from "../../shared/config/admin-context";
import {
  formFailure,
  type AdminFormState,
} from "../../shared/validation/admin-form-state";
import {
  addCatalogSpecificationValue,
  linkCatalogSpecificationGroupToCategory,
  createCatalogSpecificationField,
  getCatalogSpecificationGroup,
  listCatalogAttributeFeatureData,
} from "./catalog-attributes-features";
import { productSpecificationCatalog } from "./product-specification-fields";

const text = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.trim() : "";
const checked = (value: FormDataEntryValue | null) =>
  value === "on" || value === "true";
async function canWrite() {
  const session = await getCurrentAdminSession();
  return Boolean(
    session?.permissions.some((permission) =>
      ["*", "admin:*", "system.admin", "catalog.specifications.write"].includes(
        permission,
      ),
    ),
  );
}
export async function loadProductFeaturesAction(tab: "features" | "attributes" = "features") {
  if (!(await getCurrentAdminSession()))
    return { ok: false as const, message: "Tu sesión no está disponible." };
  const context = await getAdminContext();
  const data = await listCatalogAttributeFeatureData(context);
  return data.source === "unavailable"
    ? {
        ok: false as const,
        message: data.message ?? "No se pudieron cargar las características.",
      }
    : { ok: true as const, catalog: productSpecificationCatalog(data.groups, tab) };
}
export async function createProductFeatureAction(form: FormData) {
  if (!(await canWrite()))
    return {
      state: {
        error: "No tienes permiso para administrar características.",
      } as AdminFormState,
    };
  const tab = form.get("tab") === "attributes" ? "attributes" : "features";
  const name = text(form.get("name")),
    categoryId = text(form.get("categoryId")),
    groupId = text(form.get("groupId")),
    groupName = text(form.get("groupName"));
  const values = text(form.get("values"))
    .split(/[,\r\n]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const fieldErrors: Record<string, string> = {};
  if (!name || name.length > 200)
    fieldErrors.name = "Introduce un nombre de hasta 200 caracteres.";
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(categoryId))
    fieldErrors.categoryId = "Selecciona una categoría válida.";
  if (!groupId && (!groupName || groupName.length > 200))
    fieldErrors.groupName = "Introduce el nombre del grupo.";
  if (
    !values.length ||
    values.length > 100 ||
    values.some((value) => value.length > 200)
  )
    fieldErrors.values =
      "Introduce entre 1 y 100 valores, de hasta 200 caracteres cada uno.";
  if (Object.keys(fieldErrors).length)
    return {
      state: {
        error: "Revisa los campos indicados.",
        fieldErrors,
      } as AdminFormState,
    };
  try {
    const context = await getAdminContext();
    if (groupId) {
      const group = await getCatalogSpecificationGroup(context, groupId);
      if (
        !group.ok ||
        !group.data.isActive ||
        ![group.data.categoryId, ...group.data.linkedCategoryIds].includes(
          categoryId,
        )
      )
        return {
          state: {
            error: "El grupo no está disponible para esta categoría.",
          } as AdminFormState,
        };
    }
    const result = await createCatalogSpecificationField(context, {
      tab,
      name,
      categoryId,
      groupId,
      groupName,
      values,
      isActive: checked(form.get("isActive")),
      isFilter: checked(form.get("isFilter")),
      isOnProductDetails: checked(form.get("isOnProductDetails")),
    });
    if (!result.ok)
      return {
        state: {
          error: `No se pudo crear ${tab === "attributes" ? "el atributo" : "la característica"}. ${result.error}`,
        } as AdminFormState,
      };
    const created = result.data.fields.find(
      (field) =>
        field.name === name && field.isStockKeepingUnit === (tab === "attributes") && field.fieldId,
    );
    if (!created)
      return {
        state: {
          error:
            `El BFF no confirmó ${tab === "attributes" ? "el atributo" : "la característica"}. Comprueba el catálogo antes de reintentar.`,
        } as AdminFormState,
      };
    return {
      state: {
        success: tab === "attributes" ? "Atributo creado en el catálogo." : "Característica creada en el catálogo.",
      } as AdminFormState,
      catalog: productSpecificationCatalog([result.data], form.get("tab") === "attributes" ? "attributes" : "features"),
    };
  } catch (error) {
    return { state: formFailure(error) };
  }
}
export async function addProductFeatureValueAction(form: FormData) {
  if (!(await canWrite()))
    return {
      state: {
        error: "No tienes permiso para administrar características.",
      } as AdminFormState,
    };
  const groupId = text(form.get("groupId")),
    fieldId = text(form.get("fieldId")),
    value = text(form.get("value"));
  if (!groupId || !fieldId || !value || value.length > 200)
    return {
      state: {
        error: "Introduce un valor de hasta 200 caracteres.",
      } as AdminFormState,
    };
  try {
    const result = await addCatalogSpecificationValue(await getAdminContext(), {
      groupId,
      fieldId,
      value,
    });
    if (!result.ok)
      return {
        state: {
          error: `No se pudo añadir el valor. ${result.error}`,
        } as AdminFormState,
      };
    return {
      state: { success: "Valor añadido." } as AdminFormState,
      catalog: productSpecificationCatalog([result.data], form.get("tab") === "attributes" ? "attributes" : "features"),
    };
  } catch (error) {
    return { state: formFailure(error) };
  }
}

export async function linkProductFeatureGroupAction(form: FormData) {
  if (!(await canWrite()))
    return {
      state: {
        error: "No tienes permiso para administrar características.",
      } as AdminFormState,
    };
  const groupId = text(form.get("groupId")),
    categoryId = text(form.get("categoryId"));
  if (
    !groupId ||
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(categoryId)
  )
    return {
      state: {
        error: "Selecciona un grupo y una categoría válidos.",
      } as AdminFormState,
    };
  try {
    const result = await linkCatalogSpecificationGroupToCategory(
      await getAdminContext(),
      groupId,
      categoryId,
    );
    if (!result.ok)
      return {
        state: {
          error: `No se pudo vincular el grupo. ${result.error}`,
        } as AdminFormState,
      };
    if (
      ![result.data.categoryId, ...result.data.linkedCategoryIds].includes(
        categoryId,
      )
    )
      return {
        state: {
          error: "El BFF no confirmó la vinculación.",
        } as AdminFormState,
      };
    return {
      state: {
        success:
          "Grupo vinculado a la categoría. Sus campos ya están disponibles en la ficha.",
      } as AdminFormState,
      catalog: productSpecificationCatalog([result.data], form.get("tab") === "attributes" ? "attributes" : "features"),
    };
  } catch (error) {
    return { state: formFailure(error) };
  }
}

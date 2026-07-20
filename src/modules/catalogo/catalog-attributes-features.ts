import { requestBff } from "../../shared/bff/client";
import type { BffResult } from "../../shared/bff/types";
import type { AdminContext } from "../../shared/config/admin-context";
import { plainProductText, slugifyProductValue } from "./product-editor-draft";

export type CatalogAttributeFeatureTab = "attributes" | "features";

export type CatalogSpecificationValue = {
  fieldValueId: string;
  name: string;
  text?: string | null;
  isActive: boolean;
  position: number;
};

export type CatalogSpecificationField = {
  fieldId: string;
  groupId: string;
  groupName: string;
  categoryId: string;
  fieldTypeId: number;
  name: string;
  description: string;
  position: number;
  isFilter: boolean;
  isRequired: boolean;
  isOnProductDetails: boolean;
  isStockKeepingUnit: boolean;
  isActive: boolean;
  defaultValue?: string | null;
  values: CatalogSpecificationValue[];
};

export type CatalogSpecificationGroup = {
  specificationGroupId: string;
  categoryId: string;
  name: string;
  isActive: boolean;
  fields: CatalogSpecificationField[];
  linkedCategoryIds: string[];
};

export type CatalogAttributeFeatureFilters = {
  tab: CatalogAttributeFeatureTab;
  id?: string;
  q?: string;
  group?: string;
  status?: string;
  panel?: "create" | "edit" | "";
  fieldId?: string;
};

export type CatalogAttributeFeatureData = {
  groups: CatalogSpecificationGroup[];
  fields: CatalogSpecificationField[];
  source: "bff" | "unavailable";
  message?: string;
  failedEndpoint?: string;
  correlationId?: string;
};

export type SpecificationFieldPayload = {
  fieldId?: string;
  fieldTypeId: number;
  name: string;
  description: string;
  position: number;
  isFilter: boolean;
  isRequired: boolean;
  isOnProductDetails: boolean;
  isStockKeepingUnit: boolean;
  isActive: boolean;
  isTopMenuLinkActive: boolean;
  isSideMenuLinkActive: boolean;
  defaultValue?: string | null;
  values: Array<{
    fieldValueId?: string;
    name: string;
    text?: string | null;
    isActive: boolean;
    position: number;
  }>;
};

type GroupPayload = {
  name: string;
  categoryId: string;
  linkedCategoryIds: string[];
  isActive: boolean;
  fields: SpecificationFieldPayload[];
};

type BffSuccess<T> = Extract<BffResult<T>, { ok: true }>;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function listItems(value: unknown): unknown[] {
  const record = asRecord(value);
  const items = record.items ?? value;
  return Array.isArray(items) ? items : [];
}

function textValue(value: unknown, locale = "es-ES") {
  if (typeof value === "string" && value.trim()) {
    return plainProductText(value);
  }
  const record = asRecord(value);
  return (
    asString(record[locale]) ??
    asString(record["es-ES"]) ??
    asString(record.es) ??
    asString(record.default)
  );
}

function makeScopedParams(context: AdminContext, extra: Record<string, string> = {}) {
  const params = new URLSearchParams(extra);
  if (context.organizationId) {
    params.set("organizationId", context.organizationId);
  }
  if (context.shopId) {
    params.set("shopId", context.shopId);
  }
  if (context.locale) {
    params.set("locale", context.locale);
  }
  return params;
}

function parseValue(value: unknown, locale: string): CatalogSpecificationValue {
  const record = asRecord(value);
  const fieldValueId = asString(record.fieldValueId) ?? asString(record.id) ?? "";
  return {
    fieldValueId,
    name: textValue(record.name, locale) ?? fieldValueId,
    text: textValue(record.text, locale) ?? null,
    isActive: asBoolean(record.isActive, true),
    position: asNumber(record.position, 0),
  };
}

function parseGroup(value: unknown, locale: string): CatalogSpecificationGroup {
  const record = asRecord(value);
  const groupId = asString(record.specificationGroupId) ?? asString(record.groupId) ?? "";
  const groupName = textValue(record.name, locale) ?? groupId;
  const categoryId = asString(record.categoryId) ?? "";
  const fields = listItems(record.fields).map((fieldValue) => {
    const field = asRecord(fieldValue);
    const fieldId = asString(field.fieldId) ?? "";
    const name = textValue(field.name, locale) ?? fieldId;
    return {
      fieldId,
      groupId,
      groupName,
      categoryId,
      fieldTypeId: asNumber(field.fieldTypeId, 1),
      name,
      description: textValue(field.description, locale) ?? name,
      position: asNumber(field.position, 0),
      isFilter: asBoolean(field.isFilter),
      isRequired: asBoolean(field.isRequired),
      isOnProductDetails: asBoolean(field.isOnProductDetails, true),
      isStockKeepingUnit: asBoolean(field.isStockKeepingUnit),
      isActive: asBoolean(field.isActive, true),
      defaultValue: textValue(field.defaultValue, locale) ?? null,
      values: listItems(field.values)
        .map((item) => parseValue(item, locale))
        .filter((item) => item.fieldValueId)
        .sort((left, right) => left.position - right.position),
    };
  }).filter((field) => field.fieldId);

  return {
    specificationGroupId: groupId,
    categoryId,
    name: groupName,
    isActive: asBoolean(record.isActive, true),
    fields,
    linkedCategoryIds: listItems(record.linkedCategoryIds).map(String),
  };
}

function fieldToPayload(field: CatalogSpecificationField): SpecificationFieldPayload {
  return {
    fieldId: field.fieldId,
    fieldTypeId: field.fieldTypeId || 1,
    name: field.name,
    description: field.description || field.name,
    position: field.position,
    isFilter: field.isFilter,
    isRequired: field.isRequired,
    isOnProductDetails: field.isOnProductDetails,
    isStockKeepingUnit: field.isStockKeepingUnit,
    isActive: field.isActive,
    isTopMenuLinkActive: false,
    isSideMenuLinkActive: false,
    defaultValue: field.defaultValue ?? null,
    values: field.values.length > 0
      ? field.values.map((value) => ({
          fieldValueId: value.fieldValueId,
          name: value.name,
          text: value.text ?? null,
          isActive: value.isActive,
          position: value.position,
        }))
      : [{ name: "Default", text: null, isActive: true, position: 0 }],
  };
}

function groupToPayload(group: CatalogSpecificationGroup, fields: SpecificationFieldPayload[]): GroupPayload {
  return {
    name: group.name,
    categoryId: group.categoryId,
    linkedCategoryIds: group.linkedCategoryIds.length ? group.linkedCategoryIds : [group.categoryId],
    isActive: group.isActive,
    fields,
  };
}

export function filterAttributeFeatureFields(
  fields: CatalogSpecificationField[],
  filters: CatalogAttributeFeatureFilters,
) {
  const normalizedId = filters.id?.trim().toLowerCase();
  const normalizedQ = filters.q?.trim().toLowerCase();
  const normalizedGroup = filters.group?.trim().toLowerCase();
  const status = filters.status ?? "active";

  return fields
    .filter((field) => filters.tab === "attributes" ? field.isStockKeepingUnit : !field.isStockKeepingUnit)
    .filter((field) => !normalizedId || field.fieldId.toLowerCase().includes(normalizedId))
    .filter((field) => !normalizedQ || field.name.toLowerCase().includes(normalizedQ))
    .filter((field) => !normalizedGroup || field.groupName.toLowerCase().includes(normalizedGroup))
    .filter((field) => status === "all" || (status === "inactive" ? !field.isActive : field.isActive))
    .sort((left, right) => left.position - right.position || left.name.localeCompare(right.name));
}

export async function listCatalogAttributeFeatureData(
  context: AdminContext,
): Promise<CatalogAttributeFeatureData> {
  const params = makeScopedParams(context, { limit: "100", offset: "0" });
  const endpoint = `/admin/specifications/groups?${params.toString()}`;
  const result = await requestBff(endpoint, {
    context,
    parse: (value) => listItems(value),
  });

  if (!result.ok) {
    return {
      groups: [],
      fields: [],
      source: "unavailable",
      message: result.error,
      failedEndpoint: endpoint,
      correlationId: result.correlationId,
    };
  }

  const summaries = result.data.map(asRecord);
  const detailResults = await Promise.all(summaries.map((summary) => {
    const groupId = asString(summary.specificationGroupId);
    if (!groupId) {
      return Promise.resolve(null);
    }
    const detailEndpoint = `/admin/specifications/groups/${encodeURIComponent(groupId)}?${makeScopedParams(context).toString()}`;
    return requestBff(detailEndpoint, {
      context,
      parse: (value) => parseGroup(value, context.locale),
    });
  }));
  const groups = detailResults
    .filter((detail): detail is BffSuccess<CatalogSpecificationGroup> => Boolean(detail && detail.ok))
    .map((detail) => detail.data);

  return {
    groups,
    fields: groups.flatMap((group) => group.fields),
    source: "bff",
    correlationId: result.correlationId,
  };
}

export async function getCatalogSpecificationGroup(context: AdminContext, groupId: string) {
  const endpoint = `/admin/specifications/groups/${encodeURIComponent(groupId)}?${makeScopedParams(context).toString()}`;
  return requestBff(endpoint, {
    context,
    parse: (value) => parseGroup(value, context.locale),
  });
}

export async function createCatalogSpecificationField(
  context: AdminContext,
  input: {
    tab: CatalogAttributeFeatureTab;
    groupId?: string;
    groupName?: string;
    categoryId: string;
    name: string;
    values: string[];
    isActive: boolean;
    isFilter: boolean;
    isOnProductDetails: boolean;
  },
) {
  const name = plainProductText(input.name);
  const values = input.values.map(plainProductText).filter(Boolean);
  const fieldPayload: SpecificationFieldPayload = {
    fieldTypeId: 1,
    name,
    description: name,
    position: 0,
    isFilter: input.isFilter,
    isRequired: false,
    isOnProductDetails: input.isOnProductDetails,
    isStockKeepingUnit: input.tab === "attributes",
    isActive: input.isActive,
    isTopMenuLinkActive: false,
    isSideMenuLinkActive: false,
    defaultValue: null,
    values: (values.length ? values : ["Default"]).map((value, index) => ({
      name: value,
      text: null,
      isActive: true,
      position: index,
    })),
  };

  if (input.groupId) {
    const current = await getCatalogSpecificationGroup(context, input.groupId);
    if (!current.ok) {
      return current;
    }
    const nextFields = [
      ...current.data.fields.map(fieldToPayload),
      { ...fieldPayload, position: current.data.fields.length + 1 },
    ];
    const endpoint = `/admin/specifications/groups/${encodeURIComponent(input.groupId)}?${makeScopedParams(context).toString()}`;
    return requestBff(endpoint, {
      context,
      init: {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(groupToPayload(current.data, nextFields)),
      },
      parse: (value) => parseGroup(value, context.locale),
    });
  }

  const groupName = plainProductText(input.groupName || `${name} group`);
  const endpoint = `/admin/specifications/groups?${makeScopedParams(context).toString()}`;
  return requestBff(endpoint, {
    context,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: groupName,
        categoryId: input.categoryId,
        linkedCategoryIds: [input.categoryId],
        isActive: true,
        fields: [fieldPayload],
        slug: slugifyProductValue(groupName),
      }),
    },
    parse: (value) => parseGroup(value, context.locale),
  });
}

export async function updateCatalogSpecificationField(
  context: AdminContext,
  input: {
    groupId: string;
    fieldId: string;
    name: string;
    isActive: boolean;
    isFilter: boolean;
    isOnProductDetails: boolean;
  },
) {
  const current = await getCatalogSpecificationGroup(context, input.groupId);
  if (!current.ok) {
    return current;
  }
  const nextFields = current.data.fields.map((field) => {
    const payload = fieldToPayload(field);
    if (field.fieldId !== input.fieldId) {
      return payload;
    }
    const name = plainProductText(input.name);
    return {
      ...payload,
      name,
      description: name,
      isActive: input.isActive,
      isFilter: input.isFilter,
      isOnProductDetails: input.isOnProductDetails,
    };
  });
  const endpoint = `/admin/specifications/groups/${encodeURIComponent(input.groupId)}?${makeScopedParams(context).toString()}`;
  return requestBff(endpoint, {
    context,
    init: {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(groupToPayload(current.data, nextFields)),
    },
    parse: (value) => parseGroup(value, context.locale),
  });
}

export async function addCatalogSpecificationValue(
  context: AdminContext,
  input: {
    groupId: string;
    fieldId: string;
    value: string;
  },
) {
  const current = await getCatalogSpecificationGroup(context, input.groupId);
  if (!current.ok) {
    return current;
  }
  const nextFields = current.data.fields.map((field) => {
    const payload = fieldToPayload(field);
    if (field.fieldId !== input.fieldId) {
      return payload;
    }
    return {
      ...payload,
      values: [
        ...payload.values,
        {
          name: plainProductText(input.value),
          text: null,
          isActive: true,
          position: payload.values.length + 1,
        },
      ],
    };
  });
  const endpoint = `/admin/specifications/groups/${encodeURIComponent(input.groupId)}?${makeScopedParams(context).toString()}`;
  return requestBff(endpoint, {
    context,
    init: {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(groupToPayload(current.data, nextFields)),
    },
    parse: (value) => parseGroup(value, context.locale),
  });
}

export async function removeCatalogSpecificationValue(
  context: AdminContext,
  input: {
    groupId: string;
    fieldId: string;
    fieldValueId: string;
  },
) {
  const current = await getCatalogSpecificationGroup(context, input.groupId);
  if (!current.ok) {
    return current;
  }
  const nextFields = current.data.fields.map((field) => {
    const payload = fieldToPayload(field);
    if (field.fieldId !== input.fieldId) {
      return payload;
    }
    return {
      ...payload,
      values: payload.values.map((value) =>
        value.fieldValueId === input.fieldValueId
          ? { ...value, isActive: false }
          : value,
      ),
    };
  });
  const endpoint = `/admin/specifications/groups/${encodeURIComponent(input.groupId)}?${makeScopedParams(context).toString()}`;
  return requestBff(endpoint, {
    context,
    init: {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(groupToPayload(current.data, nextFields)),
    },
    parse: (value) => parseGroup(value, context.locale),
  });
}

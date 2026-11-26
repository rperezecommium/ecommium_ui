import { templateReceiptMatches } from "./cms-composition-template-copy";
import "server-only";
import Ajv from "ajv";
import schema from "../../../docs/contracts/cms-composition-boundary.schema.json";
import { requestAdminBff } from "../../shared/bff/admin-client";
import type { AdminContext } from "../../shared/config/admin-context";
import type {
  CmsTemplateReceipt,
  CmsTemplateList,
  CmsTemplateCommand,
} from "./cms-composition-template-types";
const validators = Object.fromEntries(
  [
    "templateCreate",
    "templateUpdate",
    "templateArchive",
    "templateReceipt",
  ].map((name) => [
    name,
    new Ajv({ allErrors: true }).compile({
      definitions: schema.definitions,
      $ref: `#/definitions/${name}`,
    }),
  ]),
);
function validate(kind: string, value: unknown) {
  const json = JSON.stringify(value);
  if (
    !json ||
    Buffer.byteLength(json, "utf8") > 1048576 ||
    !validators[kind]?.(value)
  )
    throw new Error(
      "La plantilla no cumple el contrato. Revisa sus campos y referencias.",
    );
}
function receipt(
  value: unknown,
  context: AdminContext,
  id?: string,
): CmsTemplateReceipt {
  validate("templateReceipt", value);
  const result = value as CmsTemplateReceipt;
  if (
    result.context.organizationId !== context.organizationId ||
    result.context.shopId !== context.shopId ||
    result.context.locale !== context.locale ||
    (id && result.resourceId !== id)
  )
    throw new Error(
      "El recibo no corresponde a la plantilla y al contexto solicitados.",
    );
  return result;
}
function query(context: AdminContext) {
  return new URLSearchParams({
    organizationId: context.organizationId,
    shopId: context.shopId,
    locale: context.locale,
  });
}
export async function listCompositionTemplates(
  context: AdminContext,
  offset = 0,
  status: "DRAFT" | "ARCHIVED" = "DRAFT",
) {
  const params = query(context);
  params.set("limit", "50");
  params.set("status", status);
  params.set("offset", String(offset));
  return requestAdminBff<CmsTemplateList>(
    `/admin/cms/composition-templates?${params}`,
    {
      context,
      parse: (value) => {
        const result = value as CmsTemplateList;
        if (
          !result ||
          !Array.isArray(result.items) ||
          ![result.total, result.limit, result.offset].every(
            (n) => Number.isInteger(n) && n >= 0,
          )
        )
          throw new Error("Listado de plantillas no válido.");
        return {
          ...result,
          items: result.items.map((item) => receipt(item, context)),
        };
      },
    },
  );
}
export async function getCompositionTemplate(
  context: AdminContext,
  id: string,
) {
  return requestAdminBff<CmsTemplateReceipt>(
    `/admin/cms/composition-templates/${encodeURIComponent(id)}?${query(context)}`,
    { context, parse: (value) => receipt(value, context, id) },
  );
}
export async function commandCompositionTemplate(
  context: AdminContext,
  operation: "create" | "update" | "archive",
  id: string | undefined,
  body: CmsTemplateCommand,
) {
  validate(
    operation === "create"
      ? "templateCreate"
      : operation === "archive"
        ? "templateArchive"
        : "templateUpdate",
    body,
  );
  if (operation !== "create" && !id) throw new Error("Falta la plantilla.");
  const suffix =
    operation === "create"
      ? ""
      : `/${encodeURIComponent(id!)}${operation === "archive" ? "/archive" : ""}`;
  return requestAdminBff<CmsTemplateReceipt>(
    `/admin/cms/composition-templates${suffix}?${query(context)}`,
    {
      context,
      init: {
        method: operation === "update" ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
      parse: (value) => {
        const confirmed = receipt(value, context, id);
        if (
          confirmed.status !== (operation === "archive" ? "ARCHIVED" : "DRAFT")
        )
          throw new Error("Estado de plantilla no confirmado.");
        if (
          ("expectedRevision" in body &&
            body.expectedRevision === confirmed.revisionToken) ||
          ("document" in body &&
            body.document &&
            !templateReceiptMatches(body.document, confirmed.document))
        )
          throw new Error("El recibo no confirma el contenido enviado.");
        return confirmed;
      },
    },
  );
}

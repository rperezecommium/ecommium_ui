import { sectionReceiptMatches } from "./cms-section-tree";
import "server-only";
import Ajv from "ajv";
import schema from "../../../docs/contracts/cms-composition-boundary.schema.json";
import { requestAdminBff } from "../../shared/bff/admin-client";
import type { AdminContext } from "../../shared/config/admin-context";
import type {
  CmsSectionReceipt,
  CmsSectionList,
  CmsSectionCommand,
} from "./cms-independent-section-types";
const validators = Object.fromEntries(
  ["sectionCreate", "sectionUpdate", "sectionReceipt"].map((name) => [
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
      "La sección no cumple el contrato. Revisa sus campos y referencias.",
    );
}
function receipt(
  value: unknown,
  context: AdminContext,
  id?: string,
): CmsSectionReceipt {
  validate("sectionReceipt", value);
  const result = value as CmsSectionReceipt;
  if (
    result.context.organizationId !== context.organizationId ||
    result.context.shopId !== context.shopId ||
    result.context.locale !== context.locale ||
    (id && result.resourceId !== id)
  )
    throw new Error(
      "El recibo no corresponde a la sección y al contexto solicitados.",
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
export async function listIndependentSections(
  context: AdminContext,
  offset = 0,
) {
  const params = query(context);
  params.set("limit", "50");
  params.set("offset", String(offset));
  return requestAdminBff<CmsSectionList>(`/admin/cms/sections?${params}`, {
    context,
    parse: (value) => {
      const result = value as CmsSectionList;
      if (
        !result ||
        !Array.isArray(result.items) ||
        ![result.total, result.limit, result.offset].every(
          (n) => Number.isInteger(n) && n >= 0,
        )
      )
        throw new Error("Listado de secciones no válido.");
      return {
        ...result,
        items: result.items.map((item) => receipt(item, context)),
      };
    },
  });
}
export async function getIndependentSection(context: AdminContext, id: string) {
  return requestAdminBff<CmsSectionReceipt>(
    `/admin/cms/sections/${encodeURIComponent(id)}?${query(context)}`,
    { context, parse: (value) => receipt(value, context, id) },
  );
}
export async function commandIndependentSection(
  context: AdminContext,
  operation: "create" | "update",
  id: string | undefined,
  body: CmsSectionCommand,
) {
  validate(operation === "create" ? "sectionCreate" : "sectionUpdate", body);
  if (operation !== "create" && !id) throw new Error("Falta la sección.");
  const suffix = operation === "create" ? "" : `/${encodeURIComponent(id!)}`;
  return requestAdminBff<CmsSectionReceipt>(
    `/admin/cms/sections${suffix}?${query(context)}`,
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
          ("expectedRevision" in body &&
            body.expectedRevision === confirmed.revisionToken) ||
          ("document" in body &&
            body.document &&
            !sectionReceiptMatches(body.document, confirmed.document))
        )
          throw new Error("El recibo no confirma el contenido enviado.");
        return confirmed;
      },
    },
  );
}

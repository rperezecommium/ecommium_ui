import { independentModuleReceiptMatches } from "./cms-independent-module-comparison";
import "server-only";
import Ajv from "ajv";
import schema from "../../../docs/contracts/cms-composition-boundary.schema.json";
import { requestAdminBff } from "../../shared/bff/admin-client";
import type { AdminContext } from "../../shared/config/admin-context";
import type {
  CmsModuleReceipt,
  CmsModuleList,
  CmsModuleCommand,
} from "./cms-independent-module-types";
const validators = Object.fromEntries(
  ["moduleCreate", "moduleUpdate", "moduleArchive", "moduleReceipt"].map(
    (name) => [
      name,
      new Ajv({ allErrors: true }).compile({
        definitions: schema.definitions,
        $ref: `#/definitions/${name}`,
      }),
    ],
  ),
);
function validate(kind: string, value: unknown) {
  const json = JSON.stringify(value);
  if (
    !json ||
    Buffer.byteLength(json, "utf8") > 1048576 ||
    !validators[kind]?.(value)
  )
    throw new Error(
      "El módulo no cumple el contrato. Revisa sus campos y referencias.",
    );
}
function receipt(
  value: unknown,
  context: AdminContext,
  id?: string,
): CmsModuleReceipt {
  validate("moduleReceipt", value);
  const result = value as CmsModuleReceipt;
  if (
    result.context.organizationId !== context.organizationId ||
    result.context.shopId !== context.shopId ||
    (id && result.resourceId !== id)
  )
    throw new Error(
      "El recibo no corresponde al módulo y contexto solicitados.",
    );
  return result;
}
function query(context: AdminContext) {
  return new URLSearchParams({
    organizationId: context.organizationId,
    shopId: context.shopId,
    contractVersion: "1",
  });
}
export async function listIndependentModules(
  context: AdminContext,
  status = "DRAFT",
  offset = 0,
) {
  const params = query(context);
  params.set("status", status);
  params.set("limit", "50");
  params.set("offset", String(offset));
  return requestAdminBff<CmsModuleList>(`/admin/cms/visual-modules?${params}`, {
    context,
    parse: (value) => {
      const result = value as CmsModuleList;
      if (
        !result ||
        !Array.isArray(result.items) ||
        ![result.total, result.limit, result.offset].every(
          (n) => Number.isInteger(n) && n >= 0,
        )
      )
        throw new Error("Listado de módulos no válido.");
      return {
        ...result,
        items: result.items.map((item) => receipt(item, context)),
      };
    },
  });
}
export async function getIndependentModule(context: AdminContext, id: string) {
  return requestAdminBff<CmsModuleReceipt>(
    `/admin/cms/visual-modules/${encodeURIComponent(id)}?${query(context)}`,
    { context, parse: (value) => receipt(value, context, id) },
  );
}
export async function commandIndependentModule(
  context: AdminContext,
  operation: "create" | "update" | "archive",
  id: string | undefined,
  body: CmsModuleCommand,
) {
  validate(
    operation === "create"
      ? "moduleCreate"
      : operation === "update"
        ? "moduleUpdate"
        : "moduleArchive",
    body,
  );
  if (operation !== "create" && !id) throw new Error("Falta el módulo.");
  const suffix =
    operation === "create"
      ? ""
      : `/${encodeURIComponent(id!)}/${operation === "update" ? "draft" : "archive"}`;
  return requestAdminBff<CmsModuleReceipt>(
    `/admin/cms/visual-modules${suffix}?${query(context)}`,
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
          confirmed.status !==
            (operation === "archive" ? "ARCHIVED" : "DRAFT") ||
          ("expectedRevision" in body &&
            body.expectedRevision === confirmed.revisionToken) ||
          ("document" in body &&
            body.document &&
            !independentModuleReceiptMatches(body.document, confirmed.document))
        )
          throw new Error("El recibo no confirma el contenido enviado.");
        return confirmed;
      },
    },
  );
}

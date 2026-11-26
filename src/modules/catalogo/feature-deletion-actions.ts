"use server";
import { getCurrentAdminSession } from "../auth/current-admin-session";
import { getAdminContext } from "../../shared/config/admin-context";
import { requestAdminBff } from "../../shared/bff/admin-client";
import { featureId } from "./feature-deactivation-contract";
import {
  parseFeatureDeletion,
  parseFeatureDeletionStatus,
  parseFeatureDeletionImpact,
} from "./feature-deletion-contract";
export type FeatureDeletionContext = {
  organizationId: string;
  shopId: string;
  locale: string;
};
async function authorized(input: FeatureDeletionContext) {
  const session = await getCurrentAdminSession();
  if (
    !session?.permissions.some((p) =>
      [
        "*",
        "admin:*",
        "system.admin",
        "catalog.specifications.delete",
      ].includes(p),
    )
  )
    return null;
  const c = await getAdminContext();
  return input &&
    c.organizationId === input.organizationId &&
    c.shopId === input.shopId &&
    c.locale === input.locale
    ? c
    : null;
}
const query = (i: FeatureDeletionContext) =>
  new URLSearchParams({
    organizationId: i.organizationId,
    shopId: i.shopId,
    locale: i.locale,
  }).toString();
export async function loadFeatureDeletionImpact(
  input: FeatureDeletionContext & { groupId: string; fieldId: string },
) {
  const context = await authorized(input);
  if (!context || !featureId(input.groupId) || !featureId(input.fieldId))
    return {
      ok: false as const,
      error: "No tienes permiso o el contexto ha cambiado.",
    };
  const r = await requestAdminBff(
    `/admin/specifications/groups/${encodeURIComponent(input.groupId)}/fields/${encodeURIComponent(input.fieldId)}/deletion-impact?${query(input)}`,
    {
      context,
      parse: (v) => parseFeatureDeletionImpact(v, input.groupId, input.fieldId),
    },
  );
  return r.ok
    ? { ok: true as const, impact: r.data }
    : {
        ok: false as const,
        error: `No se pudo consultar el impacto de eliminación. ${r.error}`,
        status: r.status,
        reference: r.correlationId,
      };
}
export async function confirmFeatureDeletion(
  input: FeatureDeletionContext & {
    groupId: string;
    fieldId: string;
    operationId: string;
    expectedVersion: string;
    confirmationName: string;
  },
) {
  const context = await authorized(input);
  if (
    !context ||
    !featureId(input.groupId) ||
    !featureId(input.fieldId) ||
    !featureId(input.operationId) ||
    !/^[a-f0-9]{64}$/.test(input.expectedVersion) ||
    typeof input.confirmationName !== "string" ||
    input.confirmationName.length > 200
  )
    return {
      ok: false as const,
      error: "La revisión o el contexto no son válidos.",
      status: 400,
    };
  const r = await requestAdminBff(
    `/admin/specifications/groups/${encodeURIComponent(input.groupId)}/fields/${encodeURIComponent(input.fieldId)}/delete-operations?${query(input)}`,
    {
      context,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operationId: input.operationId,
          expectedVersion: input.expectedVersion,
          confirmationName: input.confirmationName,
        }),
      },
      parse: (v) => {
        const p = parseFeatureDeletion(v, input.operationId);
        if (p.groupId !== input.groupId || p.fieldId !== input.fieldId)
          throw Error("IDENTITY_MISMATCH");
        return p;
      },
    },
  );
  return r.ok
    ? { ok: true as const, receipt: r.data }
    : {
        ok: false as const,
        error:
          r.status === 409
            ? "El impacto ha cambiado. Debes revisarlo de nuevo."
            : `No se pudo confirmar el resultado. ${r.error}`,
        status: r.status,
        reference: r.correlationId,
      };
}
export async function checkFeatureDeletion(
  input: FeatureDeletionContext & { operationId: string },
) {
  const context = await authorized(input);
  if (!context || !featureId(input.operationId))
    return {
      ok: false as const,
      error: "No tienes permiso o el contexto ha cambiado.",
    };
  const r = await requestAdminBff(
    `/admin/specifications/field-delete-operations/${encodeURIComponent(input.operationId)}?${query(input)}`,
    { context, parse: (v) => parseFeatureDeletionStatus(v, input.operationId) },
  );
  return r.ok
    ? { ok: true as const, status: r.data }
    : {
        ok: false as const,
        error:
          r.status === 404
            ? "La operación todavía no está confirmada. Comprueba de nuevo antes de intentar otra eliminación."
            : `No se pudo comprobar la operación. ${r.error}`,
        reference: r.correlationId,
      };
}
export async function retryFeatureDeletionSynchronization(
  input: FeatureDeletionContext & { operationId: string },
) {
  const context = await authorized(input);
  if (!context || !featureId(input.operationId))
    return {
      ok: false as const,
      error: "No tienes permiso o el contexto ha cambiado.",
    };
  const r = await requestAdminBff(
    `/admin/specifications/field-delete-operations/${encodeURIComponent(input.operationId)}/retry?${query(input)}`,
    {
      context,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      },
      parse: (v) => parseFeatureDeletion(v, input.operationId),
    },
  );
  return r.ok
    ? { ok: true as const }
    : {
        ok: false as const,
        error: `No se pudo reintentar la sincronización. ${r.error}`,
      };
}

export async function featureDeletionAvailable() {
  const session = await getCurrentAdminSession();
  if (
    !session?.permissions.some((p) =>
      [
        "*",
        "admin:*",
        "system.admin",
        "catalog.specifications.delete",
      ].includes(p),
    )
  )
    return false;
  const context = await getAdminContext();
  const r = await requestAdminBff(
    `/admin/specifications/field-delete-capability?${query(context)}`,
    {
      context,
      parse: (v: unknown) =>
        Boolean(
          v &&
          typeof v === "object" &&
          "available" in v &&
          v.available === true,
        ),
    },
  );
  return r.ok && r.data === true;
}

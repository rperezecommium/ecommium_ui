"use server";
import { getCurrentAdminSession } from "../auth/current-admin-session";
import { getAdminContext } from "../../shared/config/admin-context";
import { requestAdminBff } from "../../shared/bff/admin-client";
import { featureId, parseFeatureImpact } from "./feature-deactivation-contract";

type Input = {
  groupId: string;
  fieldId: string;
  organizationId: string;
  shopId: string;
  locale: string;
};
async function authorized(input: Input) {
  const session = await getCurrentAdminSession();
  if (
    !session?.permissions.some((p) =>
      ["*", "admin:*", "system.admin", "catalog.specifications.write"].includes(
        p,
      ),
    )
  )
    return null;
  const context = await getAdminContext();
  return input &&
    featureId(input.groupId) &&
    featureId(input.fieldId) &&
    context.organizationId === input.organizationId &&
    context.shopId === input.shopId &&
    context.locale === input.locale
    ? context
    : null;
}
function endpoint(input: Input, suffix: string) {
  return `/admin/specifications/groups/${encodeURIComponent(input.groupId)}/fields/${encodeURIComponent(input.fieldId)}/${suffix}?${new URLSearchParams({ organizationId: input.organizationId, shopId: input.shopId, locale: input.locale })}`;
}
export async function loadFeatureDeactivationImpact(input: Input) {
  const context = await authorized(input);
  if (!context)
    return {
      ok: false as const,
      error: "No tienes permiso o el contexto de tienda ha cambiado.",
    };
  const result = await requestAdminBff(endpoint(input, "deactivation-impact"), {
    context,
    parse: (v) => parseFeatureImpact(v, input.groupId, input.fieldId),
  });
  return result.ok
    ? { ok: true as const, impact: result.data }
    : {
        ok: false as const,
        error: `No se pudo calcular el impacto. ${result.error}`,
        status: result.status,
        reference: result.correlationId,
      };
}
export async function confirmFeatureDeactivation(
  input: Input & { expectedVersion: string },
) {
  const context = await authorized(input);
  if (!context || !/^[a-f0-9]{64}$/.test(input.expectedVersion))
    return {
      ok: false as const,
      error: "La revisión o el contexto ya no son válidos.",
    };
  const result = await requestAdminBff(endpoint(input, "deactivate"), {
    context,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expectedVersion: input.expectedVersion }),
    },
    parse: (v) => parseFeatureImpact(v, input.groupId, input.fieldId),
  });
  if (!result.ok)
    return {
      ok: false as const,
      error:
        result.status === 409
          ? "El impacto ha cambiado. Vuelve a calcularlo antes de confirmar."
          : `No se pudo confirmar la desactivación. ${result.error}`,
      status: result.status,
      reference: result.correlationId,
    };
  return !result.data.isActive
    ? { ok: true as const, impact: result.data }
    : { ok: false as const, error: "El BFF no confirmó la desactivación." };
}
export async function checkFeatureDeactivationProjection(input: Input) {
  const context = await authorized(input);
  if (!context)
    return {
      ok: false as const,
      error: "No tienes permiso o el contexto ha cambiado.",
    };
  const result = await requestAdminBff(
    `/admin/specifications/groups/${encodeURIComponent(input.groupId)}?${new URLSearchParams({ organizationId: context.organizationId, shopId: context.shopId, locale: context.locale })}`,
    {
      context,
      parse: (v: unknown) => {
        if (!v || typeof v !== "object") throw Error("INVALID_GROUP");
        const p = v as { specificationGroupId?: unknown; fields?: unknown };
        if (
          p.specificationGroupId !== input.groupId ||
          !Array.isArray(p.fields)
        )
          throw Error("INVALID_GROUP");
        const field = p.fields.find(
          (f: Record<string, unknown>) => f.fieldId === input.fieldId,
        );
        if (!field || typeof field.isActive !== "boolean")
          throw Error("INVALID_FIELD");
        return field.isActive === false;
      },
    },
  );
  return result.ok
    ? { ok: true as const, complete: result.data }
    : {
        ok: false as const,
        error: `No se pudo comprobar la sincronización. ${result.error}`,
      };
}

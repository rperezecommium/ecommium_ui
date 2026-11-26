"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminContext } from "../../shared/config/admin-context";
import { requestAdminBff } from "../../shared/bff/admin-client";
import {
  parseRemovalReview,
  parseRemovalReceipt,
  type RemovalKind,
  type RemovalReceiptRequest,
} from "./pricing-reviewed-removal-schema";
async function request<T>(
  context: Awaited<ReturnType<typeof getAdminContext>>,
  path: string,
  body: Record<string, unknown>,
  parse: (raw: unknown) => T,
) {
  return requestAdminBff(path, {
    context,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    parse,
  });
}
function input(kind: string, code: string, replacementCode: string) {
  if (
    !["taxes", "price-tables"].includes(kind) ||
    !code.trim() ||
    code.length > 200 ||
    replacementCode.length > 200
  )
    throw Error("Solicitud de eliminación no válida.");
  return {
    kind,
    code: code.trim(),
    replacementCode: replacementCode.trim() || undefined,
  };
}
export async function reviewPricingRemoval(
  kind: string,
  code: string,
  replacementCode = "",
  reviewOffset = 0,
) {
  if (!Number.isSafeInteger(reviewOffset) || reviewOffset < 0)
    throw Error("Paginación no válida.");
  const value = input(kind, code, replacementCode),
    context = await getAdminContext();
  const query = new URLSearchParams({
    organizationId: context.organizationId,
    shopId: context.shopId,
  });
  const result = await request(
    context,
    `/admin/pricing/${kind}/${encodeURIComponent(value.code)}/removal-review?${query}`,
    { replacementCode: value.replacementCode, reviewOffset },
    parseRemovalReview,
  );
  if (!result.ok)
    return {
      error: "No se pudo revisar el impacto. Actualiza e inténtalo de nuevo.",
    };
  return { data: result.data };
}
export async function confirmPricingRemoval(form: FormData) {
  const { kind, code, replacementCode } = input(
    String(form.get("kind") ?? ""),
    String(form.get("code") ?? ""),
    String(form.get("replacementCode") ?? ""),
  );
  const version = String(form.get("impactVersion") ?? "");
  if (!/^[a-f0-9]{64}$/.test(version) || form.get("confirm") !== "yes")
    throw Error("Revisa y confirma el impacto antes de eliminar.");
  const context = await getAdminContext(),
    query = new URLSearchParams({
      organizationId: context.organizationId,
      shopId: context.shopId,
    });
  const result = await request(
    context,
    `/admin/pricing/${kind}/${encodeURIComponent(code)}/removal-confirm?${query}`,
    { replacementCode, impactVersion: version },
    (raw) =>
      parseRemovalReceipt(raw, {
        kind: kind as RemovalKind,
        code,
        impactVersion: version,
        replacementCode,
      }),
  );
  const valid = result.ok;
  revalidatePath("/admin/configuracion/precios");
  const params = new URLSearchParams({
    tab: kind === "taxes" ? "taxes" : "tables",
    pricingMessage: valid
      ? "Cambio guardado en Pricing. La actualización de las lecturas está pendiente de verificación."
      : "La eliminación no se ha confirmado. Reabre la revisión: el impacto o el destino pueden haber cambiado.",
  });
  if (valid)
    params.set(
      "pricingRemoval",
      JSON.stringify({ kind, code, replacementCode, impactVersion: version }),
    );
  redirect(`/admin/configuracion/precios?${params}`);
}

export async function checkPricingRemovalStatus(value: RemovalReceiptRequest) {
  const normalized = input(value.kind, value.code, value.replacementCode ?? "");
  if (!/^[a-f0-9]{64}$/.test(value.impactVersion))
    return { error: "La referencia de la operación no es válida." };
  const expected = {
    ...normalized,
    kind: normalized.kind as RemovalKind,
    impactVersion: value.impactVersion,
  };
  const context = await getAdminContext(),
    query = new URLSearchParams({
      organizationId: context.organizationId,
      shopId: context.shopId,
    });
  const result = await request(
    context,
    `/admin/pricing/${expected.kind}/${encodeURIComponent(expected.code)}/removal-status?${query}`,
    {
      replacementCode: expected.replacementCode,
      impactVersion: expected.impactVersion,
    },
    (raw) => parseRemovalReceipt(raw, expected, true),
  );
  return result.ok
    ? {
        data: {
          readStatus: String(result.data.readStatus),
          contexts: Number(result.data.contexts),
        },
      }
    : {
        error:
          "No se pudo verificar la actualización de las lecturas. El cambio guardado no se repetirá.",
      };
}

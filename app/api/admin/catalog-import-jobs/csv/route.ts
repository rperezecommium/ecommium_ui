import { NextRequest, NextResponse } from "next/server";
import { requestAdminBffResponseAsEmployee } from "../../../../../src/shared/bff/admin-client";
import { requireAdminRouteAccess } from "../../../../../src/shared/auth/require-admin-route-access";

function hasTrustedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

async function jsonResponse(response: Response) {
  const text = await response.text();
  const payload = text ? JSON.parse(text) as unknown : {};
  return NextResponse.json(payload, { status: response.status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const access = await requireAdminRouteAccess("catalog.products.write");
  if (!access.ok) return access.response;

  const input = await request.formData().catch(() => null);
  const file = input?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "CSV_FILE_REQUIRED" }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".csv")) return NextResponse.json({ error: "CSV_FILE_EXPECTED" }, { status: 400 });

  const { context } = access.data;
  const form = new FormData();
  form.set("file", file, file.name);
  form.set("organizationId", context.organizationId);
  form.set("shopId", context.shopId);
  form.set("operationId", String(input?.get("operationId") ?? crypto.randomUUID()));
  form.set("sourceSystem", String(input?.get("sourceSystem") ?? "CSV"));
  form.set("locale", context.locale ?? "es-ES");
  form.set("currency", context.currency ?? "EUR");
  form.set("warehouseId", String(input?.get("warehouseId") ?? "main-warehouse"));
  form.set("delimiter", String(input?.get("delimiter") ?? "auto"));

  const result = await requestAdminBffResponseAsEmployee(
    "/admin/catalog-import-jobs/csv",
    access.data.accessToken,
    { context, init: { method: "POST", body: form } },
  );
  if (!result.ok) return NextResponse.json({ error: result.error, status: result.status }, { status: result.status ?? 502, headers: { "Cache-Control": "no-store" } });
  return jsonResponse(result.data);
}

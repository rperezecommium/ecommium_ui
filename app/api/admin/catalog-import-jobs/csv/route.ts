import { NextRequest, NextResponse } from "next/server";
import { requestAdminBffResponseAsEmployee } from "../../../../../src/shared/bff/admin-client";
import { requireAdminRouteAccess } from "../../../../../src/shared/auth/require-admin-route-access";
import { parseImportCategoryAssignment } from "../../../../../src/modules/catalogo/catalog-csv-import-category";

function hasTrustedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

async function jsonResponse(response: Response) {
  const text = await response.text();
  const payload = text ? JSON.parse(text) as unknown : {};
  return NextResponse.json(payload, { status: response.status, headers: { "Cache-Control": "no-store" } });
}

function field(input: FormData | null, name: string, fallback: string) {
  const value = input?.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function commercialChannel(contextChannel: string | undefined) {
  const channel = contextChannel?.trim();
  return channel && !["admin", "events-cert", "test", "benchmark"].includes(channel) ? channel : "web";
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const access = await requireAdminRouteAccess("catalog.products.write");
  if (!access.ok) return access.response;

  const input = await request.formData().catch(() => null);
  const file = input?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "CSV_FILE_REQUIRED" }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".csv")) return NextResponse.json({ error: "CSV_FILE_EXPECTED" }, { status: 400 });
  let categoryAssignment;
  try {
    const rawAssignment = input?.get("categoryAssignment");
    categoryAssignment = parseImportCategoryAssignment(rawAssignment === null ? undefined : JSON.parse(String(rawAssignment)));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Categoría no válida." }, { status: 400 });
  }

  const { context } = access.data;
  const upload = new Blob([await file.arrayBuffer()], { type: file.type || "text/csv" });
  const form = new FormData();
  form.set("file", upload, file.name);
  form.set("organizationId", context.organizationId);
  form.set("shopId", context.shopId);
  form.set("operationId", String(input?.get("operationId") ?? crypto.randomUUID()));
  form.set("sourceSystem", String(input?.get("sourceSystem") ?? "CSV"));
  form.set("locale", context.locale ?? "es-ES");
  form.set("currency", field(input, "currency", context.currency || "EUR").toUpperCase());
  form.set("country", field(input, "country", context.country || "ES").toUpperCase());
  form.set("channel", field(input, "channel", commercialChannel(context.channel)));
  form.set("warehouseId", field(input, "warehouseId", "warehouse-default"));
  form.set("publish", field(input, "publish", "true"));
  form.set("availableForSale", field(input, "availableForSale", "true"));
  form.set("manageInventory", field(input, "manageInventory", "true"));
  form.set("allowBackorder", field(input, "allowBackorder", "false"));
  form.set("delimiter", String(input?.get("delimiter") ?? "auto"));
  form.set("profile", JSON.stringify({ categoryAssignment }));

  const result = await requestAdminBffResponseAsEmployee(
    "/admin/catalog-import-jobs/csv",
    access.data.accessToken,
    { context, init: { method: "POST", body: form } },
  );
  if (!result.ok) return NextResponse.json({ error: result.error, status: result.status }, { status: result.status ?? 502, headers: { "Cache-Control": "no-store" } });
  return jsonResponse(result.data);
}

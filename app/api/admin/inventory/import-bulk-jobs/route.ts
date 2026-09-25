import { NextRequest, NextResponse } from "next/server";
import { requestAdminBffResponseAsEmployee } from "../../../../../src/shared/bff/admin-client";
import { requireAdminRouteAccess } from "../../../../../src/shared/auth/require-admin-route-access";

function hasTrustedOrigin(request: NextRequest) { const origin = request.headers.get("origin"); return !origin || origin === request.nextUrl.origin; }
async function jsonResponse(response: Response) { const text = await response.text(); return NextResponse.json(text ? JSON.parse(text) : {}, { status: response.status, headers: { "Cache-Control": "no-store" } }); }

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const access = await requireAdminRouteAccess("inventory.stock.write");
  if (!access.ok) return access.response;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "JSON_INVALID" }, { status: 400 });
  const { context } = access.data;
  const result = await requestAdminBffResponseAsEmployee("/admin/inventory/import-bulk-jobs", access.data.accessToken, {
    context,
    init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, organizationId: context.organizationId, shopId: context.shopId }) },
  });
  if (!result.ok) return NextResponse.json({ error: result.error, status: result.status }, { status: result.status ?? 502, headers: { "Cache-Control": "no-store" } });
  return jsonResponse(result.data);
}

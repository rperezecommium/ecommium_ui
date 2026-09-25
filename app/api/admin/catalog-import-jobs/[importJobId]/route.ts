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

export async function GET(request: NextRequest, { params }: { params: Promise<{ importJobId: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const access = await requireAdminRouteAccess("catalog.products.read");
  if (!access.ok) return access.response;
  const { importJobId } = await params;
  const { context } = access.data;
  const query = new URLSearchParams({ organizationId: context.organizationId, shopId: context.shopId });
  const jobs = request.nextUrl.searchParams.get("jobs");
  if (jobs) query.set("jobs", jobs);
  const result = await requestAdminBffResponseAsEmployee(
    `/admin/catalog-import-jobs/${encodeURIComponent(importJobId)}/status?${query.toString()}`,
    access.data.accessToken,
    { context },
  );
  if (!result.ok) return NextResponse.json({ error: result.error, status: result.status }, { status: result.status ?? 502, headers: { "Cache-Control": "no-store" } });
  return jsonResponse(result.data);
}

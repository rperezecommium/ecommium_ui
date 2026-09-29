import { NextRequest, NextResponse } from "next/server";
import { requestAdminBffResponseAsEmployee } from "../../../../../../src/shared/bff/admin-client";
import { requireAdminRouteAccess } from "../../../../../../src/shared/auth/require-admin-route-access";

export async function GET(request: NextRequest, { params }: { params: Promise<{ importJobId: string }> }) {
  const access = await requireAdminRouteAccess("catalog.products.read");
  if (!access.ok) return access.response;
  const { importJobId } = await params;
  const { context, accessToken } = access.data;
  const query = new URLSearchParams({ organizationId: context.organizationId, shopId: context.shopId });
  const cursor = request.nextUrl.searchParams.get("cursor");
  if (cursor) query.set("cursor", cursor);
  const result = await requestAdminBffResponseAsEmployee(
    `/admin/catalog-import-jobs/${encodeURIComponent(importJobId)}/outcomes?${query}`, accessToken, { context },
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status ?? 502 });
  return NextResponse.json(await result.data.json(), { status: result.data.status, headers: { "Cache-Control": "no-store" } });
}

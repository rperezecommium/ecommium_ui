import { NextRequest, NextResponse } from "next/server";
import { requestAdminBffResponseAsEmployee } from "../../../../../../src/shared/bff/admin-client";
import { requireAdminRouteAccess } from "../../../../../../src/shared/auth/require-admin-route-access";

export async function POST(request: NextRequest, { params }: { params: Promise<{ importJobId: string }> }) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const access = await requireAdminRouteAccess("catalog.products.write");
  if (!access.ok) return access.response;
  const { importJobId } = await params;
  const { context } = access.data;
  const result = await requestAdminBffResponseAsEmployee(`/admin/catalog-import-jobs/${encodeURIComponent(importJobId)}/resume`, access.data.accessToken, {
    context, init: { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationId: context.organizationId, shopId: context.shopId }) },
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status ?? 502 });
  return NextResponse.json(await result.data.json(), { status: result.data.status, headers: { "Cache-Control": "no-store" } });
}

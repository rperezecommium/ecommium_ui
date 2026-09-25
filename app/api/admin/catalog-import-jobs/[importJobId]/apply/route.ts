import { NextRequest, NextResponse } from "next/server";
import { requestAdminBffResponseAsEmployee } from "../../../../../../src/shared/bff/admin-client";
import { requireAdminRouteAccess } from "../../../../../../src/shared/auth/require-admin-route-access";

function hasTrustedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}
async function jsonResponse(response: Response) {
  const text = await response.text();
  const payload = text ? JSON.parse(text) as unknown : {};
  return NextResponse.json(payload, { status: response.status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ importJobId: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const access = await requireAdminRouteAccess("catalog.products.write");
  if (!access.ok) return access.response;
  const { importJobId } = await params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>)) as Record<string, unknown>;
  const { context } = access.data;
  const result = await requestAdminBffResponseAsEmployee(
    `/admin/catalog-import-jobs/${encodeURIComponent(importJobId)}/apply`,
    access.data.accessToken,
    {
      context,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...body,
          organizationId: context.organizationId,
          shopId: context.shopId,
          operationId: typeof body.operationId === "string" ? body.operationId : crypto.randomUUID(),
        }),
      },
    },
  );
  if (!result.ok) return NextResponse.json({ error: result.error, status: result.status }, { status: result.status ?? 502, headers: { "Cache-Control": "no-store" } });
  return jsonResponse(result.data);
}

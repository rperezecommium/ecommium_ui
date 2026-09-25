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
  return NextResponse.json(payload, {
    status: response.status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const access = await requireAdminRouteAccess("pricing.admin.write");
  if (!access.ok) {
    return access.response;
  }

  const { jobId } = await params;
  const normalizedJobId = jobId?.trim();
  if (!normalizedJobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const { context } = access.data;
  const query = new URLSearchParams({
    organizationId: context.organizationId,
    shopId: context.shopId,
  });
  const result = await requestAdminBffResponseAsEmployee(
    `/admin/pricing/bulk-jobs/${encodeURIComponent(normalizedJobId)}?${query.toString()}`,
    access.data.accessToken,
    { context },
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error, status: result.status }, {
      status: result.status ?? 502,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return jsonResponse(result.data);
}

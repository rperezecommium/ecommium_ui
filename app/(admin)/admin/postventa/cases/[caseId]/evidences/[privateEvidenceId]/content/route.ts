import { NextRequest } from "next/server";
import { requestAdminBffResponseAsEmployee } from "../../../../../../../../../src/shared/bff/admin-client";
import { requireAdminRouteAccess } from "../../../../../../../../../src/shared/auth/require-admin-route-access";

const maximumEvidenceBytes = 10 * 1024 * 1024;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ caseId: string; privateEvidenceId: string }> },
) {
  const { caseId, privateEvidenceId } = await params;
  const normalizedCaseId = caseId?.trim();
  const normalizedEvidenceId = privateEvidenceId?.trim();
  if (!normalizedCaseId || !normalizedEvidenceId) return new Response("Evidence is required", { status: 400 });

  const access = await requireAdminRouteAccess("after-sales.manage");
  if (!access.ok) return access.response;

  const query = new URLSearchParams({
    organizationId: access.data.context.organizationId,
    shopId: access.data.context.shopId,
  });
  const result = await requestAdminBffResponseAsEmployee(
    `/admin/after-sales/cases/${encodeURIComponent(normalizedCaseId)}/evidences/${encodeURIComponent(normalizedEvidenceId)}/content?${query.toString()}`,
    access.data.accessToken,
    { context: access.data.context, init: { headers: { accept: "image/jpeg" } } },
  );
  if (!result.ok) {
    return new Response("Evidence is not available", { status: result.status === 401 ? 401 : result.status === 403 || result.status === 404 ? 404 : 502 });
  }

  const response = result.data;
  const contentType = response.headers.get("content-type") ?? "";
  const declaredLength = Number(response.headers.get("content-length"));
  if (!contentType.toLowerCase().startsWith("image/jpeg") || (Number.isFinite(declaredLength) && declaredLength > maximumEvidenceBytes)) {
    return new Response("Evidence is not available", { status: 502 });
  }
  const content = await response.arrayBuffer();
  if (content.byteLength > maximumEvidenceBytes) return new Response("Evidence exceeds the allowed size", { status: 413 });

  return new Response(content, {
    status: 200,
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": "inline; filename=\"evidence.jpg\"",
      "content-length": String(content.byteLength),
      "content-type": "image/jpeg",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });
}

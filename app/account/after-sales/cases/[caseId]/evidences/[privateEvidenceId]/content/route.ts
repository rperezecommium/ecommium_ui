import { NextRequest } from "next/server";
import { getStorefrontContext } from "../../../../../../../../src/modules/storefront/storefront-context";
import { getStorefrontCustomerAuthorizationHeader } from "../../../../../../../../src/modules/storefront/storefront-customer-session";
import { requestStorefrontBffResponse } from "../../../../../../../../src/shared/bff/storefront-client";

const maximumEvidenceBytes = 10 * 1024 * 1024;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ caseId: string; privateEvidenceId: string }> },
) {
  const { caseId, privateEvidenceId } = await params;
  const normalizedCaseId = caseId?.trim();
  const normalizedEvidenceId = privateEvidenceId?.trim();

  if (!normalizedCaseId || !normalizedEvidenceId) {
    return new Response("Evidence is required", { status: 400 });
  }

  const authorization = await getStorefrontCustomerAuthorizationHeader();
  if (!authorization) {
    return new Response("Customer authentication is required", { status: 401 });
  }

  const context = await getStorefrontContext();
  const searchParams = new URLSearchParams({
    organizationId: context.organizationId,
    shopId: context.shopId,
  });
  const result = await requestStorefrontBffResponse(
    `/storefront/me/after-sales/cases/${encodeURIComponent(normalizedCaseId)}/evidences/${encodeURIComponent(normalizedEvidenceId)}/content?${searchParams.toString()}`,
    {
      withAuth: false,
      context: { locale: context.locale },
      init: {
        headers: {
          accept: "image/jpeg",
          authorization,
        },
      },
    },
  );

  if (!result.ok) {
    return new Response("Evidence is not available", { status: result.status ?? 502 });
  }

  const response = result.data;
  const contentType = response.headers.get("content-type") ?? "";
  const declaredLength = Number(response.headers.get("content-length"));
  if (
    !contentType.toLowerCase().startsWith("image/jpeg") ||
    (Number.isFinite(declaredLength) && declaredLength > maximumEvidenceBytes)
  ) {
    return new Response("Evidence is not available", { status: 502 });
  }

  const content = await response.arrayBuffer();
  if (content.byteLength > maximumEvidenceBytes) {
    return new Response("Evidence exceeds the allowed size", { status: 413 });
  }

  const headers = new Headers({
    "cache-control": "private, no-store",
    "content-disposition": "inline; filename=\"evidence.jpg\"",
    "content-length": String(content.byteLength),
    "content-type": "image/jpeg",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
  });
  return new Response(content, { status: 200, headers });
}

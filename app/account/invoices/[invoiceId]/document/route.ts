import { NextRequest } from "next/server";
import { bffBaseUrl } from "../../../../../src/shared/config/env";
import { getStorefrontContext } from "../../../../../src/modules/storefront/storefront-context";
import { getStorefrontCustomerAuthorizationHeader } from "../../../../../src/modules/storefront/storefront-customer-session";

function makeCorrelationId() {
  return "ui-invoice-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function normalizeBffBaseUrl() {
  return bffBaseUrl.endsWith("/") ? bffBaseUrl.slice(0, -1) : bffBaseUrl;
}

function safeFilenamePart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "invoice";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const { invoiceId } = await params;
  const normalizedInvoiceId = invoiceId?.trim();

  if (!normalizedInvoiceId) {
    return new Response("invoiceId is required", { status: 400 });
  }

  const authorization = await getStorefrontCustomerAuthorizationHeader();
  if (!authorization) {
    return new Response("Customer authentication is required", { status: 401 });
  }

  const context = getStorefrontContext();
  const url = new URL(
    normalizeBffBaseUrl() + "/storefront/me/invoices/" + encodeURIComponent(normalizedInvoiceId) + "/document",
  );
  url.searchParams.set("organizationId", context.organizationId);
  url.searchParams.set("shopId", context.shopId);

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      accept: "application/pdf,application/octet-stream,*/*",
      authorization,
      "x-correlation-id": makeCorrelationId(),
      "x-locale": context.locale,
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return new Response(detail || "BFF invoice document failed with " + response.status, {
      status: response.status,
    });
  }

  const content = await response.arrayBuffer();
  const headers = new Headers();
  headers.set("cache-control", "private, no-store");
  headers.set("content-type", response.headers.get("content-type") ?? "application/pdf");
  headers.set(
    "content-disposition",
    response.headers.get("content-disposition") ??
      `inline; filename="invoice-${safeFilenamePart(normalizedInvoiceId)}.pdf"`,
  );

  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    headers.set("content-length", contentLength);
  }

  return new Response(content, {
    status: 200,
    headers,
  });
}

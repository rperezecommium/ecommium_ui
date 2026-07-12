import { NextRequest } from "next/server";
import { adminBffToken, bffBaseUrl } from "../../../../../../../src/shared/config/env";
import { getAdminAuthorizationToken } from "../../../../../../../src/shared/auth/session";
import { getAdminContext } from "../../../../../../../src/shared/config/admin-context";
import { createBffHeaders } from "../../../../../../../src/shared/bff/headers";
import { invoicePdfFilename, renderInvoiceDocumentPdf } from "../../../../../../../src/shared/invoice/invoice-document-pdf";

function makeCorrelationId() {
  return "ui-admin-invoice-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function normalizeBffBaseUrl() {
  return bffBaseUrl.endsWith("/") ? bffBaseUrl.slice(0, -1) : bffBaseUrl;
}

function safeFilenamePart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "invoice";
}

function htmlFromPayload(value: unknown) {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.html === "string" && record.html.trim()) {
    return record.html;
  }

  const contentJson = record.contentJson;
  if (typeof contentJson === "object" && contentJson !== null) {
    const html = (contentJson as Record<string, unknown>).html;
    return typeof html === "string" && html.trim() ? html : undefined;
  }

  return undefined;
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

  const [context, token] = await Promise.all([
    getAdminContext(),
    getAdminAuthorizationToken(),
  ]);
  if (!context.organizationId || !context.shopId) {
    return new Response("Admin context is required", { status: 428 });
  }

  const url = new URL(
    normalizeBffBaseUrl() + "/admin/invoices/" + encodeURIComponent(normalizedInvoiceId) + "/document",
  );
  url.searchParams.set("organizationId", context.organizationId);
  url.searchParams.set("shopId", context.shopId);

  const response = await fetch(url, {
    cache: "no-store",
    headers: createBffHeaders({
      adminToken: token ?? adminBffToken,
      correlationId: makeCorrelationId(),
      initHeaders: { accept: "application/json,text/html,*/*" },
      locale: context.locale,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return new Response(detail || "BFF admin invoice document failed with " + response.status, {
      status: response.status,
    });
  }

  const contentType = response.headers.get("content-type") ?? "";
  const headers = new Headers();
  headers.set("cache-control", "private, no-store");

  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => undefined) as unknown;
    const html = htmlFromPayload(payload);
    if (html) {
      const pdf = renderInvoiceDocumentPdf(payload, html);
      headers.set("content-type", "application/pdf");
      headers.set("content-disposition", `inline; filename="${invoicePdfFilename(payload, normalizedInvoiceId)}"`);
      headers.set("content-length", String(pdf.byteLength));
      return new Response(new Uint8Array(pdf), { status: 200, headers });
    }

    return new Response("Invoice document HTML is not available", {
      status: 502,
      headers,
    });
  }

  const content = await response.arrayBuffer();
  if (contentType.includes("application/pdf")) {
    headers.set("content-type", contentType);
    headers.set(
      "content-disposition",
      response.headers.get("content-disposition") ??
        `inline; filename="invoice-${safeFilenamePart(normalizedInvoiceId)}.pdf"`,
    );
    headers.set("content-length", String(content.byteLength));
    return new Response(content, {
      status: 200,
      headers,
    });
  }

  const html = Buffer.from(content).toString("utf8");
  const pdf = renderInvoiceDocumentPdf(undefined, html);
  headers.set("content-type", "application/pdf");
  headers.set("content-disposition", `inline; filename="invoice-${safeFilenamePart(normalizedInvoiceId)}.pdf"`);
  headers.set("content-length", String(pdf.byteLength));
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers,
  });
}

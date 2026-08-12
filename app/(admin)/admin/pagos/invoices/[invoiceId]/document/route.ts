import { NextRequest } from "next/server";
import { requestAdminBffResponseAsEmployee } from "../../../../../../../src/shared/bff/admin-client";
import { requireAdminRouteAccess } from "../../../../../../../src/shared/auth/require-admin-route-access";
import { invoicePdfFilename, renderInvoiceDocumentPdf } from "../../../../../../../src/shared/invoice/invoice-document-pdf";

const maximumInvoiceDocumentBytes = 10 * 1024 * 1024;

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

  const access = await requireAdminRouteAccess("invoices.manage");
  if (!access.ok) {
    return access.response;
  }

  const { context } = access.data;

  const query = new URLSearchParams({
    organizationId: context.organizationId,
    shopId: context.shopId,
  });
  const result = await requestAdminBffResponseAsEmployee(
    `/admin/invoices/${encodeURIComponent(normalizedInvoiceId)}/document?${query.toString()}`,
    access.data.accessToken,
    {
      context,
      init: { headers: { accept: "application/json,text/html,*/*" } },
    },
  );

  if (!result.ok) {
    if (result.status === 401) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (result.status === 403 || result.status === 404) {
      return new Response("Not found", { status: 404 });
    }
    return new Response("Invoice document is temporarily unavailable", { status: result.status && result.status >= 500 ? result.status : 502 });
  }

  const response = result.data;
  const contentType = response.headers.get("content-type") ?? "";
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumInvoiceDocumentBytes) {
    return new Response("Invoice document exceeds the allowed size", { status: 413 });
  }
  const headers = new Headers();
  headers.set("cache-control", "private, no-store");
  headers.set("x-content-type-options", "nosniff");

  if (contentType.includes("application/json")) {
    const content = await response.arrayBuffer();
    if (content.byteLength > maximumInvoiceDocumentBytes) return new Response("Invoice document exceeds the allowed size", { status: 413 });
    const payload = (() => {
      try {
        return JSON.parse(Buffer.from(content).toString("utf8")) as unknown;
      } catch {
        return undefined;
      }
    })();
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
  if (content.byteLength > maximumInvoiceDocumentBytes) return new Response("Invoice document exceeds the allowed size", { status: 413 });
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

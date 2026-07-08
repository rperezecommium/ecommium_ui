import { NextRequest } from "next/server";
import { adminBffToken, bffBaseUrl } from "../../../../../../../src/shared/config/env";
import { getAdminAuthorizationToken } from "../../../../../../../src/shared/auth/session";
import { getAdminContext } from "../../../../../../../src/shared/config/admin-context";
import { createBffHeaders } from "../../../../../../../src/shared/bff/headers";

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
  headers.set("content-disposition", `inline; filename="invoice-${safeFilenamePart(normalizedInvoiceId)}.html"`);

  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => undefined) as unknown;
    const html = htmlFromPayload(payload);
    if (html) {
      headers.set("content-type", "text/html; charset=utf-8");
      return new Response(html, { status: 200, headers });
    }

    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(payload ?? {}, null, 2), { status: 200, headers });
  }

  const content = await response.arrayBuffer();
  headers.set("content-type", contentType || "text/html; charset=utf-8");
  return new Response(content, {
    status: 200,
    headers,
  });
}

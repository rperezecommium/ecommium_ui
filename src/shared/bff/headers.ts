export type BffHeaderOptions = {
  adminToken?: string;
  correlationId: string;
  initHeaders?: HeadersInit;
  locale?: string;
};

export function createBffHeaders({
  adminToken,
  correlationId,
  initHeaders,
  locale,
}: BffHeaderOptions) {
  const headers = new Headers(initHeaders);

  headers.set("accept", "application/json");
  headers.set("x-correlation-id", correlationId);

  if (adminToken && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${adminToken}`);
  }

  if (locale) {
    headers.set("x-locale", locale);
  }

  return headers;
}

export type BffHeaderOptions = {
  adminToken?: string;
  authorizationToken?: string;
  correlationId: string;
  initHeaders?: HeadersInit;
  locale?: string;
};

export function createBffHeaders({
  adminToken,
  authorizationToken,
  correlationId,
  initHeaders,
  locale,
}: BffHeaderOptions) {
  const headers = new Headers(initHeaders);

  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }
  headers.set("x-correlation-id", correlationId);

  const token = authorizationToken ?? adminToken;
  if (token && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${token}`);
  }

  if (locale) {
    headers.set("x-locale", locale);
  }

  return headers;
}

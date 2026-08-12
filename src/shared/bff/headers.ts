export type BffHeaderOptions = {
  authorizationToken?: string;
  correlationId: string;
  initHeaders?: HeadersInit;
  locale?: string;
};

export function createBffHeaders({
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

  if (authorizationToken && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${authorizationToken}`);
  }

  if (locale) {
    headers.set("x-locale", locale);
  }

  return headers;
}

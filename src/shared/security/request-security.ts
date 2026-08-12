export type JsonRequestResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; status: number; message: string };

export function validateSameOriginMutation(request: Request): JsonRequestResult | undefined {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const expectedOrigin = new URL(request.url).origin;

  if (origin && origin !== expectedOrigin) {
    return { ok: false, status: 403, message: "El origen de la solicitud no está permitido." };
  }
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site") {
    return { ok: false, status: 403, message: "La solicitud no procede de la tienda." };
  }
  if (process.env.NODE_ENV === "production" && !origin) {
    return { ok: false, status: 403, message: "La solicitud debe indicar su origen." };
  }
  return undefined;
}

export async function readJsonObject(request: Request, maximumBytes: number): Promise<JsonRequestResult> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { ok: false, status: 415, message: "La solicitud requiere application/json." };
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    return { ok: false, status: 413, message: "La solicitud supera el tamaño permitido." };
  }
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maximumBytes) {
    return { ok: false, status: 413, message: "La solicitud supera el tamaño permitido." };
  }
  try {
    const value = JSON.parse(body) as unknown;
    if (!value || Array.isArray(value) || typeof value !== "object") {
      return { ok: false, status: 400, message: "El cuerpo debe ser un objeto JSON." };
    }
    return { ok: true, value: value as Record<string, unknown> };
  } catch {
    return { ok: false, status: 400, message: "El cuerpo JSON no es válido." };
  }
}

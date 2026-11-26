/** Explicit Admin deployment before a commercial tenant exists. */
export function adminOnlyOrigin(env = process.env) {
  if (!env.ECOMMIUM_UI_SURFACE) return null;
  if (env.ECOMMIUM_UI_SURFACE !== "ADMIN" || env.ECOMMIUM_UI_ROUTING_MODE) throw Error("UI_ADMIN_PROFILE_INVALID");
  const raw = env.ECOMMIUM_UI_ADMIN_ORIGIN ?? "";
  const origin = new URL(raw);
  const local = origin.protocol === "http:" && origin.hostname === "127.0.0.1";
  if (origin.origin !== raw || origin.username || origin.password || !(origin.protocol === "https:" || local)) throw Error("UI_ADMIN_ORIGIN_INVALID");
  const api = new URL(env.ECOMMIUM_ADMIN_BFF_BASE_URL ?? "");
  if (api.username || api.password || api.search || api.hash || api.pathname !== "/api/v1" || api.host === origin.host ||
      !(api.protocol === "https:" || local && api.protocol === "http:" && api.hostname === "127.0.0.1")) throw Error("UI_ADMIN_BFF_INVALID");
  if (!env.ECOMMIUM_UI_ADMIN_SESSION_SECRET || env.ECOMMIUM_UI_ADMIN_SESSION_SECRET.length < 32 || env.ECOMMIUM_ADMIN_BFF_TOKEN) throw Error("UI_ADMIN_SESSION_CONFIG_INVALID");
  if (env.ECOMMIUM_UI_ALLOW_STOREFRONT_FIXTURES === "true" || env.GOOGLE_APPLICATION_CREDENTIALS || env.MEDIA_GCS_SERVICE_ACCOUNT_JSON) throw Error("UI_ADMIN_FORBIDDEN_CREDENTIAL");
  return origin;
}

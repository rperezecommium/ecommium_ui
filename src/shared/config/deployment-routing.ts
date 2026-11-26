import {adminOnlyOrigin} from "./admin-deployment-profile.mjs";
export {adminOnlyOrigin};
type Environment = Record<string, string | undefined>;
export function deploymentOrigins(env: Environment = process.env) {
  if (!env.ECOMMIUM_UI_ROUTING_MODE) return null;
  if (env.ECOMMIUM_UI_ROUTING_MODE !== "SEPARATED_V1") throw Error("UI_ROUTING_MODE_INVALID");
  const parse = (name: string) => {
    const raw = env[name] ?? "";
    const u = new URL(raw);
    if (u.origin !== raw || u.username || u.password ||
      !(u.protocol === "https:" || (env.NODE_ENV !== "production" && u.protocol === "http:" && u.hostname.endsWith(".local")))) throw Error("UI_ROUTING_ORIGIN_INVALID");
    return u;
  };
  const storefront = parse("ECOMMIUM_UI_STOREFRONT_ORIGIN");
  const admin = parse("ECOMMIUM_UI_ADMIN_ORIGIN");
  if (storefront.host === admin.host) throw Error("UI_ROUTING_ORIGINS_COLLIDE");
  for (const name of ["ECOMMIUM_STOREFRONT_BFF_BASE_URL", "ECOMMIUM_ADMIN_BFF_BASE_URL"]) {
    const api = new URL(env[name] ?? "");
    if ([storefront.host, admin.host].includes(api.host)) throw Error("UI_ROUTING_API_COLLISION");
  }
  return { storefront, admin };
}
export function deploymentSurface(host: string | null, path: string, env: Environment = process.env) {
  const adminOnly = adminOnlyOrigin(env);
  if (adminOnly) {
    if (!host || /[,\s/@\\]/.test(host) || host.toLowerCase() !== adminOnly.host.toLowerCase()) return "reject";
    try { path = decodeURIComponent(path); } catch { return "reject"; }
    if (path.includes("\\") || path.includes("%") || path.includes("\0") || path.split("/").some(segment => segment === "." || segment === "..")) return "reject";
    if (path === "/") return "admin-root";
    return /^\/(admin|auth)(\/|$)/.test(path) || /^\/api\/admin(\/|$)/.test(path) || path === "/api/health" ||
      /^\/(_next|assets)(\/|$)/.test(path) || /^\/(favicon\.ico|icon\.svg)$/.test(path) ? "allow" : "reject";
  }
  const origins = deploymentOrigins(env);
  if (!origins) return "legacy";
  if (path === "/api/health") return "allow";
  if (!host || /[,\s/@\\]/.test(host)) return "reject";
  try { path = decodeURIComponent(path); } catch { return "reject"; }
  if (path.includes("\\") || path.includes("%")) return "reject";
  const admin = host.toLowerCase() === origins.admin.host.toLowerCase();
  const storefront = host.toLowerCase() === origins.storefront.host.toLowerCase();
  if (!admin && !storefront) return "reject";
  if (path === "/api/health" || path.startsWith("/_next/")) return "allow";
  const adminPath = /^\/(admin|auth)(\/|$)/.test(path) || /^\/api\/admin(\/|$)/.test(path);
  if (admin) return path === "/" ? "admin-root" : adminPath || /^\/(assets|public-system)(\/|$)/.test(path) || /\.[a-z0-9]+$/i.test(path) ? "allow" : "reject";
  return adminPath ? "reject" : "allow";
}

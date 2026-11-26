export type StorefrontSitemap = {
  organizationId: string;
  shopId: string;
  locale: string;
  entries: Array<{ path: string; updatedAt: string }>;
};
export function parseStorefrontSitemap(
  v: unknown,
  expected: { organizationId: string; shopId: string; locale: string },
): StorefrontSitemap {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw Error("SITEMAP_INVALID");
  const r = v as StorefrontSitemap;
  if (
    r.organizationId !== expected.organizationId ||
    r.shopId !== expected.shopId ||
    r.locale !== expected.locale ||
    !Array.isArray(r.entries) ||
    r.entries.length > 50000 ||
    r.entries.some(
      (e) =>
        !e ||
        typeof e.path !== "string" ||
        !e.path.startsWith("/") ||
        e.path.startsWith("//") ||
        /[\\\u0000-\u001f]/.test(e.path) ||
        typeof e.updatedAt !== "string" ||
        !Number.isFinite(Date.parse(e.updatedAt)),
    )
  )
    throw Error("SITEMAP_INVALID");
  return r;
}
const xml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
export function sitemapXml(
  baseUrl: string,
  entries: StorefrontSitemap["entries"],
) {
  const base = new URL(baseUrl);
  if (
    !["https:", "http:"].includes(base.protocol) ||
    base.username ||
    base.password
  )
    throw Error("SITEMAP_BASE_URL_INVALID");
  const urls = [...new Map(entries.map((e) => [e.path, e])).values()];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((e) => `<url><loc>${xml(new URL(e.path, base).href)}</loc><lastmod>${xml(new Date(e.updatedAt).toISOString())}</lastmod></url>`).join("")}</urlset>`;
}

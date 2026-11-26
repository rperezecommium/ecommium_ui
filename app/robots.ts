import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const configured = process.env.NEXT_PUBLIC_ECOMMIUM_PUBLIC_BASE_URL;
  if (!configured)
    return { rules: { userAgent: "*", disallow: ["/admin/", "/auth/"] } };
  const base = new URL(configured);
  if (
    !["https:", "http:"].includes(base.protocol) ||
    base.username ||
    base.password
  )
    throw Error("ROBOTS_BASE_URL_INVALID");
  return {
    rules: { userAgent: "*", disallow: ["/admin/", "/auth/"] },
    sitemap: new URL("/sitemap.xml", base).href,
  };
}

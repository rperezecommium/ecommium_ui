import { getStorefrontContext } from "../../src/modules/storefront/storefront-context";
import { requestStorefrontBff } from "../../src/shared/bff/storefront-client";
import {
  parseStorefrontSitemap,
  sitemapXml,
} from "../../src/modules/storefront/sitemap";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const context = await getStorefrontContext();
    const locales = [
      ...new Set(
        (process.env.ECOMMIUM_STOREFRONT_SITEMAP_LOCALES ?? context.locale)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];
    if (
      !locales.length ||
      locales.length > 50 ||
      locales.some((l) => !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(l))
    )
      throw Error("SITEMAP_LOCALES_INVALID");
    const base = process.env.NEXT_PUBLIC_ECOMMIUM_PUBLIC_BASE_URL;
    if (!base) throw Error("SITEMAP_BASE_URL_REQUIRED");
    const entries = [];
    for (const locale of locales) {
      const c = {
        organizationId: context.organizationId,
        shopId: context.shopId,
        locale,
      };
      const result = await requestStorefrontBff(
        `/storefront/sitemap?${new URLSearchParams(c)}`,
        {
          context: { ...context, locale },
          init: { cache: "no-store" },
          parse: (v) => parseStorefrontSitemap(v, c),
        },
      );
      if (!result.ok) throw Error("SITEMAP_UNAVAILABLE");
      entries.push(...result.data.entries);
    }
    if (entries.length > 50000) throw Error("SITEMAP_INDEX_REQUIRED");
    return new Response(sitemapXml(base, entries), {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Sitemap temporalmente no disponible.", {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
}

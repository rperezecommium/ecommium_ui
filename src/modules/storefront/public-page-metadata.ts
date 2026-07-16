import type { Metadata } from "next";
import type {
  StorefrontPublicPageMetadata,
  StorefrontPublicPageResponse,
} from "./public-page-contract";

const fallbackDescription = "Compra online de forma sencilla y segura.";

export function buildStorefrontPublicMetadata(
  result: StorefrontPublicPageResponse,
): Metadata {
  if (result.kind === "REDIRECT") return hiddenMetadata();

  const publicMetadata = extractMetadata(result);
  return {
    title: publicMetadata.title,
    description: publicMetadata.description,
    alternates: { canonical: publicMetadata.canonicalPath },
    robots: {
      index: publicMetadata.indexable,
      follow: true,
    },
  };
}

export function hiddenMetadata(): Metadata {
  return { robots: { index: false, follow: false } };
}

function extractMetadata(
  result: Exclude<StorefrontPublicPageResponse, { kind: "REDIRECT" }>,
): StorefrontPublicPageMetadata {
  if (result.kind === "CMS_PAGE") {
    return {
      title: result.page.seo.title || result.page.title,
      description: result.page.seo.description || fallbackDescription,
      canonicalPath: result.route.canonicalPath,
      indexable: result.route.isCanonical,
    };
  }

  const title = pickText(result.page, ["seoTitle", "metaTitle", "title", "name"])
    || titleFromPath(result.route.canonicalPath);
  const description = pickText(result.page, [
    "seoDescription",
    "metaDescription",
    "shortDescription",
    "description",
  ]) || fallbackDescription;

  return {
    title,
    description,
    canonicalPath: result.route.canonicalPath,
    indexable: result.route.isCanonical,
  };
}

function pickText(value: Record<string, unknown>, keys: string[]): string {
  const sources = [value, asRecord(value.product), asRecord(value.category), asRecord(value.seo)]
    .filter((entry): entry is Record<string, unknown> => Boolean(entry));

  for (const source of sources) {
    for (const key of keys) {
      const candidate = source[key];
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
  }
  return "";
}

function titleFromPath(path: string) {
  const lastSegment = path.split("/").filter(Boolean).at(-1) ?? "Tienda";
  const words = decodeURIComponent(lastSegment).replace(/[-_]+/g, " ").trim();
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : "Tienda";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

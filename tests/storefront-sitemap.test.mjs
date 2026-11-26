import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
const { parseStorefrontSitemap, sitemapXml } = loadTs(
  "src/modules/storefront/sitemap.ts",
);
const context = { organizationId: "org", shopId: "shop", locale: "es-ES" };
const item = { path: "/bike/p?a=1&b=2", updatedAt: "2026-11-09T12:00:00Z" };
test("sitemap validates scope, relative paths and dates", () => {
  assert.equal(
    parseStorefrontSitemap({ ...context, entries: [item] }, context).entries
      .length,
    1,
  );
  for (const e of [
    { ...item, path: "//attacker.test/p" },
    { ...item, path: "/\\attacker.test/p" },
    { ...item, updatedAt: "bad" },
  ])
    assert.throws(() =>
      parseStorefrontSitemap({ ...context, entries: [e] }, context),
    );
  assert.throws(() =>
    parseStorefrontSitemap(
      { ...context, shopId: "other", entries: [] },
      context,
    ),
  );
});
test("XML escapes URLs, deduplicates paths and follows current owner entries", () => {
  const output = sitemapXml("https://shop.example", [item, item]);
  assert.equal((output.match(/<url>/g) || []).length, 1);
  assert.match(output, /a=1&amp;b=2/);
  assert.equal(
    sitemapXml("https://shop.example", []).includes("/bike/p"),
    false,
  );
  assert.throws(() => sitemapXml("javascript:alert(1)", [item]));
});

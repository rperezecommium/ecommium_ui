import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
const { remoteProductIdentityMatches: matches } = loadTs(
  "src/modules/catalogo/product-draft-identity.ts",
);
test("remote media can complete a new draft without replacing an existing product identity", () => {
  assert.equal(
    matches(
      {},
      {
        productId: "created",
        defaultVariantId: "default",
        mediaCollectionId: "gallery",
      },
    ),
    true,
  );
  assert.equal(
    matches({ productId: "existing" }, { productId: "other" }),
    false,
  );
  assert.equal(
    matches(
      { productId: "existing", defaultVariantId: "base" },
      { productId: "existing", defaultVariantId: "other-base" },
    ),
    false,
  );
  assert.equal(
    matches(
      { productId: "existing", mediaCollectionId: "gallery" },
      { productId: "existing", mediaCollectionId: "other-gallery" },
    ),
    false,
  );
  assert.equal(
    matches(
      { productId: "existing", defaultVariantId: "base" },
      { productId: "existing" },
    ),
    true,
  );
});

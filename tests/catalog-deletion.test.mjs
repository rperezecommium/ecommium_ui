import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
const { parseCatalogDeletionReview, parseCatalogDeletionOperation } = loadTs(
  "src/modules/catalogo/catalog-deletion-contract.ts",
);
const context = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  shopId: "22222222-2222-4222-8222-222222222222",
  locale: "es-ES",
};
const target = {
  ...context,
  productId: "33333333-3333-4333-8333-333333333333",
};
const id = "44444444-4444-4444-8444-444444444444";
const canonical = {
  ...target,
  variantId: null,
  kind: "product",
  name: "QA product",
  refId: "QA-DELETE",
};
const participants = Object.fromEntries(
  ["inventory", "pricing", "routing-seo", "media", "cms", "search"].map(
    (owner) => [
      owner,
      { version: "owner-v1", counts: { rows: 1 }, blockers: [] },
    ],
  ),
);
const review = {
  reviewId: id,
  version: "a".repeat(64),
  expiresAt: new Date(Date.now() + 60000).toISOString(),
  target: canonical,
  participants,
  canDelete: true,
};
const operation = {
  operationId: id,
  target: canonical,
  step: 15,
  status: "COMPLETED",
  error: null,
};
test("review validates every dependency and exact tenant/product identity", () => {
  assert.equal(parseCatalogDeletionReview(review, target).refId, "QA-DELETE");
  for (const v of [
    { ...review, canDelete: false },
    { ...review, participants: { ...participants, media: undefined } },
    { ...review, target: { ...canonical, shopId: id } },
    {
      ...review,
      participants: {
        ...participants,
        inventory: { version: "v1", counts: { rows: -1 }, blockers: [] },
      },
    },
  ])
    assert.throws(() => parseCatalogDeletionReview(v, target));
});
test("a blocked owner cannot be presented as deletable", () => {
  const blocked = {
    ...review,
    participants: {
      ...participants,
      cms: { ...participants.cms, blockers: ["CMS_IN_USE"] },
    },
    canDelete: false,
  };
  assert.equal(parseCatalogDeletionReview(blocked, target).canDelete, false);
  assert.throws(() =>
    parseCatalogDeletionReview({ ...blocked, canDelete: true }, target),
  );
});
test("an accepted/partial command is not a completed removal", () => {
  assert.equal(
    parseCatalogDeletionOperation(operation, target, id).status,
    "COMPLETED",
  );
  for (const v of [
    { ...operation, step: 14 },
    { ...operation, target: { ...canonical, variantId: id, kind: "variant" } },
    { ...operation, operationId: target.productId },
    { ...operation, status: "DONE" },
  ])
    assert.throws(() => parseCatalogDeletionOperation(v, target, id));
  assert.equal(
    parseCatalogDeletionOperation(
      { ...operation, step: 3, status: "ABORTING" },
      target,
      id,
    ).status,
    "ABORTING",
  );
});
function setup(permissions = ["catalog.products.delete"], active = context) {
  const calls = [],
    invalidations = [];
  const actions = loadTs("src/modules/catalogo/catalog-deletion-actions.ts", {
    "../auth/current-admin-session": {
      getCurrentAdminSession: async () => ({ permissions }),
    },
    "../../shared/config/admin-context": {
      getAdminContext: async () => active,
    },
    "next/cache": { revalidatePath: (p) => invalidations.push(p) },
    "../../shared/bff/admin-client": {
      requestAdminBff: async (path, options) => {
        calls.push({ path, options });
        return {
          ok: true,
          data: options.parse(
            path.includes("/capability")
              ? { available: true }
              : path.includes("deletion-preview")
                ? review
                : operation,
          ),
        };
      },
    },
  });
  return { actions, calls, invalidations };
}
test("missing delete permission and a changed context never reach the BFF", async () => {
  for (const { actions, calls } of [
    setup(["catalog.products.write"]),
    setup(["catalog.products.delete"], { ...context, shopId: id }),
  ]) {
    assert.equal((await actions.loadCatalogDeletionReview(target)).ok, false);
    assert.equal(calls.length, 0);
  }
});
test("confirmation sends only reviewed inputs and preserves the idempotency key", async () => {
  const { actions, calls } = setup();
  const input = {
    reviewId: id,
    version: review.version,
    confirmationRefId: review.target.refId,
    idempotencyKey: id,
  };
  assert.equal((await actions.confirmCatalogDeletion(target, input)).ok, true);
  assert.equal(calls[0].options.init.headers["idempotency-key"], id);
  assert.deepEqual(JSON.parse(calls[0].options.init.body), {
    reviewId: id,
    version: review.version,
    confirmationRefId: "QA-DELETE",
  });
  assert.match(calls[0].path, /organizationId=/);
});
test("completion is verified without unmounting its confirmation dialog", async () => {
  const { actions, invalidations } = setup();
  assert.equal((await actions.advanceCatalogDeletion(target, id)).ok, true);
  assert.equal(invalidations.length,0);
  assert.equal(invalidations.includes("/admin/products"), false);
});

test("durable asynchronous acceptance and blocked cleanup retain honest states", () => {
  for (const status of ["PENDING", "BLOCKED", "RETRYABLE"]) {
    const parsed = parseCatalogDeletionOperation({...operation, step: 0, status, asynchronous: true}, target);
    assert.equal(parsed.asynchronous, true);
    assert.equal(parsed.status, status);
  }
  assert.throws(() => parseCatalogDeletionOperation({...operation, asynchronous: "true"}, target));
});

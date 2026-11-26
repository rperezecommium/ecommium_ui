import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
const groupId = "44444444-4444-4444-8444-444444444444",
  fieldId = "55555555-5555-4555-8555-555555555555",
  organizationId = "11111111-1111-4111-8111-111111111111",
  shopId = "22222222-2222-4222-8222-222222222222",
  operationId = "66666666-6666-4666-8666-666666666666";
const context = { organizationId, shopId, locale: "es-ES" },
  input = {
    ...context,
    groupId,
    fieldId,
    operationId,
    expectedVersion: "a".repeat(64),
    confirmationName: "Material",
  };
const receipt = {
  operationId,
  groupId,
  fieldId,
  name: "Material",
  affectedProducts: 3200,
  affectedCategories: 2,
  scopes: [{ organizationId, shopId }],
  deleted: true,
  createdAt: "2026-11-07T12:00:00Z",
  cacheInvalidationPending: false,
};
const {
  parseFeatureDeletion,
  parseFeatureDeletionStatus,
  parseFeatureDeletionImpact,
} = loadTs("src/modules/catalogo/feature-deletion-contract.ts");
function setup({
  permissions = ["catalog.specifications.delete"],
  active = context,
  result = { ok: true, data: receipt },
} = {}) {
  const calls = [];
  const actions = loadTs("src/modules/catalogo/feature-deletion-actions.ts", {
    "../auth/current-admin-session": {
      getCurrentAdminSession: async () => ({ permissions }),
    },
    "../../shared/config/admin-context": {
      getAdminContext: async () => active,
    },
    "../../shared/bff/admin-client": {
      requestAdminBff: async (path, options) => {
        calls.push({ path, options });
        return result;
      },
    },
  });
  return { actions, calls };
}
test("permanent deletion validates identity, durable receipt and destructive intent", () => {
  assert.equal(
    parseFeatureDeletion(receipt, operationId).affectedProducts,
    3200,
  );
  for (const change of [
    { deleted: false },
    { operationId: groupId },
    { scopes: [] },
    { createdAt: "invalid" },
    { affectedProducts: -1 },
  ])
    assert.throws(() =>
      parseFeatureDeletion({ ...receipt, ...change }, operationId),
    );
  const impact = {
    groupId,
    fieldId,
    name: "Material",
    isActive: true,
    version: input.expectedVersion,
    affectedProducts: 3200,
    affectedCategories: 2,
    affectedShops: 1,
    scopes: receipt.scopes,
    preservesAssignments: false,
    action: "DELETE",
  };
  assert.equal(
    parseFeatureDeletionImpact(impact, groupId, fieldId).preservesAssignments,
    false,
  );
  assert.throws(() =>
    parseFeatureDeletionImpact(
      { ...impact, preservesAssignments: true },
      groupId,
      fieldId,
    ),
  );
});
test("ReadIndex completion requires every scope, zero selections and zero definitions", () => {
  const status = {
    ...receipt,
    completedShops: 1,
    totalShops: 1,
    remainingProducts: 0,
    remainingDefinitions: 0,
    unavailableShops: 0,
    complete: true,
  };
  assert.equal(parseFeatureDeletionStatus(status, operationId).complete, true);
  for (const change of [
    { remainingProducts: 1 },
    { remainingDefinitions: 1 },
    { unavailableShops: 1 },
    { cacheInvalidationPending: true },
    { completedShops: 0 },
    { totalShops: 2 },
  ])
    assert.throws(() =>
      parseFeatureDeletionStatus({ ...status, ...change }, operationId),
    );
  assert.equal(
    parseFeatureDeletionStatus(
      { ...status, completedShops: 0, remainingProducts: 20, complete: false },
      operationId,
    ).complete,
    false,
  );
});
test("write permission alone and stale context cannot delete or retry", async () => {
  for (const config of [
    { permissions: ["catalog.specifications.write"] },
    { active: { ...context, shopId: groupId } },
  ]) {
    const { actions, calls } = setup(config);
    assert.equal((await actions.confirmFeatureDeletion(input)).ok, false);
    assert.equal(
      (await actions.retryFeatureDeletionSynchronization(input)).ok,
      false,
    );
    assert.equal(calls.length, 0);
  }
});
test("mutation sends reviewed inputs, never client actor or authorized scopes", async () => {
  const { actions, calls } = setup();
  assert.equal(
    (
      await actions.confirmFeatureDeletion({
        ...input,
        actorId: "forged",
        authorizedScopes: [],
      })
    ).ok,
    true,
  );
  assert.deepEqual(JSON.parse(calls[0].options.init.body), {
    operationId,
    expectedVersion: input.expectedVersion,
    confirmationName: "Material",
  });
  assert.match(calls[0].path, /delete-operations\?organizationId=/);
  assert.equal(calls[0].options.context.shopId, shopId);
  assert.throws(() => calls[0].options.parse({ ...receipt, fieldId: groupId }));
});
test("status uses GET and synchronization retry never resends deletion", async () => {
  const { actions, calls } = setup();
  await actions.checkFeatureDeletion(input);
  await actions.retryFeatureDeletionSynchronization(input);
  assert.equal(calls[0].options.init, undefined);
  assert.match(calls[0].path, /field-delete-operations\/666/);
  assert.match(calls[1].path, /\/retry\?/);
  assert.deepEqual(JSON.parse(calls[1].options.init.body), {});
});
test("conflict requires a new review and rollout capability is fail closed", async () => {
  const { actions } = setup({
    result: { ok: false, status: 409, error: "Conflict" },
  });
  assert.match(
    (await actions.confirmFeatureDeletion(input)).error,
    /impacto ha cambiado/,
  );
  assert.equal(await actions.featureDeletionAvailable(), false);
  const enabled = setup({ result: { ok: true, data: true } });
  assert.equal(await enabled.actions.featureDeletionAvailable(), true);
  assert.equal(enabled.calls[0].options.parse({ available: false }), false);
  assert.equal(enabled.calls[0].options.parse({ available: "true" }), false);
  assert.equal(enabled.calls[0].options.parse({ available: true }), true);
});

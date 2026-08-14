import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/modules/configuracion/admin-installation.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});

let requestedPath = "";
let requestedOptions = null;
let responsePayload = null;

const exportsObject = {};
const context = {
  exports: exportsObject,
  module: { exports: exportsObject },
  require(specifier) {
    if (specifier.endsWith("/shared/bff/admin-client")) {
      return {
        requestAdminBff: async (path, options) => {
          requestedPath = path;
          requestedOptions = options;
          return {
            ok: true,
            data: options.parse(responsePayload),
            status: 200,
            correlationId: "test-correlation",
          };
        },
      };
    }
    throw new Error(`Unexpected import: ${specifier}`);
  },
};

vm.runInNewContext(outputText, context);

const {
  getAdminInstallationStatus,
  parseAdminInstallationAdoptionCompletion,
  parseAdminInstallationFreshCompletion,
  parseAdminInstallationStatus,
} = context.module.exports;

const expectedActions = {
  NOT_INITIALIZED: [false, false, true],
  FRESH_CLAIM_REQUIRED: [false, false, true],
  FRESH_READY: [true, false, false],
  ADOPTION_REQUIRED: [false, true, false],
  REVIEW_REQUIRED: [false, false, true],
  COMPLETED: [false, false, false],
};

test("status parser accepts only the six public states with coherent actions", () => {
  for (const [state, [completeFresh, completeAdoption, contactOperator]] of Object.entries(expectedActions)) {
    const parsed = parseAdminInstallationStatus({
      schema: "admin-installation-public-status.v1",
      state,
      actions: { completeFresh, completeAdoption, contactOperator },
    });

    assert.equal(parsed.state, state);
    assert.deepEqual(
      { ...parsed.actions },
      { completeFresh, completeAdoption, contactOperator },
    );
  }
});

test("status parser rejects leaks and incoherent action flags", () => {
  assert.throws(() => parseAdminInstallationStatus({
    schema: "admin-installation-public-status.v1",
    state: "REVIEW_REQUIRED",
    actions: { completeFresh: false, completeAdoption: false, contactOperator: true },
    candidateEmail: "secret@example.test",
  }));

  assert.throws(() => parseAdminInstallationStatus({
    schema: "admin-installation-public-status.v1",
    state: "ADOPTION_REQUIRED",
    actions: { completeFresh: false, completeAdoption: false, contactOperator: true },
  }));
});

test("installation status always uses the public StoreAdmin route without bearer", async () => {
  responsePayload = {
    schema: "admin-installation-public-status.v1",
    state: "FRESH_READY",
    actions: { completeFresh: true, completeAdoption: false, contactOperator: false },
  };

  const result = await getAdminInstallationStatus();

  assert.equal(result.ok, true);
  assert.equal(requestedPath, "/admin/installation/status");
  assert.equal(requestedOptions.withAuth, false);
});

test("completion parsers accept only redacted terminal responses", () => {
  const fresh = parseAdminInstallationFreshCompletion({
    schema: "admin-installation-public-fresh-completion.v1",
    outcome: "CREATED",
    state: "COMPLETED",
  });
  assert.equal(fresh.outcome, "CREATED");

  const adopted = parseAdminInstallationAdoptionCompletion({
    schema: "admin-installation-public-adoption-completion.v1",
    outcome: "ADOPTED",
    state: "COMPLETED",
    security: {
      revokedSessions: 2,
      currentSessionRevoked: true,
      requiresLogin: true,
    },
  });
  assert.equal(adopted.security.revokedSessions, 2);

  assert.throws(() => parseAdminInstallationFreshCompletion({
    schema: "admin-installation-public-fresh-completion.v1",
    outcome: "CREATED",
    state: "COMPLETED",
    email: "must-not-leak@example.test",
  }));
});

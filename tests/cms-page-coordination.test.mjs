import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import Ajv from "ajv";
const schema = JSON.parse(
  fs.readFileSync(
    "docs/contracts/cms-composition-boundary.schema.json",
    "utf8",
  ),
);
const exports = {};
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(
      "src/modules/cms/cms-page-composition-validation.ts",
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  {
    exports,
    TextEncoder,
    require: (name) =>
      name === "server-only" ? {} : name === "ajv" ? Ajv : schema,
  },
);
for (const [kind, operation] of [
  ["pageChangePath", "CHANGE_PATH"],
  ["pageUnpublish", "UNPUBLISH"],
  ["pageDelete", "DELETE"],
]) {
  test(`${operation} requires revision and stable operation id at the UI boundary`, () => {
    const body = {
      contractVersion: 1,
      operation,
      operationId: "00000000-0000-4000-8000-000000000001",
      expectedRevision: "revision",
      ...(operation === "CHANGE_PATH" ? { nextPath: "/new" } : {}),
    };
    assert.doesNotThrow(() => exports.validatePageContract(kind, body));
    const missing = { ...body };
    delete missing.expectedRevision;
    assert.throws(() => exports.validatePageContract(kind, missing));
    assert.throws(() =>
      exports.validatePageContract(kind, { ...body, operationId: "random" }),
    );
    assert.throws(() =>
      exports.validatePageContract(kind, { ...body, force: true }),
    );
  });
}

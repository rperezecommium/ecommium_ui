import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(file, dependencies = {}) {
  const source = readFileSync(new URL(`../src/modules/catalogo/${file}.ts`, import.meta.url), "utf8");
  const context = { exports: {}, process: { env: { NODE_ENV: "production" } }, require: (name) => dependencies[name] ?? {} };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, context);
  return context.exports;
}

const schema = load("product-list-view");

test("view schema validates columns and pagination without accepting business filters", () => {
  assert.equal(schema.parseProductListView({ columns: ["price", "id"], limit: 50 }).columns.join(","), "id,price");
  for (const value of [null, {}, { columns: [], limit: 20 }, { columns: ["unknown"], limit: 20 },
    { columns: ["id", "id"], limit: 20 }, { columns: ["id"], limit: 201 },
    { columns: ["id"], limit: 1.5 }, { columns: ["id"], limit: 20, productIds: ["p1"] }]) {
    assert.equal(schema.parseProductListView(value), null);
  }
});

test("pin persists only presentation settings and reset expires the same cookie", async () => {
  const writes = [];
  const actions = load("product-list-view-actions", {
    "next/headers": { cookies: async () => ({ set: (...args) => writes.push(args) }) },
    "next/cache": { revalidatePath: () => {} },
    "next/navigation": { redirect: (url) => { throw new Error(url); } },
    "./product-list-view-cookie": { productListViewCookieName: async () => "employee-view" },
    "./product-list-view": schema,
  });
  const form = new FormData();
  form.set("columns", "id,price"); form.set("limit", "50");
  await actions.pinProductListViewAction(form);
  assert.equal(writes[0][0], "employee-view");
  assert.deepEqual(JSON.parse(writes[0][1]), { columns: ["id", "price"], limit: 50 });
  assert.equal(writes[0][2].httpOnly, true);
  assert.equal(writes[0][2].secure, true);
  assert.ok(writes[0][2].maxAge > 0);
  await assert.rejects(actions.resetProductListViewAction(), /\/admin\/products/);
  assert.equal(writes[1][0], writes[0][0]);
  assert.equal(writes[1][2].path, writes[0][2].path);
  assert.equal(writes[1][2].maxAge, 0);
  form.set("columns", "invalid");
  await assert.rejects(actions.pinProductListViewAction(form), /no es válida/);
  assert.equal(writes.length, 2);
});

test("view actions reject an anonymous session", async () => {
  const actions = load("product-list-view-actions", {
    "next/navigation": { redirect: (url) => { throw new Error(url); } },
    "./product-list-view-cookie": { productListViewCookieName: async () => null },
  });
  await assert.rejects(actions.pinProductListViewAction(new FormData()), /\/auth\/login/);
  await assert.rejects(actions.resetProductListViewAction(), /\/auth\/login/);
});

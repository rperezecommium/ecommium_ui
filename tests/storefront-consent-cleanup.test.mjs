import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(
  new URL("../src/modules/storefront/storefront-consent-cleanup.tsx", import.meta.url),
  "utf8",
);

function loadCleanupModule() {
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  const context = { exports, module: { exports }, require: () => ({}) };
  vm.runInNewContext(output, context);
  return context.module.exports;
}

const cleanup = loadCleanupModule();

test("Google Analytics cleanup uses only its controlled cookie keys", () => {
  assert.deepEqual(
    JSON.parse(JSON.stringify(cleanup.googleAnalyticsCookieNames("G-ABCDE123"))),
    ["_ga", "_ga_ABCDE123"],
  );
  assert.deepEqual(JSON.parse(JSON.stringify(cleanup.googleAnalyticsCookieNames("invalid"))), []);
  assert.doesNotMatch(source, /localStorage\.clear|\*\s*=/);
});

test("Google Analytics cleanup expires known cookies and blocks later hits", () => {
  const writes = [];
  const documentValue = { set cookie(value) { writes.push(value); } };
  const windowValue = {};
  cleanup.clearGoogleAnalyticsBrowserData("G-ABCDE123", documentValue, "shop.example.test", windowValue);
  assert.equal(windowValue["ga-disable-G-ABCDE123"], true);
  assert.ok(writes.every((value) => value.startsWith("_ga") && value.includes("Max-Age=0")));
  assert.ok(writes.some((value) => value.includes("Domain=example.test")));
});

test("Meta Pixel cleanup expires only its controlled first-party cookies", () => {
  const writes = [];
  const documentValue = { set cookie(value) { writes.push(value); } };
  cleanup.clearMetaPixelBrowserData("123456789012345", documentValue, "shop.example.test");
  assert.ok(writes.every((value) => /^_fb[pc]=/.test(value) && value.includes("Max-Age=0")));
  assert.ok(writes.some((value) => value.includes("Domain=example.test")));
  assert.equal(writes.length, 6);
});

test("Meta Pixel receives a native revoke signal before browser data is removed", () => {
  const commands = [];
  cleanup.revokeMetaPixelTracking({ fbq: (...args) => commands.push(args) });
  assert.deepEqual(JSON.parse(JSON.stringify(commands)), [["consent", "revoke"]]);
});

test("Matomo cleanup only expires cookies for the declared site ID", () => {
  const writes = [];
  const documentValue = {
    get cookie() { return "_pk_id.7.abcd=value; _pk_ses.7.abcd=value; unrelated=value"; },
    set cookie(value) { writes.push(value); },
  };
  cleanup.clearMatomoCloudBrowserData("7", documentValue, "shop.example.test");
  assert.ok(writes.every((value) => /^_pk_(id|ses)\.7\./.test(value) && value.includes("Max-Age=0")));
  assert.equal(writes.length, 6);
});

test("Matomo receives a native withdrawal and cookie deletion signal", () => {
  const commands = [];
  cleanup.revokeMatomoCloudTracking({ _paq: { push: (command) => commands.push(command) } });
  assert.deepEqual(JSON.parse(JSON.stringify(commands)), [["forgetConsentGiven"], ["deleteCookies"]]);
});

test("Clarity cleanup expires only its controlled first-party cookies", () => {
  const writes = [];
  const documentValue = { set cookie(value) { writes.push(value); } };
  cleanup.clearMicrosoftClarityBrowserData("abc123", documentValue, "shop.example.test");
  assert.ok(writes.every((value) => /^_cl(ck|sk)=/.test(value) && value.includes("Max-Age=0")));
  assert.equal(writes.length, 6);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function setup() {
  class Element {}
  class Input extends Element {
    name = "name"; id = ""; type = "text"; value = "edited";
    dataset = {}; disabled = false; focused = false; highlighted = false;
    classList = { add: () => { this.highlighted = true; }, remove: () => { this.highlighted = false; } };
    focus() { this.focused = true; }
    scrollIntoView() { this.scrolled = true; }
    addEventListener(type, callback) { this[type] = callback; }
  }
  const control = new Input();
  const form = { dataset: {}, id: "details", elements: [control] };
  form.elements.item = (index) => form.elements[index];
  const storage = new Map();
  const context = {
    exports: {}, require: () => ({}), console, Element,
    HTMLInputElement: Input, HTMLTextAreaElement: class extends Element {},
    HTMLSelectElement: class extends Element {},
    document: { forms: [form] },
    window: { sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    } },
  };
  const source = readFileSync(new URL("../src/app-shell/admin-session-guardian.tsx", import.meta.url), "utf8")
    + "\nexport { recoveryEnabledForPathname, snapshotForm, snapshotAllForms, snapshotVisibleForms, readRecovery, writeDismissedRecovery, focusRecoveryControl };";
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020,
  } }).outputText, context);
  return { api: context.exports, control, form };
}

test("discarded recovery stays dismissed across passive snapshots and reloaded form values", () => {
  const { api, control } = setup();
  api.writeDismissedRecovery("employee", "/admin/products", {
    ...api.snapshotVisibleForms("/admin/products"), discarded: true,
  });
  control.value = "server value after reload";
  api.snapshotAllForms("employee", "/admin/products");
  assert.equal(api.readRecovery("employee", "/admin/products"), null);
});

test("a new edit creates a new recovery and focuses the exact edited field", () => {
  const { api, control, form } = setup();
  api.writeDismissedRecovery("employee", "/admin/products", {
    ...api.snapshotVisibleForms("/admin/products"), discarded: true,
  });
  control.value = "new edit";
  api.snapshotForm(form, "employee", "/admin/products", control);
  const recovery = api.readRecovery("employee", "/admin/products");
  assert.equal(recovery.forms.details.name.value, "new edit");
  api.focusRecoveryControl(recovery);
  assert.equal(control.focused, true);
  assert.equal(control.scrolled, true);
  assert.equal(control.highlighted, true);
  control.blur();
  assert.equal(control.highlighted, false);
  control.name = "different field";
  control.focused = false;
  api.focusRecoveryControl(recovery);
  assert.equal(control.focused, false);
});


test("structured product drafts use editor recovery while the product list retains form recovery", () => {
  const { api } = setup();
  assert.equal(api.recoveryEnabledForPathname("/admin/products/new"), false);
  assert.equal(api.recoveryEnabledForPathname("/admin/products/product-id"), false);
  assert.equal(api.recoveryEnabledForPathname("/admin/products"), true);
  assert.equal(api.recoveryEnabledForPathname("/admin/configuracion/equipo"), true);
});

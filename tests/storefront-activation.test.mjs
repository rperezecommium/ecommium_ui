import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const source = (relativePath) => readFileSync(path.resolve(root, relativePath), "utf8");

test("opening an activation link has no side effect and requires an explicit confirmation", () => {
  const page = source("app/auth/activate/page.tsx");
  const form = source("src/modules/storefront/storefront-activation-form.tsx");

  assert.match(page, /StorefrontActivationForm/);
  assert.doesNotMatch(page, /await activateStorefrontCustomer/);
  assert.match(form, /useActionState/);
  assert.match(form, /name="token" type="hidden"/);
  assert.match(form, /Activar cuenta/);
});

test("activation errors distinguish service unavailability from invalid or consumed links", () => {
  const actions = source("src/modules/storefront/storefront-auth-actions.ts");

  assert.match(actions, /result\.status >= 500/);
  assert.match(actions, /enlace no se ha consumido/);
  assert.match(actions, /ya fue utilizado o expiró/);
});

test("activation returns to the Storefront and opens only the customer login", () => {
  const form = source("src/modules/storefront/storefront-activation-form.tsx");
  const home = source("app/page.tsx");
  const header = source("src/modules/storefront/storefront-header.tsx");

  assert.match(form, /href="\/?\?customerLogin=1"/);
  assert.doesNotMatch(form, /href="\/auth\/login"/);
  assert.match(home, /openCustomerLogin/);
  assert.match(header, /initialMode=\{openCustomerLogin/);
});

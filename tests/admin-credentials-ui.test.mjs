import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the Admin credential UI uses only the StoreAdmin BFF credential contracts", () => {
  const actions = source("src/modules/auth/admin-credential-actions.ts");
  const availability = source("src/modules/auth/admin-password-recovery-availability.ts");

  assert.match(actions, /"\/admin\/auth\/password-recovery\/request"/);
  assert.match(actions, /"\/admin\/auth\/password-recovery\/complete"/);
  assert.match(actions, /"\/admin\/auth\/password\/change"/);
  assert.match(actions, /"\/admin\/session\/step-up"/);
  assert.doesNotMatch(actions, /localStorage|sessionStorage|services\//);
  assert.match(availability, /"\/admin\/auth\/password-recovery\/availability"/);
  assert.match(availability, /withAuth: false/);
  assert.match(availability, /cache: "no-store"/);
});

test("recovery consumes the URL token into an HttpOnly signed cookie and redirects cleanly", () => {
  const route = source("app/auth/admin/password-recovery/consume/route.ts");
  const cookie = source("src/shared/auth/admin-credential-recovery-cookie.ts");

  assert.match(route, /NextResponse\.redirect\(destination, 303\)/);
  assert.match(route, /Cache-Control", "private, no-store, max-age=0/);
  assert.match(route, /Referrer-Policy", "no-referrer/);
  assert.match(cookie, /httpOnly: true/);
  assert.match(cookie, /sealAdminSessionCookie/);
  assert.match(cookie, /maxAgeSeconds = 15 \* 60/);
});

test("MUST_CHANGE_PASSWORD has a dedicated route and blocks the ordinary Admin layout", () => {
  const layout = source("app/(admin)/admin/layout.tsx");
  const forcedPage = source("app/(credential)/admin/password/page.tsx");

  assert.match(layout, /credentialState === "MUST_CHANGE_PASSWORD"/);
  assert.match(layout, /redirect\("\/admin\/password"\)/);
  assert.match(forcedPage, /No podrás acceder al resto del Admin/);
  assert.match(forcedPage, /changeOwnAdminPasswordAction/);
});

test("only the Team screen exposes a reset invitation and never a temporary password", () => {
  const employeesActions = source("src/modules/configuracion/employees-actions.ts");
  const employeesPage = source("src/modules/configuracion/employees-admin-page.tsx");

  assert.match(employeesActions, /credential-reset\?organizationId=/);
  assert.match(employeesActions, /mode: "INVITATION"/);
  assert.match(employeesActions, /roles\.has\("superadmin"\)/);
  assert.match(employeesPage, /Enviar invitación de credenciales/);
  const resetStart = employeesPage.lastIndexOf("Restablecer credenciales");
  const resetSection = employeesPage.slice(resetStart, resetStart + 1_000);
  assert.doesNotMatch(resetSection, /temporaryPassword/);
});

test("Team lets a security administrator select only an already permitted default shop", () => {
  const employeesActions = source("src/modules/configuracion/employees-actions.ts");
  const employeesPage = source("src/modules/configuracion/employees-admin-page.tsx");

  assert.match(employeesActions, /\/preferences/);
  assert.match(employeesActions, /preferences: \{ defaultShopId \}/);
  assert.match(employeesPage, /selectedEmployeeAllowedShops/);
  assert.match(employeesPage, /Solo puedes elegir tiendas ya permitidas para este empleado/);
  assert.match(employeesPage, /Guardar tienda predeterminada/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);

function source(relativePath) {
  return readFileSync(path.resolve(root, relativePath), "utf8");
}

test("communications admin is exposed under configuration navigation", () => {
  const shellSource = source("src/app-shell/admin-shell.tsx");
  const configSource = source("app/(admin)/admin/configuracion/page.tsx");
  const routeSource = source("app/(admin)/admin/configuracion/comunicaciones/page.tsx");
  const permissionsSource = source("src/shared/permissions/permissions.ts");

  assert.match(shellSource, /\/admin\/configuracion\/comunicaciones/);
  assert.match(shellSource, /communications:view/);
  assert.match(configSource, /Abrir comunicaciones/);
  assert.match(routeSource, /getCommunicationsAdminData/);
  assert.match(permissionsSource, /communications\.manage/);
});

test("communications admin uses BFF endpoints for email provider and auth templates", () => {
  const dataSource = source("src/modules/configuracion/communications-admin.ts");
  const actionsSource = source("src/modules/configuracion/communications-admin-actions.ts");
  const pageSource = source("src/modules/configuracion/communications-admin-page.tsx");

  assert.match(dataSource, /\/admin\/communications\/settings\/email-provider/);
  assert.match(dataSource, /\/admin\/communications\/templates\/email/);
  assert.match(dataSource, /\/admin\/communications\/templates\/email\/auth-defaults/);
  assert.match(dataSource, /\/admin\/communications\/email\/send/);
  assert.match(actionsSource, /secret/);
  assert.match(actionsSource, /clearSecret/);
  assert.match(actionsSource, /sendCommunicationsTestEmailAction/);
  assert.match(actionsSource, /recipientEmail/);
  assert.match(actionsSource, /admin-communications-test/);
  assert.match(actionsSource, /communications\.manage/);
  assert.match(pageSource, /drawer: "provider"/);
  assert.match(pageSource, /adminSideDrawer/);
  assert.match(pageSource, /Configurar proveedor/);
  assert.match(pageSource, /Secret ya configurado/);
  assert.match(pageSource, /Password \/ API key/);
  assert.match(pageSource, /Destinatario de prueba/);
  assert.match(pageSource, /Enviar prueba/);
  assert.match(pageSource, /Crear defaults auth/);
  assert.match(pageSource, /customer\.account\.activation/);
  assert.doesNotMatch(pageSource, /adminBadge">test/);
  assert.doesNotMatch(pageSource, /adminBadge">auth/);
  assert.doesNotMatch(dataSource, /localStorage/);
});

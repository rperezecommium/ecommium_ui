import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);

test("Analytics is available as a protected top-level Admin area", () => {
  const shell = readFileSync(path.resolve(root, "src/app-shell/admin-shell.tsx"), "utf8");
  const navigation = readFileSync(path.resolve(root, "src/app-shell/admin-navigation.tsx"), "utf8");
  const permissions = readFileSync(path.resolve(root, "src/shared/permissions/permissions.ts"), "utf8");
  const route = readFileSync(path.resolve(root, "app/(admin)/admin/analitica/page.tsx"), "utf8");

  assert.match(shell, /href: "\/admin\/analitica"/);
  assert.match(shell, /permission: "admin:analytics:view"/);
  assert.match(navigation, /"\/admin\/analitica": ChartColumn/);
  assert.match(permissions, /"admin:analytics:view": \["admin:analytics:view", "analytics\.reports\.read"\]/);
  assert.match(route, /getAdminSession/);
  assert.match(route, /can\(session, "admin:analytics:view"\)/);
  assert.doesNotMatch(route, /requestAdminBff/);
});

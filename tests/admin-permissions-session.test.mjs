import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
const { getEmployeesCapabilities } = loadTs(
  "src/modules/configuracion/employees-capabilities.ts",
);
test("employee read/manage/security capabilities remain distinct", () => {
  assert.deepEqual(
    getEmployeesCapabilities({
      permissions: ["employees.read"],
      roles: ["admin"],
    }),
    {
      canManageEmployees: false,
      canManageProfiles: false,
      canResetCredentials: false,
    },
  );
  assert.equal(
    getEmployeesCapabilities({
      permissions: ["employees.manage"],
      roles: ["admin"],
    }).canManageProfiles,
    false,
  );
  assert.equal(
    getEmployeesCapabilities({
      permissions: ["employees.security"],
      roles: ["admin"],
    }).canManageEmployees,
    false,
  );
  assert.equal(
    getEmployeesCapabilities({
      permissions: ["employees.security"],
      roles: ["admin"],
    }).canManageProfiles,
    true,
  );
  assert.equal(
    getEmployeesCapabilities({ permissions: ["*"], roles: ["superadmin"] })
      .canResetCredentials,
    true,
  );
  assert.equal(getEmployeesCapabilities(null).canManageEmployees, false);
});
function setup({
  meState = "NORMAL",
  meStatus = 200,
  requiresLogin = false,
} = {}) {
  const current = {
    employeeId: "employee-1",
    name: "QA",
    email: "qa@example.test",
    scope: "admin",
    principalType: "EMPLOYEE",
    profile: "Operator",
    roles: ["admin"],
    permissions: ["*"],
    accessToken: "old-access",
    refreshToken: "old-refresh",
    credentialState: "MUST_CHANGE_PASSWORD",
  };
  let saved = null,
    cleared = false,
    reads = 0;
  const calls = [];
  const actions = loadTs("src/modules/auth/admin-credential-actions.ts", {
    "next/cache": { revalidatePath() {} },
    "next/navigation": {
      redirect: (url) => {
        throw Object.assign(Error("redirect"), { url });
      },
    },
    "next/headers": { cookies: async () => ({ get: () => null }) },
    "../../shared/auth/admin-credential-recovery-cookie": {},
    "../../shared/config/admin-context": { clearAdminContext: async () => {} },
    "../../shared/auth/session": {
      getAdminSession: async () => current,
      saveAdminSession: async (s) => {
        saved = s;
      },
      clearAdminSession: async () => {
        cleared = true;
      },
    },
    "../../shared/auth/admin-session-refresh": {
      refreshAdminTokens: async () => ({
        ok: true,
        accessToken: "rotated-access",
        refreshToken: "rotated-refresh",
        expiresAt: "2030-01-01T00:00:00Z",
      }),
    },
    "../../shared/bff/admin-client": {
      requestAdminBff: async (path, options) => {
        calls.push({ path, options });
        let data;
        if (path === "/admin/session/step-up") data = { status: "VERIFIED" };
        else if (path === "/admin/auth/password/change")
          data = { status: "password_changed", security: { requiresLogin } };
        else {
          if (++reads === 1 && meStatus !== 200)
            return { ok: false, status: meStatus };
          data = {
            principal: {
              sub: "employee-1",
              principalType: "EMPLOYEE",
              scope: "admin",
              email: "qa@example.test",
              roles: [],
              permissions: [],
              credentialState: meState,
            },
          };
        }
        return {
          ok: true,
          status: 200,
          data: options.parse ? options.parse(data) : data,
        };
      },
    },
  });
  const form = new FormData();
  for (const [k, v] of Object.entries({
    currentPassword: "temporary-secret",
    newPassword: "new-secret-123",
    confirmation: "new-secret-123",
    returnTo: "/admin/password",
  }))
    form.set(k, v);
  return { actions, form, calls, saved: () => saved, cleared: () => cleared };
}
test("password change persists authoritative NORMAL and removes stale elevated permissions", async () => {
  const f = setup();
  await assert.rejects(f.actions.changeOwnAdminPasswordAction(f.form), (e) =>
    e.url?.includes("notice="),
  );
  assert.equal(f.saved().credentialState, "NORMAL");
  assert.deepEqual(f.saved().permissions, []);
  assert.deepEqual(f.saved().roles, []);
  assert.equal(f.cleared(), false);
});
test("password change refreshes and retries auth/me on 401 and stores rotated HttpOnly session values", async () => {
  const f = setup({ meStatus: 401 });
  await assert.rejects(f.actions.changeOwnAdminPasswordAction(f.form), (e) =>
    e.url?.includes("notice="),
  );
  assert.equal(f.saved().accessToken, "rotated-access");
  assert.equal(f.saved().refreshToken, "rotated-refresh");
  assert.equal(
    f.calls.filter((x) => x.path === "/auth/me").at(-1).options.init.headers
      .authorization,
    "Bearer rotated-access",
  );
});
test("password confirmed but state unverified cannot fabricate NORMAL or leave the pending loop", async () => {
  const f = setup({ meState: "MUST_CHANGE_PASSWORD" });
  await assert.rejects(f.actions.changeOwnAdminPasswordAction(f.form), (e) =>
    e.url?.startsWith("/auth/login"),
  );
  assert.equal(f.saved(), null);
  assert.equal(f.cleared(), true);
});
test("backend requiresLogin clears session without trying to retain it", async () => {
  const f = setup({ requiresLogin: true });
  await assert.rejects(f.actions.changeOwnAdminPasswordAction(f.form), (e) =>
    e.url?.startsWith("/auth/login"),
  );
  assert.equal(f.cleared(), true);
  assert.equal(
    f.calls.some((x) => x.path === "/auth/me"),
    false,
  );
});

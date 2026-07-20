import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/modules/configuracion/employees-actions.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});

const bffCalls = [];
const commonJsExports = {};
const moduleContext = {
  FormData,
  URLSearchParams,
  encodeURIComponent,
  exports: commonJsExports,
  module: { exports: commonJsExports },
  require(specifier) {
    if (specifier === "next/cache") {
      return {
        revalidatePath: () => undefined,
      };
    }
    if (specifier === "next/navigation") {
      return {
        redirect(url) {
          throw Object.assign(new Error("redirect"), { url });
        },
      };
    }
    if (specifier.endsWith("/shared/bff/client")) {
      return {
        requestBff: async (path, options = {}) => {
          bffCalls.push({ path, options });
          return { ok: true, data: {}, status: 200, correlationId: "test-correlation" };
        },
      };
    }
    if (specifier.endsWith("/shared/config/admin-context")) {
      return {
        getAdminContext: async () => ({
          organizationId: "11111111-1111-4111-8111-111111111111",
          shopId: "22222222-2222-4222-8222-222222222222",
          shopAlias: "tienda-barcelona",
          shopName: "Barcelona",
          primaryDomain: "",
          shopStatus: "ACTIVE",
          locale: "es-ES",
          currency: "EUR",
          country: "ES",
          channel: "admin",
        }),
      };
    }
    if (specifier === "./employees") {
      return {
        buildEmployeesMutationPath: (path, organizationId, shopId) => {
          const params = new URLSearchParams({ organizationId, shopId });
          return `${path}?${params.toString()}`;
        },
      };
    }

    throw new Error(`Unexpected require: ${specifier}`);
  },
};

vm.runInNewContext(outputText, moduleContext);

const { createEmployeeAction, updateEmployeeAction, updateEmployeeShopScopesAction } = moduleContext.module.exports;

test("employee create POST sends initial shop scopes", async () => {
  bffCalls.length = 0;
  const formData = new FormData();
  formData.set("email", "employee.new@ecommium.local");
  formData.set("firstName", "New");
  formData.set("lastName", "Employee");
  formData.set("temporaryPassword", "Password#2026");
  formData.set("active", "on");
  formData.append("profileIds", "profile-1");
  formData.append("shopScopes", "11111111-1111-4111-8111-111111111111|22222222-2222-4222-8222-222222222222");

  await assert.rejects(() => createEmployeeAction(formData), { url: "/admin/configuracion/equipo?tab=employees&notice=Empleado+creado." });

  assert.equal(
    bffCalls[0].path,
    "/admin/employees?organizationId=11111111-1111-4111-8111-111111111111&shopId=22222222-2222-4222-8222-222222222222",
  );
  assert.equal(bffCalls[0].options.init.method, "POST");
  assert.deepEqual(JSON.parse(bffCalls[0].options.init.body), {
    email: "employee.new@ecommium.local",
    firstName: "New",
    lastName: "Employee",
    temporaryPassword: "Password#2026",
    active: true,
    status: "ACTIVE",
    profileIds: ["profile-1"],
    shopScopes: [
      {
        organizationId: "11111111-1111-4111-8111-111111111111",
        shopId: "22222222-2222-4222-8222-222222222222",
      },
    ],
  });
});

test("employee edit PATCH sends firstName and lastName contract payload", async () => {
  bffCalls.length = 0;
  const formData = new FormData();
  formData.set("employeeId", "employee-1780499336703");
  formData.set("email", "employee.profile.1780499336703@ecommium.local");
  formData.set("firstName", "Profile");
  formData.set("lastName", "Assigned");
  formData.set("name", "Should Not Persist");
  formData.set("status", "ACTIVE");
  formData.append("profileIds", "profile-1");

  await assert.rejects(() => updateEmployeeAction(formData), { url: "/admin/configuracion/equipo?tab=employees&notice=Empleado+actualizado." });

  assert.equal(
    bffCalls[0].path,
    "/admin/employees/employee-1780499336703?organizationId=11111111-1111-4111-8111-111111111111&shopId=22222222-2222-4222-8222-222222222222",
  );
  assert.equal(bffCalls[0].options.init.method, "PATCH");
  assert.deepEqual(JSON.parse(bffCalls[0].options.init.body), {
    email: "employee.profile.1780499336703@ecommium.local",
    firstName: "Profile",
    lastName: "Assigned",
    active: true,
    status: "ACTIVE",
    profileIds: ["profile-1"],
  });
});

test("employee shop scopes PUT replaces allowed shop list", async () => {
  bffCalls.length = 0;
  const formData = new FormData();
  formData.set("employeeId", "employee-limited");
  formData.append("shopScopes", "11111111-1111-4111-8111-111111111111|22222222-2222-4222-8222-222222222222");

  await assert.rejects(() => updateEmployeeShopScopesAction(formData), { url: "/admin/configuracion/equipo?tab=employees&notice=Acceso+a+tiendas+actualizado." });

  assert.equal(
    bffCalls[0].path,
    "/admin/employees/employee-limited/shop-scopes?organizationId=11111111-1111-4111-8111-111111111111&shopId=22222222-2222-4222-8222-222222222222",
  );
  assert.equal(bffCalls[0].options.init.method, "PUT");
  assert.deepEqual(JSON.parse(bffCalls[0].options.init.body), {
    shopScopes: [
      {
        organizationId: "11111111-1111-4111-8111-111111111111",
        shopId: "22222222-2222-4222-8222-222222222222",
      },
    ],
  });
});

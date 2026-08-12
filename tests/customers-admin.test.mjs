import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(new URL("..", import.meta.url).pathname);

function loadCustomersAdminModule(requestAdminBff) {
  const source = readFileSync(path.resolve(root, "src/modules/clientes/customers-admin.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const commonJsExports = {};
  const moduleContext = {
    URLSearchParams,
    exports: commonJsExports,
    module: { exports: commonJsExports },
    require(specifier) {
      if (specifier.endsWith("/shared/bff/admin-client")) {
        return { requestAdminBff };
      }
      if (specifier.endsWith("/shared/config/admin-context")) {
        return {
          hasRequiredAdminContext(context) {
            return Boolean(context.organizationId && context.shopId);
          },
        };
      }

      return {};
    },
  };

  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
}

function loadCustomersActionsModule({
  requestAdminBff,
  getAdminContext = async () => context,
  getAdminSession = async () => ({
    employeeId: "employee-1",
    email: "admin@example.com",
    scope: "admin",
    permissions: ["admin:*"],
  }),
  revalidatePath = () => undefined,
  redirect = (url) => {
    throw Object.assign(new Error("redirect"), { url });
  },
}) {
  const source = readFileSync(path.resolve(root, "src/modules/clientes/customers-admin-actions.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const commonJsExports = {};
  const moduleContext = {
    FormData,
    URLSearchParams,
    exports: commonJsExports,
    module: { exports: commonJsExports },
    require(specifier) {
      if (specifier === "next/cache") {
        return { revalidatePath };
      }
      if (specifier === "next/navigation") {
        return { redirect };
      }
      if (specifier.endsWith("/shared/bff/admin-client")) {
        return { requestAdminBff };
      }
      if (specifier.endsWith("/shared/auth/session")) {
        return { getAdminSession };
      }
      if (specifier.endsWith("/shared/config/admin-context")) {
        return { getAdminContext };
      }

      return {};
    },
  };

  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
}

const context = {
  organizationId: "org-1",
  shopId: "shop-1",
  shopAlias: "shop",
  shopName: "Shop",
  primaryDomain: "shop.test",
  shopStatus: "ACTIVE",
  locale: "es-ES",
  currency: "EUR",
  country: "ES",
  channel: "web",
};

test("customers admin route renders the module instead of the placeholder", () => {
  const routeSource = readFileSync(path.resolve(root, "app/(admin)/admin/clientes/page.tsx"), "utf8");
  const detailRouteSource = readFileSync(path.resolve(root, "app/(admin)/admin/clientes/[customerReference]/page.tsx"), "utf8");
  const pageSource = readFileSync(path.resolve(root, "src/modules/clientes/customers-admin-page.tsx"), "utf8");
  const dataSource = readFileSync(path.resolve(root, "src/modules/clientes/customers-admin.ts"), "utf8");

  assert.match(routeSource, /getCustomersAdminData/);
  assert.match(routeSource, /refreshAdminEmployeeSession/);
  assert.match(routeSource, /getCustomersAdminCapabilities/);
  assert.match(routeSource, /CustomersAdminPage/);
  assert.match(detailRouteSource, /getCustomerByReference/);
  assert.match(detailRouteSource, /getCustomerDetailAdminData/);
  assert.match(detailRouteSource, /CustomerDetailPage/);
  assert.match(detailRouteSource, /customerReference/);
  assert.match(routeSource, /includePurchases: capabilities\.canReadPurchases/);
  assert.doesNotMatch(routeSource, /Modulo pendiente de implementar/);
  assert.match(dataSource, /getCustomerOverview/);
  assert.match(dataSource, /buildCustomerAdminTimeline/);
  assert.match(dataSource, /CUSTOMER_CREATED/);
  assert.match(dataSource, /PURCHASE_RECORDED/);
  assert.match(dataSource, /COMPOSITION_WARNING/);
  assert.match(pageSource, /customerDetailShell/);
  assert.match(pageSource, /customerAvatarImagePath/);
  assert.match(pageSource, /avatarId=\{customer\?\.avatarId\}/);
  assert.match(pageSource, /\/storefront\/avatars\/human-01\.jpg/);
  assert.match(pageSource, /customerDetailTabs/);
  assert.match(pageSource, /Facturación/);
  assert.match(pageSource, /Backoffice/);
  assert.match(pageSource, /adminSummaryGrid/);
  assert.match(pageSource, /adminIconButton/);
  assert.match(pageSource, /Vista 360 de clientes/);
  assert.match(pageSource, /Todos los clientes/);
  assert.match(pageSource, /Indicadores principales del cliente/);
  assert.match(pageSource, /customerSummaryDomains/);
  assert.match(pageSource, /Total gastado/);
  assert.match(pageSource, /Carritos abandonados/);
  assert.match(pageSource, /Actividad reciente/);
  assert.match(pageSource, /Solicitudes GDPR/);
  assert.match(pageSource, /Gestion de acceso/);
  assert.match(pageSource, /Duplicados/);
  assert.match(pageSource, /section === "facturacion"/);
  assert.match(pageSource, /section === "privacidad"/);
  assert.match(pageSource, /Notas de crédito/);
  assert.match(pageSource, /Métodos de pago/);
  assert.match(pageSource, /PurchasesKpiPanel/);
  assert.match(pageSource, /CustomerDataTable/);
  assert.match(pageSource, /Estado del perfil/);
  assert.match(pageSource, /Estado de la cuenta/);
  assert.match(pageSource, /Estado de privacidad/);
  assert.match(pageSource, /Ticket medio/);
  assert.match(pageSource, /<h4>Casos<\/h4>/);
  assert.match(pageSource, /\/admin\/pagos\/facturas\//);
  assert.match(pageSource, /\/admin\/postventa\?caseId=/);
  assert.match(pageSource, /Abrir factura/);
  assert.match(pageSource, /Atender/);
  assert.match(pageSource, /Enviar comunicación/);
  assert.match(pageSource, /ActivityFilters/);
  assert.match(pageSource, /activitySource/);
  assert.match(pageSource, /Filtrar actividad/);
  assert.match(pageSource, /communicationChannelLabel/);
  assert.match(pageSource, /Responsable asignado/);
  assert.match(pageSource, /Notas internas/);
  assert.match(pageSource, /Sesiones activas/);
  assert.match(pageSource, /customersOverviewList/);
  assert.match(pageSource, /Timeline administrativo/);
  assert.match(pageSource, /buildCustomerAdminTimeline/);
  assert.match(pageSource, /CustomerSummaryPanel/);
  assert.match(pageSource, /Crear cliente/);
  assert.match(pageSource, /createCustomerAction/);
  assert.match(pageSource, /updateCustomerProfileAction/);
  assert.match(pageSource, /setCustomerAccountActivationAction/);
  assert.match(pageSource, /resendCustomerActivationAction/);
  assert.match(pageSource, /requestCustomerPasswordResetAction/);
  assert.match(pageSource, /createCustomerNoteAction/);
  assert.match(pageSource, /replaceCustomerTagsAction/);
  assert.match(pageSource, /createCustomerTaskAction/);
  assert.match(pageSource, /createCustomerPrivacyRequestAction/);
  assert.match(pageSource, /recordCustomerConsentAction/);
  assert.match(pageSource, /revokeCustomerSessionsAction/);
  assert.match(pageSource, /sendCustomerEmailAction/);
  assert.match(pageSource, /createCustomerAddressAction/);
  assert.match(pageSource, /updateCustomerAddressAction/);
  assert.match(pageSource, /deleteCustomerAddressAction/);
  assert.match(pageSource, /setDefaultShippingAddressAction/);
  assert.match(pageSource, /setDefaultBillingAddressAction/);
  assert.match(pageSource, /Guardar perfil/);
  assert.match(pageSource, /Crear direccion/);
  assert.match(pageSource, /Guardar direccion/);
  assert.match(pageSource, /customers\.addresses\.write/);
  assert.match(pageSource, /customers\.purchases\.read/);
  assert.match(pageSource, /Registrados/);
  assert.match(pageSource, /Paginacion de clientes/);
  assert.match(pageSource, /Abrir pedido/);
  assert.doesNotMatch(pageSource, /Ver producto/);
  assert.match(pageSource, /purchasePageHref/);
  assert.match(pageSource, /className="customersFilterBar"/);
  assert.match(pageSource, /customerReference \?\? customer\.customerId/);
  assert.doesNotMatch(pageSource, /href=\{customersHref\(filters, \{ drawer: "detail", customerId: customer\.customerId \}\)\}/);
});

test("customers filters keep search controls and actions in one desktop row", () => {
  const styles = readFileSync(path.resolve(root, "app/globals.css"), "utf8");

  assert.match(styles, /\.customersFilterBar\s*\{[\s\S]*grid-template-columns:\s*minmax\(180px, 1fr\) minmax\(180px, 1fr\) minmax\(108px, 132px\) max-content max-content/);
  assert.match(styles, /\.customersFilterBar \.adminButton\s*\{[\s\S]*align-self:\s*end/);
  assert.match(styles, /@media \(max-width: 680px\)\s*\{[\s\S]*\.customersFilterBar\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
});

test("customers admin capabilities map granular session permissions", () => {
  const { getCustomersAdminCapabilities } = loadCustomersAdminModule(async () => ({ ok: true, data: {} }));
  const emptyCapabilities = getCustomersAdminCapabilities(null);
  const writeCapabilities = getCustomersAdminCapabilities({
    scope: "admin",
    permissions: ["customers.read", "customers.addresses.write"],
  });
  const adminCapabilities = getCustomersAdminCapabilities({
    scope: "admin",
    permissions: ["admin:*"],
  });

  assert.equal(emptyCapabilities.canReadCustomers, false);
  assert.equal(emptyCapabilities.canWriteCustomers, false);
  assert.equal(emptyCapabilities.canReadPurchases, false);
  assert.equal(writeCapabilities.canReadCustomers, true);
  assert.equal(writeCapabilities.canWriteCustomers, true);
  assert.equal(writeCapabilities.canReadPurchases, false);
  assert.equal(writeCapabilities.canManageAccount, false);
  assert.equal(writeCapabilities.canWriteNotes, false);
  assert.equal(adminCapabilities.canReadCustomers, true);
  assert.equal(adminCapabilities.canWriteCustomers, true);
  assert.equal(adminCapabilities.canReadPurchases, true);
  assert.equal(adminCapabilities.canManageAccount, true);
  assert.equal(adminCapabilities.canWriteNotes, true);
  assert.equal(adminCapabilities.canWriteTags, true);
  assert.equal(adminCapabilities.canWriteTasks, true);
  assert.equal(adminCapabilities.canWritePrivacy, true);
  assert.equal(adminCapabilities.canWriteConsents, true);
  assert.equal(adminCapabilities.canWriteSessions, true);
  assert.equal(adminCapabilities.canWriteCommunications, true);
});

test("customers admin loads list through scoped BFF endpoint with filters and pagination", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method ?? "GET" });
    const raw = {
      items: [
        {
          customerId: "customer-1",
          organizationId: "org-1",
          shopId: "shop-1",
          email: "ada@example.com",
          firstName: "Ada",
          lastName: "Lovelace",
          phone: "+34910000000",
          buyerType: "PERSON",
          clientPreferencesData: { locale: "es-ES", optinNewsLetter: true },
          defaultShippingAddress: { addressId: "shipping-1", city: "Madrid" },
          defaultBillingAddress: { addressId: "billing-1", city: "Madrid" },
          isGuest: false,
        },
      ],
      total: 1,
      limit: 50,
      offset: 100,
    };

    return { ok: true, data: options.parse ? options.parse(raw) : raw };
  };
  const { getCustomersAdminData } = loadCustomersAdminModule(requestAdminBff);

  const data = await getCustomersAdminData(context, {
    q: "ada",
    email: "ada@example.com",
    limit: "50",
    offset: "100",
  });

  assert.equal(data.list.source, "bff");
  assert.equal(data.list.data.items[0].email, "ada@example.com");
  assert.equal(data.list.data.items[0].phone, "+34910000000");
  assert.equal(data.list.data.items[0].clientPreferencesData.optinNewsLetter, true);
  assert.equal(data.list.data.items[0].defaultShippingAddress.addressId, "shipping-1");
  assert.equal(data.list.data.items[0].defaultBillingAddress.addressId, "billing-1");
  assert.ok(calls.some((call) => call.path === "/admin/customers?organizationId=org-1&shopId=shop-1&q=ada&email=ada%40example.com&limit=50&offset=100"));
  assert.equal(calls.length, 1);
});

test("customers admin initial page preloads all customers without filters", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method ?? "GET" });
    const raw = {
      items: [
        {
          customerId: "customer-1",
          organizationId: "org-1",
          shopId: "shop-1",
          email: "ada@example.com",
          firstName: "Ada",
          lastName: "Lovelace",
          isGuest: false,
        },
      ],
      total: 1,
      limit: 100,
      offset: 0,
    };

    return { ok: true, data: options.parse ? options.parse(raw) : raw };
  };
  const { getCustomersAdminData } = loadCustomersAdminModule(requestAdminBff);

  const data = await getCustomersAdminData(context, {});

  assert.equal(data.list.source, "bff");
  assert.equal(data.list.data.limit, 100);
  assert.equal(data.list.data.offset, 0);
  assert.equal(data.list.data.items[0].email, "ada@example.com");
  assert.deepEqual(calls, [
    {
      path: "/admin/customers?organizationId=org-1&shopId=shop-1&limit=100&offset=0",
      method: "GET",
    },
  ]);
});

test("customers admin loads detail, addresses and purchases when drawer is open", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method ?? "GET" });
    const raw = pathValue.includes("/overview?")
      ? {
          customer: {
            customerId: "customer-1",
            organizationId: "org-1",
            shopId: "shop-1",
            email: "ada@example.com",
            firstName: "Ada",
            lastName: "Byron",
            buyerType: "PRIVATE_BUYER",
            isGuest: false,
            createdAt: "2026-07-07T09:00:00.000Z",
            updatedAt: "2026-07-07T09:55:00.000Z",
          },
          account: {
            principalId: "customer-1",
            principalType: "CUSTOMER",
            email: "ada@example.com",
            active: true,
            createdAt: "2026-07-07T09:05:00.000Z",
            updatedAt: "2026-07-07T09:10:00.000Z",
          },
          addresses: {
            customerId: "customer-1",
            defaultShippingAddressId: "address-1",
            defaultBillingAddressId: "address-1",
            items: [
              {
                addressId: "address-1",
                addressType: "residential",
                receiverName: "Ada Byron",
                addressRole: "BOTH",
                street: "Calle Mayor",
                number: "1",
                city: "Madrid",
                postalCode: "28001",
                reference: "Porteria",
              },
            ],
          },
          purchases: {
            customerId: "customer-1",
            items: [
              {
                purchaseId: "order-1",
                orderId: "order-1",
                totalAmountMinor: 1234,
                currency: "EUR",
                status: "PAID",
                isPaid: true,
                itemsCount: 1,
                placedAt: "2026-07-07T09:20:00.000Z",
                items: [
                  {
                    lineId: "line-1",
                    productId: "product-1",
                    productSlug: "pastillas-freno",
                    productUrlPath: "/pdp/pastillas-freno",
                    name: "Pastillas freno",
                    quantity: 2,
                    lineTotalMinor: 1234,
                  },
                ],
              },
            ],
            total: 3,
            limit: 2,
            offset: 0,
          },
          duplicateCandidates: {
            customerId: "customer-1",
            total: 1,
            limit: 2,
            items: [
              {
                customer: {
                  customerId: "customer-duplicate",
                  organizationId: "org-1",
                  shopId: "shop-1",
                  email: "ada.alias@example.com",
                },
                matchFields: ["phone"],
              },
            ],
          },
          notes: { items: [{ noteId: "note-1", body: "VIP", authorEmail: "ops@example.com", createdAt: "2026-07-07T09:25:00.000Z" }], total: 1 },
          tags: { items: [{ tagKey: "vip", label: "VIP" }], total: 1 },
          tasks: { items: [{ taskId: "task-1", title: "Llamar", status: "OPEN", assignedEmployeeId: "employee-1", createdAt: "2026-07-07T09:30:00.000Z" }], total: 1 },
          privacyRequests: { items: [{ requestId: "privacy-1", requestType: "ACCESS", status: "OPEN", requesterEmail: "ada@example.com", createdAt: "2026-07-07T09:35:00.000Z" }], total: 1 },
          consents: {
            current: { marketingEmail: { granted: true, source: "ADMIN", recordedAt: "2026-07-07T10:00:00.000Z" } },
            events: { items: [{ eventId: "consent-1", consentType: "marketingEmail", granted: true, source: "ADMIN", actorEmail: "ops@example.com", recordedAt: "2026-07-07T09:40:00.000Z" }], total: 1 },
          },
          sessions: { items: [{ sessionId: "session-1", lastSeenAt: "2026-07-07T09:45:00.000Z", device: { deviceName: "Safari" } }], total: 1 },
          invoices: { items: [{ invoiceId: "invoice-1", invoiceNumber: "FAC-1", status: "ISSUED", currency: "EUR", totalAmountMinor: 1234, issuedAt: "2026-07-07T09:50:00.000Z" }], total: 1 },
          afterSales: { items: [{ caseId: "case-1", orderId: "order-1", caseType: "RETURN", status: "OPEN", assignedEmployeeId: "employee-1", createdAt: "2026-07-07T09:52:00.000Z" }], total: 1 },
          communications: { items: [{ deliveryId: "delivery-1", templateKey: "customer.notice", status: "SENT", channel: "email", createdAt: "2026-07-07T09:54:00.000Z" }], total: 1 },
          timeline: { items: [{ type: "PURCHASE", referenceId: "order-1", occurredAt: "2026-07-07T10:00:00.000Z" }], total: 1 },
          warnings: [{ section: "communications", message: "degraded" }],
          generatedAt: "2026-07-07T10:05:00.000Z",
        }
      : pathValue.includes("/addresses?")
        ? {
          customerId: "customer-1",
          defaultShippingAddressId: "address-1",
          defaultBillingAddressId: "address-1",
          items: [
            {
              addressId: "address-1",
              addressType: "residential",
              receiverName: "Ada Byron",
              addressRole: "BOTH",
              street: "Calle Mayor",
              number: "1",
              city: "Madrid",
              postalCode: "28001",
              reference: "Porteria",
            },
          ],
        }
      : pathValue.includes("/purchases?")
        ? {
            customerId: "customer-1",
            items: [
              {
                purchaseId: "order-1",
                orderId: "order-1",
                totalAmountMinor: 1234,
                currency: "EUR",
                isPaid: true,
                itemsCount: 1,
                items: [
                  {
                    lineId: "line-1",
                    productId: "product-1",
                    productSlug: "pastillas-freno",
                    productUrlPath: "/pdp/pastillas-freno",
                    name: "Pastillas freno",
                    quantity: 2,
                    lineTotalMinor: 1234,
                  },
                ],
              },
            ],
            total: 3,
            limit: 2,
            offset: 2,
          }
        : pathValue.includes("/admin/customers/customer-1?")
          ? { customerId: "customer-1", organizationId: "org-1", shopId: "shop-1", email: "ada@example.com" }
          : { items: [], total: 0, limit: 20, offset: 0 };

    return { ok: true, data: options.parse ? options.parse(raw) : raw };
  };
  const { buildCustomerAdminTimeline, getCustomersAdminData } = loadCustomersAdminModule(requestAdminBff);

  const data = await getCustomersAdminData(context, {
    drawer: "detail",
    customerId: "customer-1",
    purchasesLimit: "2",
    purchasesOffset: "2",
  });
  const timeline = buildCustomerAdminTimeline(data.overview.data, data.selectedCustomer.data);

  assert.equal(data.selectedCustomer.data.email, "ada@example.com");
  assert.equal(data.overview.source, "bff");
  assert.equal(data.overview.data.account.active, true);
  assert.equal(data.overview.data.duplicateCandidates.items[0].matchFields[0], "phone");
  assert.equal(data.overview.data.notes.total, 1);
  assert.equal(data.overview.data.warnings[0].section, "communications");
  assert.equal(data.addresses.data.items[0].addressId, "address-1");
  assert.equal(data.addresses.data.items[0].addressType, "residential");
  assert.equal(data.addresses.data.items[0].reference, "Porteria");
  assert.equal(data.addresses.data.defaultShippingAddressId, "address-1");
  assert.equal(data.purchases.data.items[0].purchaseId, "order-1");
  assert.equal(data.purchases.data.limit, 2);
  assert.equal(data.purchases.data.offset, 0);
  assert.equal(data.purchases.data.items[0].items[0].productUrlPath, "/pdp/pastillas-freno");
  assert.equal(data.purchases.data.items[0].items[0].quantity, 2);
  assert.equal(timeline[0].eventType, "COMPOSITION_WARNING");
  assert.equal(timeline.some((event) => event.eventType === "PURCHASE_RECORDED" && event.referenceId === "order-1"), true);
  assert.equal(timeline.some((event) => event.eventType === "INVOICE_STATUS" && event.referenceId === "invoice-1"), true);
  assert.equal(timeline.some((event) => event.eventType === "AFTER_SALES_CASE" && event.referenceId === "case-1"), true);
  assert.equal(timeline.some((event) => event.eventType === "COMMUNICATION_SENT" && event.referenceId === "delivery-1"), true);
  assert.equal(timeline.some((event) => event.eventType === "CONSENT_EVENT" && event.referenceId === "consent-1"), true);
  assert.ok(calls.some((call) => call.path === "/admin/customers/customer-1/overview?organizationId=org-1&shopId=shop-1&recentLimit=2"));
  assert.ok(!calls.some((call) => call.path === "/admin/customers/customer-1?organizationId=org-1&shopId=shop-1"));
  assert.ok(!calls.some((call) => call.path.includes("/addresses?")));
  assert.ok(!calls.some((call) => call.path.includes("/purchases?")));
});

test("customers admin skips purchases endpoint when purchases permission is missing", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method ?? "GET" });
    const raw = pathValue.includes("/overview?")
      ? {
          customer: { customerId: "customer-1", organizationId: "org-1", shopId: "shop-1", email: "ada@example.com" },
          addresses: { customerId: "customer-1", items: [] },
          purchases: { customerId: "customer-1", items: [], total: 3, limit: 2, offset: 0 },
          duplicateCandidates: { customerId: "customer-1", items: [], total: 0, limit: 2 },
          notes: { items: [], total: 0 },
          tags: { items: [], total: 0 },
          tasks: { items: [], total: 0 },
          privacyRequests: { items: [], total: 0 },
          invoices: { items: [], total: 0 },
          afterSales: { items: [], total: 0 },
          communications: { items: [], total: 0 },
          timeline: { items: [], total: 0 },
          warnings: [],
        }
      : pathValue.includes("/addresses?")
        ? { customerId: "customer-1", items: [] }
      : pathValue.includes("/admin/customers/customer-1?")
        ? { customerId: "customer-1", organizationId: "org-1", shopId: "shop-1", email: "ada@example.com" }
        : { items: [], total: 0, limit: 20, offset: 0 };

    return { ok: true, data: options.parse ? options.parse(raw) : raw };
  };
  const { getCustomersAdminData } = loadCustomersAdminModule(requestAdminBff);

  const data = await getCustomersAdminData(context, {
    drawer: "detail",
    customerId: "customer-1",
    purchasesLimit: "2",
    purchasesOffset: "2",
  }, {
    includePurchases: false,
  });

  assert.equal(data.purchases.source, "unavailable");
  assert.equal(data.purchases.permission, "customers.purchases.read");
  assert.equal(data.purchases.message, "Falta permiso customers.purchases.read.");
  assert.equal(data.purchases.data.limit, 2);
  assert.equal(data.purchases.data.offset, 2);
  assert.equal(data.purchases.data.customerId, "customer-1");
  assert.equal(data.overview.data.purchases.total, 3);
  assert.ok(!calls.some((call) => call.path.includes("/purchases?")));
});

test("customers admin maps read failures to customers permission guidance", async () => {
  const requestAdminBff = async () => ({ ok: false, status: 403, error: "Forbidden" });
  const { getCustomersList } = loadCustomersAdminModule(requestAdminBff);

  const result = await getCustomersList(context, {});

  assert.equal(result.source, "unavailable");
  assert.equal(result.message, "Falta permiso customers.read.");
  assert.equal(result.permission, "customers.read");
});

test("customers admin create action posts a scoped profile payload", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({
      path: pathValue,
      method: options.init?.method,
      headers: options.init?.headers,
      body: JSON.parse(options.init?.body),
    });
    return { ok: true, data: { customerId: "customer-1" }, status: 201, correlationId: "corr-customers" };
  };
  const { createCustomerAction } = loadCustomersActionsModule({ requestAdminBff });
  const formData = new FormData();
  formData.set("email", "ADA@EXAMPLE.COM");
  formData.set("firstName", "Ada");
  formData.set("lastName", "Lovelace");
  formData.set("phone", "+34910000000");
  formData.set("documentNumber", "ID-1");
  formData.set("buyerType", "BUSINESS_BUYER");
  formData.set("locale", "es-ES");
  formData.set("optinNewsLetter", "true");

  await assert.rejects(() => createCustomerAction(formData), {
    url: "/admin/clientes?customerMessage=Cliente+creado.&drawer=detail&customerId=customer-1",
  });

  assert.equal(calls[0].path, "/admin/customers?organizationId=org-1&shopId=shop-1");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].headers["content-type"], "application/json");
  assert.deepEqual(calls[0].body, {
    organizationId: "org-1",
    shopId: "shop-1",
    email: "ada@example.com",
    firstName: "Ada",
    lastName: "Lovelace",
    documentNumber: "ID-1",
    phone: "+34910000000",
    buyerType: "BUSINESS_BUYER",
    clientPreferencesData: {
      locale: "es-ES",
      optinNewsLetter: true,
    },
  });
});

test("customers admin update action patches profile fields through BFF", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({
      path: pathValue,
      method: options.init?.method,
      headers: options.init?.headers,
      body: JSON.parse(options.init?.body),
    });
    return { ok: true, data: { customerId: "customer-1" }, status: 200, correlationId: "corr-customers" };
  };
  const { updateCustomerProfileAction } = loadCustomersActionsModule({ requestAdminBff });
  const formData = new FormData();
  formData.set("customerId", "customer-1");
  formData.set("firstName", "Ada");
  formData.set("lastName", "Byron");
  formData.set("buyerType", "PRIVATE_BUYER");
  formData.set("locale", "es-ES");
  formData.set("returnTo", "/admin/clientes/C-ADA?tab=perfil");

  await assert.rejects(() => updateCustomerProfileAction(formData), {
    url: "/admin/clientes/C-ADA?tab=perfil&customerMessage=Cliente+actualizado.",
  });

  assert.equal(calls[0].path, "/admin/customers/customer-1?organizationId=org-1&shopId=shop-1");
  assert.equal(calls[0].method, "PATCH");
  assert.equal(calls[0].headers["content-type"], "application/json");
  assert.deepEqual(calls[0].body, {
    firstName: "Ada",
    lastName: "Byron",
    documentNumber: null,
    phone: null,
    buyerType: "PRIVATE_BUYER",
    clientPreferencesData: {
      locale: "es-ES",
    },
  });
});

test("customers admin address create and update actions send canonical payloads", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({
      path: pathValue,
      method: options.init?.method,
      headers: options.init?.headers,
      body: options.init?.body ? JSON.parse(options.init.body) : undefined,
    });
    return { ok: true, data: {}, status: 200, correlationId: "corr-customers" };
  };
  const {
    createCustomerAddressAction,
    updateCustomerAddressAction,
  } = loadCustomersActionsModule({ requestAdminBff });

  const formData = new FormData();
  formData.set("customerId", "customer-1");
  formData.set("addressId", "address-1");
  formData.set("addressType", "residential");
  formData.set("addressRole", "BILLING");
  formData.set("alias", "Casa");
  formData.set("receiverName", "Ada Byron");
  formData.set("street", "Calle Mayor");
  formData.set("number", "1");
  formData.set("neighborhood", "Centro");
  formData.set("city", "Madrid");
  formData.set("state", "MD");
  formData.set("country", "es");
  formData.set("postalCode", "28001");
  formData.set("complement", "2A");
  formData.set("reference", "Porteria");

  await assert.rejects(() => createCustomerAddressAction(formData), {
    url: "/admin/clientes?customerMessage=Direccion+creada.&drawer=detail&customerId=customer-1",
  });
  await assert.rejects(() => updateCustomerAddressAction(formData), {
    url: "/admin/clientes?customerMessage=Direccion+actualizada.&drawer=detail&customerId=customer-1",
  });

  assert.equal(calls[0].path, "/admin/customers/customer-1/addresses?organizationId=org-1&shopId=shop-1");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[1].path, "/admin/customers/customer-1/addresses/address-1?organizationId=org-1&shopId=shop-1");
  assert.equal(calls[1].method, "PATCH");
  assert.deepEqual(calls[0].body, {
    alias: "Casa",
    addressType: "residential",
    addressRole: "BILLING",
    receiverName: "Ada Byron",
    street: "Calle Mayor",
    number: "1",
    neighborhood: "Centro",
    city: "Madrid",
    state: "MD",
    country: "ES",
    postalCode: "28001",
    complement: "2A",
    reference: "Porteria",
  });
  assert.deepEqual(calls[1].body, calls[0].body);
});

test("customers admin address default and delete actions use BFF endpoints", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method });
    return { ok: true, data: {}, status: 200, correlationId: "corr-customers" };
  };
  const {
    deleteCustomerAddressAction,
    setDefaultBillingAddressAction,
    setDefaultShippingAddressAction,
  } = loadCustomersActionsModule({ requestAdminBff });
  const formData = new FormData();
  formData.set("customerId", "customer-1");
  formData.set("addressId", "address-1");

  await assert.rejects(() => setDefaultShippingAddressAction(formData), {
    url: "/admin/clientes?customerMessage=Direccion+de+envio+actualizada.&drawer=detail&customerId=customer-1",
  });
  await assert.rejects(() => setDefaultBillingAddressAction(formData), {
    url: "/admin/clientes?customerMessage=Direccion+fiscal+actualizada.&drawer=detail&customerId=customer-1",
  });
  await assert.rejects(() => deleteCustomerAddressAction(formData), {
    url: "/admin/clientes?customerMessage=Direccion+eliminada.&drawer=detail&customerId=customer-1",
  });

  assert.deepEqual(calls, [
    {
      path: "/admin/customers/customer-1/addresses/address-1/default-shipping?organizationId=org-1&shopId=shop-1",
      method: "PATCH",
    },
    {
      path: "/admin/customers/customer-1/addresses/address-1/default-billing?organizationId=org-1&shopId=shop-1",
      method: "PATCH",
    },
    {
      path: "/admin/customers/customer-1/addresses/address-1?organizationId=org-1&shopId=shop-1",
      method: "DELETE",
    },
  ]);
});

test("customers admin customer 360 actions use scoped BFF endpoints", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({
      path: pathValue,
      method: options.init?.method,
      body: options.init?.body ? JSON.parse(options.init.body) : undefined,
    });
    return { ok: true, data: {}, status: 200, correlationId: "corr-customers" };
  };
  const {
    createCustomerNoteAction,
    createCustomerPrivacyRequestAction,
    createCustomerTaskAction,
    recordCustomerConsentAction,
    replaceCustomerTagsAction,
    requestCustomerPasswordResetAction,
    resendCustomerActivationAction,
    revokeCustomerSessionsAction,
    sendCustomerEmailAction,
    setCustomerAccountActivationAction,
    updateCustomerPrivacyRequestStatusAction,
    updateCustomerTaskStatusAction,
  } = loadCustomersActionsModule({ requestAdminBff });
  const formData = new FormData();
  formData.set("customerId", "customer-1");
  formData.set("active", "false");
  formData.set("locale", "es-ES");
  formData.set("body", "Nota interna");
  formData.set("tags", "VIP, Riesgo");
  formData.set("title", "Llamar");
  formData.set("taskId", "task-1");
  formData.set("status", "DONE");
  formData.set("requestType", "ACCESS");
  formData.set("requestId", "privacy-1");
  formData.set("reason", "Solicitud del cliente");
  formData.set("granted", "true");
  formData.set("templateKey", "customer.notice");
  formData.set("message", "Mensaje operativo");

  await assert.rejects(() => setCustomerAccountActivationAction(formData), /redirect/);
  await assert.rejects(() => resendCustomerActivationAction(formData), /redirect/);
  await assert.rejects(() => requestCustomerPasswordResetAction(formData), /redirect/);
  await assert.rejects(() => createCustomerNoteAction(formData), /redirect/);
  await assert.rejects(() => replaceCustomerTagsAction(formData), /redirect/);
  await assert.rejects(() => createCustomerTaskAction(formData), /redirect/);
  await assert.rejects(() => updateCustomerTaskStatusAction(formData), /redirect/);
  await assert.rejects(() => createCustomerPrivacyRequestAction(formData), /redirect/);
  await assert.rejects(() => updateCustomerPrivacyRequestStatusAction(formData), /redirect/);
  await assert.rejects(() => recordCustomerConsentAction(formData), /redirect/);
  await assert.rejects(() => revokeCustomerSessionsAction(formData), /redirect/);
  await assert.rejects(() => sendCustomerEmailAction(formData), /redirect/);

  assert.deepEqual(calls.map((call) => [call.method, call.path]), [
    ["PATCH", "/admin/customers/customer-1/account/activation?organizationId=org-1&shopId=shop-1"],
    ["POST", "/admin/customers/customer-1/account/activation/resend?organizationId=org-1&shopId=shop-1"],
    ["POST", "/admin/customers/customer-1/account/password-reset/request?organizationId=org-1&shopId=shop-1"],
    ["POST", "/admin/customers/customer-1/notes?organizationId=org-1&shopId=shop-1"],
    ["PUT", "/admin/customers/customer-1/tags?organizationId=org-1&shopId=shop-1"],
    ["POST", "/admin/customers/customer-1/tasks?organizationId=org-1&shopId=shop-1"],
    ["PATCH", "/admin/customers/customer-1/tasks/task-1?organizationId=org-1&shopId=shop-1"],
    ["POST", "/admin/customers/customer-1/privacy-requests?organizationId=org-1&shopId=shop-1"],
    ["PATCH", "/admin/customers/customer-1/privacy-requests/privacy-1?organizationId=org-1&shopId=shop-1"],
    ["POST", "/admin/customers/customer-1/consents?organizationId=org-1&shopId=shop-1"],
    ["POST", "/admin/customers/customer-1/sessions/revoke?organizationId=org-1&shopId=shop-1"],
    ["POST", "/admin/customers/customer-1/communications/email?organizationId=org-1&shopId=shop-1"],
  ]);
  assert.deepEqual(calls[0].body, {
    active: false,
    actorEmail: "admin@example.com",
    actorId: "employee-1",
    reason: "Solicitud del cliente",
  });
  assert.equal(calls[3].body.authorId, "employee-1");
  assert.equal(calls[3].body.authorEmail, "admin@example.com");
  assert.deepEqual(calls[4].body.items, [
    { tagKey: "vip", label: "VIP" },
    { tagKey: "riesgo", label: "Riesgo" },
  ]);
  assert.equal(calls[9].body.source, "ADMIN");
  assert.equal(calls[11].body.templateKey, "customer.notice");
});

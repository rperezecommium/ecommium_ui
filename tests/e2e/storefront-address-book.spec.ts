import { expect, test, type Page } from "@playwright/test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import net from "node:net";

const organizationId = "11111111-1111-4111-8111-111111111111";
const shopId = "22222222-2222-4222-8222-222222222222";
const customerId = "customer-address-book";
const customerEmail = "cliente@example.test";

type Address = {
  addressId: string;
  alias: string;
  addressType: string;
  addressRole: string;
  receiverName: string;
  street: string;
  number: string;
  neighborhood?: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  complement?: string | null;
  reference?: string | null;
};

type AddressBookFixture = {
  maxAddresses: number;
  count: number;
  defaultShippingAddressId: string | null;
  defaultBillingAddressId: string | null;
  items: Address[];
};

let bffServer: Server;
let bffPort = 0;
let nextPort = 0;
let nextProcess: ChildProcessWithoutNullStreams;
let addressBook: AddressBookFixture = initialAddressBook();
const capturedAddressMutations: Array<{ method: string; path: string; body: Record<string, unknown> }> = [];
const capturedShippingPayloads: Record<string, unknown>[] = [];

function initialAddressBook(): AddressBookFixture {
  return {
    maxAddresses: 5,
    count: 2,
    defaultShippingAddressId: "addr-home",
    defaultBillingAddressId: null as string | null,
    items: [{
      addressId: "addr-home",
      alias: "Casa",
      addressType: "residential",
      addressRole: "BOTH",
      receiverName: "Ricardo Perez",
      street: "Calle Luna",
      number: "4",
      neighborhood: "Centro",
      city: "Madrid",
      state: "Madrid",
      country: "ES",
      postalCode: "28001",
      complement: null,
      reference: "Portal A",
    }, {
      addressId: "addr-work",
      alias: "Trabajo",
      addressType: "residential",
      addressRole: "BOTH",
      receiverName: "Ricardo Perez",
      street: "Calle Mayor",
      number: "10",
      neighborhood: "Centro",
      city: "Madrid",
      state: "Madrid",
      country: "ES",
      postalCode: "28013",
      complement: "2B",
      reference: "Recepcion",
    }] satisfies Address[],
  };
}

function emptyOrderform() {
  return {
    orderFormId: "of-address-book",
    currency: "EUR",
    clientProfileData: {
      email: customerEmail,
      firstName: "Ricardo",
      lastName: "Perez",
      phone: "600000000",
    },
    items: [{
      productId: "product-bike",
      variantId: "variant-bike",
      refId: "sku-bike",
      name: "Bicicleta demo",
      quantity: 1,
      unitPriceMinor: 10900,
      lineTotalMinor: 10900,
      offerings: [],
      availableOfferings: [],
    }],
    totals: {
      itemsSubtotalMinor: 10900,
      shippingTotalMinor: 0,
      grandTotalMinor: 10900,
      currency: "EUR",
    },
  };
}

async function freePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  server.close();
  return typeof address === "object" && address ? address.port : 0;
}

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "private, no-store",
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) as Record<string, unknown> : {};
}

function requireStorefrontAuth(request: IncomingMessage, response: ServerResponse) {
  if (request.headers.authorization !== "Bearer storefront-token") {
    sendJson(response, 401, { message: "storefront token required" });
    return false;
  }

  return true;
}

async function startBffMock() {
  bffPort = await freePort();
  bffServer = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

    if (url.pathname.startsWith("/api/v1/storefront/me") && !requireStorefrontAuth(request, response)) {
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/storefront/me/profile") {
      sendJson(response, 200, {
        profile: {
          customerId,
          organizationId,
          shopId,
          email: customerEmail,
          firstName: "Ricardo",
          lastName: "Perez",
          avatarId: "human-01",
          phone: "600000000",
          clientPreferencesData: { locale: "es-ES", optinNewsLetter: true },
        },
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/storefront/me/avatar-options") {
      sendJson(response, 200, {
        items: ["01", "02", "03", "04", "05"].map((id) => ({ avatarId: `human-${id}`, kind: "human", label: `Human ${id}` }))
          .concat(["cat", "dog", "fox", "panda", "owl"].map((id) => ({ avatarId: `animal-${id}`, kind: "animal", label: id }))),
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/storefront/me/purchases") {
      sendJson(response, 200, { customerId, total: 0, limit: 5, offset: 0, items: [] });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/storefront/me/invoices") {
      sendJson(response, 200, { customerId, total: 0, limit: 5, offset: 0, items: [] });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/storefront/me/addresses") {
      sendJson(response, 200, addressBook);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/storefront/me/addresses") {
      const body = await readJsonBody(request);
      capturedAddressMutations.push({ method: "POST", path: url.pathname, body });
      if (addressBook.count >= addressBook.maxAddresses) {
        sendJson(response, 409, { message: "address book limit reached" });
        return;
      }
      const address = {
        ...body,
        addressId: `addr-${Date.now()}`,
      } as Address;
      addressBook = {
        ...addressBook,
        count: addressBook.count + 1,
        items: [...addressBook.items, address],
      };
      sendJson(response, 201, addressBook);
      return;
    }

    const addressMatch = url.pathname.match(/^\/api\/v1\/storefront\/me\/addresses\/([^/]+)(?:\/(default-shipping|default-billing))?$/);
    if (addressMatch) {
      const addressId = decodeURIComponent(addressMatch[1]);
      const action = addressMatch[2];
      if (request.method === "PATCH" && action === "default-shipping") {
        capturedAddressMutations.push({ method: "PATCH", path: url.pathname, body: {} });
        addressBook = { ...addressBook, defaultShippingAddressId: addressId };
        sendJson(response, 200, addressBook);
        return;
      }
      if (request.method === "PATCH" && action === "default-billing") {
        capturedAddressMutations.push({ method: "PATCH", path: url.pathname, body: {} });
        addressBook = { ...addressBook, defaultBillingAddressId: addressId };
        sendJson(response, 200, addressBook);
        return;
      }
      if (request.method === "PATCH" && !action) {
        const body = await readJsonBody(request);
        capturedAddressMutations.push({ method: "PATCH", path: url.pathname, body });
        addressBook = {
          ...addressBook,
          items: addressBook.items.map((address) => address.addressId === addressId ? { ...address, ...body } as Address : address),
        };
        sendJson(response, 200, addressBook);
        return;
      }
      if (request.method === "DELETE" && !action) {
        capturedAddressMutations.push({ method: "DELETE", path: url.pathname, body: {} });
        addressBook = {
          ...addressBook,
          count: Math.max(0, addressBook.count - 1),
          items: addressBook.items.filter((address) => address.addressId !== addressId),
        };
        sendJson(response, 200, addressBook);
        return;
      }
    }

    if (request.method === "GET" && url.pathname === "/api/v1/storefront/checkout/context") {
      sendJson(response, 200, {
        identity: { state: "AUTHENTICATED", customerId, email: customerEmail },
        orderform: emptyOrderform(),
        contact: {
          email: customerEmail,
          firstName: "Ricardo",
          lastName: "Perez",
          phone: "600000000",
        },
        sections: {
          contact: { status: "COMPLETE", mutationScope: "profile" },
          shipping: { status: "INCOMPLETE", addressBook },
          payment: { status: "INCOMPLETE" },
        },
        allowedActions: ["profile", "select_address"],
        warnings: [],
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/shipping/options/resolve") {
      sendJson(response, 200, {
        logisticsInfo: [{
          itemIndex: 0,
          selectedSla: "standard",
          selectedDeliveryChannel: "delivery",
          slas: [{
            id: "standard",
            name: "Standard",
            deliveryChannel: "delivery",
            totalMinor: 0,
            currency: "EUR",
            shippingEstimate: "2d",
          }],
        }],
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/orderforms/of-address-book/attachments/shipping-data") {
      const body = await readJsonBody(request);
      capturedShippingPayloads.push(body);
      sendJson(response, 201, {
        ...emptyOrderform(),
        shippingData: body,
      });
      return;
    }

    sendJson(response, 404, { message: `Unhandled mock route ${request.method} ${url.pathname}` });
  });
  bffServer.listen(bffPort, "127.0.0.1");
  await once(bffServer, "listening");
}

async function waitForNext(url: string) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status < 500) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error(`Next server did not become ready at ${url}`);
}

async function startNext() {
  nextPort = await freePort();
  nextProcess = spawn("npx", ["next", "start", "-p", String(nextPort)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ECOMMIUM_BFF_BASE_URL: `http://127.0.0.1:${bffPort}/api/v1`,
      ECOMMIUM_STOREFRONT_ORGANIZATION_ID: organizationId,
      ECOMMIUM_STOREFRONT_SHOP_ID: shopId,
    },
  });
  await waitForNext(`http://127.0.0.1:${nextPort}/account`);
}

async function authenticateStorefront(page: Page) {
  await page.context().addCookies([{
    name: "ecommium_customer_session",
    value: JSON.stringify({
      accessToken: "storefront-token",
      refreshToken: "storefront-refresh",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      sessionId: "storefront-session",
      customerId,
      email: customerEmail,
      organizationId,
      shopId,
      scope: "storefront",
    }),
    domain: "127.0.0.1",
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  }]);
}

test.beforeAll(async () => {
  await startBffMock();
  await startNext();
});

test.beforeEach(() => {
  addressBook = initialAddressBook();
  capturedAddressMutations.length = 0;
  capturedShippingPayloads.length = 0;
});

test.afterAll(async () => {
  nextProcess?.kill();
  bffServer?.close();
});

test("storefront account manages address book without customerId in the browser", async ({ page }) => {
  await authenticateStorefront(page);
  await page.goto(`http://127.0.0.1:${nextPort}/account`);

  await page.getByRole("button", { name: "Direcciones" }).click();
  await expect(page.getByRole("heading", { name: "Casa" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Trabajo" })).toBeVisible();

  const homeCard = page.locator(".storefrontAddressBookCard").filter({ hasText: "Casa" });
  await homeCard.getByRole("button", { name: "Fiscal" }).click();
  await expect(page.getByText("Direccion fiscal actualizada.")).toBeVisible();
  expect(capturedAddressMutations.at(-1)).toMatchObject({
    method: "PATCH",
    path: "/api/v1/storefront/me/addresses/addr-home/default-billing",
  });

  const newAddress = page.locator("details.storefrontAddressBookEditor").last();
  await newAddress.evaluate((element) => {
    (element as HTMLDetailsElement).open = true;
    element.scrollIntoView({ block: "center" });
  });
  await newAddress.getByLabel("Alias").fill("Fin de semana");
  await newAddress.getByLabel("Recibe").fill("Ricardo Perez");
  await newAddress.getByLabel("Calle").fill("Calle Sol");
  await newAddress.getByLabel("Numero").fill("8");
  await newAddress.getByLabel("Ciudad").fill("Valencia");
  await newAddress.getByLabel("Provincia").fill("Valencia");
  await newAddress.getByLabel("Codigo postal").fill("46001");
  await newAddress.getByLabel("Pais").fill("ES");
  await newAddress.locator("form").evaluate((form) => {
    (form as HTMLFormElement).requestSubmit();
  });

  await expect(page.getByText("Direccion guardada.")).toBeVisible();
  expect(capturedAddressMutations.at(-1)?.body).toMatchObject({
    alias: "Fin de semana",
    city: "Valencia",
    postalCode: "46001",
  });
  expect(JSON.stringify(capturedAddressMutations)).not.toContain("customerId");
});

test("storefront checkout sends selected saved address snapshot to shipping data", async ({ page }) => {
  await authenticateStorefront(page);
  await page.goto(`http://127.0.0.1:${nextPort}/checkout`);

  const shippingSection = page.locator("section.storefrontCheckoutSectionCard").filter({ hasText: "Entrega" });
  await shippingSection.getByRole("button", { name: "Completar" }).click();
  await shippingSection.getByLabel("Alias").selectOption("addr-work");
  await expect(shippingSection.getByLabel("Calle")).toHaveValue("Calle Mayor");
  await expect(shippingSection.getByLabel("Codigo postal")).toHaveValue("28013");

  await shippingSection.getByRole("button", { name: "Calcular envío" }).click();
  await expect(shippingSection.getByText("Standard")).toBeVisible();
  await shippingSection.getByRole("button", { name: "Guardar envío" }).click();

  await expect.poll(() => capturedShippingPayloads.length).toBe(1);
  expect(capturedShippingPayloads[0].selectedAddress).toMatchObject({
    addressId: "addr-work",
    alias: "Trabajo",
    street: "Calle Mayor",
    postalCode: "28013",
    isDisposable: false,
  });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);

function source(relativePath) {
  return readFileSync(path.resolve(root, relativePath), "utf8");
}

test("storefront account route uses BFF customer profile and avatar contracts", () => {
  const routeSource = source("app/account/page.tsx");
  const accountSource = source("src/modules/storefront/storefront-account.ts");
  const actionsSource = source("src/modules/storefront/storefront-account-actions.ts");
  const authActionsSource = source("src/modules/storefront/storefront-auth-actions.ts");
  const sessionSource = source("src/modules/storefront/storefront-customer-session.ts");

  assert.match(routeSource, /getStorefrontAccountData/);
  assert.match(routeSource, /getStorefrontCustomerSession/);
  assert.match(routeSource, /StorefrontAccountClient/);
  assert.match(routeSource, /logoutStorefrontCustomer/);
  assert.match(routeSource, /storefrontAuthPanelLogout/);
  assert.match(accountSource, /\/storefront\/me\/profile/);
  assert.match(accountSource, /\/storefront\/me\/avatar-options/);
  assert.match(accountSource, /\/storefront\/me\/addresses/);
  assert.match(accountSource, /\/storefront\/me\/purchases/);
  assert.match(accountSource, /\/storefront\/me\/invoices/);
  assert.match(accountSource, /\/storefront\/me\/after-sales\/cases/);
  assert.match(accountSource, /withAuth: false/);
  assert.match(accountSource, /authorization/);
  assert.match(actionsSource, /patchStorefrontCustomerProfile/);
  assert.match(actionsSource, /submitStorefrontAfterSalesCase/);
  assert.match(actionsSource, /submitStorefrontAccountAddress/);
  assert.match(actionsSource, /createStorefrontAfterSalesCase/);
  assert.match(actionsSource, /email/);
  assert.match(actionsSource, /currentPassword/);
  assert.match(actionsSource, /newPassword/);
  assert.match(actionsSource, /logoutStorefrontCustomer/);
  assert.match(authActionsSource, /scope: "storefront"/);
  assert.match(authActionsSource, /redirect\("\/account"\)/);
  assert.match(sessionSource, /httpOnly: true/);
  assert.match(sessionSource, /ecommium_customer_session/);
  assert.doesNotMatch(sessionSource, /localStorage/);
});

test("storefront account UI manages address book from profile", () => {
  const clientSource = source("src/modules/storefront/storefront-account-client.tsx");
  const actionsSource = source("src/modules/storefront/storefront-account-actions.ts");
  const accountSource = source("src/modules/storefront/storefront-account.ts");
  const cssSource = source("app/globals.css");

  assert.match(accountSource, /StorefrontAddressBook/);
  assert.match(accountSource, /createStorefrontCustomerAddress/);
  assert.match(accountSource, /patchStorefrontCustomerAddress/);
  assert.match(accountSource, /deleteStorefrontCustomerAddress/);
  assert.match(accountSource, /setStorefrontCustomerAddressDefault/);
  assert.match(accountSource, /\/storefront\/me\/addresses\/\$\{encodeURIComponent\(addressId\)\}/);
  assert.match(accountSource, /default-\$\{defaultKind\}/);
  assert.match(clientSource, /setDrawer\("addresses"\)/);
  assert.match(clientSource, /AddressBookPanel/);
  assert.match(clientSource, /AddressBookCard/);
  assert.match(clientSource, /Nueva direccion/);
  assert.match(clientSource, /newAddressEditorRef/);
  assert.match(clientSource, /scrollIntoView/);
  assert.match(clientSource, /block: "start"/);
  assert.match(clientSource, /name="operation" type="hidden" value="create"/);
  assert.match(clientSource, /name="operation" type="hidden" value="update"/);
  assert.match(clientSource, /name="operation" type="hidden" value="delete"/);
  assert.match(clientSource, /name="operation" type="hidden" value="default-shipping"/);
  assert.match(clientSource, /name="operation" type="hidden" value="default-billing"/);
  assert.match(clientSource, /address\.alias/);
  assert.match(clientSource, /addresses\.data\.count >= addresses\.data\.maxAddresses/);
  assert.match(actionsSource, /addressOperation/);
  assert.match(actionsSource, /validateAddressPayload/);
  assert.match(actionsSource, /El alias debe tener entre 2 y 40 caracteres/);
  assert.match(actionsSource, /Revisa el alias o el limite de direcciones guardadas/);
  assert.doesNotMatch(clientSource + actionsSource + accountSource, /customerId.*name=/);
  assert.match(cssSource, /\.storefrontAddressBookPanel/);
  assert.match(cssSource, /\.storefrontAddressBookCard/);
  assert.match(cssSource, /\.storefrontAccountSideDrawer[\s\S]*height: 100dvh/);
  assert.match(cssSource, /\.storefrontAccountSideDrawer[\s\S]*overflow: hidden/);
  assert.match(cssSource, /\.storefrontAccountDrawerBody[\s\S]*overflow: auto/);
  assert.match(cssSource, /\.storefrontAddressBookEditor[\s\S]*scroll-margin-top: 18px/);
  assert.match(cssSource, /\.storefrontAddressBookActions/);
});

test("storefront account UI exposes editable profile, credentials and 10 avatars", () => {
  const clientSource = source("src/modules/storefront/storefront-account-client.tsx");
  const cssSource = source("app/globals.css");

  assert.match(clientSource, /Guardar perfil/);
  assert.match(clientSource, /Actualizar credenciales/);
  assert.match(clientSource, /Cerrar sesion/);
  assert.match(clientSource, /AccountSideDrawer/);
  assert.match(clientSource, /setDrawer\("profile"\)/);
  assert.match(clientSource, /setDrawer\("credentials"\)/);
  assert.match(clientSource, /name="avatarId"/);
  assert.match(clientSource, /human-01/);
  assert.match(clientSource, /\/storefront\/avatars\/human-01\.jpg/);
  assert.match(clientSource, /\/storefront\/avatars\/animal-cat\.jpg/);
  assert.match(clientSource, /human-05/);
  assert.match(clientSource, /animal-cat/);
  assert.match(clientSource, /animal-owl/);
  assert.doesNotMatch(clientSource, /<b>\{option\.label\}<\/b>/);
  assert.doesNotMatch(clientSource, /<small>\{option\.kind === "human"/);
  assert.match(clientSource, /optinNewsLetter/);
  assert.match(cssSource, /\.storefrontAccountLayout/);
  assert.match(cssSource, /\.storefrontAccountIdentity/);
  assert.match(cssSource, /\.storefrontAccountMenu button:hover[\s\S]*text-decoration: underline/);
  assert.match(cssSource, /\.storefrontAccountSideDrawer/);
  assert.match(cssSource, /\.storefrontAvatarOption input[\s\S]*clip: rect\(0, 0, 0, 0\)/);
  assert.match(cssSource, /\.storefrontAvatarThumb img[\s\S]*object-fit: cover/);
  assert.match(cssSource, /\.storefrontAvatarPicker > div[\s\S]*repeat\(5, minmax\(0, 20%\)\)/);
  assert.match(cssSource, /\.storefrontAvatarOption:has\(input:checked\) \.storefrontAvatarThumb[\s\S]*border-color: #25abc4/);
});

test("storefront account UI renders purchase history snapshots without cart shortcuts", () => {
  const clientSource = source("src/modules/storefront/storefront-account-client.tsx");
  const cssSource = source("app/globals.css");
  const routeSource = source("app/account/page.tsx");

  assert.match(routeSource, /purchasesLimit/);
  assert.match(routeSource, /purchasesOffset/);
  assert.match(clientSource, /Mis compras/);
  assert.match(clientSource, /purchaseItemHref/);
  assert.match(clientSource, /productUrlPath/);
  assert.match(clientSource, /\/pdp\/\$\{encodeURIComponent\(item\.productSlug\)\}/);
  assert.match(clientSource, /trackingUrl/);
  assert.match(clientSource, /PurchaseTrackingModule/);
  assert.match(clientSource, /purchaseTrackingSteps/);
  assert.match(clientSource, /storefrontTrackingRail/);
  assert.match(clientSource, /trackingStepIcon/);
  assert.match(clientSource, /TrackingShipmentDetail/);
  assert.match(clientSource, /storefrontTrackingCompleteFlag/);
  assert.match(clientSource, /storefrontPurchaseTrackingDelivered/);
  assert.match(clientSource, /storefrontPurchaseTrackingIdle/);
  assert.match(clientSource, /hasStartedTracking/);
  assert.match(clientSource, /hasOperationalTrackingStarted/);
  assert.match(clientSource, /trackingOperationalCodes/);
  assert.match(clientSource, /currentMilestoneCode/);
  assert.match(clientSource, /trackingDispatchCodes\.includes\(currentMilestoneCode\)/);
  assert.match(clientSource, /currentStep\?\.label \?\?/);
  assert.match(clientSource, /En preparacion/);
  assert.match(clientSource, /En despacho/);
  assert.match(clientSource, /Disponible al enviar/);
  assert.match(clientSource, /shipping\?\.status === "DELIVERED"/);
  assert.match(clientSource, /!isDelivered && hasStartedTracking \? \(/);
  assert.match(clientSource, /moneyText\(purchase\.totalAmountMinor/);
  assert.match(clientSource, /moneyText\(item\.unitPriceMinor/);
  assert.match(clientSource, /purchase\.items\.map/);
  assert.doesNotMatch(clientSource, /purchase\.items\.slice\(0, 3\)/);
  assert.match(cssSource, /\.storefrontPurchaseCard/);
  assert.match(cssSource, /\.storefrontPurchaseItems[\s\S]*max-height: 202px/);
  assert.match(cssSource, /\.storefrontPurchaseItems[\s\S]*overflow-y: auto/);
  assert.match(cssSource, /\.storefrontPurchaseTracking/);
  assert.match(cssSource, /\.storefrontTrackingRail::after[\s\S]*animation: storefrontTrackingFlow/);
  assert.match(cssSource, /\.storefrontPurchaseTrackingIdle \.storefrontTrackingRail::after[\s\S]*animation: none/);
  assert.match(cssSource, /\.storefrontPurchaseTrackingDelivered \.storefrontTrackingRail::after[\s\S]*animation: none/);
  assert.match(cssSource, /\.storefrontPurchaseTrackingDelivered \.storefrontTrackingStepCurrent > span[\s\S]*animation: none/);
  assert.match(cssSource, /\.storefrontTrackingCompleteFlag/);
  assert.match(cssSource, /@keyframes storefrontTrackingPulse/);
  assert.match(cssSource, /\.storefrontTrackingShipmentDetail/);
  assert.match(cssSource, /\.storefrontTrackingRoutePreview/);
  assert.doesNotMatch(clientSource + cssSource, /storefrontTrackingDetails/);
  assert.doesNotMatch(clientSource, /add-items|addToCart|Añadir al carrito/);
});

test("storefront account UI renders invoices with authenticated document download", () => {
  const clientSource = source("src/modules/storefront/storefront-account-client.tsx");
  const accountSource = source("src/modules/storefront/storefront-account.ts");
  const routeSource = source("app/account/page.tsx");
  const documentRouteSource = source("app/account/invoices/[invoiceId]/document/route.ts");
  const pdfSource = source("src/shared/invoice/invoice-document-pdf.ts");
  const cssSource = source("app/globals.css");

  assert.match(routeSource, /invoicesLimit/);
  assert.match(routeSource, /invoicesOffset/);
  assert.match(accountSource, /StorefrontInvoicesData/);
  assert.match(clientSource, /Mis facturas/);
  assert.match(clientSource, /setDrawer\("invoices"\)/);
  assert.match(clientSource, /InvoiceCard/);
  assert.match(clientSource, /\/account\/invoices\/\$\{encodeURIComponent\(invoice\.invoiceId\)\}\/document/);
  assert.match(documentRouteSource, /getStorefrontCustomerAuthorizationHeader/);
  assert.match(documentRouteSource, /\/storefront\/me\/invoices\/.*\/document/);
  assert.match(documentRouteSource, /cache-control", "private, no-store"/);
  assert.match(documentRouteSource, /content-disposition/);
  assert.match(documentRouteSource, /renderInvoiceDocumentPdf/);
  assert.match(documentRouteSource, /application\/pdf/);
  assert.doesNotMatch(documentRouteSource, /localStorage|NEXT_PUBLIC/);
  assert.match(pdfSource, /toPdfLiteral/);
  assert.doesNotMatch(pdfSource, /utf16le|FEFF|0xfe|0xff/i);
  assert.match(cssSource, /\.storefrontInvoiceCard/);
  assert.match(cssSource, /\.storefrontInvoiceDownload/);
});

test("storefront account UI opens after-sales cases from authenticated purchases", () => {
  const clientSource = source("src/modules/storefront/storefront-account-client.tsx");
  const actionsSource = source("src/modules/storefront/storefront-account-actions.ts");
  const accountSource = source("src/modules/storefront/storefront-account.ts");
  const cssSource = source("app/globals.css");

  assert.match(clientSource, /Postventa/);
  assert.match(clientSource, /setDrawer\("afterSales"\)/);
  assert.match(clientSource, /AfterSalesPanel/);
  assert.match(clientSource, /submitStorefrontAfterSalesCase/);
  assert.match(clientSource, /name="orderId"/);
  assert.match(clientSource, /name="reasonCode"/);
  assert.match(clientSource, /name="requestedResolution"/);
  assert.match(clientSource, /name="customerMessage"/);
  assert.match(clientSource, /minLength=\{20\}/);
  assert.match(actionsSource, /customerMessage\.length < 20/);
  assert.match(actionsSource, /source: "storefront_account"/);
  assert.match(accountSource, /method: "POST"/);
  assert.match(accountSource, /content-type": "application\/json"/);
  assert.match(cssSource, /\.storefrontAfterSalesPanel/);
  assert.doesNotMatch(clientSource + actionsSource + accountSource, /app\/api\/storefront\/me\/after-sales/);
});

test("storefront header switches authenticated customers to account entry", () => {
  const headerSource = source("src/modules/storefront/plp-page.tsx");
  const authEntrySource = source("src/modules/storefront/storefront-auth-drawer.tsx");

  assert.match(headerSource, /getStorefrontCustomerSession/);
  assert.match(headerSource, /customerEmail=\{customerSession\?\.email\}/);
  assert.match(authEntrySource, /href="\/account"/);
  assert.match(authEntrySource, /Mi cuenta/);
  assert.match(authEntrySource, /logoutStorefrontCustomer/);
  assert.match(authEntrySource, /Cerrar sesion/);
});

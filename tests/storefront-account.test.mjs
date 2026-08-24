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
  assert.match(accountSource, /\/auth\/sessions/);
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

test("storefront account UI lets customers manage their own active sessions", () => {
  const clientSource = source("src/modules/storefront/storefront-account-client.tsx");
  const actionsSource = source("src/modules/storefront/storefront-account-actions.ts");
  const accountSource = source("src/modules/storefront/storefront-account.ts");
  const routeSource = source("app/account/page.tsx");
  const cssSource = source("app/globals.css");

  assert.match(routeSource, /accountSection/);
  assert.match(routeSource, /value === "invoices" \|\| value === "sessions"/);
  assert.match(accountSource, /StorefrontDeviceSessionsData/);
  assert.match(accountSource, /StorefrontLogoutAllSessionsResponse/);
  assert.match(accountSource, /requestStorefrontBff<StorefrontDeviceSessionsData>\("\/auth\/sessions"/);
  assert.match(accountSource, /logoutCurrentStorefrontSession/);
  assert.match(accountSource, /\/auth\/sessions\/logout-current/);
  assert.match(accountSource, /logoutAllStorefrontSessions/);
  assert.match(accountSource, /\/auth\/sessions\/logout-all/);
  assert.match(accountSource, /JSON\.stringify\(\{ includeCurrent \}\)/);
  assert.match(actionsSource, /closeStorefrontAccountSessions/);
  assert.match(actionsSource, /type SessionOperation = "current" \| "others" \| "all"/);
  assert.match(actionsSource, /operation === "current"/);
  assert.match(actionsSource, /operation === "all"/);
  assert.match(actionsSource, /logoutAllStorefrontSessions\(operation === "all"\)/);
  assert.match(actionsSource, /clearStorefrontCustomerSession/);
  assert.match(clientSource, /Sesiones y dispositivos/);
  assert.match(clientSource, /setDrawer\("sessions"\)/);
  assert.match(clientSource, /SessionsPanel/);
  assert.match(clientSource, /SessionCard/);
  assert.match(clientSource, /name="operation" type="hidden" value="current"/);
  assert.match(clientSource, /name="operation" type="hidden" value="others"/);
  assert.match(clientSource, /name="operation" type="hidden" value="all"/);
  assert.match(clientSource, /window\.confirm/);
  assert.match(clientSource, /Este dispositivo/);
  assert.match(clientSource, /Cerrar otros dispositivos/);
  assert.match(clientSource, /Cerrar todas/);
  assert.match(cssSource, /\.storefrontSessionsPanel/);
  assert.match(cssSource, /\.storefrontSessionCardCurrent/);
  assert.match(cssSource, /\.storefrontAccountDangerButton/);
  assert.doesNotMatch(clientSource + actionsSource + accountSource, /admin\/customers\/.*sessions/);
  assert.doesNotMatch(clientSource + actionsSource + accountSource, /localStorage|app\/api\/storefront\/sessions/);
});

test("storefront avatar static files bypass the public-page proxy", () => {
  const proxySource = source("proxy.ts");

  assert.match(proxySource, /"storefront"/);
});

test("storefront account links each purchase to the canonical tracking view without recreating it", () => {
  const clientSource = source("src/modules/storefront/storefront-account-client.tsx");
  const cssSource = source("app/globals.css");
  const routeSource = source("app/account/page.tsx");

  assert.match(routeSource, /purchasesLimit/);
  assert.match(routeSource, /purchasesOffset/);
  assert.match(clientSource, /Mis compras/);
  assert.match(clientSource, /purchaseItemHref/);
  assert.match(clientSource, /productUrlPath/);
  assert.match(clientSource, /\/pdp\/\$\{encodeURIComponent\(item\.productSlug\)\}/);
  assert.match(clientSource, /orderReference/);
  assert.match(clientSource, /Pedido #\{orderReference\}/);
  assert.match(clientSource, /Ver seguimiento del pedido/);
  assert.match(clientSource, /\/pedido\/\$\{encodeURIComponent\(orderReference\)\}\/seguimiento/);
  assert.match(clientSource, /moneyText\(purchase\.totalAmountMinor/);
  assert.match(clientSource, /moneyText\(item\.unitPriceMinor/);
  assert.match(clientSource, /purchase\.items\.map/);
  assert.doesNotMatch(clientSource, /purchase\.items\.slice\(0, 3\)/);
  assert.match(cssSource, /\.storefrontPurchaseCard/);
  assert.match(cssSource, /\.storefrontPurchaseItems[\s\S]*max-height: 202px/);
  assert.match(cssSource, /\.storefrontPurchaseItems[\s\S]*overflow-y: auto/);
  assert.match(cssSource, /\.storefrontPurchaseActions/);
  assert.doesNotMatch(clientSource, /PurchaseTrackingModule|purchaseTrackingSteps|storefrontTrackingRail/);
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
  const routeSource = source("app/account/page.tsx");
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
  assert.match(clientSource, /afterSalesView=cases/);
  assert.match(clientSource, /afterSalesView=new/);
  assert.match(clientSource, /AfterSalesCaseList/);
  assert.match(clientSource, /\{total > limit \? \([\s\S]*<\/nav>\s*\) : null\}\s*<div className="storefrontAfterSalesCaseListActions">/);
  assert.match(clientSource, /AfterSalesHome/);
  assert.match(clientSource, /AdminInfoTooltip/);
  assert.match(clientSource, /Más información sobre Mis casos/);
  assert.match(clientSource, /Más información sobre Abrir un caso nuevo/);
  assert.doesNotMatch(clientSource, /title="Mis casos"|title="Abrir un caso nuevo"/);
  assert.match(clientSource, /if \(initialView !== "new"\) \{\s+return <AfterSalesHome cases=\{cases\} \/>;/);
  assert.match(clientSource, /¿Qué necesitas hacer\?/);
  assert.match(clientSource, /Abrir un caso nuevo/);
  assert.match(clientSource, /moveWizardStep/);
  assert.match(clientSource, /setWizardDirection/);
  assert.match(clientSource, /disabled=\{pending \|\| !isComplete\}/);
  assert.match(clientSource, /Paso 1 de 3/);
  assert.match(clientSource, /Paso 2 de 3/);
  assert.match(clientSource, /Paso 3 de 3/);
  assert.match(clientSource, /Revisa antes de abrir el caso/);
  assert.match(clientSource, /storefrontAfterSalesReasonLabel/);
  assert.match(clientSource, /storefrontResolutionOutcomeLabel\(requestedResolution\)/);
  assert.match(clientSource, /selectedProductSummary\.join/);
  assert.match(clientSource, /No cierres esta ventana/);
  assert.match(clientSource, /¿Deseas aportar evidencias\?/);
  assert.match(clientSource, /selectedEvidenceFiles/);
  assert.match(cssSource, /\.storefrontAfterSalesHomeChoices \{\s+display: grid;\s+grid-template-columns: repeat\(2, max-content\);\s+align-items: start;/);
  assert.doesNotMatch(cssSource, /\.storefrontAfterSalesHomeChoice \{\s+position: relative;\s+min-height:/);
  assert.match(cssSource, /\.storefrontAfterSalesHomeChoiceLink strong \{\s+color: var\(--storefront-text, #363a41\);\s+font-size: 16px;\s+white-space: nowrap;/);
  assert.match(cssSource, /\.storefrontAfterSalesCaseListActions \{\s+display: grid;\s+grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(cssSource, /\.storefrontAfterSalesWizardActions \{\s+display: grid;\s+grid-template-columns: minmax\(0, 1fr\) minmax\(0, 2fr\);/);
  assert.match(clientSource, /formData\.append\("evidences", file, file\.name\)/);
  assert.match(clientSource, /multiple/);
  assert.match(clientSource, /AfterSalesOpeningComplete/);
  assert.match(clientSource, /Tu caso ya está abierto/);
  assert.match(clientSource, /Ver caso/);
  assert.match(actionsSource, /formData\.getAll\("evidences"\)/);
  assert.match(actionsSource, /ui-opening-evidence-/);
  assert.match(actionsSource, /caseId: result\.data\.caseId/);
  assert.match(clientSource, /Volver a postventa/);
  assert.match(clientSource, /Volver a mis casos/);
  assert.match(clientSource, /Paginación de casos/);
  assert.match(accountSource, /afterSalesLimit/);
  assert.match(accountSource, /afterSalesOffset/);
  assert.match(routeSource, /afterSalesView/);
  assert.match(routeSource, /value === "cases" \|\| value === "new"/);
  assert.match(routeSource, /afterSalesLimit/);
  assert.match(routeSource, /afterSalesOffset/);
  assert.match(actionsSource, /customerMessage\.length < 20/);
  assert.match(actionsSource, /source: "storefront_account"/);
  assert.match(accountSource, /method: "POST"/);
  assert.match(accountSource, /content-type": "application\/json"/);
  assert.match(cssSource, /\.storefrontAfterSalesPanel/);
  assert.match(cssSource, /\.storefrontAfterSalesHomeChoices/);
  assert.match(cssSource, /\.storefrontAfterSalesHomeChoice/);
  assert.match(cssSource, /\.storefrontAfterSalesHomeChoiceLink/);
  assert.match(cssSource, /\.storefrontAfterSalesWizardProgress/);
  assert.match(cssSource, /storefrontAfterSalesWizardPanelEnterForward/);
  assert.match(cssSource, /storefrontAfterSalesWizardPanelEnterBackward/);
  assert.match(cssSource, /prefers-reduced-motion: reduce/);
  assert.match(cssSource, /\.storefrontAfterSalesEvidencePicker/);
  assert.match(cssSource, /\.storefrontAfterSalesPreparedEvidence/);
  assert.match(cssSource, /\.storefrontAfterSalesOpeningComplete/);
  assert.match(cssSource, /\.storefrontAfterSalesWizardSubmitting/);
  assert.match(cssSource, /\.storefrontAfterSalesCaseList/);
  assert.match(cssSource, /\.storefrontAfterSalesCaseLink/);
  assert.doesNotMatch(clientSource + actionsSource + accountSource, /app\/api\/storefront\/me\/after-sales/);
});

test("storefront after-sales lets the customer accept or reject a pending solution proposal", () => {
  const clientSource = source("src/modules/storefront/storefront-account-client.tsx");
  const actionsSource = source("src/modules/storefront/storefront-account-actions.ts");
  const accountSource = source("src/modules/storefront/storefront-account.ts");
  const cssSource = source("app/globals.css");

  assert.match(accountSource, /solutionProposals/);
  assert.match(accountSource, /solution-proposals\/\$\{encodeURIComponent\(proposalId\)\}\/response/);
  assert.match(accountSource, /"PATCH"/);
  assert.match(actionsSource, /respondToStorefrontAfterSalesSolutionProposal/);
  assert.match(actionsSource, /decision !== "ACCEPT" && decision !== "REJECT"/);
  assert.match(clientSource, /PENDING_CUSTOMER/);
  assert.match(clientSource, /Aceptar propuesta/);
  assert.match(clientSource, />Rechazar</);
  assert.match(clientSource, /afterSalesConversationThread/);
  assert.match(clientSource, /storefrontAfterSalesConversationThread/);
  assert.match(clientSource, /conversation\.scrollTop = conversation\.scrollHeight/);
  assert.match(clientSource, /afterSalesConversationMessageTeam/);
  assert.match(clientSource, /Mensaje inicial/);
  assert.match(clientSource, /dateTimeText\(message\.createdAt\)/);
  assert.match(cssSource, /\.storefrontAfterSalesConversationThread \{\s+gap: 10px;\s+max-height: 420px;\s+overflow-y: auto;/);
  assert.doesNotMatch(clientSource + actionsSource + accountSource, /admin\/after-sales/);
});

test("storefront after-sales exposes a customer-scoped completion confirmation action", () => {
  const actionsSource = source("src/modules/storefront/storefront-account-actions.ts");
  const accountSource = source("src/modules/storefront/storefront-account.ts");

  assert.match(accountSource, /confirmStorefrontAfterSalesCompletion/);
  assert.match(accountSource, /\/storefront\/me\/after-sales\/cases\/\$\{encodeURIComponent\(caseId\)\}\/confirm-completion/);
  assert.match(accountSource, /note \? \{ note \} : \{\}/);
  assert.match(actionsSource, /confirmStorefrontAfterSalesCompletionAction/);
  assert.match(actionsSource, /confirmStorefrontAfterSalesCompletion\(caseId, note \|\| undefined\)/);
  assert.match(actionsSource, /revalidatePath\("\/account"\)/);
  assert.match(actionsSource, /El caso queda cerrado/);
  assert.doesNotMatch(accountSource + actionsSource, /resolutionId.*confirm-completion|privateEvidence.*confirm-completion/);
});

test("storefront after-sales shows a clear resolution confirmation card", () => {
  const clientSource = source("src/modules/storefront/storefront-account-client.tsx");
  const cssSource = source("app/globals.css");

  assert.match(clientSource, /confirmStorefrontAfterSalesCompletionAction/);
  assert.match(clientSource, /Solución finalizada/);
  assert.match(clientSource, /¿Has recibido la solución\?/);
  assert.match(clientSource, /Confirmar que he recibido la solución y cerrar caso/);
  assert.match(clientSource, /Confirmando cierre/);
  assert.match(clientSource, /dateTimeText\(caseDetail\.autoCloseAt\)/);
  assert.match(clientSource, /name="caseId" type="hidden" value=\{caseDetail\.caseId\}/);
  assert.match(clientSource, /\["REFUND", "STORE_CREDIT", "EXCHANGE", "REPAIR", "REPLACEMENT"\]/);
  assert.match(cssSource, /\.storefrontAfterSalesCompletionCard \{/);
  assert.match(cssSource, /\.storefrontAfterSalesCompletionHint \{/);
});

test("storefront after-sales makes a problem with a completed solution an explicit action", () => {
  const clientSource = source("src/modules/storefront/storefront-account-client.tsx");
  const cssSource = source("app/globals.css");

  assert.match(clientSource, /Tengo un problema con la solución/);
  assert.match(clientSource, /setIsReportingSolutionProblem\(true\)/);
  assert.match(clientSource, /canContinueCase/);
  assert.match(clientSource, /Cuéntanos qué ha fallado/);
  assert.match(clientSource, /Adjuntar prueba del problema/);
  assert.match(clientSource, /Enviar problema/);
  assert.match(clientSource, /setIsReportingSolutionProblem\(false\)/);
  assert.match(cssSource, /\.storefrontAfterSalesCompletionActions \{/);
});

test("storefront after-sales evidence uses a bounded multipart upload through BFF", () => {
  const clientSource = source("src/modules/storefront/storefront-account-client.tsx");
  const actionsSource = source("src/modules/storefront/storefront-account-actions.ts");
  const accountSource = source("src/modules/storefront/storefront-account.ts");
  const configSource = source("next.config.ts");
  const evidenceRouteSource = source("app/account/after-sales/cases/[caseId]/evidences/[privateEvidenceId]/content/route.ts");
  const cssSource = source("app/globals.css");

  assert.match(accountSource, /new FormData\(\)/);
  assert.match(accountSource, /body\.set\("file", input\.file, input\.file\.name\)/);
  assert.match(accountSource, /body\.set\("idempotencyKey", input\.idempotencyKey\)/);
  assert.match(accountSource, /\/storefront\/me\/after-sales\/cases\/\$\{encodeURIComponent\(input\.caseId\)\}\/evidences/);
  assert.doesNotMatch(accountSource, /contentBase64|originalFileName: input|mimeType: input/);
  assert.match(actionsSource, /allowedEvidenceMimeTypes/);
  assert.match(actionsSource, /validateStorefrontEvidenceFile/);
  assert.match(actionsSource, /hasJpegSignature/);
  assert.match(actionsSource, /hasPngSignature/);
  assert.match(actionsSource, /hasWebpSignature/);
  assert.match(actionsSource, /evidenceUploadFailureMessage/);
  assert.doesNotMatch(actionsSource, /Buffer\.from\(await file\.arrayBuffer\(\)\)\.toString\("base64"\)/);
  assert.match(clientSource, /image\/png,image\/jpeg,image\/webp/);
  assert.match(clientSource, /evidenceCount >= 15/);
  assert.match(clientSource, /de 15 imágenes adjuntas al caso/);
  assert.match(clientSource, /Analizando imagen/);
  assert.match(clientSource, /\/account\/after-sales\/cases\/\$\{encodeURIComponent\(caseDetail\.caseId\)\}\/evidences\//);
  assert.match(clientSource, /Imágenes aportadas/);
  assert.match(clientSource, /CloudUpload/);
  assert.match(clientSource, /storefrontAfterSalesFileTrigger/);
  assert.match(clientSource, /selectedEvidenceName/);
  assert.match(clientSource, /storefrontAfterSalesEvidenceLightbox/);
  assert.match(clientSource, /Ver imagen siguiente/);
  assert.match(clientSource, /lifecycleStatus/);
  assert.match(clientSource, /Caso cerrado/);
  assert.match(cssSource, /\.storefrontAfterSalesFileTrigger \{\s+display: inline-flex;/);
  assert.match(clientSource, /Confirmación abierta hasta/);
  assert.match(accountSource, /resolutionOutcome/);
  assert.match(accountSource, /autoCloseAt/);
  assert.match(evidenceRouteSource, /getStorefrontCustomerAuthorizationHeader/);
  assert.match(evidenceRouteSource, /\/storefront\/me\/after-sales\/cases\/\$\{encodeURIComponent\(normalizedCaseId\)\}\/evidences\//);
  assert.match(evidenceRouteSource, /cache-control": "private, no-store"/);
  assert.match(evidenceRouteSource, /x-content-type-options": "nosniff"/);
  assert.match(evidenceRouteSource, /referrer-policy": "no-referrer"/);
  assert.doesNotMatch(evidenceRouteSource, /localStorage|NEXT_PUBLIC|bucket|storage/i);
  assert.match(configSource, /10 \* 1024 \* 1024 \+ 64 \* 1024/);
});

test("storefront header switches authenticated customers to account entry", () => {
  const headerSource = source("src/modules/storefront/storefront-header.tsx");
  const authEntrySource = source("src/modules/storefront/storefront-auth-drawer.tsx");

  assert.match(headerSource, /getStorefrontCustomerSession/);
  assert.match(headerSource, /customerEmail=\{customerSession\?\.email\}/);
  assert.match(authEntrySource, /href="\/account"/);
  assert.match(authEntrySource, /Mi cuenta/);
  assert.match(authEntrySource, /logoutStorefrontCustomer/);
  assert.match(authEntrySource, /Cerrar sesion/);
});

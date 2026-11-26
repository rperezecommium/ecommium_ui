import { createRequire } from "node:module";
import { captureEvidence } from "./evidence-capture";
import { chromium, expect, test, type Page } from "@playwright/test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { once } from "node:events";
import net from "node:net";

const defaultOrganizationId = "11111111-1111-4111-8111-111111111111";
const barcelonaShopId = "22222222-2222-4222-8222-222222222222";

type CapturedLoginPayload = {
  email?: string;
  password?: string;
  organizationId?: string;
  shopId?: string;
  shopAlias?: string;
  scope?: string;
};

const retirementProductId=process.env.RETIREMENT_LAB_PRODUCT_ID??"33333333-3333-4333-8333-333333333333",retirementVariantId=process.env.RETIREMENT_LAB_VARIANT_ID??"44444444-4444-4444-8444-444444444444",retirementDefaultId=process.env.RETIREMENT_LAB_DEFAULT_ID??"55555555-5555-4555-8555-555555555555",retirementOperationId="66666666-6666-4666-8666-666666666666",retirementReviewId="77777777-7777-4777-8777-777777777777";
let catalogRetirementScenario=false,catalogRetirementBlocked=false,catalogRetirementLost=false,catalogRetirementProductRemoved=false,catalogRetirementVariantRemoved=false,catalogRetirementSteps=0,catalogRetirementConfirmations=0;
let catalogRetirementOperation:Record<string,unknown>|null=null;
const catalogRetirementKeys:string[]=[];
function retirementTarget(variant=false){return {organizationId:defaultOrganizationId,shopId:barcelonaShopId,kind:variant?'variant':'product',productId:retirementProductId,variantId:variant?retirementVariantId:null,refId:variant?'PEP-RED':'QA-DELETE',name:variant?'Variante QA':'QA eliminación producto'};}
async function catalogRetirementFixture(request:IncomingMessage,response:ServerResponse,url:URL){
 if(!catalogRetirementScenario)return false;
 if(process.env.CATALOG_RETIREMENT_LAB_URL&&(url.pathname==='/api/v1/admin/products'||url.pathname.includes('catalog-retirements')||url.pathname.includes('/deletion-'))){
  if(url.pathname.endsWith('/retry'))catalogRetirementSteps++;
  const body=request.method==='GET'?undefined:JSON.stringify(await readJsonBody(request));
  const result=await fetch(process.env.CATALOG_RETIREMENT_LAB_URL+url.pathname+url.search,{method:request.method,headers:{authorization:'Bearer '+process.env.RETIREMENT_LAB_TOKEN,'content-type':'application/json',...(request.headers['idempotency-key']?{'idempotency-key':String(request.headers['idempotency-key'])}:{})},body});
  sendJson(response,result.status,await result.json());return true;
 }

 if(request.method==='GET'&&url.pathname==='/api/v1/admin/products'){sendJson(response,200,{total:catalogRetirementProductRemoved?0:1,limit:20,offset:0,items:catalogRetirementProductRemoved?[]:[{productId:retirementProductId,name:{'es-ES':'QA eliminación producto'},slug:'qa-delete',refId:'QA-DELETE',reference:'QA-DELETE',isActive:true,isVisible:true,defaultVariantId:retirementDefaultId,quantity:1}]});return true;}
 if(url.pathname==='/api/v1/admin/catalog-retirements/capability'){sendJson(response,200,{available:true});return true;}
 if(request.method==='GET'&&url.pathname==='/api/v1/admin/catalog-retirements'){sendJson(response,200,{items:catalogRetirementOperation&&catalogRetirementOperation.status!=='COMPLETED'?[catalogRetirementOperation]:[],total:catalogRetirementOperation&&catalogRetirementOperation.status!=='COMPLETED'?1:0,limit:25,offset:Number(url.searchParams.get('offset')??0)});return true;}
 if(request.method==='POST'&&url.pathname.endsWith('/deletion-preview')&&url.pathname.includes(retirementProductId)){
 const variant=url.pathname.includes('/variants/');const participants=Object.fromEntries(['inventory','pricing','routing-seo','media','cms','search'].map(owner=>[owner,{version:'owner-v1',counts:{rows:1},blockers:owner==='inventory'&&catalogRetirementBlocked?['INVENTORY_RESERVATIONS_OR_QUARANTINE']:[]}]));
 sendJson(response,200,{reviewId:retirementReviewId,version:'a'.repeat(64),expiresAt:new Date(Date.now()+60000).toISOString(),target:retirementTarget(variant),participants,canDelete:!catalogRetirementBlocked});return true;}
 if(request.method==='POST'&&url.pathname.endsWith('/deletion-operations')&&url.pathname.includes(retirementProductId)){
 const body=await readJsonBody(request);const key=String(request.headers['idempotency-key']??'');catalogRetirementKeys.push(key);expect(body.confirmationRefId).toBe(url.pathname.includes('/variants/')?'PEP-RED':'QA-DELETE');
 if(!catalogRetirementOperation){catalogRetirementConfirmations++;catalogRetirementOperation={operationId:retirementOperationId,target:retirementTarget(url.pathname.includes('/variants/')),step:0,status:'RUNNING',error:null};}
 if(catalogRetirementLost){catalogRetirementLost=false;response.destroy();return true;}sendJson(response,202,catalogRetirementOperation);return true;}
 if(request.method==='GET'&&url.pathname===`/api/v1/admin/catalog-retirements/${retirementOperationId}`){sendJson(response,200,catalogRetirementOperation);return true;}
 if(request.method==='POST'&&url.pathname===`/api/v1/admin/catalog-retirements/${retirementOperationId}/retry`){catalogRetirementSteps++;const variant=(catalogRetirementOperation?.target as {kind?:string})?.kind==='variant';if(catalogRetirementSteps===1){if(variant)catalogRetirementVariantRemoved=true;else catalogRetirementProductRemoved=true;catalogRetirementOperation={...catalogRetirementOperation,step:14,status:'AWAITING_PROJECTION'};}else catalogRetirementOperation={...catalogRetirementOperation,step:15,status:'COMPLETED'};sendJson(response,200,catalogRetirementOperation);return true;}
 return false;
}

let bffServer: Server;
let bffPort = 0;
let nextPort = 0;
let nextProcess: ChildProcessWithoutNullStreams;
let nextOutput = "";
let categoryRow = {categoryId:"category-bikes",name:"Bicicletas",slug:"bicicletas",isActive:true};
let categoryRemoved = false;
let brandRow = {brandId:"brand-demo",name:"Marca Demo",slug:"marca-demo",isActive:true};
let brandRemoved = false;
const brandMutations: Array<{method:string;mode:string|null;body:Record<string,unknown>}> = [];
const categoryMutations: Array<{method:string;mode:string|null;body:Record<string,unknown>}> = [];
const capturedLoginPayloads: CapturedLoginPayload[] = [];
const capturedBffRequests: string[] = [];
const capturedDraftStateRequests: string[] = [];
const capturedDraftMediaUploadRequests: string[] = [];
const capturedDraftMediaUploadIdempotencyKeys: string[] = [];
const capturedDraftMediaUploadBodies: string[] = [];
const capturedSaveOperationRequests: string[] = [];
const capturedSaveOperationIdempotencyKeys: string[] = [];
const capturedSaveOperationBodies: string[] = [];
const saveCommandsByKey = new Map<string, string>();
const capturedEditorStateRequests: string[] = [];
const capturedPricingPreviewRequests: string[] = [];
let pricingDatesScenario = false;
const capturedPricingGovernanceRequests: string[] = [];
const capturedCatalogSpecificationRequests: string[] = [];
const capturedCatalogOfferingRequests: string[] = [];
const capturedShippingAdminRequests: string[] = [];
const capturedShippingActiveMutations: Array<{
  method: string;
  path: string;
  body: Record<string, unknown>;
}> = [];
const capturedShippingFulfillmentMutations: Array<{
  method: string;
  path: string;
  body: Record<string, unknown>;
}> = [];
const capturedSeoAdminRequests: string[] = [];
const capturedSeoMutations: Array<{
  method: string;
  path: string;
  body: Record<string, unknown>;
}> = [];
const capturedMediaAdminRequests: string[] = [];
const capturedMediaAdminMutations: Array<{
  method: string;
  path: string;
}> = [];
const capturedStockAdminRequests: string[] = [];
const capturedCustomersAdminRequests: string[] = [];
let commercialScenario = false;
let commercialMembershipStatus = 200;
let commercialGroupsStatus = 200;
let commercialConflict = false;
let commercialInvalidSnapshot = false;
let commercialMembership = {groupCode:null as string|null,b2bApproved:false,buyerType:"PRIVATE_BUYER",revision:0};
let commercialGroups = [{code:"vip",name:"VIP",active:true},{code:"pro",name:"Profesional",active:true}];
const commercialProfileWrites: Record<string,unknown>[] = [];
let commercialAudit: Array<Record<string,unknown>> = [];
let commercialPolicy = {policy:{allowedGroups:[] as string[],registeredGroup:null as string|null,b2bGroup:null as string|null},revision:0};

const capturedCommunicationsAdminRequests: string[] = [];
const capturedStockMutations: Array<{
  method: string;
  path: string;
  body: Record<string, unknown>;
}> = [];
const capturedPricingMutations: Array<{
  method: string;
  path: string;
  body: Record<string, unknown>;
}> = [];
const capturedCommunicationsMutations: Array<{
  method: string;
  path: string;
  body: Record<string, unknown>;
}> = [];
const capturedMediaAssetContentRequests: string[] = [];
const cmsPageId = "7af39739-bdc0-4450-b977-5b6015fd08eb";
const capturedCmsPageDeletes: string[] = [];
let cmsPageDeleted = false;
let authPermissions = ["admin:*", "media.assets.write"];
let dashboardHealthScenario: "healthy"|"mixed"|"invalid" = "healthy";
let authMeFailuresRemaining=0;
let sessionRefreshCalls=0;
let rejectConfigurationCreate = false;
let rejectSpecificationCreate = false;
const lifecycleGroupId="44444444-4444-4444-8444-444444444444",lifecycleFieldId="55555555-5555-4555-8555-555555555555";
let deletionAvailable=true,deletionMutations=0,deletionRetries=0,deletionOperationId="",deletionProjected=false,deletionLostResponse=false,deletionProducts=3200;
let lifecycleLostResponse=false;
let lifecycleProjected=false,lifecycleInactive=false,lifecycleMutations=0,lifecycleConflict=false,lifecycleVersion="a".repeat(64);
let delaySpecificationProjection = false;
const configurationCreates: Array<{path:string;body:Record<string,unknown>}> = [];
let shopPreparationState: "READY" | "FAILED" | "RUNNING" = "READY";
let shopPreparationPolls = 0;
const capturedPreparationRetries: unknown[] = [];
let editorProductActive = false;
let editorProductVisible = true;
let saveOperationMode: "partial_failed" | "success" | "published" = "partial_failed";
let draftMediaUploadMode: "success" | "failed" = "success";

type PricingTaxFixture = {
  taxId: string;
  taxCode: string;
  name: string;
  calculationType: string;
  rate: number | null;
  country?: string;
  isActive: boolean;
};

const pricingTaxes: PricingTaxFixture[] = [{
  taxId: "tax-standard",
  taxCode: "standard",
  name: "IVA general",
  calculationType: "PERCENTAGE",
  rate: 0.21,
  isActive: true,
}, {
  taxId: "tax-default-iva",
  taxCode: "default-iva",
  name: "Default IVA",
  calculationType: "PERCENTAGE",
  rate: 0.1,
  country: "ES",
  isActive: true,
}];
const pricingPriceTables = [{
  priceTableId: "base",
  name: "Base",
  active: true,
  currency: "EUR",
}, {
  priceTableId: "cockpit-vip",
  name: "Cockpit VIP",
  active: true,
  currency: "EUR",
}, {
  priceTableId: "vip-table",
  name: "VIP table",
  active: true,
  currency: "EUR",
}];
const pricingRulesByTable: Record<string, Array<{
  ruleId: string;
  active: boolean;
  priority: number;
  source: string;
  tradePolicy: string;
  channel: string;
  customerGroup: string | null;
  country: string;
}>> = {
  "vip-table": [{
    ruleId: "rule-vip",
    active: true,
    priority: 10,
    source: "MANUAL",
    tradePolicy: "default",
    channel: "web",
    customerGroup: "vip",
    country: "ES",
  }],
};
const pricingFixedPrices: Array<{
  productId: string;
  variantId: string;
  itemId: string;
  priceTableId: string;
  fixedPrice: { amountMinor: number; currency: string };
  basePrice: { amountMinor: number; currency: string };
  listPrice: { amountMinor: number; currency: string } | null;
  fixedPriceMinor: number;
  basePriceMinor: number;
  listPriceMinor: number | null;
  currency: string;
  taxIncluded: boolean;
  active: boolean;
}> = [{
  productId: "product-computed-auto",
  variantId: "variant-computed-auto",
  itemId: "variant-computed-auto",
  priceTableId: "vip-table",
  fixedPrice: { amountMinor: 9300, currency: "EUR" },
  basePrice: { amountMinor: 9300, currency: "EUR" },
  listPrice: { amountMinor: 10900, currency: "EUR" },
  fixedPriceMinor: 9300,
  basePriceMinor: 9300,
  listPriceMinor: 10900,
  currency: "EUR",
  taxIncluded: true,
  active: true,
}];
const pricingReferenceState: Record<string, Array<{
  code: string;
  name: string;
  helpText: string;
  active: boolean;
}>> = {
  "customer-groups": [{
    code: "vip",
    name: "VIP",
    helpText: "Segmento comercial usado para reglas de precio especifico.",
    active: true,
  }],
  channels: [{
    code: "web",
    name: "Web",
    helpText: "Canal de venta web.",
    active: true,
  }, {
    code: "marketplace",
    name: "Marketplace",
    helpText: "Canal de venta marketplace.",
    active: true,
  }],
  "trade-policies": [{
    code: "default",
    name: "Default",
    helpText: "Politica comercial base.",
    active: true,
  }],
  countries: [{
    code: "ES",
    name: "Espana",
    helpText: "Mercado Espana.",
    active: true,
  }],
};
const emailProviderSettings = {
  organizationId: defaultOrganizationId,
  shopId: barcelonaShopId,
  provider: "stub",
  active: false,
  fromEmail: null as string | null,
  replyToEmail: null as string | null,
  smtpHost: null as string | null,
  smtpPort: null as number | null,
  smtpSecure: false as boolean | null,
  smtpUser: null as string | null,
  secretConfigured: false,
  secretUpdatedAt: null as string | null,
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-07-01T10:00:00.000Z",
};

type AuthEmailTemplateFixture = Record<string, unknown> & {
  templateId: string;
  templateKey: string;
  locale: string;
  subjectTemplate: string | null;
  htmlTemplate?: string | null;
  textTemplate?: string | null;
  status: string;
  requiredVariables: unknown[];
  version: number;
  updatedAt: string;
  activatedAt: string | null;
  archivedAt?: string | null;
};

type CommunicationsDeliveryAttemptFixture = {
  attemptId: string;
  provider: string;
  status: string;
  providerMessageId: string | null;
  errorMessage: string | null;
  occurredAt: string;
};

type CommunicationsDeliveryFixture = Record<string, unknown> & {
  deliveryId: string;
  templateKey: string;
  recipient: { email: string; customerId: string };
  status: string;
  attempts: CommunicationsDeliveryAttemptFixture[];
  errorMessage: string | null;
  sentAt: string | null;
  failedAt: string | null;
  updatedAt: string;
};

let authEmailTemplates: AuthEmailTemplateFixture[] = [{
  templateId: "template-activation",
  templateKey: "customer.account.activation",
  locale: "es-ES",
  subjectTemplate: "Activa tu cuenta",
  status: "ACTIVE",
  requiredVariables: ["activationUrl"],
  version: 1,
  updatedAt: "2026-07-01T10:00:00.000Z",
  activatedAt: "2026-07-01T10:00:00.000Z",
}];
let communicationsDeliveries: CommunicationsDeliveryFixture[] = [{
  deliveryId: "delivery-failed-1",
  organizationId: defaultOrganizationId,
  shopId: barcelonaShopId,
  templateKey: "shipping.delivered",
  templateId: "template-shipping-delivered",
  channel: "EMAIL",
  locale: "es-ES",
  recipient: { email: "guest@example.com", customerId: "customer-guest-1" },
  data: {},
  attachments: [],
  idempotencyKey: "delivery-failed-1-idempotency",
  sourceEventId: "shipping.fulfillment.delivered.v1:fulfillment-1",
  renderedSnapshot: {
    subject: "Tu pedido ha sido entregado",
    html: "<p>Contenido privado</p>",
    text: "Enlace privado tracking-token",
  },
  status: "FAILED",
  attempts: [{
    attemptId: "attempt-failed-1",
    provider: "smtp",
    status: "FAILED",
    providerMessageId: null,
    errorMessage: "SMTP temporalmente no disponible",
    occurredAt: "2026-07-16T12:00:00.000Z",
  }],
  errorMessage: "SMTP temporalmente no disponible",
  sentAt: null,
  failedAt: "2026-07-16T12:00:00.000Z",
  skippedAt: null,
  createdAt: "2026-07-16T11:59:00.000Z",
  updatedAt: "2026-07-16T12:00:00.000Z",
}];
const catalogSpecificationGroups = [{
  specificationGroupId: "spec-group-technical",
  categoryId: "category-bikes",
  name: "Ficha tecnica",
  isActive: true,
  fieldCount: 2,
  linkedCategoryIds: ["category-bikes"],
  fields: [{
    fieldId: "field-composition",
    specificationGroupId: "spec-group-technical",
    fieldTypeId: 1,
    name: "Composicion",
    description: "Composicion",
    position: 1,
    isFilter: true,
    isRequired: false,
    isOnProductDetails: true,
    isStockKeepingUnit: false,
    isActive: true,
    isTopMenuLinkActive: false,
    isSideMenuLinkActive: false,
    defaultValue: null,
    values: [{
      fieldValueId: "value-aluminium",
      fieldId: "field-composition",
      name: "Aluminio",
      text: null,
      isActive: true,
      position: 1,
    }],
  }, {
    fieldId: "field-color",
    specificationGroupId: "spec-group-technical",
    fieldTypeId: 1,
    name: "Color",
    description: "Color",
    position: 2,
    isFilter: true,
    isRequired: false,
    isOnProductDetails: true,
    isStockKeepingUnit: true,
    isActive: true,
    isTopMenuLinkActive: false,
    isSideMenuLinkActive: false,
    defaultValue: null,
    values: [{
      fieldValueId: "value-red",
      fieldId: "field-color",
      name: "Rojo",
      text: null,
      isActive: true,
      position: 1,
    }],
  }],
}];
const catalogOfferings = [{
  id: "offering-installation",
  offeringId: "offering-installation",
  name: "Instalacion",
  localizedName: [{ locale: "es-ES", value: "Instalacion" }],
  priceMinor: 1999,
  currency: "EUR",
  type: "service",
  active: true,
  createdAt: "2026-06-29T00:00:00.000Z",
  updatedAt: "2026-06-29T00:00:00.000Z",
}];
let staleOfferingProjection = false;
let controlledBrandLookup = false;
let controlledTaxOutage = false;
let inheritPriceScenario = false;
const catalogOfferingsByVariant: Record<string, string[]> = {};
let offeringReadProjection: typeof catalogOfferings | null = null;
let offeringRelationMutations = 0;
const shippingConfiguration = {
  zones: [{
    zoneId: "zone-es",
    name: "Espana peninsular",
    countries: ["ES"],
    states: [],
    postalCodePrefixes: ["28"],
    active: true,
  }],
  carriers: [{
    carrierId: "carrier-standard",
    name: "Carrier Standard",
    trackingUrlTemplate: "https://tracking.example.test/{{trackingNumber}}",
    logoUrl: null,
    active: true,
  }],
  carrierServices: [{
    carrierServiceId: "service-standard",
    carrierId: "carrier-standard",
    name: "Entrega standard",
    deliveryChannel: "delivery",
    ratingBasis: "WEIGHT",
    transitTimeLabel: "3-5bd",
    estimateBusinessDays: 4,
    handlingFeeMinor: 0,
    maxWeightGrams: 30000,
    maxWidthMm: null,
    maxHeightMm: null,
    maxDepthMm: null,
    customerGroupIds: [],
    active: true,
  }],
  rateRules: [{
    shippingRateRuleId: "rate-standard",
    carrierServiceId: "service-standard",
    zoneId: "zone-es",
    ratingBasis: "WEIGHT",
    minWeightGrams: 0,
    maxWeightGrams: 30000,
    minOrderAmountMinor: null,
    maxOrderAmountMinor: null,
    priceMinor: 499,
    currency: "EUR",
    taxRateBasisPoints: 2100,
    freeShippingThresholdMinor: null,
    outOfRangeBehavior: "DISABLE_CARRIER",
    priority: 100,
    active: true,
  }],
};
const shippingFulfillments = [{
  fulfillmentId: "fulfillment-e2e-1",
  version: 4,
  orderId: "order-e2e-1",
  orderReference: "#E2E-0001",
  customerId: "customer-e2e-1",
  organizationId: defaultOrganizationId,
  shopId: barcelonaShopId,
  warehouseId: "warehouse-main",
  dockId: "dock-a",
  carrierId: "carrier-standard",
  status: "PACKED",
  trackingNumber: null as string | null,
  trackingUrl: null as string | null,
  carrier: {
    id: "carrier-standard",
    label: "Carrier Standard",
    logoUrl: null,
    trackingUrlTemplate: "https://tracking.example.test/{{trackingNumber}}",
  },
  deliveryAddress: {
    addressType: "residential",
    receiverName: "Ada Lovelace",
    addressId: "address-e2e-1",
    isDisposable: false,
    postalCode: "08001",
    city: "Barcelona",
    state: "Barcelona",
    country: "ES",
    street: "Carrer de la Pau",
    number: "1",
    neighborhood: null,
    complement: "2º A",
    reference: "Portería",
    geoCoordinates: [2.17, 41.38] as [number, number],
  },
  logisticsSnapshot: { sourceOrderFormId: "orderform-e2e-1", items: [] },
  items: [{
    lineId: "line-e2e-1",
    productId: "product-e2e-1",
    variantId: "variant-e2e-1",
    name: "Bicicleta E2E",
    quantity: 2,
  }],
  createdAt: "2026-07-16T10:00:00.000Z",
  updatedAt: "2026-07-16T11:00:00.000Z",
  shippedAt: null as string | null,
  deliveredAt: null as string | null,
}];
const seoRoutes = [{
  routeId: "route-product",
  organizationId: defaultOrganizationId,
  shopId: barcelonaShopId,
  locale: "es-ES",
  path: "/producto-demo/p",
  entityType: "PRODUCT",
  entityId: "product-demo",
  routeKind: "CANONICAL",
  canonicalRouteId: null,
  status: "ACTIVE",
  includeInSitemap: true,
  createdAt: "2026-06-30T00:00:00.000Z",
  updatedAt: "2026-06-30T00:00:00.000Z",
}];
type SeoRedirectFixture = {
  redirectId: string;
  organizationId: string;
  shopId: string;
  locale: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  status: string;
  reason: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const seoRedirects: SeoRedirectFixture[] = [{
  redirectId: "redirect-product-old",
  organizationId: defaultOrganizationId,
  shopId: barcelonaShopId,
  locale: "es-ES",
  fromPath: "/producto-antiguo/p",
  toPath: "/producto-demo/p",
  statusCode: 301,
  status: "ACTIVE",
  reason: "slug change",
  expiresAt: null,
  createdAt: "2026-06-30T00:00:00.000Z",
  updatedAt: "2026-06-30T00:00:00.000Z",
}];
const mediaCollections = [{
  mediaCollectionId: "collection-admin-1",
  organizationId: defaultOrganizationId,
  shopId: barcelonaShopId,
  productId: "product-edit-1",
  title: { "es-ES": "Galeria producto existente" },
  defaultLocale: "es-ES",
  active: true,
  itemCount: 1,
  mediaAssetIds: ["asset-admin-1"],
  items: [{
    mediaAssetId: "asset-admin-1",
    fileName: "admin-cover.png",
    mimeType: "image/png",
    fileSize: 68,
    position: 1,
    active: true,
    isMain: true,
    alt: { "es-ES": "Alt admin media" },
    title: { "es-ES": "Title admin media" },
    createdAt: "2026-06-30T00:00:00.000Z",
    updatedAt: "2026-06-30T00:00:00.000Z",
  }],
  createdAt: "2026-06-30T00:00:00.000Z",
  updatedAt: "2026-06-30T00:00:00.000Z",
}];
const uploadedDraftMediaByClientDraftId = new Map<string, Array<{
  localId: string;
  mediaAssetId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  previewUrl: string;
  thumbnailUrl: string;
  isMain: boolean;
  position: number;
  active: boolean;
  persisted: true;
  uploadStatus: "uploaded";
  alt: Record<string, string>;
  title: Record<string, string>;
}>>();
const onePixelPngDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

async function freePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  server.close();
  await once(server, "close");
  return port;
}

function readJsonBody(request: IncomingMessage) {
  return new Promise<Record<string, unknown>>((resolve) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += String(chunk);
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) as Record<string, unknown> : {});
      } catch {
        resolve({});
      }
    });
  });
}

function readRawBody(request: IncomingMessage) {
  return new Promise<string>((resolve) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    request.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
  });
}

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  if((response as ServerResponse&{retirementEditor?:boolean}).retirementEditor){payload=JSON.parse(JSON.stringify(payload).replaceAll('product-edit-1',retirementProductId).replaceAll('variant-edit-default',retirementDefaultId).replaceAll('variant-edit-red',retirementVariantId).replaceAll('variant-edit-green','88888888-8888-4888-8888-888888888888'));if(catalogRetirementVariantRemoved&&payload&&typeof payload==='object'&&Array.isArray((payload as {variants?:unknown[]}).variants))(payload as {variants:Array<{variantId?:string}>}).variants=(payload as {variants:Array<{variantId?:string}>}).variants.filter(v=>v.variantId!==retirementVariantId);}

  response.writeHead(status, {
    "content-type": "application/json",
  });
  response.end(JSON.stringify(payload));
}

function assertPricingTenant(url: URL) {
  expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
  expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
}

function upsertReference(
  rows: Array<{ code: string; name: string; helpText: string; active: boolean }>,
  body: Record<string, unknown>,
) {
  const code = typeof body.code === "string" ? body.code : "";
  const next = {
    code,
    name: typeof body.name === "string" ? body.name : code,
    helpText: typeof body.helpText === "string" ? body.helpText : "",
    active: typeof body.active === "boolean" ? body.active : true,
  };
  const index = rows.findIndex((item) => item.code === code);
  if (index >= 0) {
    rows[index] = next;
  } else {
    rows.push(next);
  }

  return next;
}

function parseMultipartTextField(body: string, name: string) {
  const marker = `name="${name}"`;
  const markerIndex = body.indexOf(marker);
  if (markerIndex < 0) {
    return "";
  }

  const valueStart = body.indexOf("\r\n\r\n", markerIndex);
  if (valueStart < 0) {
    return "";
  }

  const valueEnd = body.indexOf("\r\n--", valueStart + 4);
  return body.slice(valueStart + 4, valueEnd > valueStart ? valueEnd : undefined).trim();
}

function draftIdFromProductDraftPath(pathname: string) {
  const parts = pathname.split("/");
  const draftIndex = parts.indexOf("product-drafts");
  return draftIndex >= 0 ? decodeURIComponent(parts[draftIndex + 1] ?? "") : "";
}

function activeShippingItems<T extends { active?: boolean }>(items: T[], includeInactive: boolean) {
  return includeInactive ? items : items.filter((item) => item.active !== false);
}

function shippingResourceState(resource: string): {
  items: Array<Record<string, unknown> & { active?: boolean }>;
  idKey: string;
} | null {
  if (resource === "zones") {
    return { items: shippingConfiguration.zones, idKey: "zoneId" };
  }
  if (resource === "carriers") {
    return { items: shippingConfiguration.carriers, idKey: "carrierId" };
  }
  if (resource === "carrier-services") {
    return { items: shippingConfiguration.carrierServices, idKey: "carrierServiceId" };
  }
  if (resource === "rate-rules") {
    return { items: shippingConfiguration.rateRules, idKey: "shippingRateRuleId" };
  }

  return null;
}

async function startBffMock() {
  bffPort = await freePort();
  bffServer = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${bffPort}`);
    if (request.method === "GET" && url.pathname.startsWith("/api/v1/admin/after-sales/")) {
      const fixtureCase = { caseId: "case-tabs-1", caseReference: "ASC-PRUEBA", status: "UNDER_REVIEW", lifecycleStatus: "IN_PROGRESS", caseType: "RETURN", createdAt: "2026-11-16T08:00:00Z", items: [{caseItemId:"item-1",name:"Producto de prueba",quantityRequested:1}] };
      if (url.pathname.endsWith("/tasks/summary")) sendJson(response, 200, {pendingCount:1,openCount:1,assignedCount:0});
      else if (url.pathname.endsWith("/tasks")) sendJson(response, 200, {items:[{taskId:"task-tabs-1",caseId:"case-tabs-1",taskType:"CUSTOMER_MESSAGE",status:"OPEN",priority:"NORMAL",lastActivityAt:"2026-11-16T08:00:00Z"}],total:1,limit:20,offset:0});
      else if (url.pathname.endsWith("/cases")) sendJson(response, 200, {items:[fixtureCase],total:1,limit:25,offset:0});
      else if (url.pathname.endsWith("/cases/case-tabs-1")) sendJson(response, 200, fixtureCase);
      else if (url.pathname.endsWith("/health")) sendJson(response, 200, {status:"ok"});
      else { sendJson(response, 404, {message:"Not found"}); }
      return;
    }
    if(await catalogRetirementFixture(request,response,url))return;
    if(catalogRetirementScenario&&url.pathname===`/api/v1/admin/products/${retirementProductId}/editor-state`){(response as ServerResponse&{retirementEditor?:boolean}).retirementEditor=true;url.pathname='/api/v1/admin/products/product-edit-1/editor-state';}

    if(request.method==='GET'&&url.pathname==='/api/v1/admin/analytics/reports/summary'){sendJson(response,200,{totalEvents:0,uniqueVisitors:0,eventsByType:{}});return;}
    const monitoredHealth = url.pathname.match(/^\/api\/v1\/admin\/(analytics|automation|communications|after-sales|search)\/health$/)?.[1];
    if(request.method==='GET' && monitoredHealth){
      if(dashboardHealthScenario==='invalid'){sendJson(response,200,{});return;}
      if(dashboardHealthScenario==='mixed'){
        if(monitoredHealth==='analytics'){sendJson(response,200,{status:'error',error:'internal-secret-stack-marker'});return;}
        if(monitoredHealth==='automation'){sendJson(response,200,{status:'ok',readiness:{ready:false}});return;}
        if(monitoredHealth==='communications'){sendJson(response,503,{message:'internal-secret-stack-marker'});return;}
        if(monitoredHealth==='search'){sendJson(response,200,{provider:'vertex',catalog:'configured'});return;}
      }
      sendJson(response,200,monitoredHealth==='communications' ? {status:'ok',service:'communications',channels:{email:{status:'enabled',provider:'stub',fromConfigured:true,apiKeyConfigured:false}}} : {status:'ok'});return;
    }

    if(request.method==='GET'&&url.pathname==='/api/v1/auth/me'&&authMeFailuresRemaining>0){authMeFailuresRemaining--;sendJson(response,401,{message:'expired'});return;}
    if(request.method==='POST'&&url.pathname==='/api/v1/auth/refresh'){sessionRefreshCalls++;sendJson(response,200,{tokens:{accessToken:'access-token',refreshToken:'rotated-refresh',expiresInSeconds:900}});return;}
    if(request.method==='GET'&&url.pathname.startsWith('/api/v1/admin/employees')){
      if(url.pathname.endsWith('/profiles'))sendJson(response,200,{items:[{profileId:'profile-read',name:'Lectura',active:true,permissions:['employees.read']}]});
      else if(url.pathname.endsWith('/permissions/catalog'))sendJson(response,200,{items:[{permission:'employees.manage',description:'Gestionar empleados'}]});
      else if(url.pathname.endsWith('/health'))sendJson(response,200,{status:'ok'});
      else sendJson(response,200,{items:[{employeeId:'employee-read',email:'viewer@example.test',firstName:'Viewer',status:'ACTIVE',profileIds:['profile-read'],shopScopes:[{organizationId:defaultOrganizationId,shopId:barcelonaShopId}]}]});
      return;
    }

    const creationRoutes = ['/api/v1/admin/categories','/api/v1/admin/brands','/api/v1/admin/payments/payment-systems','/api/v1/admin/payments/affiliations','/api/v1/admin/payments/rules'];
    if(request.method==='POST' && creationRoutes.includes(url.pathname)){
      const body=await readJsonBody(request) as Record<string,unknown>;
      configurationCreates.push({path:url.pathname,body});
      if(rejectConfigurationCreate){sendJson(response,409,{message:'Conflict'});return;}
      if(url.pathname.endsWith('/categories')){expect(body.description).toBeTruthy();expect(body.title).toBeTruthy();sendJson(response,201,{...body,categoryId:'created-category'});}
      else if(url.pathname.endsWith('/brands')){expect(body.text).toBeTruthy();expect(body.siteTitle).toBeTruthy();expect(body.slug).toBeUndefined();sendJson(response,201,{...body,brandId:'created-brand'});}
      else {expect(body.provider).toBeUndefined();expect(body.groupName).toBeUndefined();expect(body.methodType).toBeUndefined();sendJson(response,201,body);}
      return;
    }
    if(request.method==='GET' && url.pathname.startsWith('/api/v1/admin/payments/')){
      if(url.pathname.endsWith('/payment-systems'))sendJson(response,200,{items:[{paymentSystemId:'card',name:'Tarjeta',group:'cards',type:'credit-card',active:false}]});
      else if(url.pathname.endsWith('/affiliations'))sendJson(response,200,{items:[{affiliationId:'psp',name:'Proveedor',providerName:'stripe',merchantId:'test',active:false}]});
      else if(url.pathname.endsWith('/rules'))sendJson(response,200,{items:[]});
      else sendJson(response,404,{message:'Not found'});
      return;
    }

    if (url.pathname === `/api/v1/admin/organizations-shops/shops/${barcelonaShopId}/read-preparation`) {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      if (request.method === "POST") {
        let raw = "";
        for await (const chunk of request) raw += String(chunk);
        capturedPreparationRetries.push(JSON.parse(raw));
        shopPreparationState = "RUNNING";
        shopPreparationPolls = 0;
      } else if (shopPreparationState === "RUNNING" && ++shopPreparationPolls >= 2) {
        shopPreparationState = "READY";
      }
      sendJson(response, request.method === "POST" ? 201 : 200, {
        requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        organizationId: defaultOrganizationId, shopId: barcelonaShopId,
        state: shopPreparationState, phase: shopPreparationState === "READY" ? "VERIFY" : "SNAPSHOT",
        attempts: 1, updatedAt: new Date().toISOString(),
        code: shopPreparationState === "FAILED" ? "PREPARATION_SOURCE_FAILED" : null,
        context: {locale:"es-ES",currency:"EUR",country:"ES",channel:"web"},
      });
      return;
    }

    capturedBffRequests.push(`${request.method ?? "GET"} ${url.pathname}`);

    if (
      url.pathname.startsWith("/api/v1/admin/") &&
      request.headers.authorization !== "Bearer server-admin-token" &&
      request.headers.authorization !== "Bearer access-token"
    ) {
      sendJson(response, 401, { message: "authorization header is required" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/context/available") {
      sendJson(response, 200, {
        tenantAccess: {
          level: "SHOP",
          shopScopes: [
            { organizationId: defaultOrganizationId, shopId: barcelonaShopId },
          ],
        },
        organizations: [{
          organizationId: defaultOrganizationId,
          name: "Ecommium Default Organization",
        }],
        shops: [
          {
            shopId: barcelonaShopId,
            organizationId: defaultOrganizationId,
            organizationName: "Ecommium Default Organization",
            shopName: "Tienda Barcelona",
            shopAlias: "tienda-barcelona",
            primaryDomain: "barcelona.local",
            status: "ACTIVE",
            effectiveSettings: {
              defaultLocale: "es-ES",
              defaultCurrency: "EUR",
              defaultCountry: "ES",
            },
          },
        ],
        selectionRequired: false,
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/organizations-shops/organizations") {
      sendJson(response, 200, {
        items: [{
          organizationId: defaultOrganizationId,
          name: "Ecommium Default Organization",
        }],
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/organizations-shops/shop-groups") {
      sendJson(response, 200, { items: [] });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/organizations-shops/shops") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      sendJson(response, 200, {
        items: [
          {
            shopId: barcelonaShopId,
            organizationId: defaultOrganizationId,
            name: "Tienda Barcelona",
            shopAlias: "tienda-barcelona",
            primaryDomain: "barcelona.local",
            status: "ACTIVE",
          },
        ],
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/organizations-shops/shops/context/resolve") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      const shopAlias = url.searchParams.get("shopAlias");
      sendJson(response, 200, {
        shopId: barcelonaShopId,
        organizationId: defaultOrganizationId,
        name: "Tienda Barcelona",
        shopAlias,
        status: "ACTIVE",
        effectiveSettings: {
          defaultLocale: "es-ES",
          defaultCurrency: "EUR",
          defaultCountry: "ES",
        },
      });
      return;
    }

    if (url.pathname === "/api/v1/admin/categories/category-bikes" && ["PATCH","DELETE"].includes(request.method ?? "")) {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const body=request.method === "PATCH" ? await readJsonBody(request) as Record<string,unknown> : {};
      categoryMutations.push({method:request.method!,mode:url.searchParams.get("mode"),body});
      if(request.method === "PATCH") categoryRow={...categoryRow,name:String(body.name),isActive:body.isActive===true};
      else if(url.searchParams.get("mode")==="soft") categoryRow={...categoryRow,isActive:false};
      else categoryRemoved=true;
      sendJson(response,200,request.method === "PATCH" ? categoryRow : {deleted:true});
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/admin/categories") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const q=url.searchParams.get("q")?.toLowerCase() ?? "";
      const active=url.searchParams.get("isActive");
      const items=!categoryRemoved && categoryRow.name.toLowerCase().includes(q) && (active===null || categoryRow.isActive===(active==="true")) ? [categoryRow] : [];
      sendJson(response, 200, {items,total:items.length});
      return;
    }

    if (url.pathname === "/api/v1/admin/brands/brand-demo" && ["PATCH","DELETE"].includes(request.method ?? "")) {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const body=request.method === "PATCH" ? await readJsonBody(request) as Record<string,unknown> : {};
      brandMutations.push({method:request.method!,mode:url.searchParams.get("mode"),body});
      if(request.method === "PATCH") brandRow={...brandRow,name:String(body.name),isActive:body.isActive===true};
      else if(url.searchParams.get("mode")==="soft") brandRow={...brandRow,isActive:false};
      else brandRemoved=true;
      sendJson(response,200,request.method === "PATCH" ? brandRow : {deleted:true});
      return;
    }
    if (controlledBrandLookup && request.method === "GET" && url.pathname === "/api/v1/admin/brands/brand-late") {
      sendJson(response,200,{brandId:"brand-late",name:"Marca 150",isActive:true}); return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/admin/brands") {
      if (controlledBrandLookup) {
        const all = Array.from({length:151}, (_,index)=>({brandId:index===150?"brand-late":`brand-${index}`,name:`Marca ${index}`,isActive:true}));
        const query = url.searchParams.get("q")?.toLowerCase() ?? "";
        const items=all.filter(item=>item.name.toLowerCase().includes(query));
        const offset=Number(url.searchParams.get("offset")??0),limit=Number(url.searchParams.get("limit")??100);
        sendJson(response,200,{items:items.slice(offset,offset+limit),total:items.length,offset,limit}); return;
      }
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const q=url.searchParams.get("q")?.toLowerCase() ?? "";
      const active=url.searchParams.get("isActive");
      const items=!brandRemoved && brandRow.name.toLowerCase().includes(q) && (active===null || brandRow.isActive===(active==="true")) ? [brandRow] : [];
      sendJson(response, 200, {items,total:items.length});
      return;
    }

    if (commercialScenario && url.pathname === "/api/v1/admin/customers/commercial-segment-policy") {
      if (request.method === "PUT") {const body=await readJsonBody(request);expect(body.expectedRevision).toBe(commercialPolicy.revision);commercialPolicy={policy:body.policy as typeof commercialPolicy.policy,revision:commercialPolicy.revision+1};}
      sendJson(response,200,commercialPolicy);return;
    }
    if (commercialScenario && url.pathname.endsWith("/commercial-membership/history")) {
      expect(request.headers.authorization).toBe("Bearer access-token");expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const limit=Number(url.searchParams.get("limit")??20),offset=Number(url.searchParams.get("offset")??0);
      sendJson(response,200,{items:commercialAudit.slice(offset,offset+limit),total:commercialAudit.length,limit,offset});return;
    }
    if (commercialScenario && (url.pathname === "/api/v1/admin/pricing/customer-groups" || url.pathname.endsWith("/commercial-membership"))) {
      expect(request.headers.authorization).toBe("Bearer access-token");
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const groups = url.pathname.endsWith("customer-groups");
      sendJson(response, groups ? commercialGroupsStatus : commercialMembershipStatus, groups ? {items:commercialGroups} : commercialInvalidSnapshot ? {} : commercialMembership);
      return;
    }
    if (commercialScenario && ["POST","PATCH"].includes(request.method ?? "") && ["/api/v1/admin/customers", "/api/v1/admin/customers/customer-playwright"].includes(url.pathname)) {
      expect(request.headers.authorization).toBe("Bearer access-token");
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const body = await readJsonBody(request);
      if (body.commercialMembership && body.currentPassword !== "commercial-qa-password") {sendJson(response,403,{message:"Commercial password confirmation failed"});return;}
      const { currentPassword: _secret, ...safeBody } = body;
      void _secret;
      commercialProfileWrites.push(safeBody);
      if (commercialConflict) {sendJson(response,409,{message:"internal-database-trace"});return;}
      const membership = body.commercialMembership as {groupCode:string|null,b2bApproved:boolean,expectedRevision:number}|undefined;
      if (membership) {
        expect(membership.expectedRevision).toBe(commercialMembership.revision);
        const before = commercialMembership.revision ? {groupCode:commercialMembership.groupCode,b2bApproved:commercialMembership.b2bApproved,revision:commercialMembership.revision} : null;
        commercialAudit.unshift({auditId:String(commercialMembership.revision+1),revision:commercialMembership.revision+1,actorId:"employee-1",reason:String((membership as typeof membership & {reason?:string}).reason??"QA"),occurredAt:new Date().toISOString(),before,after:{groupCode:membership.groupCode,b2bApproved:membership.b2bApproved,revision:commercialMembership.revision+1}});
        commercialMembership = {...commercialMembership,groupCode:membership.groupCode,b2bApproved:membership.b2bApproved,buyerType:String(body.buyerType),revision:commercialMembership.revision+1};
      }
      sendJson(response,200,{customerId:"customer-playwright"});return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/customers") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      capturedCustomersAdminRequests.push(`${request.method} ${url.pathname}?${url.searchParams.toString()}`);
      sendJson(response, 200, {
        items: [{
          customerId: "customer-playwright",
          customerReference: "C000001",
          organizationId: defaultOrganizationId,
          shopId: barcelonaShopId,
          email: "ada@example.com",
          firstName: "Ada",
          lastName: "Lovelace",
          documentNumber: "DOC-ADA",
          phone: "+34910000000",
          buyerType: "PRIVATE_BUYER",
          clientPreferencesData: {
            locale: "es-ES",
            optinNewsLetter: true,
          },
          defaultShippingAddress: {
            addressId: "address-playwright",
            city: "Madrid",
          },
          defaultBillingAddress: {
            addressId: "address-playwright",
            city: "Madrid",
          },
          isGuest: false,
          createdAt: "2026-07-01T10:00:00.000Z",
        }],
        total: 1,
        limit: Number(url.searchParams.get("limit") ?? 20),
        offset: Number(url.searchParams.get("offset") ?? 0),
      });
      return;
    }

    if (request.method === "GET" && (url.pathname === "/api/v1/admin/customers/customer-playwright" || url.pathname === "/api/v1/admin/customers/by-reference")) {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      capturedCustomersAdminRequests.push(`${request.method} ${url.pathname}?${url.searchParams.toString()}`);
      sendJson(response, 200, {
        customerId: "customer-playwright",
          customerReference: "C000001",
        organizationId: defaultOrganizationId,
        shopId: barcelonaShopId,
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        documentNumber: "DOC-ADA",
        phone: "+34910000000",
        buyerType: "PRIVATE_BUYER",
        clientPreferencesData: {
          locale: "es-ES",
          optinNewsLetter: true,
        },
        isGuest: false,
        createdAt: "2026-07-01T10:00:00.000Z",
        updatedAt: "2026-07-02T10:00:00.000Z",
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/customers/customer-playwright/addresses") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      capturedCustomersAdminRequests.push(`${request.method} ${url.pathname}?${url.searchParams.toString()}`);
      sendJson(response, 200, {
        customerId: "customer-playwright",
        defaultShippingAddressId: "address-playwright",
        defaultBillingAddressId: "address-playwright",
        items: [{
          addressId: "address-playwright",
          addressType: "residential",
          receiverName: "Ada Lovelace",
          addressRole: "BOTH",
          street: "Calle Mayor",
          number: "1",
          neighborhood: "Centro",
          city: "Madrid",
          state: "Madrid",
          country: "ES",
          postalCode: "28001",
          reference: "Porteria",
          isDefaultShipping: true,
          isDefaultBilling: true,
        }],
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/customers/customer-playwright/purchases") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      capturedCustomersAdminRequests.push(`${request.method} ${url.pathname}?${url.searchParams.toString()}`);
      sendJson(response, 200, {
        customerId: "customer-playwright",
        total: 1,
        limit: Number(url.searchParams.get("limit") ?? 5),
        offset: Number(url.searchParams.get("offset") ?? 0),
        items: [{
          purchaseId: "order-playwright",
          orderId: "order-playwright",
          customerId: "customer-playwright",
          status: "PAID",
          isPaid: true,
          currency: "EUR",
          totalAmountMinor: 12345,
          itemsCount: 1,
          placedAt: "2026-07-03T10:00:00.000Z",
          items: [{
            lineId: "line-playwright",
            productId: "product-playwright",
            productSlug: "pastillas-freno",
            productUrlPath: "/pdp/pastillas-freno",
            name: "Pastillas freno",
            quantity: 2,
            lineTotalMinor: 12345,
          }],
        }],
      });
      return;
    }

    if(url.pathname==="/api/v1/admin/specifications/field-delete-capability"){sendJson(response,200,{available:deletionAvailable});return;}
    const deletionMatch=url.pathname.match(/^\/api\/v1\/admin\/specifications\/groups\/44444444-4444-4444-8444-444444444444\/fields\/55555555-5555-4555-8555-555555555555\/(deletion-impact|delete-operations)$/);
    const deletionReceipt=()=>({operationId:deletionOperationId,groupId:lifecycleGroupId,fieldId:lifecycleFieldId,name:"Material seguro",affectedProducts:deletionProducts,affectedCategories:2,scopes:[{organizationId:defaultOrganizationId,shopId:barcelonaShopId}],deleted:true,createdAt:"2026-11-07T12:00:00Z",cacheInvalidationPending:false});
    if(deletionMatch){
      await new Promise(resolve=>setTimeout(resolve,400));
      if(request.method==="GET"){sendJson(response,200,{groupId:lifecycleGroupId,fieldId:lifecycleFieldId,name:"Material seguro",isActive:true,version:lifecycleVersion,affectedProducts:deletionProducts,affectedCategories:2,affectedShops:1,scopes:[{organizationId:defaultOrganizationId,shopId:barcelonaShopId}],preservesAssignments:false,action:"DELETE"});return;}
      const body=await readJsonBody(request);expect(Object.keys(body).sort()).toEqual(["confirmationName","expectedVersion","operationId"]);deletionMutations++;
      if(lifecycleConflict){sendJson(response,409,{message:"stale"});return;}
      if(deletionProducts>0)expect(body.confirmationName).toBe("Material seguro");expect(body.expectedVersion).toBe(lifecycleVersion);deletionOperationId=String(body.operationId);
      sendJson(response,deletionLostResponse?503:200,deletionLostResponse?{message:"lost confirmation"}:deletionReceipt());return;
    }
    const deletionStatusMatch=url.pathname.match(/^\/api\/v1\/admin\/specifications\/field-delete-operations\/([^/]+)(\/retry)?$/);
    if(deletionStatusMatch){
      if(deletionStatusMatch[1]!==deletionOperationId){sendJson(response,404,{message:"not found"});return;}
      if(request.method==="POST"){expect(await readJsonBody(request)).toEqual({});deletionRetries++;sendJson(response,200,deletionReceipt());return;}
      sendJson(response,200,{...deletionReceipt(),completedShops:deletionProjected?1:0,totalShops:1,remainingProducts:deletionProjected?0:deletionProducts,remainingDefinitions:deletionProjected?0:1,unavailableShops:0,complete:deletionProjected});return;
    }
    const lifecycleMatch=url.pathname.match(/^\/api\/v1\/admin\/specifications\/groups\/44444444-4444-4444-8444-444444444444\/fields\/55555555-5555-4555-8555-555555555555\/(deactivation-impact|deactivate)$/);
    if(lifecycleMatch){
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      await new Promise(resolve=>setTimeout(resolve,400));
      if(request.method==="POST") {lifecycleMutations++;const body=await readJsonBody(request);expect(Object.keys(body)).toEqual(["expectedVersion"]);if(lifecycleConflict){lifecycleVersion="b".repeat(64);sendJson(response,409,{message:"stale"});return;}expect(body.expectedVersion).toBe(lifecycleVersion);lifecycleInactive=true;if(lifecycleLostResponse){sendJson(response,503,{message:"lost confirmation"});return;}}
      sendJson(response,200,{groupId:lifecycleGroupId,fieldId:lifecycleFieldId,name:"Material seguro",isActive:!lifecycleInactive,version:lifecycleVersion,affectedProducts:3200,affectedCategories:2,affectedShops:1,scopes:[{organizationId:defaultOrganizationId,shopId:barcelonaShopId}],preservesAssignments:true});return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/admin/specifications/groups") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      capturedCatalogSpecificationRequests.push("GET /api/v1/admin/specifications/groups");
      sendJson(response, 200, {
        items: catalogSpecificationGroups.filter(group => !delaySpecificationProjection || group.specificationGroupId !== "spec-group-playwright").map((group) => ({
          specificationGroupId: group.specificationGroupId,
          categoryId: group.categoryId,
          name: group.name,
          isActive: group.isActive,
          fieldCount: group.fields.length,
        })),
        total: catalogSpecificationGroups.length,
      });
      return;
    }

    const specificationGroupMatch = url.pathname.match(/^\/api\/v1\/admin\/specifications\/groups\/([^/]+)$/);
    if (specificationGroupMatch && request.method === "GET") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const groupId = decodeURIComponent(specificationGroupMatch[1]);
      capturedCatalogSpecificationRequests.push(`GET /api/v1/admin/specifications/groups/${groupId}`);
      const group=catalogSpecificationGroups.find((group) => group.specificationGroupId === groupId) ?? catalogSpecificationGroups[0];
      sendJson(response, 200, groupId===lifecycleGroupId ? {...group,fields:deletionProjected?[]:group.fields.map(f=>({...f,isActive:!lifecycleProjected}))} : group);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/specifications/groups") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const body = await readJsonBody(request);
      capturedCatalogSpecificationRequests.push("POST /api/v1/admin/specifications/groups");
      if (rejectSpecificationCreate) {
        sendJson(response,400,{message:"private validation details must not reach the browser"});
        return;
      }
      const fields = Array.isArray(body.fields) ? body.fields as Array<Record<string, unknown>> : [];
      const group = {
        specificationGroupId: "spec-group-playwright",
        categoryId: String(body.categoryId ?? "category-bikes"),
        name: String(body.name ?? "Playwright group"),
        isActive: true,
        fieldCount: fields.length,
        linkedCategoryIds: ["category-bikes"],
        fields: fields.map((field, index) => ({
          ...field,
          fieldId: `field-playwright-${index}`,
          specificationGroupId: "spec-group-playwright",
          values: Array.isArray(field.values)
            ? field.values.map((value, valueIndex) => ({
                ...(value as Record<string, unknown>),
                fieldValueId: `value-playwright-${valueIndex}`,
                fieldId: `field-playwright-${index}`,
              }))
            : [],
        })),
      };
      catalogSpecificationGroups.push(group as typeof catalogSpecificationGroups[number]);
      sendJson(response, 200, group);
      return;
    }

    if (specificationGroupMatch && request.method === "PATCH") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const groupId = decodeURIComponent(specificationGroupMatch[1]);
      const body = await readJsonBody(request);
      capturedCatalogSpecificationRequests.push(`PATCH /api/v1/admin/specifications/groups/${groupId}`);
      const groupIndex = catalogSpecificationGroups.findIndex((group) => group.specificationGroupId === groupId);
      const currentGroup = catalogSpecificationGroups[groupIndex] ?? catalogSpecificationGroups[0];
      const fields = Array.isArray(body.fields) ? body.fields as Array<Record<string, unknown>> : [];
      const nextGroup = {
        ...currentGroup,
        categoryId: String(body.categoryId ?? currentGroup.categoryId),
        name: String(body.name ?? currentGroup.name),
        isActive: typeof body.isActive === "boolean" ? body.isActive : currentGroup.isActive,
        fieldCount: fields.length,
        linkedCategoryIds: Array.isArray(body.linkedCategoryIds) ? body.linkedCategoryIds.map(String) : currentGroup.linkedCategoryIds,
        fields: fields.map((field, index) => {
          const existingField = currentGroup.fields.find((item) => item.fieldId === field.fieldId);
          return {
            ...existingField,
            ...field,
            fieldId: String(field.fieldId ?? existingField?.fieldId ?? `field-playwright-${index}`),
            specificationGroupId: groupId,
            values: Array.isArray(field.values)
              ? field.values.map((value, valueIndex) => ({
                  ...(value as Record<string, unknown>),
                  fieldValueId: String((value as Record<string, unknown>).fieldValueId ?? `value-playwright-${valueIndex}`),
                  fieldId: String(field.fieldId ?? existingField?.fieldId ?? `field-playwright-${index}`),
                }))
              : [],
          };
        }),
      };
      if (groupIndex >= 0) {
        catalogSpecificationGroups[groupIndex] = nextGroup as typeof catalogSpecificationGroups[number];
      }
      sendJson(response, 200, nextGroup);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/offerings") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      capturedCatalogOfferingRequests.push("GET /api/v1/admin/offerings");
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      const type = url.searchParams.get("type") ?? "";
      const includeInactive = url.searchParams.get("includeInactive") === "true";
      sendJson(response, 200, {
        offerings: catalogOfferings.filter((offering) => {
          if (!includeInactive && !offering.active) {
            return false;
          }
          if (type && offering.type !== type) {
            return false;
          }
          if (q && !offering.name.toLowerCase().includes(q) && !offering.offeringId.toLowerCase().includes(q)) {
            return false;
          }
          return true;
        }),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/offerings") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const body = await readJsonBody(request);
      capturedCatalogOfferingRequests.push("POST /api/v1/admin/offerings");
      const name = Array.isArray(body.localizedName)
        ? String((body.localizedName[0] as Record<string, unknown>)?.value ?? "Servicio Playwright")
        : "Servicio Playwright";
      const offering = {
        id: "offering-playwright",
        offeringId: "offering-playwright",
        name,
        localizedName: [{ locale: "es-ES", value: name }],
        priceMinor: Number(body.priceMinor ?? 0),
        currency: String(body.currency ?? "EUR"),
        type: String(body.type ?? "service"),
        active: body.active !== false,
        createdAt: "2026-06-29T01:00:00.000Z",
        updatedAt: "2026-06-29T01:00:00.000Z",
      };
      const existingIndex = catalogOfferings.findIndex((item) => item.offeringId === offering.offeringId);
      if (existingIndex >= 0) {
        catalogOfferings[existingIndex] = offering;
      } else {
        catalogOfferings.push(offering);
      }
      sendJson(response, 200, { offering, message: "offering created" });
      return;
    }

    const offeringMatch = url.pathname.match(/^\/api\/v1\/admin\/offerings\/([^/]+)$/);
    if (offeringMatch && request.method === "PATCH") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const body = await readJsonBody(request);
      const offeringId = decodeURIComponent(offeringMatch[1]);
      capturedCatalogOfferingRequests.push(`PATCH /api/v1/admin/offerings/${offeringId}`);
      const index = catalogOfferings.findIndex((item) => item.offeringId === offeringId);
      const current = catalogOfferings[index] ?? catalogOfferings[0];
      const name = Array.isArray(body.localizedName)
        ? String((body.localizedName[0] as Record<string, unknown>)?.value ?? current.name)
        : current.name;
      const offering = {
        ...current,
        name,
        localizedName: [{ locale: "es-ES", value: name }],
        priceMinor: Number(body.priceMinor ?? current.priceMinor),
        currency: String(body.currency ?? current.currency),
        type: String(body.type ?? current.type),
        active: typeof body.active === "boolean" ? body.active : current.active,
        updatedAt: "2026-06-29T02:00:00.000Z",
      };
      catalogOfferings[index >= 0 ? index : 0] = offering;
      sendJson(response, 200, { offering, message: "offering updated" });
      return;
    }

    if (offeringMatch && request.method === "DELETE") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const offeringId = decodeURIComponent(offeringMatch[1]);
      capturedCatalogOfferingRequests.push(`DELETE /api/v1/admin/offerings/${offeringId}`);
      const index = catalogOfferings.findIndex((item) => item.offeringId === offeringId);
      const current = catalogOfferings[index] ?? catalogOfferings[0];
      const offering = { ...current, active: false };
      catalogOfferings[index >= 0 ? index : 0] = offering;
      sendJson(response, 200, { offering, message: "offering deactivated" });
      return;
    }

    const offeringActivationMatch = url.pathname.match(/^\/api\/v1\/admin\/offerings\/([^/]+)\/variants\/([^/]+)\/activation$/);
    if (request.method === "PUT" && offeringActivationMatch) {
      const body = await readJsonBody(request);
      offeringRelationMutations += 1;
      sendJson(response, 200, { offeringId: offeringActivationMatch[1], variantId: offeringActivationMatch[2], active: body.active, updated: true, message: "offering relation deactivated", offerings: catalogOfferings.filter(offering => (catalogOfferingsByVariant[offeringActivationMatch[2]] ?? []).includes(offering.offeringId)).map(offering => ({...offering, relationActive: offering.offeringId === offeringActivationMatch[1] ? body.active : true})) });
      return;
    }
    const offeringVariantMatch = url.pathname.match(/^\/api\/v1\/admin\/offerings\/([^/]+)\/variants\/([^/]+)$/);
    if (offeringVariantMatch && request.method === "PUT") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const offeringId = decodeURIComponent(offeringVariantMatch[1]);
      const variantId = decodeURIComponent(offeringVariantMatch[2]);
      capturedCatalogOfferingRequests.push(`PUT /api/v1/admin/offerings/${offeringId}/variants/${variantId}`);
      catalogOfferingsByVariant[variantId] = Array.from(new Set([
        ...(catalogOfferingsByVariant[variantId] ?? []),
        offeringId,
      ]));
      sendJson(response, 200, { offeringId, variantId, message: "offering attached to variant", offerings: catalogOfferings.filter((offering) => catalogOfferingsByVariant[variantId].includes(offering.offeringId)) });
      return;
    }

    if (offeringVariantMatch && request.method === "DELETE") {
      const [, offeringId, variantId] = offeringVariantMatch;
      offeringRelationMutations += 1;
      catalogOfferingsByVariant[variantId] = (catalogOfferingsByVariant[variantId] ?? []).filter((id) => id !== offeringId);
      sendJson(response, 200, { offeringId, variantId, detached: true, message: "offering detached from variant", offerings: catalogOfferings.filter(offering => (catalogOfferingsByVariant[variantId] ?? []).includes(offering.offeringId)) });
      return;
    }

    const offeringByVariantMatch = url.pathname.match(/^\/api\/v1\/admin\/offerings\/variants\/([^/]+)$/);
    if (offeringByVariantMatch && request.method === "GET") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const variantId = decodeURIComponent(offeringByVariantMatch[1]);
      capturedCatalogOfferingRequests.push(`GET /api/v1/admin/offerings/variants/${variantId}`);
      const offeringIds = catalogOfferingsByVariant[variantId] ?? [];
      sendJson(response, 200, {
        variantId,
        offerings: catalogOfferings.filter((offering) => offeringIds.includes(offering.offeringId)),
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/communications/settings/email-provider") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      capturedCommunicationsAdminRequests.push(`${request.method} ${url.pathname}`);
      sendJson(response, 200, emailProviderSettings);
      return;
    }

    if (request.method === "PATCH" && url.pathname === "/api/v1/admin/communications/settings/email-provider") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const body = await readJsonBody(request);
      capturedCommunicationsAdminRequests.push(`${request.method} ${url.pathname}`);
      capturedCommunicationsMutations.push({ method: request.method, path: url.pathname, body });
      emailProviderSettings.provider = String(body.provider ?? emailProviderSettings.provider);
      emailProviderSettings.active = body.active === true;
      emailProviderSettings.fromEmail = typeof body.fromEmail === "string" ? body.fromEmail : null;
      emailProviderSettings.replyToEmail = typeof body.replyToEmail === "string" ? body.replyToEmail : null;
      emailProviderSettings.smtpHost = typeof body.smtpHost === "string" ? body.smtpHost : null;
      emailProviderSettings.smtpPort = typeof body.smtpPort === "number" ? body.smtpPort : null;
      emailProviderSettings.smtpSecure = body.smtpSecure === true;
      emailProviderSettings.smtpUser = typeof body.smtpUser === "string" ? body.smtpUser : null;
      emailProviderSettings.secretConfigured = typeof body.secret === "string" && body.secret.length > 0
        ? true
        : body.clearSecret === true
          ? false
          : emailProviderSettings.secretConfigured;
      emailProviderSettings.secretUpdatedAt = emailProviderSettings.secretConfigured ? "2026-07-07T10:00:00.000Z" : null;
      emailProviderSettings.updatedAt = "2026-07-07T10:00:00.000Z";
      sendJson(response, 200, emailProviderSettings);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/communications/templates/email") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      expect(url.searchParams.get("locale") ?? request.headers["x-locale"]).toBe("es-ES");
      capturedCommunicationsAdminRequests.push(`${request.method} ${url.pathname}`);
      const status = url.searchParams.get("status");
      const limit = Number(url.searchParams.get("limit") ?? 20);
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const items = authEmailTemplates.filter((template) => !status || template.status === status);
      sendJson(response, 200, {
        items: items.slice(offset, offset + limit),
        total: items.length,
        limit,
        offset,
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/communications/templates/email") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const body = await readJsonBody(request);
      const template = {
        templateId: `template-${String(body.templateKey).replace(/[^a-z0-9]+/gi, "-")}`,
        templateKey: String(body.templateKey),
        channel: "EMAIL",
        locale: String(body.locale),
        subjectTemplate: typeof body.subjectTemplate === "string" ? body.subjectTemplate : null,
        htmlTemplate: typeof body.htmlTemplate === "string" ? body.htmlTemplate : null,
        textTemplate: typeof body.textTemplate === "string" ? body.textTemplate : null,
        status: "DRAFT",
        requiredVariables: Array.isArray(body.requiredVariables) ? body.requiredVariables : [],
        previewData: body.previewData ?? {},
        version: 1,
        createdAt: "2026-07-18T12:00:00.000Z",
        updatedAt: "2026-07-18T12:00:00.000Z",
        activatedAt: null,
        archivedAt: null,
      };
      capturedCommunicationsAdminRequests.push(`${request.method} ${url.pathname}`);
      capturedCommunicationsMutations.push({ method: request.method, path: url.pathname, body });
      authEmailTemplates = [...authEmailTemplates, template];
      sendJson(response, 201, template);
      return;
    }

    const emailTemplatePreviewMatch = url.pathname.match(/^\/api\/v1\/admin\/communications\/templates\/email\/([^/]+)\/preview$/);
    if (request.method === "POST" && emailTemplatePreviewMatch) {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const templateId = decodeURIComponent(emailTemplatePreviewMatch[1]);
      const template = authEmailTemplates.find((item) => item.templateId === templateId);
      const body = await readJsonBody(request);
      capturedCommunicationsAdminRequests.push(`${request.method} ${url.pathname}`);
      capturedCommunicationsMutations.push({ method: request.method, path: url.pathname, body });
      if (!template) {
        sendJson(response, 404, { message: "Plantilla no encontrada" });
        return;
      }
      sendJson(response, 200, {
        templateId,
        templateKey: template.templateKey,
        locale: template.locale,
        status: template.status,
        rendered: {
          subject: template.subjectTemplate ?? "Sin asunto",
          html: template.htmlTemplate ?? "<p>Sin HTML</p>",
          text: template.textTemplate ?? "Sin texto",
        },
        readiness: { previewStatus: "READY", issues: [], variables: [] },
        usedVariables: Object.keys((body.data ?? {}) as Record<string, unknown>),
      });
      return;
    }

    const emailTemplateTransitionMatch = url.pathname.match(/^\/api\/v1\/admin\/communications\/templates\/email\/([^/]+)\/(activate|deactivate|archive)$/);
    if (request.method === "POST" && emailTemplateTransitionMatch) {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const templateId = decodeURIComponent(emailTemplateTransitionMatch[1]);
      const transition = emailTemplateTransitionMatch[2];
      const current = authEmailTemplates.find((item) => item.templateId === templateId);
      capturedCommunicationsAdminRequests.push(`${request.method} ${url.pathname}`);
      capturedCommunicationsMutations.push({ method: request.method, path: url.pathname, body: await readJsonBody(request) });
      if (!current) {
        sendJson(response, 404, { message: "Plantilla no encontrada" });
        return;
      }
      const next = {
        ...current,
        status: transition === "activate" ? "ACTIVE" : transition === "deactivate" ? "DRAFT" : "ARCHIVED",
        activatedAt: transition === "activate" ? "2026-07-18T12:05:00.000Z" : current.activatedAt ?? null,
        archivedAt: transition === "archive" ? "2026-07-18T12:05:00.000Z" : current.archivedAt ?? null,
        updatedAt: "2026-07-18T12:05:00.000Z",
      };
      authEmailTemplates = authEmailTemplates.map((item) => item.templateId === templateId ? next : item);
      sendJson(response, 200, next);
      return;
    }

    const emailTemplateMatch = url.pathname.match(/^\/api\/v1\/admin\/communications\/templates\/email\/([^/]+)$/);
    if (request.method === "PATCH" && emailTemplateMatch) {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const templateId = decodeURIComponent(emailTemplateMatch[1]);
      const current = authEmailTemplates.find((item) => item.templateId === templateId);
      const body = await readJsonBody(request);
      capturedCommunicationsAdminRequests.push(`${request.method} ${url.pathname}`);
      capturedCommunicationsMutations.push({ method: request.method, path: url.pathname, body });
      if (!current) {
        sendJson(response, 404, { message: "Plantilla no encontrada" });
        return;
      }
      const next = {
        ...current,
        ...body,
        status: "DRAFT",
        version: Number(current.version ?? 0) + 1,
        updatedAt: "2026-07-18T12:04:00.000Z",
      };
      authEmailTemplates = authEmailTemplates.map((item) => item.templateId === templateId ? next : item);
      sendJson(response, 200, next);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/communications/deliveries") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      capturedCommunicationsAdminRequests.push(`${request.method} ${url.pathname}`);
      const status = url.searchParams.get("status");
      const templateKey = url.searchParams.get("templateKey");
      const sourceEventId = url.searchParams.get("sourceEventId");
      const customerId = url.searchParams.get("customerId");
      const items = communicationsDeliveries.filter((delivery) => (
        (!status || delivery.status === status)
        && (!templateKey || delivery.templateKey === templateKey)
        && (!sourceEventId || delivery.sourceEventId === sourceEventId)
        && (!customerId || delivery.recipient.customerId === customerId)
      ));
      const limit = Number(url.searchParams.get("limit") ?? 20);
      const offset = Number(url.searchParams.get("offset") ?? 0);
      sendJson(response, 200, {
        items: items.slice(offset, offset + limit),
        total: items.length,
        limit,
        offset,
      });
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/v1/admin/communications/deliveries/")) {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const deliveryId = decodeURIComponent(url.pathname.slice("/api/v1/admin/communications/deliveries/".length));
      const delivery = communicationsDeliveries.find((item) => item.deliveryId === deliveryId);
      capturedCommunicationsAdminRequests.push(`${request.method} ${url.pathname}`);
      if (!delivery) {
        sendJson(response, 404, { message: "Delivery no encontrada" });
        return;
      }
      sendJson(response, 200, delivery);
      return;
    }

    if (request.method === "POST" && url.pathname.startsWith("/api/v1/admin/communications/deliveries/") && url.pathname.endsWith("/retry")) {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const deliveryId = decodeURIComponent(url.pathname.slice("/api/v1/admin/communications/deliveries/".length, -"/retry".length));
      const current = communicationsDeliveries.find((item) => item.deliveryId === deliveryId);
      capturedCommunicationsAdminRequests.push(`${request.method} ${url.pathname}`);
      capturedCommunicationsMutations.push({ method: request.method, path: url.pathname, body: await readJsonBody(request) });
      if (!current) {
        sendJson(response, 404, { message: "Delivery no encontrada" });
        return;
      }
      const retriedAt = "2026-07-16T12:05:00.000Z";
      const retried = {
        ...current,
        status: "SENT",
        errorMessage: null,
        sentAt: retriedAt,
        failedAt: current.failedAt,
        updatedAt: retriedAt,
        attempts: [...current.attempts, {
          attemptId: "attempt-sent-2",
          provider: "smtp",
          status: "SENT",
          providerMessageId: "smtp-message-2",
          errorMessage: null,
          occurredAt: retriedAt,
        }],
      };
      communicationsDeliveries = communicationsDeliveries.map((item) => item.deliveryId === deliveryId ? retried : item);
      sendJson(response, 200, retried);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/communications/templates/email/auth-defaults") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const body = await readJsonBody(request);
      capturedCommunicationsAdminRequests.push(`${request.method} ${url.pathname}`);
      capturedCommunicationsMutations.push({ method: request.method, path: url.pathname, body });
      authEmailTemplates = [
        "customer.account.activation",
        "customer.account.activation.reminder",
        "customer.account.activation.expiring",
        "customer.account.password-reset",
        "customer.account.password-changed",
      ].map((templateKey, index) => ({
        templateId: `template-auth-${index + 1}`,
        templateKey,
        locale: String(body.locale ?? "es-ES"),
        subjectTemplate: `Auth ${index + 1}`,
        status: "ACTIVE",
        requiredVariables: [],
        version: 1,
        updatedAt: "2026-07-07T10:00:00.000Z",
        activatedAt: "2026-07-07T10:00:00.000Z",
      }));
      sendJson(response, 200, { locale: body.locale ?? "es-ES", created: 4, updated: body.overwrite ? 1 : 0, existing: body.overwrite ? 0 : 1 });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/communications/email/send") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const body = await readJsonBody(request);
      capturedCommunicationsAdminRequests.push(`${request.method} ${url.pathname}`);
      capturedCommunicationsMutations.push({ method: request.method, path: url.pathname, body });
      sendJson(response, 200, {
        deliveryId: "delivery-email-test",
        organizationId: defaultOrganizationId,
        shopId: barcelonaShopId,
        templateKey: body.templateKey ?? "customer.account.activation",
        templateId: "template-activation",
        channel: "EMAIL",
        locale: body.locale ?? "es-ES",
        recipient: body.recipient ?? {},
        data: body.data ?? {},
        attachments: [],
        idempotencyKey: body.idempotencyKey ?? "admin-communications-test",
        sourceEventId: body.sourceEventId ?? null,
        renderedSnapshot: {
          subject: "Activa tu cuenta",
          html: "<p>Prueba</p>",
          text: "Prueba",
        },
        status: "SENT",
        attempts: [{
          attemptId: "attempt-email-test",
          provider: emailProviderSettings.provider,
          status: "SENT",
          providerMessageId: "provider-email-test",
          occurredAt: "2026-07-07T10:05:00.000Z",
        }],
        errorMessage: null,
        createdAt: "2026-07-07T10:05:00.000Z",
        updatedAt: "2026-07-07T10:05:00.000Z",
        sentAt: "2026-07-07T10:05:00.000Z",
        failedAt: null,
        skippedAt: null,
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/pricing/taxes") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      if(controlledTaxOutage){sendJson(response,503,{message:"Pricing unavailable"});return;}
      sendJson(response, 200, { items: pricingTaxes });
      return;
    }

    const reviewed=url.pathname.match(/^\/api\/v1\/admin\/pricing\/(taxes|price-tables)\/([^/]+)\/removal-(review|confirm|status)$/);
    if(reviewed&&request.method==='POST'){
      assertPricingTenant(url);const body=await readJsonBody(request),kind=reviewed[1],code=decodeURIComponent(reviewed[2]),target=body.replacementCode;
      if(reviewed[3]==='status'){sendJson(response,200,{reviewed:true,deleted:true,kind,replacementCode:target,readStatus:'COMPLETE',contexts:1,impactVersion:body.impactVersion,code,mode:'hard',affectedPrices:2,remainingAssignments:0});return;}
      const options=(kind==='taxes'?pricingTaxes.map(t=>({code:t.taxCode,name:t.name})):pricingPriceTables.map(t=>({code:t.priceTableId,name:t.name}))).filter(t=>t.code!==code);
      if(reviewed[3]==='review'){sendJson(response,200,{impactVersion:'a'.repeat(64),affectedPrices:2,canConfirm:typeof target==='string'&&options.some(t=>t.code===target),blockers:target?[]:['REPLACEMENT_REQUIRED'],options,rows:[]});return;}
      if(body.impactVersion!=='a'.repeat(64)||!options.some(t=>t.code===target)){sendJson(response,409,{message:'stale review'});return;}
      capturedPricingMutations.push({method:'POST',path:url.pathname,body});
      if(kind==='taxes'){const index=pricingTaxes.findIndex(t=>t.taxCode===code);if(index>=0)pricingTaxes.splice(index,1);}else{const index=pricingPriceTables.findIndex(t=>t.priceTableId===code);if(index>=0)pricingPriceTables.splice(index,1);}
      sendJson(response,200,{reviewed:true,deleted:true,kind,replacementCode:target,readStatus:'PENDING',impactVersion:body.impactVersion,code,mode:'hard',affectedPrices:2,remainingAssignments:0});return;
    }

    if (request.method === "DELETE" && /^\/api\/v1\/admin\/pricing\/taxes\/[^/]+(?:\/permanent)?$/.test(url.pathname)) {
      assertPricingTenant(url);
      const permanent = url.pathname.endsWith("/permanent");
      const code = decodeURIComponent(url.pathname.split("/").at(permanent ? -2 : -1)!);
      capturedPricingMutations.push({method:"DELETE",path:url.pathname,body:{detachPrices:url.searchParams.get("detachPrices")}});
      const index = pricingTaxes.findIndex(tax => tax.taxCode === code);
      if (permanent && url.searchParams.get("detachPrices") !== "true") { sendJson(response,400,{message:"Acknowledgement required"}); return; }
      if (index >= 0) {
        if (permanent) pricingTaxes.splice(index,1);
        else pricingTaxes[index] = {...pricingTaxes[index],isActive:false};
      }
      sendJson(response,200,permanent ? {mode:"hard",deleted:index>=0,code,detachedPrices:2,remainingAssignments:0} : {deleted:index>=0,code});
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/prices") {
      const body = await readJsonBody(request);
      capturedPricingMutations.push({ method: "POST", path: url.pathname, body });
      sendJson(response, 201, { ...body, pricingId: "conditional-price-qa" });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/pricing/taxes") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      const body = await readJsonBody(request);
      capturedPricingMutations.push({ method: "POST", path: url.pathname, body });
      const taxCode = typeof body.code === "string" ? body.code : "tax-playwright";
      const next = {
        taxId: `tax-${taxCode}`,
        taxCode,
        name: typeof body.name === "string" ? body.name : taxCode,
        calculationType: typeof body.calculationType === "string" ? body.calculationType : "PERCENTAGE",
        rate: typeof body.rate === "number" ? body.rate : null,
        country: typeof body.country === "string" ? body.country : "ES",
        isActive: body.active !== false,
      };
      const index = pricingTaxes.findIndex((item) => item.taxCode === taxCode);
      if (index >= 0) {
        pricingTaxes[index] = next;
      } else {
        pricingTaxes.push(next);
      }
      sendJson(response, 200, next);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/pricing/price-tables") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      sendJson(response, 200, { items: pricingPriceTables });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/pricing/price-tables") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      const body = await readJsonBody(request);
      capturedPricingMutations.push({ method: "POST", path: url.pathname, body });
      const priceTableId = typeof body.code === "string" ? body.code : "table-playwright";
      const next = {
        priceTableId,
        name: typeof body.name === "string" ? body.name : priceTableId,
        active: body.active !== false,
        currency: typeof body.currency === "string" ? body.currency : "EUR",
      };
      const index = pricingPriceTables.findIndex((item) => item.priceTableId === priceTableId);
      if (index >= 0) {
        pricingPriceTables[index] = next;
      } else {
        pricingPriceTables.push(next);
      }
      sendJson(response, 200, next);
      return;
    }

    const removePriceTableMatch=url.pathname.match(/^\/api\/v1\/admin\/pricing\/price-tables\/([^/]+)\/permanent$/);
    if(removePriceTableMatch && request.method==="DELETE") {
      assertPricingTenant(url);
      if(url.searchParams.get('deactivatePrices')!=='true'){sendJson(response,400,{message:'Acknowledgement required'});return;}
      const code=decodeURIComponent(removePriceTableMatch[1]);
      capturedPricingMutations.push({method:'DELETE',path:url.pathname,body:{deactivatePrices:'true'}});
      const index=pricingPriceTables.findIndex(table=>table.priceTableId===code);
      if(index>=0)pricingPriceTables.splice(index,1);
      sendJson(response,200,{mode:'hard',deleted:index>=0,code,affectedPrices:3,remainingAssignments:0,activePricesRemaining:0});return;
    }

    const priceTableActivationMatch = url.pathname.match(/^\/api\/v1\/admin\/pricing\/price-tables\/([^/]+)\/activation$/);
    if (priceTableActivationMatch && request.method === "PATCH") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      const priceTableId = decodeURIComponent(priceTableActivationMatch[1]);
      const body = await readJsonBody(request);
      capturedPricingMutations.push({ method: "PATCH", path: url.pathname, body });
      const table = pricingPriceTables.find((item) => item.priceTableId === priceTableId) ?? pricingPriceTables[0];
      table.active = body.active !== false;
      sendJson(response, 200, table);
      return;
    }

    const priceTableRulesMatch = url.pathname.match(/^\/api\/v1\/admin\/pricing\/price-tables\/([^/]+)\/rules$/);
    if (priceTableRulesMatch && request.method === "GET") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      const priceTableId = decodeURIComponent(priceTableRulesMatch[1]);
      sendJson(response, 200, { items: pricingRulesByTable[priceTableId] ?? [] });
      return;
    }

    const priceTableRuleMatch = url.pathname.match(/^\/api\/v1\/admin\/pricing\/price-tables\/([^/]+)\/rules\/([^/]+)$/);
    if (priceTableRuleMatch && request.method === "PATCH") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      const priceTableId = decodeURIComponent(priceTableRuleMatch[1]);
      const ruleId = decodeURIComponent(priceTableRuleMatch[2]);
      const body = await readJsonBody(request);
      capturedPricingMutations.push({ method: "PATCH", path: url.pathname, body });
      const rules = pricingRulesByTable[priceTableId] ?? [];
      const index = rules.findIndex((rule) => rule.ruleId === ruleId);
      const current = rules[index] ?? {
        ruleId,
        active: true,
        priority: 100,
        source: "MANUAL",
        tradePolicy: "default",
        channel: "web",
        customerGroup: null,
        country: "ES",
      };
      const next = {
        ...current,
        active: typeof body.active === "boolean" ? body.active : current.active,
        priority: typeof body.priority === "number" ? body.priority : current.priority,
        source: typeof body.source === "string" ? body.source : current.source,
        tradePolicy: typeof body.tradePolicy === "string" ? body.tradePolicy : current.tradePolicy,
        channel: typeof body.channel === "string" ? body.channel : current.channel,
        customerGroup: typeof body.customerGroup === "string" ? body.customerGroup : current.customerGroup,
        country: typeof body.country === "string" ? body.country : current.country,
      };
      if (index >= 0) {
        rules[index] = next;
      } else {
        rules.push(next);
      }
      pricingRulesByTable[priceTableId] = rules;
      sendJson(response, 200, next);
      return;
    }

    if (priceTableRuleMatch && request.method === "DELETE") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      const priceTableId = decodeURIComponent(priceTableRuleMatch[1]);
      const ruleId = decodeURIComponent(priceTableRuleMatch[2]);
      capturedPricingMutations.push({ method: "DELETE", path: url.pathname, body: {} });
      pricingRulesByTable[priceTableId] = (pricingRulesByTable[priceTableId] ?? []).filter((rule) => rule.ruleId !== ruleId);
      sendJson(response, 200, { ruleId, active: false });
      return;
    }

    const priceTableDetailMatch = url.pathname.match(/^\/api\/v1\/admin\/pricing\/price-tables\/([^/]+)$/);
    if (priceTableDetailMatch && request.method === "GET") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      const priceTableId = decodeURIComponent(priceTableDetailMatch[1]);
      sendJson(response, 200, pricingPriceTables.find((item) => item.priceTableId === priceTableId) ?? { priceTableId, name: priceTableId, active: true, currency: "EUR" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/pricing/config") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      sendJson(response, 200, {
        pricingMode: "governed",
        currency: "EUR",
        country: "ES",
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/pricing/migration") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      sendJson(response, 200, {
        status: "ready",
        referenceData: true,
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/pricing/pipeline/catalog") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      sendJson(response, 200, {
        items: [{ priceTableId: "vip-table", active: true, status: "ready" }],
      });
      return;
    }

    const fixedPriceMatch = url.pathname.match(/^\/api\/v1\/admin\/pricing\/prices\/([^/]+)\/fixed$/);
    if (fixedPriceMatch && request.method === "GET") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      const itemId = decodeURIComponent(fixedPriceMatch[1]);
      sendJson(response, 200, {
        items: pricingFixedPrices.filter((price) => price.itemId === itemId || price.variantId === itemId),
      });
      return;
    }

    const fixedPriceTableMatch = url.pathname.match(/^\/api\/v1\/admin\/pricing\/prices\/([^/]+)\/fixed\/([^/]+)$/);
    if (fixedPriceTableMatch && request.method === "PUT") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      const itemId = decodeURIComponent(fixedPriceTableMatch[1]);
      const priceTableId = decodeURIComponent(fixedPriceTableMatch[2]);
      const body = await readJsonBody(request);
      capturedPricingMutations.push({ method: "PUT", path: url.pathname, body });
      const currency = typeof body.currency === "string" ? body.currency : "EUR";
      const fixedPriceMinor = Number(body.fixedPriceMinor ?? 0);
      const basePriceMinor = Number(body.basePriceMinor ?? fixedPriceMinor);
      const listPriceMinor = typeof body.listPriceMinor === "number" ? body.listPriceMinor : null;
      const next = {
        productId: String(body.productId ?? "product-discount"),
        variantId: itemId,
        itemId,
        priceTableId,
        fixedPrice: { amountMinor: fixedPriceMinor, currency },
        basePrice: { amountMinor: basePriceMinor, currency },
        listPrice: listPriceMinor === null ? null : { amountMinor: listPriceMinor, currency },
        fixedPriceMinor,
        basePriceMinor,
        listPriceMinor,
        currency,
        taxIncluded: body.taxIncluded !== false,
        active: true,
      };
      const index = pricingFixedPrices.findIndex((price) => price.itemId === itemId && price.priceTableId === priceTableId);
      if (index >= 0) {
        pricingFixedPrices[index] = next;
      } else {
        pricingFixedPrices.push(next);
      }
      sendJson(response, 200, next);
      return;
    }

    if (fixedPriceTableMatch && request.method === "DELETE") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      const itemId = decodeURIComponent(fixedPriceTableMatch[1]);
      const priceTableId = decodeURIComponent(fixedPriceTableMatch[2]);
      capturedPricingMutations.push({ method: "DELETE", path: url.pathname, body: {} });
      const index = pricingFixedPrices.findIndex((price) => price.itemId === itemId && price.priceTableId === priceTableId);
      if (index >= 0) {
        pricingFixedPrices.splice(index, 1);
      }
      sendJson(response, 200, { itemId, priceTableId, deleted: true });
      return;
    }

    const computedAutoMatch = url.pathname.match(/^\/api\/v1\/admin\/pricing\/prices\/([^/]+)\/computed-auto$/);
    if (computedAutoMatch && request.method === "GET") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      const itemId = decodeURIComponent(computedAutoMatch[1]);
      const fixed = pricingFixedPrices.find((price) => price.itemId === itemId || price.variantId === itemId);
      const grossMinor = fixed?.fixedPriceMinor ?? 9300;
      sendJson(response, 200, {
        itemId,
        priceTableId: fixed?.priceTableId ?? "vip-table",
        netMinor: Math.round(grossMinor / 1.21),
        taxMinor: grossMinor - Math.round(grossMinor / 1.21),
        grossMinor,
        currency: fixed?.currency ?? "EUR",
        source: "FIXED_PRICE",
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/pricing/prices/computed-auto/resolve-batch") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      const body = await readJsonBody(request);
      capturedPricingMutations.push({ method: "POST", path: url.pathname, body });
      const itemId = Array.isArray(body.itemIds) ? String(body.itemIds[0]) : "variant-computed-auto";
      const fixed = pricingFixedPrices.find((price) => price.itemId === itemId || price.variantId === itemId);
      const grossMinor = fixed?.fixedPriceMinor ?? 9300;
      sendJson(response, 200, {
        items: [{
          itemId,
          priceTableId: fixed?.priceTableId ?? "vip-table",
          netMinor: Math.round(grossMinor / 1.21),
          taxMinor: grossMinor - Math.round(grossMinor / 1.21),
          grossMinor,
          currency: fixed?.currency ?? "EUR",
          source: "FIXED_PRICE",
        }],
      });
      return;
    }

    const pricingReferenceMatch = url.pathname.match(/^\/api\/v1\/admin\/pricing\/(customer-groups|channels|trade-policies|countries)$/);
    if (pricingReferenceMatch && request.method === "GET") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      sendJson(response, 200, { items: pricingReferenceState[pricingReferenceMatch[1]] });
      return;
    }

    if (pricingReferenceMatch && request.method === "POST") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      const body = await readJsonBody(request);
      capturedPricingMutations.push({ method: "POST", path: url.pathname, body });
      sendJson(response, 200, upsertReference(pricingReferenceState[pricingReferenceMatch[1]], body));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/pricing/preview") {
      capturedPricingPreviewRequests.push(`${url.pathname}?${url.searchParams.toString()}`);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      expect(url.searchParams.get("productId")).toBe("product-edit-1");
      expect(url.searchParams.get("defaultVariantId")).toBe("variant-edit-default");
      expect(url.searchParams.get("currency")).toBe("EUR");
      expect(url.searchParams.get("country")).toBe("ES");
      expect(url.searchParams.get("tradePolicy")).toBe("default");
      expect(url.searchParams.get("channel")).toBe("web");
      expect(url.searchParams.get("priceTableId")).toBe("cockpit-vip");
      expect(url.searchParams.get("quantity")).toBe("3");
      sendJson(response, 200, {
        ok: true,
        status: "APPLIED",
        reason: null,
        requested: {
          productId: "product-edit-1",
          variantId: null,
          defaultVariantId: "variant-edit-default",
          currency: "EUR",
          country: "ES",
          tradePolicy: "default",
          channel: "web",
          customerGroup: null,
          priceTableId: "cockpit-vip",
          quantity: 3,
          at: null,
        },
        resolution: {
          source: "PRODUCT",
          usedFallback: false,
        },
        price: {
          pricingId: "pricing-preview-cockpit-vip",
          targetType: "PRODUCT",
          productId: "product-edit-1",
          variantId: null,
          priceTableId: "cockpit-vip",
          tradePolicy: "default",
          channel: "web",
          customerGroup: null,
          country: "ES",
          currency: "EUR",
          basePrice: { currency: "EUR", amountMinor: 129900 },
          listPrice: null,
          fixedPrice: { currency: "EUR", amountMinor: 9500 },
          tiers: [{ minQuantity: 3, price: { currency: "EUR", amountMinor: 9500 } }],
          taxIncluded: true,
          active: true,
          priority: 100,
          source: "FIXED",
          resolved: {
            currency: "EUR",
            netAmountMinor: 7851,
            taxAmountMinor: 1649,
            grossAmountMinor: 9500,
            taxIncluded: true,
          },
        },
        conditions: [
          { key: "priceTableId", requested: "cockpit-vip", matched: "cockpit-vip", status: "MATCH" },
          { key: "minQuantity", requested: 3, matched: 3, status: "MATCH" },
        ],
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/shipping/configuration") {
      capturedShippingAdminRequests.push(`${request.method} ${url.pathname}?${url.searchParams.toString()}`);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const includeInactive = url.searchParams.get("includeInactive") === "true";
      sendJson(response, 200, {
        organizationId: defaultOrganizationId,
        shopId: barcelonaShopId,
        zones: activeShippingItems(shippingConfiguration.zones, includeInactive),
        carriers: activeShippingItems(shippingConfiguration.carriers, includeInactive),
        carrierServices: activeShippingItems(shippingConfiguration.carrierServices, includeInactive),
        rateRules: activeShippingItems(shippingConfiguration.rateRules, includeInactive),
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/shipping/fulfillments") {
      capturedShippingAdminRequests.push(`${request.method} ${url.pathname}?${url.searchParams.toString()}`);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const status = url.searchParams.get("status");
      const limit = Number(url.searchParams.get("limit") ?? 25);
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const items = shippingFulfillments.filter((fulfillment) => !status || fulfillment.status === status);
      sendJson(response, 200, {
        items: items.slice(offset, offset + limit),
        total: items.length,
        limit,
        offset,
      });
      return;
    }

    const fulfillmentStatusMatch = url.pathname.match(/^\/api\/v1\/admin\/shipping\/fulfillments\/([^/]+)\/status$/);
    if (request.method === "PATCH" && fulfillmentStatusMatch) {
      capturedShippingAdminRequests.push(`${request.method} ${url.pathname}?${url.searchParams.toString()}`);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const fulfillmentId = decodeURIComponent(fulfillmentStatusMatch[1]);
      const body = await readJsonBody(request);
      const fulfillment = shippingFulfillments.find((candidate) => candidate.fulfillmentId === fulfillmentId);
      const nextStatus = typeof body.status === "string" ? body.status : "";
      if (!fulfillment || (fulfillment.status !== "PACKED" || nextStatus !== "SHIPPED")) {
        sendJson(response, 409, { message: "invalid fulfillment transition" });
        return;
      }
      if (typeof body.trackingNumber !== "string" || !body.trackingNumber.trim()) {
        sendJson(response, 400, { message: "trackingNumber is required" });
        return;
      }

      fulfillment.status = nextStatus;
      fulfillment.trackingNumber = body.trackingNumber;
      fulfillment.carrierId = typeof body.carrierId === "string" && body.carrierId ? body.carrierId : fulfillment.carrierId;
      fulfillment.version += 1;
      fulfillment.updatedAt = "2026-07-16T12:00:00.000Z";
      fulfillment.shippedAt = fulfillment.updatedAt;
      capturedShippingFulfillmentMutations.push({
        method: request.method,
        path: url.pathname,
        body,
      });
      sendJson(response, 200, { fulfillment });
      return;
    }

    const fulfillmentDetailMatch = url.pathname.match(/^\/api\/v1\/admin\/shipping\/fulfillments\/([^/]+)$/);
    if (request.method === "GET" && fulfillmentDetailMatch) {
      capturedShippingAdminRequests.push(`${request.method} ${url.pathname}?${url.searchParams.toString()}`);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const fulfillmentId = decodeURIComponent(fulfillmentDetailMatch[1]);
      const fulfillment = shippingFulfillments.find((candidate) => candidate.fulfillmentId === fulfillmentId);
      if (!fulfillment) {
        sendJson(response, 404, { message: "fulfillment not found" });
        return;
      }
      sendJson(response, 200, fulfillment);
      return;
    }

    const shippingActiveMatch = url.pathname.match(/^\/api\/v1\/admin\/shipping\/(zones|carriers|carrier-services|rate-rules)\/([^/]+)\/active$/);
    if (request.method === "PATCH" && shippingActiveMatch) {
      capturedShippingAdminRequests.push(`${request.method} ${url.pathname}?${url.searchParams.toString()}`);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const [, resource, encodedId] = shippingActiveMatch;
      const body = await readJsonBody(request);
      const state = shippingResourceState(resource);
      const id = decodeURIComponent(encodedId);
      if (!state || typeof body.active !== "boolean") {
        sendJson(response, 400, { message: "invalid shipping active update" });
        return;
      }
      const item = state.items.find((candidate) => candidate[state.idKey] === id);
      if (!item) {
        sendJson(response, 404, { message: "shipping resource not found" });
        return;
      }

      item.active = body.active;
      capturedShippingActiveMutations.push({
        method: request.method,
        path: url.pathname,
        body,
      });
      sendJson(response, 200, item);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/routing-seo/routes") {
      capturedSeoAdminRequests.push(`${request.method} ${url.pathname}?${url.searchParams.toString()}`);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      expect(url.searchParams.get("locale") ?? request.headers["x-locale"]).toBe("es-ES");
      const status = url.searchParams.get("status");
      const entityType = url.searchParams.get("entityType");
      const entityId = url.searchParams.get("entityId");
      const items = seoRoutes.filter((route) =>
        (!status || route.status === status) &&
        (!entityType || route.entityType === entityType) &&
        (!entityId || route.entityId === entityId),
      );
      sendJson(response, 200, {
        total: items.length,
        limit: Number(url.searchParams.get("limit") ?? 50),
        offset: Number(url.searchParams.get("offset") ?? 0),
        items,
      });
      return;
    }

    if (request.method === "PATCH" && url.pathname.startsWith("/api/v1/admin/routing-seo/routes/")) {
      capturedSeoAdminRequests.push(`${request.method} ${url.pathname}?${url.searchParams.toString()}`);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      expect(url.searchParams.get("locale") ?? request.headers["x-locale"]).toBe("es-ES");
      const routeId = decodeURIComponent(url.pathname.split("/").pop() ?? "");
      const route = seoRoutes.find((candidate) => candidate.routeId === routeId);
      const body = await readJsonBody(request);
      if (!route) {
        sendJson(response, 404, { message: "seo route not found" });
        return;
      }
      if (typeof body.path === "string") {
        route.path = body.path;
      }
      if (typeof body.status === "string") {
        route.status = body.status;
      }
      if (typeof body.includeInSitemap === "boolean") {
        route.includeInSitemap = body.includeInSitemap;
      }
      route.updatedAt = "2026-06-30T01:00:00.000Z";
      capturedSeoMutations.push({
        method: request.method,
        path: url.pathname,
        body,
      });
      sendJson(response, 200, route);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/routing-seo/redirects") {
      capturedSeoAdminRequests.push(`${request.method} ${url.pathname}?${url.searchParams.toString()}`);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      expect(url.searchParams.get("locale") ?? request.headers["x-locale"]).toBe("es-ES");
      const status = url.searchParams.get("status");
      const items = status ? seoRedirects.filter((redirect) => redirect.status === status) : seoRedirects;
      sendJson(response, 200, {
        total: items.length,
        limit: Number(url.searchParams.get("limit") ?? 50),
        offset: Number(url.searchParams.get("offset") ?? 0),
        items,
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/routing-seo/redirects") {
      capturedSeoAdminRequests.push(`${request.method} ${url.pathname}?${url.searchParams.toString()}`);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      expect(url.searchParams.get("locale") ?? request.headers["x-locale"]).toBe("es-ES");
      const body = await readJsonBody(request);
      const redirect = {
        redirectId: `redirect-${seoRedirects.length + 1}`,
        organizationId: defaultOrganizationId,
        shopId: barcelonaShopId,
        locale: "es-ES",
        fromPath: typeof body.fromPath === "string" ? body.fromPath : "",
        toPath: typeof body.toPath === "string" ? body.toPath : "",
        statusCode: typeof body.statusCode === "number" ? body.statusCode : 301,
        status: "ACTIVE",
        reason: typeof body.reason === "string" ? body.reason : null,
        expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : null,
        createdAt: "2026-06-30T01:00:00.000Z",
        updatedAt: "2026-06-30T01:00:00.000Z",
      };
      seoRedirects.push(redirect);
      capturedSeoMutations.push({
        method: request.method,
        path: url.pathname,
        body,
      });
      sendJson(response, 200, redirect);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/routing-seo/resolve") {
      capturedSeoAdminRequests.push(`${request.method} ${url.pathname}?${url.searchParams.toString()}`);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      expect(url.searchParams.get("locale") ?? request.headers["x-locale"]).toBe("es-ES");
      sendJson(response, 200, {
        kind: "ROUTE",
        requestedPath: url.searchParams.get("path") ?? "/producto-demo/p",
        canonicalPath: "/producto-demo/p",
        isCanonical: true,
        entityType: "PRODUCT",
        entityId: "product-demo",
        routeId: "route-product",
        canonicalRouteId: "route-product",
        organizationId: defaultOrganizationId,
        shopId: barcelonaShopId,
        locale: "es-ES",
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/routing-seo/sitemap") {
      capturedSeoAdminRequests.push(`${request.method} ${url.pathname}?${url.searchParams.toString()}`);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      expect(url.searchParams.get("locale") ?? request.headers["x-locale"]).toBe("es-ES");
      sendJson(response, 200, {
        organizationId: defaultOrganizationId,
        shopId: barcelonaShopId,
        locale: "es-ES",
        entries: seoRoutes
          .filter((route) => route.status === "ACTIVE" && route.includeInSitemap)
          .map((route) => ({
            path: route.path,
            entityType: route.entityType,
            entityId: route.entityId,
            routeId: route.routeId,
            updatedAt: route.updatedAt,
          })),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/media/collections") {
      const raw=await readRawBody(request);
      expect(request.headers["content-type"]).toContain("multipart/form-data");
      expect(raw).toContain('filename="safe.png"');
      const title=raw.match(/name="title"\r\n\r\n([^\r]+)/)?.[1] ?? "Galería de prueba";
      const created={...mediaCollections[0],mediaCollectionId:"collection-created-media",title:{"es-ES":title}};
      mediaCollections.push(created);
      capturedMediaAdminMutations.push({method:"POST",path:url.pathname});
      sendJson(response,201,created);
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/admin/media/collections") {
      capturedMediaAdminRequests.push(`${request.method} ${url.pathname}?${url.searchParams.toString()}`);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      expect(url.searchParams.get("locale") ?? request.headers["x-locale"]).toBe("es-ES");
      const includeInactive = url.searchParams.get("includeInactive") === "true";
      const items = includeInactive ? mediaCollections : mediaCollections.filter((collection) => collection.active);
      sendJson(response, 200, {
        total: items.length,
        limit: Number(url.searchParams.get("limit") ?? 50),
        offset: Number(url.searchParams.get("offset") ?? 0),
        items,
      });
      return;
    }

    const mediaCollectionMatch = url.pathname.match(/^\/api\/v1\/admin\/media\/collections\/([^/]+)$/);
    if (mediaCollectionMatch && request.method === "GET") {
      capturedMediaAdminRequests.push(`${request.method} ${url.pathname}?${url.searchParams.toString()}`);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      expect(url.searchParams.get("locale") ?? request.headers["x-locale"]).toBe("es-ES");
      const mediaCollectionId = decodeURIComponent(mediaCollectionMatch[1]);
      const collection = mediaCollections.find((item) => item.mediaCollectionId === mediaCollectionId);
      if (!collection) {
        sendJson(response, 404, { message: "media collection not found" });
        return;
      }
      sendJson(response, 200, collection);
      return;
    }

    if (mediaCollectionMatch && request.method === "PATCH") {
      const body=await readJsonBody(request);
      const collection=mediaCollections.find(item=>item.mediaCollectionId===decodeURIComponent(mediaCollectionMatch[1]));
      if(!collection){sendJson(response,404,{});return;}
      collection.title={"es-ES":String(body.title)};
      capturedMediaAdminMutations.push({method:"PATCH",path:url.pathname});
      sendJson(response,200,collection);
      return;
    }
    if (mediaCollectionMatch && request.method === "DELETE") {
      capturedMediaAdminRequests.push(`${request.method} ${url.pathname}?${url.searchParams.toString()}`);
      capturedMediaAdminMutations.push({ method: request.method, path: `${url.pathname}?${url.searchParams.toString()}` });
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      expect(url.searchParams.get("locale") ?? request.headers["x-locale"]).toBe("es-ES");
      expect(url.searchParams.get("mode")).toBe("soft");
      const mediaCollectionId = decodeURIComponent(mediaCollectionMatch[1]);
      const collection = mediaCollections.find((item) => item.mediaCollectionId === mediaCollectionId);
      if (collection) {
        collection.active = false;
      }
      sendJson(response, 200, { deleted: true, status: "INACTIVE" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/products") {
      capturedStockAdminRequests.push(`${request.method} ${url.pathname}?${url.searchParams.toString()}`);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      sendJson(response, 200, {
        total: 1,
        limit: Number(url.searchParams.get("limit") ?? 25),
        offset: Number(url.searchParams.get("offset") ?? 0),
        items: [{
          productId: "product-edit-1",
          name: { "es-ES": "Producto existente Playwright" },
          slug: "producto-existente-playwright",
          refId: "PEP-001",
          reference: "PEP-001",
          isActive: true,
          isVisible: true,
          defaultVariantId: "variant-edit-default",
          quantity: 9,
        }],
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/inventory/availability/resolve-batch") {
      capturedStockAdminRequests.push(`${request.method} ${url.pathname}?${url.searchParams.toString()}`);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      sendJson(response, 200, {
        items: [{
          variantId: "variant-edit-default",
          warehouseId: "main-warehouse",
          onHandQuantity: 12,
          reservedQuantity: 2,
          safetyStockQuantity: 1,
          availableQuantity: 9,
          available: true,
        }],
      });
      return;
    }

    if (request.method === "PUT" && url.pathname === "/api/v1/admin/inventory/stock-levels") {
      capturedStockAdminRequests.push(`${request.method} ${url.pathname}?${url.searchParams.toString()}`);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const body = await readJsonBody(request);
      capturedStockMutations.push({ method: request.method, path: url.pathname, body });
      sendJson(response, 200, {
        ...body,
        availableQuantity: Number(body.onHandQuantity ?? 0) - Number(body.reservedQuantity ?? 0) - Number(body.safetyStockQuantity ?? 0),
        updatedAt: "2026-07-01T00:00:00.000Z",
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/shipping/warehouses") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      sendJson(response, 200, { warehouses: [{ warehouseId: "main-warehouse", name: "Barcelona principal", active: true }, { warehouseId: "warehouse-secondary", name: "Barcelona secundario", active: true }] });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/admin/inventory/stock-levels") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      sendJson(response, 200, { stockLevel: { warehouseId: url.searchParams.get("warehouseId"), variantId: url.searchParams.get("variantId"), onHandQuantity: 7, reservedQuantity: 2, safetyStockQuantity: 1 } });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/products/product-edit-1/editor-state") {
      capturedEditorStateRequests.push(url.pathname);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      expect(url.searchParams.get("locale") ?? request.headers["x-locale"]).toBe("es-ES");
      expect(url.searchParams.get("currency")).toBe("EUR");
      // The editor lets BFF resolve the warehouse; Stock may select one explicitly.
      expect([null, "main-warehouse"]).toContain(url.searchParams.get("warehouseId"));
      sendJson(response, 200, {
        product: {
          productId: "product-edit-1",
          name: { "es-ES": "Producto existente Playwright" },
          slug: "producto-existente-playwright",
          isActive: editorProductActive,
          isVisible: editorProductVisible,
          categoryId: "category-bikes",
          categoryName: "Bicicletas",
          brandId: controlledBrandLookup ? "brand-late" : "brand-demo",
          brandName: controlledBrandLookup ? undefined : "Marca Demo",
          mediaCollectionId: "collection-edit-1",
          defaultVariantId: "variant-edit-default",
          shortDescription: { "es-ES": "Resumen editable" },
          description: { "es-ES": "Descripcion editable" },
          taxCode: "standard",
          shipping: {
            package: {
              weightGrams: 1200,
              widthMm: 400,
              heightMm: 800,
              depthMm: 120,
            },
            additionalShippingCostMinor: 250,
            allowedCarrierIds: ["carrier-standard"],
            deliveryTimeMode: "default",
            deliveryTimeNotes: {
              inStock: { "es-ES": "Entrega estandar" },
              outOfStock: {},
            },
          },
        },
        variants: [{
          variantId: "variant-edit-default",
          name: "Producto existente Playwright",
          refId: "PEP-001",
          ean: "8430000000001",
          isActive: true,
          isVisible: true,
          isDefault: true,
        }, {
          variantId: "variant-edit-red",
          name: "Producto existente Playwright rojo",
          refId: "PEP-RED",
          ean: "8430000000002",
          isActive: true,
          isVisible: true,
          isDefault: false,
        }, {
          variantId: "variant-edit-green",
          name: "Producto existente Playwright verde",
          refId: "PEP-GREEN",
          ean: "8430000000003",
          isActive: true,
          isVisible: true,
          isDefault: false,
        }],
        variantOptions: {
          "variant-edit-red": [{
            variantOptionId: "option-red",
            attributeCode: "color",
            valueCode: "rojo",
            isActive: true,
          }],
          "variant-edit-green": [{
            variantOptionId: "option-green",
            attributeCode: "color",
            valueCode: "verde",
            isActive: true,
          }],
        },
        mediaCollection: {
          mediaCollectionId: "collection-edit-1",
          items: [{
            mediaAssetId: "asset-edit-1",
            fileName: "edit-cover.png",
            mimeType: "image/png",
            fileSize: 68,
            publicUrl: onePixelPngDataUrl,
            cover: true,
            isActive: true,
            alt: { "es-ES": "Imagen producto existente" },
            title: { "es-ES": "Imagen producto existente" },
          }],
        },
        variantMedia: {
          "variant-edit-default": [{
            mediaAssetId: "asset-edit-1",
            isMain: true,
          }],
        },
        prices: {
          product: [{
            pricingId: "pricing-edit-product",
            targetType: "PRODUCT",
            productId: "product-edit-1",
            basePriceMinor: 129900,
            currency: "EUR",
            taxIncluded: true,
            taxCode: "standard",
            tax: {
              taxCode: "standard",
              name: "IVA general",
              calculationType: "PERCENTAGE",
              rate: 0.21,
              isActive: true,
            },
            priceTableId: inheritPriceScenario ? null : "base",
            ...(pricingDatesScenario ? { source: "BASE", country: "FR", channel: "marketplace", tradePolicy: "b2b", customerGroup: "vip", validFrom: "2026-01-01T00:00:00Z", validUntil: "2027-01-01T00:00:00Z", timezone: "Europe/Madrid", active: true, priority: 37 } : {}),
          }],
          specificPrices: pricingDatesScenario ? [{
            pricingId: "pricing-date-overlap", targetType: "PRODUCT", productId: "product-edit-1",
            basePriceMinor: 129900, fixedPriceMinor: 1800, currency: "EUR", source: "FIXED",
            customerGroup: "vip", country: "FR", channel: "marketplace", tradePolicy: "b2b",
            validFrom: "2026-10-25T01:30:15.123Z", validUntil: "2026-10-26T23:00:00.000Z",
            taxIncluded: true, active: true, priority: 100,
          }] : [],
          variants: [{
            pricingId: "pricing-edit-green",
            targetType: "VARIANT",
            productId: "product-edit-1",
            variantId: "variant-edit-green",
            basePriceMinor: 9900,
            currency: "EUR",
            taxIncluded: true,
            taxCode: "standard",
            priceTableId: inheritPriceScenario ? null : "base",
          }],
        },
        availability: {
          items: [{
            variantId: "variant-edit-default",
            warehouseId: "main-warehouse",
            onHandQuantity: 12,
            reservedQuantity: 2,
            safetyStockQuantity: 1,
            availableQuantity: 9,
            available: true,
          }, {
            variantId: "variant-edit-red",
            warehouseId: "main-warehouse",
            onHandQuantity: 0,
            reservedQuantity: 0,
            safetyStockQuantity: 0,
            availableQuantity: 0,
            available: false,
          }, {
            variantId: "variant-edit-green",
            warehouseId: "main-warehouse",
            onHandQuantity: 4,
            reservedQuantity: 0,
            safetyStockQuantity: 0,
            availableQuantity: 4,
            available: true,
          }],
        },
        warnings: [],
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/offerings/variants/resolve-batch") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      capturedCatalogOfferingRequests.push("POST /api/v1/admin/offerings/variants/resolve-batch");
      const body = await readJsonBody(request);
      sendJson(response, 200, {
        variants: (body.variantIds as string[]).map((variantId: string) => ({
          variantId,
          offerings: offeringReadProjection ?? (staleOfferingProjection ? [] : catalogOfferings.filter((offering) => (catalogOfferingsByVariant[variantId] ?? []).includes(offering.offeringId))),
        })),
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/product-drafts/product-edit-1") {
      capturedDraftStateRequests.push(url.pathname);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      expect(url.searchParams.get("locale") ?? request.headers["x-locale"]).toBe("es-ES");
      sendJson(response, 200, {
        ok: true,
        clientDraftId: "product-edit-1",
        productId: "product-edit-1",
        defaultVariantId: "variant-edit-default",
        mediaCollectionId: "collection-edit-1",
        status: "incomplete",
        expiresAt: "2026-06-25T00:00:00.000Z",
        mediaItems: [{
          localId: "asset-edit-1",
          mediaAssetId: "asset-edit-1",
          fileName: "edit-cover.png",
          mimeType: "image/png",
          fileSize: 68,
          previewUrl: "22222222-2222-4222-8222-222222222222/media-product-edit-1/asset-edit-1/original.png",
          thumbnailUrl: null,
          isMain: true,
          position: 1,
          active: true,
          persisted: true,
          uploadStatus: "uploaded",
          alt: { "es-ES": "Imagen producto existente" },
          title: { "es-ES": "Imagen producto existente" },
        }],
        warnings: [],
        correlationIds: ["bff-edit-draft-state"],
        draftPatch: {
          clientDraftId: "product-edit-1",
          productId: "product-edit-1",
          defaultVariantId: "variant-edit-default",
          mediaCollectionId: "collection-edit-1",
        },
      });
      return;
    }

    if (request.method === "GET" && /^\/api\/v1\/admin\/product-drafts\/[^/]+$/.test(url.pathname)) {
      capturedDraftStateRequests.push(url.pathname);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      expect(url.searchParams.get("locale") ?? request.headers["x-locale"]).toBe("es-ES");
      const clientDraftId = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
      const uploadedItems = uploadedDraftMediaByClientDraftId.get(clientDraftId) ?? [];
      sendJson(response, 200, {
        ok: true,
        clientDraftId,
        productId: "product-draft-remote",
        defaultVariantId: "variant-default-remote",
        mediaCollectionId: "collection-remote",
        status: "incomplete",
        expiresAt: "2026-06-25T00:00:00.000Z",
        mediaItems: [{
          localId: "remote-media-1",
          mediaAssetId: "asset-remote-1",
          fileName: "remote-cover.png",
          mimeType: "image/png",
          fileSize: 68,
          previewUrl: onePixelPngDataUrl,
          thumbnailUrl: onePixelPngDataUrl,
          isMain: true,
          position: 1,
          active: true,
          persisted: true,
          uploadStatus: "uploaded",
          alt: { "es-ES": "Imagen principal remota" },
          title: { "es-ES": "Imagen principal remota" },
        }, ...uploadedItems],
        warnings: [],
        correlationIds: ["bff-draft-state"],
        draftPatch: {
          clientDraftId,
          productId: "product-draft-remote",
          defaultVariantId: "variant-default-remote",
          mediaCollectionId: "collection-remote",
        },
      });
      return;
    }

    if (request.method === "POST" && /^\/api\/v1\/admin\/product-drafts\/[^/]+\/media$/.test(url.pathname)) {
      capturedDraftMediaUploadRequests.push(url.pathname);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      expect(url.searchParams.get("locale") ?? request.headers["x-locale"]).toBe("es-ES");
      expect(request.headers["idempotency-key"]).toBeTruthy();
      capturedDraftMediaUploadIdempotencyKeys.push(String(request.headers["idempotency-key"]));
      const uploadBody = await readRawBody(request);
      capturedDraftMediaUploadBodies.push(uploadBody);
      const clientDraftId = decodeURIComponent(url.pathname.split("/").at(-2) ?? "");
      if (draftMediaUploadMode === "failed") {
        sendJson(response, 200, {
          ok: false,
          uploadOperationId: "pdmu-playwright-failed",
          idempotencyKey: request.headers["idempotency-key"],
          clientDraftId,
          status: "incomplete",
          messages: ["Media temporal no disponible."],
          fieldErrors: {
            media: "Media temporal no disponible.",
          },
          correlationIds: ["bff-draft-media-upload-failed"],
        });
        return;
      }

      const uploadedLocalId = parseMultipartTextField(uploadBody, "fileLocalId") || "uploaded-media-playwright";
      uploadedDraftMediaByClientDraftId.set(clientDraftId, [
        ...(uploadedDraftMediaByClientDraftId.get(clientDraftId) ?? []),
        {
          localId: uploadedLocalId,
          mediaAssetId: "asset-uploaded-playwright",
          fileName: "playwright-cover.png",
          mimeType: "image/png",
          fileSize: 68,
          previewUrl: onePixelPngDataUrl,
          thumbnailUrl: onePixelPngDataUrl,
          isMain: false,
          position: 2,
          active: true,
          persisted: true,
          uploadStatus: "uploaded",
          alt: { "es-ES": "Imagen subida por Playwright" },
          title: { "es-ES": "Imagen subida por Playwright" },
        },
      ]);

      sendJson(response, 200, {
        ok: true,
        uploadOperationId: "pdmu-playwright",
        idempotencyKey: request.headers["idempotency-key"],
        clientDraftId,
        productId: "product-draft-remote",
        defaultVariantId: "variant-default-remote",
        mediaCollectionId: "collection-remote",
        mediaItem: {
          localId: "uploaded-media-playwright",
          mediaAssetId: "asset-uploaded-playwright",
          fileName: "playwright-cover.png",
          mimeType: "image/png",
          fileSize: 68,
          previewUrl: onePixelPngDataUrl,
          isMain: false,
          persisted: true,
          uploadStatus: "uploaded",
          alt: { "es-ES": "Imagen subida por Playwright" },
          title: { "es-ES": "Imagen subida por Playwright" },
        },
        status: "incomplete",
        correlationIds: ["bff-draft-media-upload"],
        draftPatch: {
          clientDraftId,
          productId: "product-draft-remote",
          mediaCollectionId: "collection-remote",
        },
      });
      return;
    }

    if (request.method === "GET" && /^\/api\/v1\/admin\/media\/assets\/[^/]+\/content$/.test(url.pathname)) {
      capturedMediaAssetContentRequests.push(`${url.pathname}?${url.searchParams.toString()}`);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      expect(["small_default", "medium_default", "original"]).toContain(url.searchParams.get("variant"));
      const imageBuffer = Buffer.from(onePixelPngDataUrl.split(",")[1], "base64");
      response.writeHead(200, {
        "content-type": "image/png",
        "content-length": String(imageBuffer.byteLength),
      });
      response.end(imageBuffer);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/product-save-operations") {
      capturedSaveOperationRequests.push(url.pathname);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      expect(url.searchParams.get("locale") ?? request.headers["x-locale"]).toBe("es-ES");
      expect(request.headers["idempotency-key"]).toBeTruthy();
      capturedSaveOperationIdempotencyKeys.push(String(request.headers["idempotency-key"]));
      capturedSaveOperationBodies.push(await readRawBody(request));
      const commandKey = String(request.headers["idempotency-key"]);
      const commandDraft = parseMultipartTextField(capturedSaveOperationBodies.at(-1)!, "draft");
      const previousCommand = saveCommandsByKey.get(commandKey);
      if (previousCommand !== undefined && previousCommand !== commandDraft) {
        sendJson(response, 409, { message: "idempotency key reused with a different command" });
        return;
      }
      saveCommandsByKey.set(commandKey, commandDraft);
      if (saveOperationMode === "published") {
        sendJson(response, 200, {
          ok: true,
          operationId: "pso-playwright-published",
          productId: "product-draft-remote",
          defaultVariantId: "variant-default-remote",
          mediaCollectionId: "collection-remote",
          status: "published",
          retryable: false,
          blocks: {
            catalog: "success",
            variants: "skipped",
            media: "success",
            variantMedia: "success",
            pricing: "success",
            inventory: "success",
            shipping: "success",
            publish: "success",
          },
          messages: ["Producto publicado."],
          fieldErrors: {},
          recoveryActions: [],
          correlationIds: ["bff-save-published"],
          draftPatch: {
            productId: "product-draft-remote",
            defaultVariantId: "variant-default-remote",
            mediaCollectionId: "collection-remote",
            saveState: {
              catalog: "success",
              variants: "skipped",
              media: "success",
              variantMedia: "success",
              pricing: "success",
              inventory: "success",
              shipping: "success",
              publish: "success",
            },
          },
        });
        return;
      }

      if (saveOperationMode === "success") {
        sendJson(response, 200, {
          ok: true,
          operationId: "pso-playwright-success",
          productId: "product-draft-remote",
          defaultVariantId: "variant-default-remote",
          mediaCollectionId: "collection-remote",
          status: "saved_unpublished",
          retryable: false,
          blocks: {
            catalog: "success",
            variants: "skipped",
            media: "success",
            variantMedia: "success",
            pricing: "skipped",
            inventory: "skipped",
            shipping: "success",
            publish: "skipped",
          },
          messages: ["Producto guardado."],
          fieldErrors: {},
          recoveryActions: [],
          correlationIds: ["bff-save-success"],
          draftPatch: {
            productId: "product-draft-remote",
            defaultVariantId: "variant-default-remote",
            mediaCollectionId: "collection-remote",
            saveState: {
              catalog: "success",
              variants: "skipped",
              media: "success",
              variantMedia: "success",
              pricing: "skipped",
              inventory: "skipped",
              shipping: "success",
              publish: "skipped",
            },
          },
        });
        return;
      }

      sendJson(response, 200, {
        ok: false,
        operationId: "pso-playwright-partial",
        productId: "product-draft-remote",
        defaultVariantId: "variant-default-remote",
        mediaCollectionId: "collection-remote",
        status: "partial_failed",
        retryable: true,
        blocks: {
          catalog: "success",
          variants: "skipped",
          media: "success",
          variantMedia: "success",
          pricing: "failed",
          inventory: "pending",
          shipping: "success",
          publish: "blocked",
        },
        messages: ["Precio pendiente de guardar."],
        fieldErrors: {
          pricing: "Pricing no disponible.",
        },
        recoveryActions: [{
          actionId: "retry_pricing",
          label: "Reintentar precio",
          block: "pricing",
          kind: "retry",
        }],
        correlationIds: ["bff-save-partial"],
        draftPatch: {
          productId: "product-draft-remote",
          defaultVariantId: "variant-default-remote",
          mediaCollectionId: "collection-remote",
          saveState: {
            catalog: "success",
            variants: "skipped",
            media: "success",
            variantMedia: "success",
            pricing: "failed",
            inventory: "pending",
            shipping: "success",
            publish: "blocked",
          },
        },
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/cms/pages") {
      const page = {
        pageId: cmsPageId,
        organizationId: defaultOrganizationId,
        shopId: barcelonaShopId,
        locale: "es-ES",
        pageType: "LANDING",
        title: "ReadIndex CMS Cert 1790167962",
        path: "/readindex-cms-cert-1790167962",
        status: "UNPUBLISHED",
        routeId: "route-cms-page-1",
        createdAt: "2026-10-01T07:20:00.000Z",
        updatedAt: "2026-10-01T07:26:00.000Z",
        publishedAt: "2026-10-01T07:24:00.000Z",
      };
      sendJson(response, 200, {
        total: cmsPageDeleted ? 0 : 1,
        limit: 50,
        offset: 0,
        items: cmsPageDeleted ? [] : [page],
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/cms/visual-modules") {
      sendJson(response, 200, { total: 0, limit: 50, offset: 0, items: [] });
      return;
    }

    if (request.method === "GET" && url.pathname === `/api/v1/admin/cms/pages/${cmsPageId}`) {
      sendJson(response, 200, {
        pageId: cmsPageId,
        organizationId: defaultOrganizationId,
        shopId: barcelonaShopId,
        locale: "es-ES",
        pageType: "LANDING",
        title: "ReadIndex CMS Cert 1790167962",
        path: "/readindex-cms-cert-1790167962",
        status: "UNPUBLISHED",
        routeId: "route-cms-page-1",
        createdAt: "2026-10-01T07:20:00.000Z",
        updatedAt: "2026-10-01T07:26:00.000Z",
        publishedAt: "2026-10-01T07:24:00.000Z",
        latestVersion: null,
        publishedVersion: null,
      });
      return;
    }

    if (request.method === "GET" && url.pathname === `/api/v1/admin/cms/pages/${cmsPageId}/settings`) {
      sendJson(response, 200, {
        configurationState: "INITIAL",
        settings: { pageId: cmsPageId, inheritGlobalSettings: true, templateId: null, overrides: {} },
      });
      return;
    }

    if (request.method === "GET" && url.pathname === `/api/v1/admin/cms/pages/${cmsPageId}/resolved-settings`) {
      sendJson(response, 200, {
        pageId: cmsPageId,
        globalSettingsState: "INITIAL",
        pageSettingsState: "INITIAL",
        inheritGlobalSettings: true,
        templateId: null,
        resolvedFrom: ["global"],
        tokens: {},
        layout: { regions: {} },
        moduleSlots: [],
        modules: [],
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/cms/templates") {
      sendJson(response, 200, { total: 0, limit: 50, offset: 0, items: [] });
      return;
    }

    if (request.method === "DELETE" && url.pathname === `/api/v1/admin/cms/pages/${cmsPageId}`) {
      capturedCmsPageDeletes.push(`${request.method} ${url.pathname}${url.search}`);
      cmsPageDeleted = true;
      sendJson(response, 200, { pageId: cmsPageId, deleted: true });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/auth/login") {
      const body = await readJsonBody(request);
      capturedLoginPayloads.push(body);
      sendJson(response, 200, {
        profile: {
          principalId: "employee-1",
          principalType: "EMPLOYEE",
          email: body.email,
        },
        session: {
          sessionId: "session-1",
          principalType: "EMPLOYEE",
          scope: "admin",
        },
        tokens: {
          accessToken: "access-token",
          refreshToken: "refresh-token",
          expiresInSeconds: 900,
        },
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/auth/me") {
      if (request.headers.authorization !== "Bearer access-token") {
        sendJson(response, 401, { message: "invalid access token" });
        return;
      }

      sendJson(response, 200, {
        principal: {
          sub: "employee-1",
          principalType: "EMPLOYEE",
          email: "admin@example.com",
          roles: ["admin"],
          permissions: authPermissions,
          tenantAccess: {
            level: "SHOP",
            shopScopes: [
              { organizationId: defaultOrganizationId, shopId: barcelonaShopId },
            ],
          },
          scope: "admin",
        },
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
      const response = await fetch(url, {signal: AbortSignal.timeout(2000)});
      if (response.status < 500) {
        return;
      }
    } catch {
      // Server is still starting; retry within the readiness deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Next dev server did not become ready at ${url}`);
}

async function startNext() {
  nextPort = await freePort();
  nextProcess = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(nextPort)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ECOMMIUM_STOREFRONT_BFF_BASE_URL: "https://storefront.example.invalid/api/v1",
      ECOMMIUM_STOREFRONT_ORGANIZATION_ID: defaultOrganizationId,
      ECOMMIUM_STOREFRONT_SHOP_ID: barcelonaShopId,
      ECOMMIUM_ADMIN_BFF_BASE_URL: `http://127.0.0.1:${bffPort}/api/v1`,
      ECOMMIUM_ADMIN_BFF_TOKEN: "server-admin-token",
    },
  });
  nextProcess.stdout.on("data", chunk => { nextOutput = (nextOutput + chunk.toString()).slice(-24000); });
  nextProcess.stderr.on("data", chunk => { nextOutput = (nextOutput + chunk.toString()).slice(-24000); });
  await waitForNext(`http://127.0.0.1:${nextPort}/auth/login`);
}

async function openCommunicationsSection(page: Page, title: string) {
  await page.getByRole("navigation", {name:"Comunicaciones",exact:true}).getByRole("link", {name:"Plantillas",exact:true}).click();
  if (title === "Plantillas de Customer") {
    const section = page.locator("details.communicationsCollapsible");
    if (await section.getAttribute("open") === null) await section.locator("summary").click();
    return section;
  }
  return page.locator(".communicationsTemplateList");
}

async function loginAdmin(page: Page) {
  await page.goto(`http://127.0.0.1:${nextPort}/auth/login`);
  await page.getByLabel("Email").fill("admin@example.com");
  await page.locator('input[name="password"]').fill("secret123");
  await page.getByRole("button", { name: "Entrar con BFF Auth" }).click();
  await page.waitForURL(`http://127.0.0.1:${nextPort}/admin`);
}

test.beforeAll(async () => {
  await startBffMock();
  await startNext();
});

test.beforeEach(async ({page}) => {
  commercialAudit=[];commercialPolicy={policy:{allowedGroups:[],registeredGroup:null,b2bGroup:null},revision:0};
  commercialScenario=false;commercialMembershipStatus=200;commercialGroupsStatus=200;commercialConflict=false;commercialInvalidSnapshot=false;
  commercialMembership={groupCode:null,b2bApproved:false,buyerType:"PRIVATE_BUYER",revision:0};
  commercialGroups=[{code:"vip",name:"VIP",active:true},{code:"pro",name:"Profesional",active:true}];commercialProfileWrites.length=0;
  offeringReadProjection = null; offeringRelationMutations = 0;
  controlledBrandLookup = false; controlledTaxOutage = false; inheritPriceScenario = false;
  catalogRetirementScenario=false;catalogRetirementBlocked=false;catalogRetirementLost=false;catalogRetirementProductRemoved=false;catalogRetirementVariantRemoved=false;catalogRetirementSteps=0;catalogRetirementConfirmations=0;catalogRetirementOperation=null;catalogRetirementKeys.length=0;
  saveCommandsByKey.clear();
  if (process.env.ECOMMIUM_QA_SCREENSHOTS === "true") await page.setViewportSize({width:1600,height:1000});
  categoryRow={categoryId:"category-bikes",name:"Bicicletas",slug:"bicicletas",isActive:true};
  categoryRemoved=false;categoryMutations.length=0;
  editorProductActive=false;editorProductVisible=true;
  brandRow={brandId:"brand-demo",name:"Marca Demo",slug:"marca-demo",isActive:true};
  brandRemoved=false;brandMutations.length=0;
  mediaCollections.splice(1);mediaCollections[0].title={"es-ES":"Galeria producto existente"};mediaCollections[0].active=true;
  catalogOfferings.splice(1);Object.assign(catalogOfferings[0],{name:"Instalacion",localizedName:[{locale:"es-ES",value:"Instalacion"}],priceMinor:1999,currency:"EUR",type:"service",active:true});
  dashboardHealthScenario="healthy";
  authMeFailuresRemaining=0;
  sessionRefreshCalls=0;
  rejectConfigurationCreate=false;
  rejectSpecificationCreate=false;
  delaySpecificationProjection=false;
  deletionAvailable=true;deletionMutations=0;deletionRetries=0;deletionOperationId="";deletionProjected=false;deletionLostResponse=false;deletionProducts=3200;
  lifecycleLostResponse=false;lifecycleProjected=false;lifecycleInactive=false;lifecycleMutations=0;lifecycleConflict=false;lifecycleVersion="a".repeat(64);
  configurationCreates.length=0;
  shopPreparationState = "READY";
  shopPreparationPolls = 0;
  capturedPreparationRetries.length = 0;
  authPermissions = ["admin:*", "media.assets.write"];
  cmsPageDeleted = false;
  capturedCmsPageDeletes.length = 0;
});

test.afterEach(async ({}, info) => {
  if (info.status !== info.expectedStatus) await info.attach("next-server.log", { body: nextOutput, contentType: "text/plain" });
});

test.afterAll(async () => {
  nextProcess?.kill();
  bffServer?.close();
});

const admissionCsv = { name: "admission.csv", mimeType: "text/csv", buffer: Buffer.from("Product ID;Name\n1;Admission test\n") };
const admissionReady = { ready: true, checks: [{ component: "catalog-import-parser", ready: true }] };

async function openCsvAdmission(page: Page) {
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/catalogo/importar`);
  return page.locator("section.pricingBulkImportCard").filter({ has: page.getByRole("heading", { name: "Importar productos por CSV", exact: true }) });
}

test("CMS page list confirms and deletes an unpublished page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/cms`);

  const row = page.getByRole("row", { name: /ReadIndex CMS Cert 1790167962/ });
  await expect(row).toBeVisible();
  await row.getByRole("link", { name: "Eliminar ReadIndex CMS Cert 1790167962" }).click();

  const dialog = page.getByRole("dialog", { name: "Eliminar pagina CMS" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Esta accion es irreversible");
  await dialog.getByLabel("Confirmacion").fill("ELIMINAR");
  await dialog.getByRole("button", { name: "Eliminar definitivamente" }).click();

  await expect(page.getByText("Pagina CMS eliminada definitivamente.")).toBeVisible();
  await expect(page.getByText("ReadIndex CMS Cert 1790167962")).toHaveCount(0);
  expect(capturedCmsPageDeletes).toEqual([
    `DELETE /api/v1/admin/cms/pages/${cmsPageId}?organizationId=${defaultOrganizationId}&shopId=${barcelonaShopId}&locale=es-ES`,
  ]);
});

test("CMS page delete confirmation fits the mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/cms`);

  const row = page.getByRole("row", { name: /ReadIndex CMS Cert 1790167962/ });
  await row.getByRole("link", { name: "Eliminar ReadIndex CMS Cert 1790167962" }).click();

  const dialog = page.getByRole("dialog", { name: "Eliminar pagina CMS" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Confirmacion")).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`CSV admission ${viewport.width}: ready waits for explicit click before a single upload`, async ({ page }) => {
    await page.setViewportSize(viewport);
    let uploads = 0;
    let uploadedBody = "";
    await page.route("**/api/admin/catalog-import-jobs/readiness?*", route => route.fulfill({ json: admissionReady }));
    await page.route("**/api/admin/catalog-import-jobs/csv", async route => {
      uploads++;
      uploadedBody = route.request().postData() ?? "";
      await route.fulfill({ json: { importJobId: "admission-job", state: "STAGED" } });
    });
    const form = await openCsvAdmission(page);
    await form.getByLabel("CSV de productos", { exact: true }).setInputFiles(admissionCsv);
    await expect(form.getByRole("status")).toHaveText("Sugerencia: sistema listo para la importación");
    const start = form.getByRole("button", { name: "Iniciar importación", exact: true });
    await expect(start).toBeEnabled();
    expect(uploads).toBe(0);
    const screenshot = test.info().outputPath("csv-infrastructure-ready.png");
    await form.screenshot({ path: screenshot });
    await test.info().attach("csv-infrastructure-ready", { path: screenshot, contentType: "image/png" });
    expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("catalog-import:")))).toEqual([]);
    const box = await start.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    // Two clicks in one turn must not create two jobs before React renders.
    await start.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
    await expect(form.getByRole("button", { name: "Aplicar importación", exact: true })).toBeVisible();
    expect(uploads).toBe(1);
    expect(uploadedBody).toContain('filename="admission.csv"');
    expect(uploadedBody).toContain('name="categoryAssignment"');
    expect(uploadedBody).toContain('{"mode":"csv"}');
  });
}

test("CSV admission blocks failures and malformed responses, then retries the same file", async ({ page }) => {
  let uploads = 0;
  let attempt = 0;
  const results = [
    { status: 503, json: { ready: false, checks: [{ component: "inventory-import-bulk", ready: false }] } },
    { status: 401, json: { error: "Unauthorized" } },
    { status: 200, json: { ready: true, checks: [] } },
    { status: 200, json: { ready: true, checks: [null] } },
    { status: 200, json: admissionReady },
  ];
  await page.route("**/api/admin/catalog-import-jobs/readiness?*", route => route.fulfill(results[attempt++]));
  await page.route("**/api/admin/catalog-import-jobs/csv", route => { uploads++; return route.abort(); });
  const form = await openCsvAdmission(page);
  await form.getByLabel("CSV de productos", { exact: true }).setInputFiles(admissionCsv);
  await expect(form.getByRole("status")).toContainText("inventory-import-bulk");
  for (let index = 0; index < 4; index++) {
    await expect(form.getByRole("button", { name: "Iniciar importación", exact: true })).toBeDisabled();
    const response = page.waitForResponse(response => response.url().includes("/readiness?"));
    await form.getByRole("button", { name: "Comprobar infraestructura", exact: true }).click();
    await response;
    await expect(form.getByRole("button", { name: "Comprobar infraestructura", exact: true })).toBeEnabled();
  }
  await expect(form.getByRole("status")).toContainText("Sugerencia: sistema listo");
  expect(await form.getByLabel("CSV de productos", { exact: true }).evaluate(input => (input as HTMLInputElement).files?.[0]?.name)).toBe("admission.csv");
  expect(uploads).toBe(0);
});

test("CSV admission invalidates commercial and category changes and ignores a cancelled response", async ({ page }) => {
  let uploads = 0;
  let release!: () => void;
  let firstFinished!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  const finished = new Promise<void>(resolve => { firstFinished = resolve; });
  const queries: URLSearchParams[] = [];
  await page.route("**/api/admin/catalog-import-jobs/readiness?*", async route => {
    queries.push(new URL(route.request().url()).searchParams);
    if (queries.length === 1) {
      await delayed;
      try { await route.fulfill({ json: admissionReady }); } finally { firstFinished(); }
    } else await route.fulfill({ json: admissionReady });
  });
  await page.route("**/api/admin/catalog-import-jobs/csv", route => { uploads++; return route.abort(); });
  const form = await openCsvAdmission(page);
  const start = form.getByRole("button", { name: "Iniciar importación", exact: true });
  const check = form.getByRole("button", { name: "Comprobar infraestructura", exact: true });
  await form.getByLabel("CSV de productos", { exact: true }).setInputFiles(admissionCsv);
  await expect(form.getByRole("status")).toHaveText("Comprobando infraestructura…");
  await expect.poll(() => queries.length).toBe(1);
  await form.getByLabel("Canal de venta", { exact: true }).fill("outlet");
  release();
  await finished;
  await expect(start).toBeDisabled();
  await expect(form.getByRole("status")).toContainText("Es necesario comprobar");
  await check.click();
  await expect(start).toBeEnabled();
  expect(queries.at(-1)?.get("channel")).toBe("outlet");
  for (const [label, value] of [["Almacén", "another-warehouse"], ["Moneda", "USD"], ["País", "US"]]) {
    await form.getByLabel(label, { exact: true }).fill(value);
    await expect(start).toBeDisabled();
    await check.click();
    await expect(start).toBeEnabled();
  }
  await form.getByText("Opciones avanzadas de inventario", { exact: true }).click();
  for (const label of ["Publicar productos", "Disponibles para venta", "Gestionar inventario", "Permitir venta sin stock"]) {
    await form.getByLabel(label, { exact: true }).click();
    await expect(start).toBeDisabled();
    await check.click();
    await expect(start).toBeEnabled();
  }
  await form.getByRole("radio", { name: "Nueva categoría", exact: true }).check();
  await expect(start).toBeDisabled();
  await form.getByLabel("Nombre de la nueva categoría").fill("Nutrition test");
  await check.click();
  await expect(start).toBeEnabled();
  await form.getByLabel("Nombre de la nueva categoría").fill("Changed category");
  await expect(start).toBeDisabled();
  expect(uploads).toBe(0);
});

test("CSV admission rechecks a replacement file and respects BFF rejection at submission", async ({ page }) => {
  let checks = 0;
  let uploads = 0;
  await page.route("**/api/admin/catalog-import-jobs/readiness?*", route => { checks++; return route.fulfill({ json: admissionReady }); });
  await page.route("**/api/admin/catalog-import-jobs/csv", route => {
    uploads++;
    expect(route.request().postData()).toContain('filename="replacement.csv"');
    return route.fulfill({ status: 503, json: { error: "No se ha iniciado: Inventory no disponible." } });
  });
  const form = await openCsvAdmission(page);
  const file = form.getByLabel("CSV de productos", { exact: true });
  const start = form.getByRole("button", { name: "Iniciar importación", exact: true });
  await file.setInputFiles(admissionCsv);
  await expect(start).toBeEnabled();
  await file.setInputFiles({ ...admissionCsv, name: "replacement.csv" });
  await expect.poll(() => checks).toBe(2);
  await expect(start).toBeEnabled();
  expect(uploads).toBe(0);
  await start.click();
  await expect(form.getByText("No se ha iniciado: Inventory no disponible.", { exact: true })).toBeVisible();
  await expect(start).toBeDisabled();
  expect(uploads).toBe(1);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("catalog-import:")))).toEqual([]);
});

test("admin login authenticates without tenant fields and loads context afterwards", async ({ page }) => {
  await page.goto(`http://127.0.0.1:${nextPort}/auth/login`);

  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
  await expect(page.getByLabel("Tienda")).toHaveCount(0);
  await expect(page.getByLabel("Organization ID")).toHaveCount(0);
  await expect(page.getByLabel("Shop ID")).toHaveCount(0);

  await page.getByLabel("Email").fill("admin@example.com");
  await page.locator('input[name="password"]').fill("secret123");
  await page.getByRole("button", { name: "Entrar con BFF Auth" }).click();
  await page.waitForURL(`http://127.0.0.1:${nextPort}/admin`);

  expect(capturedLoginPayloads.at(-1)).toEqual({
    email: "admin@example.com",
    password: "secret123",
    scope: "admin",
  });
  expect(capturedLoginPayloads.at(-1)).not.toHaveProperty("organizationId");
  expect(capturedLoginPayloads.at(-1)).not.toHaveProperty("shopId");
  expect(capturedLoginPayloads.at(-1)).not.toHaveProperty("shopAlias");
});

test("admin sidebar submenu groups are collapsible", async ({ page }) => {
  await loginAdmin(page);

  const catalogGroup = page.locator("details.adminNavGroup").filter({ hasText: "Catalogo" });
  const catalogSummary = catalogGroup.locator("summary.adminNavParent");
  await expect(catalogSummary.locator(".adminNavChevron")).toBeVisible();
  await expect(catalogGroup.getByRole("link", { name: "Productos" })).toBeHidden();

  await catalogSummary.click();
  await expect(catalogGroup.getByRole("link", { name: "Productos" })).toBeVisible();
});

test("admin sidebar keeps only the current submenu item bold", async ({ page }) => {
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/comunicaciones`);

  const configurationGroup = page.locator("details.adminNavGroup").filter({ hasText: "Configuracion" });
  const summaryLink = configurationGroup.getByRole("link", { name: "Resumen" });
  const communicationsLink = configurationGroup.getByRole("link", { name: "Comunicaciones" });

  await expect(configurationGroup).toHaveAttribute("open", "");
  await expect(summaryLink).not.toHaveAttribute("aria-current", "page");
  await expect(communicationsLink).toHaveAttribute("aria-current", "page");
  await expect(summaryLink).not.toHaveClass(/adminNavActive/);
  await expect(communicationsLink).toHaveClass(/adminNavActive/);

  const summaryWeight = await summaryLink.locator(".adminNavLabel").evaluate((element) => getComputedStyle(element).fontWeight);
  const communicationsWeight = await communicationsLink.locator(".adminNavLabel").evaluate((element) => getComputedStyle(element).fontWeight);

  expect(Number(summaryWeight)).toBeLessThan(Number(communicationsWeight));
});

test("communications configuration saves email provider and bootstraps auth templates", async ({ page }) => {
  capturedCommunicationsAdminRequests.length = 0;
  capturedCommunicationsMutations.length = 0;
  Object.assign(emailProviderSettings, {
    provider: "stub",
    active: false,
    fromEmail: null,
    replyToEmail: null,
    smtpHost: null,
    smtpPort: null,
    smtpSecure: false,
    smtpUser: null,
    secretConfigured: false,
    secretUpdatedAt: null,
    updatedAt: "2026-07-01T10:00:00.000Z",
  });
  authEmailTemplates = [{
    templateId: "template-activation",
    templateKey: "customer.account.activation",
    locale: "es-ES",
    subjectTemplate: "Activa tu cuenta",
    status: "ACTIVE",
    requiredVariables: ["activationUrl"],
    version: 1,
    updatedAt: "2026-07-01T10:00:00.000Z",
    activatedAt: "2026-07-01T10:00:00.000Z",
  }];

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/comunicaciones`);

  await expect(page.getByRole("heading", { name: "Comunicaciones email" })).toBeVisible();
  await expect(page.locator('.communicationsWorkspace .adminKpi')).toHaveCount(0);
  const technicalStatus = page.locator('.communicationsTechnicalStatus');
  await expect(technicalStatus.getByRole('rowheader', {name:'Organization',exact:true})).toHaveCount(0);
  await expect(technicalStatus.getByRole('rowheader', {name:'Shop',exact:true})).toHaveCount(0);
  await expect(technicalStatus.getByRole('row', {name:/Plantillas Customer cargadas/})).toContainText('1');
  await expect(technicalStatus.getByRole('row', {name:/Email remitente/})).toBeVisible();
  const technicalBox = await technicalStatus.boundingBox();
  const providerGridBox = await page.locator('.communicationsTopGrid').boundingBox();
  const sendTestBox = await page.locator('.communicationsTopGrid > article').boundingBox();
  expect(Math.abs(technicalBox!.width-providerGridBox!.width)).toBeLessThanOrEqual(1);
  expect(technicalBox!.y+technicalBox!.height).toBeLessThanOrEqual(sendTestBox!.y);
  await captureEvidence(page, "05-provider-unified");

  await expect(page.getByRole("heading", { name: "Proveedor email", exact: true })).toHaveCount(0);
  await openCommunicationsSection(page, "Plantillas de Customer");
  await expect(page.getByRole("row", { name: /customer\.account\.activation/ })).toBeVisible();

  await page.getByRole("navigation", {name:"Comunicaciones",exact:true}).getByRole("link", {name:"Proveedor email",exact:true}).click();
  await page.getByRole("link", { name: "Configurar proveedor" }).click();
  const providerPanel = page.getByRole("dialog", { name: "Configurar proveedor email" });
  await expect(providerPanel.getByText("Password / API key")).toBeVisible();
  await captureEvidence(page, "06-provider-configuration");
  await providerPanel.getByLabel("Proveedor").selectOption("smtp");
  await providerPanel.getByLabel("Activo").check();
  await providerPanel.getByLabel("Email remitente").fill("Tienda <no-reply@ecommium.test>");
  await providerPanel.getByLabel("Reply-To").fill("soporte@ecommium.test");
  await providerPanel.getByLabel("SMTP host").fill("smtp.ecommium.test");
  await providerPanel.getByLabel("SMTP port").fill("465");
  await providerPanel.getByLabel("TLS/SSL directo").check();
  await providerPanel.getByLabel("Usuario SMTP / API user").fill("smtp-user");
  await providerPanel.getByLabel("Password / API key").fill("smtp-secret-playwright");
  await providerPanel.getByRole("button", { name: "Guardar email" }).click();

  await expect(page.getByText("Configuracion de email guardada.")).toBeVisible();
  await captureEvidence(page, "07-provider-saved");
  await expect(page.getByText("Configurado")).toBeVisible();
  await expect.poll(() => capturedCommunicationsMutations).toContainEqual({
    method: "PATCH",
    path: "/api/v1/admin/communications/settings/email-provider",
    body: {
      provider: "smtp",
      active: true,
      fromEmail: "Tienda <no-reply@ecommium.test>",
      replyToEmail: "soporte@ecommium.test",
      smtpHost: "smtp.ecommium.test",
      smtpPort: 465,
      smtpSecure: true,
      smtpUser: "smtp-user",
      secret: "smtp-secret-playwright",
    },
  });

  const templatesPanel = await openCommunicationsSection(page, "Plantillas de Customer");
  await templatesPanel.getByLabel("Sobrescribir defaults existentes").check();
  await templatesPanel.getByRole("button", { name: "Crear defaults auth" }).click();

  await expect(page.getByText("Plantillas auth listas: 4 creadas, 1 actualizadas, 0 existentes.")).toBeVisible();
  await openCommunicationsSection(page, "Plantillas de Customer");
  await expect(page.getByRole("row", { name: /customer\.account\.password-reset/ })).toBeVisible();
  await expect.poll(() => capturedCommunicationsMutations).toContainEqual({
    method: "POST",
    path: "/api/v1/admin/communications/templates/email/auth-defaults",
    body: {
      locale: "es-ES",
      overwrite: true,
    },
  });

  await page.getByRole("navigation", {name:"Comunicaciones",exact:true}).getByRole("link", {name:"Proveedor email",exact:true}).click();
  const testEmailPanel = page.locator(".adminSection").filter({
    has: page.getByRole("heading", { name: "Enviar prueba" }),
  });
  await expect(testEmailPanel.getByLabel("Destinatario de prueba")).toBeVisible();
  await testEmailPanel.getByLabel("Destinatario de prueba").fill("ricardo@example.com");
  await testEmailPanel.getByLabel("Plantilla").selectOption("customer.account.activation");
  await testEmailPanel.getByRole("button", { name: "Enviar prueba" }).evaluate((button) => {
    const submitter = button instanceof HTMLButtonElement ? button : undefined;
    submitter?.form?.requestSubmit(submitter);
  });

  await expect(page.getByText("Prueba de email procesada para ricardo@example.com. Delivery delivery-email-test en estado SENT.")).toBeVisible();
  await captureEvidence(page, "08-test-email");
  await expect.poll(() => capturedCommunicationsMutations.some((item) => (
    item.method === "POST"
    && item.path === "/api/v1/admin/communications/email/send"
    && (item.body.recipient as { email?: string } | undefined)?.email === "ricardo@example.com"
  ))).toBe(true);
  const testEmailMutation = capturedCommunicationsMutations.find((item) => item.path === "/api/v1/admin/communications/email/send");
  expect(testEmailMutation?.body).toMatchObject({
    templateKey: "customer.account.activation",
    locale: "es-ES",
    recipient: { email: "ricardo@example.com" },
    data: {
      customerName: "Prueba Ecommium",
      activationUrl: "https://example.test/account/activate?token=test",
      passwordResetUrl: "https://example.test/account/password-reset?token=test",
      supportEmail: "soporte@example.com",
      eventType: "email_provider_test",
    },
  });
  expect(String(testEmailMutation?.body.idempotencyKey)).toContain("admin-communications-test");
  expect(String(testEmailMutation?.body.sourceEventId)).toContain("admin.communications.test.");
  expect(capturedCommunicationsAdminRequests).toContain("GET /api/v1/admin/communications/settings/email-provider");
  expect(capturedCommunicationsAdminRequests).toContain("GET /api/v1/admin/communications/templates/email");
});

test("communications audit filters, inspects and retries a failed delivery", async ({ page }) => {
  capturedCommunicationsAdminRequests.length = 0;
  capturedCommunicationsMutations.length = 0;
  communicationsDeliveries = [{
    deliveryId: "delivery-failed-1",
    organizationId: defaultOrganizationId,
    shopId: barcelonaShopId,
    templateKey: "shipping.delivered",
    templateId: "template-shipping-delivered",
    channel: "EMAIL",
    locale: "es-ES",
    recipient: { email: "guest@example.com", customerId: "customer-guest-1" },
    data: {},
    attachments: [],
    idempotencyKey: "delivery-failed-1-idempotency",
    sourceEventId: "shipping.fulfillment.delivered.v1:fulfillment-1",
    renderedSnapshot: {
      subject: "Tu pedido ha sido entregado",
      html: "<p>Contenido privado</p>",
      text: "Enlace privado tracking-token",
    },
    status: "FAILED",
    attempts: [{
      attemptId: "attempt-failed-1",
      provider: "smtp",
      status: "FAILED",
      providerMessageId: null,
      errorMessage: "SMTP temporalmente no disponible",
      occurredAt: "2026-07-16T12:00:00.000Z",
    }],
    errorMessage: "SMTP temporalmente no disponible",
    sentAt: null,
    failedAt: "2026-07-16T12:00:00.000Z",
    skippedAt: null,
    createdAt: "2026-07-16T11:59:00.000Z",
    updatedAt: "2026-07-16T12:00:00.000Z",
  }];

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/comunicaciones`);

  await page.getByRole("navigation", {name:"Comunicaciones",exact:true}).getByRole("link", {name:"Auditoría de entregas",exact:true}).click();
  const filtersPanel = page.getByRole("form", { name: "Filtros de entregas", exact: true });
  await expect(page.getByRole("heading", {name:"Filtros de entregas",exact:true})).toHaveCount(0);
  await expect(page.getByRole("link", {name:"Volver",exact:true})).toHaveCount(0);
  await expect(page.getByRole("link", {name:"Limpiar",exact:true})).toHaveCount(0);
  await expect(page.getByRole("link", {name:"Ver fallidas",exact:true})).toHaveCount(0);
  expect(await filtersPanel.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(await page.locator('.communicationsWorkspace .adminTable th').first().evaluate(el => getComputedStyle(el).backgroundColor));
  for (const width of [1440,768,390]) {
    await page.setViewportSize({width,height:900});
    expect(await filtersPanel.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    const formBox = await filtersPanel.boundingBox();
    const panelBox = await page.locator('.communicationsWorkspace').boundingBox();
    expect(Math.abs(formBox!.width-panelBox!.width), JSON.stringify({width,formBox,panelBox})).toBeLessThanOrEqual(1);
  }
  await page.setViewportSize({width:1440,height:900});
  await page.screenshot({path:'.tmp/communications-audit-filters-desktop.png',fullPage:true});

  await filtersPanel.getByRole("checkbox", { name: "Ver fallidas", exact: true }).check();
  await expect(filtersPanel.getByRole("combobox", { name: "Estado", exact: true })).toHaveValue("FAILED");
  await filtersPanel.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page).toHaveURL(/deliveryStatus=FAILED/);
  await expect(filtersPanel.getByRole("checkbox", { name: "Ver fallidas", exact: true })).toBeChecked();
  await captureEvidence(page, "12-audit-failed-filter");
  await filtersPanel.getByRole("combobox", { name: "Estado", exact: true }).selectOption("SENT");
  await expect(filtersPanel.getByRole("checkbox", { name: "Ver fallidas", exact: true })).not.toBeChecked();
  await filtersPanel.getByRole("checkbox", { name: "Ver fallidas", exact: true }).check();

  const auditPanel = page.locator("section.adminCard").filter({ has: page.getByRole("heading", { name: "Auditoría de entregas" }) });
  await expect(auditPanel.getByRole("row", { name: /shipping\.delivered.*guest@example\.com/ })).toBeVisible();
  await auditPanel.getByRole("link", { name: "Ver detalle" }).click();

  const detailPanel = page.getByRole("dialog", { name: "Detalle de entrega email" });
  await expect(detailPanel.getByText("Intentos del proveedor")).toBeVisible();
  await expect(detailPanel.locator(".adminBannerError", { hasText: "SMTP temporalmente no disponible" })).toBeVisible();
  await expect(detailPanel).not.toContainText("tracking-token");
  await captureEvidence(page, "13-delivery-detail");
  await detailPanel.getByRole("button", { name: "Reintentar email" }).click();

  await expect(page.getByText("Entrega delivery-failed-1 reintentada. Estado actual: SENT.")).toBeVisible();
  await captureEvidence(page, "14-delivery-retried");
  await expect(detailPanel.locator(".adminSection > .adminBadge.adminBadgeOk", { hasText: "SENT" })).toBeVisible();
  await expect(detailPanel.getByRole("button", { name: "Reintentar email" })).toBeHidden();
  await expect.poll(() => capturedCommunicationsMutations).toContainEqual({
    method: "POST",
    path: "/api/v1/admin/communications/deliveries/delivery-failed-1/retry",
    body: {},
  });
});

test("communications template editor creates, previews and activates an email template", async ({ page }) => {
  capturedCommunicationsAdminRequests.length = 0;
  capturedCommunicationsMutations.length = 0;
  authEmailTemplates = [];

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/comunicaciones`);
  await openCommunicationsSection(page, "Plantillas de fulfillment");
  await page.getByRole("link", { name: "Crear plantilla" }).click();

  const createDrawer = page.getByRole("dialog", { name: "Crear plantilla email" });
  await expect(createDrawer.getByLabel("Formato de bloque")).toBeVisible();
  await captureEvidence(page, "10-template-editor");
  await expect(createDrawer.getByRole("button", { name: "Negrita" })).toBeVisible();
  await expect(createDrawer.getByRole("button", { name: "Cursiva" })).toBeVisible();
  await expect(createDrawer.getByRole("button", { name: "Tachado" })).toBeVisible();
  await expect(createDrawer.getByRole("button", { name: "Lista con vinetas" })).toBeVisible();
  await expect(createDrawer.getByRole("button", { name: "Lista numerada" })).toBeVisible();
  await expect(createDrawer.getByRole("button", { name: "Añadir enlace" })).toBeVisible();
  await expect(createDrawer.getByRole("button", { name: "Alinear a la izquierda" })).toBeVisible();
  await expect(createDrawer.getByRole("button", { name: "Centrar texto" })).toBeVisible();
  await expect(createDrawer.getByRole("button", { name: "Subir imagen" })).toBeDisabled();
  await createDrawer.getByLabel("Clave de plantilla").fill("shipping.delivery-custom");
  await createDrawer.getByLabel("Asunto").fill("Pedido entregado: ");
  await createDrawer.getByRole("button", { name: "{{customer.name}}" }).click();
  await expect(createDrawer.getByLabel("Asunto")).toHaveValue("Pedido entregado: {{customer.name}}");
  await createDrawer.getByLabel("HTML fuente de la plantilla").fill("<p>Hola {{customer.name}}</p>");
  await createDrawer.getByLabel("Texto plano").fill("Hola {{customer.name}}");
  // Preview data is managed by the editor; creation no longer exposes a JSON textarea.
  await createDrawer.getByRole("button", { name: "Crear borrador" }).click();

  await expect(page.getByText("Plantilla shipping.delivery-custom creada como borrador.")).toBeVisible();
  await openCommunicationsSection(page, "Plantillas de fulfillment");
  const templateRow = page.getByRole("row", { name: /shipping\.delivery-custom/ });
  await expect(templateRow.getByText("DRAFT")).toBeVisible();
  await templateRow.getByRole("link", { name: "Editar" }).click();

  const editDrawer = page.getByRole("dialog", { name: "Editar plantilla email" });
  await expect(editDrawer.getByRole("button", { name: "Subir imagen" })).toBeEnabled();
  await editDrawer.getByRole("button", { name: "Actualizar preview" }).click();
  const previewPanel = editDrawer.locator(".emailTemplatePreview");
  await expect(previewPanel.getByText("Preview desde Communications")).toBeVisible();
  await expect(previewPanel.locator("iframe")).toHaveAttribute("srcdoc", /Hola {{customer\.name}}/);
  await captureEvidence(page, "11-template-preview");
  await editDrawer.getByRole("button", { name: "Activar plantilla" }).click();

  await expect(page.getByText("Plantilla shipping.delivery-custom activada.")).toBeVisible();
  await openCommunicationsSection(page, "Plantillas de fulfillment");
  await expect(page.getByRole("row", { name: /shipping\.delivery-custom/ }).getByText("ACTIVE")).toBeVisible();
  await expect.poll(() => capturedCommunicationsMutations.some((mutation) => (
    mutation.method === "POST"
    && mutation.path.endsWith("/activate")
  ))).toBe(true);
});

test("customers admin opens the current detail page and navigates profile addresses and purchases", async ({ page }) => {
  capturedCustomersAdminRequests.length = 0;

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/clientes`);

  await expect(page.getByRole("heading", { name: "Clientes", exact: true })).toBeVisible();
  await expect(page.getByText("Vista 360 de clientes")).toBeVisible();
  await expect(page.getByRole("link", { name: "Todos los clientes", exact: true })).toBeVisible();
  await expect(page.getByRole("row", { name: /Ada Lovelace/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Ada Lovelace/ }).getByRole("cell", { name: "Registrado", exact: true })).toBeVisible();
  expect(capturedCustomersAdminRequests).toContain(
    `GET /api/v1/admin/customers?organizationId=${defaultOrganizationId}&shopId=${barcelonaShopId}&limit=100&offset=0`,
  );

  await page.getByRole("link", { name: "Crear cliente" }).click();
  await expect(page.locator(".customersDrawerBackdrop")).toBeVisible();
  await expect(page.locator(".adminSideDrawer").getByRole("heading", { name: "Crear cliente" })).toBeVisible();
  await expect(page.locator(".adminSideDrawer").getByRole("button", { name: "Crear cliente" })).toBeVisible();
  await page.locator(".adminSideDrawer").getByRole("link", { name: "Cerrar" }).click();
  await expect(page.locator(".customersDrawerBackdrop")).toHaveCount(0);

  await page.getByRole("link", { name: /Ver Ada Lovelace/ }).click();
  const detail = page.locator(".customerDetailShell");
  await expect(detail.getByRole("heading", { name: "Ada Lovelace", exact: true })).toBeVisible();
  await expect(detail.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
  const tabs = page.getByRole("navigation", { name: "Secciones del cliente" });
  await tabs.getByRole("link", { name: "Perfil", exact: true }).click();
  await expect(detail.getByRole("heading", { name: "Perfil", exact: true })).toBeVisible();
  await expect(detail.getByRole("heading", { name: "Direcciones", exact: true })).toHaveCount(0);
  await expect(detail.getByRole("button", { name: "Guardar perfil" })).toBeVisible();
  await tabs.getByRole("link", { name: "Direcciones", exact: true }).click();
  await expect(detail.getByRole("heading", { name: "Direcciones", exact: true })).toBeVisible();
  await expect(detail.getByRole("link", { name: "Agregar nueva", exact: true })).toBeVisible();
  await detail.getByRole("link", { name: "Agregar nueva", exact: true }).click();
  const addressDrawer=page.getByRole("dialog",{name:"Nueva dirección",exact:true});
  await expect(addressDrawer.getByLabel("Nombre de la dirección",{exact:true})).toBeVisible();
  await addressDrawer.getByRole("link",{name:"Cancelar",exact:true}).click();
  await expect(addressDrawer).toHaveCount(0);
  await expect(page).toHaveURL(/tab=direcciones/);
  await expect(detail.getByRole("row", { name: /Ada Lovelace Ambas Calle Mayor/ })).toBeVisible();
  await detail.getByRole("link",{name:"Editar Ada Lovelace",exact:true}).click();
  const editAddress=page.getByRole("dialog",{name:"Editar dirección",exact:true});
  await expect(editAddress.getByLabel("Calle",{exact:true})).toHaveValue("Calle Mayor");
  await editAddress.getByRole("link",{name:"Cerrar",exact:true}).click();
  await expect(editAddress).toHaveCount(0);
  await expect(page).toHaveURL(/tab=direcciones/);
  await tabs.getByRole("link", { name: "Compras", exact: true }).click();
  await expect(detail.getByRole("row", { name: /order-playwright.*PAID/ })).toBeVisible();
  await expect(detail.getByRole("link", { name: "Abrir pedido" })).toHaveAttribute("href", "/admin/pedidos?orderId=order-playwright");
  await tabs.getByRole("link",{name:"Facturación",exact:true}).click();
  await expect(detail.getByRole("heading",{name:"Facturación",exact:true})).toBeVisible();
  await expect(detail.getByRole("table",{name:"Información de facturación",exact:true})).toBeVisible();

  expect(capturedCustomersAdminRequests.some((item) => item.startsWith("GET /api/v1/admin/customers?"))).toBe(true);
  expect(capturedCustomersAdminRequests).toContain(
    `GET /api/v1/admin/customers/customer-playwright?organizationId=${defaultOrganizationId}&shopId=${barcelonaShopId}`,
  );
  expect(capturedCustomersAdminRequests).toContain(
    `GET /api/v1/admin/customers/customer-playwright/addresses?organizationId=${defaultOrganizationId}&shopId=${barcelonaShopId}`,
  );
  expect(capturedCustomersAdminRequests).toContain(
    `GET /api/v1/admin/customers/customer-playwright/purchases?organizationId=${defaultOrganizationId}&shopId=${barcelonaShopId}&limit=5&offset=0`,
  );
});

test("customers admin hides purchases when the session lacks purchases permission", async ({ page }) => {
  authPermissions = ["customers.read", "customers.addresses.write"];
  capturedCustomersAdminRequests.length = 0;

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/clientes/C000001`);

  const drawer = page.locator(".customerDetailShell");
  await expect(drawer.getByRole("heading", { name: "Ada Lovelace", exact: true })).toBeVisible();
  await expect(drawer.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
  const tabs = page.getByRole("navigation", { name: "Secciones del cliente" });
  await tabs.getByRole("link", { name: "Perfil", exact: true }).click();
  await expect(page.getByRole("button", { name: "Guardar perfil" })).toBeVisible();
  await tabs.getByRole("link", { name: "Compras", exact: true }).click();
  await expect(page.getByText("Falta permiso customers.purchases.read para consultar compras.")).toBeVisible();
  await expect(page.getByText("order-playwright", { exact: true })).toHaveCount(0);

  expect(capturedCustomersAdminRequests).toContain(
    `GET /api/v1/admin/customers/customer-playwright?organizationId=${defaultOrganizationId}&shopId=${barcelonaShopId}`,
  );
  expect(capturedCustomersAdminRequests).toContain(
    `GET /api/v1/admin/customers/customer-playwright/addresses?organizationId=${defaultOrganizationId}&shopId=${barcelonaShopId}`,
  );
  expect(capturedCustomersAdminRequests.some((item) => item.includes("/purchases?"))).toBe(false);
});

test("catalog attributes and features page filters and creates feature values through BFF", async ({ page }) => {
  capturedCatalogSpecificationRequests.length = 0;
  const existingIndex = catalogSpecificationGroups.findIndex((group) => group.specificationGroupId === "spec-group-playwright");
  if (existingIndex >= 0) {
    catalogSpecificationGroups.splice(existingIndex, 1);
  }
  const browserExternalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "127.0.0.1" && url.port && Number(url.port) !== nextPort) {
      browserExternalRequests.push(request.url());
    }
  });

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/catalogo/atributos-caracteristicas?tab=features`);

  await expect(page.getByRole("heading", { name: "Caracteristicas Tecnicas", exact: true })).toBeVisible();
  const catalogDataModeNav = page.getByLabel("Tipo de dato catalogo");
  await expect(catalogDataModeNav.getByRole("link", { name: "Atributos", exact: true })).toBeVisible();
  await expect(catalogDataModeNav.getByRole("link", { name: "Caracteristicas", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "ID" })).toBeVisible();
  await expect(page.getByLabel("Filtrar por ID superior")).toBeVisible();
  await expect(page.getByLabel("Filtrar por nombre superior")).toBeVisible();
  await expect(page.getByLabel("Filtrar por grupo superior")).toBeVisible();
  await expect(page.getByLabel("Filtrar por ID", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Filtrar por nombre", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Filtrar por grupo", { exact: true })).toHaveCount(0);

  const filterForm = page.getByRole("form", { name: "Filtros superiores" });
  await expect(filterForm).toHaveCSS("flex-direction", "row");
  await expect(filterForm).toHaveCSS("flex-wrap", "wrap");
  await catalogDataModeNav.getByRole("link", { name: "Atributos", exact: true }).click();
  await expect(page).toHaveURL(/tab=attributes/);
  await expect(page.locator("h1", { hasText: "Atributos de combinacion" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Atributo" })).toBeVisible();
  const colorAttributeRow = page.getByRole("row", { name: /field-co.*Color.*Combinacion/ });
  await expect(colorAttributeRow).toBeVisible();
  await expect(colorAttributeRow.getByText("Rojo")).toBeVisible();
  await catalogDataModeNav.getByRole("link", { name: "Caracteristicas", exact: true }).click();
  await expect(page).toHaveURL(/tab=features/);
  await filterForm.getByLabel("Filtrar por nombre superior").fill("Composicion");
  await filterForm.getByRole("button", { name: "Buscar" }).click();
  await expect(page).toHaveURL(/q=Composicion/);
  await expect(page.getByRole("row", { name: /field-co.*Composicion.*Ficha tecnica/ })).toBeVisible();

  await page.getByRole("link", { name: "Limpiar" }).click();
  await expect(page).toHaveURL(/tab=features/);

  await page.getByRole("link", { name: "Crear caracteristica" }).click();
  await expect(page).toHaveURL(/panel=create/);
  await expect(page.getByRole("dialog", { name: "Crear caracteristica" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Crear caracteristica" })).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator(".adminSideDrawerHeader")).toHaveCSS("color", "rgb(11, 11, 11)");
  await expect(page.locator(".adminDrawerBackdrop")).toBeVisible();
  await expect(page.locator(".adminFeatureContent")).toHaveCSS("filter", /blur\(2px\)/);
  const createForm = page.getByRole("form", { name: "Crear caracteristica" });
  await createForm.locator('select[name="groupId"]').selectOption("");
  await createForm.locator('input[name="groupName"]').fill("Playwright specs");
  await createForm.locator('select[name="categoryId"]').selectOption("category-bikes");
  await createForm.locator('input[name="name"]').fill("Material Playwright");
  await createForm.locator('input[name="values"]').fill("Carbono, Aluminio");
  await createForm.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page).toHaveURL(/tab=features&createdFieldId=field-playwright-0/);
  await expect(page.getByRole("dialog", { name: "Crear caracteristica" })).toHaveCount(0);

  const createdRow = page.getByRole("row", { name: /field-pl.*Material Playwright.*Playwright specs/ });
  await expect(createdRow).toBeVisible();
  await expect(createdRow.getByText("Carbono")).toBeVisible();
  await expect(createdRow.getByText("Aluminio")).toBeVisible();
  await expect(createdRow.getByRole("link", { name: "Editar Material Playwright" })).toBeVisible();
  await expect(createdRow.getByRole("button", { name: "Desactivar Material Playwright" })).toBeVisible();
  await createdRow.getByRole("button", { name: "Quitar valor Carbono" }).click();
  await expect.poll(() => capturedCatalogSpecificationRequests).toContain("PATCH /api/v1/admin/specifications/groups/spec-group-playwright");
  const updatedRow = page.getByRole("row", { name: /field-pl.*Material Playwright.*Playwright specs/ });
  await expect(updatedRow.getByText("Carbono")).toHaveCount(0);
  await expect(updatedRow.getByText("Aluminio")).toBeVisible();
  await updatedRow.getByRole("link", { name: "Editar Material Playwright" }).click();
  await expect(page).toHaveURL(/panel=edit/);
  await expect(page.getByRole("dialog", { name: /Editar caracteristica: field-pl/i })).toBeVisible();
  await expect(page.getByRole("form", { name: "Editar Material Playwright" })).toBeVisible();
  await expect(page.getByRole("form", { name: "Anadir valor Material Playwright" })).toBeVisible();
  await expect(page.getByRole("form", { name: "Editar Material Playwright" }).locator('input[name="name"]')).toHaveCSS("height", "40px");
  await expect(page.getByLabel("Nuevo valor Material Playwright")).toHaveCSS("height", "40px");
  await expect(page.getByLabel("Nuevo valor Material Playwright")).toHaveCSS("border-radius", "4px");
  await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: /Editar caracteristica: field-pl/i }).getByRole("button", { name: "Desactivar Material Playwright" })).toBeVisible();
  expect(capturedCatalogSpecificationRequests).toContain("GET /api/v1/admin/specifications/groups");
  expect(capturedCatalogSpecificationRequests).toContain("POST /api/v1/admin/specifications/groups");
  expect(browserExternalRequests).toEqual([]);
});

test("catalog offerings page manages services through BFF", async ({ page }) => {
  capturedCatalogOfferingRequests.length = 0;
  const existingIndex = catalogOfferings.findIndex((offering) => offering.offeringId === "offering-playwright");
  if (existingIndex >= 0) {
    catalogOfferings.splice(existingIndex, 1);
  }

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/catalogo/offerings`);

  await expect(page.getByRole("heading", { name: "Offerings / Servicios adicionales" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Offering" })).toBeVisible();
  await expect(page.getByRole("textbox",{name:"Nombre Instalacion",exact:true})).toBeVisible();

  const filterForm = page.getByRole("form", { name: "Filtros de offerings" });
  await expect(filterForm).toHaveCSS("display", "grid");
  await filterForm.getByLabel("Filtrar offering por nombre").fill("Instalacion");
  await filterForm.getByRole("button", { name: "Buscar" }).click();
  await expect(page).toHaveURL(/q=Instalacion/);
  await expect(page.getByRole("textbox",{name:"Nombre Instalacion",exact:true})).toBeVisible();

  await page.getByRole("link", { name: "Crear nueva",exact:true }).click();
  await expect(page.getByRole("dialog", { name: "Crear offering" })).toBeVisible();
  const createForm = page.getByRole("form", { name: "Crear offering" });
  await createForm.locator('input[name="name"]').fill("Montaje Playwright");
  await createForm.locator('select[name="type"]').selectOption("service");
  await createForm.locator('input[name="price"]').fill("14.50");
  await createForm.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("textbox",{name:"Nombre Montaje Playwright",exact:true})).toBeVisible();

  const createdRow = page.getByRole("row", { name: /Montaje Playwright.*service.*14,50/ });
  await createdRow.getByRole("button",{name:"Acciones de Montaje Playwright",exact:true}).click();
  await page.getByRole("link", { name: "Editar Montaje Playwright" }).click();
  await expect(page.getByRole("dialog", { name: /Editar offering: offering/ })).toBeVisible();
  const editForm = page.getByRole("form", { name: "Editar Montaje Playwright" });
  await editForm.locator('input[name="name"]').fill("Montaje Premium");
  await editForm.locator('input[name="price"]').fill("19.99");
  await editForm.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("textbox",{name:"Nombre Montaje Premium",exact:true})).toBeVisible();

  const updatedRow = page.getByRole("row").filter({ has: page.getByRole("textbox", { name: "Nombre Montaje Premium", exact: true }) });
  await updatedRow.getByRole("button",{name:"Acciones de Montaje Premium",exact:true}).click();
  page.once("dialog",dialog=>dialog.accept());
  await page.getByRole("button", { name: "Desactivar",exact:true }).click();
  await expect(page.getByRole("textbox",{name:"Nombre Montaje Premium",exact:true})).toHaveCount(0);
  expect(capturedCatalogOfferingRequests).toContain("GET /api/v1/admin/offerings");
  expect(capturedCatalogOfferingRequests).toContain("POST /api/v1/admin/offerings");
  expect(capturedCatalogOfferingRequests).toContain("PATCH /api/v1/admin/offerings/offering-playwright");
  expect(capturedCatalogOfferingRequests).toContain("DELETE /api/v1/admin/offerings/offering-playwright");
});

test("pricing configuration exposes master data and creates customer groups through BFF", async ({ page }) => {
  capturedPricingGovernanceRequests.length = 0;
  capturedPricingMutations.length = 0;
  pricingReferenceState["customer-groups"] = pricingReferenceState["customer-groups"].filter((item) =>
    item.code !== "playwright-vip"
  );
  const browserExternalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "127.0.0.1" && url.port && Number(url.port) !== nextPort) {
      browserExternalRequests.push(request.url());
    }
  });

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/precios?tab=references`);

  await expect(page.getByRole("heading", { name: "Configuracion de precios" })).toBeVisible();
  await expect(page.getByText("Admin / Configuracion / Precios")).toBeVisible();
  await expect(page.getByRole("link", { name: "Parametros" })).toHaveClass(/productEditorTabActive/);
  await expect(page.getByRole("heading", { name: /^Grupos de cliente \(/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Canales \(/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Politicas comerciales \(/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Paises \(/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /vip VIP/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /web Web/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /default Default/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /ES Espana/ })).toBeVisible();

  await expect(page.locator('input[name="code"]:not([type="hidden"])')).toHaveCount(0);
  for (const label of ["Crear nuevo país", "Crear nuevo canal", "Crear nueva política comercial"]) {
    await page.getByRole("link", { name: `+ ${label}`, exact: true }).click();
    const drawer = page.getByRole("dialog", { name: label, exact: true });
    await expect(drawer.getByLabel("Codigo")).toBeVisible();
    await drawer.getByRole("link", { name: "Cerrar", exact: true }).click();
    await expect(drawer).toHaveCount(0);
  }
  await page.getByRole("link", { name: "+ Crear nuevo grupo", exact: true }).click();
  const customerGroupPanel = page.getByRole("dialog", { name: "Crear nuevo grupo", exact: true });
  await customerGroupPanel.getByLabel("Codigo").fill("playwright-vip");
  await customerGroupPanel.getByLabel("Nombre").fill("Playwright VIP");
  await customerGroupPanel.getByLabel("Ayuda").fill("Grupo creado desde Playwright.");
  await customerGroupPanel.getByRole("button", { name: "Guardar" }).click();

  await expect(page.getByText("Parametro guardado.")).toBeVisible();
  await expect(customerGroupPanel).toHaveCount(0);
  await expect(page.getByRole("row", { name: /playwright-vip Playwright VIP/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Impuestos" })).toBeVisible();
  await page.getByRole("link", { name: "Impuestos" }).click();
  await expect(page.getByRole("row", { name: /default-iva Default IVA/ })).toBeVisible();
  await page.getByRole("link", { name: "Price tables" }).click();
  await expect(page.getByRole("row", { name: /vip-table VIP table/ })).toBeVisible();

  expect(capturedPricingGovernanceRequests).toContain("GET /api/v1/admin/pricing/customer-groups");
  expect(capturedPricingGovernanceRequests).toContain("GET /api/v1/admin/pricing/channels");
  expect(capturedPricingGovernanceRequests).toContain("GET /api/v1/admin/pricing/trade-policies");
  expect(capturedPricingGovernanceRequests).toContain("GET /api/v1/admin/pricing/countries");
  expect(capturedPricingMutations).toContainEqual({
    method: "POST",
    path: "/api/v1/admin/pricing/customer-groups",
    body: {
      code: "playwright-vip",
      name: "Playwright VIP",
      helpText: "Grupo creado desde Playwright.",
      active: true,
    },
  });
  expect(browserExternalRequests).toEqual([]);
});

test("pricing configuration resolves computed auto prices through BFF", async ({ page }) => {
  capturedPricingGovernanceRequests.length = 0;
  capturedPricingMutations.length = 0;
  const browserExternalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "127.0.0.1" && url.port && Number(url.port) !== nextPort) {
      browserExternalRequests.push(request.url());
    }
  });

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/precios?tab=computed-auto&itemId=variant-computed-auto`);

  await expect(page.getByRole("heading", { name: "Configuracion de precios" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Computed auto" })).toHaveClass(/productEditorTabActive/);
  const itemPanel = page.locator("section.pricingPanel").filter({
    has: page.getByRole("heading", { name: "Computed auto item" }),
  });
  const batchPanel = page.locator("section.pricingPanel").filter({
    has: page.getByRole("heading", { name: "Computed auto batch" }),
  });
  await expect(itemPanel.getByRole("term").filter({ hasText: "grossMinor" })).toBeVisible();
  await expect(itemPanel.getByText("9300")).toBeVisible();
  await expect(itemPanel.getByText("FIXED_PRICE")).toBeVisible();
  await expect(batchPanel.getByRole("row", { name: /variant-computed-auto vip-table 7686 1614 9300 EUR FIXED_PRICE/ })).toBeVisible();

  expect(capturedPricingGovernanceRequests).toContain("GET /api/v1/admin/pricing/prices/variant-computed-auto/computed-auto");
  expect(capturedPricingGovernanceRequests).toContain("POST /api/v1/admin/pricing/prices/computed-auto/resolve-batch");
  expect(capturedPricingMutations).toContainEqual({
    method: "POST",
    path: "/api/v1/admin/pricing/prices/computed-auto/resolve-batch",
    body: { itemIds: ["variant-computed-auto"] },
  });
  expect(browserExternalRequests).toEqual([]);
});

test("pricing governance page manages campaign fixed prices through Pricing BFF", async ({ page }) => {
  capturedPricingGovernanceRequests.length = 0;
  capturedPricingMutations.length = 0;
  const itemId = "variant-discount-playwright";
  const productId = "product-discount-playwright";
  const existingIndex = pricingFixedPrices.findIndex((price) => price.itemId === itemId && price.priceTableId === "vip-table");
  if (existingIndex >= 0) {
    pricingFixedPrices.splice(existingIndex, 1);
  }
  const browserExternalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "127.0.0.1" && url.port && Number(url.port) !== nextPort) {
      browserExternalRequests.push(request.url());
    }
  });

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/precios?tab=fixed&priceTableId=vip-table&itemId=${itemId}&productId=${productId}&customerGroup=vip&channel=web&tradePolicy=default&country=ES&quantity=2`);

  await expect(page.getByRole("heading", { name: "Configuracion de precios" })).toBeVisible();
  await expect(page.getByText("Admin / Configuracion / Precios")).toBeVisible();
  await expect(page.getByRole("link", { name: "Fixed prices" })).toHaveClass(/productEditorTabActive/);
  await expect(page.getByText("No hay precios fijados para la variante.")).toBeVisible();

  await page.getByRole("link", { name: "Fijar precio", exact: true }).click();
  const fixedForm = page.getByRole("dialog", { name: "Fijar precio", exact: true }).locator("form").filter({
    has: page.getByRole("button", { name: "Guardar precio fijado" }),
  });
  await fixedForm.locator('input[name="fixedPriceMinor"]').fill("8799");
  await fixedForm.locator('input[name="basePriceMinor"]').fill("9999");
  await fixedForm.locator('input[name="listPriceMinor"]').fill("12999");
  await fixedForm.getByRole("button", { name: "Guardar precio fijado" }).click();

  await expect(page.getByText("Fixed price guardado.")).toBeVisible();
  await expect(page.getByRole("row", { name: /variant-discount-playwright.*product-discount-playwright.*vip-table.*8799.*9999.*12999/ })).toBeVisible();

  expect(capturedPricingGovernanceRequests).toContain("GET /api/v1/admin/pricing/price-tables");
  expect(capturedPricingGovernanceRequests).toContain(`GET /api/v1/admin/pricing/prices/${itemId}/fixed`);
  expect(capturedPricingGovernanceRequests).not.toContain("GET /api/v1/admin/pricing/price-tables/vip-table/rules");
  expect(capturedPricingGovernanceRequests).toContain("PUT /api/v1/admin/pricing/prices/variant-discount-playwright/fixed/vip-table");
  expect(capturedPricingMutations).toContainEqual({
    method: "PUT",
    path: "/api/v1/admin/pricing/prices/variant-discount-playwright/fixed/vip-table",
    body: {
      productId,
      itemId,
      priceTableId: "vip-table",
      fixedPriceMinor: 8799,
      basePriceMinor: 9999,
      listPriceMinor: 12999,
      currency: "EUR",
      timezone: "Europe/Madrid",
      taxIncluded: true,
      active: true,
    },
  });
  expect(browserExternalRequests).toEqual([]);
});

test("shipping configuration manages carriers with drawers and active actions through BFF", async ({ page }) => {
  capturedShippingAdminRequests.length = 0;
  capturedShippingActiveMutations.length = 0;
  shippingConfiguration.carriers[0].active = true;
  const browserExternalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "127.0.0.1" && url.port && Number(url.port) !== nextPort) {
      browserExternalRequests.push(request.url());
    }
  });

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/transporte?tab=carriers`);

  await expect(page.getByRole("heading", { name: "Transporte" })).toBeVisible();
  await expect(page.getByText("Admin / Configuracion / Transporte")).toBeVisible();
  await expect(page.getByRole("link", { name: "Transportistas" })).toHaveClass(/productEditorTabActive/);
  await expect(page.getByLabel("Transporte").getByRole("link", { name: "Transportistas" })).toBeVisible();

  await page.getByRole("link", { name: "Crear transportista" }).click();
  await expect(page).toHaveURL(/drawer=create/);
  await expect(page.locator(".adminSideDrawer")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Crear transportista" })).toBeVisible();
  await page.locator(".adminSideDrawer").getByRole("link", { name: "Cerrar" }).click();
  await expect(page.locator(".adminSideDrawer")).toHaveCount(0);

  const carrierRow = page.getByRole("row", { name: /carrier-standard.*Carrier Standard/ });
  await expect(carrierRow).toBeVisible();
  await carrierRow.getByRole("link", { name: "Editar" }).click();
  await expect(page).toHaveURL(/drawer=edit/);
  await expect(page.getByRole("heading", { name: "Editar transportista" })).toBeVisible();
  await expect(page.locator(".adminSideDrawer").locator('input[name="carrierId"]')).toHaveValue("carrier-standard");
  await page.locator(".adminSideDrawer").getByRole("link", { name: "Cerrar" }).click();

  await carrierRow.getByRole("button", { name: "Desactivar" }).click();
  await expect(page.getByText("Recurso desactivado.")).toBeVisible();
  await expect.poll(() => capturedShippingActiveMutations).toContainEqual({
    method: "PATCH",
    path: "/api/v1/admin/shipping/carriers/carrier-standard/active",
    body: {
      active: false,
    },
  });
  // Since 2026-10-30 this screen lists active resources only, with no reactivation.
  await expect(carrierRow).toHaveCount(0);
  expect(capturedShippingActiveMutations).toHaveLength(1);

  await page.getByRole("link", { name: "Simulador" }).click();
  await expect(page.getByRole("heading", { name: "Simular cotizacion" })).toBeVisible();
  await expect(page.getByLabel("Codigo postal")).toHaveValue("28001");
  await expect(page.getByLabel("Precio item minor")).toHaveValue("4000");
  await expect(page.getByLabel("Subtotal minor")).toBeVisible();
  await expect(page.getByLabel("Customer group")).toBeVisible();

  expect(capturedShippingAdminRequests).toContain(
    `GET /api/v1/admin/shipping/configuration?organizationId=${defaultOrganizationId}&shopId=${barcelonaShopId}`,
  );
  expect(browserExternalRequests).toEqual([]);
});

test("shipping fulfillment queue filters, inspects and transitions through BFF", async ({ page }) => {
  capturedShippingAdminRequests.length = 0;
  capturedShippingFulfillmentMutations.length = 0;
  Object.assign(shippingFulfillments[0], {
    version: 4,
    status: "PACKED",
    trackingNumber: null,
    carrierId: "carrier-standard",
    updatedAt: "2026-07-16T11:00:00.000Z",
    shippedAt: null,
    deliveredAt: null,
  });
  const browserExternalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "127.0.0.1" && url.port && Number(url.port) !== nextPort) {
      browserExternalRequests.push(request.url());
    }
  });

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/transporte?tab=fulfillments&fulfillmentStatus=PACKED&fulfillmentsLimit=25&fulfillmentsOffset=0`);

  await expect(page.getByLabel("Transporte").getByRole("link", { name: "Fulfillments" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Cola global de fulfillments" })).toBeVisible();
  await expect(page.getByLabel("Estado")).toHaveValue("PACKED");
  const fulfillmentRow = page.getByRole("row", { name: /E2E-0001.*Empaquetado.*Carrier Standard.*Sin tracking/ });
  await expect(fulfillmentRow).toBeVisible();
  await fulfillmentRow.getByRole("link", { name: "Ver envío" }).click();

  const drawer = page.locator(".adminSideDrawer");
  await expect(drawer.getByRole("heading", { name: "Detalle de fulfillment" })).toBeVisible();
  await expect(drawer.getByText("Ada Lovelace")).toBeVisible();
  await expect(drawer.getByText("Bicicleta E2E")).toBeVisible();
  await drawer.getByLabel("Número de tracking").fill("TRACK-E2E-1");
  await drawer.getByRole("button", { name: "Marcar como enviado" }).click();

  await expect(page.getByText("Estado logístico actualizado a SHIPPED.")).toBeVisible();
  await expect(drawer.locator(".adminBadge").filter({ hasText: "Enviado" })).toBeVisible();
  await expect(drawer.getByText("TRACK-E2E-1", { exact: true })).toBeVisible();
  await expect.poll(() => capturedShippingFulfillmentMutations).toContainEqual({
    method: "PATCH",
    path: "/api/v1/admin/shipping/fulfillments/fulfillment-e2e-1/status",
    body: {
      status: "SHIPPED",
      trackingNumber: "TRACK-E2E-1",
      carrierId: "carrier-standard",
    },
  });
  expect(capturedShippingAdminRequests).toContain(
    `GET /api/v1/admin/shipping/fulfillments?organizationId=${defaultOrganizationId}&shopId=${barcelonaShopId}&status=PACKED&limit=25&offset=0`,
  );
  expect(browserExternalRequests).toEqual([]);
});

test("seo configuration manages routes and redirects through BFF drawers", async ({ page }) => {
  capturedSeoAdminRequests.length = 0;
  capturedSeoMutations.length = 0;
  seoRoutes[0].path = "/producto-demo/p";
  seoRoutes[0].status = "ACTIVE";
  seoRoutes[0].includeInSitemap = true;
  const browserExternalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "127.0.0.1" && url.port && Number(url.port) !== nextPort) {
      browserExternalRequests.push(request.url());
    }
  });

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/seo?tab=routes&locale=es-ES&status=ACTIVE`);

  await expect(page.getByRole("heading", { name: "SEO" })).toBeVisible();
  await expect(page.getByText("Admin / Configuracion / SEO")).toBeVisible();
  await expect(page.getByRole("link", { name: "Rutas" })).toHaveClass(/productEditorTabActive/);
  await expect(page.getByLabel("SEO").getByRole("link", { name: "Rutas" })).toBeVisible();

  const seoFilters = page.getByRole("form", { name: "Filtrar rutas y redirecciones" });
  await expect(seoFilters).toHaveCSS("display", "flex");
  for (const field of ["locale", "status", "entityType", "entityId"]) {
    await expect(seoFilters.locator(`[name="${field}"]`)).toHaveCSS("height", "40px");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const filterBox = await seoFilters.boundingBox();
  expect(filterBox!.width).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1366, height: 900 });

  await page.getByRole("link", { name: "Crear ruta" }).click();
  await expect(page).toHaveURL(/drawer=create/);
  await expect(page.locator(".adminSideDrawer")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Crear ruta SEO" })).toBeVisible();
  await expect(page.locator(".adminSideDrawer").getByLabel("Path")).toBeVisible();
  await page.locator(".adminSideDrawer").getByRole("link", { name: "Cerrar" }).click();
  await expect(page.locator(".adminSideDrawer")).toHaveCount(0);

  const routeRow = page.getByRole("row", { name: /route-product.*\/producto-demo\/p.*PRODUCT.*product-demo/ });
  await expect(routeRow).toBeVisible();
  await routeRow.getByRole("link", { name: "Editar" }).click();
  await expect(page).toHaveURL(/drawer=edit/);
  await expect(page.getByRole("heading", { name: "Editar ruta SEO" })).toBeVisible();
  const drawer = page.locator(".adminSideDrawer");
  await expect(drawer.locator('input[name="path"]')).toHaveValue("/producto-demo/p");
  await drawer.locator('input[name="path"]').fill("/producto-demo-editado/p");
  await drawer.locator('select[name="createRedirectFromPreviousPath"]').selectOption("true");
  await drawer.getByRole("button", { name: "Guardar ruta" }).click();
  await expect(page.getByText("Ruta SEO actualizada.")).toBeVisible();
  await expect.poll(() => capturedSeoMutations).toContainEqual({
    method: "PATCH",
    path: "/api/v1/admin/routing-seo/routes/route-product",
    body: {
      path: "/producto-demo-editado/p",
      status: "ACTIVE",
      includeInSitemap: true,
      createRedirectFromPreviousPath: true,
    },
  });
  expect(capturedSeoMutations.at(-1)?.body).not.toHaveProperty("canonicalRouteId");
  await expect(page.getByRole("row", { name: /route-product.*\/producto-demo-editado\/p/ })).toBeVisible();

  await page.getByRole("link", { name: "Redirecciones" }).click();
  await expect(page.getByRole("link", { name: "Redirecciones" })).toHaveClass(/productEditorTabActive/);
  await page.getByRole("link", { name: "Crear redirect" }).click();
  await expect(page.getByRole("heading", { name: "Crear redirect SEO" })).toBeVisible();
  await page.locator(".adminSideDrawer").locator('input[name="fromPath"]').fill("/producto-demo-viejo/p");
  await page.locator(".adminSideDrawer").locator('input[name="toPath"]').fill("/producto-demo-editado/p");
  await page.locator(".adminSideDrawer").getByRole("button", { name: "Crear redirect" }).click();
  await expect(page.getByText("Redirect SEO creado.")).toBeVisible();
  await expect.poll(() => capturedSeoMutations).toContainEqual({
    method: "POST",
    path: "/api/v1/admin/routing-seo/redirects",
    body: {
      fromPath: "/producto-demo-viejo/p",
      toPath: "/producto-demo-editado/p",
      statusCode: 301,
      reason: null,
      expiresAt: null,
    },
  });

  await page.getByRole("link", { name: "Resolver" }).click();
  await expect(page.getByRole("heading", { name: "Resolver path" })).toBeVisible();
  await expect(page.getByLabel("Path")).toHaveValue("/");

  expect(capturedSeoAdminRequests).toContain(
    `GET /api/v1/admin/routing-seo/routes?organizationId=${defaultOrganizationId}&shopId=${barcelonaShopId}&locale=es-ES&status=ACTIVE&limit=50&offset=0`,
  );
  expect(browserExternalRequests).toEqual([]);
});

test("media catalog page lists collections and soft-deletes through BFF", async ({ page }) => {
  capturedMediaAdminRequests.length = 0;
  capturedMediaAdminMutations.length = 0;
  capturedMediaAssetContentRequests.length = 0;
  mediaCollections[0].active = true;

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/catalogo/media?status=all`);

  await expect(page.getByRole("heading", { name: "Media / Archivos" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Galeria producto existente.*product-edit-1/ })).toBeVisible();
  await page.getByRole("button", {name:"Acciones de Galeria producto existente",exact:true}).click();
  await page.getByRole("link", { name: "Revisar" }).click();

  await expect(page).toHaveURL(/collectionId=collection-admin-1/);
  await expect(page.getByRole("heading", { name: "Galeria producto existente" })).toBeVisible();
  await expect(page.getByText("Alt admin media")).toBeVisible();
  await expect(page.getByText("Title admin media")).toBeVisible();
  const preview = page.getByLabel("Detalle de coleccion media", { exact: true }).getByRole("img", { name: "Alt admin media", exact: true });
  await preview.scrollIntoViewIfNeeded();
  await expect.poll(() => preview.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect.poll(() => capturedMediaAssetContentRequests.some((item) =>
    item.includes("/api/v1/admin/media/assets/asset-admin-1/content") &&
      item.includes("variant=small_default")
  )).toBe(true);

  await page.getByLabel("Confirmo la baja segura").check();
  await page.getByRole("button", { name: "Desactivar coleccion" }).click();

  await expect(page.getByText("Coleccion media desactivada.")).toBeVisible();
  await expect.poll(() => capturedMediaAdminMutations).toContainEqual({
    method: "DELETE",
    path: `/api/v1/admin/media/collections/collection-admin-1?mode=soft&organizationId=${defaultOrganizationId}&shopId=${barcelonaShopId}&locale=es-ES`,
  });
  expect(capturedMediaAdminRequests.some((item) => item.includes("mode=hard"))).toBe(false);
});

test("stock catalog page edits variant stock through Inventory BFF", async ({ page }) => {
  capturedStockAdminRequests.length = 0;
  capturedStockMutations.length = 0;
  capturedEditorStateRequests.length = 0;

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/catalogo/stock?status=all`);

  await expect(page.getByRole("heading", { name: "Stock", exact: true, level: 1 })).toBeVisible();
  await expect(page.getByRole("row", { name: /Producto existente Playwright.*PEP-001/ })).toBeVisible();
  await page.getByRole("link", { name: "Gestionar" }).click();

  await expect(page).toHaveURL(/productId=product-edit-1/);
  await expect(page.getByRole("heading", { name: "Producto existente Playwright" })).toBeVisible();
  await expect(page.getByText("Disponible total")).toBeVisible();

  const defaultRow = page.locator(".stockAdminRowForm").filter({ hasText: "PEP-001" });
  await expect(defaultRow.getByLabel("On hand")).toHaveValue("12");
  await defaultRow.getByLabel("On hand").fill("15");
  await defaultRow.getByRole("button", { name: "Guardar" }).click();

  await expect(page.getByText("Stock actualizado.")).toBeVisible();
  await expect.poll(() => capturedStockMutations).toContainEqual({
    method: "PUT",
    path: "/api/v1/admin/inventory/stock-levels",
    body: {
      organizationId: defaultOrganizationId,
      shopId: barcelonaShopId,
      variantId: "variant-edit-default",
      warehouseId: "main-warehouse",
      onHandQuantity: 15,
      reservedQuantity: 2,
      safetyStockQuantity: 1,
    },
  });
  expect(capturedEditorStateRequests).toContain("/api/v1/admin/products/product-edit-1/editor-state");
  expect(capturedStockAdminRequests.some((item) => item.startsWith("PUT /api/v1/inventory/"))).toBe(false);
});

test("product editor rehydrates persisted draft media through BFF only", async ({ page }) => {
  capturedDraftStateRequests.length = 0;
  const browserExternalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "127.0.0.1" && url.port && Number(url.port) !== nextPort) {
      browserExternalRequests.push(request.url());
    }
  });

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await expect(page.getByRole("heading", { name: "Imágenes", exact: true })).toBeVisible();

  await expect(page.getByText("1 imagen(es) recuperada(s) del borrador remoto.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Editar metadata: Imagen principal remota/ })).toBeVisible();

  expect(capturedDraftStateRequests).toHaveLength(1);
  expect(capturedDraftStateRequests[0]).toMatch(/^\/api\/v1\/admin\/product-drafts\/.+/);
  expect(capturedBffRequests.every((item) => item.includes(" /api/v1/"))).toBe(true);
  expect(browserExternalRequests).toEqual([]);
});

test("product preview renders rich product summary below the title", async ({ page }) => {
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByLabel("Nombre", { exact: true }).fill("Producto Rich Preview");
  await page.getByRole("button",{name:"Mostrar código HTML",exact:true}).first().click();
  await page.getByLabel("Resumen HTML").fill("<p><strong>Resumen</strong> con formato</p>");
  await page.getByRole("button", { name: "Vista previa" }).click();

  const previewDialog = page.getByRole("dialog", { name: "Vista previa PDP" });
  await expect(previewDialog).toBeVisible();
  await expect(previewDialog.locator(".storefrontPdpSummary strong")).toHaveText("Resumen");
  await expect(previewDialog.locator(".storefrontPdpSummary")).toContainText("con formato");
  await expect(previewDialog.getByText("<strong>Resumen</strong> con formato")).toHaveCount(0);
});

test("PDP preview is a centered 80 percent modal sharing storefront styles", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  inheritPriceScenario = true;
  try {
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/product-edit-1`);
  const trigger = page.getByRole("button", { name: "Vista previa", exact: true });
  await page.context().addCookies([{ name: "ecommium_storefront_visitor_id", value: "11111111-1111-4111-8111-111111111111", url: `http://127.0.0.1:${nextPort}` }]);
  const commercialRequests: string[] = [];
  page.on("request", request => { if (/\/api\/storefront\/(cart|search\/events)/.test(request.url())) commercialRequests.push(request.url()); });
  await trigger.click();
  const modal = page.getByRole("dialog", { name: "Vista previa PDP", exact: true });
  await expect(modal).toBeVisible();
  await expect(modal).toHaveJSProperty("open", true);
  await expect(modal.getByRole("separator")).toHaveCount(0);
  await expect(modal.locator(".storefrontPdpLayout")).toBeVisible();
  await expect(modal.getByRole("button", { name: "Añadir al carrito", exact: true })).toBeDisabled();
  await expect(modal.getByRole("button", { name: "Cerrar vista previa", exact: true })).toBeFocused();
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(async () => Math.abs((await modal.boundingBox())!.width - width * 0.8)).toBeLessThan(1);
    const bounds = (await modal.boundingBox())!;
    expect(Math.abs(bounds.x - width * 0.1)).toBeLessThan(1);
    const overflow = await modal.evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth, items: [...element.querySelectorAll("*")].filter(child => child.getBoundingClientRect().right > element.getBoundingClientRect().right + 1).map(child => ({class:child.className, width:child.getBoundingClientRect().width, scroll:child.scrollWidth, right:child.getBoundingClientRect().right})).slice(0, 12) }));
    expect(overflow.scroll <= overflow.width, JSON.stringify({ viewport: width, ...overflow })).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await modal.screenshot({ path: testInfo.outputPath("pdp-preview-modal.png") });
  await modal.getByRole("button", { name: "Ampliar imagen", exact: true }).click();
  await expect(modal.locator(".storefrontPdpZoomModal")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(modal.locator(".storefrontPdpZoomModal")).toHaveCount(0);
  await expect(modal).toBeVisible();
  expect(commercialRequests).toEqual([]);
  expect((await page.context().cookies()).find(cookie => cookie.name === "ecommium_storefront_visitor_id")?.value).toBe("11111111-1111-4111-8111-111111111111");
  // A change in the actual PDP selector immediately affects this preview too.
  await page.addStyleTag({ content: ".storefrontPdpBuyBox h1 { color: rgb(12, 34, 56); }" });
  await expect(modal.locator(".storefrontPdpBuyBox h1")).toHaveCSS("color", "rgb(12, 34, 56)");
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  await trigger.click();
  await expect(modal).toBeVisible();
  await page.mouse.click(10, 500);
  await expect(modal).toHaveCount(0);
  } finally { inheritPriceScenario = false; }
});

test("product editor selects catalog feature values and renders them in preview", async ({ page }) => {
  capturedCatalogSpecificationRequests.length = 0;
  const generatedGroupIndex = catalogSpecificationGroups.findIndex((group) => group.specificationGroupId === "spec-group-playwright");
  if (generatedGroupIndex >= 0) {
    catalogSpecificationGroups.splice(generatedGroupIndex, 1);
  }

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByLabel("Nombre", {exact:true}).fill("Producto con ficha tecnica");
  await expect(page.locator("summary", {hasText:"Datos principales"})).toBeVisible();
  await openProductBasicSection(page, "Características y especificaciones");

  await page.getByRole("button", { name: "Añadir otra característica", exact: true }).click();
  const featureDialog = page.getByRole("dialog", { name: "Caracteristicas" });
  await expect(featureDialog).toBeVisible();
  await featureDialog.locator(".productSpecificationChoice", { hasText: "Composicion" }).click();
  await expect(page.getByRole("dialog", { name: "Composicion" })).toBeVisible();
  await page.getByRole("button", { name: "Aluminio" }).click();
  await expect(page.getByRole("dialog", { name: "Agregar otra caracteristica" })).toBeVisible();
  await page.getByRole("dialog", { name: "Agregar otra caracteristica" }).getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(page.getByLabel("Composicion", {exact:true})).toHaveValue("value-aluminium");
  await page.getByRole("button", { name: "Vista previa" }).click();

  const previewDialog = page.getByRole("dialog", { name: "Vista previa PDP" });
  await expect(previewDialog).toBeVisible();
  await expect(previewDialog.getByRole("heading", { name: "Caracteristicas clave" })).toBeVisible();
  await expect(previewDialog.getByText("Composicion")).toBeVisible();
  await expect(previewDialog.getByText("Aluminio")).toBeVisible();
  expect(capturedCatalogSpecificationRequests).toContain("GET /api/v1/admin/specifications/groups");
  expect(capturedCatalogSpecificationRequests).toContain("GET /api/v1/admin/specifications/groups/spec-group-technical");
});

test("product editor presents variant options as combination attributes", async ({ page }) => {
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByRole("button", { name: "Variantes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Producto y variantes" })).toBeVisible();
  await expect(page.getByText("Generador rapido desde atributos")).toBeVisible();
  await page.getByRole("button", { name: "Anadir variante" }).click();

  await expect(page.getByRole("heading", { name: "Atributos de combinacion" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Atributos de combinacion", exact: true })).toBeVisible();
  await expect(page.getByText("0 asociados")).toBeVisible();
  await expect(page.getByText("Estos atributos identifican esta variante vendible.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar ayuda de atributos de combinacion" })).toBeVisible();

  const variantsTable = page.locator(".productCombinationTable");
  const offeringsPanel = page.locator(".productOfferingPositionPanel");
  const attributesPanel = page.locator(".productVariantAttributePanel");
  await expect(page.getByText("Guarda primero esta variante para asociar servicios adicionales.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar aviso de servicios adicionales" })).toBeVisible();
  const [tableBox, offeringsBox, attributesBox] = await Promise.all([
    variantsTable.boundingBox(),
    offeringsPanel.boundingBox(),
    attributesPanel.boundingBox(),
  ]);
  expect(tableBox).not.toBeNull();
  expect(offeringsBox).not.toBeNull();
  expect(attributesBox).not.toBeNull();
  expect(offeringsBox!.y).toBeGreaterThan(tableBox!.y + tableBox!.height - 1);
  expect(attributesBox!.y).toBeGreaterThan(offeringsBox!.y);
  await page.getByRole("button", { name: "Cerrar aviso de servicios adicionales" }).click();
  await expect(page.getByText("Guarda primero esta variante para asociar servicios adicionales.")).toHaveCount(0);
  await page.getByRole("button", { name: "Cerrar ayuda de atributos de combinacion" }).click();
  await expect(page.getByText("Estos atributos identifican esta variante vendible.")).toHaveCount(0);
});

test("new manual and generated variants start with an editable parent price", async ({ page }) => {
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);
  await page.getByLabel("Precio con IVA").fill("49.90");
  await page.getByRole("button", { name: "Variantes", exact: true }).click();
  await page.getByRole("button", { name: "Anadir variante" }).click();
  const firstPrice = page.getByLabel("Precio variante 1", { exact: true });
  await expect(firstPrice).toHaveValue("49.90");
  const activeCheck = page.getByLabel("Activa variante 1", { exact: true });
  const visibleCheck = page.getByLabel("Visible variante 1", { exact: true });
  const stockInput = page.getByLabel("Stock variante 1", { exact: true });
  await expect(firstPrice).toHaveCSS("height", "32px");
  await expect(firstPrice).toHaveCSS("font-size", "12px");
  await expect(stockInput).toHaveCSS("height", "32px");
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const [activeBox, visibleBox, priceBox, stockBox] = await Promise.all([
      activeCheck.boundingBox(), visibleCheck.boundingBox(), firstPrice.boundingBox(), stockInput.boundingBox(),
    ]);
    expect(activeBox).not.toBeNull();
    expect(visibleBox).not.toBeNull();
    expect(priceBox).not.toBeNull();
    expect(stockBox).not.toBeNull();
    expect(Math.abs(activeBox!.y - visibleBox!.y)).toBeLessThan(2);
    expect(visibleBox!.x).toBeGreaterThan(activeBox!.x);
    expect(priceBox!.width).toBeLessThanOrEqual(102);
    expect(stockBox!.width).toBeLessThanOrEqual(74);
    expect(Math.abs(priceBox!.y - stockBox!.y)).toBeLessThan(2);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await firstPrice.fill("59.90");
  await page.getByRole("button", { name: "Anadir variante" }).click();
  await expect(firstPrice).toHaveValue("59.90");
  await expect(page.getByLabel("Precio variante 2", { exact: true })).toHaveValue("49.90");
  await page.getByPlaceholder("rojo, azul").fill("rojo, azul");
  await page.getByPlaceholder("S, M, L").fill("M");
  await page.getByRole("button", { name: "Generar variantes", exact: true }).click();
  await page.getByRole("button", { name: "Reemplazar variantes", exact: true }).click();
  await expect(firstPrice).toHaveValue("49.90");
  await expect(page.getByLabel("Precio variante 2", { exact: true })).toHaveValue("49.90");
});

test("product preview uses the PDP selector for sellable variants", async ({ page }) => {
  inheritPriceScenario = true;
  try {
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/product-edit-1`);

  await page.getByRole("button", { name: "Vista previa" }).click();

  const previewDialog = page.getByRole("dialog", { name: "Vista previa PDP" });
  await expect(previewDialog).toBeVisible();
  const redChoice = previewDialog.getByRole("button", { name: "Seleccionar Producto existente Playwright rojo", exact: true });
  await expect(redChoice).toBeDisabled();
  const greenChoice = previewDialog.getByRole("button", { name: "Seleccionar Producto existente Playwright verde", exact: true });
  await greenChoice.click();
  await expect(greenChoice).toHaveAttribute("aria-pressed", "true");
  await expect(previewDialog.locator(".storefrontPdpSummaryList div", { hasText: "Referencia" })).toContainText("PEP-GREEN");
  await expect(previewDialog.locator(".storefrontPdpPrice strong")).toHaveText("99.00 EUR");
  await expect(previewDialog.locator(".storefrontPdpStockOk")).toContainText("4");
  } finally { inheritPriceScenario = false; }
});

test("product editor renders persisted media through the protected preview proxy", async ({ page }) => {
  capturedDraftStateRequests.length = 0;
  capturedMediaAssetContentRequests.length = 0;

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/product-edit-1`);

  await expect(page.getByRole("heading", { name: "Imágenes", exact: true })).toBeVisible();

  const persistedImage = page.locator('img[alt="Imagen producto existente"]').first();
  await expect(persistedImage).toBeVisible();
  await expect(persistedImage).toHaveAttribute(
    "src",
    /\/api\/admin\/media-assets\/asset-edit-1\/content\?variant=medium_default/,
  );
  await expect.poll(() => capturedMediaAssetContentRequests).toContainEqual(
    expect.stringContaining("/api/v1/admin/media/assets/asset-edit-1/content"),
  );
  expect(capturedDraftStateRequests).toEqual(["/api/v1/admin/product-drafts/product-edit-1"]);
});

test("product editor sends removed persisted media in draft without binary files", async ({ page }) => {
  capturedSaveOperationRequests.length = 0;
  capturedSaveOperationBodies.length = 0;
  saveOperationMode = "success";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await expect(page.getByText("1 imagen(es) recuperada(s) del borrador remoto.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Editar metadata: Imagen principal remota/ })).toBeVisible();
  await page.getByRole("button", { name: "Eliminar del borrador: Imagen principal remota", exact: true }).click();
  await expect(page.getByText("Imagen principal remota")).toHaveCount(0);

  await page.getByRole("button", { name: "Ajustes basicos" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Producto Con Media Eliminada");
  await openProductBasicSection(page, "Categoría y marca / proveedor");
  await page.getByLabel("Categoria principal", { exact: true }).selectOption("category-bikes");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", {name:"Guardar borrador",exact:true}).click();

  await expect(page.getByText("Producto guardado.")).toBeVisible();
  await expect.poll(() => capturedSaveOperationRequests.length).toBe(1);

  const draft = JSON.parse(parseMultipartTextField(capturedSaveOperationBodies[0], "draft"));
  expect(draft.media.items).toHaveLength(0);
  expect(draft.media.removedItems).toHaveLength(1);
  expect(draft.media.removedItems[0].mediaAssetId).toBe("asset-remote-1");
  expect(capturedSaveOperationBodies[0]).not.toContain('name="files"');
  expect(capturedSaveOperationBodies[0]).not.toContain('name="fileLocalIds"');
});

test("product editor uploads selected media immediately to draft endpoint", async ({ page }) => {
  capturedDraftStateRequests.length = 0;
  capturedDraftMediaUploadRequests.length = 0;
  capturedSaveOperationRequests.length = 0;
  draftMediaUploadMode = "success";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.locator('input[type="file"]').setInputFiles({
    name: "playwright-cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(onePixelPngDataUrl.split(",")[1], "base64"),
  });

  await expect(page.getByText("1 imagen(es) subida(s) al borrador.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Editar metadata: Imagen subida por Playwright/ })).toBeVisible();
  await expect.poll(() => capturedDraftStateRequests.length).toBeGreaterThanOrEqual(2);

  expect(capturedDraftMediaUploadRequests).toHaveLength(1);
  expect(capturedDraftMediaUploadRequests[0]).toMatch(/^\/api\/v1\/admin\/product-drafts\/.+\/media$/);
  expect(capturedSaveOperationRequests).toHaveLength(0);
});

test("product editor sends matching idempotency key for draft media upload", async ({ page }) => {
  capturedDraftMediaUploadRequests.length = 0;
  capturedDraftMediaUploadIdempotencyKeys.length = 0;
  capturedDraftMediaUploadBodies.length = 0;
  draftMediaUploadMode = "success";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.locator('input[type="file"]').setInputFiles({
    name: "playwright-cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(onePixelPngDataUrl.split(",")[1], "base64"),
  });

  await expect(page.getByText("1 imagen(es) subida(s) al borrador.")).toBeVisible();
  await expect.poll(() => capturedDraftMediaUploadRequests.length).toBe(1);

  const headerKey = capturedDraftMediaUploadIdempotencyKeys[0];
  const bodyKey = parseMultipartTextField(capturedDraftMediaUploadBodies[0], "idempotencyKey");
  expect(headerKey).toBeTruthy();
  expect(bodyKey).toBe(headerKey);
  expect(capturedDraftMediaUploadBodies[0]).toContain('name="file"');
  expect(capturedDraftMediaUploadBodies[0]).toContain('name="fileLocalId"');
  expect(capturedDraftMediaUploadBodies[0]).toContain('name="metadata"');
  expect(capturedDraftMediaUploadBodies[0]).toContain('filename="playwright-cover.png"');
});

test("product editor keeps the same client draft id for draft state and media upload", async ({ page }) => {
  capturedDraftStateRequests.length = 0;
  capturedDraftMediaUploadRequests.length = 0;
  draftMediaUploadMode = "success";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await expect(page.getByText("1 imagen(es) recuperada(s) del borrador remoto.")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "playwright-cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(onePixelPngDataUrl.split(",")[1], "base64"),
  });

  await expect(page.getByText("1 imagen(es) subida(s) al borrador.")).toBeVisible();

  await expect.poll(() => capturedDraftStateRequests.length).toBeGreaterThanOrEqual(2);
  expect(capturedDraftMediaUploadRequests).toHaveLength(1);
  const draftStateIds = capturedDraftStateRequests.map(draftIdFromProductDraftPath);
  const draftStateId = draftStateIds[0];
  const uploadDraftId = draftIdFromProductDraftPath(capturedDraftMediaUploadRequests[0]);
  expect(draftStateId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect(uploadDraftId).toBe(draftStateId);
  expect(draftStateIds.every((id) => id === uploadDraftId)).toBe(true);
});

test("product editor restores local draft with the original client draft id after reload", async ({ page }) => {
  capturedDraftStateRequests.length = 0;

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByLabel("Nombre", { exact: true }).fill("Producto Restaurable");
  await openProductBasicSection(page, "Categoría y marca / proveedor");
  await page.getByLabel("Categoria principal", { exact: true }).selectOption("category-bikes");
  await expect.poll(() => capturedDraftStateRequests.length).toBeGreaterThanOrEqual(1);
  const originalDraftId = draftIdFromProductDraftPath(capturedDraftStateRequests[0]);
  expect(originalDraftId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  await expect.poll(async () =>
    await page.evaluate(() =>
      Object.keys(window.localStorage).filter((key) => key.startsWith("ecommium-product-draft:")).length
    )
  ).toBeGreaterThan(0);

  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();

  await expect(page.getByText("Hay un borrador local guardado para esta ficha.")).toBeVisible();
  await page.getByRole("button", { name: "Restaurar borrador" }).click();

  await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Producto Restaurable");
  await expect(page.getByLabel("Categoria principal", { exact: true })).toHaveValue("category-bikes");
  await expect.poll(() =>
    capturedDraftStateRequests.map(draftIdFromProductDraftPath).filter((id) => id === originalDraftId).length
  ).toBeGreaterThanOrEqual(2);
});

test("product editor discards local draft and does not reuse discarded client draft id", async ({ page }) => {
  capturedDraftStateRequests.length = 0;
  capturedDraftMediaUploadRequests.length = 0;
  draftMediaUploadMode = "success";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByLabel("Nombre", { exact: true }).fill("Producto Descartable");
  await openProductBasicSection(page, "Categoría y marca / proveedor");
  await page.getByLabel("Categoria principal", { exact: true }).selectOption("category-bikes");
  await expect.poll(() => capturedDraftStateRequests.length).toBeGreaterThanOrEqual(1);
  const discardedDraftId = draftIdFromProductDraftPath(capturedDraftStateRequests[0]);
  await expect.poll(async () =>
    await page.evaluate(() =>
      Object.keys(window.localStorage).filter((key) => key.startsWith("ecommium-product-draft:")).length
    )
  ).toBeGreaterThan(0);

  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();

  await expect(page.getByText("Hay un borrador local guardado para esta ficha.")).toBeVisible();
  await page.getByRole("button", { name: "Descartar borrador" }).click();
  await expect(page.getByText("Hay un borrador local guardado para esta ficha.")).toHaveCount(0);
  await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Categoria principal", { exact: true })).toHaveValue("");
  await expect.poll(async () =>
    await page.evaluate(() =>
      Object.keys(window.localStorage).filter((key) => key.startsWith("ecommium-product-draft:")).length
    )
  ).toBe(0);

  await page.locator('input[type="file"]').setInputFiles({
    name: "playwright-cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(onePixelPngDataUrl.split(",")[1], "base64"),
  });

  await expect(page.getByText("1 imagen(es) subida(s) al borrador.")).toBeVisible();
  await expect.poll(() => capturedDraftMediaUploadRequests.length).toBe(1);
  const uploadDraftId = draftIdFromProductDraftPath(capturedDraftMediaUploadRequests[0]);
  expect(uploadDraftId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect(uploadDraftId).not.toBe(discardedDraftId);
});

test("product editor saves uploaded media as references without rebundling files", async ({ page }) => {
  capturedDraftMediaUploadRequests.length = 0;
  capturedSaveOperationRequests.length = 0;
  capturedSaveOperationBodies.length = 0;
  draftMediaUploadMode = "success";
  saveOperationMode = "success";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.locator('input[type="file"]').setInputFiles({
    name: "playwright-cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(onePixelPngDataUrl.split(",")[1], "base64"),
  });

  await expect(page.getByText("1 imagen(es) subida(s) al borrador.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Editar metadata: Imagen subida por Playwright/ })).toBeVisible();

  await page.getByRole("button", { name: "Ajustes basicos" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Producto Con Media Referenciada");
  await openProductBasicSection(page, "Categoría y marca / proveedor");
  await page.getByLabel("Categoria principal", { exact: true }).selectOption("category-bikes");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", {name:"Guardar borrador",exact:true}).click();

  await expect(page.getByText("Producto guardado.")).toBeVisible();
  await expect.poll(() => capturedSaveOperationRequests.length).toBe(1);

  const draft = JSON.parse(parseMultipartTextField(capturedSaveOperationBodies[0], "draft"));
  expect(draft.media.items.some((item: { mediaAssetId?: string }) =>
    item.mediaAssetId === "asset-uploaded-playwright"
  )).toBe(true);
  expect(capturedSaveOperationBodies[0]).not.toContain('name="files"');
  expect(capturedSaveOperationBodies[0]).not.toContain('name="fileLocalIds"');
});

test("product editor sends the media draft identity in the save operation", async ({ page }) => {
  capturedDraftMediaUploadRequests.length = 0;
  capturedSaveOperationRequests.length = 0;
  capturedSaveOperationBodies.length = 0;
  draftMediaUploadMode = "success";
  saveOperationMode = "success";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.locator('input[type="file"]').setInputFiles({
    name: "playwright-cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(onePixelPngDataUrl.split(",")[1], "base64"),
  });

  await expect(page.getByText("1 imagen(es) subida(s) al borrador.")).toBeVisible();
  await expect.poll(() => capturedDraftMediaUploadRequests.length).toBe(1);
  const uploadDraftId = draftIdFromProductDraftPath(capturedDraftMediaUploadRequests[0]);

  await page.getByRole("button", { name: "Ajustes basicos" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Producto Con Identidad De Media");
  await openProductBasicSection(page, "Categoría y marca / proveedor");
  await page.getByLabel("Categoria principal", { exact: true }).selectOption("category-bikes");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", {name:"Guardar borrador",exact:true}).click();

  await expect(page.getByText("Producto guardado.")).toBeVisible();
  await expect.poll(() => capturedSaveOperationRequests.length).toBe(1);

  const draft = JSON.parse(parseMultipartTextField(capturedSaveOperationBodies[0], "draft"));
  expect(draft.clientDraftId).toBe(uploadDraftId);
  expect(draft.productId).toBe("product-draft-remote");
  expect(draft.mediaCollectionId).toBe("collection-remote");
  expect(draft.media.items.some((item: { mediaAssetId?: string }) =>
    item.mediaAssetId === "asset-uploaded-playwright"
  )).toBe(true);
  expect(capturedSaveOperationBodies[0]).not.toContain('name="files"');
  expect(capturedSaveOperationBodies[0]).not.toContain('name="fileLocalIds"');
});

test("product editor keeps failed draft media local without saving product", async ({ page }) => {
  capturedDraftMediaUploadRequests.length = 0;
  capturedSaveOperationRequests.length = 0;
  draftMediaUploadMode = "failed";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.locator('input[type="file"]').setInputFiles({
    name: "playwright-broken-cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(onePixelPngDataUrl.split(",")[1], "base64"),
  });

  await expect(page.getByText("0/1 imagen(es) subidas. Revisa las marcadas con error.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Media temporal no disponible\./ })).toBeVisible();
  await expectProductBlock(page, "media: Fallo");

  expect(capturedDraftMediaUploadRequests).toHaveLength(1);
  expect(capturedSaveOperationRequests).toHaveLength(0);
  draftMediaUploadMode = "success";
});

test("product editor does not bundle failed media files into product save operation", async ({ page }) => {
  capturedDraftMediaUploadRequests.length = 0;
  capturedSaveOperationRequests.length = 0;
  capturedSaveOperationBodies.length = 0;
  draftMediaUploadMode = "failed";
  saveOperationMode = "success";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.locator('input[type="file"]').setInputFiles({
    name: "playwright-broken-cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(onePixelPngDataUrl.split(",")[1], "base64"),
  });

  await expect(page.getByText("0/1 imagen(es) subidas. Revisa las marcadas con error.")).toBeVisible();

  await page.getByRole("button", { name: "Ajustes basicos" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Producto Sin Binario Reenviado");
  await openProductBasicSection(page, "Categoría y marca / proveedor");
  await page.getByLabel("Categoria principal", { exact: true }).selectOption("category-bikes");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", {name:"Guardar borrador",exact:true}).click();

  await expect(page.getByText("Producto guardado.")).toBeVisible();
  await expect.poll(() => capturedSaveOperationRequests.length).toBe(1);

  expect(capturedSaveOperationBodies).toHaveLength(1);
  expect(capturedSaveOperationBodies[0]).toContain('name="draft"');
  expect(capturedSaveOperationBodies[0]).toContain('name="idempotencyKey"');
  expect(capturedSaveOperationBodies[0]).not.toContain('name="files"');
  expect(capturedSaveOperationBodies[0]).not.toContain('name="fileLocalIds"');
  draftMediaUploadMode = "success";
});

test("product editor clears failed media state after removing failed upload", async ({ page }) => {
  capturedDraftMediaUploadRequests.length = 0;
  capturedSaveOperationRequests.length = 0;
  draftMediaUploadMode = "failed";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.locator('input[type="file"]').setInputFiles({
    name: "playwright-broken-cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(onePixelPngDataUrl.split(",")[1], "base64"),
  });

  await expectProductBlock(page, "media: Fallo");
  const failedTile = page.locator(".productMediaTile").filter({ hasText: "Media temporal no disponible." });
  await expect(failedTile).toHaveCount(1);
  await failedTile.locator('button[aria-label^="Eliminar"]').click();

  await expect(page.getByText("Media temporal no disponible.")).toHaveCount(0);
  await expectProductBlock(page, "media: Correcto");
  expect(capturedSaveOperationRequests).toHaveLength(0);
  draftMediaUploadMode = "success";
});

test("product editor blocks incomplete save before product-save operation", async ({ page }) => {
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);
  await expect(page.getByRole("button", { name: "Guardar", exact: true })).toBeVisible();

  const saveRequestsBefore = capturedBffRequests.filter((item) =>
    item === "POST /api/v1/admin/product-save-operations"
  ).length;

  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", {name:"Guardar borrador",exact:true}).click();

  await expect(page.getByText(/No se guardo\. Revisa:/)).toBeVisible();
  await expect(page.getByText("Revisar campos obligatorios")).toBeVisible();
  await expect(page.getByText(/Nombre:/)).toBeVisible();
  await expect(page.getByText(/Categoria principal:/)).toBeVisible();

  const saveRequestsAfter = capturedBffRequests.filter((item) =>
    item === "POST /api/v1/admin/product-save-operations"
  ).length;
  expect(saveRequestsAfter).toBe(saveRequestsBefore);
});

test("product editor blocks publish locally when commercial minimums are missing", async ({ page }) => {
  capturedSaveOperationRequests.length = 0;
  capturedSaveOperationBodies.length = 0;
  saveOperationMode = "success";
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);
  await page.getByLabel("Nombre", { exact: true }).fill("Producto Activo Incompleto");
  await openProductBasicSection(page, "Categoría y marca / proveedor");
  await page.getByLabel("Categoria principal", {exact:true}).selectOption("category-bikes");
  await page.getByRole("button", {name:"Guardar",exact:true}).click();
  const dialog = page.getByRole("dialog", {name:"Producto incompleto para publicar"});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Falta un precio base mayor que cero.", {exact:true})).toBeVisible();
  await expect(dialog.getByText("Falta stock disponible en default o en una combinacion vendible.", {exact:true})).toBeVisible();
  await expect(dialog.getByRole("button", {name:"Publicar",exact:true})).toHaveCount(0);
  expect(capturedSaveOperationRequests).toHaveLength(0);
  await page.screenshot({path:"docs/qa/evidence/20261106/product-save-incomplete.png",fullPage:true});
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Guardar",exact:true})).toBeFocused();
  await page.getByRole("button",{name:"Guardar",exact:true}).click();
  await dialog.getByRole("button", {name:"Guardar borrador",exact:true}).click();
  await expect(page.getByText("Producto guardado.",{exact:true})).toBeVisible();
  expect(JSON.parse(parseMultipartTextField(capturedSaveOperationBodies[0],"draft")).basic.isActive).toBe(false);
});

test("product editor publishes through save operation when commercial minimums are complete", async ({ page }) => {
  capturedSaveOperationRequests.length = 0;
  saveOperationMode = "published";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByLabel("Nombre", { exact: true }).fill("Producto Publicable");
  await openProductBasicSection(page, "Categoría y marca / proveedor");
  await page.getByLabel("Categoria principal", { exact: true }).selectOption("category-bikes");

  await page.getByLabel("Precio sin IVA").fill("49.90");
  await page.getByRole("combobox", { name: /Impuesto/ }).selectOption("tax-standard");

  await page.getByLabel("Existencias", { exact: true }).fill("7");

  await page.getByRole("button", { name: "Ajustes basicos" }).click();
  await page.getByRole("button", {name:"Guardar",exact:true}).click();
  const decision = page.getByRole("dialog", {name:"Producto preparado para publicar"});
  await expect(decision.getByRole("button", {name:"Guardar borrador",exact:true})).toBeVisible();
  await page.screenshot({path:"docs/qa/evidence/20261106/product-save-ready.png",fullPage:true});
  await decision.getByRole("button", {name:"Publicar",exact:true}).click();

  await expect(page.getByText("Producto publicado.")).toBeVisible();
  await expect(page.getByRole("group",{name:"Acciones del producto",exact:true}).getByRole("button",{name:"Guardar cambios",exact:true})).toBeVisible();
  await expectProductBlock(page, "pricing: Correcto");
  await expectProductBlock(page, "inventory: Correcto");
  await expectProductBlock(page, "publish: Correcto");
  await expect(page.getByText("Revisar publicacion")).toHaveCount(0);

  expect(capturedSaveOperationRequests).toHaveLength(1);
});

test("product editor shows BFF recovery actions after partial save failure", async ({ page }) => {
  capturedSaveOperationRequests.length = 0;
  saveOperationMode = "partial_failed";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByLabel("Nombre", { exact: true }).fill("Producto Playwright");
  await openProductBasicSection(page, "Categoría y marca / proveedor");
  await page.getByLabel("Categoria principal", { exact: true }).selectOption("category-bikes");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", {name:"Guardar borrador",exact:true}).click();

  await expect(page.getByText("Precio pendiente de guardar.")).toBeVisible();
  await expect(page.getByText("Reintentar precio").first()).toBeVisible();
  await expectProductBlock(page, "pricing: Fallo");

  expect(capturedSaveOperationRequests).toHaveLength(1);
  await page.getByRole("button", { name: "Reintentar precio", exact: true }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Guardar borrador", exact: true }).click();
  await expect.poll(() => capturedSaveOperationRequests.length).toBe(2);
  await expect(page.getByText("Precio pendiente de guardar.")).toBeVisible();
});

test("product editor reuses idempotency key when retrying a partial save", async ({ page }) => {
  capturedSaveOperationRequests.length = 0;
  capturedSaveOperationIdempotencyKeys.length = 0;
  capturedSaveOperationBodies.length = 0;
  saveOperationMode = "partial_failed";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByLabel("Nombre", { exact: true }).fill("Producto Retry Playwright");
  await openProductBasicSection(page, "Categoría y marca / proveedor");
  await page.getByLabel("Categoria principal", { exact: true }).selectOption("category-bikes");

  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", {name:"Guardar borrador",exact:true}).click();
  await expect(page.getByText("Precio pendiente de guardar.")).toBeVisible();
  await expect(page.getByText("Reintentar precio").first()).toBeVisible();
  await expect.poll(() => capturedSaveOperationRequests.length).toBe(1);

  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", {name:"Guardar borrador",exact:true}).click();
  await expect.poll(() => capturedSaveOperationRequests.length).toBe(2);
  await expectProductBlock(page, "pricing: Fallo");

  expect(capturedSaveOperationIdempotencyKeys).toHaveLength(2);
  expect(capturedSaveOperationIdempotencyKeys[0]).toBeTruthy();
  expect(capturedSaveOperationIdempotencyKeys[1]).toBe(capturedSaveOperationIdempotencyKeys[0]);
  expect(parseMultipartTextField(capturedSaveOperationBodies[1], "draft"))
    .toBe(parseMultipartTextField(capturedSaveOperationBodies[0], "draft"));
  expect(parseMultipartTextField(capturedSaveOperationBodies[0], "idempotencyKey"))
    .toBe(capturedSaveOperationIdempotencyKeys[0]);
  expect(parseMultipartTextField(capturedSaveOperationBodies[1], "idempotencyKey"))
    .toBe(capturedSaveOperationIdempotencyKeys[0]);
});

test("correcting an acknowledged partial save rotates the command key and keeps created IDs", async ({ page }) => {
  capturedSaveOperationBodies.length = 0;
  capturedSaveOperationIdempotencyKeys.length = 0;
  saveOperationMode = "partial_failed";
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);
  await page.getByLabel("Nombre", { exact: true }).fill("Partial corrected");
  await openProductBasicSection(page, "Categoría y marca / proveedor");
  await page.getByLabel("Categoria principal", { exact: true }).selectOption("category-bikes");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Guardar borrador", exact: true }).click();
  await expect(page.getByText("Precio pendiente de guardar.")).toBeVisible();
  await page.getByLabel("Nombre", { exact: true }).fill("Partial corrected new name");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Guardar borrador", exact: true }).click();
  await expect.poll(() => capturedSaveOperationBodies.length).toBe(2);
  expect(capturedSaveOperationIdempotencyKeys[1]).not.toBe(capturedSaveOperationIdempotencyKeys[0]);
  const draft = JSON.parse(parseMultipartTextField(capturedSaveOperationBodies[1], "draft"));
  expect(draft.productId).toBe("product-draft-remote");
  expect(draft.defaultVariantId).toBe("variant-default-remote");
  expect(draft.basic.name).toBe("Partial corrected new name");
});

test("product editor clears idempotency key after a successful retry", async ({ page }) => {
  capturedSaveOperationRequests.length = 0;
  capturedSaveOperationIdempotencyKeys.length = 0;
  saveOperationMode = "partial_failed";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByLabel("Nombre", { exact: true }).fill("Producto Retry Exitoso");
  await openProductBasicSection(page, "Categoría y marca / proveedor");
  await page.getByLabel("Categoria principal", { exact: true }).selectOption("category-bikes");

  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", {name:"Guardar borrador",exact:true}).click();
  await expect(page.getByText("Precio pendiente de guardar.")).toBeVisible();
  await expect.poll(() => capturedSaveOperationRequests.length).toBe(1);

  saveOperationMode = "success";
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", {name:"Guardar borrador",exact:true}).click();
  await expect(page.getByText("Producto guardado.")).toBeVisible();
  await expect.poll(() => capturedSaveOperationRequests.length).toBe(2);

  await page.getByLabel("Nombre", { exact: true }).fill("Producto Retry Exitoso Editado");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", {name:"Guardar borrador",exact:true}).click();
  await expect.poll(() => capturedSaveOperationRequests.length).toBe(3);

  expect(capturedSaveOperationIdempotencyKeys).toHaveLength(3);
  expect(capturedSaveOperationIdempotencyKeys[1]).toBe(capturedSaveOperationIdempotencyKeys[0]);
  expect(capturedSaveOperationIdempotencyKeys[2]).toBeTruthy();
  expect(capturedSaveOperationIdempotencyKeys[2]).not.toBe(capturedSaveOperationIdempotencyKeys[0]);
});

test("product editor applies successful save patch and clears local draft", async ({ page }) => {
  capturedSaveOperationRequests.length = 0;
  saveOperationMode = "success";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByLabel("Nombre", { exact: true }).fill("Producto Guardado");
  await openProductBasicSection(page, "Categoría y marca / proveedor");
  await page.getByLabel("Categoria principal", { exact: true }).selectOption("category-bikes");
  await expect.poll(async () =>
    await page.evaluate(() =>
      Object.keys(window.localStorage).filter((key) => key.startsWith("ecommium-product-draft:")).length
    )
  ).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", {name:"Guardar borrador",exact:true}).click();

  await expect(page.getByText("Producto guardado.")).toBeVisible();
  await expectProductBlock(page, "catalog: Correcto");
  await expectProductBlock(page, "pricing: Sin cambios");
  await expect(page.getByText("Reintentar precio")).toHaveCount(0);
  await expect.poll(async () =>
    await page.evaluate(() =>
      Object.keys(window.localStorage).filter((key) => key.startsWith("ecommium-product-draft:")).length
    )
  ).toBe(0);

  expect(capturedSaveOperationRequests).toHaveLength(1);
});

test("product audit shows only inventory, fixed prices and available SEO without extra requests", async ({ page }, testInfo) => {
  inheritPriceScenario = true;
  try {
    await loginAdmin(page);
    await page.goto(`http://127.0.0.1:${nextPort}/admin/products/product-edit-1`);
    await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Producto existente Playwright");
    await page.waitForLoadState("networkidle");
    const before = [...capturedBffRequests];
    await page.getByRole("button", { name: "Auditoria", exact: true }).click();
    await expect(page.getByRole("table", { name: "Resumen de inventario por variante", exact: true })).toBeVisible();
    const prices = page.getByRole("table", { name: "Precios fijados del producto y variantes", exact: true });
    await expect(prices).toBeVisible();
    await expect(prices.getByRole("row", { name: /Producto existente Playwright Precio habitual/ })).toContainText("1299,00");
    await expect(prices.getByRole("row", { name: /Producto existente Playwright verde Precio habitual/ })).toContainText("99,00");
    await expect(page.locator(".productAuditPanel")).toHaveCount(0);
    await expect(page.getByText("Operacion de guardado", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Correlacion BFF", { exact: true })).toHaveCount(0);
    expect(capturedBffRequests).toEqual(before);
    const inventoryBox = (await page.getByRole("table", { name: "Resumen de inventario por variante", exact: true }).locator("xpath=ancestor::details").boundingBox())!;
    const priceBox = (await page.locator(".productAuditPrices").boundingBox())!;
    expect(priceBox.y - inventoryBox.y - inventoryBox.height).toBeGreaterThanOrEqual(12);
    await page.screenshot({ path: testInfo.outputPath("audit-boxes.png"), fullPage: true });
    await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);
    await page.getByRole("button", { name: "Auditoria", exact: true }).click();
    await expect(page.getByRole("table", { name: "Precios fijados del producto y variantes", exact: true })).toContainText("0,00");
    await expect(page.locator(".productAuditSeo")).toHaveCount(0);
  } finally { inheritPriceScenario = false; }
});

test("product audit includes specific prices and contextual BASE and configured SEO", async ({ page }) => {
  pricingDatesScenario = true;
  try {
    await loginAdmin(page);
    await page.goto(`http://127.0.0.1:${nextPort}/admin/products/product-edit-1`);
    await page.getByRole("button", { name: "Ajustes basicos", exact: true }).click();
    await openProductBasicSection(page, "SEO");
    await page.getByLabel("Canonical path", { exact: true }).fill("/audit-product/p");
    await page.getByRole("button", { name: "Auditoria", exact: true }).click();
    const prices = page.getByRole("table", { name: "Precios fijados del producto y variantes", exact: true });
    await expect(prices.getByRole("row", { name: /Precio específico/ })).toContainText("18,00");
    await expect(prices.getByRole("row", { name: /Precio habitual.*Grupo: vip/ })).toContainText("1299,00");
    await expect(page.getByRole("table", { name: "Resumen de Routing y SEO", exact: true })).toContainText("/audit-product/p");
  } finally { pricingDatesScenario = false; }
});

test("product editor loads existing product state and saves through operation endpoint", async ({ page }) => {
  capturedEditorStateRequests.length = 0;
  capturedDraftStateRequests.length = 0;
  capturedSaveOperationRequests.length = 0;
  capturedCatalogOfferingRequests.length = 0;
  catalogOfferingsByVariant["variant-edit-default"] = [];
  saveOperationMode = "success";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/product-edit-1`);

  await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Producto existente Playwright");
  await expect(page.getByLabel("Categoria principal", { exact: true })).toHaveValue("category-bikes");
  await expect(page.getByRole("heading", { name: "Imágenes", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Editar metadata: Imagen producto existente/ })).toBeVisible();

  await page.getByRole("button", { name: "Variantes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Servicios adicionales" })).toBeVisible();
  await page.getByRole("button", { name: "Agregar servicio", exact: true }).click();
  const offeringDialog = page.getByRole("dialog", { name: "Servicios adicionales" });
  await expect(offeringDialog).toBeVisible();
  await expect(offeringDialog.getByRole("link", { name: "Gestionar servicios" })).toBeVisible();
  await offeringDialog.getByRole("button", { name: /Instalacion/ }).click();
  await expect(page.getByRole("dialog", { name: "Instalacion" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Agregar servicio", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Agregar otro servicio" })).toBeVisible();
  await page.getByRole("dialog", { name: "Agregar otro servicio" }).getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(page.getByText("Instalacion")).toBeVisible();

  await page.getByPlaceholder("Nuevo producto").fill("Producto existente actualizado");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", {name:"Guardar borrador",exact:true}).click();

  await expect(page.getByText("Producto guardado.")).toBeVisible();
  await expectProductBlock(page, "catalog: Correcto");

  expect(capturedEditorStateRequests).toEqual(["/api/v1/admin/products/product-edit-1/editor-state"]);
  expect(capturedDraftStateRequests).toEqual(["/api/v1/admin/product-drafts/product-edit-1"]);
  expect(capturedSaveOperationRequests).toHaveLength(1);
  expect(capturedBffRequests).not.toContain("PATCH /api/v1/admin/products/product-edit-1");
  expect(capturedBffRequests).not.toContain("POST /api/v1/admin/prices");
  expect(capturedCatalogOfferingRequests).toContain("GET /api/v1/admin/offerings");
  expect(capturedCatalogOfferingRequests).toContain("PUT /api/v1/admin/offerings/offering-installation/variants/variant-edit-default");
  expect(capturedCatalogOfferingRequests).toContain("POST /api/v1/admin/offerings/variants/resolve-batch");
});

test("product editor applies the pricing preview simulator from the pricing tab", async ({ page }, testInfo) => {
  capturedEditorStateRequests.length = 0;
  capturedDraftStateRequests.length = 0;
  capturedPricingPreviewRequests.length = 0;

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/product-edit-1`);

  await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Producto existente Playwright");
  await page.getByRole("button", { name: "Precio", exact: true }).click();

  const baseAdvancedPanel = page.locator("details.productPricingAdvanced").filter({ has: page.locator("summary", { hasText: "Contexto avanzado de precio base" }) });
  await expect(baseAdvancedPanel).toHaveCount(0);

  await expect(page.getByRole("table", { name: "Precios específicos", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Agregar precio específico", exact: true })).toBeVisible();
  await expect(page.locator(".productSpecificPriceForm")).toHaveCount(0);

  const simulator = page.locator("details.productSpecificPrices").filter({ has: page.locator("summary", { hasText: "Simulador de precio aplicado" }) });
  await expect(simulator).toBeVisible();
  await expect(simulator).not.toHaveAttribute("open", "");
  await expect(simulator.locator(":scope > summary .productCollapseIcon")).toBeVisible();
  await simulator.locator("summary", { hasText: "Simulador de precio aplicado" }).click();
  await expect(simulator).toHaveAttribute("open", "");
  await expect(simulator.getByLabel("Canal")).toHaveValue("web");
  await expect(simulator.getByLabel("Canal").locator('option[value="web"]')).toHaveText("Web");
  await expect(simulator.getByLabel("Canal").locator('option[value="marketplace"]')).toHaveText("Marketplace");

  await simulator.getByLabel("Cantidad").fill("3");
  await simulator.getByLabel("Price table").selectOption("cockpit-vip");
  await simulator.getByRole("button", { name: "Simular precio" }).click();

  await expect(simulator.getByText("Precio aplicado", { exact: true })).toBeVisible();
  await expect(simulator.getByText("95.00 EUR").first()).toBeVisible();
  await expect(simulator.getByText("95.00 EUR")).toHaveCount(1);
  await expect(simulator.getByText("pricing-preview-cockpit-vip")).toHaveCount(0);
  await expect(simulator.locator(".pricingEditorContext")).toHaveCount(0);
  const result = simulator.getByRole("table", { name: "Precio simulado", exact: true });
  await expect(result.getByRole("columnheader")).toHaveText(["Nombre artículo", "Precio base", "Precio aplicado"]);
  await expect(result.getByRole("cell").first()).toHaveText("Producto existente Playwright");
  await expect(simulator.getByRole("region", { name: "Resumen de condiciones", exact: true })).toBeVisible();
  const fields = simulator.locator(".productPriceSimulatorGrid > label");
  const positions = await fields.evaluateAll(elements => elements.map(element => ({ x: element.getBoundingClientRect().x, y: element.getBoundingClientRect().y })));
  expect(positions[0].y).toBe(positions[1].y);
  expect(positions[1].y).toBe(positions[2].y);
  expect(positions[3].y).toBeGreaterThan(positions[0].y);
  await expect(simulator.locator(".productPriceSimulatorResult")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(simulator).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const formBounds = (await simulator.locator(".productPriceSimulatorForm").boundingBox())!;
  const resultBounds = (await simulator.locator(".productPriceSimulatorResult").boundingBox())!;
  const conditionsBounds = (await simulator.locator(".productPriceSimulatorConditions").boundingBox())!;
  expect(resultBounds.y - formBounds.y - formBounds.height).toBeCloseTo(16, 0);
  expect(conditionsBounds.y - resultBounds.y - resultBounds.height).toBeCloseTo(16, 0);
  await simulator.screenshot({ path: testInfo.outputPath("pricing-simulator-tables.png") });
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const bounds = await simulator.boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    expect(await result.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  await expect(simulator.getByRole("row", { name: /Price table cockpit-vip cockpit-vip Cumple/ })).toBeVisible();
  await expect(simulator.getByRole("row", { name: /Cantidad minima 3 3 Cumple/ })).toBeVisible();
  await expect(simulator.getByText("Cumple").first()).toBeVisible();

  expect(capturedPricingPreviewRequests).toHaveLength(1);
  expect(capturedPricingPreviewRequests[0]).toContain("productId=product-edit-1");
  expect(capturedPricingPreviewRequests[0]).toContain("defaultVariantId=variant-edit-default");
  expect(capturedPricingPreviewRequests[0]).toContain("priceTableId=cockpit-vip");
  expect(capturedPricingPreviewRequests[0]).toContain("quantity=3");
});


test("specific prices use a separate products-style table and a cancellable side drawer", async ({ page }, info) => {
  capturedSaveOperationRequests.length = 0;
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/product-edit-1`);
  await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Producto existente Playwright");
  await page.getByRole("button", { name: "Precio", exact: true }).click();
  const table = page.getByRole("table", { name: "Precios específicos", exact: true });
  const add = page.getByRole("button", { name: "Agregar precio específico", exact: true });
  const create = page.getByRole("dialog", { name: "Agregar precio específico", exact: true });
  await expect(table).toBeVisible();
  await expect(table).toHaveClass(/productListTable/);
  await expect(page.getByRole("heading", { name: "Precio específico", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Precio", exact: true })).toHaveCount(0);
  await expect(page.getByText("Configura las condiciones avanzadas, los precios específicos y consulta el precio aplicado.", { exact: true })).toHaveCount(0);
  const simulatorPanel = page.locator(".productPriceSimulator");
  const listPanel = page.locator(".productSpecificPricePanel");
  expect(await listPanel.evaluate(element => ({ background: getComputedStyle(element).backgroundColor, border: getComputedStyle(element).borderTopWidth, padding: getComputedStyle(element).paddingTop }))).toEqual({ background: "rgba(0, 0, 0, 0)", border: "0px", padding: "0px" });
  expect(await table.evaluate(element => getComputedStyle(element).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  expect(await table.evaluate((element) => element.closest(".productEditorPanel")?.contains(document.querySelector(".productPriceSimulator")))).toBe(false);
  expect(await simulatorPanel.evaluate(element => getComputedStyle(element).backgroundColor)).toBe("rgb(255, 255, 255)");
  expect(await page.getByRole("heading", { name: "Precio específico", exact: true }).evaluate(element => getComputedStyle(element).fontSize)).toBe("18px");
  await expect(table.getByText(/No hay precios específicos/)).toBeVisible();
  await expect(page.locator(".productSpecificPriceForm")).toHaveCount(0);
  await add.click();
  await expect(create).toBeVisible();
  const [grid, targetField, priceField, quantityField] = await Promise.all([
    create.locator(".productSpecificPriceForm > .adminFormGrid").boundingBox(),
    create.getByLabel("Aplicar a").boundingBox(),
    create.getByLabel("Precio especifico", { exact: true }).boundingBox(),
    create.getByLabel("Minimo de unidades", { exact: true }).boundingBox(),
  ]);
  expect(Math.abs(targetField!.width - grid!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(priceField!.width - quantityField!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(priceField!.y - quantityField!.y)).toBeLessThanOrEqual(1);
  expect(priceField!.y).toBeGreaterThan(targetField!.y);
  await create.getByLabel("Precio especifico", { exact: true }).fill("99");
  await expect(create.getByLabel("Precio especifico", { exact: true })).toBeFocused();
  await create.getByRole("button", { name: "Cancelar", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(create.getByRole("separator", { name: "Ajustar ancho de la ventana lateral" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(create.getByRole("button", { name: "Cerrar", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(create.getByRole("separator", { name: "Ajustar ancho de la ventana lateral" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(create.getByRole("button", { name: "Cancelar", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(create).toHaveCount(0);
  await expect(add).toBeFocused();
  await expect(table.getByText(/No hay precios específicos/)).toBeVisible();
  for (const [variant, amount] of [["variant-edit-red", "99"], ["variant-edit-green", "120"]]) {
    await add.click();
    await expect(create.getByLabel("Precio especifico", { exact: true })).toHaveValue("");
    await create.getByLabel("Aplicar a").selectOption(variant);
    await create.getByLabel("Precio especifico", { exact: true }).fill(amount);
    await create.getByRole("button", { name: "Guardar precio especifico", exact: true }).click();
    await expect(create).toHaveCount(0);
  }
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Precio específico", exact: true })).toHaveText("Precio específico");
  const red = table.getByRole("row").filter({ hasText: "PEP-RED" });
  const green = table.getByRole("row").filter({ hasText: "PEP-GREEN" });
  await expect(red).toContainText("99.00 EUR");
  await expect(green).toContainText("120.00 EUR");
  await expect(table.locator("tbody .adminContextHint")).toHaveCount(0);
  await expect(table.getByText("Variante/combinación", { exact: true })).toHaveCount(0);
  await expect(table.getByText("Imp. incl.", { exact: true })).toHaveCount(0);
  await expect(table.getByText("web · default", { exact: true })).toHaveCount(0);
  const edit = red.getByRole("button", { name: /^Editar precio específico/ });
  await edit.click();
  const editing = page.getByRole("dialog", { name: "Editar precio específico", exact: true });
  await expect(editing.getByLabel("Precio especifico", { exact: true })).toHaveValue("99.00");
  await editing.getByLabel("Precio especifico", { exact: true }).fill("95");
  await editing.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(red).toContainText("99.00 EUR");
  await expect(edit).toBeFocused();
  await edit.click();
  await editing.getByLabel("Precio especifico", { exact: true }).fill("95");
  await page.screenshot({ path: info.outputPath("specific-price-drawer.png"), fullPage: true });
  await editing.getByRole("button", { name: "Actualizar precio especifico", exact: true }).click();
  await expect(editing).toHaveCount(0);
  await expect(red).toContainText("95.00 EUR");
  await expect(green).toContainText("120.00 EUR");
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const scroller = page.locator(".productSpecificPriceList .adminTableScroller");
    const bounds = await scroller.boundingBox();
    expect(bounds!.width).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: info.outputPath("specific-prices-table.png"), fullPage: true });
  expect(capturedSaveOperationRequests).toHaveLength(0);
});

test("Admin drawers resize within bounds, remember per module and forget on page navigation", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/product-edit-1`);
  await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Producto existente Playwright");
  const openPrice = async () => {
    await page.getByRole("button", { name: "Precio", exact: true }).click();
    await page.getByRole("button", { name: "Agregar precio específico", exact: true }).click();
  };
  await openPrice();
  const panel = page.getByRole("dialog", { name: "Agregar precio específico", exact: true });
  const grip = panel.getByRole("separator", { name: "Ajustar ancho de la ventana lateral" });
  const available = await page.locator(".adminSidebarPanel").evaluate(element => document.documentElement.clientWidth - element.getBoundingClientRect().right);
  const width = async () => (await panel.boundingBox())!.width;
  await expect.poll(async () => Math.abs(await width() - available * 0.4)).toBeLessThan(1);
  const box = (await grip.boundingBox())!;
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const panelLeft = (await panel.boundingBox())!.x;
  expect(Math.abs(box.x + box.width - panelLeft)).toBeLessThanOrEqual(2);
  await grip.click();
  await expect.poll(() => panel.evaluate(element => getComputedStyle(element).outlineWidth)).toBe("3px");
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x - 40, center.y);
  await expect.poll(() => panel.evaluate(element => getComputedStyle(element).outlineWidth)).toBe("5px");
  await expect.poll(async () => Math.abs(await width() - (available * 0.4 + 40))).toBeLessThan(1);
  await page.mouse.move(1, center.y);
  await expect.poll(async () => Math.abs(await width() - available * 0.5)).toBeLessThan(1);
  await page.mouse.up();
  await expect.poll(() => panel.evaluate(element => getComputedStyle(element).outlineWidth)).toBe("0px");
  await page.addScriptTag({ path: createRequire(process.cwd() + "/package.json").resolve("axe-core/axe.min.js") });
  const handleViolations = await grip.evaluate(async element => {
    const w = window as unknown as { axe: { run: (context: Element) => Promise<{ violations: unknown[] }> } };
    return (await w.axe.run(element)).violations;
  });
  expect(handleViolations).toEqual([]);
  await page.screenshot({ path: info.outputPath("drawer-resized.png"), fullPage: true });
  await panel.getByRole("button", { name: "Cancelar", exact: true }).click();
  await openPrice();
  await expect.poll(async () => Math.abs(await width() - available * 0.5)).toBeLessThan(1);
  await grip.focus();
  await page.keyboard.press("Home");
  await expect.poll(async () => Math.abs(await width() - available * 0.2)).toBeLessThan(1);
  await expect(grip).toHaveAttribute("aria-valuenow", "20");
  await page.keyboard.press("End");
  await expect.poll(async () => Math.abs(await width() - available * 0.5)).toBeLessThan(1);
  const cancelBox = (await grip.boundingBox())!;
  await page.mouse.move(cancelBox.x + cancelBox.width / 2, cancelBox.y + cancelBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(1430, center.y);
  await expect.poll(async () => Math.abs(await width() - available * 0.2)).toBeLessThan(1);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(panel).toBeVisible();
  await expect.poll(async () => Math.abs(await width() - available * 0.5)).toBeLessThan(1);
  await panel.getByRole("button", { name: "Cancelar", exact: true }).click();

  // A custom lateral (not AdminResourceDrawer) uses the same standard and a separate identity.
  await page.getByRole("button", { name: "Variantes", exact: true }).click();
  await page.getByRole("button", { name: "Agregar servicio", exact: true }).click();
  const offering = page.locator(".productOfferingDrawer");
  const offeringGrip = offering.getByRole("separator");
  await expect.poll(async () => Math.abs((await offering.boundingBox())!.width - available * 0.4)).toBeLessThan(1);
  await offeringGrip.focus();
  await page.keyboard.press("Home");
  await offering.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: "Agregar servicio", exact: true }).click();
  await expect.poll(async () => Math.abs((await offering.boundingBox())!.width - available * 0.2)).toBeLessThan(1);
  await offering.getByRole("button", { name: "Cerrar", exact: true }).click();
  await openPrice();
  await expect.poll(async () => Math.abs(await width() - available * 0.5)).toBeLessThan(1);
  await panel.getByRole("button", { name: "Cancelar", exact: true }).click();

  // Same page, navigation collapsed: retain the ratio and measure the new available area.
  await page.getByRole("button", { name: "Ocultar navegación", exact: true }).click();
  await openPrice();
  await expect.poll(async () => Math.abs(await width() - 720)).toBeLessThan(1);
  await panel.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("button", { name: "Mostrar navegación", exact: true }).click();
  await page.locator('a[href="/admin/products"]').first().click();
  await page.waitForURL(`http://127.0.0.1:${nextPort}/admin/products`);
  await page.goBack();
  await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Producto existente Playwright");
  await openPrice();
  await expect.poll(async () => Math.abs(await width() - available * 0.4)).toBeLessThan(1);
  await panel.getByRole("button", { name: "Cancelar", exact: true }).click();
});

test("drawer query changes keep the same module width across server-rendered open and close", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/catalogo/marcas`);
  const create = page.getByRole("link", { name: "Crear nueva", exact: true });
  await create.click();
  const panel = page.getByRole("dialog", { name: "Crear marca", exact: true });
  await expect(panel).toBeVisible();
  const grip = panel.getByRole("separator");
  await grip.focus();
  await page.keyboard.press("Home");
  await expect(grip).toHaveAttribute("aria-valuenow", "20");
  const before = (await panel.boundingBox())!.width;
  await panel.getByRole("link", { name: "Cerrar", exact: true }).click();
  await expect(panel).toHaveCount(0);
  await create.click();
  await expect.poll(async () => Math.abs((await panel.boundingBox())!.width - before)).toBeLessThan(1);
  await expect(panel.getByRole("separator")).toHaveAttribute("aria-valuenow", "20");
});

test.describe("promotion dates in Madrid", () => {
  test.use({ timezoneId: "Europe/Madrid" });
  for (const [label, from, until] of [
    ["neither", "", ""],
    ["start only", "2027-11-13T00:00", ""],
    ["end only", "", "2027-11-14T00:00"],
    ["both", "2027-11-13T00:00", "2027-11-14T00:00"],
  ]) test(`specific price supports optional dates: ${label}`, async ({ page }) => {
    pricingDatesScenario = true;
    capturedSaveOperationBodies.length = 0;
    saveOperationMode = "success";
    try {
      await loginAdmin(page);
      await page.goto(`http://127.0.0.1:${nextPort}/admin/products/product-edit-1`);
      await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Producto existente Playwright");
      await page.getByRole("button", { name: "Precio", exact: true }).click();
      const edit = page.getByRole("table", { name: "Precios específicos", exact: true }).getByRole("button", { name: /^Editar precio específico/ });
      await edit.click();
      const panel = page.getByRole("dialog", { name: "Editar precio específico", exact: true });
      await expect(panel.getByRole("checkbox", { name: "Ilimitado", exact: true })).toHaveCount(0);
      await expect(panel.getByLabel("Fecha final", { exact: true })).toBeEnabled();
      await panel.getByLabel("Fecha inicial", { exact: true }).fill(from);
      await panel.getByLabel("Fecha final", { exact: true }).fill(until);
      await panel.getByRole("button", { name: "Actualizar precio especifico", exact: true }).click();
      await expect(panel).toHaveCount(0);
      await edit.click();
      await expect(panel.getByLabel("Fecha inicial", { exact: true })).toHaveValue(from);
      await expect(panel.getByLabel("Fecha final", { exact: true })).toHaveValue(until);
      await panel.getByRole("button", { name: "Cancelar", exact: true }).click();
      await page.getByRole("button", { name: "Guardar", exact: true }).click();
      await expect(page.getByRole("dialog").getByRole("separator")).toHaveCount(0);
      await page.getByRole("dialog").getByRole("button", { name: "Guardar borrador", exact: true }).click();
      await expect(page.getByText("Producto guardado.", { exact: true })).toBeVisible();
      const rule = JSON.parse(parseMultipartTextField(capturedSaveOperationBodies.at(-1)!, "draft")).pricing.specificPrices[0];
      expect(rule.validFrom).toBe(from ? "2027-11-12T23:00:00.000Z" : null);
      expect(rule.validUntil).toBe(until ? "2027-11-13T23:00:00.000Z" : null);
      expect(rule.unlimited).toBe(!until);
    } finally { pricingDatesScenario = false; }
  });
  for (const edited of [false, true]) test(`product pricing preserves legacy BASE and the autumn overlap (${edited ? "edited" : "unchanged"})`, async ({ page }) => {
    pricingDatesScenario = true;
    capturedSaveOperationBodies.length = 0;
    saveOperationMode = "success";
    try {
      await loginAdmin(page);
      await page.goto(`http://127.0.0.1:${nextPort}/admin/products/product-edit-1`);
      await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Producto existente Playwright");
      await page.getByRole("button", { name: "Precio", exact: true }).click();
      await expect(page.getByText("Contexto avanzado de precio base", { exact: true })).toHaveCount(0);
      const list = page.getByRole("region", { name: "Precios específicos", exact: true });
      await list.getByRole("button", { name: /^Editar precio específico/ }).click();
      const panel = page.getByRole("dialog", { name: "Editar precio específico", exact: true });
      await expect(panel).toBeVisible();
      await expect(panel.getByLabel("Fecha inicial", { exact: true })).toHaveValue("2026-10-25T02:30");
      await expect(panel.getByLabel("Fecha final", { exact: true })).toHaveValue("2026-10-27T00:00");
      if (edited) await panel.getByLabel("Fecha inicial", { exact: true }).fill("2026-10-25T02:45");
      await panel.getByLabel("Precio especifico", { exact: true }).fill("19");
      await panel.getByRole("button", { name: "Actualizar precio especifico", exact: true }).click();
      await expect(panel).toHaveCount(0);
      await list.getByRole("button", { name: /^Editar precio específico/ }).click();
      await expect(panel.getByLabel("Fecha inicial", { exact: true })).toHaveValue(edited ? "2026-10-25T02:45" : "2026-10-25T02:30");
      await panel.getByLabel("Fecha inicial", { exact: true }).fill("2026-03-29T02:30");
      await panel.getByRole("button", { name: "Actualizar precio especifico", exact: true }).click();
      await expect(panel.getByRole("alert")).toContainText("no existe en tu zona horaria");
      if (!edited) {
        await page.addScriptTag({ path: createRequire(process.cwd() + "/package.json").resolve("axe-core/axe.min.js") });
        const violations = await page.evaluate(async () => {
          const w = window as unknown as { axe: { run: (context: Element) => Promise<{ violations: unknown[] }> } };
          return (await w.axe.run(document.querySelector(".productSpecificPriceForm > .adminFormGrid")!)).violations;
        });
        expect(violations).toEqual([]);
      }
      // The invalid edit never replaces the valid rule in the draft.
      await panel.getByRole("button", { name: "Cancelar", exact: true }).click();
      await expect(panel).toHaveCount(0);
      await list.getByRole("button", { name: /^Editar precio específico/ }).click();
      await expect(panel.getByRole("alert")).toHaveCount(0);
      for (const width of [1440, 768, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await expect(panel.getByLabel("Fecha inicial", { exact: true })).toBeVisible();
        expect(await panel.evaluate(element => element.getBoundingClientRect().width <= document.documentElement.clientWidth)).toBe(true);
        const bounds = await panel.boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await panel.getByRole("button", { name: "Cancelar", exact: true }).click();
      await page.getByRole("button", { name: "Guardar", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Guardar borrador", exact: true }).click();
      await expect(page.getByText("Producto guardado.", { exact: true })).toBeVisible();
      const pricing = JSON.parse(parseMultipartTextField(capturedSaveOperationBodies.at(-1)!, "draft")).pricing;
      expect(pricing.productPrice).toMatchObject({ pricingId: "pricing-edit-product", source: "BASE", basePriceMinor: 129900, priceTableId: "base", country: "FR", channel: "marketplace", tradePolicy: "b2b", customerGroup: "vip", validFrom: "2026-01-01T00:00:00Z", validUntil: "2027-01-01T00:00:00Z", timezone: "Europe/Madrid", active: true, priority: 37 });
      expect(pricing.specificPrices[0]).toMatchObject({ pricingId: "pricing-date-overlap", fixedPriceMinor: 1900, validFrom: edited ? "2026-10-25T01:45:00.000Z" : "2026-10-25T01:30:15.123Z", validUntil: "2026-10-26T23:00:00.000Z" });
    } finally { pricingDatesScenario = false; }
  });
  test("pricing simulator sends future Madrid dates, variants, groups and quantities without saving", async ({ page }) => {
    capturedPricingPreviewRequests.length = 0;
    capturedSaveOperationRequests.length = 0;
    await loginAdmin(page);
    await page.goto(`http://127.0.0.1:${nextPort}/admin/products/product-edit-1`);
    await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Producto existente Playwright");
    await page.getByRole("button", { name: "Precio", exact: true }).click();
    const panel = page.locator("details.productSpecificPrices").filter({ has: page.locator("summary", { hasText: "Simulador de precio aplicado" }) });
    await panel.locator(":scope > summary").click();
    await expect(panel).toHaveAttribute("open", "");
    await panel.getByLabel("Aplicar sobre").selectOption("variant-edit-red");
    await panel.getByLabel("Grupo cliente").selectOption("vip");
    await panel.getByLabel("Price table").selectOption("cockpit-vip");
    await panel.getByLabel("Cantidad", { exact: true }).fill("3");
    await panel.getByLabel("Fecha de simulacion", { exact: true }).fill("2026-03-29T02:30");
    await panel.getByRole("button", { name: "Simular precio", exact: true }).click();
    await expect(panel.getByRole("alert")).toContainText("no existe en tu zona horaria");
    expect(capturedPricingPreviewRequests).toHaveLength(0);
    await panel.getByLabel("Fecha de simulacion", { exact: true }).fill("2027-11-13T00:00");
    await panel.getByRole("button", { name: "Simular precio", exact: true }).click();
    await expect(panel.getByText("Precio aplicado", { exact: true })).toBeVisible();
    const query = new URL(capturedPricingPreviewRequests[0], "http://fixture.invalid").searchParams;
    expect(query.get("at")).toBe("2027-11-12T23:00:00.000Z");
    expect(query.get("variantId")).toBe("variant-edit-red");
    expect(query.get("customerGroup")).toBe("vip");
    expect(query.get("quantity")).toBe("3");
    expect(capturedSaveOperationRequests).toHaveLength(0);
  });
});

test("shop read preparation retries without creating another shop and polls until ready", async ({page}) => {
  shopPreparationState = "FAILED";
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/contexto`);
  await expect(page.getByRole("region", {name:"Preparación de la tienda",exact:true})).toHaveCount(0);
  expect(capturedPreparationRetries).toEqual([]);
  await captureEvidence(page, "01-context-without-preparation-block");
  await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/contexto?tab=create-shop&preparationOrganizationId=${defaultOrganizationId}&preparationShopId=${barcelonaShopId}`);
  await expect(page.locator("#create-shop-form")).toBeHidden();
  const panel = page.getByRole("region", {name:"Preparación de la tienda",exact:true});
  await expect(panel.getByText("Requiere atención",{exact:true})).toBeVisible();
  await panel.getByRole("button",{name:"Reintentar preparación",exact:true}).click();
  await expect(panel.getByText("Lista",{exact:true})).toBeVisible();
  expect(capturedPreparationRetries).toEqual([{retry:true}]);
  await expect(panel.getByRole("button")).toHaveCount(0);
  await expect(panel.getByRole("link", {name:"Continuar",exact:true})).toBeVisible();
  for (const width of [1440,768,390]) {
    await page.setViewportSize({width,height:900});
    expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  }
});

test("shop read preparation hides retry from an employee without management permission", async ({page}) => {
  shopPreparationState = "FAILED";
  authPermissions = ["admin:configuration:view", "organizations-shops.read"];
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/contexto?tab=edit-shop`);
  const panel=page.getByRole("region",{name:"Preparación de la tienda",exact:true});
  await expect(panel.getByText("Requiere atención",{exact:true})).toBeVisible();
  await expect(panel.getByRole("button")).toHaveCount(0);
  expect(capturedPreparationRetries).toEqual([]);
});


const createFormCases = [
 {name:'category',route:'/admin/catalogo/categorias',label:'Crear categoría',fields:{name:'Categoría de prueba',slug:'test-category',description:'Descripción',title:'Título',keywords:'test'}},
 {name:'brand',route:'/admin/catalogo/marcas',label:'Crear marca',fields:{name:'Marca de prueba',text:'Descripción',siteTitle:'Título',keywords:'test'}},
 {name:'payment-system',route:'/admin/pagos?tab=metodos&drawer=create-payment-system',label:'Crear método de pago',fields:{paymentSystemId:'test-card',name:'Método',group:'cards',type:'credit-card'}},
 {name:'affiliation',route:'/admin/pagos?tab=proveedores&drawer=create-affiliation',label:'Crear proveedor de pago',fields:{affiliationId:'test-affiliation',name:'Proveedor',providerName:'stripe',merchantId:'merchant-test'}},
 {name:'payment-rule',route:'/admin/pagos?tab=routing&drawer=create-payment-rule',label:'Crear regla de pago',fields:{ruleId:'test-rule',name:'Regla',paymentSystemId:'card',affiliationId:'psp',priority:'100',country:'ES',currency:'EUR'}},
];
for(const entry of createFormCases){
 test(`canonical creation ${entry.name} retains values after rejection and submits corrected payload`,async({page})=>{
  await loginAdmin(page);await page.goto(`http://127.0.0.1:${nextPort}${entry.route}`);
  if(entry.name==='category'||entry.name==='brand') await page.getByRole('link',{name:'Crear nueva',exact:true}).click();
  const form=page.getByRole('form',{name:entry.label,exact:true});await expect(form).toBeVisible();
  await form.getByRole('button',{name:/Crear nueva|Guardar/}).click();expect(configurationCreates).toHaveLength(0);
  for(const [key,value]of Object.entries(entry.fields)){const input=form.locator(`[name="${key}"]`);if(await input.evaluate(el=>el.tagName)==='SELECT')await input.selectOption(value);else await input.fill(value);}
  if(entry.name==='payment-rule'){
    await form.locator('[name="minValueMinor"]').fill('10');await form.locator('[name="maxValueMinor"]').fill('1');await form.getByRole('button',{name:/Guardar/}).click();await expect(form.locator('[name="maxValueMinor"]')).toHaveAttribute('aria-invalid','true');expect(configurationCreates).toHaveLength(0);await form.locator('[name="maxValueMinor"]').fill('20');
  }
  rejectConfigurationCreate=true;await form.getByRole('button',{name:/Crear nueva|Guardar/}).click();await expect(form.getByRole('alert')).toBeVisible();await expect(form.locator('[name="name"]')).toHaveValue(entry.fields.name);expect(configurationCreates).toHaveLength(1);
  rejectConfigurationCreate=false;await form.getByRole('button',{name:/Crear nueva|Guardar/}).click();
  if(entry.name==='category'||entry.name==='brand')await expect(form.getByRole('status')).toContainText(/creada/);else await expect(page).toHaveURL(/notice=/);
  expect(configurationCreates).toHaveLength(2);
 });
}

test('catalog creation is hidden without write permission',async({page})=>{
 authPermissions=['admin:catalog:view','catalog.products.read'];await loginAdmin(page);await page.goto(`http://127.0.0.1:${nextPort}/admin/catalogo/categorias`);await expect(page.getByRole('form',{name:'Crear categoría',exact:true})).toHaveCount(0);expect(configurationCreates).toHaveLength(0);
});


test('payment activation requires confirmation and cancellation preserves the form',async({page})=>{
 await loginAdmin(page);await page.goto(`http://127.0.0.1:${nextPort}/admin/pagos?tab=metodos&drawer=create-payment-system`);const form=page.getByRole('form',{name:'Crear método de pago',exact:true});for(const [key,value]of Object.entries({paymentSystemId:'confirmed-card',name:'Tarjeta',group:'cards',type:'credit-card'}))await form.locator(`[name="${key}"]`).fill(value);await expect(form.locator('[name="active"]')).not.toBeChecked();await form.locator('[name="active"]').check();
 page.once('dialog',dialog=>dialog.dismiss());await form.getByRole('button',{name:'Guardar método',exact:true}).click();expect(configurationCreates).toHaveLength(0);await expect(form.locator('[name="name"]')).toHaveValue('Tarjeta');
 page.once('dialog',dialog=>dialog.accept());await form.getByRole('button',{name:'Guardar método',exact:true}).click();await expect(page).toHaveURL(/notice=/);expect(configurationCreates).toHaveLength(1);expect(configurationCreates[0].body.active).toBe(true);
});


test('live employee read permissions hide management even while the signed cookie previously had admin wildcard',async({page})=>{
 await loginAdmin(page);authPermissions=['employees.read'];await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/equipo?tab=create-employee`);
 await expect(page.getByRole('button',{name:'Crear empleado',exact:true})).toHaveCount(0);await expect(page.getByRole('form',{name:'employee-create-form'})).toHaveCount(0);await expect(page.locator('#employee-create-form')).toHaveCount(0);await expect(page.getByRole('button',{name:'Editar',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Desactivar',exact:true})).toHaveCount(0);
 await page.getByRole('tab',{name:'Perfiles',exact:true}).click();await expect(page.getByRole('button',{name:'Crear perfil',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Editar',exact:true})).toHaveCount(0);
 await page.getByRole('tab',{name:'Permisos',exact:true}).click();await expect(page.getByRole('button',{name:'Asignar permisos',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:/employees.manage/})).toBeDisabled();
});
test('employee manage permission does not expose profile security actions',async({page})=>{
 authPermissions=['employees.read','employees.manage'];await loginAdmin(page);await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/equipo`);await expect(page.getByRole('button',{name:'Crear empleado',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Editar',exact:true})).toBeVisible();await page.getByRole('tab',{name:'Perfiles',exact:true}).click();await expect(page.getByRole('button',{name:'Crear perfil',exact:true})).toHaveCount(0);
});
test('profile security permission does not expose employee management actions',async({page})=>{
 authPermissions=['employees.read','employees.security'];await loginAdmin(page);await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/equipo`);await expect(page.getByRole('button',{name:'Crear empleado',exact:true})).toHaveCount(0);await page.getByRole('tab',{name:'Perfiles',exact:true}).click();await expect(page.getByRole('button',{name:'Crear perfil',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Editar',exact:true})).toBeVisible();
});
test('live catalog read permissions hide editing and deletion as well as creation',async({page})=>{
 await loginAdmin(page);authPermissions=['catalog.products.read'];await page.goto(`http://127.0.0.1:${nextPort}/admin/catalogo/categorias`);await expect(page.getByRole('form',{name:'Crear categoría',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:/Guardar|Eliminar/})).toHaveCount(0);
});
test('live payment read permission hides creation without retaining the old cookie wildcard',async({page})=>{
 await loginAdmin(page);authPermissions=['payments.configuration.read'];await page.goto(`http://127.0.0.1:${nextPort}/admin/pagos?tab=metodos&drawer=create-payment-system`);await expect(page.getByRole('form',{name:'Crear método de pago',exact:true})).toHaveCount(0);await expect(page.getByRole('link',{name:'Nuevo método',exact:true})).toHaveCount(0);
});
test('expired admin session renews through the cookie-writing handler and stays authenticated',async({page})=>{
 await loginAdmin(page);authMeFailuresRemaining=2;await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/equipo`);await expect(page).not.toHaveURL(/auth\/login/);await expect(page.getByRole('button',{name:'Salir',exact:true})).toBeVisible();expect(sessionRefreshCalls).toBe(1);
});


test('health indicator distinguishes successful HTTP error payloads, degraded readiness and unavailable transport',async({page})=>{
 await loginAdmin(page);dashboardHealthScenario='mixed';await page.goto(`http://127.0.0.1:${nextPort}/admin`);const panel=page.getByRole('article',{name:'Salud de servicios',exact:true});
 for(const[name,status]of [['Analytics','Degradado'],['Automation','Degradado'],['Communications','No disponible'],['After Sales','OK'],['Search','Sin confirmar']]){const row=panel.locator('.adminStatusRow').filter({has:page.getByText(name,{exact:true})});await expect(row.locator('.adminBadge')).toHaveText(status);if(status!=='OK')await expect(row.locator('.adminBadge')).not.toHaveClass(/adminBadgeOk/);}
 await expect(page.locator('.adminKpi').filter({hasText:'Servicios OK'}).locator('strong')).toHaveText('1');await expect(page.locator('.adminKpi').filter({hasText:'Requieren revisión'}).locator('strong')).toHaveText('3');await expect(page.locator('.adminKpi').filter({hasText:'No disponibles'}).locator('strong')).toHaveText('1');await expect(page.getByText('internal-secret-stack-marker',{exact:false})).toHaveCount(0);
});
test('health indicator never treats an empty successful response as operational',async({page})=>{
 await loginAdmin(page);dashboardHealthScenario='invalid';await page.goto(`http://127.0.0.1:${nextPort}/admin`);const panel=page.getByRole('article',{name:'Salud de servicios',exact:true});await expect(panel.locator('.adminBadgeOk')).toHaveCount(0);await expect(panel.locator('.adminStatusRow').filter({hasText:'Sin confirmar'})).toHaveCount(5);
});
test('health indicator still recognizes explicitly healthy services',async({page})=>{
 await loginAdmin(page);await page.goto(`http://127.0.0.1:${nextPort}/admin`);const panel=page.getByRole('article',{name:'Salud de servicios',exact:true});await expect(panel.locator('.adminBadgeOk')).toHaveCount(5);await expect(page.locator('.adminKpi').filter({hasText:'Servicios OK'}).locator('strong')).toHaveText('5');
});


test('Analytics health badge cannot turn a successful HTTP error response into available',async({page})=>{
 await loginAdmin(page);dashboardHealthScenario='mixed';await page.goto(`http://127.0.0.1:${nextPort}/admin/analitica`);await expect(page.getByText('Analytics degradado',{exact:true})).toBeVisible();await expect(page.getByText('Analytics disponible',{exact:true})).toHaveCount(0);await expect(page.getByText('internal-secret-stack-marker',{exact:false})).toHaveCount(0);
 dashboardHealthScenario='invalid';await page.reload();await expect(page.getByText('Analytics sin confirmar',{exact:true})).toBeVisible();await expect(page.getByText('Analytics disponible',{exact:true})).toHaveCount(0);
});

test("communications tabs isolate workspaces and keep Team toolbar responsive", async ({page}) => {
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/comunicaciones`);
  const nav = page.getByRole("navigation", {name:"Comunicaciones",exact:true});
  await expect(nav.getByRole("link",{name:"Proveedor email",exact:true})).toHaveAttribute("aria-current","page");
  await expect(page.getByRole("heading",{name:"Plantillas email",exact:true})).toHaveCount(0);
  await expect(page.getByRole("heading",{name:"Auditoría de entregas",exact:true})).toHaveCount(0);
  await nav.getByRole("link",{name:"Plantillas",exact:true}).click();
  await expect(page).toHaveURL(/tab=templates/);
  const create = page.getByRole("link",{name:"Crear plantilla",exact:true});
  await expect(create).toHaveClass(/employeesTextAction/);
  await expect(page.getByRole("heading",{name:"Proveedor email",exact:true})).toHaveCount(0);
  for (const width of [1440,768,390]) {
    await page.setViewportSize({width,height:900});
    expect(await page.locator('.employeesToolbar').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await create.scrollIntoViewIfNeeded();
    await expect(create).toBeInViewport();
    const bounds = await create.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    if (width === 390) await captureEvidence(page, "15-templates-mobile");
  }
  await page.setViewportSize({width:1440,height:900});
  await page.screenshot({path:'.tmp/communications-templates-desktop.png',fullPage:true});
  await captureEvidence(page, '09-template-filters-full-width');
  expect(await page.locator('.communicationsWorkspace input:not([type="hidden"]), .communicationsWorkspace select').evaluateAll(elements => elements.every(el => Boolean((el as HTMLInputElement).labels?.length || el.getAttribute('aria-label'))))).toBe(true);
  await create.click();
  await page.getByRole("dialog",{name:"Crear plantilla email",exact:true}).getByRole("link",{name:"Cerrar",exact:true}).click();
  await expect(nav.getByRole("link",{name:"Plantillas",exact:true})).toHaveAttribute("aria-current","page");
  await nav.getByRole("link",{name:"Auditoría de entregas",exact:true}).click();
  await expect(page.getByRole("button",{name:"Actualizar",exact:true})).toBeVisible();
  await page.reload();
  await expect(nav.getByRole("link",{name:"Auditoría de entregas",exact:true})).toHaveAttribute("aria-current","page");
  await page.getByLabel("Evento origen",{exact:true}).fill("event-keep");
  await page.getByRole("button",{name:"Aplicar filtros",exact:true}).click();
  await page.getByRole("button",{name:"Actualizar",exact:true}).click();
  await expect(page).toHaveURL(/deliverySourceEventId=event-keep/);
  await expect(page.getByLabel("Evento origen",{exact:true})).toHaveValue("event-keep");
});

test("communications tabs hide management controls for read-only employees",async({page})=>{
  authPermissions=["admin:configuration:view","communications.read"];
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/comunicaciones`);
  await expect(page.getByRole("link",{name:"Configurar proveedor",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Enviar prueba",exact:true})).toHaveCount(0);
  await page.getByRole("navigation",{name:"Comunicaciones",exact:true}).getByRole("link",{name:"Plantillas",exact:true}).click();
  await expect(page.getByRole("link",{name:"Crear plantilla",exact:true})).toHaveCount(0);
  await expect(page.getByRole("link",{name:"Editar",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Crear defaults auth",exact:true})).toHaveCount(0);
  await captureEvidence(page, "16-templates-read-only");
});

test("category list creates in a drawer, edits inline and groups soft and hard deletion",async({page})=>{
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/catalogo/categorias`);
  await expect(page.getByRole('form',{name:'Crear categoría',exact:true})).toHaveCount(0);
  const search=page.getByRole('form',{name:'Buscar categorías',exact:true});
  await search.getByRole('textbox',{name:'Buscar',exact:true}).fill('Bici');
  await search.getByRole('button',{name:'Buscar',exact:true}).click();
  await expect(page).toHaveURL(/q=Bici/);
  await captureEvidence(page,'21-category-search-list');
  for(const width of [1440,768,390]){
    await page.setViewportSize({width,height:1000});
    expect(await search.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('link',{name:'Crear nueva',exact:true}).click();
  const drawer=page.getByRole('dialog',{name:'Crear categoría',exact:true});
  await expect(drawer.getByLabel('Nombre',{exact:true})).toBeFocused();
  await captureEvidence(page,'22-category-create-drawer');
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(search.getByRole('textbox',{name:'Buscar',exact:true})).toHaveValue('Bici');
  const row=page.getByRole('row').filter({has:page.getByRole('textbox',{name:'Nombre Bicicletas',exact:true})});
  await row.getByRole('textbox',{name:'Nombre Bicicletas',exact:true}).fill('Bicicletas urbanas');
  await row.getByRole('button',{name:'Guardar',exact:true}).click();
  await expect.poll(()=>categoryMutations.filter(item=>item.method==='PATCH').length).toBe(1);
  expect(categoryMutations[0].body).toMatchObject({name:'Bicicletas urbanas',isActive:true});
  await page.getByRole('button',{name:'Acciones de Bicicletas urbanas',exact:true}).click();
  await expect(page.getByRole('button',{name:'Eliminar soft',exact:true})).toBeVisible();
  await captureEvidence(page,'23-category-actions-menu');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('button',{name:'Eliminar hard',exact:true}).click();
  expect(categoryMutations.filter(item=>item.method==='DELETE')).toHaveLength(0);
  await page.getByRole('button',{name:'Eliminar soft',exact:true}).click();
  await expect.poll(()=>categoryMutations.filter(item=>item.mode==='soft').length).toBe(1);
  await expect(page.getByRole('button',{name:'Acciones de Bicicletas urbanas',exact:true})).toHaveCount(0);
  await search.getByRole('combobox',{name:'Estado',exact:true}).selectOption('inactive');
  await search.getByRole('button',{name:'Buscar',exact:true}).click();
  await expect(page.getByRole('button',{name:'Acciones de Bicicletas urbanas',exact:true})).toBeVisible();
  await captureEvidence(page,'24-category-soft-deleted');
  await page.getByRole('button',{name:'Acciones de Bicicletas urbanas',exact:true}).click();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Eliminar hard',exact:true}).click();
  await expect.poll(()=>categoryMutations.filter(item=>item.mode==='hard').length).toBe(1);
  await expect(page.getByRole('button',{name:'Acciones de Bicicletas urbanas',exact:true})).toHaveCount(0);
});

test("brand list creates in a drawer, edits inline and groups soft and hard deletion",async({page})=>{
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/catalogo/marcas`);
  await expect(page.getByRole('form',{name:'Crear marca',exact:true})).toHaveCount(0);
  const search=page.getByRole('form',{name:'Buscar marcas / proveedores',exact:true});
  await search.getByRole('textbox',{name:'Buscar',exact:true}).fill('Marca');
  await search.getByRole('button',{name:'Buscar',exact:true}).click();
  await expect(page).toHaveURL(/q=Marca/);
  await captureEvidence(page,'25-brand-search-list');
  for(const width of [1440,768,390]){
    await page.setViewportSize({width,height:1000});
    expect(await search.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('link',{name:'Crear nueva',exact:true}).click();
  const drawer=page.getByRole('dialog',{name:'Crear marca',exact:true});
  await expect(drawer.getByLabel('Nombre',{exact:true})).toBeFocused();
  await captureEvidence(page,'26-brand-create-drawer');
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(search.getByRole('textbox',{name:'Buscar',exact:true})).toHaveValue('Marca');
  const row=page.getByRole('row').filter({has:page.getByRole('textbox',{name:'Nombre Marca Demo',exact:true})});
  await row.getByRole('textbox',{name:'Nombre Marca Demo',exact:true}).fill('Marca Renovada');
  await row.getByRole('button',{name:'Guardar',exact:true}).click();
  await expect.poll(()=>brandMutations.filter(item=>item.method==='PATCH').length).toBe(1);
  expect(brandMutations[0].body).toMatchObject({name:'Marca Renovada',isActive:true});
  await page.getByRole('button',{name:'Acciones de Marca Renovada',exact:true}).click();
  await expect(page.getByRole('button',{name:'Eliminar soft',exact:true})).toBeVisible();
  await captureEvidence(page,'27-brand-actions-menu');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('button',{name:'Eliminar hard',exact:true}).click();
  expect(brandMutations.filter(item=>item.method==='DELETE')).toHaveLength(0);
  await page.getByRole('button',{name:'Eliminar soft',exact:true}).click();
  await expect.poll(()=>brandMutations.filter(item=>item.mode==='soft').length).toBe(1);
  await expect(page.getByRole('button',{name:'Acciones de Marca Renovada',exact:true})).toHaveCount(0);
  await search.getByRole('combobox',{name:'Estado',exact:true}).selectOption('inactive');
  await search.getByRole('button',{name:'Buscar',exact:true}).click();
  await expect(page.getByRole('button',{name:'Acciones de Marca Renovada',exact:true})).toBeVisible();
  await captureEvidence(page,'28-brand-soft-deleted');
  await page.getByRole('button',{name:'Acciones de Marca Renovada',exact:true}).click();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Eliminar hard',exact:true}).click();
  await expect.poll(()=>brandMutations.filter(item=>item.mode==='hard').length).toBe(1);
  await expect(page.getByRole('button',{name:'Acciones de Marca Renovada',exact:true})).toHaveCount(0);
});

test("brand list hides creation and row actions without brand write permission",async({page})=>{
  authPermissions=['admin:catalog:view','catalog.products.read'];
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/catalogo/marcas?drawer=create`);
  await expect(page.getByRole('link',{name:'Crear nueva',exact:true})).toHaveCount(0);
  await expect(page.getByRole('form',{name:'Crear marca',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Guardar',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:/Acciones de/})).toHaveCount(0);
});

test("media library uses shared search, inline editing and a scoped creation drawer",async({page})=>{
  capturedMediaAdminMutations.length=0;
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/catalogo/media?status=all`);
  const search=page.getByRole('form',{name:'Filtros media',exact:true});
  await search.getByRole('textbox',{name:'Buscar',exact:true}).fill('Galeria');
  await search.getByRole('button',{name:'Aplicar',exact:true}).click();
  await expect(page).toHaveURL(/q=Galeria/);
  await expect(page.getByRole('form',{name:'Crear colección media',exact:true})).toHaveCount(0);
  await expect(page.getByRole('textbox',{name:'Título Galeria producto existente',exact:true}).locator('..').locator('..').locator('.adminContextHint')).toHaveCount(0);
  await captureEvidence(page,'29-media-library-list');
  for(const width of [1440,768,390]){
    await page.setViewportSize({width,height:1000});
    expect(await search.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    if(width===768) await captureEvidence(page,'37-media-tablet');
    if(width===390) await captureEvidence(page,'38-media-mobile');
  }
  await page.setViewportSize({width:1440,height:1000});
  const title=page.getByRole('textbox',{name:'Título Galeria producto existente',exact:true});
  await title.fill('Galeria revisada');
  await title.locator('..').getByRole('button',{name:'Guardar',exact:true}).click();
  await expect(page.getByText('Coleccion media actualizada.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Acciones de Galeria revisada',exact:true}).click();
  await captureEvidence(page,'30-media-library-actions');
  await page.keyboard.press('Escape');
  await page.getByRole('link',{name:'Crear nueva',exact:true}).click();
  const drawer=page.getByRole('dialog',{name:'Crear colección media',exact:true});
  const form=drawer.getByRole('form',{name:'Crear colección media',exact:true});
  await expect(form.getByLabel('Producto',{exact:true})).toBeFocused();
  await captureEvidence(page,'31-media-create-drawer');
  await form.getByLabel('Producto',{exact:true}).fill('product-edit-1');
  await form.getByLabel('Titulo',{exact:true}).fill('Galeria nueva');
  await form.getByLabel('Archivos',{exact:true}).setInputFiles({name:'unsafe.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg onload="alert(1)"/>')});
  await form.getByRole('button',{name:'Crear coleccion',exact:true}).click();
  await expect(drawer.locator('.adminBannerError')).toBeVisible();
  expect(capturedMediaAdminMutations.some(item=>item.method==='POST')).toBe(false);
  await form.getByLabel('Producto',{exact:true}).fill('product-edit-1');
  await form.getByLabel('Titulo',{exact:true}).fill('Galeria nueva');
  await form.getByLabel('Archivos',{exact:true}).setInputFiles({name:'safe.png',mimeType:'image/png',buffer:Buffer.from(onePixelPngDataUrl.split(',')[1],'base64')});
  await form.getByRole('button',{name:'Crear coleccion',exact:true}).click();
  await expect(page).toHaveURL(/collectionId=collection-created-media/);
  await expect(page).not.toHaveURL(/drawer=create/);
  await expect(page.getByRole('dialog',{name:'Detalle de coleccion media',exact:true})).toBeVisible();
  await expect(page.getByText('Coleccion media creada.',{exact:true})).toBeVisible();
  await captureEvidence(page,'32-media-created-detail');
});

test("media library read-only hides creation, uploads, inline editing and deactivation",async({page})=>{
  authPermissions=['admin:catalog:view','catalog.products.read'];
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/catalogo/media?drawer=create`);
  await expect(page.getByRole('link',{name:'Crear nueva',exact:true})).toHaveCount(0);
  await expect(page.getByRole('form',{name:'Crear colección media',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Guardar',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Acciones de Galeria producto existente',exact:true}).click();
  await expect(page.getByRole('link',{name:'Desactivar colección',exact:true})).toHaveCount(0);
  await page.getByRole('link',{name:'Revisar',exact:true}).click();
  const detail=page.getByRole('dialog',{name:'Detalle de coleccion media',exact:true});
  await expect(detail.locator('input[type="file"]')).toHaveCount(0);
  await expect(detail.getByRole('button',{name:/Guardar|Desactivar|Subir/})).toHaveCount(0);
});

test("offerings list shares search, inline editing, drawers and confirmed deactivation",async({page})=>{
  capturedCatalogOfferingRequests.length=0;
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/catalogo/offerings`);
  const search=page.getByRole('form',{name:'Filtros de offerings',exact:true});
  await search.getByLabel('Filtrar offering por nombre').fill('Instalacion');
  await search.getByRole('button',{name:'Buscar',exact:true}).click();
  await expect(page).toHaveURL(/q=Instalacion/);
  await expect(page.getByRole('textbox',{name:'Nombre Instalacion',exact:true}).locator('..').locator('..').locator('.adminMuted')).toHaveCount(0);
  await captureEvidence(page,'33-offerings-search-list');
  for(const width of [1440,768,390]){
    await page.setViewportSize({width,height:1000});
    expect(await search.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    if(width===768) await captureEvidence(page,'39-offerings-tablet');
    if(width===390) await captureEvidence(page,'40-offerings-mobile');
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('link',{name:'Crear nueva',exact:true}).click();
  const create=page.getByRole('dialog',{name:'Crear offering',exact:true});
  await expect(create.getByLabel('Nombre',{exact:true})).toBeFocused();
  await expect(create.getByLabel('Moneda',{exact:true})).toHaveValue('EUR');
  await captureEvidence(page,'34-offerings-create-drawer');
  await page.keyboard.press('Escape');
  await expect(create).toHaveCount(0);
  const input=page.getByRole('textbox',{name:'Nombre Instalacion',exact:true});
  await input.fill('Instalacion especial');
  await input.locator('..').getByRole('button',{name:'Guardar',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Nombre Instalacion especial',exact:true})).toBeVisible();
  await expect(page).toHaveURL(/q=Instalacion/);
  expect(catalogOfferings[0]).toMatchObject({name:'Instalacion especial',priceMinor:1999,currency:'EUR',type:'service',active:true});
  await page.getByRole('button',{name:'Acciones de Instalacion especial',exact:true}).click();
  await captureEvidence(page,'35-offerings-actions-menu');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('button',{name:'Desactivar',exact:true}).click();
  expect(capturedCatalogOfferingRequests.some(item=>item.startsWith('DELETE'))).toBe(false);
  await page.getByRole('link',{name:'Editar Instalacion especial',exact:true}).click();
  const edit=page.getByRole('dialog',{name:/Editar offering:/});
  await expect(edit).toBeVisible();
  await captureEvidence(page,'36-offerings-edit-drawer');
  await edit.getByRole('link',{name:'Cerrar',exact:true}).click();
  await expect(page).toHaveURL(/q=Instalacion/);
});

test("offerings read-only hides management and direct panel access",async({page})=>{
  authPermissions=['admin:catalog:view','catalog.products.read'];
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/catalogo/offerings?panel=create`);
  await expect(page.getByRole('link',{name:'Crear nueva',exact:true})).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Guardar',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:/Acciones de/})).toHaveCount(0);
  await expect(page.getByText('Solo lectura',{exact:true})).toBeVisible();
});

async function openProductBasicSection(page: Page, title: string) {
  if (title === "Características y especificaciones") {
    await expect(page.getByRole("heading", { name: "Características", exact: true })).toBeVisible();
    return;
  }
  const currentTitle = title === "Categoría y marca / proveedor" ? "Categoría/Marca:" : title;
  const box = page.locator("details.productBasicSection").filter({has:page.locator("summary",{hasText:currentTitle})});
  if (await box.getAttribute("open") === null) await box.locator("summary").click();
}

test("product basic boxes collapse HTML and reuse category and brand drawers", async ({page}) => {
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);
  const boxes = page.locator("details.productBasicSection");
  await expect(boxes).toHaveCount(4);
  await expect(boxes.nth(0)).toHaveAttribute("open", "");
  for (const index of [1,2,3]) await expect(boxes.nth(index)).not.toHaveAttribute("open");
  await expect(page.getByRole("textbox",{name:"Resumen HTML",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Mostrar código HTML",exact:true}).first().click();
  await expect(page.getByRole("textbox",{name:"Resumen HTML",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Ocultar código HTML",exact:true}).click();
  await openProductBasicSection(page,"Categoría y marca / proveedor");
  for (const kind of ["category","brand"]) {
    await page.getByRole("button",{name:kind === "category" ? "Crear categoría" : "Crear marca o proveedor",exact:true}).click();
    const drawer=page.getByRole("dialog",{name:kind === "category" ? "Crear categoría" : "Crear marca / proveedor",exact:true});
    await expect(drawer.getByLabel("Nombre",{exact:true})).toBeFocused();
    const checkboxSize = await drawer.getByRole("checkbox",{name:"Activa",exact:true}).boundingBox();
    expect(checkboxSize?.width).toBeLessThanOrEqual(24);
    expect(checkboxSize?.height).toBeLessThanOrEqual(24);
    await page.keyboard.press("Shift+Tab");
    await expect(drawer.getByRole("button",{name:"Cerrar",exact:true})).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(drawer.getByRole("button",{name:"Crear y asignar",exact:true})).toBeFocused();
    await page.screenshot({path:`docs/qa/evidence/20261106/product-${kind}-drawer.png`,fullPage:true});
    await drawer.getByLabel("Nombre",{exact:true}).fill("Registro desde producto");
    await drawer.getByLabel(kind === "category" ? "Slug" : "Título SEO",{exact:true}).fill("registro-producto");
    if(kind === "category") await drawer.getByLabel("Título",{exact:true}).fill("Categoría producto");
    await drawer.getByLabel("Descripción",{exact:true}).fill("Descripción completa");
    await drawer.getByLabel("Palabras clave",{exact:true}).fill("producto");
    await drawer.getByRole("button",{name:"Crear y asignar",exact:true}).click();
    await expect(drawer).toHaveCount(0);
    await expect(page.getByLabel(kind === "category" ? "Categoria principal" : "Marca / proveedor",{exact:true})).toHaveValue(kind === "category" ? "created-category" : "created-brand");
  }
  for (const width of [1440,768,390]) {
    await page.setViewportSize({width,height:1000});
    expect(await boxes.evaluateAll(elements=>elements.every(el=>el.scrollWidth<=el.clientWidth))).toBe(true);
    await page.screenshot({path:`docs/qa/evidence/20261106/product-basic-${width}.png`,fullPage:true});
  }
});

test("product taxonomy creation respects the current employee permissions", async ({page}) => {
  await loginAdmin(page);
  authPermissions=["admin:catalog:view", "catalog.products.read", "catalog.products.write"];
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);
  await openProductBasicSection(page,"Categoría y marca / proveedor");
  await expect(page.getByRole("button",{name:"Crear categoría",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Crear marca o proveedor",exact:true})).toHaveCount(0);
  await expect(page.getByLabel("Categoria principal",{exact:true})).toBeVisible();
});

async function expectProductBlock(page: Page, text: string) {
  const previousTab = await page.locator(".productEditorTabActive").innerText();
  await page.getByRole("button", {name:"Auditoria",exact:true}).click();
  await expect(page.locator(".productAuditPanel").getByText(text,{exact:true})).toBeVisible();
  if(previousTab !== "Auditoria") await page.getByRole("button",{name:previousTab,exact:true}).click();
}

test("product footer keeps only preview save and a compact actions menu", async ({page}) => {
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/product-edit-1`);
  const footer = page.getByRole("group",{name:"Acciones del producto",exact:true});
  await expect(footer.getByRole("button")).toHaveCount(3);
  await expect(footer.locator(".productSaveBlocks")).toHaveCount(0);
  await expect(footer.getByRole("status")).toContainText("Sin cambios");
  await page.getByLabel("Nombre", { exact: true }).fill("Producto revisado");
  await expect(footer.getByRole("status")).toContainText("Cambios sin guardar");
  await expect(page.getByRole("link",{name:"Volver al catálogo",exact:true})).toBeVisible();
  for(const width of [1440,768,390]) {
    await page.setViewportSize({width,height:1000});
    await footer.scrollIntoViewIfNeeded();
    expect(await footer.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await footer.screenshot({path:`docs/qa/evidence/20261106/product-footer-${width}.png`});
  }
  await page.setViewportSize({width:1440,height:1000});
  await footer.getByRole("button",{name:"Más acciones del producto",exact:true}).click();
  const actions=page.getByRole("group",{name:"Más acciones del producto",exact:true});
  await expect(actions.getByRole("link",{name:"Duplicar",exact:true})).toHaveAttribute("href",/duplicateFrom=product-edit-1/);
  await expect(actions.getByRole("link",{name:"Crear otro producto",exact:true})).toHaveAttribute("href","/admin/products/new");
  await page.screenshot({path:"docs/qa/evidence/20261106/product-footer-menu.png",fullPage:false});
  const before=capturedBffRequests.filter(path=>path==="PATCH /api/v1/admin/products/product-edit-1").length;
  page.once("dialog",dialog=>dialog.dismiss());
  await actions.getByRole("button",{name:"Desactivar",exact:true}).click();
  await expect(actions).toBeHidden();
  expect(capturedBffRequests.filter(path=>path==="PATCH /api/v1/admin/products/product-edit-1").length).toBe(before);
  await footer.getByRole("button",{name:"Vista previa",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"Vista previa PDP",exact:true}).getByRole("link",{name:"Ver en tienda",exact:true})).toHaveAttribute("href","/admin/products/product-edit-1/storefront-preview");
});

for (const visible of [true,false]) {
  test(`active product saves changes preserving visibility=${visible}`, async ({page}) => {
    editorProductActive=true;
    editorProductVisible=visible;
    saveOperationMode="success";
    capturedSaveOperationRequests.length=0;
    capturedSaveOperationBodies.length=0;
    await loginAdmin(page);
    await page.goto(`http://127.0.0.1:${nextPort}/admin/products/product-edit-1`);
    const footer=page.getByRole("group",{name:"Acciones del producto",exact:true});
    await expect(footer.getByText("Activo",{exact:true})).toBeVisible();
    await page.getByLabel("Nombre", { exact: true }).fill("Producto activo revisado");
    // Reproduce recovery from an older local copy with stale activation/visibility.
    await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith("ecommium-product-draft:")))).toBe(true);
    await page.evaluate(() => {
      const key = Object.keys(localStorage).find(key => key.startsWith("ecommium-product-draft:"))!;
      const recovered = JSON.parse(localStorage.getItem(key)!);
      recovered.basic.isActive = false;
      recovered.basic.isVisible = !recovered.basic.isVisible;
      localStorage.setItem(key, JSON.stringify(recovered));
    });
    page.once("dialog", dialog => dialog.accept());
    await page.reload();
    await page.getByRole("button", {name:"Restaurar borrador",exact:true}).click();
    await expect(footer.getByText("Activo",{exact:true})).toBeVisible();
    await footer.getByRole("button",{name:"Guardar cambios",exact:true}).click();
    await expect(page.getByRole("dialog",{name:/Producto .*publicar/})).toHaveCount(0);
    await expect.poll(()=>capturedSaveOperationBodies.length).toBe(1);
    const sent=JSON.parse(parseMultipartTextField(capturedSaveOperationBodies[0],"draft"));
    expect(sent.basic.isActive).toBe(true);
    expect(sent.basic.isVisible).toBe(visible);
    await expect(footer.getByRole("status")).toContainText("Guardado");
    await expect(footer.getByText("Activo",{exact:true})).toBeVisible();
  });
}

test("active product missing a publication requirement cannot be saved as an inactive draft", async ({page}) => {
  editorProductActive=true;
  capturedSaveOperationRequests.length=0;
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/product-edit-1`);
  await page.getByRole("button",{name:"Imagenes",exact:true}).click();
  await page.getByRole("button", { name: /^Eliminar del borrador:/ }).first().click();
  const footer=page.getByRole("group",{name:"Acciones del producto",exact:true});
  await footer.getByRole("button",{name:"Guardar cambios",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"No se pueden guardar los cambios",exact:true});
  await expect(dialog.getByText("Falta una imagen principal guardada.",{exact:true})).toBeVisible();
  await expect(dialog.getByRole("button",{name:"Guardar borrador",exact:true})).toHaveCount(0);
  await expect(dialog.getByRole("button",{name:"Publicar",exact:true})).toHaveCount(0);
  expect(capturedSaveOperationRequests).toHaveLength(0);
  await page.screenshot({path:"docs/qa/evidence/20261106/product-active-save-blocked.png",fullPage:true});
  await dialog.getByRole("button",{name:"Seguir editando",exact:true}).click();
  await expect(footer.getByText("Activo",{exact:true})).toBeVisible();
  await expect(footer.getByRole("status")).toContainText("Cambios sin guardar");
});


test("feature creation keeps the drawer and entered values when BFF rejects the request", async ({page}) => {
  rejectSpecificationCreate=true;
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/catalogo/atributos-caracteristicas?tab=features&panel=create`);
  const form=page.getByRole("form",{name:"Crear caracteristica",exact:true});
  await form.getByLabel("Nombre",{exact:true}).fill("Característica rechazada");
  await form.getByLabel("Nombre del grupo nuevo",{exact:true}).fill("Grupo rechazado");
  await form.locator('select[name="categoryId"]').selectOption("category-bikes");
  await form.getByLabel("Valores",{exact:true}).fill("A, B");
  await form.getByRole("button",{name:"Guardar cambios",exact:true}).click();
  await expect(form.getByRole("alert")).toContainText("HTTP 400");
  await expect(form.getByRole("alert")).toBeFocused();
  await expect(page).toHaveURL(/panel=create/);
  await expect(form.getByLabel("Nombre",{exact:true})).toHaveValue("Característica rechazada");
  await expect(form.getByLabel("Nombre del grupo nuevo",{exact:true})).toHaveValue("Grupo rechazado");
  await expect(form.locator('select[name="categoryId"]')).toHaveValue("category-bikes");
  await expect(form.getByLabel("Valores",{exact:true})).toHaveValue("A, B");
  await expect(page.getByText("private validation details must not reach the browser",{exact:true})).toHaveCount(0);
});


test("confirmed feature creation distinguishes pending ReadIndex projection from a failed mutation",async({page})=>{
  delaySpecificationProjection=true;
  const index=catalogSpecificationGroups.findIndex(group=>group.specificationGroupId==="spec-group-playwright");
  if(index>=0)catalogSpecificationGroups.splice(index,1);
  capturedCatalogSpecificationRequests.length=0;
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/catalogo/atributos-caracteristicas?tab=features&panel=create`);
  const form=page.getByRole("form",{name:"Crear caracteristica",exact:true});
  await form.getByLabel("Nombre",{exact:true}).fill("Material pendiente de proyección");
  await form.getByLabel("Nombre del grupo nuevo",{exact:true}).fill("Grupo pendiente");
  await form.locator('select[name="categoryId"]').selectOption("category-bikes");
  await form.getByLabel("Valores",{exact:true}).fill("Carbono");
  await form.getByRole("button",{name:"Guardar cambios",exact:true}).click();
  await expect(page.getByText("Creación confirmada. El registro todavía no está disponible en el listado. No lo crees de nuevo.",{exact:true})).toBeVisible();
  expect(capturedCatalogSpecificationRequests.filter(path=>path==="POST /api/v1/admin/specifications/groups")).toHaveLength(1);
  delaySpecificationProjection=false;
  await page.getByRole("link",{name:"Actualizar listado",exact:true}).click();
  await expect(page.getByText("Registro creado y disponible en el listado.",{exact:true})).toBeVisible();
  await expect(page.getByRole("row",{name:/Material pendiente de proyección/})).toBeVisible();
  expect(capturedCatalogSpecificationRequests.filter(path=>path==="POST /api/v1/admin/specifications/groups")).toHaveLength(1);
});


test("product feature groups follow category and inline administration preserves the product", async ({ page }) => {
  for (let i=catalogSpecificationGroups.length-1;i>=0;i--) if(catalogSpecificationGroups[i].specificationGroupId === "spec-group-playwright") catalogSpecificationGroups.splice(i,1);
  const uuidCategory = "013320a6-527e-4a80-8513-74e4b2b29ecd";
  categoryRow = { ...categoryRow, categoryId:uuidCategory };
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);
  await page.getByLabel("Nombre", {exact:true}).fill("Producto con grupos visibles");
  await openProductBasicSection(page,"Categoría y marca / proveedor");
  await page.getByLabel("Categoria principal",{exact:true}).selectOption(uuidCategory);
  const features=page.locator("details").filter({has:page.locator("summary",{hasText:"Características y especificaciones"})});
  await expect(features).toContainText("Esta categoría todavía no tiene");
  await features.getByRole("button",{name:"Administrar características",exact:true}).click();
  const manager=page.getByRole("dialog",{name:"Administrar características",exact:true});
  const form=manager.getByRole("form",{name:"Crear característica desde producto"});
  await form.locator('[name="name"]').fill("Material de cuadro QA");
  await form.locator('[name="groupName"]').fill("Datos técnicos QA");
  await form.locator('[name="values"]').fill("Carbono, Aluminio");
  await form.getByRole("button",{name:"Crear característica",exact:true}).click();
  await expect(form.getByRole("status")).toContainText("Característica creada");
  await manager.getByRole("button",{name:"Cerrar",exact:true}).click();
  await expect(page.getByLabel("Nombre",{exact:true})).toHaveValue("Producto con grupos visibles");
  await expect(features.getByRole("group",{name:"Datos técnicos QA",exact:true})).toBeVisible();
  await features.getByLabel("Material de cuadro QA").selectOption({label:"Aluminio"});
  await expect(features.getByLabel("Material de cuadro QA")).toHaveValue("value-playwright-1");
  await features.getByRole("button",{name:"Administrar características",exact:true}).click();
  await manager.getByRole("button",{name:"Añadir valores",exact:true}).click();
  const valueForm=manager.getByRole("form",{name:"Añadir valor a Material de cuadro QA",exact:true});
  await valueForm.locator('[name="value"]').fill("Titanio");
  await valueForm.getByRole("button",{name:"Añadir valor",exact:true}).click();
  await expect(valueForm.getByRole("status")).toContainText("Valor añadido");
  await manager.getByRole("button",{name:"Vincular grupo",exact:true}).click();
  await manager.locator('select[name="groupId"]').selectOption("spec-group-technical");
  await manager.getByRole("button",{name:"Vincular a esta categoría",exact:true}).click();
  await expect(manager.getByRole("status")).toContainText("Grupo vinculado");
  await manager.getByRole("button",{name:"Cerrar",exact:true}).click();
  await expect(features.getByLabel("Composicion",{exact:true})).toBeVisible();
  await expect(features.getByLabel("Material de cuadro QA")).toHaveValue("value-playwright-1");

  await page.getByRole("button",{name:"Vista previa",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"Vista previa PDP"})).toContainText("Aluminio");
});


test("product feature administration is hidden without write permission",async({page})=>{
 authPermissions=["admin:catalog:view","catalog.products.read"];
 await loginAdmin(page);
 await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);
 await expect(page.getByRole("button",{name:"Administrar características",exact:true})).toHaveCount(0);
 await expect(page.getByRole("button",{name:"Añadir otra característica",exact:true})).toBeVisible();
});

function installLifecycleFixture(){
  const existing=catalogSpecificationGroups.findIndex(g=>g.specificationGroupId===lifecycleGroupId);if(existing>=0)catalogSpecificationGroups.splice(existing,1);
  const group=structuredClone(catalogSpecificationGroups[0]);group.specificationGroupId=lifecycleGroupId;group.name="Seguridad";group.fields=[{...group.fields[0],fieldId:lifecycleFieldId,specificationGroupId:lifecycleGroupId,name:"Material seguro",isActive:true}];catalogSpecificationGroups.push(group);
}
test("feature deactivation reviews impact, prevents duplicate submission and waits for ReadIndex",async({page})=>{
  installLifecycleFixture();await loginAdmin(page);await page.goto(`http://127.0.0.1:${nextPort}/admin/catalogo/atributos-caracteristicas?tab=features`);
  const trigger=page.getByRole("button",{name:"Desactivar Material seguro",exact:true});await trigger.click();const dialog=page.getByRole("dialog",{name:"Desactivar «Material seguro»"});
  await expect(dialog.getByText("Calculando impacto…",{exact:true})).toBeVisible();await expect(dialog.getByText("3200",{exact:true})).toBeVisible();expect(lifecycleMutations).toBe(0);
  await dialog.getByRole("button",{name:"Cancelar"}).click();await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused();expect(lifecycleMutations).toBe(0);
  await trigger.click();const confirm=dialog.getByRole("button",{name:"Confirmar desactivación"});await expect(confirm).toBeVisible();await confirm.evaluate(b=>{(b as HTMLButtonElement).click();(b as HTMLButtonElement).click();});
  await expect(dialog.getByText("Desactivando…",{exact:true})).toBeVisible();await expect(dialog.getByRole("button",{name:"Cerrar"})).toBeDisabled();
  await expect(dialog.getByText(/El listado todavía no confirma/)).toBeVisible();expect(lifecycleMutations).toBe(1);await expect(dialog.getByText(/Completado:/)).toHaveCount(0);
  lifecycleProjected=true;await dialog.getByRole("button",{name:"Comprobar estado",exact:true}).click();await expect(dialog.getByText(/Completado:/)).toBeVisible();expect(lifecycleMutations).toBe(1);await dialog.getByRole("button",{name:"Cerrar"}).click();await expect(trigger).toHaveCount(0);
});
test("feature deactivation handles stale review, cancellation, responsive dialog and permission denial",async({page})=>{
  installLifecycleFixture();await loginAdmin(page);await page.goto(`http://127.0.0.1:${nextPort}/admin/catalogo/atributos-caracteristicas?tab=features`);
  const trigger=page.getByRole("button",{name:"Desactivar Material seguro",exact:true});
  for(const width of [1440,768,390]){await page.setViewportSize({width,height:900});await trigger.click();const dialog=page.getByRole("dialog",{name:"Desactivar «Material seguro»"});await expect(dialog.getByText("3200",{exact:true})).toBeVisible();expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await page.addScriptTag({path:createRequire(process.cwd()+"/package.json").resolve("axe-core/axe.min.js")});
    const violations=await page.evaluate(async()=>{const w=window as unknown as {axe:{run:(context:unknown)=>Promise<{violations:unknown[]}>}};return (await w.axe.run(document.querySelector("dialog[open]"))).violations;});expect(violations).toEqual([]);
    await page.keyboard.press("Escape");await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused();}
  await page.getByRole("link",{name:"Editar Material seguro",exact:true}).click();
  const editor=page.getByRole("dialog",{name:/Editar caracteristica:/i});await expect(editor).toBeVisible();await expect(editor.locator('input[type="checkbox"][name="isActive"]')).toBeDisabled();
  await editor.getByRole("button",{name:"Desactivar Material seguro",exact:true}).click();await expect(page.getByRole("dialog",{name:"Desactivar «Material seguro»"}).getByText("3200",{exact:true})).toBeVisible();await page.keyboard.press("Escape");await expect(editor).toBeVisible();await editor.getByRole("link",{name:"Cerrar",exact:true}).click();await expect(editor).toHaveCount(0);
  lifecycleConflict=true;await trigger.click();const dialog=page.getByRole("dialog",{name:"Desactivar «Material seguro»"});await dialog.getByRole("button",{name:"Confirmar desactivación"}).click();await expect(dialog.getByRole("alert")).toContainText("El impacto ha cambiado");await expect(dialog.getByRole("button",{name:"Confirmar desactivación"})).toHaveCount(0);await dialog.getByRole("button",{name:"Volver a calcular impacto"}).click();await expect(dialog.getByRole("button",{name:"Confirmar desactivación"})).toBeVisible();await dialog.getByRole("button",{name:"Cancelar"}).click();expect(lifecycleMutations).toBe(1);
  authPermissions=[];await page.reload();await expect(page.getByRole("button",{name:"Desactivar Material seguro",exact:true})).toHaveCount(0);
});

test("feature deactivation uncertain response checks canonical state without another mutation",async({page})=>{
  installLifecycleFixture();lifecycleLostResponse=true;await loginAdmin(page);await page.goto(`http://127.0.0.1:${nextPort}/admin/catalogo/atributos-caracteristicas?tab=features`);
  await page.getByRole("button",{name:"Desactivar Material seguro",exact:true}).click();const dialog=page.getByRole("dialog",{name:"Desactivar «Material seguro»"});await dialog.getByRole("button",{name:"Confirmar desactivación"}).click();await expect(dialog.getByRole("alert")).toBeVisible();await expect(dialog.getByRole("button",{name:"Confirmar desactivación"})).toHaveCount(0);expect(lifecycleMutations).toBe(1);
  await dialog.getByRole("button",{name:"Comprobar estado",exact:true}).click();await expect(dialog.getByText(/El listado todavía no confirma/)).toBeVisible();expect(lifecycleMutations).toBe(1);lifecycleProjected=true;await dialog.getByRole("button",{name:"Comprobar estado",exact:true}).click();await expect(dialog.getByText(/Completado:/)).toBeVisible();expect(lifecycleMutations).toBe(1);
});

test("feature permanent deletion confirms impact, recovers uncertain response and retries only synchronization",async({page})=>{
 installLifecycleFixture();deletionLostResponse=true;await loginAdmin(page);await page.goto(`http://127.0.0.1:${nextPort}/admin/catalogo/atributos-caracteristicas?tab=features`);
 const trigger=page.getByRole("button",{name:"Eliminar definitivamente Material seguro",exact:true});await trigger.click();const dialog=page.getByRole("dialog",{name:"Eliminar definitivamente «Material seguro»"});await expect(dialog.getByText("Calculando impacto de eliminación…",{exact:true})).toBeVisible();const confirm=dialog.getByRole("button",{name:"Eliminar definitivamente",exact:true});await expect(confirm).toBeDisabled();expect(deletionMutations).toBe(0);
 await dialog.getByRole("button",{name:"Cancelar",exact:true}).click();await expect(trigger).toBeFocused();await trigger.click();await dialog.getByLabel('Escribe «Material seguro» para confirmar').fill("Material seguro");await expect(confirm).toBeEnabled();await confirm.evaluate(b=>{(b as HTMLButtonElement).click();(b as HTMLButtonElement).click();});await expect(dialog.getByRole("button",{name:"Cancelar",exact:true})).toBeDisabled();
 const status=page.getByRole("region",{name:"Seguimiento de eliminación"});await expect(status.getByText(/se eliminó del catálogo y de 3200 productos/)).toBeVisible();expect(deletionMutations).toBe(1);await expect(status.getByRole("heading",{name:"Eliminación completada en ReadIndex"})).toHaveCount(0);await page.reload();await expect(status.getByText(/Tiendas verificadas sin la característica: 0 de 1/)).toBeVisible();
 await status.getByRole("button",{name:"Reintentar sincronización",exact:true}).click();await expect.poll(()=>deletionRetries).toBe(1);expect(deletionMutations).toBe(1);deletionProjected=true;await status.getByRole("button",{name:"Comprobar estado",exact:true}).click();await expect(status.getByRole("heading",{name:"Eliminación completada en ReadIndex"})).toBeVisible();expect(deletionMutations).toBe(1);
});
test("feature permanent deletion dialog is accessible and responsive, checks stale impact and rollout permission",async({page})=>{
 installLifecycleFixture();await loginAdmin(page);await page.goto(`http://127.0.0.1:${nextPort}/admin/catalogo/atributos-caracteristicas?tab=features`);const trigger=page.getByRole("button",{name:"Eliminar definitivamente Material seguro",exact:true});
 for(const width of [1440,768,390]){await page.setViewportSize({width,height:900});await trigger.click();const dialog=page.getByRole("dialog",{name:"Eliminar definitivamente «Material seguro»"});await expect(dialog.getByText("3200",{exact:true})).toBeVisible();expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await page.addScriptTag({path:createRequire(process.cwd()+"/package.json").resolve("axe-core/axe.min.js")});const violations=await page.evaluate(async()=>{const w=window as unknown as {axe:{run:(c:unknown)=>Promise<{violations:unknown[]}>}};return(await w.axe.run(document.querySelector("dialog[open]"))).violations;});expect(violations).toEqual([]);await page.keyboard.press("Escape");await expect(trigger).toBeFocused();}
 lifecycleConflict=true;await trigger.click();const dialog=page.getByRole("dialog",{name:"Eliminar definitivamente «Material seguro»"});await dialog.getByLabel('Escribe «Material seguro» para confirmar').fill("Material seguro");await dialog.getByRole("button",{name:"Eliminar definitivamente",exact:true}).click();await expect(dialog.getByRole("alert")).toContainText("El impacto ha cambiado");await expect(dialog.getByRole("button",{name:"Eliminar definitivamente",exact:true})).toHaveCount(0);await dialog.getByRole("button",{name:"Cancelar",exact:true}).click();expect(deletionMutations).toBe(1);
 deletionAvailable=false;await page.reload();await expect(trigger).toHaveCount(0);deletionAvailable=true;authPermissions=['admin:catalog:view','catalog.products.read','catalog.specifications.write'];await page.reload();await expect(trigger).toHaveCount(0);
});
test("feature permanent deletion permits unused definition without typing its name",async({page})=>{
 installLifecycleFixture();deletionProducts=0;await loginAdmin(page);await page.goto(`http://127.0.0.1:${nextPort}/admin/catalogo/atributos-caracteristicas?tab=features`);await page.getByRole("button",{name:"Eliminar definitivamente Material seguro",exact:true}).click();const dialog=page.getByRole("dialog",{name:"Eliminar definitivamente «Material seguro»"});await expect(dialog.getByText(/No hay productos asignados/)).toBeVisible();await expect(dialog.getByRole("textbox")).toHaveCount(0);await dialog.getByRole("button",{name:"Eliminar definitivamente",exact:true}).click();await expect(page.getByRole("region",{name:"Seguimiento de eliminación"})).toBeVisible();expect(deletionMutations).toBe(1);
});


test('catalog retirement confirms exact reference, preserves cancellation and verifies responsive dialog',async({page})=>{
 catalogRetirementScenario=true;authPermissions=['system.admin'];await loginAdmin(page);await page.goto(`http://127.0.0.1:${nextPort}/admin/products`);
 const trigger=page.getByRole('button',{name:'Eliminar QA eliminación producto',exact:true});
 for(const width of [1440,768,390]){await page.setViewportSize({width,height:900});await trigger.click();const dialog=page.getByRole('dialog',{name:'Eliminar producto «QA eliminación producto»'});await expect(dialog.getByLabel('Referencia para confirmar eliminación')).toBeVisible();expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await page.addScriptTag({path:createRequire(process.cwd()+'/package.json').resolve('axe-core/axe.min.js')});expect(await page.evaluate(async()=>{const w=window as unknown as {axe:{run:(c:unknown)=>Promise<{violations:unknown[]}>}};return (await w.axe.run(document.querySelector('dialog[open]'))).violations;})).toEqual([]);await page.keyboard.press('Escape');await expect(trigger).toBeFocused();}
 expect(catalogRetirementConfirmations).toBe(0);await trigger.click();const dialog=page.getByRole('dialog');const confirm=dialog.getByRole('button',{name:'Eliminar definitivamente',exact:true});await expect(confirm).toBeDisabled();await dialog.getByLabel('Referencia para confirmar eliminación').fill('WRONG');await expect(confirm).toBeDisabled();await dialog.getByLabel('Referencia para confirmar eliminación').fill('QA-DELETE');await confirm.evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click();});await expect(dialog.getByText('Eliminación completada y actualización pública comprobada.')).toBeVisible();expect(catalogRetirementConfirmations).toBe(1);expect(catalogRetirementSteps).toBe(2);expect(catalogRetirementKeys).toHaveLength(1);await dialog.getByRole('button',{name:'Cerrar',exact:true}).click();await expect(page.getByText('QA eliminación producto',{exact:true})).toHaveCount(0);
});
test('catalog retirement blocks dependencies and recovers a lost confirmation with the same key',async({page})=>{
 catalogRetirementScenario=true;catalogRetirementBlocked=true;authPermissions=['system.admin'];await loginAdmin(page);await page.goto(`http://127.0.0.1:${nextPort}/admin/products`);const trigger=page.getByRole('button',{name:'Eliminar QA eliminación producto',exact:true});await trigger.click();let dialog=page.getByRole('dialog');await expect(dialog.getByText(/Hay reservas activas/)).toBeVisible();await expect(dialog.getByRole('button',{name:'Eliminar definitivamente',exact:true})).toBeDisabled();await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();expect(catalogRetirementConfirmations).toBe(0);
 catalogRetirementBlocked=false;catalogRetirementLost=true;await trigger.click();dialog=page.getByRole('dialog');await dialog.getByLabel('Referencia para confirmar eliminación').fill('QA-DELETE');await dialog.getByRole('button',{name:'Eliminar definitivamente',exact:true}).click();await expect(dialog.getByRole('button',{name:'Recuperar operación',exact:true})).toBeVisible();await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();await page.reload();const pending=page.getByRole('region',{name:'Eliminaciones pendientes'});await expect(pending).toBeVisible();await trigger.last().click();dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Recuperar operación',exact:true}).click();await expect(dialog.getByText('Eliminación completada y actualización pública comprobada.')).toBeVisible();expect(catalogRetirementConfirmations).toBe(1);expect(new Set(catalogRetirementKeys).size).toBe(1);
});
test('catalog retirement removes a persisted variant and leaves its parent',async({page})=>{
 catalogRetirementScenario=true;authPermissions=['system.admin'];await loginAdmin(page);await page.goto(`http://127.0.0.1:${nextPort}/admin/products/${retirementProductId}`);await page.getByRole('button',{name:'Variantes',exact:true}).click();const remove=page.getByRole('button',{name:'Eliminar PEP-RED',exact:true});await expect(remove).toBeEnabled();await remove.click();const dialog=page.getByRole('dialog',{name:'Eliminar variante «PEP-RED»'});await expect(dialog.getByText(/El producto padre y sus rutas se conservarán/)).toBeVisible();await dialog.getByLabel('Referencia para confirmar eliminación').fill('PEP-RED');await dialog.getByRole('button',{name:'Eliminar definitivamente',exact:true}).click();await expect(dialog.getByText('Eliminación completada y actualización pública comprobada.')).toBeVisible();await dialog.getByRole('button',{name:'Cerrar',exact:true}).click();await expect(page.getByRole('button',{name:'Variantes',exact:true})).toBeVisible();await page.getByRole('button',{name:'Variantes',exact:true}).click();await expect(page.getByRole('button',{name:'Eliminar PEP-RED',exact:true})).toHaveCount(0);expect(catalogRetirementVariantRemoved).toBe(true);expect(catalogRetirementProductRemoved).toBe(false);
});

test('catalog retirement asynchronous lab continues after browser close and API restart',async()=>{
 test.skip(!process.env.CATALOG_RETIREMENT_LAB_URL,'Requires isolated SQL worker laboratory');test.setTimeout(120000);
 catalogRetirementScenario=true;authPermissions=['system.admin'];
 const isolated=await chromium.launch();const context=await isolated.newContext();const page=await context.newPage();await loginAdmin(page);await page.goto(`http://127.0.0.1:${nextPort}/admin/products`);
 const trigger=page.getByRole('button',{name:'Eliminar QA eliminación producto',exact:true});await trigger.click();await page.getByLabel('Referencia para confirmar eliminación').fill('QA-DELETE');
 const start=Date.now();await page.getByRole('button',{name:'Eliminar definitivamente',exact:true}).click();await expect(trigger).toHaveCount(0);expect(Date.now()-start).toBeLessThan(5000);expect(catalogRetirementSteps).toBe(0);
 const control=async(path:string)=>{const r=await fetch(process.env.CATALOG_RETIREMENT_LAB_URL+path,{headers:{authorization:'Bearer '+process.env.RETIREMENT_LAB_TOKEN}});expect(r.ok).toBe(true);return r.json();};
 const accepted=await control('/lab/state');expect(accepted.operation.status).toBe('PENDING');expect(accepted.sourceRows).toBe(1);expect(accepted.binaryExists).toBe(true);
 await control('/lab/api/restart');await page.reload();await expect(trigger).toHaveCount(0);await page.goto(`http://127.0.0.1:${nextPort}/admin/catalogo/eliminaciones`);await expect(page.getByRole('button',{name:/Consultar eliminación de/})).toBeVisible();
 await isolated.close();await control('/lab/worker/start');
 await expect.poll(async()=>{const state=await control('/lab/state');return state.operation?.status;},{timeout:60000}).toBe('COMPLETED');
 await expect.poll(async()=>{const state=await control('/lab/state');return state.completedLog;},{timeout:30000}).toBe(true);
 const state=await control('/lab/state');expect(state.operation.operationId).toBe(accepted.operation.operationId);expect(state.sourceRows).toBe(0);expect(state.binaryExists).toBe(false);expect(catalogRetirementSteps).toBe(0);
});

test("variant shipping inherits base measurements and restores individual fields", async ({ page }) => {
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/product-edit-1`);
  await page.getByRole("button", { name: "Variantes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Transporte", exact: true })).toHaveCount(0);
  await page.getByRole("radio", { name: "Seleccionar PEP-RED", exact: true }).check();
  const width = page.getByLabel("Ancho (mm)", { exact: true });
  await expect(page.getByRole("table", { name: "Resumen de transporte" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar datos base en la variante 0" })).toHaveCount(0);
  await expect(width).toHaveValue("400");
  await expect(width).toBeEnabled();
  await width.fill("650");
  await page.getByRole("radio", { name: "Seleccionar PEP-001", exact: true }).check();
  await page.getByLabel("Alto (mm)", { exact: true }).fill("900");
  await page.getByRole("radio", { name: "Seleccionar PEP-RED", exact: true }).check();
  await expect(width).toHaveValue("650");
  await expect(page.getByLabel("Alto (mm)", { exact: true })).toHaveValue("900");
  await expect(page.getByLabel("Alto (mm)", { exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Restaurar herencia de Ancho (mm)", exact: true }).click();
  await expect(width).toHaveValue("400");
  await expect(width).toBeEnabled();
  await expect(page.getByRole("button", { name: "Restaurar herencia de Ancho (mm)", exact: true })).toHaveCount(0);
  await width.fill("700");
  await page.getByRole("button", { name: "Heredar valores", exact: true }).click();
  await expect(width).toHaveValue("400");
  await expect(page.getByRole("button", { name: "Heredar valores", exact: true })).toBeDisabled();
});


test("added offering appears immediately in the variant services table", async ({ page }) => {
  catalogOfferingsByVariant["variant-edit-default"] = [];
  staleOfferingProjection = true;
  catalogOfferings.push({ ...catalogOfferings[0], id: "offering-warranty", offeringId: "offering-warranty", name: "Garantia", localizedName: [{ locale: "es-ES", value: "Garantia" }] });
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/product-edit-1`);
  await page.getByRole("button", { name: "Variantes", exact: true }).click();
  await page.getByRole("button", { name: "Agregar servicio", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Instalacion/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Agregar servicio", exact: true }).click();
  await expect(page.getByRole("table", { name: "Servicios adicionales de la variante", exact: true }).getByRole("row", { name: /Instalacion/ })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: /Garantia/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Agregar servicio", exact: true }).click();
  const table = page.getByRole("table", { name: "Servicios adicionales de la variante", exact: true });
  await expect(table.getByRole("row", { name: /Instalacion/ })).toBeVisible();
  await expect(table.getByRole("row", { name: /Garantia/ })).toBeVisible();
  staleOfferingProjection = false;

});


test("integrated inventory edits variants and loads warehouse stock without copying quantities", async ({ page }, testInfo) => {
  inheritPriceScenario=true;
  saveOperationMode = "success";
  capturedSaveOperationBodies.length = 0;
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/product-edit-1`);
  await expect(page.getByRole("button", { name: "Inventario", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Almacén", { exact: true })).toHaveValue("main-warehouse");
  await page.getByLabel("Almacén", { exact: true }).selectOption("warehouse-secondary");
  await expect(page.getByLabel("Existencias", { exact: true })).toHaveValue("7");
  await expect(page.locator(".productInventoryPanel > summary")).toContainText("4 disponibles");
  await expect(page.getByRole("table", { name: "Disponibilidad del inventario" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Agregar almacén", exact:true })).toHaveCount(0);
  await expect(page.getByText("Sin cambios", { exact: true })).toBeVisible();
  await page.getByLabel("Precio tachado", {exact:true}).fill("129.90");
  await page.getByRole("checkbox",{name:"Impuestos incluidos",exact:true}).setChecked(false);
  await page.getByLabel("Tabla de precios",{exact:true}).selectOption("cockpit-vip");
  await page.getByRole("button",{name:"Precio",exact:true}).click();
  await expect(page.locator(".productEditorPanel > .pricingEditorContext")).toHaveCount(0);
  await expect(page.getByLabel("Precio sin IVA",{exact:true})).toHaveCount(0);
  await expect(page.getByLabel("Precio con IVA",{exact:true})).toHaveCount(0);
  await expect(page.getByRole("checkbox",{name:"Impuestos incluidos",exact:true})).toHaveCount(0);
  await expect(page.locator("summary").filter({hasText:"Contexto avanzado de precio base"})).toBeVisible();
  await expect(page.locator("summary").filter({hasText:"Precios especificos"})).toBeVisible();
  await expect(page.locator("summary").filter({hasText:"Simulador de precio aplicado"})).toBeVisible();
  await expect(page.getByRole("heading", {name:"Override de variante adicional",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Ajustes basicos",exact:true}).click();
  await expect(page.getByLabel("Precio tachado",{exact:true})).toHaveValue("129.90");

  await expect(page.locator(".productBasicSection > summary").filter({hasText:"Precio base:"})).toContainText(/\d+,\d{2}\s*€/);
  await expect(page.getByLabel("Coste", {exact:true})).toBeVisible();
  for (const label of ["Precio sin IVA", "Precio con IVA", "Coste", "Precio tachado"]) {
    expect((await page.getByLabel(label, {exact:true}).boundingBox())!.width).toBeLessThanOrEqual(120);
  }

  await page.getByRole("button", { name: "Variantes", exact: true }).click();
  await page.getByRole("radio", { name: "Seleccionar PEP-RED", exact: true }).check();
  await page.getByLabel("Precio tachado", {exact:true}).fill("179.90");
  await page.getByRole("checkbox",{name:"Impuestos incluidos",exact:true}).setChecked(true);
  await page.getByLabel("Tabla de precios",{exact:true}).selectOption("vip-table");
  await page.getByLabel("Existencias", { exact: true }).fill("10");
  await page.getByLabel("Reservado", { exact: true }).fill("2");
  await page.getByLabel("Stock de seguridad", { exact: true }).fill("1");
  await expect(page.locator(".productInventoryPanel > summary")).toContainText("7 disponibles");
  await expect(page.getByText("El stock propio guardado no admite restauración todavía.", {exact:true})).toHaveCount(0);
  await page.getByLabel("Almacén", { exact: true }).selectOption("warehouse-secondary");
  await expect(page.getByText("Guarda las cantidades pendientes antes de cambiar de almacén.")).toBeVisible();
  await page.getByRole("radio", { name: "Seleccionar PEP-001", exact: true }).check();
  await expect(page.getByLabel("Precio tachado", {exact:true})).toHaveValue("129.90");
  await expect(page.getByRole("checkbox",{name:"Impuestos incluidos",exact:true})).not.toBeChecked();
  await expect(page.getByLabel("Tabla de precios",{exact:true})).toHaveValue("cockpit-vip");
  await expect(page.getByLabel("Existencias", { exact: true })).toHaveValue("7");
  await expect(page.getByText("Resumen de inventario", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Auditoria", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Imágenes", exact: true })).toHaveCount(0);
  await expect(page.getByRole("table", { name: "Resumen de inventario por variante" })).toBeVisible();
  await page.getByRole("button", { name: "Ver inventario de PEP-RED", exact: true }).click();
  await expect(page.getByLabel("Existencias", { exact: true })).toHaveValue("10");
  await expect(page.getByLabel("Precio tachado", {exact:true})).toHaveValue("179.90");
  await expect(page.getByRole("checkbox",{name:"Impuestos incluidos",exact:true})).toBeChecked();
  await expect(page.getByLabel("Tabla de precios",{exact:true})).toHaveValue("vip-table");
  await page.addScriptTag({ path: createRequire(process.cwd() + "/package.json").resolve("axe-core/axe.min.js") });
  const violations = await page.evaluate(async () => {
    const axeWindow = window as unknown as { axe: { run: (context: Element) => Promise<{ violations: Array<{ id: string; impact: string; description: string }> }> } };
    const panel = document.querySelector(".productInventoryPanel");
    if (!panel) throw new Error("Inventory panel missing");
    const taxRow = document.querySelector(".productPriceTaxRow");
    if (!taxRow) throw new Error("Tax row missing");
    return [...(await axeWindow.axe.run(panel)).violations, ...(await axeWindow.axe.run(taxRow)).violations];
  });
  expect(violations).toEqual([]);
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    if (width < 1000 && await page.getByRole("button", { name: "Ocultar navegación", exact: true }).count()) await page.getByRole("button", { name: "Ocultar navegación", exact: true }).click();
    const panel = page.locator(".productInventoryPanel");
    const bounds = await panel.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    await expect(page.getByRole("combobox", { name: "Almacén", exact: true })).toBeVisible();
    const [taxField,taxToggle] = await Promise.all([page.locator(".productPriceTaxRow > .productPriceTaxField").boundingBox(),page.locator(".productPriceTaxToggle").boundingBox()]);
    expect(Math.abs(taxField!.width-taxToggle!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(taxToggle!.x-taxField!.x)).toBeLessThanOrEqual(1);
    expect(taxToggle!.y).toBeGreaterThan(taxField!.y);
    const tableField=await page.getByLabel("Tabla de precios",{exact:true}).boundingBox();
    const taxSelect=await page.locator(".productPriceTaxField select").boundingBox();
    expect(Math.abs(tableField!.y-taxSelect!.y)).toBeLessThanOrEqual(1);
    expect(tableField!.x).toBeLessThan(taxSelect!.x);
    if (width >= 768) {
      const amounts = await Promise.all(["Precio sin IVA", "Precio con IVA", "Coste", "Precio tachado"].map(label => page.getByLabel(label, {exact:true}).boundingBox()));
      for (let index=1;index<amounts.length;index++) {
        expect(amounts[index]!.x).toBeGreaterThan(amounts[index-1]!.x);
        expect(Math.abs(amounts[index]!.y-amounts[0]!.y)).toBeLessThanOrEqual(1);
      }
      const tax = await page.locator(".productPriceTaxField select").boundingBox();
      expect(tax!.y).toBeGreaterThan(amounts[0]!.y+amounts[0]!.height);
      const fields = await Promise.all(["Almacén", "Existencias", "Reservado", "Stock de seguridad"].map(label => page.getByLabel(label, {exact:true}).boundingBox()));
      for (let index=1;index<fields.length;index++) {
        expect(fields[index]!.x).toBeGreaterThan(fields[index-1]!.x);
        expect(Math.abs(fields[index]!.y-fields[0]!.y)).toBeLessThanOrEqual(1);
      }
    }
    await page.screenshot({ path: testInfo.outputPath(`inventory-${width}.png`), fullPage: true });
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Guardar borrador", exact: true }).click();
  await expect(page.getByText("Producto guardado.", { exact: true })).toBeVisible();
  const saved = JSON.parse(parseMultipartTextField(capturedSaveOperationBodies.at(-1)!, "draft")!) as { inventory: { stockByVariant: Record<string, { onHandQuantity: number; reservedQuantity: number; safetyStockQuantity: number; readOnlySelection?: boolean }> } };
  const pricing = JSON.parse(parseMultipartTextField(capturedSaveOperationBodies.at(-1)!, "draft")!).pricing;
  expect(pricing.variantPrices["variant-edit-red"].listPriceMinor).toBe(17990);
  expect(pricing.variantPrices["variant-edit-red"].taxIncluded).toBe(true);
  expect(pricing.productPrice.taxIncluded).toBe(false);
  expect(pricing.productPrice.priceTableId).toBe("cockpit-vip");
  expect(pricing.variantPrices["variant-edit-red"].priceTableId).toBe("vip-table");
  expect(saved.inventory.stockByVariant["variant-edit-red"]).toMatchObject({ onHandQuantity: 10, reservedQuantity: 2, safetyStockQuantity: 1, readOnlySelection: false });
  expect(saved.inventory.stockByVariant.default).toMatchObject({ onHandQuantity: 7, readOnlySelection: true });

});


test("products audit service deactivation must update its checkbox despite stale read projection", async ({ page }) => {
  catalogOfferingsByVariant["variant-edit-default"] = ["offering-installation"];
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/product-edit-1`);
  await page.getByRole("button", { name: "Variantes", exact: true }).click();
  const active = page.getByRole("checkbox", { name: "Activar Instalacion", exact: true });
  await expect(active).toBeChecked();
  offeringReadProjection = [{ ...catalogOfferings[0] }];
  await active.click();
  await expect.poll(() => offeringRelationMutations).toBe(1);
  await expect(page.getByText("offering relation deactivated", { exact: true })).toBeVisible();
  await expect(active).not.toBeChecked();
});

test("products audit service removal must remove the row despite stale read projection", async ({ page }) => {
  catalogOfferingsByVariant["variant-edit-default"] = ["offering-installation"];
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/product-edit-1`);
  await page.getByRole("button", { name: "Variantes", exact: true }).click();
  const table = page.getByRole("table", { name: "Servicios adicionales de la variante", exact: true });
  await expect(table).toContainText("Instalacion");
  offeringReadProjection = [{ ...catalogOfferings[0] }];
  await page.getByRole("button", { name: "Quitar servicio Instalacion", exact: true }).click();
  await expect.poll(() => offeringRelationMutations).toBe(1);
  expect(catalogOfferingsByVariant["variant-edit-default"]).toEqual([]);
  await expect(page.getByText("offering detached from variant", { exact: true })).toBeVisible();
  await expect(table.getByRole("row", { name: /Instalacion/ })).toHaveCount(0);
});


test("products audit transport fees carriers delivery text and SEO aliases are saved together", async ({ page }) => {
  saveOperationMode = "success";
  capturedSaveOperationBodies.length = 0;
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/product-edit-1`);
  await page.getByLabel("Titulo SEO", { exact: true }).fill("SEO auditado");
  await page.getByLabel("Canonical path", { exact: true }).fill("/qa-canonical/p");
  await page.getByRole("combobox", { name: "Estado ruta", exact: true }).selectOption("INACTIVE");
  await page.getByRole("combobox", { name: "Sitemap", exact: true }).selectOption("false");
  await page.getByRole("button", { name: "Anadir alias", exact: true }).click();
  await page.getByLabel("Path alias", { exact: true }).fill("/qa-alias/p");
  await page.getByRole("button", { name: "Variantes", exact: true }).click();
  await page.getByLabel("Peso del paquete (g)", { exact: true }).fill("1600");
  await page.getByLabel("Ancho (mm)", { exact: true }).fill("410");
  await page.getByLabel("Alto (mm)", { exact: true }).fill("220");
  await page.getByLabel("Profundidad (mm)", { exact: true }).fill("330");
  await page.getByRole("spinbutton", { name: /^Coste adicional/ }).fill("3.50");
  await page.getByRole("combobox", { name: "Plazo de entrega", exact: true }).selectOption("specific");
  await page.getByRole("textbox", { name: /^Entrega con stock/ }).fill("Entrega QA 48 h");
  await page.getByRole("textbox", { name: /^Entrega sin stock/ }).fill("Entrega QA bajo pedido");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("button", { name: "Guardar borrador", exact: true }).click();
  await expect(page.getByText("Producto guardado.", { exact: true })).toBeVisible();
  const saved = JSON.parse(parseMultipartTextField(capturedSaveOperationBodies.at(-1)!, "draft"));
  expect(saved.shipping.package).toEqual({ weightGrams: 1600, widthMm: 410, heightMm: 220, depthMm: 330 });
  expect(saved.shipping.additionalShippingCostMinor).toBe(350);
  expect(saved.shipping.allowedCarrierIds).toEqual(["carrier-standard"]);
  expect(saved.shipping.deliveryTimeNotes.inStock["es-ES"]).toBe("Entrega QA 48 h");
  expect(saved.shipping.deliveryTimeNotes.outOfStock["es-ES"]).toBe("Entrega QA bajo pedido");
  expect(saved.routingSeo).toMatchObject({ canonicalPath: "/qa-canonical/p", status: "INACTIVE", includeInSitemap: false });
  expect(saved.routingSeo.aliases).toContainEqual(expect.objectContaining({ path: "/qa-alias/p" }));
  // Removing the unsaved alias must update the form immediately as well.
  await page.getByRole("button", { name: "Ajustes basicos", exact: true }).click();
  await page.getByRole("button", { name: "Eliminar alias", exact: true }).click();
  await expect(page.getByLabel("Path alias", { exact: true })).toHaveCount(0);
});


test("controlled product brand resolves assigned identity beyond page 100 without extra search fields", async ({page}, info) => {
  controlledBrandLookup=true;
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/product-edit-1`);
  await expect(page.getByLabel("Categoria principal", {exact:true})).toBeVisible();
  await expect(page.getByLabel("Buscar Categoria principal", {exact:true})).toHaveCount(0);
  const selected=page.getByLabel("Marca / proveedor",{exact:true});
  await expect(selected).toHaveValue("brand-late");
  await expect(selected.locator("option:checked")).toHaveText("Marca 150");
  const metrics=await page.evaluate(()=>{
    const navigation=performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const scripts=(performance.getEntriesByType('resource') as PerformanceResourceTiming[]).filter(resource=>resource.initiatorType==='script');
    return {ttfbMs:navigation.responseStart-navigation.requestStart,initialJsEncodedBytes:scripts.reduce((total,item)=>total+item.encodedBodySize,0)};
  });
  console.log('[controlled-performance]',JSON.stringify(metrics));
  await info.attach('product-editor-performance.json',{body:JSON.stringify(metrics),contentType:'application/json'});

  await expect(page.getByLabel("Buscar Marca / proveedor",{exact:true})).toHaveCount(0);
  await page.addScriptTag({path:createRequire(process.cwd()+"/package.json").resolve("axe-core/axe.min.js")});
  const violations=await page.evaluate(async()=>{
    const axe=(window as unknown as {axe:{run:(element:Element)=>Promise<{violations:unknown[]}>}}).axe;
    return (await axe.run(document.querySelector('.productEntitySelector')!.parentElement!)).violations;
  });
  expect(violations).toEqual([]);
  for(const width of [1440,768,390]){
    await page.setViewportSize({width,height:1000});
    const selectors=page.locator('.productEntitySelector');
    for(const selector of await selectors.all()){
      const bounds=await selector.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width+1);
    }
  }

});

test("controlled tax lookup recovers in place without losing the product draft", async ({page}) => {
  controlledTaxOutage=true;
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);
  await page.getByLabel("Nombre",{exact:true}).fill("QA borrador conservado");
  const tax=page.locator("label").filter({hasText:/^Impuestos/}).locator("select");
  await expect(tax).toBeDisabled();
  controlledTaxOutage=false;
  await page.getByRole("button",{name:"Volver a cargar impuestos",exact:true}).click();
  await expect(tax).toBeEnabled();
  await expect(page.getByLabel("Nombre",{exact:true})).toHaveValue("QA borrador conservado");
  await expect(tax.locator("option")).not.toHaveCount(1);
  await expect(page.getByText("Reglas fiscales actualizadas. Se conservan los datos del producto.")).toBeVisible();
});


test("controlled removed product renders an explicit absence page",async({page})=>{
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/removed-product`);
  await expect(page.getByRole("heading",{name:"Producto no encontrado",exact:true})).toBeVisible();
  await expect(page.getByText("El servicio no está disponible temporalmente.",{exact:true})).toHaveCount(0);
});


test("variant price reload icon restores inheritance without modifying the base price", async ({page}) => {
  inheritPriceScenario=true;
  saveOperationMode="success";
  capturedSaveOperationBodies.length=0;
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/product-edit-1`);
  await page.getByRole("button",{name:"Variantes",exact:true}).click();
  await expect(page.locator(".productPriceInherit")).toHaveCount(0);
  await page.getByRole("radio",{name:"Seleccionar PEP-RED",exact:true}).check();
  await expect(page.getByRole("button",{name:"Heredar precio del producto",exact:true})).toBeDisabled();
  await page.getByRole("radio",{name:"Seleccionar PEP-GREEN",exact:true}).check();
  await expect(page.getByLabel("Precio con IVA",{exact:true})).toHaveValue("99.00");
  const reload=page.getByRole("button",{name:"Heredar precio del producto",exact:true});
  await expect(reload).toBeEnabled();
  expect((await reload.boundingBox())!.width).toBeLessThanOrEqual(28);
  await page.addScriptTag({path:createRequire(process.cwd()+"/package.json").resolve("axe-core/axe.min.js")});
  const violations=await page.evaluate(async()=>{
    const axe=(window as unknown as {axe:{run:(element:Element)=>Promise<{violations:unknown[]}>}}).axe;
    return (await axe.run(document.querySelector('.productPriceInherit')!)).violations;
  });
  expect(violations).toEqual([]);
  await reload.click();
  await expect(page.getByLabel("Precio con IVA",{exact:true})).toHaveValue("1299.00");
  await expect(reload).toBeDisabled();
  await expect(page.locator(".productVariantPricePanel")).toHaveAttribute("open", "");

  await page.getByRole("button",{name:"Guardar",exact:true}).click();
  await page.getByRole("dialog").getByRole("button",{name:"Guardar borrador",exact:true}).click();
  await expect(page.getByText("Producto guardado.",{exact:true})).toBeVisible();
  const saved=JSON.parse(parseMultipartTextField(capturedSaveOperationBodies.at(-1)!,"draft")!);
  expect(saved.pricing.variantPrices["variant-edit-green"]).toMatchObject({pricingId:"pricing-edit-green",markedForDeletion:true});
  expect(saved.pricing.productPrice).toMatchObject({pricingId:"pricing-edit-product",basePriceMinor:129900});
  expect(saved.pricing.productPrice.markedForDeletion).not.toBe(true);
});


test("postventa separates cases and pending tasks with compact responsive tables", async ({page}, info) => {
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/postventa`);
  const nav = page.getByRole("navigation", {name:"Postventa",exact:true});
  await expect(nav.getByRole("link", {name:"Casos",exact:true})).toHaveAttribute("aria-current","page");
  await expect(page.getByRole("heading", {name:"Bandeja de casos",exact:true})).toBeVisible();
  await expect(page.getByRole("form", {name:"Buscar casos de postventa",exact:true})).toHaveClass(/productListSearchPanel/);
  await expect(page.getByRole("heading", {name:"Cola operativa",exact:true})).toHaveCount(0);
  await expect(page.locator(".afterSalesCasesCard table")).toHaveClass(/productListTable/);
  await page.locator(".afterSalesCasesCard").getByRole("link",{name:"Atender",exact:true}).click();
  await expect(page.getByRole("dialog").locator("table.productListTable")).toBeVisible();
  await page.getByRole("dialog").getByRole("link",{name:"Cerrar",exact:true}).click();
  await nav.getByRole("link",{name:"Pendientes · 1",exact:true}).click();
  await expect(page).toHaveURL(/tab=tasks/);
  await expect(page.getByRole("heading",{name:"Bandeja de casos",exact:true})).toHaveCount(0);
  await expect(page.getByRole("region", {name:"Tareas pendientes",exact:true})).toBeVisible();
  await expect(page.locator(".adminKpiGrid")).toHaveCount(0);
  await expect(page.getByRole("heading",{name:"Cola operativa",exact:true})).toHaveCount(0);
  await expect(page.locator('select[name="taskType"]')).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Filtrar tareas",exact:true})).toHaveCount(0);
  await expect(page.locator(".afterSalesTasksCard table")).toBeVisible();
  await page.reload();
  await expect(nav.getByRole("link",{name:"Pendientes · 1",exact:true})).toHaveAttribute("aria-current","page");
  const help = page.getByRole("dialog", {name:"Cómo gestionar un caso",exact:true});
  await expect(help).not.toBeVisible();
  await page.getByRole("button",{name:"Ayuda: Cómo gestionar un caso",exact:true}).click();
  await expect(help).toBeVisible();
  await expect(help).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(help.locator("li")).toHaveCount(5);
  await help.getByRole("button",{name:"Cerrar",exact:true}).click();
  await expect(help).not.toBeVisible();
  await page.getByRole("button",{name:"Ayuda: Cómo gestionar un caso",exact:true}).click();
  await page.keyboard.press("Escape");
  await expect(help).not.toBeVisible();
  await page.addScriptTag({path:createRequire(process.cwd()+"/package.json").resolve("axe-core/axe.min.js")});
  const violations = await page.locator("main.afterSalesAdminPage").evaluate(async element => {
    const w=window as unknown as {axe:{run:(context:Element)=>Promise<{violations:unknown[]}>}};
    return (await w.axe.run(element)).violations;
  });
  expect(violations).toEqual([]);
  for (const width of [1440,768,390]) {
    await page.setViewportSize({width,height:900});
    if (width === 390) {
      await page.getByRole("button",{name:"Ocultar navegación",exact:true}).click();
      await expect.poll(() => page.locator("#admin-sidebar-panel").evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
    }
    const discard = page.getByRole("button",{name:"Descartar",exact:true});
    if (await discard.isVisible()) await discard.click();
    await expect(nav).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
    await page.screenshot({path:info.outputPath(`postventa-${width}.png`),fullPage:true});
  }
});

test("pricing tabs align create actions and tables fill the available width", async ({ page }, testInfo) => {
  await loginAdmin(page);
  for (const tab of ["taxes", "tables"]) {
    await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/precios?tab=${tab}`);
    const toolbar = page.locator(".adminTabsToolbar");
    const create = toolbar.getByRole("link", { name: tab === "taxes" ? "Crear impuesto" : "Crear price table", exact: true });
    await expect(create).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir a productos", exact: true })).toHaveCount(0);
    await expect(page.locator(".productListGridHeader").getByRole("link")).toHaveCount(0);
    for (const width of [1680, 1280, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const navBox = await toolbar.getByRole("navigation").boundingBox();
      const actionBox = await create.boundingBox();
      expect(navBox).not.toBeNull();
      expect(actionBox).not.toBeNull();
      if (width >= 768) {
        expect(Math.abs((navBox!.y + navBox!.height / 2) - (actionBox!.y + actionBox!.height / 2))).toBeLessThanOrEqual(2);
        expect(actionBox!.x).toBeGreaterThanOrEqual(navBox!.x + navBox!.width);
      }
      const widths = await page.locator(".pricingProductList .adminTableScroller").evaluate((node) => ({
        viewport: node.clientWidth,
        table: node.querySelector("table")!.getBoundingClientRect().width,
        body: document.documentElement.scrollWidth,
        window: window.innerWidth,
      }));
      expect(widths.table).toBeGreaterThanOrEqual(widths.viewport - 1);
      expect(widths.body).toBeLessThanOrEqual(widths.window);
    }
    await page.setViewportSize({ width: 1680, height: 1000 });
    await page.screenshot({ path: testInfo.outputPath(`pricing-${tab}-aligned.png`), fullPage: true });
    await create.click();
    await expect(page.getByRole("dialog")).toBeVisible();
  }
  await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/precios?tab=taxes`);
  await expect(page.getByRole("button", { name: "Baja", exact: true })).toHaveCount(0);
  await expect(page.getByPlaceholder("Escribe DELETE")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Desactivar / }).first()).toBeVisible();
});

test("Admin badge toolbars center their navigation and drawer actions", async ({page}) => {
  await loginAdmin(page);
  for (const path of [
    "/admin/configuracion/equipo",
    "/admin/catalogo/atributos-caracteristicas",
    "/admin/configuracion/comunicaciones?tab=templates",
  ]) {
    await page.goto(`http://127.0.0.1:${nextPort}${path}`);
    const toolbar = page.locator(".employeesToolbar").first();
    await expect(toolbar).toBeVisible();
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({width, height: 1000});
      const bounds = await toolbar.evaluate(node => {
        const tabs = node.querySelector('.adminTabs, .productEditorTabs')!.getBoundingClientRect();
        const action = node.querySelector('.employeesToolbarAction, :scope > .employeesTextAction')!.getBoundingClientRect();
        return {tabsCenter: tabs.y + tabs.height / 2, actionCenter: action.y + action.height / 2, overflow: node.scrollWidth > node.clientWidth};
      });
      expect(bounds.overflow).toBe(false);
      if (width >= 768) expect(Math.abs(bounds.tabsCenter - bounds.actionCenter)).toBeLessThanOrEqual(2);
    }
  }
});





test("tax deletion and creation controls stay hidden for read-only employees", async ({page}) => {
  authPermissions = ["admin:configuration:view", "pricing.admin.read"];
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/precios?tab=taxes&taxDrawer=create`);
  await expect(page.locator('.pricingTaxTable')).toBeVisible();
  await expect(page.getByRole('button',{name:/^(Eliminar|Desactivar) /})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Crear impuesto',exact:true})).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test("price table activation uses a warning popup and compact list actions", async ({page}) => {
  await loginAdmin(page);
  await page.setViewportSize({width:1680,height:1000});
  await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/precios?tab=tables`);
  const row=page.getByRole('row').filter({hasText:'vip-table'});
  const before=pricingPriceTables.find(table=>table.priceTableId==='vip-table')!.active;
  capturedPricingMutations.length=0;
  const toggle=row.getByRole('button',{name:`${before ? 'Desactivar' : 'Activar'} VIP table`,exact:true});
  await expect(toggle).toHaveClass(before ? /employeesActionWarning/ : /employeesActionPositive/);
  await toggle.click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByText(/precios y reglas asociados/)).toBeVisible();
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
  expect(capturedPricingMutations).toHaveLength(0);
  await expect(toggle).toBeFocused();
  await toggle.click();
  await dialog.getByRole('button',{name:before ? 'Desactivar tabla' : 'Activar tabla',exact:true}).click();
  await expect(page.getByText('Tabla actualizada.',{exact:true})).toBeVisible();
  expect(capturedPricingMutations).toContainEqual({method:'PATCH',path:'/api/v1/admin/pricing/price-tables/vip-table/activation',body:{active:!before}});
  pricingPriceTables.find(table=>table.priceTableId==='vip-table')!.active=before;
});





test("price table write controls are hidden for read-only employees",async({page})=>{
 authPermissions=['admin:configuration:view','pricing.admin.read'];await loginAdmin(page);
 await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/precios?tab=tables&priceTableDrawer=create`);
 await expect(page.locator('.pricingPriceTableList')).toBeVisible();
 await expect(page.getByRole('button',{name:/^(Eliminar|Desactivar|Activar) /})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Crear price table',exact:true})).toHaveCount(0);
 await expect(page.getByRole('dialog')).toHaveCount(0);
});

for(const kind of ['taxes','price-tables'] as const)test(`reviewed ${kind} removal requires replacement and confirmed impact`,async({page})=>{
 await loginAdmin(page);await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/precios?tab=${kind==='taxes'?'taxes':'tables'}`);
 capturedPricingMutations.length=0;
 await page.getByRole('button',{name:/^Eliminar /}).first().click();const dialog=page.getByRole('dialog');
 const confirm=dialog.getByRole('button',{name:'Confirmar eliminación',exact:true});await expect(confirm).toBeDisabled();
 const select=dialog.getByRole('combobox');await expect(select.locator('option')).not.toHaveCount(1);
 const value=await select.locator('option').nth(1).getAttribute('value');await select.selectOption(value!);
 await expect(dialog.getByRole('checkbox')).toBeEnabled();await dialog.getByRole('checkbox').check();
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:900});const box=await dialog.boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width+1);
  await page.addScriptTag({path:createRequire(process.cwd()+"/package.json").resolve("axe-core/axe.min.js")});
  const violations=await dialog.evaluate(async element=>{const result=await (window as unknown as {axe:{run:(element:Element)=>Promise<{violations:Array<{id:string;impact:string}>}>}}).axe.run(element);return result.violations.filter(v=>['critical','serious'].includes(v.impact));});expect(violations).toEqual([]);
 }
 await confirm.click();await expect(page.getByText('Eliminación completada y lecturas actualizadas en 1 contextos.',{exact:true})).toBeVisible();
 expect(capturedPricingMutations).toHaveLength(1);expect(capturedPricingMutations[0].path).toMatch(/removal-confirm$/);
});


async function confirmCommercialDialog(page: Page) {
  const dialog = page.getByRole("dialog",{name:"Confirmar cambio comercial",exact:true});
  if (await dialog.count()) {
    await dialog.getByLabel("Tu contraseña de administrador").fill("commercial-qa-password");
    await dialog.getByRole("button",{name:"Confirmar cambio comercial",exact:true}).click();
  }
}

async function openCommercialProfile(page: Page) {
  commercialScenario=true;
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/clientes/C000001?tab=perfil`);
  return page.getByRole("group",{name:"Condiciones comerciales",exact:true});
}

test("commercial profile assigns changes and removes a group with a review and canonical revision",async({page})=>{
  const panel=await openCommercialProfile(page);
  await expect(page.getByRole("combobox",{name:"Shop",exact:true})).toContainText("Tienda Barcelona");
  const selector=panel.getByLabel("Grupo comercial",{exact:true});
  await selector.selectOption("vip");
  await page.getByRole("button",{name:"Guardar perfil",exact:true}).click();
  await confirmCommercialDialog(page);
  await expect(page.getByText("Cliente actualizado.",{exact:true})).toBeVisible();
  expect(commercialProfileWrites[0].commercialMembership).toEqual({groupCode:"vip",b2bApproved:false,expectedRevision:0,reason:"Asignación manual desde el perfil Admin"});
  await expect(selector).toHaveValue("vip");
  await selector.selectOption("pro");
  await panel.getByLabel("Tipo comprador",{exact:true}).selectOption("BUSINESS_BUYER");
  await panel.getByRole("checkbox").check();
  await page.getByRole("button",{name:"Guardar perfil",exact:true}).click();
  await confirmCommercialDialog(page);
  await expect(selector).toHaveValue("pro");
  await expect.poll(()=>commercialMembership).toMatchObject({groupCode:"pro",b2bApproved:true,revision:2});
  await selector.selectOption("");
  await page.getByRole("button",{name:"Guardar perfil",exact:true}).click();
  await confirmCommercialDialog(page);
  await expect(selector).toHaveValue("");
  await expect.poll(()=>commercialMembership.groupCode).toBe(null);
  await expect.poll(()=>commercialMembership.revision).toBe(3);
});

test("commercial profile preserves personal and commercial drafts after a revision conflict",async({page})=>{
  const panel=await openCommercialProfile(page);commercialConflict=true;
  await page.getByLabel("Nombre",{exact:true}).fill("Nombre pendiente");
  await panel.getByLabel("Grupo comercial",{exact:true}).selectOption("vip");
  await page.getByRole("button",{name:"Guardar perfil",exact:true}).click();
  await confirmCommercialDialog(page);
  await expect(page.getByRole("form",{name:"Editar perfil del cliente"}).getByRole("alert")).toContainText("ha cambiado");
  await expect(page.getByLabel("Nombre",{exact:true})).toHaveValue("Nombre pendiente");
  await expect(panel.getByLabel("Grupo comercial",{exact:true})).toHaveValue("vip");
  await expect(page.getByText("internal-database-trace")).toHaveCount(0);
  expect(commercialMembership.revision).toBe(0);
});

for (const failure of ["groups403","membership404","invalidSnapshot"] as const) {
  test(`commercial profile distinguishes read failures and omits membership on save: ${failure}`,async({page})=>{
    if(failure==="groups403")commercialGroupsStatus=403;
    if(failure==="membership404")commercialMembershipStatus=404;
    if(failure==="invalidSnapshot")commercialInvalidSnapshot=true;
    const panel=await openCommercialProfile(page);
    await expect(panel.getByText(failure==="groups403"?/no tiene permiso/:failure==="membership404"?/no está disponible en el BFF/:/respuesta incompatible/)).toBeVisible();
    await expect(panel.getByLabel("Grupo comercial",{exact:true})).toHaveCount(0);
    await page.getByLabel("Nombre",{exact:true}).fill("Actualizado");
    await page.getByRole("button",{name:"Guardar perfil",exact:true}).click();
  await confirmCommercialDialog(page);
    await expect(page.getByText("Cliente actualizado.",{exact:true})).toBeVisible();
    expect(commercialProfileWrites[0]).not.toHaveProperty("commercialMembership");
  });
}

test("commercial profile shows canonical membership to readers without editing controls",async({page})=>{
  authPermissions=["customers.read"];
  commercialMembership={groupCode:"vip",b2bApproved:true,buyerType:"BUSINESS_BUYER",revision:4};
  const panel=await openCommercialProfile(page);
  await expect(panel).toContainText("VIP");await expect(panel).toContainText("Aprobada");
  await expect(panel.locator("select,input,textarea")).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Guardar perfil",exact:true})).toHaveCount(0);
  await expect(panel.getByRole("link",{name:/Configurar grupos/})).toHaveCount(0);
  expect(commercialProfileWrites).toHaveLength(0);
});

test("commercial profile preserves inactive assignments and distinguishes an empty active catalog",async({page})=>{
  commercialGroups=[];
  commercialMembership={groupCode:"legacy",b2bApproved:false,buyerType:"PRIVATE_BUYER",revision:5};
  const panel=await openCommercialProfile(page);
  await expect(panel.getByLabel("Grupo comercial",{exact:true})).toHaveValue("legacy");
  await expect(panel.getByText(/No hay grupos activos/)).toBeVisible();
  await expect(panel.getByText(/No se ha podido cargar/)).toHaveCount(0);
  await page.getByRole("button",{name:"Guardar perfil",exact:true}).click();
  await confirmCommercialDialog(page);
  await expect(page.getByText("Cliente actualizado.",{exact:true})).toBeVisible();
  expect(commercialMembership.groupCode).toBe("legacy");
  expect(commercialProfileWrites[0]).not.toHaveProperty("commercialMembership");
});

test("commercial profile fields are accessible and fit desktop tablet and mobile",async({page})=>{
  const panel=await openCommercialProfile(page);
  for(const width of [1366,768,390]){
    await page.setViewportSize({width,height:1000});
    const selector=panel.getByLabel("Grupo comercial",{exact:true});await selector.scrollIntoViewIfNeeded();
    const box=await selector.boundingBox();expect(box).not.toBeNull();expect(box!.height).toBeGreaterThanOrEqual(40);expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width+1);
  }
  await page.addScriptTag({path:createRequire(process.cwd()+"/package.json").resolve("axe-core/axe.min.js")});
  const violations=await panel.evaluate(async element=>{
    const w=window as unknown as {axe:{run:(element:Element,options:unknown)=>Promise<{violations:unknown[]}>}};
    return (await w.axe.run(element,{rules:{"color-contrast":{enabled:false}}})).violations;
  });
  expect(violations).toEqual([]);
  await captureEvidence(page,"commercial-profile-mobile");
});


test("commercial profile creates a customer with a manually selected group",async({page})=>{
  commercialScenario=true;
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/clientes?drawer=create`);
  const drawer=page.getByRole("dialog");
  await drawer.getByLabel("Email",{exact:true}).fill("commercial-qa@example.test");
  await drawer.getByLabel("Nombre",{exact:true}).fill("Cliente");
  await drawer.getByLabel("Apellido",{exact:true}).fill("Comercial QA");
  await drawer.getByLabel("Grupo comercial",{exact:true}).selectOption("vip");
  await drawer.getByRole("button",{name:"Crear cliente",exact:true}).click();
  await confirmCommercialDialog(page);
  await expect(page.getByText("Cliente creado.",{exact:true})).toBeVisible();
  expect(commercialProfileWrites).toHaveLength(1);
  expect(commercialProfileWrites[0]).toMatchObject({organizationId:defaultOrganizationId,shopId:barcelonaShopId,email:"commercial-qa@example.test",commercialMembership:{groupCode:"vip",b2bApproved:false,expectedRevision:0}});
  await page.goto(`http://127.0.0.1:${nextPort}/admin/clientes/C000001?tab=perfil`);
  await expect(page.getByLabel("Grupo comercial",{exact:true})).toHaveValue("vip");
});


test("commercial profile recovers a failed read without discarding personal edits",async({page})=>{
  commercialMembershipStatus=503;
  const panel=await openCommercialProfile(page);
  await expect(panel.getByText(/Asignación del cliente: El servicio/)).toBeVisible();
  await page.getByLabel("Nombre",{exact:true}).fill("Borrador conservado");
  commercialMembershipStatus=200;
  await panel.getByRole("button",{name:"Volver a consultar condiciones comerciales"}).click();
  await expect(panel.getByLabel("Grupo comercial",{exact:true})).toHaveValue("");
  await expect(page.getByLabel("Nombre",{exact:true})).toHaveValue("Borrador conservado");
  expect(commercialProfileWrites).toHaveLength(0);
});


test("commercial profile blocks private B2B approval before sending and accepts explicit business approval",async({page})=>{
  const panel=await openCommercialProfile(page);
  await panel.getByRole("checkbox").check();
  await expect(panel.getByRole("alert")).toContainText("selecciona Empresa");
  await page.getByRole("button",{name:"Guardar perfil",exact:true}).click();
  await confirmCommercialDialog(page);
  expect(commercialProfileWrites).toHaveLength(0);
  await panel.getByLabel("Tipo comprador",{exact:true}).selectOption("BUSINESS_BUYER");
  await page.getByRole("button",{name:"Guardar perfil",exact:true}).click();
  await confirmCommercialDialog(page);
  await expect(page.getByText("Cliente actualizado.",{exact:true})).toBeVisible();
  expect(commercialProfileWrites[0]).toMatchObject({buyerType:"BUSINESS_BUYER",commercialMembership:{b2bApproved:true}});
});

test("commercial profile does not expose a separate Logs menu",async({page})=>{
  const panel=await openCommercialProfile(page);
  await expect(panel.getByLabel("Motivo del cambio comercial")).toHaveCount(0);
  await expect(page.getByRole("link",{name:"Logs",exact:true})).toHaveCount(0);
  await expect(page.locator('a[href^="/admin/logs"]')).toHaveCount(0);
  await expect(panel.getByRole("table",{name:"Historial comercial"})).toHaveCount(0);
});

test("commercial profile confirmation cancels and rejects a wrong password without losing the draft",async({page})=>{
  const panel=await openCommercialProfile(page);
  await page.getByLabel("Nombre",{exact:true}).fill("Borrador protegido");
  await panel.getByLabel("Grupo comercial",{exact:true}).selectOption("vip");
  await page.getByRole("button",{name:"Guardar perfil",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Confirmar cambio comercial",exact:true});
  await expect(dialog).toContainText("Sin grupo específico → VIP");
  await page.setViewportSize({width:390,height:900});
  const box=await dialog.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.width).toBeLessThanOrEqual(390);
  await page.addScriptTag({path:createRequire(process.cwd()+"/package.json").resolve("axe-core/axe.min.js")});
  const violations=await dialog.evaluate(async element=>{
    const w=window as unknown as {axe:{run:(element:Element,options:unknown)=>Promise<{violations:unknown[]}>}};
    return (await w.axe.run(element,{rules:{"color-contrast":{enabled:false}}})).violations;
  });
  expect(violations).toEqual([]);
  await page.setViewportSize({width:1366,height:900});
  await dialog.getByLabel("Tu contraseña de administrador").fill("discarded-secret");
  await dialog.getByRole("button",{name:"Cancelar",exact:true}).click();
  expect(commercialProfileWrites).toHaveLength(0);
  await page.getByRole("button",{name:"Guardar perfil",exact:true}).click();
  await expect(dialog.getByLabel("Tu contraseña de administrador")).toHaveValue("");
  await dialog.getByLabel("Tu contraseña de administrador").fill("wrong-password");
  await dialog.getByRole("button",{name:"Confirmar cambio comercial",exact:true}).click();
  await expect(page.getByRole("alert").filter({hasText:"Revisa tu contraseña"})).toBeVisible();
  expect(commercialProfileWrites).toHaveLength(0);
  await expect(page.getByLabel("Nombre",{exact:true})).toHaveValue("Borrador protegido");
  await expect(panel.getByLabel("Grupo comercial",{exact:true})).toHaveValue("vip");
  await expect(page.locator('input[name="commercialCurrentPassword"]')).toHaveValue("");
  await page.getByRole("button",{name:"Guardar perfil",exact:true}).click();
  await expect(dialog.getByLabel("Tu contraseña de administrador")).toHaveValue("");
  await dialog.press("Escape");
  expect(commercialProfileWrites).toHaveLength(0);
});

test("commercial profile policy is saved through employee BFF without assigning a default group",async({page})=>{
  await openCommercialProfile(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/precios?tab=references`);
  const form=page.getByRole("form",{name:"Política de segmentación comercial"});
  await form.getByRole("checkbox",{name:/VIP/}).check();
  await form.getByRole("button",{name:"Guardar política comercial"}).click();
  await expect(form.getByRole("status")).toContainText("Política comercial guardada.");
  expect(commercialPolicy).toMatchObject({policy:{allowedGroups:["vip"],registeredGroup:null,b2bGroup:null},revision:1});
  await expect(form.getByRole("checkbox",{name:/VIP/})).toBeChecked();
  await form.getByRole("button",{name:"Guardar política comercial"}).click();
  await expect.poll(()=>commercialPolicy.revision).toBe(2);
});


test("commercial profile create drawer fits narrow viewports",async({page},info)=>{
  commercialScenario=true;await loginAdmin(page);await page.goto(`http://127.0.0.1:${nextPort}/admin/clientes`);
  await page.setViewportSize({width:390,height:900});
  await page.getByRole("button",{name:"Ocultar navegación",exact:true}).click();
  await expect.poll(async()=>(await page.locator('.adminSidebarPanel').boundingBox())?.width??0).toBe(0);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/clientes?drawer=create`);
  const drawer=page.getByRole("dialog"),selector=drawer.getByLabel("Grupo comercial",{exact:true});await expect(selector).toBeVisible();
  for(const width of [390,768,1366]){
    await page.setViewportSize({width,height:900});await selector.scrollIntoViewIfNeeded();
    const box=await selector.boundingBox();
    if(!box || box.width<=100 || box.x<0 || box.x+box.width>width+1){console.log('Commercial drawer responsive geometry',{width,box,drawer:await drawer.boundingBox(),sidebar:await page.locator('.adminSidebarPanel').boundingBox()});await page.screenshot({path:info.outputPath(`drawer-${width}.png`),fullPage:true});}
    expect(box).not.toBeNull();expect(box!.width).toBeGreaterThan(100);expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width+1);
  }
});


test("Rules creates a conditional price using the existing price contract", async ({page}) => {
  capturedPricingMutations.length = 0;
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/precios?tab=rules&priceTableId=vip-table`);
  await expect(page.locator("table form")).toHaveCount(0);
  await page.getByRole("button", {name:"Editar grupo", exact:true}).first().click();
  const editPanel = page.getByRole("dialog", {name:"Editar grupo de precios", exact:true});
  await expect(editPanel.getByLabel("Prioridad", {exact:true})).toBeVisible();
  await expect(editPanel.getByRole("button", {name:"Guardar cambios", exact:true})).toBeVisible();
  await expect(editPanel.getByRole("button", {name:"Crear precio", exact:true})).toHaveCount(0);
  await editPanel.getByRole("button", {name:"Cerrar", exact:true}).click();
  await page.getByRole("button", {name:"Desactivar grupo", exact:true}).first().click();
  const disablePanel = page.getByRole("dialog", {name:"Desactivar grupo de precios", exact:true});
  await expect(disablePanel.getByLabel("Confirmar desactivar regla")).toBeVisible();
  await disablePanel.getByRole("button", {name:"Cerrar", exact:true}).click();
  await page.getByRole("link", {name:"Crear precio con condiciones", exact:true}).click();
  const drawer=page.getByRole("dialog", {name:"Crear precio con condiciones", exact:true});
  await expect(drawer.getByLabel("Tabla de precios", {exact:true})).toHaveValue("vip-table");
  await drawer.getByLabel("ID del producto", {exact:true}).fill("11111111-1111-4111-8111-111111111111");
  await drawer.getByLabel(/^Importe sin impuestos/).fill("1499");
  await drawer.getByLabel("Grupo de cliente", {exact:true}).fill("vip");
  await drawer.getByLabel("ID del producto", {exact:true}).fill("invalid-id");
  await drawer.getByRole("button",{name:"Crear precio",exact:true}).click();
  await expect(drawer.getByRole("alert")).toContainText("IDs válidos");
  await expect(drawer.getByLabel(/^Importe sin impuestos/)).toHaveValue("1499");
  await drawer.getByLabel("ID del producto", {exact:true}).fill("11111111-1111-4111-8111-111111111111");
  await drawer.getByRole("button",{name:"Crear precio",exact:true}).click();
  await expect(drawer).toHaveCount(0);
  await expect(page).toHaveURL(/tab=rules&priceTableId=vip-table/);
  await expect(page.getByText(/Precio creado. Rules lo agrupa/)).toBeVisible();
  expect(capturedPricingMutations).toContainEqual({method:"POST",path:"/api/v1/admin/prices",body:expect.objectContaining({priceTableId:"vip-table",fixedPriceMinor:1499,source:"FIXED",customerGroup:"vip",country:null,channel:null})});
});

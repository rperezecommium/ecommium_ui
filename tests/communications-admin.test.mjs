import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(new URL("..", import.meta.url).pathname);

function source(relativePath) {
  return readFileSync(path.resolve(root, relativePath), "utf8");
}

function loadCommunicationsAdminModule(requestBff) {
  const moduleSource = source("src/modules/configuracion/communications-admin.ts");
  const { outputText } = ts.transpileModule(moduleSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const commonJsExports = {};
  const moduleContext = {
    File,
    FormData,
    URLSearchParams,
    exports: commonJsExports,
    module: { exports: commonJsExports },
    require(specifier) {
      if (specifier.endsWith("/shared/bff/client")) {
        return { requestBff };
      }
      if (specifier.endsWith("/shared/config/admin-context")) {
        return {
          hasRequiredAdminContext(value) {
            return Boolean(value.organizationId && value.shopId);
          },
        };
      }

      return {};
    },
  };

  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
}

function loadCommunicationsActionsModule({
  bootstrapAuthEmailTemplates = async () => ({ ok: true, data: {} }),
  createEmailTemplate = async () => ({ ok: true, data: { templateKey: "customer.account.activation" } }),
  getEmailDelivery = async () => ({ ok: true, data: { status: "FAILED" } }),
  hardDeleteEmailTemplateImage = async () => ({ ok: true, data: { deleted: true } }),
  listEmailTemplateImages = async () => ({ ok: true, data: [] }),
  patchEmailProviderSettings = async () => ({ ok: true, data: {} }),
  patchEmailTemplate = async () => ({ ok: true, data: { templateKey: "customer.account.activation" } }),
  previewEmailTemplate = async () => ({ ok: true, data: {} }),
  retryEmailDelivery = async () => ({ ok: true, data: { status: "SENT" } }),
  sendCommunicationsTestEmail = async () => ({ ok: true, data: {} }),
  transitionEmailTemplate = async () => ({ ok: true, data: { templateKey: "customer.account.activation" } }),
} = {}) {
  const moduleSource = source("src/modules/configuracion/communications-admin-actions.ts");
  const { outputText } = ts.transpileModule(moduleSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const calls = [];
  const commonJsExports = {};
  const moduleContext = {
    File,
    FormData,
    URLSearchParams,
    exports: commonJsExports,
    module: { exports: commonJsExports },
    require(specifier) {
      if (specifier === "next/cache") {
        return { revalidatePath(pathValue) { calls.push(["revalidatePath", pathValue]); } };
      }
      if (specifier === "next/navigation") {
        return { redirect(url) { throw { url }; } };
      }
      if (specifier.endsWith("/shared/config/admin-context")) {
        return {
          getAdminContext: async () => ({ organizationId: "org-1", shopId: "shop-1", locale: "es-ES" }),
        };
      }
      if (specifier === "./communications-admin") {
        return {
          bootstrapAuthEmailTemplates,
          createEmailTemplate,
          getEmailDelivery,
          hardDeleteEmailTemplateImage,
          listEmailTemplateImages,
          patchEmailProviderSettings,
          patchEmailTemplate,
          previewEmailTemplate,
          retryEmailDelivery,
          sendCommunicationsTestEmail,
          transitionEmailTemplate,
        };
      }

      return {};
    },
  };

  vm.runInNewContext(outputText, moduleContext);
  return { ...moduleContext.module.exports, calls };
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
  const editorSource = source("src/modules/configuracion/communications-template-editor-client.tsx");

  assert.match(dataSource, /\/admin\/communications\/settings\/email-provider/);
  assert.match(dataSource, /\/admin\/communications\/templates\/email/);
  assert.match(dataSource, /\/admin\/communications\/templates\/email\/auth-defaults/);
  assert.match(dataSource, /\/admin\/communications\/email\/send/);
  assert.match(dataSource, /createEmailTemplate/);
  assert.match(dataSource, /patchEmailTemplate/);
  assert.match(dataSource, /previewEmailTemplate/);
  assert.match(dataSource, /transitionEmailTemplate/);
  assert.match(dataSource, /uploadEmailTemplateImage/);
  assert.match(dataSource, /listEmailTemplateImages/);
  assert.match(dataSource, /hardDeleteEmailTemplateImage/);
  assert.match(actionsSource, /secret/);
  assert.match(actionsSource, /clearSecret/);
  assert.match(actionsSource, /sendCommunicationsTestEmailAction/);
  assert.match(actionsSource, /recipientEmail/);
  assert.match(actionsSource, /admin-communications-test/);
  assert.match(actionsSource, /communications\.manage/);
  assert.match(pageSource, /drawer: "provider"/);
  assert.match(pageSource, /function TemplateTable/);
  assert.match(pageSource, /CommunicationsTemplateEditor/);
  assert.match(pageSource, /Crear plantilla/);
  assert.match(pageSource, /Plantillas email/);
  assert.match(pageSource, /templatesLimit/);
  assert.match(pageSource, /Mostrando/);
  assert.match(editorSource, /transitionEmailTemplateAction/);
  assert.match(editorSource, /@tiptap\/react/);
  assert.match(editorSource, /EditorContent/);
  assert.match(editorSource, /\{\{emitter\.name\}\}/);
  assert.match(editorSource, /previewEmailTemplateAction/);
  assert.match(editorSource, /sandbox=""/);
  assert.match(editorSource, /HTML fuente de la plantilla/);
  assert.match(editorSource, /@tiptap\/extension-link/);
  assert.match(editorSource, /@tiptap\/extension-text-align/);
  assert.match(editorSource, /@tiptap\/extension-image/);
  assert.match(editorSource, /Añadir enlace/);
  assert.match(editorSource, /Alinear a la izquierda/);
  assert.match(editorSource, /Subir imagen/);
  assert.match(editorSource, /Imagen insertada\. Guarda la plantilla para conservarla/);
  assert.match(editorSource, /onChange\(editor\.getHTML\(\)\)/);
  assert.match(editorSource, /Eliminar definitivamente/);
  assert.match(editorSource, /deleteEmailTemplateImageAction/);
  assert.match(actionsSource, /uploadEmailTemplateImageAction/);
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

test("communications template client calls the scoped BFF CRUD, preview and lifecycle routes", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, context: options.context, init: options.init });
    return {
      ok: true,
      status: 200,
      correlationId: "corr-template",
      data: { templateId: "template-1", templateKey: "shipping.delivered", status: "DRAFT" },
    };
  };
  const context = { organizationId: "org-1", shopId: "shop-1", locale: "es-ES" };
  const {
    createEmailTemplate,
    patchEmailTemplate,
    previewEmailTemplate,
    transitionEmailTemplate,
  } = loadCommunicationsAdminModule(requestBff);

  await createEmailTemplate(context, {
    templateKey: "shipping.delivered",
    locale: "es-ES",
    subjectTemplate: "Pedido {{orderReference}} entregado",
    htmlTemplate: "<p>{{orderReference}}</p>",
    textTemplate: "{{orderReference}}",
    requiredVariables: ["orderReference"],
    previewData: { orderReference: "#10058" },
  });
  await patchEmailTemplate(context, "template/1", { subjectTemplate: "Actualizado" });
  await previewEmailTemplate(context, "template/1", { orderReference: "#10058" });
  await transitionEmailTemplate(context, "template/1", "activate");

  assert.equal(calls[0].path, "/admin/communications/templates/email?organizationId=org-1&shopId=shop-1");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    templateKey: "shipping.delivered",
    locale: "es-ES",
    subjectTemplate: "Pedido {{orderReference}} entregado",
    htmlTemplate: "<p>{{orderReference}}</p>",
    textTemplate: "{{orderReference}}",
    requiredVariables: ["orderReference"],
    previewData: { orderReference: "#10058" },
  });
  assert.equal(calls[1].path, "/admin/communications/templates/email/template%2F1?organizationId=org-1&shopId=shop-1");
  assert.equal(calls[1].init.method, "PATCH");
  assert.equal(calls[2].path, "/admin/communications/templates/email/template%2F1/preview?organizationId=org-1&shopId=shop-1");
  assert.deepEqual(JSON.parse(calls[2].init.body), { data: { orderReference: "#10058" } });
  assert.equal(calls[3].path, "/admin/communications/templates/email/template%2F1/activate?organizationId=org-1&shopId=shop-1");
  assert.equal(calls[3].init.method, "POST");
  assert.deepEqual(calls[3].context, context);
});

test("communications template uploader reuses Media and returns only a public image URL", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, init: options.init });
    if (options.init?.method === "POST") {
      return {
        ok: true,
        status: 201,
        correlationId: "corr-upload",
        data: {
          collection: {
            mediaCollectionId: "collection-1",
            items: [{ idImage: "asset-1", public: "https://cdn.example.test/email/header.png", originalFileName: "header.png" }],
          },
        },
      };
    }
    return { ok: true, status: 200, correlationId: "corr-list", data: { items: [] } };
  };
  const { uploadEmailTemplateImage } = loadCommunicationsAdminModule(requestBff);

  const result = await uploadEmailTemplateImage(
    { organizationId: "org-1", shopId: "shop-1", locale: "es-ES" },
    {
      templateId: "11111111-1111-4111-8111-111111111111",
      templateKey: "shipping.delivered",
      locale: "es-ES",
      file: new File(["image"], "header.png", { type: "image/png" }),
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.data.url, "https://cdn.example.test/email/header.png");
  assert.equal(result.data.mediaCollectionId, "collection-1");
  assert.equal(result.data.mediaAssetId, "asset-1");
  assert.equal(calls[0].path, "/admin/media/collections?organizationId=org-1&shopId=shop-1&productId=11111111-1111-4111-8111-111111111111&limit=1");
  assert.equal(calls[1].path, "/admin/media/collections?organizationId=org-1&shopId=shop-1");
  assert.equal(calls[1].init.method, "POST");
  assert.equal(calls[1].init.body.get("productId"), "11111111-1111-4111-8111-111111111111");
  assert.equal(calls[1].init.body.get("title"), "Email template shipping.delivered");
});

test("communications template actions validate editor data and delegate through the client", async () => {
  const createCalls = [];
  const previewCalls = [];
  const transitionCalls = [];
  const {
    createEmailTemplateAction,
    previewEmailTemplateAction,
    transitionEmailTemplateAction,
  } = loadCommunicationsActionsModule({
    createEmailTemplate: async (_context, payload) => {
      createCalls.push(payload);
      return { ok: true, status: 201, correlationId: "corr-create", data: { templateKey: payload.templateKey } };
    },
    previewEmailTemplate: async (_context, templateId, data) => {
      previewCalls.push({ templateId, data });
      return {
        ok: true,
        status: 200,
        correlationId: "corr-preview",
        data: { templateId, templateKey: "shipping.delivered", rendered: { subject: "Preview", html: "<p>Preview</p>", text: "Preview" } },
      };
    },
    transitionEmailTemplate: async (_context, templateId, transition) => {
      transitionCalls.push({ templateId, transition });
      return { ok: true, status: 200, correlationId: "corr-transition", data: { templateKey: "shipping.delivered" } };
    },
  });
  const createForm = new FormData();
  createForm.set("templateKey", "shipping.delivered");
  createForm.set("locale", "es-ES");
  createForm.set("subjectTemplate", "Pedido {{orderReference}}");
  createForm.set("htmlTemplate", "<p>{{orderReference}}</p>");
  createForm.set("textTemplate", "{{orderReference}}");
  createForm.set("requiredVariables", "orderReference\ncustomer.name");
  createForm.set("previewData", '{"orderReference":"#10058","customer":{"name":"Ana"}}');

  await assert.rejects(() => createEmailTemplateAction(createForm), (error) => {
    assert.match(error.url, /Plantilla%20shipping.delivered%20creada/);
    return true;
  });
  assert.deepEqual(JSON.parse(JSON.stringify(createCalls)), [{
    templateKey: "shipping.delivered",
    locale: "es-ES",
    subjectTemplate: "Pedido {{orderReference}}",
    htmlTemplate: "<p>{{orderReference}}</p>",
    textTemplate: "{{orderReference}}",
    requiredVariables: ["customer.name", "orderReference"],
    previewData: { orderReference: "#10058", customer: { name: "Ana" } },
  }]);

  const previewForm = new FormData();
  previewForm.set("templateId", "template-1");
  previewForm.set("previewData", '{"orderReference":"#10058"}');
  const preview = await previewEmailTemplateAction(previewForm);
  assert.equal(preview.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(previewCalls)), [{ templateId: "template-1", data: { orderReference: "#10058" } }]);

  const transitionForm = new FormData();
  transitionForm.set("templateId", "template-1");
  transitionForm.set("transition", "activate");
  await assert.rejects(() => transitionEmailTemplateAction(transitionForm), (error) => {
    assert.match(error.url, /Plantilla%20shipping.delivered%20activada/);
    return true;
  });
  assert.deepEqual(transitionCalls, [{ templateId: "template-1", transition: "activate" }]);
});

test("communications image deletion removes the template reference before hard-deleting Media", async () => {
  const calls = [];
  const { deleteEmailTemplateImageAction, calls: actionCalls } = loadCommunicationsActionsModule({
    listEmailTemplateImages: async () => ({
      ok: true,
      status: 200,
      correlationId: "corr-list",
      data: [{
        mediaCollectionId: "collection-1",
        mediaAssetId: "asset-1",
        url: "https://cdn.example.test/email/header.png",
        alt: "header.png",
      }],
    }),
    patchEmailTemplate: async (_context, templateId, payload) => {
      calls.push({ type: "template", templateId, payload });
      return { ok: true, status: 200, correlationId: "corr-template", data: { status: "DRAFT" } };
    },
    hardDeleteEmailTemplateImage: async (_context, image) => {
      calls.push({ type: "media", image });
      return { ok: true, status: 200, correlationId: "corr-media", data: { deleted: true } };
    },
  });
  const formData = new FormData();
  formData.set("templateId", "template-1");
  formData.set("mediaCollectionId", "collection-1");
  formData.set("mediaAssetId", "asset-1");
  formData.set("htmlTemplate", "<p>Sin imagen</p>");

  const result = await deleteEmailTemplateImageAction(formData);
  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    { type: "template", templateId: "template-1", payload: { htmlTemplate: "<p>Sin imagen</p>" } },
    { type: "media", image: { mediaCollectionId: "collection-1", mediaAssetId: "asset-1" } },
  ]);
  assert.deepEqual(actionCalls, [["revalidatePath", "/admin/configuracion/comunicaciones"]]);
});

test("communications admin models the full email delivery audit response", () => {
  const dataSource = source("src/modules/configuracion/communications-admin.ts");

  assert.match(dataSource, /export type EmailDeliveryRecipient/);
  assert.match(dataSource, /export type EmailDeliveryAttempt/);
  assert.match(dataSource, /export type EmailRenderedSnapshot/);
  assert.match(dataSource, /export type EmailDeliveryList/);
  assert.match(dataSource, /renderedSnapshot/);
  assert.match(dataSource, /skippedAt/);
});

test("communications audit filters use isolated and validated URL parameters", () => {
  const routeSource = source("app/(admin)/admin/configuracion/comunicaciones/page.tsx");

  assert.match(routeSource, /deliveryStatus: normalizeDeliveryStatus/);
  assert.match(routeSource, /deliveryTemplateKey: normalizeFilterValue/);
  assert.match(routeSource, /deliverySourceEventId: normalizeFilterValue/);
  assert.match(routeSource, /deliveryCustomerId: normalizeFilterValue/);
  assert.match(routeSource, /deliveriesLimit: normalizeLimit/);
  assert.match(routeSource, /deliveriesOffset: normalizeOffset/);
  assert.match(routeSource, /function normalizeDeliveryStatus/);
  assert.match(routeSource, /parsed >= 1 && parsed <= 100/);
});

test("communications admin renders the global delivery audit as an operational table", () => {
  const pageSource = source("src/modules/configuracion/communications-admin-page.tsx");

  assert.match(pageSource, /function DeliveryFilters/);
  assert.match(pageSource, /function DeliveryAuditTable/);
  assert.match(pageSource, /function DeliveryPagination/);
  assert.match(pageSource, /Auditoría de entregas/);
  assert.match(pageSource, /deliveryStatus/);
  assert.match(pageSource, /deliveryTemplateKey/);
  assert.match(pageSource, /deliverySourceEventId/);
  assert.match(pageSource, /deliveryCustomerId/);
  assert.match(pageSource, /No hay entregas para los filtros seleccionados/);
  assert.match(pageSource, /Ver fallidas/);
});

test("communications audit opens a safe delivery detail drawer", () => {
  const routeSource = source("app/(admin)/admin/configuracion/comunicaciones/page.tsx");
  const dataSource = source("src/modules/configuracion/communications-admin.ts");
  const pageSource = source("src/modules/configuracion/communications-admin-page.tsx");

  assert.match(routeSource, /deliveryId: normalizeFilterValue/);
  assert.match(routeSource, /templateId: normalizeFilterValue/);
  assert.match(routeSource, /templatesOffset: normalizeOffset/);
  assert.match(routeSource, /value === "provider" \|\| value === "delivery" \|\| value === "template"/);
  assert.match(dataSource, /selectedDelivery/);
  assert.match(pageSource, /function DeliveryDrawer/);
  assert.match(pageSource, /Detalle de entrega/);
  assert.match(pageSource, /Intentos del proveedor/);
  assert.match(pageSource, /HTML, el texto, los datos y los adjuntos no se representan/);
  assert.match(pageSource, /drawer: "delivery", deliveryId: delivery.deliveryId/);
});

test("communications audit only exposes a retry control for failed deliveries", () => {
  const actionsSource = source("src/modules/configuracion/communications-admin-actions.ts");
  const pageSource = source("src/modules/configuracion/communications-admin-page.tsx");

  assert.match(actionsSource, /retryEmailDelivery/);
  assert.match(actionsSource, /current\.data\.status !== "FAILED"/);
  assert.match(actionsSource, /Falta permiso communications\.manage/);
  assert.match(pageSource, /function DeliveryRetryForm/);
  assert.match(pageSource, /delivery\.status !== "FAILED"/);
  assert.match(pageSource, /Reintentar email/);
});

test("communications retry rechecks the delivery and preserves the audit filters", async () => {
  const getCalls = [];
  const retryCalls = [];
  const { retryEmailDeliveryAction, calls } = loadCommunicationsActionsModule({
    getEmailDelivery: async (_context, deliveryId) => {
      getCalls.push(deliveryId);
      return { ok: true, status: 200, correlationId: "corr-get", data: { status: "FAILED" } };
    },
    retryEmailDelivery: async (_context, deliveryId) => {
      retryCalls.push(deliveryId);
      return { ok: true, status: 200, correlationId: "corr-retry", data: { deliveryId, status: "SENT" } };
    },
  });
  const formData = new FormData();
  formData.set("deliveryId", "delivery-1");
  formData.set("deliveryStatus", "FAILED");
  formData.set("deliveryTemplateKey", "shipping.delivered");
  formData.set("deliveryCustomerId", "customer-1");
  formData.set("deliveriesLimit", "50");
  formData.set("deliveriesOffset", "20");

  await assert.rejects(() => retryEmailDeliveryAction(formData), (error) => {
    assert.match(error.url, /drawer=delivery/);
    assert.match(error.url, /deliveryId=delivery-1/);
    assert.match(error.url, /deliveryStatus=FAILED/);
    assert.match(error.url, /deliveryTemplateKey=shipping.delivered/);
    assert.match(error.url, /Estado\+actual%3A\+SENT/);
    return true;
  });
  assert.deepEqual(getCalls, ["delivery-1"]);
  assert.deepEqual(retryCalls, ["delivery-1"]);
  assert.deepEqual(calls, [["revalidatePath", "/admin/configuracion/comunicaciones"]]);
});

test("communications admin reads deliveries through the scoped BFF contract", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, context: options.context, init: options.init });
    return {
      ok: true,
      status: 200,
      correlationId: "corr-communications",
      data: { items: [], total: 0, limit: 20, offset: 0 },
    };
  };
  const context = {
    organizationId: "org-1",
    shopId: "shop-1",
    locale: "es-ES",
  };
  const { getCommunicationsAdminData, getEmailDelivery, retryEmailDelivery } = loadCommunicationsAdminModule(requestBff);

  await getCommunicationsAdminData(context, {
    deliveryStatus: "FAILED",
    deliveryTemplateKey: "shipping.delivered",
    deliverySourceEventId: "event-1",
    deliveryCustomerId: "customer-1",
    deliveriesLimit: "50",
    deliveriesOffset: "20",
  });
  await getEmailDelivery(context, "delivery/1");
  await retryEmailDelivery(context, "delivery/1");

  assert.equal(calls.length, 5);
  assert.equal(calls[2].path, "/admin/communications/deliveries?organizationId=org-1&shopId=shop-1&status=FAILED&templateKey=shipping.delivered&sourceEventId=event-1&customerId=customer-1&limit=50&offset=20");
  assert.equal(calls[3].path, "/admin/communications/deliveries/delivery%2F1?organizationId=org-1&shopId=shop-1");
  assert.equal(calls[4].path, "/admin/communications/deliveries/delivery%2F1/retry?organizationId=org-1&shopId=shop-1");
  assert.equal(calls[4].init.method, "POST");
  assert.deepEqual(calls[2].context, context);
});

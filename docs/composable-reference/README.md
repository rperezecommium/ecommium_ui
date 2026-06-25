# Referencia local del composable Ecommium para UI

## Objetivo

Este documento es el snapshot local que debe leer la IA cuando trabaje en `ecommium_ui`. Evita depender de rutas absolutas hacia el repo backend y conserva las reglas necesarias para construir la UI sin consultar `/Users/ricardoperez/Documents/ecommium/composable_ecommerce`.

Si este snapshot queda desactualizado frente al BFF real, la IA debe documentar el gap en el cambio de UI y pedir sincronizacion explicita. No debe navegar ni modificar el repo backend por iniciativa propia.

## Vision del backend

- Ecommium es una plataforma ecommerce composable y headless.
- El backend es multi-tenant por `Organization` y multiples `Shop`.
- El modelo considera internacionalizacion desde el inicio: idioma, moneda, pais, zona horaria y unidades.
- La arquitectura del backend usa bounded contexts, DDD, arquitectura hexagonal, CQRS, DB per service y comunicacion por APIs/eventos.
- El BFF es el unico borde publico para Storefront, Admin, mobile o cualquier cliente externo.

## Regla backend-only

El repo composable no contiene UIs. La UI web vive en `ecommium_ui` y debe consumir exclusivamente `apps/bff`.

Reglas derivadas:

- No llamar directo a `services/*`.
- No leer bases de datos del backend.
- No crear microservicios ni workers dentro de la UI.
- No usar Next.js `app/api/*` como BFF paralelo.
- Si falta un endpoint, registrar el gap y proponer contrato; no saltarse `apps/bff`.

## Bounded contexts relevantes para UI

- `Organizations & Shops`: Organization, Shop, shopAlias, defaults heredables, ShopContext, fiscalProfile y contexto multitienda.
- `Employees`: empleados internos, perfiles, permisos y preferencias de backoffice.
- `Sessions`: autenticacion, tokens, sesiones e introspeccion. La UI no autentica por su cuenta.
- `Catalog`: productos, variantes, categorias, marcas, especificaciones, opciones de variante.
- `Pricing`: precios, tablas, reglas, offerings, tax embebido y resolucion por contexto.
- `Inventory`: stock, disponibilidad y reservas por `variantId`.
- `Shipping/Logistics`: warehouses, carriers, zones, SLA, tarifas, pickup points, fulfillment y tracking.
- `Payments`: payment systems, affiliations, routing, transacciones, settlement, refund y PSP.
- `Checkout`: orderForm, carrito y estado transaccional de compra.
- `Orders`: ciclo de vida del pedido.
- `Customers`: perfiles, direcciones, consentimiento e historial backoffice.
- `Media`: binarios, assets, colecciones, thumbnails y metadata localizada.
- `CMS`: paginas, bloques, drafts y publicacion.
- `Routing/SEO`: rutas, canonical, aliases, redirects y sitemap.
- `Search`: busqueda, indexacion, facetas, ranking y eventos de usuario.
- `Analytics`: eventos ecommerce/reporting.
- `Automation`: reglas `trigger -> conditions -> actions` y ejecuciones.
- `Communications`: plantillas, deliveries y envio multicanal.
- `Invoice`: facturas, numeracion fiscal, documentos y snapshot fiscal.
- `After Sales`: devoluciones, cambios, garantias, evidencias, resoluciones y postventa.
- `Log`: logs de negocio estructurados.

## ADRs resumidos para UI

- ADR-0001: clientes externos consumen un BFF REST agregado.
- ADR-0008: BFF modular por feature, sin logica de negocio ecommerce.
- ADR-0013/0014: estrategia multilenguaje y traducciones desde el inicio.
- ADR-0045: Media es owner de binarios; Catalog solo referencia assets.
- ADR-0072/0073/0080/0111: cache tags, invalidacion y proyecciones Storefront para PLP de baja latencia.
- ADR-0087/0088/0089: Sessions, auth, guards y permisos admin multi-tenant.
- ADR-0090: Customer Backoffice 360.
- ADR-0098..0109: Shipping/Logistics inspirado en PrestaShop para carriers, zones, rangos, SLA y fulfillment.
- ADR-0110: Search usa Vertex AI Search for Commerce detras del servicio Search y BFF.
- ADR-0112: Analytics como bounded context separado.
- ADR-0113: Automation para reglas event-driven.
- ADR-0114: Communications para comunicaciones multicanal.
- ADR-0115: Employees inspirado en PrestaShop: empleados, perfiles, permisos, SuperAdmin protegido.
- ADR-0116: Organizations & Shops inspirado en PrestaShop Multistore, con herencia `Organization -> ShopGroup -> Shop`.
- ADR-0117: backend-only; toda UI externa vive fuera del repo backend y consume solo BFF.
- ADR-0118: Invoice es owner de facturacion fiscal y documentos.
- ADR-0119: After Sales es owner de postventa y orquestacion de devoluciones/cambios.

## Principios de integracion UI-BFF

- Base esperada local: `ECOMMIUM_BFF_BASE_URL=http://localhost:3010/api/v1`.
- Si el BFF Admin exige auth en desarrollo, la UI puede usar `ECOMMIUM_ADMIN_BFF_TOKEN` solo server-side para enviar `Authorization: Bearer <token>`. No debe exponerse como `NEXT_PUBLIC_*`.
- Admin usa rutas `/api/v1/admin/*`.
- Storefront usa rutas `/api/v1/storefront/*`.
- Enviar `Authorization` cuando exista sesion.
- Enviar `x-correlation-id` en llamadas trazables.
- Enviar contexto cuando aplique: `organizationId`, `shopId`, `locale`, `currency`, `country`, `channel`, `visitorId`, `guestSessionId`, `deviceId`.
- No inferir permisos solo en frontend; el BFF decide. La UI solo adapta navegacion y botones.
- Toda pantalla Admin debe estar scopiada por Organization/Shop.
- Toda lectura publica cacheable debe respetar headers y reglas de BFF.

## Endpoints BFF de referencia

Estos endpoints son orientativos para construir UI. Si alguno no responde, registrar el gap.

### Storefront

- `GET /api/v1/storefront/resolve-path?organizationId=:org&shopId=:shop&locale=:locale&path=:path`
- `GET /api/v1/storefront/page?organizationId=:org&shopId=:shop&locale=:locale&path=:path&limit=:limit&offset=:offset`
- `GET /api/v1/storefront/navigation/categories/tree/:levels`
- `GET /api/v1/storefront/search`
- `POST /api/v1/storefront/search/events`
- `GET /api/v1/storefront/plp/:categorySlug`
- `GET /api/v1/storefront/pdp/:productSlug`
- `GET /api/v1/storefront/pricing/products/:productId`
- `GET /api/v1/storefront/pricing/variants/:variantId`
- `GET /api/v1/storefront/me/purchases?organizationId=:org&shopId=:shop&limit=:limit&offset=:offset`
- `GET /api/v1/storefront/me/invoices`
- `GET /api/v1/storefront/me/invoices/:invoiceId/document`
- `POST /api/v1/storefront/me/after-sales/cases?organizationId=:org&shopId=:shop`

### Admin: Organizations/Shops y contexto multistore

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/admin/organizations-shops/organizations?limit=:limit&offset=:offset`
- `POST /api/v1/admin/organizations-shops/organizations`
- `GET /api/v1/admin/organizations-shops/organizations/:organizationId`
- `PATCH /api/v1/admin/organizations-shops/organizations/:organizationId`
- `GET /api/v1/admin/organizations-shops/shop-groups?organizationId=:org&limit=:limit&offset=:offset`
- `POST /api/v1/admin/organizations-shops/shop-groups?organizationId=:org`
- `GET /api/v1/admin/organizations-shops/shops?organizationId=:org&shopGroupId=:optional&status=:optional&limit=:limit&offset=:offset`
- `POST /api/v1/admin/organizations-shops/shops?organizationId=:org`
- `GET /api/v1/admin/organizations-shops/shops/:shopId?organizationId=:org`
- `PATCH /api/v1/admin/organizations-shops/shops/:shopId?organizationId=:org`
- `GET /api/v1/admin/organizations-shops/shops/context/resolve?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/organizations-shops/shops/context/resolve?organizationId=:org&shopAlias=:alias`

Flujo UI obligatorio:

1. Autenticar Admin con `email`, `password` y `scope=admin`, sin pedir `organizationId` ni `shopId` en el formulario.
2. Listar Organizations disponibles para el empleado autenticado.
3. Listar Shops por `organizationId`.
4. Mostrar nombre de tienda, `shopAlias`, dominio y estado operativo; evitar usar UUID como texto principal.
5. Permitir escribir `shopAlias` si el usuario no encuentra la tienda en el selector.
6. Resolver contexto por `shops/context/resolve`.
7. Persistir el `shopId` devuelto como identidad canonica del Admin.

`shopId` es tecnico y lo genera backend. La UI no lo pide al crear tienda ni lo presenta como dato principal para operar. Crear tienda usa datos humanos/configurables: `name`, `shopAlias`, `primaryDomain`, `shopGroupId`, `status` y `settingsOverride`.

`shopAlias` es humano y unico por Organization; no reemplaza a `shopId` en mutaciones, eventos ni contratos posteriores. Si el usuario informa `organizationId + shopAlias`, la UI debe resolverlo con `GET /api/v1/admin/organizations-shops/shops/context/resolve?organizationId=:org&shopAlias=:alias` y guardar el `shopId` canonico devuelto.

`Activa` en UI significa contexto seleccionado por el usuario Admin en cookie/sesion. No es un atributo global de `Shop`. Si se muestra junto a `status=ACTIVE`, diferenciarlo como `Contexto activo` frente a `Estado operativo`.

La sesion visual de desarrollo no autentica contra el BFF. Las llamadas Admin
reales requieren `Authorization`, obtenido desde BFF Sessions y persistido en
cookie httpOnly por la UI, o desde `ECOMMIUM_ADMIN_BFF_TOKEN` como fallback
server-side de desarrollo.

Gap confirmado el 2026-06-16 contra el BFF local: los endpoints
`/api/v1/admin/sessions/login`, `/api/v1/admin/sessions/me` y
`/api/v1/admin/sessions/logout` devolvieron `404`. El contrato operativo
observable para login Admin es `/api/v1/auth/login`, `/api/v1/auth/me`,
`/api/v1/auth/refresh` y `/api/v1/auth/logout`, enviando `scope=admin`.
`organizationId` y `shopId` solo se envian si ya existe contexto activo; la UI
debe llevar al selector de contexto cuando el login devuelva una sesion Admin
sin tienda activa canonica.

Estados UI obligatorios para multistore:

- BFF no disponible: mostrar banner con "No se pudo conectar con el BFF de Ecommium", endpoint fallido y el comando orientativo `./scripts/postman-services.sh up` solo como texto. Mantener modo manual limitado con `organizationId + shopAlias`, nunca pedir `shopId` para crear tienda.
- BFF disponible sin Organizations: mostrar estado vacio "No hay Organizations creadas" con CTA para crear Organization y explicar que se debe seleccionar o crear Organization antes de crear tienda.
- Organization sin Shops: mostrar select de Organizations, estado vacio "Esta Organization no tiene tiendas" y CTA para crear tienda con datos humanos (`name`, `shopAlias`, `primaryDomain`, `status`, settings opcionales).
- Contexto activo existente: mostrar siempre Organization activa, Shop activa, `shopAlias`, locale, currency, country y separar `Contexto activo` de `Estado operativo`.

### Admin: CMS y Routing/SEO

- `GET /api/v1/admin/cms/pages?organizationId=:org&shopId=:shop&locale=:locale&status=:status&pageType=:pageType&limit=:limit&offset=:offset`
- `POST /api/v1/admin/cms/pages?organizationId=:org&shopId=:shop&locale=:locale`
- `GET /api/v1/admin/cms/pages/:pageId?organizationId=:org&shopId=:shop&locale=:locale`
- `PATCH /api/v1/admin/cms/pages/:pageId/draft?organizationId=:org&shopId=:shop&locale=:locale`
- `POST /api/v1/admin/cms/pages/:pageId/publish?organizationId=:org&shopId=:shop&locale=:locale`
- `POST /api/v1/admin/cms/pages/:pageId/unpublish?organizationId=:org&shopId=:shop&locale=:locale`
- `GET /api/v1/admin/routing-seo/routes?organizationId=:org&shopId=:shop&locale=:locale`
- `POST /api/v1/admin/routing-seo/routes?organizationId=:org&shopId=:shop&locale=:locale`
- `PATCH /api/v1/admin/routing-seo/routes/:routeId?organizationId=:org&shopId=:shop&locale=:locale`
- `GET /api/v1/admin/routing-seo/redirects?organizationId=:org&shopId=:shop&locale=:locale`
- `GET /api/v1/admin/routing-seo/resolve?organizationId=:org&shopId=:shop&locale=:locale&path=:path`
- `GET /api/v1/admin/routing-seo/sitemap?organizationId=:org&shopId=:shop&locale=:locale`

### Admin: Search y Analytics

- `GET /api/v1/admin/search/health?organizationId=:org&shopId=:shop&locale=:locale`
- `POST /api/v1/admin/search/query-preview?organizationId=:org&shopId=:shop&locale=:locale`
- `GET /api/v1/admin/search/controls?organizationId=:org&shopId=:shop&locale=:locale`
- `POST /api/v1/admin/search/index/preview?organizationId=:org&shopId=:shop&locale=:locale`
- `POST /api/v1/admin/search/index/ndjson?organizationId=:org&shopId=:shop&locale=:locale`
- `POST /api/v1/admin/search/index/gcs-import-jobs?organizationId=:org&shopId=:shop&locale=:locale`
- `GET /api/v1/admin/analytics/health`
- `GET /api/v1/admin/analytics/events?organizationId=:org&shopId=:shop&eventType=:type&from=:iso&to=:iso&limit=:limit&offset=:offset`
- `GET /api/v1/admin/analytics/reports/summary?organizationId=:org&shopId=:shop&from=:iso&to=:iso`

### Admin: Automation y Communications

- `GET /api/v1/admin/automation/health`
- `GET /api/v1/admin/automation/rules?organizationId=:org&shopId=:shop&status=:status&eventType=:eventType&limit=:limit&offset=:offset`
- `POST /api/v1/admin/automation/rules?organizationId=:org&shopId=:shop`
- `PATCH /api/v1/admin/automation/rules/:ruleId?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/automation/rules/:ruleId/activate?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/automation/rules/:ruleId/pause?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/automation/executions?organizationId=:org&shopId=:shop&status=:status&ruleId=:ruleId&eventType=:eventType&limit=:limit&offset=:offset`
- `POST /api/v1/admin/automation/executions/:executionId/retry?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/communications/health`
- `GET /api/v1/admin/communications/templates/email?organizationId=:org&shopId=:shop&status=:status&locale=:locale&templateKey=:key&limit=:limit&offset=:offset`
- `POST /api/v1/admin/communications/templates/email?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/communications/templates/email/:templateId/preview?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/communications/templates/email/:templateId/activate?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/communications/deliveries?organizationId=:org&shopId=:shop&status=:status&templateKey=:key&limit=:limit&offset=:offset`
- `POST /api/v1/admin/communications/deliveries/:deliveryId/retry?organizationId=:org&shopId=:shop`

### Admin: Customers

- `GET /api/v1/admin/customers?organizationId=:org&shopId=:shop&limit=:limit&offset=:offset&q=:q&email=:email`
- `POST /api/v1/admin/customers?organizationId=:org&shopId=:shop`
- `PATCH /api/v1/admin/customers/:customerId?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/customers/:customerId?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/customers/:customerId/addresses?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/customers/:customerId/addresses?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/customers/:customerId/purchases?organizationId=:org&shopId=:shop&limit=:limit&offset=:offset`

### Admin: Payments

- `GET /api/v1/admin/payments/affiliations?organizationId=:org&shopId=:shop&includeInactive=false`
- `POST /api/v1/admin/payments/affiliations?organizationId=:org&shopId=:shop`
- `PATCH /api/v1/admin/payments/affiliations/:affiliationId?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/payments/payment-systems?organizationId=:org&shopId=:shop&includeInactive=false`
- `POST /api/v1/admin/payments/payment-systems?organizationId=:org&shopId=:shop`
- `PATCH /api/v1/admin/payments/payment-systems/:paymentSystemId?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/payments/rules?organizationId=:org&shopId=:shop&includeInactive=false`
- `POST /api/v1/admin/payments/rules?organizationId=:org&shopId=:shop`
- `PATCH /api/v1/admin/payments/rules/:ruleId?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/payments/card-lookup?organizationId=:org&shopId=:shop`

### Admin: Media, Shipping, Invoice y After Sales

- `POST /api/v1/admin/product-save-operations?organizationId=:org&shopId=:shop&locale=:locale`
- `GET /api/v1/admin/product-drafts/:clientDraftId?organizationId=:org&shopId=:shop&locale=:locale`
- `POST /api/v1/admin/product-drafts/:clientDraftId/media?organizationId=:org&shopId=:shop&locale=:locale`
- `POST /api/v1/admin/media/collections`
- `POST /api/v1/admin/media/collections/:mediaCollectionId/items`
- `GET /api/v1/admin/media/collections`
- `GET /api/v1/admin/media/collections/:mediaCollectionId`
- `GET /api/v1/admin/media/collections/by-product/:productId`
- `PATCH /api/v1/admin/media/collections/:mediaCollectionId`
- `DELETE /api/v1/admin/media/collections/:mediaCollectionId?mode=soft|hard`
- `GET /api/v1/admin/media/assets/:mediaAssetId/content?variant=original|small_default|medium_default|large_default`
- `GET /api/v1/admin/shipping/warehouses?organizationId=:org&shopId=:shop&includeInactive=false`
- `GET /api/v1/admin/shipping/configuration?organizationId=:org&shopId=:shop&includeInactive=false`
- `POST /api/v1/shipping/options/resolve?organizationId=:org&shopId=:shop`
- `PUT /api/v1/admin/shipping/warehouses?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/shipping/sla-policies?organizationId=:org&shopId=:shop&includeInactive=false`
- `PUT /api/v1/admin/shipping/sla-policies?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/shipping/pickup-points?organizationId=:org&shopId=:shop&includeInactive=false`
- `PUT /api/v1/admin/shipping/pickup-points?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/shipping/fulfillments?organizationId=:org&shopId=:shop&status=:status&limit=:limit&offset=:offset`
- `PATCH /api/v1/admin/shipping/fulfillments/:fulfillmentId/status?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/invoices`
- `GET /api/v1/admin/invoices/:invoiceId`
- `GET /api/v1/admin/invoices/:invoiceId/document`
- `POST /api/v1/admin/invoices/issue`
- `GET /api/v1/admin/after-sales/health`
- `GET /api/v1/admin/after-sales/cases?organizationId=:org&shopId=:shop&status=:status&customerId=:customerId&orderId=:orderId&limit=:limit&offset=:offset`
- `PATCH /api/v1/admin/after-sales/cases/:caseId/review?organizationId=:org&shopId=:shop`
- `PATCH /api/v1/admin/after-sales/cases/:caseId/approve?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/after-sales/cases/:caseId/refund-requests?organizationId=:org&shopId=:shop`
- `PATCH /api/v1/admin/after-sales/cases/:caseId/resolve?organizationId=:org&shopId=:shop`

`Admin > Transporte` consume la configuracion global de Shipping/Logistics por
BFF con `GET /admin/shipping/configuration` y edita zonas, transportistas,
servicios y reglas tarifarias con `PUT /admin/shipping/{zones,carriers,carrier-services,rate-rules}`.
Tambien incluye un simulador operativo de cotizacion que llama
`POST /shipping/options/resolve` con direccion, item, peso, dimensiones y grupo
de cliente para validar que las reglas configuradas producen SLAs reales.
La ficha de producto solo guarda atributos logisticos propios del producto y
referencias a transportistas permitidos; no duplica reglas globales de Shipping.

Guardado Admin de producto:

- La UI genera `clientDraftId` estable antes de persistir el producto y lo conserva en el borrador local.
- Las imagenes nuevas se suben por `POST /admin/product-drafts/:clientDraftId/media` con multipart, `idempotency-key`, `fileLocalId`, metadata y archivo binario. Media persiste el asset; Catalog solo recibe referencias `mediaAssetId`.
- Al abrir o restaurar un borrador con `clientDraftId`, la UI consulta `GET /admin/product-drafts/:clientDraftId` y rehidrata `productId`, `defaultVariantId`, `mediaCollectionId` y `mediaItems[]` persistidos.
- El guardado general usa una sola operacion `POST /admin/product-save-operations` con `draft` JSON, archivos locales pendientes y `idempotency-key`.
- La respuesta BFF incluye `blocks.catalog|variants|media|variantMedia|pricing|inventory|shipping|publish`, `fieldErrors`, `retryable`, `draftPatch`, `correlationIds` y `recoveryActions`.
- Si `publish` queda `blocked`, la UI debe mantener el producto como borrador/guardado sin publicar y mostrar las acciones de recuperacion devueltas por BFF. La UI puede anticipar validaciones, pero el BFF decide el estado final.

## UX PrestaShop-like aplicable

- Admin primero.
- Sidebar persistente.
- Topbar con buscador, selector de contexto, notificaciones, ver tienda y perfil.
- Breadcrumb en pantallas profundas.
- Formularios por tabs: `Basico`, `Avanzado`, `Contexto`, `Auditoria` cuando aplique.
- Listados densos con tabla, filtros, bulk actions, columnas, paginacion y estado vacio.
- Productos: `Basico`, `Combinaciones`, `Precio`, `SEO`, `Medios`, `Transporte`, `Opciones`, `Auditoria`.
- Precios: precio basico visible rapido; reglas, vigencia, prioridades y tablas en avanzado.
- Shipping: carriers, zones, ranges por peso/precio, impuestos, manipulacion y comportamiento fuera de rango.
- Multistore: listar Organizations, listar Shops por Organization con etiquetas humanas, mostrar `shopAlias`, permitir resolver por alias, no pedir UUID al crear tienda y mostrar si cada campo esta heredado, customizado o restaurable.
- Permissions: perfiles en tabs y matriz de permisos por capacidad.

Tokens visuales Admin obligatorios:

```css
:root {
  --admin-bg: #f5f8f9;
  --admin-surface: #ffffff;
  --admin-surface-muted: #eef3f6;
  --admin-sidebar-bg: #363a41;
  --admin-sidebar-active: #25b9d7;
  --admin-text: #363a41;
  --admin-text-muted: #6c868e;
  --admin-border: #d9e1e7;
  --admin-border-subtle: #e9edf2;
  --admin-border-strong: #000f44;
  --admin-primary: #25b9d7;
  --admin-primary-hover: #1ca6c3;
  --admin-primary-pressed: #1688a3;
  --admin-success: #72c279;
  --admin-warning: #fbbb22;
  --admin-danger: #e74c3c;
  --admin-info: #4ac7e0;
  --admin-focus-ring: #000f44;
}
```

`#000f44` queda reservado para foco, bordes activos y jerarquia fuerte. Los bordes normales usan `#d9e1e7` y los divisores suaves `#e9edf2`. No introducir nuevos hex sin crear token y justificarlo.

## QA y performance esperada

- `npm run lint`
- `npm run build`
- Tests unitarios de schemas/mappers.
- Tests contractuales contra fixtures BFF locales.
- Playwright E2E para flujos criticos.
- Accesibilidad en pantallas principales.
- Lighthouse Storefront >= 90.
- Lighthouse Admin >= 85.
- LCP p75 <= 2.5s.
- INP p75 <= 200ms.
- CLS p75 <= 0.1.
- Tablas con paginacion server-side.
- Graficas, editores, media manager y tablas pesadas con lazy loading.

## Comando backend para pruebas manuales

Cuando el usuario levante el backend por separado, el stack canonico se arranca desde el repo composable con:

```sh
./scripts/postman-services.sh
```

La IA de `ecommium_ui` no debe ejecutar ese script por defecto ni cambiar archivos del backend. Solo debe indicar que el backend debe estar arriba para pruebas integradas.

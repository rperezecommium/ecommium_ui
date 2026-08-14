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
- ADR-0148: separa el BFF en `bff/storeFront` y `bff/storeAdmin`; los contratos
  HTTP se conservan y cada superficie cambia exclusivamente su URL base.
- ADR-0154: Admin 0 se crea o adopta una única vez mediante un claim efímero o
  una sesión SYSTEM con step-up. El instalador no crea Organizations/Shops y
  queda terminal en `COMPLETED`.

## Principios de integracion UI-BFF

- Storefront desplegado exige `ECOMMIUM_STOREFRONT_BFF_BASE_URL`, `ECOMMIUM_STOREFRONT_ORGANIZATION_ID` y `ECOMMIUM_STOREFRONT_SHOP_ID`; la URL debe usar HTTPS fuera de desarrollo. No hereda defaults Admin ni selecciona un tenant fixture. Para una demo local controlada se debe declarar `ECOMMIUM_UI_ALLOW_STOREFRONT_FIXTURES=true` en desarrollo.
- Base StoreAdmin local: `ECOMMIUM_ADMIN_BFF_BASE_URL=http://localhost:3026/api/v1`.
- La UI usa los clientes server-side explicitos `storefront-client` y
  `admin-client`. No usa `ECOMMIUM_BFF_BASE_URL` ni el puerto legacy `3010`.
  No se requiere `NEXT_PUBLIC_ADMIN_BFF_URL`: el navegador llama solo a la UI
  same-origin y Next.js resuelve la URL Admin en el servidor.
- Admin solo acepta el bearer de una sesión Employee validada por BFF. La cookie
  de UI se firma con `ECOMMIUM_UI_ADMIN_SESSION_SECRET` (mínimo 32 caracteres)
  y puede verificar temporalmente `ECOMMIUM_UI_ADMIN_SESSION_PREVIOUS_SECRET`
  durante una rotación; nunca usa un bearer técnico como fallback.
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
- `GET /api/v1/storefront/order-tracking/:orderReference?organizationId=:org&shopId=:shop&trackingAccessToken=:optional`
- `POST /api/v1/storefront/order-tracking/access-recovery?organizationId=:org&shopId=:shop`
- `GET /api/v1/storefront/me/purchases?organizationId=:org&shopId=:shop&limit=:limit&offset=:offset`
- `GET /api/v1/storefront/me/invoices`
- `GET /api/v1/storefront/me/invoices/:invoiceId/document`
- `POST /api/v1/storefront/me/after-sales/cases?organizationId=:org&shopId=:shop`

Reglas para pedidos guest:

- La recuperación recibe únicamente `{ orderReference, email }`, responde siempre
  `202 { accepted: true }` y nunca revela si el pedido o el email existen.
- El `trackingAccessToken` es opaco y solo autoriza el seguimiento guest. La UI
  debe retirarlo de la URL después de usarlo y no guardarlo en `localStorage`,
  logs ni estado persistente del navegador.
- Cuando un invitado crea y verifica una cuenta con el mismo email, Sessions
  vincula internamente los pedidos guest elegibles del tenant y los reproyecta
  en `Mis compras`. La UI no persiste ni reenvía referencia, email o token para
  asociar pedidos, ni muestra una acción de claim manual.
- Los enlaces privados enviados por Orders usan
  `ORDERS_STOREFRONT_PUBLIC_BASE_URL`: localmente `http://localhost:5173` y en
  producción el dominio público real del Storefront.

### Admin: Organizations/Shops y contexto multistore

#### Instalación de Admin 0

La UI externa expone `/admin/installation` y consume exclusivamente:

- `GET /api/v1/admin/installation/status`, público y `no-store`;
- `POST /api/v1/admin/installation/fresh-completion`, público, con
  `{ claim, email, password, firstName?, lastName? }`;
- `POST /api/v1/admin/installation/adoption-completion`, autenticado SYSTEM y
  con step-up reciente, con `{ newPassword }`.

Las tres rutas requieren que StoreAdmin BFF opere con
`ADMIN_INSTALLATION_SURFACE_MODE=ENABLED`. En modo ausente, inválido o
`DISABLED`, BFF responde `503` + `no-store`; la UI no intenta llamar a
Employees ni habilita un flujo alternativo.

El status público admite únicamente
`NOT_INITIALIZED|FRESH_CLAIM_REQUIRED|FRESH_READY|ADOPTION_REQUIRED|REVIEW_REQUIRED|COMPLETED`
y flags `completeFresh|completeAdoption|contactOperator`. Nunca expone modo,
versión, TTL, intentos, motivos, candidatos, emails o IDs. Fresh no emite una
sesión. Adoption se precede por `POST /api/v1/admin/session/step-up` con la
contraseña actual; al completar, BFF revoca todas las sesiones y la UI elimina
sus cookies y exige login nuevo.

Si una sesión autenticada tiene `tenantAccess.level=SYSTEM` y todavía no hay
shops, el login conserva la sesión y abre el onboarding normal de contexto. La
Organization se crea por `POST /admin/organizations-shops/organizations` y la
Shop por `POST /admin/organizations-shops/shops`; el instalador nunca recibe ni
crea esos recursos. Un Employee no SYSTEM sin tiendas sigue sin obtener acceso
operativo.

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

Las llamadas Admin reales requieren `Authorization` obtenido desde BFF Sessions
y persistido en una cookie httpOnly firmada por la UI. No existe un fallback
server-side que sustituya la identidad del Employee.

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
- `GET /api/v1/admin/cms/settings/global?organizationId=:org&shopId=:shop&locale=:locale`
- `PATCH /api/v1/admin/cms/settings/global?organizationId=:org&shopId=:shop&locale=:locale`
- `GET /api/v1/admin/cms/font-options?organizationId=:org&shopId=:shop&locale=:locale`
- `GET /api/v1/admin/cms/pages/:pageId/settings?organizationId=:org&shopId=:shop&locale=:locale`
- `PATCH /api/v1/admin/cms/pages/:pageId/settings?organizationId=:org&shopId=:shop&locale=:locale`
- `GET /api/v1/admin/cms/pages/:pageId/resolved-settings?organizationId=:org&shopId=:shop&locale=:locale`
- `GET /api/v1/admin/cms/templates?organizationId=:org&shopId=:shop&locale=:locale&pageType=:optional&status=:optional`
- `POST /api/v1/admin/cms/templates?organizationId=:org&shopId=:shop&locale=:locale`
- `PATCH /api/v1/admin/cms/templates/:templateId?organizationId=:org&shopId=:shop&locale=:locale`
- `GET /api/v1/admin/routing-seo/routes?organizationId=:org&shopId=:shop&locale=:locale`
- `POST /api/v1/admin/routing-seo/routes?organizationId=:org&shopId=:shop&locale=:locale`
- `PATCH /api/v1/admin/routing-seo/routes/:routeId?organizationId=:org&shopId=:shop&locale=:locale`
- `GET /api/v1/admin/routing-seo/redirects?organizationId=:org&shopId=:shop&locale=:locale`
- `GET /api/v1/admin/routing-seo/resolve?organizationId=:org&shopId=:shop&locale=:locale&path=:path`
- `GET /api/v1/admin/routing-seo/sitemap?organizationId=:org&shopId=:shop&locale=:locale`

Reglas UI CMS Settings vigentes:

- `tokens.spacing.xs/sm/md/lg/xl` se reciben y se envian como valores CSS explicitos, preferentemente `px`.
- `tokens.defaultColumnGap`, `tokens.defaultModuleGap`, `layout.columnGap`, `layout.rowGap` y spacing de placements deben mostrarse como valores CSS concretos. La UI puede normalizar aliases legacy (`md`, `lg`) usando `tokens.spacing`, pero no debe presentarlos al operador como valor final.
- `tokens.typography` se recibe y se envia por slot como `{ family, provider: "google", weights }`. Strings legacy como `"Inter"` solo se aceptan como compatibilidad de lectura y deben normalizarse en UI.
- `GET /admin/cms/font-options` es la lista BFF de Google Fonts disponible para selects Admin; la UI no debe usar inputs de texto libre para familias tipograficas en Ajustes basicos.

Reglas UI Routing/SEO vigentes para producto:

- `canonicalRouteId` es solo lectura; la UI no debe enviarlo en `POST routes`,
  `PATCH routes` ni en `draft.routingSeo`.
- `includeInSitemap` solo aplica a rutas `CANONICAL`. Los aliases se muestran y
  editan como rutas alternativas, pero siempre se envian con
  `includeInSitemap=false`.
- `createRedirectFromPreviousPath` solo aplica al cambio de canonical path.
- Un alias eliminado se envia como baja logica (`status=INACTIVE`,
  `includeInSitemap=false`) si ya tiene `routeId`.

Reglas UI Routing/SEO vigentes para Admin SEO global:

- La pantalla global puede mostrar `canonicalRouteId` como dato de lectura, pero
  no debe enviarlo en creacion ni actualizacion de rutas.
- Las rutas `ALIAS` se normalizan como no indexables al leer del BFF y antes de
  mutar contra el BFF.
- `PATCH routes/:routeId` no envia `routeKind`; si la UI lo usa para decidir
  comportamiento local, debe eliminarlo antes del request.
- Los redirects `302` manuales requieren `reason` y `expiresAt` futuro antes de
  llamar al BFF. El backend conserva la validacion final de ruta activa destino
  y evita cadenas de redirects.

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
- `GET /api/v1/admin/communications/deliveries?organizationId=:org&shopId=:shop&status=:optional&templateKey=:optional&sourceEventId=:optional&customerId=:optional&limit=:limit&offset=:offset`
- `GET /api/v1/admin/communications/deliveries/:deliveryId?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/communications/deliveries/:deliveryId/retry?organizationId=:org&shopId=:shop`

Las deliveries son una auditoria operativa de emails por Organization y Shop.
El listado admite exclusivamente los filtros `status`, `templateKey`, `sourceEventId`
y `customerId`; no inferir filtros por destinatario, fecha u otros campos sin ampliar
primero el contrato BFF. El detalle incluye destinatario, intentos del proveedor,
error, timestamps y snapshot renderizado. La UI debe mostrar ese snapshot como texto
seguro y no renderizar HTML remoto ni exponer datos sensibles por defecto. Solo una
delivery en estado `FAILED` puede reintentarse; el BFF confirma el estado resultante.

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
- `GET /api/v1/admin/payments/transactions?organizationId=:org&shopId=:shop&status=:optional&referenceId=:optional&limit=:limit&offset=:offset`
- `GET /api/v1/admin/payments/transactions/:transactionId?organizationId=:org&shopId=:shop`

La ficha de una transacción sirve como evidencia operativa del refund: la UI puede
mostrar importes, estado, proveedor, referencia del refund, error y timestamps
seguros. No debe renderizar `additionalData`, snapshots PSP, secretos, PAN/CVV,
tokens o la respuesta cruda del proveedor.

### Admin: Pricing

- `GET /api/v1/admin/pricing/taxes?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/pricing/taxes?organizationId=:org&shopId=:shop`
- `PATCH /api/v1/admin/pricing/taxes/:taxCode?organizationId=:org&shopId=:shop`
- `DELETE /api/v1/admin/pricing/taxes/:taxCode?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/pricing/price-tables?organizationId=:org&shopId=:shop&includeInactive=:optional`
- `POST /api/v1/admin/pricing/price-tables?organizationId=:org&shopId=:shop`
- `PATCH /api/v1/admin/pricing/price-tables/:priceTableId?organizationId=:org&shopId=:shop`
- `DELETE /api/v1/admin/pricing/price-tables/:priceTableId?organizationId=:org&shopId=:shop`
- `GET|POST /api/v1/admin/pricing/customer-groups?organizationId=:org&shopId=:shop&includeInactive=:optional`
- `PATCH|DELETE /api/v1/admin/pricing/customer-groups/:code?organizationId=:org&shopId=:shop`
- `GET|POST /api/v1/admin/pricing/channels?organizationId=:org&shopId=:shop&includeInactive=:optional`
- `PATCH|DELETE /api/v1/admin/pricing/channels/:code?organizationId=:org&shopId=:shop`
- `GET|POST /api/v1/admin/pricing/trade-policies?organizationId=:org&shopId=:shop&includeInactive=:optional`
- `PATCH|DELETE /api/v1/admin/pricing/trade-policies/:code?organizationId=:org&shopId=:shop`
- `GET|POST /api/v1/admin/pricing/countries?organizationId=:org&shopId=:shop&includeInactive=:optional`
- `PATCH|DELETE /api/v1/admin/pricing/countries/:code?organizationId=:org&shopId=:shop`

`Admin > Configuracion > Precios` consume estas listas maestras por BFF para
alimentar selectores de impuestos, price tables, grupos de cliente, canales,
politicas comerciales y paises. La UI no debe aceptar listas locales inventadas
que luego no hagan match con el motor de Pricing.

Certificacion UI 2026-06-26: Playwright valida
`/admin/configuracion/precios?tab=references`, muestra `default-iva`,
`vip-table`, `vip`, `web`, `default` y `ES`, crea `playwright-vip` via BFF y
comprueba que el navegador no llama servicios internos. La grilla de Pricing
usa columnas densas responsivas para evitar que tablas y formularios se
superpongan sobre botones de accion.

`Producto > Precio` consume esas mismas listas maestras como selects en el
contexto avanzado de precio base, precios especificos y simulador aplicado.
Los valores legacy se muestran como opcion actual si todavia no existen en
`Configuracion > Precios`.

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

`Admin > Catalogo > Media` lista colecciones por BFF con scope
`organizationId/shopId/locale`, permite revisar detalle de assets, alt/title,
estado y preview por el proxy server-side `/api/admin/media-assets/:mediaAssetId/content`.
La UI solo expone baja segura de coleccion con `DELETE ...?mode=soft`; no expone
borrado hard ni subida libre fuera del flujo de producto hasta tener contrato
Admin de metadata y ownership suficientemente cerrado.

`Admin > Catalogo > Stock` no usa un listado global inventado de Inventory. Lee
productos por `GET /admin/products`, abre `GET /admin/products/:productId/editor-state`
para obtener variantes y disponibilidad, y actualiza cada fila con
`PUT /admin/inventory/stock-levels`. La pantalla no crea reservas, no edita
warehouses globales y no mezcla reglas de Shipping/Logistics con disponibilidad
comercial.

`Admin > Promociones` es el punto de entrada para cupones y reglas de carrito
gobernadas por `Promotions`. La UI no debe llamar directo a `services/promotions`;
consume la fachada BFF Admin estable para CRUD de cupones:

- `GET /api/v1/admin/promotions/coupons?organizationId=:org&shopId=:shop&includeInactive=:bool`
- `POST /api/v1/admin/promotions/coupons?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/promotions/coupons/:couponCode?organizationId=:org&shopId=:shop`
- `PATCH /api/v1/admin/promotions/coupons/:couponCode?organizationId=:org&shopId=:shop`
- `DELETE /api/v1/admin/promotions/coupons/:couponCode?organizationId=:org&shopId=:shop&mode=soft`

Las reglas de precio de catalogo, price tables, fixed prices y computed-auto no
son cupones. Viven en `Admin > Configuracion > Precios`, consumen
`/api/v1/admin/pricing/*` y pertenecen a `Pricing`.

- `GET /api/v1/admin/shipping/warehouses?organizationId=:org&shopId=:shop&includeInactive=false`
- `GET /api/v1/admin/shipping/configuration?organizationId=:org&shopId=:shop&includeInactive=false`
- `POST /api/v1/shipping/options/resolve?organizationId=:org&shopId=:shop`
- `PUT /api/v1/admin/shipping/warehouses?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/shipping/sla-policies?organizationId=:org&shopId=:shop&includeInactive=false`
- `PUT /api/v1/admin/shipping/sla-policies?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/shipping/pickup-points?organizationId=:org&shopId=:shop&includeInactive=false`
- `PUT /api/v1/admin/shipping/pickup-points?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/shipping/fulfillments?organizationId=:org&shopId=:shop&status=:status&limit=:limit&offset=:offset`
- `GET /api/v1/admin/shipping/fulfillments/:fulfillmentId?organizationId=:org&shopId=:shop`
- `PATCH /api/v1/admin/shipping/fulfillments/:fulfillmentId/status?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/invoices`
- `GET /api/v1/admin/invoices/:invoiceId`
- `GET /api/v1/admin/invoices/:invoiceId/document`
- `POST /api/v1/admin/invoices/issue`
- `GET /api/v1/admin/after-sales/health`
- `GET /api/v1/admin/after-sales/cases?organizationId=:org&shopId=:shop&status=:status&customerId=:customerId&orderId=:orderId&limit=:limit&offset=:offset`
- `GET /api/v1/admin/after-sales/cases/:caseId?organizationId=:org&shopId=:shop`
- `PATCH /api/v1/admin/after-sales/cases/:caseId/review?organizationId=:org&shopId=:shop`
- `PATCH /api/v1/admin/after-sales/cases/:caseId/approve?organizationId=:org&shopId=:shop`
- `PATCH /api/v1/admin/after-sales/cases/:caseId/assignment?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/after-sales/cases/:caseId/return-authorizations?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/after-sales/cases/:caseId/refund-requests?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/after-sales/cases/:caseId/inventory-dispositions?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/after-sales/cases/:caseId/document-adjustments?organizationId=:org&shopId=:shop`
- `PATCH /api/v1/admin/after-sales/cases/:caseId/resolve?organizationId=:org&shopId=:shop`

La bandeja Admin abre el detalle y las acciones de un caso en un drawer lateral controlado por
`caseId` en la URL. La UI no navega ni llama directamente a Shipping, Inventory o Invoice: las
mutaciones se realizan únicamente por los endpoints de After Sales. En Storefront, Mi cuenta abre
otro drawer limitado a la solicitud inicial.

`Admin > Transporte` consume la configuracion global de Shipping/Logistics por
BFF con `GET /admin/shipping/configuration` y edita zonas, transportistas,
servicios y reglas tarifarias con `PUT /admin/shipping/{zones,carriers,carrier-services,rate-rules}`.
Tambien incluye un simulador operativo de cotizacion que llama
`POST /shipping/options/resolve` con direccion, item, peso, dimensiones y grupo
de cliente para validar que las reglas configuradas producen SLAs reales.
La ficha de producto solo guarda atributos logisticos propios del producto y
referencias a transportistas permitidos; no duplica reglas globales de Shipping.

La operativa transversal de fulfillment pertenece a `Admin > Configuracion >
Transporte`. La UI consume exclusivamente la fachada BFF para listar, filtrar
por un unico `status`, paginar, inspeccionar y transicionar envios. El detalle
devuelve el contexto logistico y de notificacion interno (`fulfillmentId`,
`version`, `orderId`, `orderReference`, `customerId`); este ultimo no se
traslada nunca a Storefront.

- Las lecturas y transiciones de fulfillments requieren
  `shipping.logistics.write`, ademas de sesion Admin, contexto
  `organizationId/shopId` y los roles permitidos por BFF.
- Estados admitidos: `PENDING_FULFILLMENT`, `READY_TO_PICK`, `PICKING`,
  `PACKED`, `SHIPPED`, `DELIVERED` y `FAILED`.
- La UI solo debe proponer transiciones validas para el estado actual; BFF y
  Shipping conservan la validacion definitiva. `DELIVERED` y `FAILED` son
  terminales.
- El body de la transicion usa `{ "status", "trackingNumber?", "carrierId?" }`.
  `trackingNumber` es obligatorio al enviar `SHIPPED`.
- La bandeja no crea fulfillments ni reemplaza la operativa por pedido de
  `Admin > Pedidos`; ambas superficies consumen sus contratos BFF respectivos.

Guardado Admin de producto:

- La UI genera `clientDraftId` estable antes de persistir el producto y lo conserva en el borrador local.
- Las imagenes nuevas se suben por `POST /admin/product-drafts/:clientDraftId/media` con multipart, `idempotency-key`, `fileLocalId`, metadata y archivo binario. Media persiste el asset; Catalog solo recibe referencias `mediaAssetId`.
- Al abrir o restaurar un borrador con `clientDraftId`, la UI consulta `GET /admin/product-drafts/:clientDraftId` y rehidrata `productId`, `defaultVariantId`, `mediaCollectionId` y `mediaItems[]` persistidos.
- El guardado general usa una sola operacion `POST /admin/product-save-operations` con `draft` JSON, archivos locales pendientes y `idempotency-key`.
- La respuesta BFF incluye `blocks.catalog|variants|media|variantMedia|pricing|inventory|shipping|publish`, `fieldErrors`, `retryable`, `draftPatch`, `correlationIds` y `recoveryActions`.
- Las `recoveryActions` se muestran como acciones reales: las de revision navegan al tab del bloque afectado y las de reintento vuelven a ejecutar el guardado canonico. La UI no crea endpoints de reintento paralelos ni borra bloques exitosos.
- Las especificaciones tecnicas se gestionan dentro del draft: la UI lee grupos/valores desde `GET /admin/specifications/groups`, rehidrata selecciones desde `editor-state`, normaliza un valor por caracteristica y envia `draft.specifications.selections` al guardado general.
- Si `publish` queda `blocked`, la UI debe mantener el producto como borrador/guardado sin publicar y mostrar las acciones de recuperacion devueltas por BFF. La UI puede anticipar validaciones, pero el BFF decide el estado final.
- La publicacion desde UI se prepara en el draft con una accion explicita. La UI solo marca `isActive=true` e `isVisible=true` si el checklist local de portada, precio base y stock esta completo; la persistencia ocurre siempre al guardar por `POST /admin/product-save-operations` y el BFF conserva la validacion final.
- Las variantes se filtran y se operan masivamente solo dentro del draft de la ficha. Activar/desactivar/mostrar/ocultar variantes filtradas no llama a endpoints propios: se persiste despues con `POST /admin/product-save-operations`, que actualiza variantes persistidas por `PATCH` y no por `DELETE`.
- La pestana `Auditoria` de producto es solo lectura: muestra `productId`, `defaultVariantId`, `mediaCollectionId`, `clientDraftId`, bloques, `operationId`, mensajes, errores, acciones de recuperacion y `correlationIds` ya devueltos por BFF o presentes en el draft.

Listado Admin de productos:

- Las acciones reales disponibles en el listado son editar, previsualizar en el editor local y abrir preview Storefront real. La previsualizacion local usa `/admin/products/:productId?preview=1` y abre el drawer PDP del editor con datos Admin ya hidratados por BFF.
- La preview Storefront usa `/admin/products/:productId/storefront-preview`: es una pantalla Admin `noindex,nofollow`, consulta `GET /storefront/pdp/:productSlug` por BFF desde servidor con `withAuth=false`, y no crea una URL publica indexable de preview. Si Storefront no devuelve PDP, la UI debe mostrar el fallo real y no rellenar con datos Admin como sustituto.
- La seleccion de columnas y los ajustes de tamano de pagina se expresan por query string (`columns`, `limit`, `offset`) para que la vista sea reproducible sin estado cliente paralelo.
- Duplicar producto usa `/admin/products/new?duplicateFrom=:productId`: la UI lee `editor-state` por BFF y abre un borrador nuevo que se guardara por `POST /admin/product-save-operations`. La copia se genera fuera de linea, no visible, sin sitemap, sin aliases, sin media compartida, sin EANs, sin stock vendible, sin ofertas y sin specific prices para evitar duplicidad publica o venta accidental.
- Desactivar producto es la unica accion destructiva disponible mientras `apps/bff` no exponga borrado de producto. La UI exige confirmacion, llama `PATCH /admin/products/:productId` por BFF con `isActive=false` e `isVisible=false`, y despues intenta inactivar canonical y aliases en Routing/SEO con `includeInSitemap=false`.
- Las acciones agrupadas del listado quedan limitadas a desactivacion segura de productos seleccionados. La UI exige confirmacion, reutiliza el mismo flujo BFF de desactivacion individual y no expone borrado masivo, publicacion masiva ni llamadas directas a Catalog.

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

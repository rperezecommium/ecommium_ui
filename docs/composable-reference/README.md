# Referencia local del composable Ecommium para UI

## Recorrido comercial — 2026-11-16

Cambio backend/UI explícitamente autorizado por Ricardo. ADR0318 añade commercialContext persistido y moneda canónica del carrito; Shop defaults no son país de entrega ni sustituyen Checkout.storeContext. Pricing conserva reglas actuales y grupo verificado Sessions ADR0317. Shipping exige peso Catalog y origen/stock reales; métodos exponen provider/environment seguros. Pago/pedido quedan vinculados por snapshot servidor y requieren liquidación + Inventory COMMITTED. Contrato completo sincronizado: `transactional-purchase-commercial-contract.md`. E2E **NO VALIDADO por configuración**, elegido por usuario; no se han aplicado migraciones comerciales ni probado PSP/pedido final con stack modificado. Evidencia: `../qa/commercial-purchase-20261116.md`.

## Transporte por variante — contrato sincronizado 2026-11-11

Revisión y ampliación del composable autorizadas explícitamente por Ricardo.
La variante 0 edita `product.shipping.package`. Las adicionales envían solo
campos propios en `draft.variants[].shippingPackage`; ausencia hereda, cero
es válido y `{}` restaura. BFF resuelve localId a variantId y persiste el mapa
`product.shipping.variantPackages` por UUID. Editor-state recupera ese mapa.
Catálogo valida pertenencia, contexto y medidas enteras no negativas.
Shipping consulta el paquete efectivo canónico para cotización de variantes
reales. Costes, transportistas y plazos siguen siendo del producto.
No requiere migración. ADR backend: ADR-0314.
Evidencia y límites: `../qa/variant-shipping-inheritance-20261111.md`.

## Servicios por variante: confirmación inmediata — 2026-11-11

Una variante admite múltiples servicios. El PUT de asociación BFF devuelve
`offerings` opcional con la lista canónica completa de Pricing; la UI actualiza
la tabla desde esa respuesta. GET/batch usan una proyección y pueden ir
retrasados, por lo que no acreditaban la asociación inmediata. Sin instantánea
confirmada se conserva la tabla previa y se informa del problema. No hay
migración. Evidencia: `../qa/variant-offering-refresh-diagnosis-20261111.md`.

## Gap de registro de atributos de variantes — 2026-11-11

Confirmado en UI: BICI-20260929-173 conserva `size: s` sin atributo size/Talla
en el catálogo visible de Tienda Barcelona. El generador UI crea códigos libres
color/size; las altas de definiciones son explícitas y separadas. El selector
asistido convierte IDs a slugs de nombres, sin garantizar identidad estable.
Pendiente sincronización explícita del contrato BFF para registro/resolución
idempotente y validación de referencias antes de aceptar opciones, además de
auditoría de datos heredados. No se modifica el contrato ni se reconcilian datos
en este diagnóstico. Evidencia, límites y propuesta:
`../qa/variant-attribute-registry-analysis-20261111.md`.

## Gap de guardado de variantes observado — 2026-11-09

La respuesta real de product-save-operations usa recoveryActions con
actionId/block/kind; la UI ahora adapta esos campos a su representación interna.
La clave de idempotencia identifica el comando multipart original: reintento
sin cambios conserva payload/archivos; edición tras fallo parcial reconocido
crea otra clave conservando los IDs confirmados.

Pendiente de sincronización explícita con BFF: fallo de combinación tras crear
variantId, patch de producto inactivo frente a editor-state activo/sin variantes,
listado sin SKU y búsqueda exacta por referencia sin resultado. No se atribuye
causa interna ni se considera rollback/éxito por una lectura desactualizada.
Evidencia, cambios UI, contrato propuesto y gates:
`../qa/variant-save-diagnosis-20261109.md`.

## Objetivo

Editor de productos, 2026-09-29: `editor-state` sin `warehouseId` resuelve el
almacen del contexto comercial del listado Admin. La UI no fija un almacén
alternativo. `prices.product` y `prices.variants` siguen separados: para el
producto simple, el precio de la variante predeterminada se edita manteniendo
su identidad VARIANT. El stock de esa variante se representa una sola vez
en `draft.inventory.stockByVariant.default`.

Contrato import Admin, actualizado 2026-09-29: status puede incluir
`authorizationRefreshPending: true` solo en AWAITING_AUTHORIZATION tras recibir
un token renovado y validado de la misma sesion/tenant. La UI sigue observando sin
reenviar el CSV ni reanudar por su cuenta; BFF verifica permisos en el tick. Un
403, reinicio o cambio de sesion sigue requiriendo resume explicito.

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
- `Consent`: configuración publicada y recibos mínimos de consentimiento para
  cookies, almacenamiento de dispositivo y terceros. No sustituye el
  consentimiento comercial de Customers.

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
- ADR-0155: las credenciales de Employee/Admin se recuperan y cambian por una
  superficie StoreAdmin separada de Customer. `Employees` conserva el estado
  vivo `NORMAL|MUST_CHANGE_PASSWORD`; `Sessions` conserva hashes, tokens y
  entrega de email; BFF es el único borde para UI.

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
- `GET /api/v1/storefront/consent/policy?organizationId=:org&shopId=:shop`
- `POST /api/v1/storefront/consent/decisions?organizationId=:org&shopId=:shop`

### Consent de tecnologías de dispositivo

El banner se comunica con el BFF por la misma origin pública mediante
`/api/v1`. La UI implementa exclusivamente los Route Handlers técnicos
`GET /api/v1/storefront/consent/policy` y
`POST /api/v1/storefront/consent/decisions`: validan contexto/origen, reenvían
solo al Storefront BFF y no contienen lógica de Consent ni llaman a
`services/consent`. Esta terminación same-origin es necesaria para que el BFF
emita y reciba la cookie host-only `ec_consent_subject` sin exponer su valor a
JavaScript.

El proxy reenvía únicamente esa cookie opaca y solo acepta una respuesta
`Set-Cookie` con el mismo nombre, sin atributo `Domain`, `HttpOnly`,
`SameSite=Lax` y, fuera de desarrollo, `Secure`. En producción
`NEXT_PUBLIC_ECOMMIUM_PUBLIC_BASE_URL` debe ser una URL HTTPS sin path ni
credenciales y coincidir exactamente con el host que llega a la UI; no se debe
usar un rewrite genérico, un BFF alterno ni una URL de Consent expuesta al
navegador. Si el proxy, BFF o cookie fallan, la UI mantiene las tecnologías
opcionales bloqueadas.

`GET /storefront/consent/policy` devuelve `AVAILABLE|NOT_CONFIGURED`, el
snapshot publicado localizado, `effectiveLocale`, `localeFallback` y la
decisión vigente solo si corresponde a esa huella. `renewalRequired=true`
significa que el browser debe solicitar una nueva elección para la versión
publicada; `NOT_CONFIGURED` no autoriza recursos opcionales. La UI debe
bloquear servicios opcionales durante carga, error o configuración ausente; la
decisión se registra con `POST /storefront/consent/decisions`. Una versión
obsoleta o selección inválida exige volver a leer la política y mantener el
bloqueo.

El Storefront presenta la primera capa y el centro de preferencias desde ese
snapshot: muestra la acción de rechazo de primera capa solo cuando
`firstLayerRejectAction` lo exige, mantiene bloqueadas las finalidades
necesarias y nunca interpreta cerrar el diálogo como consentimiento. El
contrato actual localiza las finalidades, pero todavía no publica textos ni
apariencia del banner; la UI usa un catálogo de respaldo limitado y no inventa
un esquema de configuración visual. Esa ampliación, si se necesita, debe
partir de Consent/BFF y no de CSS o JSON arbitrario en el navegador.

Para cualquier tercero, Storefront ofrece `StorefrontConsentGate`,
`StorefrontConsentScriptGate`, `StorefrontConsentEmbedGate` y un registry de
adaptadores. Todos niegan por defecto y consumen un `serviceKey` existente del
snapshot publicado. El registry no recibe código, HTML ni URLs desde Admin:
cada proveedor se implementa, revisa y registra en la UI. Un nuevo origen debe
añadirse también de forma explícita a CSP. El registro incluye Google Analytics
y Meta Pixel; Turnstile sigue su flujo propio y al revocarlo se retiran el
widget, script y token.

Al abrir un caso, `customerMessage` es obligatorio: describe lo ocurrido y se
conserva como el primer mensaje del historial. El motivo seleccionado es solo
una categoría; no sustituye ese contexto. El BFF rechaza solicitudes sin texto
con `400 customerMessage is required`.

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

#### Credenciales Admin (ADR-0155, proceso UI 10/12)

StoreAdmin publica exclusivamente estas rutas para la UI Admin:

- `GET /api/v1/admin/auth/password-recovery/availability`, pública y no
  cacheable, respuesta cerrada `{ available: boolean }`. La UI solo muestra la
  recuperación cuando es `true`; no revela cuentas ni entrega de correo.
- `POST /api/v1/admin/auth/password-recovery/request`, pública, body cerrado
  `{ email, locale? }`, respuesta uniforme `202 { accepted: true }`.
- `POST /api/v1/admin/auth/password-recovery/complete`, pública, body cerrado
  `{ token, newPassword }`; no inicia sesión y exige login posterior.
- `POST /api/v1/admin/auth/password/change`, `EMPLOYEE/admin` con step-up,
  body cerrado `{ currentPassword, newPassword, revokeOtherSessions? }`.
- `POST /api/v1/admin/employees/:employeeId/credential-reset?organizationId=:org`,
  SuperAdmin SYSTEM con `system.admin` y step-up. El body solo admite
  `{ locale?, mode?: "INVITATION" | "TEMPORARY_PASSWORD", temporaryPassword? }`.
  La UI usa únicamente `INVITATION`; nunca recibe `principalId`, token, hash ni
  contraseña temporal.

`GET /api/v1/auth/me`, login y refresh pueden devolver
`credentialState=NORMAL|MUST_CHANGE_PASSWORD`. Ante el segundo valor la UI debe
bloquear todo el shell Admin y permitir únicamente `/admin/password`, donde se
reautentica con la contraseña actual y completa el cambio. El BFF mantiene la
autorización final.

La recuperación no guarda el token en JavaScript, `localStorage` ni
`sessionStorage`. El enlace privado debe usar la ruta UI técnica
`/auth/admin/password-recovery/consume?token=...`; esta intercambia la URL por
una cookie HttpOnly firmada, de 15 minutos y limitada al path de recuperación,
aplica `no-store` y redirige al formulario limpio. La URL pública de esa ruta
la configura Sessions/BFF en servidor; no es una variable `NEXT_PUBLIC_*`.

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
- `DELETE /api/v1/admin/cms/pages/:pageId?organizationId=:org&shopId=:shop&locale=:locale`
- `PATCH /api/v1/admin/cms/pages/:pageId/draft?organizationId=:org&shopId=:shop&locale=:locale`
- `POST /api/v1/admin/cms/pages/:pageId/publish?organizationId=:org&shopId=:shop&locale=:locale`
- `POST /api/v1/admin/cms/pages/:pageId/unpublish?organizationId=:org&shopId=:shop&locale=:locale`
- `GET /api/v1/admin/cms/settings/global?organizationId=:org&shopId=:shop&locale=:locale`
- `PATCH /api/v1/admin/cms/settings/global?organizationId=:org&shopId=:shop&locale=:locale`
- `GET /api/v1/admin/cms/font-options?organizationId=:org&shopId=:shop&locale=:locale`
- `GET /api/v1/admin/cms/pages/:pageId/settings?organizationId=:org&shopId=:shop&locale=:locale`
- `PATCH /api/v1/admin/cms/pages/:pageId/settings?organizationId=:org&shopId=:shop&locale=:locale`
- `GET /api/v1/admin/cms/pages/:pageId/resolved-settings?organizationId=:org&shopId=:shop&locale=:locale`

`DELETE /admin/cms/pages/:pageId` exige `cms.pages.write`, devuelve
`{ pageId, deleted: true }` y solo acepta paginas `DRAFT|UNPUBLISHED`. Una
pagina `PUBLISHED` responde `409` hasta despublicarse. CMS desactiva su ruta
canonica retenida, elimina versiones/settings por cascada e invalida cache.
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

### Admin: Consentimiento de tecnologías

- `GET /api/v1/admin/consent/integrations?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/consent/configurations?organizationId=:org&shopId=:shop&scopeType=:scope`
- `POST /api/v1/admin/consent/drafts?organizationId=:org&shopId=:shop`
- `PUT /api/v1/admin/consent/drafts/:configurationVersionId?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/consent/drafts/:configurationVersionId/validate?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/consent/drafts/:configurationVersionId/publish?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/consent/configurations/:configurationId/drafts?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/consent/configurations/:configurationId/deactivate?organizationId=:org&shopId=:shop`
- `DELETE /api/v1/admin/consent/versions/:configurationVersionId?organizationId=:org&shopId=:shop`

La lectura de una configuración devuelve su borrador y publicación propios,
`selectedScope` y `effective`. `effective` indica la versión publicada que se
aplica realmente y su origen: Shop tiene prioridad sobre Grupo de tiendas y
este sobre Organization. Por tanto, que un nivel no tenga publicación propia
no es un error si hereda una configuración efectiva de un nivel superior.

La respuesta incorpora `history` del scope solicitado. Admin presenta las
secciones `Shop`, `Organization` e `Historial`; el historial consulta ambos
scopes. `DELETE /admin/consent/versions/:configurationVersionId` exige
`expectedUpdatedAt` y `consent.configuration.write`, y solo elimina una
versión `SUPERSEDED` sin recibos. La vigente, el borrador y cualquier versión
que respalde evidencia quedan protegidos.

La UI puede crear un nuevo borrador en un nivel sin configuración propia
partiendo de los datos efectivos heredados. Esa copia solo es el punto de
partida del borrador: no modifica el origen ni activa cambios hasta que se
publique en el nivel seleccionado.

Para volver a heredar, la UI envía la confirmación `HEREDAR` a
`POST /admin/consent/configurations/:configurationId/deactivate` con la fecha
de la versión publicada. Solo aparece para una sobrescritura propia activa de
Shop o Grupo: conserva su historial, no modifica el nivel superior y deja que
se aplique la configuración efectiva heredada. Organization no puede heredar.

Certificación UI de la jerarquía: `node --test
tests/consent-configuration-admin.test.mjs` comprueba que la UI acepta una
configuración efectiva cuyo origen sea Organization, Grupo o Shop, y rechaza
una respuesta incompleta en vez de asumir una herencia.

El catálogo de integraciones requiere `consent.configuration.read` y es cerrado:
puede devolver `google-analytics` y `meta-pixel`. Cada entrada define el
proveedor, versión contractual, nombre, descripción, finalidad obligatoria,
tipo de recursos y los campos públicos tipados con ayuda y formato. Google
Analytics exige la finalidad opcional `analytics`, un recurso `SCRIPT` y un
`measurementId` con formato `G-...`; Meta Pixel exige `marketing`, sus recursos
de script/solicitud/píxel/cookie y un `pixelId` numérico de 15 dígitos.

Un borrador declara una integración únicamente dentro de su servicio:
`{ providerKey, contractVersion, enabled, publicConfig }`. `publicConfig`
contiene solo los campos declarados por el catálogo y nunca secretos. La UI
usa siempre las rutas Admin BFF, no llama a Consent directamente, no acepta
scripts/HTML/URLs ni controla header/footer. El BFF y Consent validan de nuevo
el catálogo, finalidad y recursos al guardar/publicar; un proveedor nuevo
requiere adapter Storefront, CSP explícita y revisión de producto, no un campo
de texto adicional en Admin. La pantalla presenta las integraciones como flujo
principal y deja los servicios o recursos manuales en un inventario técnico
avanzado: esos registros no cargan código ni crean o limpian datos del
navegador por sí solos.

Al retirar consentimiento, Storefront mantiene los gates cerrados y ejecuta
solo limpiadores registrados en código. Para Google Analytics la lista es
cerrada: `_ga` y `_ga_<Measurement ID>` con un `Measurement ID` publicado y
validado; Meta Pixel elimina `_fbp` y `_fbc`. Se expiran para el host y dominios
padre explícitos. La UI no borra todo `localStorage`, no enumera cookies, no
recibe claves de limpieza desde Admin y no intenta eliminar datos que el
navegador no puede controlar.

Google Analytics v1 tiene adapter revisado y autorizado: puede cargar una vez
`https://www.googletagmanager.com/gtag/js?id=<Measurement ID>` solo después de
una decisión válida para su servicio Analítica. La CSP admite exclusivamente
ese origen de script y `https://www.google-analytics.com` para sus solicitudes.
El adapter emite solo la configuración y `page_view` estándar, sin User-ID,
eventos ecommerce ni Google Consent Mode. Toda URL genérica, proveedor, versión
o configuración no reconocida falla cerrada antes de crear un nodo `script`.

Meta Pixel v1 tiene adapter revisado: carga
`https://connect.facebook.net/en_US/fbevents.js` solo después de una decisión
vigente de Marketing y emite únicamente `PageView`. No envía compras, emails,
identificadores de cliente, advanced matching ni eventos personalizados. La CSP
permite solo `connect.facebook.net` para el script y `www.facebook.com` para
la solicitud del píxel.

Certificación Consent: las pruebas de navegador interceptan cualquier origen
de proveedor y demuestran cero solicitudes antes de una decisión válida, una
sola carga de Google Analytics y Meta Pixel tras aceptar, y retirada de
scripts/datos propios al retirar el consentimiento. Usa BFF y scripts locales:
no se simula ni se emite tráfico real a terceros. La certificación también
cubre jerarquía, contrato BFF same-origin, rechazo, renovación de versión y
caída de Consent.

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

`Producto > Precio` consume esas mismas listas maestras como selects en
precios especificos y simulador aplicado. Desde 2026-11-13 se retira únicamente
el bloque visual «Contexto avanzado de precio base». Los precios se siguen
editando desde Básico/Variantes; los registros BASE contextuales antiguos
conservan identidad, importe, condiciones, vigencia, zona y prioridad al
guardarse. No se convierten en habituales universales ni se migran datos.
Los valores legacy se muestran como opcion actual si todavia no existen en
`Configuracion > Precios`.

Corrección autorizada de 2026-11-13: el simulador de producto completo evalúa
la variante predeterminada y el específico de producto con la misma precedencia
que la consulta de variante explícita. Las fechas del formulario usan la zona
local del navegador; al reabrir conservan el instante original, incluida la
segunda ocurrencia del cambio horario de Madrid. No se habilitan reducciones
porcentuales. Evidencia y límites: [QA](../qa/product-pricing-editor-20261113.md).

Presentación posterior del mismo día: los precios específicos se muestran en
tabla independiente, con «Agregar precio específico» y edición en panel lateral.
El formulario sigue modificando el borrador; guardar el producto persiste por el
mismo BFF y conserva las mismas condiciones y fechas. [QA de tabla y lateral](../qa/specific-price-drawer-20261113.md).

Vigencia opcional, 2026-11-13: se retira el check «Ilimitado» y ambos campos de
fecha se habilitan independientemente. Vacío equivale a límite ausente;
`unlimited` interno se deriva de la ausencia de final por compatibilidad. El BFF
reenvía `null` explícito para retirar una fecha al editar y conserva omisiones
de clientes antiguos. No cambia el motor de Pricing ni se convierten datos.
[Pruebas y límites](../qa/specific-price-open-dates-20261113.md).

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
- `POST /api/v1/admin/after-sales/cases/:caseId/solution-proposals?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/after-sales/cases/:caseId/solution-execution?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/after-sales/cases/:caseId/solution-completion?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/after-sales/cases/:caseId/solution-finalization?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/after-sales/cases/:caseId/closure-proofs?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/after-sales/cases/:caseId/return-authorizations?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/after-sales/cases/:caseId/refund-requests?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/after-sales/cases/:caseId/inventory-dispositions?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/after-sales/cases/:caseId/document-adjustments?organizationId=:org&shopId=:shop`
- `PATCH /api/v1/admin/after-sales/cases/:caseId/resolve?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/after-sales/tasks/summary?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/after-sales/tasks?organizationId=:org&shopId=:shop&caseId=:optional&taskType=:optional&status=:optional&assignedEmployeeId=:optional&limit=:limit&offset=:offset`
- `DELETE /api/v1/admin/after-sales/tasks/:taskId?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/after-sales/tasks/:taskId/attend?organizationId=:org&shopId=:shop`

Actualización de contrato 2026-08-21: una propuesta no es una resolución
técnica. El detalle de caso puede incluir `solutionProposals[]` con versión,
estado (`PENDING_CUSTOMER|SUPERSEDED|ACCEPTED|REJECTED|EXPIRED`), tipo de
solución, mensaje customer-facing, importe/moneda opcionales, devolución y
vencimiento. La UI no manda un estado libre: inicia revisión, emite propuesta,
inicia ejecución, finaliza solución o cierra mediante las acciones explícitas
anteriores. La primera transición Admin de un caso sin responsable lo asigna
en servidor al empleado de la sesión; «Atender» retira la tarea concreta junto
con esa asignación y la revisión cuando procede. El primer rechazo de una
propuesta crea la alerta de prioridad alta «Propuesta rechazada» y devuelve el
caso a revisión. Una propuesta vencida queda en espera («Invernando») y no
equivale a aceptación.

Al aceptar una propuesta pendiente, el caso entra en resolución y crea la
alerta de prioridad alta «Propuesta aceptada». «Atender» conserva la misma
autoasignación atómica, retira solo ese aviso y abre Ejecución para que el
equipo procese el acuerdo.

Al rechazar una propuesta, su versión y el motivo comunicado por el cliente se
mantienen en el historial. El mismo panel de Propuesta vuelve a mostrar el
formulario para emitir una alternativa como una versión nueva; nunca modifica
ni elimina la oferta rechazada.

La proyección Admin de ejecución muestra únicamente hechos devueltos por el
BFF: propuesta aceptada, resolución interna, recepción de devolución y refund
completado. No calcula en el navegador si los importes, moneda o requisitos son
suficientes para finalizar; el botón posterior delega toda la validación a
`solution-finalization`.

La emisión de propuesta desde Admin envía solo `solutionType`, mensaje para el
cliente, importe/moneda opcionales, condiciones de devolución, vigencia e
idempotencia. Una vez el cliente acepta, «Procesar solución» no incluye
importes, inventario ni decisiones de cierre; «Finalizar solución» añade la
explicación customer-facing, nota interna obligatoria e imagen opcional. Sus
comandos `solution-execution` y `solution-finalization` localizan el acuerdo y
validan el estado completo dentro de After Sales.

La finalización ordinaria usa un solo comando `solution-finalization`: exige
`resolutionReason`, `closureProof.note` e `idempotencyKey`, y admite una imagen
privada opcional `contentBase64` JPEG/PNG/WebP con su idempotencia. No incluye
`resolutionId` del navegador. El BFF deriva el empleado de su sesión, almacena
la imagen en Media privado y After Sales registra solución, prueba y plazo en
la misma operación. `closure-proofs` queda solo para recuperar expedientes
históricos ya resueltos. La respuesta incluye `autoCloseAt`; hasta que la
prueba activa exista, la UI no ofrece cerrar el caso como completado.

Actualización de contrato 2026-08-23: el owner autenticado puede confirmar la
solución recibida mediante `POST /storefront/me/after-sales/cases/:caseId/confirm-completion`.
El body admite solo `{ note?: string }`; BFF y After Sales derivan la resolución
vigente y el cierre `CUSTOMER_CONFIRMED`. La UI no recibe ni envía
`resolutionId`, pruebas internas, evidencias internas ni un motivo de cierre.
Si el caso sigue sin confirmación cuando vence `autoCloseAt`, el worker
controlado de After Sales puede cerrarlo como `AUTO_TIMEOUT`.

La asignación del responsable se ejecuta desde la bandeja de casos y desde la
acción explícita de atención. La cola solo contiene novedades pendientes:
«Atender» usa `POST /admin/after-sales/tasks/:taskId/attend`, deriva el actor
de sesión en BFF, retira esa alerta y asigna el caso libre; si el caso estaba
pendiente, también lo inicia en revisión. El expediente conserva mensajes y
evidencias.

La bandeja Admin abre el detalle y las acciones de un caso en un drawer lateral controlado por
`caseId` en la URL. La UI no navega ni llama directamente a Shipping, Inventory o Invoice: las
mutaciones se realizan únicamente por los endpoints de After Sales. En Storefront, Mi cuenta abre
otro drawer limitado a la solicitud inicial.

El drawer Admin prioriza el recorrido humano en cuatro secciones: **Caso**,
**Propuesta**, **Ejecución** e **Historial**. Los enlaces antiguos de `operacion`,
`devolucion`, `resolucion` y `auditoria` se traducen a la sección equivalente para no
romper accesos guardados. La cola operativa y sus alertas se mantienen sin cambios;
las operaciones técnicas de expedientes históricos solo aparecen agrupadas durante su
ejecución.

La cola operativa de Postventa se consume solo mediante StoreAdmin BFF. El
resumen devuelve `{ pendingCount, openCount, assignedCount }` para el badge
del shell Admin. Las tareas solo exponen referencias técnicas, tipo, estado,
prioridad, responsable y fechas; nunca texto de cliente, URLs privadas ni
binarios. La bandeja permite filtrar y abrir el mismo drawer URL-driven con
`caseId`; `CUSTOMER_MESSAGE` y `EVIDENCE_REVIEW` añaden
respectivamente `caseFocus=message|evidence` como estado de presentación, no
como autorización. El BFF deriva el actor de la sesión Employee y no acepta
esos campos desde la UI. `SOLUTION_PROPOSAL_REJECTED` abre el caso en la
sección Propuesta para revisar y emitir una alternativa.

La interfaz presenta estos avisos como «Caso nuevo», «Mensaje del cliente» y
«Evidencia pendiente». «Atender» reconoce únicamente la alerta seleccionada,
abre su mismo caso y conserva el foco de conversación o evidencia. En
Storefront, el detalle muestra la propuesta activa y permite al owner elegir
«Aceptar propuesta» o «Rechazar» por
`PATCH /storefront/me/after-sales/cases/:caseId/solution-proposals/:proposalId/response`.
Una propuesta vencida se presenta como «Propuesta en espera», sin aceptar por
silencio ni exponer controles técnicos.
Tras cualquier mutación de Postventa se revalida también el layout Admin para
actualizar el contador lateral sin una navegación adicional.

El permiso `admin:after-sales:view` permite consultar casos, cola e historial
en modo lectura. Solo `after-sales.manage` habilita asignación, atención de
alertas, mensajes y acciones de propuesta/ejecución. Los errores del BFF se
vuelven a la URL como aviso público de error; la UI no muestra detalles internos
ni los presenta como una confirmación satisfactoria.

El flujo completo de validación manual, automatizada, despliegue y reversión
está en [after-sales-admin-workflow.md](./after-sales-admin-workflow.md).

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

## Bloque 4 — contrato PLP compacto experimental

Opt-in server-side `ECOMMIUM_STOREFRONT_PLP_CARDS_ENABLED=true` añade `view=cards`
a la petición PLP. El BFF debe habilitar el scope y contexto exactos. Sin flag
se mantiene v1; no hay fallback automático si falla cards. Respuesta mínima
validada: producto/variante, nombre, marca, imagen, precio actual/anterior, stock,
enlace, total/página y CMS. Categoría desconocida o sin productos accesibles
devuelve 200 vacío en cards; v1 conserva su contrato.

Backend: ADR-0189, **BLOQUE 4 PERFORMANCE: PASS por aceptación explícita del usuario**
(2026-09-09). 500 VU caliente: ReadIndex p95 55,1 ms, OLD 46,8 ms; margen
aceptado +10 ms y límite 56,8 ms. El FAIL automático original de 51,8 ms se
conserva en la evidencia backend. Cobertura real 12/40; restantes sin ejecutar.
Sin despliegue en esta aceptación. El flag sigue desactivado por defecto. No cambia PDP, búsqueda, Admin ni Checkout.


## Newsletter del home (MVP local, 2026-10-02)

El módulo existente usa `newsletterForm`, editable mediante Builder, con partes
email/consent/privacy/feedback y estilos declarativos. El storefront recibe la
política vigente desde Consent a través de BFF. Server Actions validan payload,
contexto canónico y origen; nunca aceptan URLs de destino del visitante.
Confirmación y baja requieren acción explícita, retiran fragmentos y no guardan
tokens en storage. Admin publica políticas versionadas desde
`/admin/configuracion/consent/newsletter`, con permisos BFF.

Pruebas: `node --test tests/newsletter.test.mjs`, `npm run lint`, `npm run build`.
Flujo local certificado: home → Mailpit (`http://localhost:8025`) → confirmación
→ baja; sin campañas externas. Privacidad de pruebas, retención y despliegue
productivo pendientes. Arranque backend: `./scripts/postman-services.sh`
en el repositorio composable_ecommerce; UI: `npm run dev`.


## Sincronización explícita O15 — 2026-10-21

Integración entre repositorios autorizada por Ricardo en entregas1–7. ShopStatus
vigente del servicio Organizations-Shops es ACTIVE|INACTIVE. El formulario UI
ofrecía DRAFT/DISABLED y fallaba contra el servicio real; se alinea con ese
contrato sin modificar backend. Crear usa INACTIVE por defecto para conservar
la intención de no publicar; el operador puede elegir ACTIVE expresamente.
Web y API se separan por host en perfil SEPARATED_V1; DTOs y guardas BFF siguen
vigentes. ADR-0303 y plan20 residen en .docs del composable.


2026-10-22 — O10 continuidad manual PO1–6 (ADR-0307): infraestructura y stack
preceden al alta humana; no se debe exigir Organization/Shop/Storefront para
arrancar exclusivamente Admin. El perfil ADMIN es opt-in, valida origen/BFF y
sesión y rechaza rutas Storefront. PO no recibe correo, contraseña ni claim:
enlaza a `/admin/installation` después del PASS; tras COMPLETED enlaza a login.
No cambia contratos comerciales ni certifica MFA/DNS/despliegue público.

Evaluación de esa continuidad1–6: **Cerrado local**, dos recorridos12/12 PASS
con formulario y Admin BFF reales; sesión y login nuevo conservados tras
reiniciar web/backend. Cero organizaciones/tiendas creadas por Admin0.
Validación UI:45 pruebas focalizadas, build y lint PASS. Se conservan los gates
productivos existentes del plan19 y los hallazgos de seguridad ajenos.

2026-10-23 — Invitación Admin0 (ADR-0308, En curso): cambio explícitamente
autorizado por Ricardo. Se reutiliza fresh-completion con claim/email/password;
Employees vincula el código al destinatario y consume el bootstrap SYSTEM
atómicamente. El formulario explica la invitación y no exige terminal al
destinatario. La emisión/entrega de laboratorio pertenece a PO; la UI comercial
no emite ni recupera códigos. Validación integrada pendiente.

2026-10-23 — ADR-0308, invitación visual Admin0 Cerrado local: trece controles
PASS en el backend canónico, recorrido PO → mensaje SIMULADO → formulario real
→ login SYSTEM → reinicio. Employees comprueba el destinatario y consume la
invitación atómicamente. Copy del formulario y errores habla de código temporal;
correo/contraseña sólo pasan por Admin BFF. Build ADMIN y lint focalizado PASS.
No cambia permisos SYSTEM ni contratos de fresh-completion, no añade SMTP ni
habilita Live. Evidencia: composable_ecommerce/.docs/08-roadmap/evidence/platform-admin-zero-invitation-local.json.

## Continuidad de alta manual y dominios — 2026-10-23

ADR-0309 del backend: la primera Organization de un stack vacío puede conservar
un UUID reservado por configuración del owner; la UI no lo inventa ni cambia el
contrato de creación. Crear/editar Shop incluye `adminDomain` opcional, además de
`primaryDomain`, mediante el mismo Admin BFF. Esos nombres se conservan al revisar
las cuatro direcciones en PO. La incorporación a PO y aprobación/START son
explícitas; crear una Shop no acredita que su web esté desplegada.


### Corrección UI Pricing — 2026-10-30

La carga simultánea de todos los paneles de Precios, aunque no estuvieran
seleccionados, excedía la admisión por tenant de Commerce ReadIndex y causaba
`503 READ_INDEX_BUSY`. Reproducción local: nueve consultas técnicas concurrentes,
cuatro correctas y cinco rechazadas; impuestos consultado solo devolvió cinco
registros. El fallo no demuestra falta de permisos del empleado.

La UI carga únicamente el resultado de la pestaña seleccionada y las listas
para filtros; difiere las tareas y limita cada carga a dos consultas en vuelo.
El editor de producto reutiliza esa carga acotada para sus listas de Pricing.
No hay retry, fallback al owner, ampliación del pool ni cambios de permisos o
contratos BFF. Los errores de carga ya no se presentan como cero registros ni
como ausencia de impuestos. Regresión: `node --test tests/pricing-admin.test.mjs`.


Validación de la corrección: 12 regresiones PASS y build PASS. Controlador HTTP
BFF aislado con guardias de permisos reales, identidad de prueba y conexión
real a ReadIndex/PostgreSQL: 35 consultas, todas HTTP 200, máximo dos en vuelo.
Impuestos: cinco registros; tablas: seis; parámetros: dos grupos; pipeline: tres.
Las seis listas del editor se cargaron sin warnings. No se reutilizaron sesiones
humanas ni se hicieron escrituras. Esta prueba no certifica la sesión del
navegador de Ricardo ni producción. Lint focalizado sin errores ni advertencias;
el lint general conserva tres advertencias preexistentes fuera de este cambio.


### Transporte — patrón visual de Equipo, 2026-10-30

Zonas, Transportistas, Servicios y Reglas de tarifa reutilizan los estilos de
Equipo: fondo neutro, listados sin tarjeta o título duplicado, cabecera gris y
celdas 5px × 8px. La acción Crear se sitúa a la derecha, como enlace subrayado,
a 6px de la lista. Editar/guardar usa azul suave, activar verde y desactivar
ámbar. Se conservan los formularios y acciones BFF existentes.

El contenedor lateral de Transporte admite Escape, cierre por fondo, foco
inicial y Tab contenido, bloqueo del scroll y restauración de foco al cerrar.
Validación: build PASS, 11 pruebas `tests/shipping-admin.test.mjs` PASS y lint
sin errores con tres advertencias preexistentes ajenas al cambio. Pendiente
verificación visual e interacción con la sesión real en navegador.


2026-10-30 — Transporte retira «Incluir inactivos», su filtro y la propagación
de `includeInactive` por URL o formularios. La configuración BFF solo devuelve
recursos activos; el parámetro retirado provoca HTTP 400. Desactivar retira el
recurso del listado y no permite reactivarlo desde esa pantalla. La validación
y gestión privadas de Shipping conservan los inactivos cuando los necesitan.


2026-10-30 — SEO reutiliza el patrón de Equipo en Rutas, Redirects y Sitemap:
superficie neutra, listas sin tarjeta ni encabezado duplicado, cabecera gris,
celdas compactas y acciones suaves. Crear ruta/redirect son enlaces azules
subrayados alineados a la derecha, a 6px del listado. Transporte y SEO comparten
un contenedor lateral técnico con Escape, cierre por fondo y control del foco;
los formularios, filtros, permisos y contratos BFF permanecen operativos.
Revisión: `npm run dev` → Configuración → SEO; backend con el script canónico
`./scripts/postman-services.sh up` desde el repositorio composable.


2026-10-30 — El bloque de importación CSV de productos vive en
`/admin/catalogo/importar`, accesible desde Catálogo → Importar, debajo de Stock.
Productos deja de montar el importador. Se reutiliza el mismo componente,
contexto y carga de categorías; se conservan los endpoints BFF y la recuperación
del trabajo por tenant. La nueva pantalla exige contexto antes de montar el
formulario. Revisión manual: `npm run dev` → Catálogo → Importar; backend
con `./scripts/postman-services.sh up` desde composable.


### Preparación de lectura de tiendas (2026-11-04)

El BFF incorpora `GET` y `POST /admin/organizations-shops/shops/:shopId/read-preparation`
con Organization/Shop y contexto explícito (`locale`, `currency`, `country`, `channel`).
GET exige `organizations-shops.read`; POST exige `organizations-shops.manage` y
acepta únicamente `{ "retry": true|false }`. Ambos conservan permisos y alcance tenant.
La respuesta expone `requestId`, `organizationId`, `shopId`, `state`, `phase`,
`attempts`, `updatedAt`, `code` y `context`; los estados son PENDING/RUNNING/READY/FAILED/BLOCKED.
Crear tienda solicita la preparación después de guardar su identidad comercial:
un fallo técnico no invalida el alta ni obliga a repetirla.
La composición local requiere un coordinador privado de Platform Operations;
sin adapter autorizado devuelve BLOCKED. La UI solo consulta/ordena por BFF;
no accede a recursos, fuentes, SQL ni credenciales de infraestructura.
Configuración > Contexto muestra estado y reintento con permiso de gestión.


### Altas Admin: categorías, marcas y configuración de pagos (2026-11-04)

Contrastos verificados contra BFF real, sin modificar servicios de dominio:

- Categoría POST `/admin/categories`: `name`, `slug`, `title`, `description`,
  `keywords` no vacíos y `isActive` booleano. Organization/Shop/locale via contexto.
- Marca POST `/admin/brands`: `name`, `text`, `siteTitle`, `keywords` no vacíos e
  `isActive`. No envía slug ni campos de categoría.
- Método POST `/admin/payments/payment-systems`: `paymentSystemId`, `name`,
  `group`, `type`, `active`, `supportsInstallments`; `maxInstallments` entero
  positivo cuando se permiten cuotas. No envía provider/groupName/methodType.
- Afiliación POST `/admin/payments/affiliations`: `affiliationId`, `name`,
  `providerName`, `merchantId`, `active`. No sustituir providerName por provider.
- Regla POST `/admin/payments/rules`: identificadores, `name`, `priority`,
  `country`, `currency`, `minValueMinor`, `maxValueMinor`, `active`; canal opcional.
  Importes/priority enteros no negativos, máximo >= mínimo o null sin máximo.

Gap sincronizado con autorización explícita de Ricardo: el BFF descartaba
`includeInactive`; ahora lo propaga en métodos/afiliaciones/reglas. ReadIndex ya
admitía el campo: no se cambió su implementación. Default false; true permite
listar/seleccionar registros inactivos; valor inválido devuelve 400.

Las cinco altas muestran errores y conservan campos tras rechazo; solo anuncian
éxito tras aceptación y respuesta validada. Pagos crea inactivo por defecto y
pide confirmación si se elige activar. Las pruebas reales usaron solo registros
QA inactivos, sin transacciones ni PSP. Ver `../qa/form-create-contracts-20261104.md`.


### Sesión y permisos Admin (2026-11-04)

La UI usa auth/me como snapshot de permisos/roles/credentialState por render;
arrays vacíos revocan el snapshot previo y no recuperan permisos del JWT/login.
Equipo distingue employees.manage de employees.security; Payments configuración
usa payments.configuration.read/write. La cookie conserva transporte HttpOnly,
pero no sustituye al BFF para decidir autorización. Tras password_changed con
sesión retenida se verifica auth/me y se persiste NORMAL; si es necesario se
renuevan tokens y se reintenta. Si no se confirma estado/identidad, se pide login.
RSC deriva renovación de cookie a una ruta técnica UI, sin backend paralelo.
Evidencia: `../qa/admin-permissions-session-20261104.md`.

### Indicador de salud (2026-11-04)

La UI exige estado explícito ok/healthy sin señales de fallo. Un HTTP 200 con
error/readiness falsa no es OK. Respuestas vacías o solo configuración quedan
Sin confirmar. Search devuelve actualmente configuración sin estado operativo;
no se infiere disponibilidad de esos campos. Sin cambio de contrato backend.
Evidencia: `../qa/admin-health-indicator-20261104.md`.

### Subidas CMS/Media (2026-11-04)

Create collection y append items conservan400 del owner para imágenes corruptas
y validación rechazada; indisponibilidad conserva503. Media decodifica antes de
almacenar y compensa fallos capturados posteriores. CMS vacío en locale sin
contenido devuelve listas vacías200 y settings INITIAL.
Evidencia y límites: `../qa/cms-media-validation-20261104.md`.

### Preparación integrada en el alta UI (2026-11-05)

La pestaña Contexto deja de montar el panel y de consultar periódicamente su
estado. Tras crear una Shop, la UI abre el paso «Completar el alta de la tienda»
en Crear tienda, con la identidad devuelta por el BFF, incluso si no se marca
como contexto activo. Este paso conserva seguimiento y reintento explícito sin
repetir el POST de alta. Editar tienda conserva el acceso a recuperación para
una tienda existente. Cada consulta/reintento con destino explícito resuelve
su contexto efectivo mediante BFF; no utiliza los valores regionales de otra
tienda ni modifica la selección activa.

Verificación autorizada del código backend: el alta solicita preparación y
existe entrega durable; el coordinador reanuda PENDING/RUNNING tras reinicio,
pero FAILED exige retry explícito. Por ello no se elimina esa capacidad ni se
introducen reintentos automáticos en la UI. No cambia el contrato BFF.
Evidencia y límites: `docs/qa/shop-creation-preparation-20261105.md`.

### Seguridad personal dentro de Equipo (2026-11-05)

La UI reúne dispositivos, cambio de contraseña propia y step-up en
`/admin/configuracion/equipo?tab=security`. Los formularios se abren en paneles
laterales mediante `securityDrawer=password|step-up`. La ruta anterior de
Seguridad es solo una redirección compatible que conserva avisos/errores; no se
alteran endpoints BFF, autorización, refresh ni flujos de credencial obligatoria.
No se exige gestionar empleados para acceder a la seguridad personal. Evidencia:
`docs/qa/team-security-20261105.md`.

### Creación de características: confirmación y lectura — 2026-11-06

Contraste autorizado en lectura con backend y prueba PW real: POST
`/admin/specifications/groups` devuelve el grupo canónico; las lecturas Admin
correspondientes se apoyan en ReadIndex. Una respuesta de alta válida no garantiza
que la siguiente lectura del listado ya incluya el campo. La UI conserva datos y
muestra el fallo ante rechazo; tras confirmación distingue el registro ya visible
del que aún no está en el listado, sin repetir el POST ni sustituir la proyección.
La tienda Barcelona presentó confirmación de alta y lectura desactualizada; la
causa operativa y la sincronización ReadIndex siguen pendientes. Evidencia,
alcance y comandos: `docs/qa/catalog-feature-create-20261106.md`.

## Sincronización autorizada del editor — 2026-11-06

Consulta de backend y correcciones autorizadas expresamente por Ricardo. El BFF
resuelve warehouseId ausente del draft con el contexto comercial; editor-state
entrega cantidades onHand/reserved/safety/available desde ReadIndex. Preview de
Pricing admite quantity/priceTableId, evalúa tramos/vigencia/contexto/impuestos y
conserva el precio de defaultVariant para producto simple importado. Media items
admite metadataDirty opcional para guardar captions/portada/actividad de assets
persistidos; se limpia tras confirmación. Estado SEO inactivo debe conservarse en
el draftPatch tras creación. Guardado confirmado no implica proyección actualizada.
Evidencia: `../qa/product-editor-repair-20261106.md`.

### Grupos de características por categoría — 2026-11-06

La UI conserva categoryId/linkedCategoryIds del grupo al preparar los lookups del
producto. La sugerencia de grupos usa esos vínculos explícitos, sin herencia
inventada. Compartir un grupo usa PATCH BFF de especificaciones conservando los
campos y relaciones previos. Nuevas definiciones y valores se incorporan al editor
solo tras confirmación del BFF; no guardan automáticamente el producto. Los campos
SKU/inactivos no se convierten en descriptivos. Sin contratos backend nuevos.
Ver `../qa/product-feature-flow-20261106.md`.

### Baja de características y lectura pendiente — 2026-11-07

PATCH de especificaciones confirmó isActive=false para las tres características
QA PW 20261106 de Tienda Barcelona; GET sigue mostrándolas activas. La UI exige
confirmación del estado y avisa de lectura pendiente, sin ocultar datos ni
repetir mutaciones al refrescar. La convergencia y limpieza visible no están
certificadas; se solicita autorización de sincronización backend conforme a
AGENTS.md. Evidencia: `../qa/catalog-feature-cleanup-20261107.md`.

Cierre2026-11-07 tras autorización explícita: causa local confirmada, relay Catalog
y consumidor ReadIndex detenidos; recuperación con custodia existente, sin parche
backend. UI/BFF: cero QA activas, tres QA inactivas y ficha técnica de bicicletas
sin grupos de prueba. Baja lógica verificada; no eliminación física. Los workers
recuperados quedan activos; pendientes históricos globales conservados. Evidencia:
`../qa/catalog-feature-cleanup-20261107.md`.

### Desactivación revisada de características — 2026-11-07

Sincronización backend autorizada: GET
`/admin/specifications/groups/:groupId/fields/:fieldId/deactivation-impact` y POST
`.../deactivate` con expectedVersion. Resumen canónico, preservación de asignaciones,
permiso sobre todos los scopes compartidos y revalidación transaccional. La baja
ya no se envía por PATCH genérico; UI comprueba la convergencia por el detalle
ReadIndex existente. Contrato backend47 y Postman alineados. Pruebas/evidencia:
`../qa/feature-deactivation-20261107.md`.

2026-11-07 — Eliminación permanente individual de características implementada en UI/backend autorizado: permiso `catalog.specifications.delete`, revisión canónica destructiva, operación durable con auditoría/targets/outbox, retry de sincronización y comprobación de productos/definiciones en todos los contextos activos ReadIndex. Capacidad opt-in en BFF, oculta hasta migrar/habilitar Catalog. Catalog actual usa Neon aunque API sea local; activación real pendiente de aprobación del destino. Contrato backend48 y [QA y límites](../qa/feature-deletion-20261107.md). Complementa la desactivación; no cambia su preservación de asignaciones ni autoriza borrar grupos.

2026-11-07 — Activación posterior autorizada: migración aditiva Catalog/Neon e índice RI en4 schemas aplicados, opt-in habilitado, API/worker/BFF/Employees recargados. UI Employee abre/cancela revisión desde listado/formulario, sin eliminación real. El consumidor recupera también referencias obsoletas del índice y contextos activos adicionales del scope; BFF admite seguimiento multicontexto. Se conservan pendientes históricos ajenos. Véase sección Activación completada de [QA](../qa/feature-deletion-20261107.md) y contrato48.


### Cierre local autorizado de BFF/ReadIndex — 2026-11-09

Se resolvieron los gaps pendientes descritos anteriormente: runtime de proyección detenido, duplicación de opciones sin ID, desactivación durante guardado parcial y búsqueda sin SKU. Playwright real confirma BICI-20260929-172 en listado por SKU padre/variante, reapertura y segundo guardado sin duplicar, PDP con selección QA, imagen cargada, stock1 y precio4196,12 EUR. Se reutilizó la variante existente; no se creó otra. Backend: 52 pruebas BFF +14 ReadIndex +3 runtime PASS y builds BFF/ReadIndex PASS. Evidencia detallada en composable_ecommerce/.docs/qa/variant-publication-recovery-20261109.md. Sin nueva certificación de Lighthouse/a11y/checkout ni despliegue productivo.


### Sincronización autorizada de eliminación — 2026-11-09

Ricardo autoriza el contrato nuevo de eliminación revisada de variantes y lo amplía a producto completo, Routing/SEO y sitemap. Contrato local: [variant-deletion-gap-20261109.md](../contracts/variant-deletion-gap-20261109.md); espejo backend contrato49 y ADR-0313. Propuesto/autorizado no significa implementado: los endpoints de coordinación siguen pendientes y no deben sustituirse por DELETE soft de Catalog. La UI actual no sirve XML público de sitemap; se conserva este gap en el alcance de la implementación. No se han eliminado productos, variantes ni recursos con esta ampliación.


## Eliminación revisada — 2026-11-09

Implementación y pruebas locales: [evidencia](../qa/catalog-retirement-20261109.md). Activación pendiente de autorización para seis migraciones remotas; ninguna aplicada. Validación de permiso/contexto y rechazo de identidad de borrador remoto incompatible añadidos. Los hallazgos de seguridad pendientes existentes permanecen abiertos.


Actualización 2026-11-09: autorización remota recibida, seis migraciones APPLIED y flags locales activos. Playwright real completó eliminación de variante y producto QA; BICI-20260929-172 preservado. Evidencia: catalog-retirement-20261109.md en QA. Sustituye el estado previo de activación bloqueada.

### Actualización autorizada: eliminación asíncrona (2026-11-09)

Confirmación BFF devuelve202 con `asynchronous:true`, `operationId`, `status:PENDING`, tras persistir y retirar lógicamente en Catalog. UI cierra el modal y retira fila/editor; seguimiento existente consulta GET sin avanzar pasos. Worker Catalog independiente reutiliza los quince pasos, Rabbit/outbox y recibos persistentes. BLOCKED exige revisión y no es éxito. Registro final en Log existente. Nueva migración aditiva Catalog remota todavía PENDING; async no está activado en ese entorno. Las seis migraciones anteriores y el modo síncrono ya activo no sustituyen este requisito. Contrato canónico49 del backend y evidencia QA describen flags, scope, recuperación y límites.

2026-11-09 — Activación asíncrona autorizada por Ricardo: migración adicional Catalog APPLIED, worker integrado al supervisor existente y pruebas Playwright conectadas de variante/producto, cierre de navegador y reinicios PASS. Tres operaciones QA COMPLETED; seis owner proofs correctos; ReadIndex dos contextos/remaining0; Log verificable; original y tres miniaturas Google404; PDP404/noindex y sitemap sin QA. Se corrigieron prefijos internos faltantes de Pricing/Media y preflight404 durante PENDING. BICI preservado. Sustituye el estado previo PENDING de activación; no certifica producción/CDN ni recuperación Search entre hosts. Evidencia: QA catalog-retirement-20261109. Los pendientes de seguridad ajenos permanecen abiertos.

## UI de asignación de imágenes de variantes — 2026-11-10

La UI separa colección de imágenes y asignaciones: no elige la primera imagen
subida como portada. Portada activa única = imagen de variante 0; las adicionales
sin override activo heredan esa imagen. Desactivar una imagen propia limpia su
asignación. Cambiar portada no copia asignaciones a las variantes herederas.
Se reutiliza el draft de POST /admin/product-save-operations, normalizando las
claves default/defaultVariantId y localId/variantId. Sin endpoints nuevos.
Mapa de conexiones, reglas y comprobaciones BFF pendientes:
`../product-variant-images.md`. El guardado real contra BFF aún debe confirmar
que no materializa la herencia como override ni fuerza portada al crear colección.

## Editor de variante seleccionada y gap de opciones default — 2026-11-10

Tabla compacta y paneles por selección, catálogo de atributos habituales creado
solo por acción explícita vía BFF. No hay slugs por variante en el draft actual;
la PDP selecciona variantId sin cambiar la ruta pública del producto.

Pendiente de sincronización explícita: admitir atributos en variante 0 requiere
contrato para defaultVariant.options, persistencia por defaultVariantId,
rehidratación y validación de combinaciones únicas. La UI no envía esa propiedad
no documentada ni presenta como guardable una asignación que se perdería.
Análisis, distribución, permisos de altas y pruebas: `../product-variants-workflow.md`.



## Inventario integrado y almacenes — 2026-11-11

- `GET /api/v1/admin/shipping/warehouses?organizationId&shopId&includeInactive=true|false`: `{warehouses:[{warehouseId,name,dockId,countries,active}]}`, máximo 500 ordenados por nombre. Employee + catalog.products.read. Metadatos canónicos del propietario, no proyección eventual.
- `PUT /api/v1/admin/shipping/warehouses?organizationId&shopId`: `{warehouse:{warehouseId?,name,dockId,countries:["ES"],active?}}` -> `{warehouse}`. Employee + shipping.logistics.write. Identidad generada si se omite, upsert scoped si se proporciona. Nombre/muelle obligatorios (máx. 200), países ISO alpha-2, active booleano. La creación se gestiona en Configuración → Transporte; el editor de producto selecciona almacenes existentes y no ofrece alta ni eliminación.
- `GET /api/v1/admin/inventory/stock-levels?organizationId&shopId&variantId&warehouseId`: `{stockLevel: registro|null}`. Employee + catalog.products.read; cantidades exactas del propietario Inventory, sin fallback a otro almacén. No modifica datos.
- El draft marca `readOnlySelection:true` al consultar otro almacén. El bloque inventory omite esas entradas. Editar cantidades lo cambia a false; el guardado confirmado marca persisted:true y availabilityEstimated:false. Los campos son metadata de orquestación UI, no nuevos campos del agregado Inventory.
- Selector y editor mantienen un almacén por variante a la vez; cambiar no traslada existencias. Campos pendientes bloquean el cambio hasta guardar. Tras reabrir, el contexto comercial determina la selección inicial.
- Restaurar stock propio ya persistido sigue sin contrato de retirada y no se promete desde UI. La disponibilidad durante edición es estimada; después del guardado/lectura se usa la confirmada.

Decisión: ADR-0315. Migración compatible shipping_warehouses aplicada en la base configurada con autorización explícita; sin despliegue remoto de servicios.

QA: `../qa/product-inventory-integration-20261111.md`.


## Correcciones controladas del editor — 2026-11-12

Contrato sincronizado con BFF/Pricing/ReadIndex dentro de la implementación autorizada: las mutaciones de relaciones devuelven snapshot `offerings` opcional del primario, con `relationActive` separado del `active` global; includeInactive conserva relaciones inactivas en Admin. ReadIndex busca `localizedName[].value`. El guardado declara HTML explícito para descripción; no cambia el formato por defecto de Catalog. Detalle de producto ausente es404 si la generación está preparada y503 si no lo está. La UI resuelve marca asignada por ID, permite búsqueda/paginación y recuperación fiscal sin perder borrador. No hay migración ni backend paralelo. Evidencia, comandos y límites: [auditoría actualizada](../qa/products-audit-20261111.md#correcciones-controladas-2026-11-12).

Rectificación de alcance del 2026-11-12: se retiraron los dos campos de búsqueda añadidos bajo Categoría/Marca. Se conservan los desplegables y la resolución por ID de la marca asignada, incluso si está fuera del lote inicial. No se añaden controles alternativos.


## Grupo comercial manual en perfil Customer — 2026-11-12

Sincronización explícita con ADR-0317/contrato50 del backend, dentro de los pasos1–5 autorizados. El administrador asigna un único groupCode al crear/editar el perfil; no se calcula VIP por compras ni se trata como rol de acceso.

GET `/admin/customers/:customerId/commercial-membership?organizationId&shopId` devuelve grupo, aprobación B2B, buyerType y revisión canónicos. POST/PATCH de cliente aceptan `commercialMembership:{groupCode:string|null,b2bApproved:boolean,expectedRevision:number,reason:string}`; perfil/grupo/auditoría se confirman en una transacción del owner. El actor lo establece BFF. Conflictos de revisión:409 sin guardado parcial.

Las opciones del selector proceden de `/admin/pricing/customer-groups`, solo grupos activos. La asignación requiere el permiso vigente de edición de perfil `customers.addresses.write`; la lectura usa `customers.read`. El registro Storefront no concede grupos privilegiados. Error de lectura del grupo impide enviarlo/modificarlo y se informa; no se sustituye por otro grupo. El tipo comprador del formulario se toma del mismo snapshot canónico cuando está disponible para no mezclarlo con un perfil proyectado anterior.

Para que los precios consuman la pertenencia se requieren las migraciones aditivas Customers/Sessions, política del scope y flags coordinados BFF/Checkout del contrato50. La UI no contiene tokens internos ni llama a owners. Las pruebas aisladas no activan el entorno comercial existente.

Las lecturas públicas personalizadas requieren también `ECOMMIUM_UI_VERIFIED_COMMERCIAL_CONTEXT_ENABLED=true`, coordinado con BFF/Checkout. Solo se reenvía el bearer Customer, con fetch no-store y x-commercial-context-required. PLP autenticada usa la lectura canónica, sin cards de invitados. Validación final y límites: `../qa/customer-commercial-segmentation-20261112.md`.


2026-11-16 — Selección de política comercial por despliegue canónico (sin default implícito), filtrado de moneda Shipping, reintentos Orders sobre snapshot histórico tras verificar propietario e Inventory sale commit transaccional. Autorización expresa del usuario para default en esta tienda y datos sandbox simulados. La prueba pagada10050 reveló reservas duplicadas; corrección SQL aislada PASS y segundo E2E pendiente de aprobación PayPal. No declarar éxito integral. Ver `../qa/paypal-purchase-resumption-20261116.md`.


Actualización final de compra sandbox2026-11-16:10052 VALIDADO con datos simulados, captura/pedido/reserva únicos, stock1→0, snapshot pagado conservado y reintentos sin duplicados. UI rota al nuevo carrito sin borrar el pagado;409 de pedido no es éxito. BFF soporta el DTO GET Orders plano real. Evidencias y límites históricos en `../qa/paypal-purchase-resumption-20261116.md`; no cierra Stripe ni compra invitada completa.


## PLP y política comercial explícita — 2026-11-16

La vista compacta cards no admite tradePolicy/priceTableId/customerGroup. Se resuelve la política de despliegue antes de elegir la vista; con selección comercial explícita se usa PLP completo conservando esa selección. BFF real rechaza cards+tradePolicy con403 PLP_CARDS_PRIVATE_CONTEXT_UNSUPPORTED. No se elimina política ni se realiza fallback tras un rechazo. Validación: `../qa/category-listing-policy-20261116.md`.

## Precio normal y reglas específicas — sincronización 2026-11-16

[Contrato local actualizado](regular-and-specific-prices-contract.md): ADR-0316 reutilizado, normal sin política obligatoria, específicos opcionales, moneda explícita y guardado conservador de legacy. No se añaden endpoints ni lógica de dominio a Next. Migración exacta de1.211 BASE autorizada y E2E10055/10056 verificados; [QA](../qa/regular-pricing-20261116.md).

## PDP: selectores por atributo — 2026-11-16

La UI agrupa `variants[].options` por `attributeCode`, con botones por `valueCode` debajo de la combinación seleccionada. Reutiliza la selección de miniaturas y solo elige combinaciones existentes; no requiere cambios BFF ni datos comerciales nuevos. Los agotados conservan la restricción actual de miniaturas. Compartido con preview Admin. Evidencia: [QA](../qa/pdp-variant-options-20261116.md).

## Postventa: recuperación operativa — 2026-11-16

Sin cambios de contrato: After Sales conserva casos/tareas y BFF lee Admin desde ReadIndex. El arranque canónico ahora incluye los relays After Sales/Communications; nueva migración corrige persistencia de intentos Communications. Caso y dos avisos verificados tras reinicio completo; no calcular el testigo inventando tareas desde casos. El correo original ambiguo sigue pendiente de confirmación, sin reenvío. [Evidencia](../qa/after-sales-recovery-20261116.md).

### Impuestos: eliminación definitiva sincronizada — 2026-11-17

Con autorización explícita de Ricardo se verificó que DELETE taxes solo da de
baja el maestro. Se añade DELETE
`/api/v1/admin/pricing/taxes/:taxCode/permanent?organizationId=:org&shopId=:shop&detachPrices=true`,
Employee + pricing.admin.write y scope autorizado. Sin acuse400; endpoint viejo
no es fallback. Pricing elimina la definición y retira tax_json/tax_included en
los Price asignados del scope, conserva importes guardados y bloquea reasignación
del código con tombstone. No altera pedidos/facturas ni otros owners.
Recibo validable: `{mode:"hard",deleted:true,code:"IVA",detachedPrices:12,remainingAssignments:0}`.
Reintento devuelve deleted=false y contador original; inexistente contador0.
La advertencia informa que los precios quedan sin impuesto y el cálculo puede
cambiar. Migración aditiva `20261117120000_tax_removal` probada en PostgreSQL
local desechable; activación configurada externa pendiente. ADR-0319 backend y
[QA UI](../qa/tax-removal-20261117.md).

2026-11-17 — Migración fiscal anterior activada con autorización exacta de
Ricardo; Pricing/BFF Admin reiniciados y healthy. Precios/asignaciones/referencias
conservados y tombstones0. Sustituye activación pendiente, sin borrar impuestos
comerciales. [QA](../qa/tax-removal-20261117.md).

### Price tables: borrado con desactivación — 2026-11-17

Elección explícita de Ricardo: desactivar precios/reglas asociados al eliminar.
DELETE `/api/v1/admin/pricing/price-tables/:id/permanent?organizationId=:org&shopId=:shop&deactivatePrices=true`.
Employee + pricing.admin.write + scope permitido; sin acuse400. Recibo
`{mode:"hard",deleted:true,code:"vip",affectedPrices:4,remainingAssignments:0,activePricesRemaining:0}`.
Se retiran maestro/asignaciones; Price permanece inactivo con importes/impuestos
conservados. Fences rechazan nuevas asignaciones al código eliminado y
reactivaciones sin elegir otra tabla. Pedidos/facturas y otros scopes intactos.
Legacy DELETE no cambia ni sirve de fallback. PATCH activation sincroniza maestro
y precios incluso con tabla vacía. Migración aditiva20261117140000_price_table_removal
probada en PostgreSQL desechable, activación configurada pendiente. ADR-0320 y
[QA UI](../qa/price-table-list-actions-20261117.md).

2026-11-17 — Price tables: migración20261117140000_price_table_removal activada
con autorización exacta de Ricardo y reinicio selectivo Pricing/BFF Admin.
Health200/200, datos comerciales conservados (2589 precios,335 asignaciones de
tabla), tombstones0. Sustituye activación pendiente. No se eliminaron tablas
comerciales. [QA](../qa/price-table-list-actions-20261117.md).

## Eliminación revisada de Pricing — 2026-11-17

Contrato nuevo autorizado (ADR-0321 del composable), pendiente de activar en la base configurada. POST `/admin/pricing/:kind/:code/removal-review|removal-confirm|removal-status`, kind taxes o price-tables. Employee + pricing.admin.write + tenant autorizado. Review acepta replacementCode y reviewOffset; confirm/status impactVersion SHA256 más el mismo sustituto. Review devuelve impacto paginado de50, opciones y bloqueos; sin prueba de cobertura canConfirm=false. BFF obtiene herencia Catalog. Impuestos reemplazan snapshots conservando importe/taxIncluded; tabla destino recibe precios/reglas preservando estado y condiciones. Sin destino solo se retira con respaldo probado. Status solo lee recibo durable y prueba ReadIndex; no confirma de nuevo. PENDING o COMPLETE más contexts; COMPLETE requiere todas las generaciones/contextos y precios proyectados frescos. Receipt incluye kind/code/replacementCode/impactVersion, reviewed/deleted/mode, affectedPrices y remainingAssignments0. No usar las antiguas acciones de desvinculación como fallback. [Pruebas y límites](../qa/reviewed-removal-20261117.md).

2026-11-17 — Activación posterior de eliminación revisada autorizada y aplicada:20261117160000_reviewed_removal y reinicio selectivo Pricing/BFF Admin/ReadIndex. Health200 y datos comerciales intactos. La prueba manual de tienda queda pendiente de contexto Employee; ver `../qa/reviewed-removal-20261117.md`.

## Condiciones comerciales en perfil Admin — 2026-11-18

UI conserva el contrato ADR-0317 de un grupo manual por cliente/contexto. Separa
condiciones comerciales de datos personales, muestra revisión grupo/aprobación,
acepta motivo manual acotado y conserva borrador en conflicto409. Lectura fallida
no modifica pertenencia; diagnóstico por recurso/status y recuperación explícita.
Employee lector dispone de vista comercial de solo lectura. No cambia flags ni
reglas de precios. El motivo/actor siguen bajo persistencia y autoridad del BFF.

La causa del aviso del entorno comercial y el recorrido real de precios/checkout
no están certificados. Tampoco hay DTO local garantizado para leer el historial
comercial con actor/motivo/before-after: se documenta propuesta para sincronización,
sin implementar endpoints alternativos. [QA](../qa/customer-commercial-profile-20261118.md)
y [dependencias](../gaps/2026-11-18-customer-commercial-operational-validation.md).

### Activación comercial y auditoría sincronizadas — 2026-11-18

Ricardo autorizó las dos migraciones comerciales aditivas, credenciales/flags,
auditoría y ajustes UI. Activación local instalada y health verificado; política
por BFF con Employee real para Tienda Barcelona: allowedGroups vip/b2b-pro,
registeredGroup=null, b2bGroup=b2b-pro. No asigna grupos automáticamente ni añade
reglas de importes. Customers presenta PERSON como PRIVATE_BUYER únicamente en
lectura comercial; no reescribe perfiles ni adivina otros códigos históricos.

GET `/admin/customers/:customerId/commercial-membership/history?organizationId&shopId&limit=20&offset=0`:
Employee/admin+customers.read+tenant, privado/no-store. DTO `{items,total,limit,offset}`;
items `{auditId:string,revision:number,actorId:string,reason:string,occurredAt:ISO,before:null|membership,after:membership}`,
membership `{groupCode:string|null,b2bApproved:boolean,revision:number}`. Límite1–100,
offset0–1000000. Actor de BFF, snapshot SQL del owner y proyección allowlisted.

La política existente se edita en Configuración/Precios/Parámetros, vía
`GET|PUT /admin/customers/commercial-segment-policy`, revisión/actor/permisos del
contrato50. UI omite commercialMembership sin cambios y valida Empresa para B2B.
El perfil real ya carga sin el aviso. SQL/HTTP/Playwright valida precios y
revalidación de carrito en laboratorio aislado; no certifica compra/cobro real.
[Evidencia, comandos y reversión](../qa/customer-commercial-activation-20261118.md).

### Consulta UI de auditoría comercial (2026-11-18)

El perfil de cliente deja de pedir motivo manual y de mostrar el historial.
`/admin/logs?customerId=...&offset=...` reutiliza el GET paginado de auditoría
comercial ya documentado, sin nuevo contrato ni agregador global. El motivo de
las escrituras UI es automático; el actor sigue siendo responsabilidad del BFF.

## Confirmación comercial por contraseña — 2026-11-18

Sincronizado con ADR-0322: las escrituras comerciales POST/PATCH de cliente y PUT
de membresía exigen `currentPassword` por petición; el BFF verifica en Sessions
con el empleado conectado y elimina el secreto antes de invocar Customers.
No se acepta un step-up general previo como autorización del cambio. Campos
personales sin modificación comercial no requieren contraseña. Auditoría añade
reauthentication opcional (verificationId, PASSWORD, verifiedAt, sessionId) y tipo
comprador en snapshots nuevos. Históricos sin evidencia permanecen legibles.
403 rechaza confirmación,429 limita intentos y503 falla cerrado si Sessions no
puede confirmar. Ver `../qa/commercial-change-reauthentication-20261118.md`.

### Corrección del destino de logs comerciales — 2026-11-18

Se retiran el menú/ruta `/admin/logs` y el enlace desde Actividad: solo consultaban el historial de Customers y no representaban el servicio central. El backend autorizado entrega ahora el evento a `services/log` desde la auditoría transaccional, con reintentos. Se conserva el endpoint de historial por compatibilidad; la UI no lo usa. No se modifican autenticación ni confirmación con contraseña. Esta entrada sustituye las referencias anteriores a ese menú; no cierra pendientes de seguridad generales. Evidencia: `docs/qa/customer-commercial-log-delivery-20261118.md`.


### Eliminación de site parts — 2026-11-19

Autorizado e implementado DELETE /api/v1/admin/cms/site-parts/:sitePartId por
Organization/Shop/locale, Employee Admin y cms.settings.write. Recibo estricto
{sitePartId,deleted:true};409 asignado,404 ajeno/inexistente. No sustituye archive.
Revisiones en cascada, FK RESTRICT y guardado sin upsert contra editor obsoleto.
POST shell-assignments acepta null para liberar; fila vacía AUTO se retira.
QA local: ../qa/cms-site-part-deletion-20261119.md. Sin borrados reales.

### Unificación visual Builder / Headers / Footers (2026-11-19)

Contrato sincronizado con CMS/BFF local: los bloques de sistema aceptan
`props.presentation` y las áreas `presentation`, ambos con la gramática visual
v2 existente (styles por scope, visibility, animation, interactions, assetRefs).
El servicio normaliza estos campos y el BFF valida el borde. Sin estos campos,
los documentos existentes mantienen su comportamiento. Shell resolve hidrata
referencias `visual.module` ACTIVE con sus valores por instancia; omite
referencias no disponibles como en páginas. `assetRefs[].src` opcional conserva
URLs públicas HTTPS o `/assets/`; se descarta el proxy privado Admin.
No se añaden endpoints ni almacenamiento alternativo.
QA: `../qa/cms-builder-unification-20261119.md`.

### Hoja CSS única de site parts — 2026-11-19

Contrato local sincronizado: `revision.layout.styleSheet` opcional con scopes
base/desktop/tablet/mobile; cada scope contiene reglas `{selector, styles}`.
`styles` reutiliza las propiedades/valores del registro visual Builder. CMS
normaliza/conserva esta propiedad en draft/publicación/shell; BFF valida el borde.
UI ofrece una sola caja CSS y convierte a ese modelo canónico. Selectores siempre
acotados a la pieza; no CSS global, URLs ni at-rules. Sin rutas/migraciones nuevas.
Evidencia: `../qa/cms-single-block-stylesheet-20261119.md`.


### CMS composición independiente — Fase1,2026-11-20

ADR0324/contrato61 del backend: definición de copia independiente, módulos tipados,
árbol de secciones, páginas y plantillas copiables. Fase1 CERTIFICADA como contrato
y compatibilidad; capacidades nuevas NO IMPLEMENTADAS. Rutas legacy intactas.
Schemas, matriz y aceptación en `../contracts/cms-phase-1-contracts-and-compatibility.md`.
No interpretar la definición como disponibilidad de endpoints nuevos.

## CMS MODULE — actualización local Fase2, 2026-11-20

Extensión de cierre constructivo autorizada el 2026-11-24: el mismo contrato
de estilos admite `top`/`left` opcionales como una única longitud CSS explícita
segura; `transform` conserva su gramática owner y se expone en el inspector.
Los tres schemas UI/BFF/CMS están sincronizados. No cambia endpoints, permisos,
persistencia, copias independientes ni publicaciones existentes. Seguimiento
vigente: `docs/qa/cms-construction-demo-20261124/closure-status.md`.

Implementación con verificación parcial; aún sin activación en la base operativa.
La familia BFF `admin/cms/visual-modules` admite `contractVersion=1` en lecturas y
`contractVersion:1,resourceKind:MODULE` en comandos. Recibos incluyen status
DRAFT/ARCHIVED y revisionToken; archivo también exige expectedRevision.
Creación con operationId persistido materializa copia independiente. Listado y
detalle siguen ReadIndex, con independentModules separado del DTO legacy.
El BFF conserva sesión Employee, permisos y validación Media; UI no llama al owner.
Ruta `/admin/cms/modulos` con Biblioteca/Diseño aprobada. Builder legacy conservado.
Contrato normativo: `docs/contracts/cms-composition-boundary.schema.json` y
contrato61/ADR0324 del composable.
Evidencias y pendientes: [informe Fase2](../qa/cms-phase-2-implementation-20261120.md).

Actualización Fase2 tras autorización: migración CMS aplicada en Neon y procesos
CMS/BFF/ReadIndex activados; relay CMS incorporado al supervisor existente.
Copia, reapertura, conflicto y archivo comprobados por Employee/UI. Media bloquea
crear colección sin productId: owner exige UUID. No se modifica ese contrato sin
autorización ni se inventa un producto. Detalle en informe QA de Fase2.


2026-11-20 — Extensión Media sin producto autorizada y activada. Multipart omite
productId; respuesta nullable explícita. Productos conservan UUID/uniquidad.
Subida, copia compartida, sustitución independiente y URLs200 verificadas por
Employee/UI, SQL y HTTP. Sustituye el bloqueo Media anterior. Fase2 continúa
VERIFICACIÓN PARCIAL. Ver [informe y pendientes](../qa/cms-phase-2-implementation-20261120.md).

## CMS SECTION — actualización 2026-11-20

Fase3 implementada y activada con verificación parcial: rutas BFF SECTION,
locale obligatorio, permisos cms.pages.read/write, validación Media reutilizada,
CAS e idempotencia owner; lectura exclusiva ReadIndex. No altera autenticación
ni cierra hallazgos previos. Pendiente probar perfiles Employee solo lectura y
scope/locale ajenos en integración real. Informe: [Fase3](../qa/cms-phase-3-implementation-20261120.md).

### CMS Fase4 — preview de composición (2026-11-20)

Implementado, todavía sin certificación integrada: POST
`/admin/cms/pages/preview?organizationId=…&shopId=…&locale=…`, body composition v1,
respuesta200 `{context,document}`. Requiere Employee y `cms.pages.read`; no-store.
Valida Media y reutiliza hidratación pública; no guarda ni publica. La UI mantiene
el resultado separado del borrador editable. [Contrato y estado](../contracts/cms-phase-4-page-commands.md).
La extensión de coordinación fue aprobada e implementada. Migración aplicada y
CMS/BFF Admin/BFF Storefront activados. Operaciones ambiguas de Routing permanecen
reservadas sin reenvío automático. E2E real de composición, Media, preview dinámico, publicación, conflictos, cambio de ruta y despublicación comprobado. Eliminación definitiva QA autorizada y comprobada. Pendiente Employee lector; Fase4 no certificada.

### CMS Fase5 — Plantillas copiables (2026-11-20)

TEMPLATE SECTION/PAGE separado de templates settings. GET/POST
`/admin/cms/composition-templates`; GET/PATCH/:id; POST/:id/archive con
expectedRevision. Locale/contexto y cms.pages.read/write obligatorios. Recibo
status DRAFT|ARCHIVED; listado por status y paginación. ReadIndex para lectura,
CMS para escritura; no vínculo vivo al aplicar. Implementado con verificación
parcial: [estado/evidencias](../qa/cms-phase-5-status-20261120.md).


## CMS composición independiente — Fase6 (2026-11-20)

Implementado con verificación parcial; A10 no certificado. Autorizadas UX explícita,
dos endpoints y coordinación persistente acotada de mutaciones legacy.

- POST `/admin/cms/pages/:pageId/migration-preview` (cms.pages.read):
  `{pageId,sourceRevision,convertible,issues:[{code,blockId,message}],document?}`.
  Consulta owner sin escritura; `sourceRevision` SHA256 de página/versiones,
  settings efectivos y definiciones visuales referenciadas.
- POST `/admin/cms/pages/:pageId/migrate` (cms.pages.write):
  `{contractVersion:1,operationId:UUID,expectedSourceRevision:string}`.
  CMS deriva el documento. Devuelve recibo de página/composición existente.
  Contexto organizationId/shopId/locale obligatorio. Fuente alterada o mutación
  competidora409; incompatibilidad400. No se acepta documento arbitrario UI.
- MIGRATE atómico en persistencia existente. Conserva snapshot publicado, path,
  routeId y SEO; activar la composición exige Publicar explícito. Replay conserva
  una única conversión. Borrador nuevo y publicación legacy pueden coexistir.
- Mutaciones legacy de draft/settings/publicar/ruta/despublicar/borrar reservan
  la coordinación existente antes de efectos. Mantienen endpoints/payloads.
  Una operación con efectos inciertos conserva reserva; no se libera por tiempo.
- Preview visual reutiliza hidratación pública de Fase4 y validación Media.
  No se amplía ReadIndex ni se crea almacenamiento Next.js o tabla nueva.
- Home/PLP/slider y layouts multicolumna, visibilidad/presentación o CSS legacy
  sin equivalencia demostrada permanecen legacy con diagnóstico. Builder sigue
  disponible para ellos; páginas convertidas redirigen al compositor.

Evidencia: CMS44/44, BFF11/11, UI5/5; builds CMS/BFF/UI PASS; PostgreSQL aislado
coordinación y migración PASS (Routing controlado). E2E real QA: migrar/reabrir,
snapshot público idéntico antes de Publicar, publicación explícita, responsive
1440/768/390, Media, acordeón y archivo del origen sin alterar copia. QA finalmente
despublicada/404. Falta perfil Employee lector y filas completas A10; no declarar
certificada la fase. Informe detallado en repo UI docs/qa/cms-phase-6-status-20261120.md.

## Header/Footer con secciones independientes — 2026-11-23

Extensión BFF/CMS autorizada explícitamente por Ricardo. ADR0325 y contrato63
admiten 13 tipos registered de configuración shell y el bloque cms.section dentro
de revisiones site part existentes. Envelope props cerrado contractVersion1 +
document SECTION; BFF valida módulo/presentación/Media anidados. No hay migración
ni nuevo backend/endpoint. Páginas rechazan módulos exclusivos de shell.
Reproducción crea otra pieza DRAFT sin asignar, conserva layout/placements y
usa el editor de Secciones con renderers funcionales existentes. Originales y
publicaciones conservados. Newsletter mantiene newsletterForm visual; no se
habilita footer.newsletter antiguo. Herencia completa y CAS atómico de site parts
siguen pendientes. Evidencia: ../qa/cms-shell-independent-sections-20261123.md.


2026-11-23 — Continuación CMS: guardado atómico/CAS Header/Footer y revisión
confirmada al publicar, creación estable y recuperación por lectura, campos
registered declarados, herencia visual y layout/targeting PLP independiente.
La comprobación de CAS previa UI se sustituye por validación transaccional owner
para el flujo nuevo. No cierra hallazgos generales ni certifica producción;
no cambia sesiones ni permisos y no se han publicado originales. Evidencia,
contratos y límites: docs/qa/cms-builder-retirement-implementation-20261123.md.


Comprobación final de compatibilidad2026-11-23: contentBinding V1 explícito se
preserva sin aliases contradictorios; color/textAlign de contenedores heredan.
store.logo conserva href HTTPS como dato sin cambiar el fallback del renderer.
Home y checkout tienen nuevas copias DRAFT, documentadas en
`docs/qa/cms-builder-retirement-implementation-20261123.md`.
La página de pruebas conserva un bloqueo Media por fondo url(...) antiguo;
no se retiró el Builder ni se publicaron/alteraron originales.


### Reparación Media explícita en migración CMS — 2026-11-24

Autorizada para cierre en laboratorio. Preview y comando de migración admiten
`assetMappings?: [{sourceUrl,mediaAssetId,src}]` (máximo32). SourceUrl local
identifica exactamente el fondo antiguo; src es HTTPS y debe corresponder al
asset activo del mismo scope comprobado por BFF/Media. CMS aplica sobre copia,
conserva publicación anterior, incorpora el mapa a revisión/hash de replay y
rechaza duplicados, URL insegura o sustitución sin coincidencia. La UI reutiliza
subida Media y el fondo queda editable. No certifica todavía retirada Builder.


### Recuperación de publicación durante retirada — 2026-11-24

El comando PUBLISH admite `restorePublished:true` junto con versionId histórico,
operationId y expectedRevision. CMS exige página publicada, snapshot del mismo
pageId ya publicado anteriormente, revisión vigente y coordinador sin otra
operación pendiente. No acepta contenido del cliente ni restaura otra ruta.
Reutiliza reserva durable, Routing, replay y outbox de publicación; conserva el
borrador independiente y vuelve a permitir publicarlo explícitamente después.
BFF exige cms.pages.publish. La excepción solo selecciona un snapshot previamente
publicado del owner; no permite publicar un draft antiguo ni saltar contexto.
PostgreSQL real desechable: restore legacy→lectura pública legacy→borrador
independiente conservado→replay→republish independiente PASS; ID ajeno rechazado.
No requiere DDL ni otro servicio.

### Cierre de laboratorio y reintento previo a efectos — 2026-11-24

CMS clasifica como `CmsRoutingSeoBeforeEffectsError` únicamente el rechazo de la
consulta canónica anterior a POST/PATCH Routing. El coordinador devuelve esa
misma reserva RUNNING a PREPARED bajo lock y revisión/hash/contexto idénticos;
no lo hace después de una escritura intentada ni de un resultado Routing
registrado. Los fallos inciertos conservan la reserva. La cuenta escritora de
ensayo obtuvo explícitamente `routing-seo.routes.write`, ya requerido por el
contrato Routing; no se relajaron guards ni permisos humanos.

Publicación real en Barcelona/es-ES: cuatro páginas originales y cuatro site
parts convertidos sobre las mismas identidades; nueve superficies mantienen sus
asignaciones. Los dos QA negativos conservan historial y avisos editables, sin
publicación. Recuperación/replay/republicación de Privacidad acreditados contra
Admin, CMS, Routing y BFF público. Builder exclusivo retirado de UI; catálogo,
lectores de versiones históricas y edición visual compartida conservados.
Seguimiento único: `ecommium_ui/docs/qa/cms-builder-retirement-closure-20261124.md`.
Esto acredita el laboratorio autorizado, no otros tenants ni producción.

Cierre constructivo CMS 2026-11-24: la edición avanzada de una copia reutiliza el inspector de Módulos y configura campos locales; no muta la biblioteca ni otras composiciones. Los comandos de módulos/secciones esperan de forma acotada a observar su revisionToken mediante el BFF de lectura antes de anunciar la reapertura lista. La sincronización pendiente conserva el recibo de escritura confirmado y no repite el comando. Evidencias en docs/qa/cms-construction-demo-20261124/closure-status.md.

Headers/footers vacíos usan el mismo compositor de Secciones y sus bibliotecas.
Asignación PAGE utiliza los endpoints existentes, un selector paginado de páginas
reales y permiso Employee de escritura. El propietario CMS admite `flexWrap` en
presentaciones, igual que UI/BFF. `cms.section` conserva su envoltura estricta
durante lectura→guardado, sin añadir props legacy. No se han creado endpoints,
almacenamientos ni migraciones de base de datos para este cierre.
El editor exclusivo antiguo de shell y sus mutaciones UI sin consumidores se
retiran; las piezas QA archivadas conservan consulta y preview compartido. Los
lectores y contratos históricos compartidos permanecen. El seguimiento vigente
es `../qa/cms-construction-demo-20261124/closure-status.md`.


### Retirada de la pantalla Transición — 2026-11-24

Por decisión del usuario se eliminan /admin/cms/transicion, su navegación y los
controles/acciones UI exclusivos de revisión, reproducción y conversión antiguos.
Páginas abre directamente su editor; Headers/Footers mantienen el compositor de
secciones. El listado paginado de páginas para asignaciones PAGE se conserva
bajo el nombre listCmsShellAssignmentPages. No cambian endpoints BFF, datos,
publicaciones, asignaciones ni contratos de lectura histórica compartidos.
Evidencia en ../qa/cms-construction-demo-20261124/closure-status.md.


### Retirada de plantillas de layout heredadas en UI — 2026-11-24

La UI retira la administración antigua de templates por tipo de página:
listado/alta/edición/eliminación, asignación desde settings de página y sus
Server Actions/clientes exclusivos. Plantillas ofrece solo composiciones
PAGE/SECTION. ?kind=layout y Ajustes básicos ?tab=templates redirigen a esa
biblioteca, sin consultar el catálogo de plantillas heredadas. Los endpoints
backend documentados anteriormente permanecen como compatibilidad; no se
modifican ni se ejecutan borrados de datos.

Ajustes básicos mantiene tokens globales y fuentes BFF; retira «Layout base».
PATCH global envía solo {tokens}, exige cms.settings.write y conserva layout
existente por omisión. PATCH de settings de página omite templateId: no asigna
ni retira referencias históricas desde valores del formulario. Las lecturas de
settings resueltos siguen interpretando esas referencias. El editor compartido
de áreas se conserva en las composiciones nuevas. Evidencia y límites en
../qa/cms-construction-demo-20261124/closure-status.md.

## Sincronización funcional QA autorizada — 2026-11-25

Referencia backend: `ADR-0326-functional-qa-draft-contact-employee-identities.md`.
Se limita a QA-006, QA-005 y QA-010 del informe existente.

- Catalog: borrador/inactivo admite `brandId:null`. Activo/publicación requiere marca válida. PATCH omitiendo conserva; null explícito elimina solo en inactivo. DTOs y proyección conservan ausencia real, sin marca predeterminada. Migración Catalog/Neon aplicada con autorización expresa y marcas de los 1.780 productos existentes preservadas.
- Checkout contacto: documento personal y tipo opcionales conjuntamente; una pareja parcial devuelve 400. Requisitos corporativos/fiscales se mantienen. `checkout/context.contact` devuelve documento/tipo y prevalecen los datos guardados para el pedido sobre el perfil customer, sin cambiar el perfil. La UI elimina errores locales anteriores al enviar datos válidos.
- Postventa: BFF resuelve el principal autenticado a `Employees.employeeId` antes de usar un actor operativo; una sesión SYSTEM sin organización usa el contexto explícito autorizado. UI conserva el alias `principalId` para leer asignaciones históricas sin reescribirlas. Las referencias de auditoría explícitas conservan su semántica.

Certificación individual e historial en `../qa/full-app-20261125/report.html`.
No se intervienen estilos, CMS, otros módulos ni los casos pendientes de la auditoría.

Certificación 2026-11-25: borradores y Postventa certificadas; Checkout invitado certificado para contacto y avance a Entrega, rama autenticada bloqueada por falta de sesión Customer confirmada por Ricardo. La carga Postventa aprobada usa dos grupos (máximo tres lecturas indexadas simultáneas), manteniendo las mismas peticiones y límites del BFF/ReadIndex. No se ejecutan compras/pagos ni la auditoría global.

# AGENTS.md

## Objetivo
Este archivo define la forma de trabajo obligatoria para implementar `ecommium_ui`, una UI Next.js externa para Ecommium. La meta es construir primero el Admin/backoffice y despues el Storefront publico, con una experiencia visual y operativa inspirada en PrestaShop, pero consumiendo exclusivamente el composable Ecommium via `apps/bff`.

La IA debe tratar este documento como guia de accion del repo de UI. Si una instruccion de este archivo entra en conflicto con la referencia local `docs/composable-reference/README.md` o con el comportamiento observable del BFF, la IA debe documentar el gap y pedir sincronizacion explicita. No debe consultar ni modificar el repo backend por iniciativa propia.

## Fuente de verdad y orden de lectura
Antes de implementar cualquier modulo, la IA debe leer:

1. Este `AGENTS.md`.
2. `README.md` de este repo.
3. `package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`.
4. `docs/composable-reference/README.md`: snapshot local del composable, sus decisiones relevantes y contratos BFF para UI.

La IA no debe trasladarse al repo backend para leer documentacion o codigo, salvo pedido explicito del usuario. Si falta contexto, debe trabajar con la referencia local, inspeccionar este repo de UI, validar contra el BFF disponible y dejar el gap documentado.

## Mandatos no negociables
- La IA solo puede crear o modificar codigo dentro de `/Users/ricardoperez/Documents/ecommium_ui`, salvo que el usuario pida explicitamente cambios en otro repo.
- Este repo no contiene servicios backend, microservicios, bases de datos, colas ni logica de dominio del ecommerce.
- Todo dato de negocio se lee o muta solo por `apps/bff` del repo `composable_ecommerce`.
- La UI nunca llama directamente a `services/*`, Vertex, pasarelas de pago, bases de datos ni buckets.
- Si falta un endpoint BFF, la IA debe documentar el gap y proponer el contrato; no debe saltarse el BFF ni crear un backend alterno en Next.js.
- Las rutas `app/api/*` de Next.js no deben usarse como BFF paralelo. Solo se permiten para necesidades tecnicas propias de UI, como health local, web-vitals beacon, preview proxy sin dominio o integraciones de plataforma que no pertenezcan al ecommerce.
- Toda pantalla Admin debe exigir sesion de employee y permisos. La UI debe ocultar acciones no autorizadas, pero la seguridad real pertenece al BFF/Sessions.
- Toda pantalla Storefront debe tratar `organizationId`, `shopId`, `locale`, `currency`, `country`, `channel`, `guestSessionId` y `visitorId` como contexto explicito o resuelto, nunca como constantes invisibles.
- Los payloads enviados al BFF deben validarse con schemas en el borde UI antes de enviar y de nuevo al recibir.
- No se deben guardar tokens en `localStorage`. Usar cookies httpOnly gestionadas por BFF cuando el contrato lo permita.
- No se deben exponer secretos en variables `NEXT_PUBLIC_*`.

## Decision de producto: Admin primero
La IA debe priorizar Admin antes que Storefront porque el composable necesita operaciones reales para configurar tenant, tiendas, permisos, catalogo, precios, transporte, pagos, CMS y automatizaciones. Sin Admin operativo, el Storefront tendria que depender de fixtures o configuracion manual y eso contradice el estado del backend.

El Storefront puede avanzar en paralelo solo para validar contratos publicos criticos, pero no debe desplazar la secuencia principal del Admin.

## Decision UX: PrestaShop-like mejorado
El Admin debe sentirse familiar para un usuario experto en PrestaShop:

- Sidebar persistente por areas operativas.
- Topbar con buscador global, selector de Organization/Shop/contexto, notificaciones, acceso a ver tienda y menu de perfil.
- Breadcrumb visible bajo topbar en formularios y pantallas profundas.
- Formularios largos divididos por tabs: configuracion basica primero, opciones avanzadas despues.
- Acciones principales fijas y consistentes: `Guardar`, `Guardar y seguir editando`, `Cancelar`, `Duplicar`, `Previsualizar`, `Activar/Desactivar`.
- Modales solo para confirmacion, acciones irreversibles, seleccion asistida o formularios pequenos.
- Listados tipo backoffice: tabla densa, filtros, orden, busqueda, bulk actions, columnas configurables, paginacion y estado vacio util.
- Feedback inmediato: toasts, banners de error, validacion inline, skeletons, estados de guardado y control de conflicto.
- Animaciones sobrias: transiciones rapidas de panel, modal, toast y filas; nunca decoracion que reduzca densidad operativa.
- Colores inspirados en PrestaShop Admin: base clara, azul para accion primaria, grises para superficies, verde exito, naranja advertencia, rojo error. No usar paletas monotono-purple ni landing pages de marketing.

Tokens visuales obligatorios para Admin:

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
  --admin-shadow-popover: 0 8px 24px rgba(54, 58, 65, 0.16);
}
```

Reglas de uso:

- `#000f44` / `--admin-border-strong` se reserva para focus ring, borde activo de campos, tabs seleccionados, tablas con seleccion y separadores estructurales de alta jerarquia. No usarlo como borde por defecto de cards o tablas.
- Bordes por defecto: `--admin-border`; divisores suaves: `--admin-border-subtle`.
- Boton primario: fondo `--admin-primary`, hover `--admin-primary-hover`, pressed `--admin-primary-pressed`, texto blanco, borde del mismo color.
- Boton secundario: fondo `--admin-surface`, texto `--admin-text`, borde `--admin-border`.
- Boton peligroso: fondo `--admin-danger`, texto blanco, confirmacion obligatoria si destruye datos.
- Inputs/selects/textareas: alto minimo 40px, borde `--admin-border`, focus con `--admin-focus-ring` de 2px y sin layout shift.
- Radio de bordes: 4px para botones, inputs, tablas y badges; 6px maximo para paneles; nunca usar pastillas grandes salvo chips/filtros.
- Tipografia: sistema sans-serif o Inter si se instala; base 14px en Admin, 12px para ayudas/metadatos, 20-24px para titulos de pagina.
- Animaciones: 120-180ms ease-out para hover, modal, dropdown y toast; no animar layout de tablas grandes.
- La IA no debe introducir nuevos colores hex fuera de estos tokens salvo que cree un token nuevo y justifique por que no existe uno equivalente.


En productos, precios, transportistas, pagos y permisos, el patron obligatorio es:

- `Basico`: campos minimos para operar rapido.
- `Avanzado`: reglas, excepciones, overrides, prioridades, auditoria e integraciones.
- `Contexto`: Organization/Shop/locale visibles.
- `Revision`: resumen de impacto antes de acciones destructivas o masivas.

## Arquitectura Next.js obligatoria
Usar Next.js App Router con Server Components por defecto.

Estructura objetivo:

```text
app/
  (admin)/
    admin/
      layout.tsx
      page.tsx
      configuracion/
      catalogo/
      pedidos/
      clientes/
      transporte/
      pagos/
      contenido/
      marketing/
      automatizacion/
      analitica/
      logs/
      postventa/
  (storefront)/
    layout.tsx
    page.tsx
    [locale]/
      [[...path]]/
        page.tsx
  auth/
    login/
src/
  app-shell/
  modules/
    configuracion/
    catalogo/
    pedidos/
    clientes/
    transporte/
    pagos/
    contenido/
    marketing/
    automatizacion/
    comunicaciones/
    analitica/
    logs/
    postventa/
    storefront/
  shared/
    bff/
    auth/
    config/
    i18n/
    permissions/
    ui/
    validation/
    observability/
tests/
  e2e/
  contracts/
  performance/
```

Reglas:

- `app/` contiene rutas, layouts, loading/error/not-found y composicion de pagina.
- `src/modules/<modulo>` contiene componentes, schemas, llamadas al BFF y casos de uso de UI del modulo.
- `src/shared/bff` contiene el cliente HTTP unico al BFF: base URL, headers de contexto, correlationId, errores, retries seguros y parseo de DTOs.
- `src/shared/ui` contiene componentes visuales genericos sin reglas ecommerce.
- No crear un "core domain" frontend que duplique agregados del backend.
- Los componentes interactivos deben llevar `"use client"` solo donde haga falta estado, eventos, efectos, browser APIs, drag/drop, graficas o editores.
- Las llamadas de lectura inicial deben hacerse en Server Components cuando sea posible.
- Mutaciones Admin pueden ir mediante Server Actions finas o handlers de formulario que llamen al BFF, pero sin logica de negocio propia.
- Usar route groups para separar Admin y Storefront sin contaminar URLs.
- Usar lazy loading para graficas, editores rich text, media manager, mapas, tablas pesadas y builders.

## Cliente BFF
Todas las llamadas deben pasar por una funcion comun:

```ts
type BffRequestContext = {
  organizationId: string;
  shopId: string;
  locale?: string;
  currency?: string;
  country?: string;
  channel?: string;
  correlationId?: string;
};
```

Headers obligatorios cuando apliquen:

- `Authorization`
- `x-correlation-id`
- `x-locale`
- `x-visitor-id`
- `x-guest-session-id`
- `x-device-id`
- `x-device-name`

Variables esperadas:

- `ECOMMIUM_BFF_BASE_URL`: URL server-side del BFF, por ejemplo `http://localhost:3010/api/v1`.
- `NEXT_PUBLIC_ECOMMIUM_PUBLIC_BASE_URL`: URL publica de la UI si se necesita para metadata.
- Nunca exponer URLs internas de `services/*` al navegador.

## Modulos Admin y endpoints BFF
Los endpoints listados son la primera referencia operativa. Antes de implementar, validar en `.docs/06-interfaces/00-frontend-bff-contracts.md` porque el contrato puede haber evolucionado.

### Configuracion
Incluye Organization, Shop, ShopContext, defaults regionales, fiscal profile, unidades, dominio publico, permisos, empleados y preferencias del backoffice.

Endpoints base:

- `GET /api/v1/admin/organizations-shops/*` cuando exista en BFF.
- `GET /api/v1/admin/employees/*` cuando exista en BFF.
- `GET /api/v1/admin/analytics/health`
- `GET /api/v1/admin/automation/health`
- `GET /api/v1/admin/communications/health`

Payload orientativo para settings heredables:

```json
{
  "organizationId": "org-id",
  "shopId": "shop-id",
  "defaultLocale": "es-ES",
  "defaultCurrency": "EUR",
  "defaultCountry": "ES",
  "timezone": "Europe/Madrid",
  "taxDisplayMode": "tax_included",
  "publicBaseUrl": "https://shop.example.com",
  "units": {
    "weight": "kg",
    "dimension": "cm"
  },
  "fiscalProfile": {
    "legalName": "Ecommium SL",
    "taxId": "B00000000",
    "country": "ES"
  }
}
```

Mandatos UX:

- Mostrar metadata de herencia por campo: heredado, customizado, restaurar herencia.
- No mezclar defaults generales con reglas owned por Pricing, Shipping, Payments, Catalog o CMS.
- El primer flujo Admin debe permitir elegir Organization/Shop y ver health operativo.

### Catalogo
Paquete Admin compuesto por `products`, `variants`, `pricing`, `category`, `brand`, `specifications`, `variant-options`, `media` y `search indexing`.

Endpoints base:

- `GET /api/v1/admin/products`
- `POST /api/v1/admin/products`
- `GET /api/v1/admin/products/:productId`
- `PATCH /api/v1/admin/products/:productId`
- `DELETE /api/v1/admin/products/:productId?mode=soft|hard`
- `GET /api/v1/admin/media/collections`
- `POST /api/v1/admin/media/collections`
- `POST /api/v1/admin/media/collections/:mediaCollectionId/items`
- `GET /api/v1/admin/search/health`
- `POST /api/v1/admin/search/query-preview`
- `POST /api/v1/admin/search/index/preview`
- `POST /api/v1/admin/search/index/gcs-import-jobs`

Payload orientativo de producto:

```json
{
  "organizationId": "org-id",
  "shopId": "shop-id",
  "defaultLocale": "es-ES",
  "name": "Urban Runner",
  "slug": "urban-runner",
  "status": "DRAFT",
  "brandId": "brand-id",
  "categoryIds": ["category-id"],
  "description": {
    "summary": "Zapatilla urbana ligera",
    "body": "Descripcion completa"
  },
  "defaultVariant": {
    "refId": "URBAN-RUNNER-42",
    "ean": "0000000000000",
    "isActive": true
  }
}
```

Mandatos UX:

- Producto debe seguir tabs: `Basico`, `Combinaciones`, `Precio`, `SEO`, `Medios`, `Transporte`, `Opciones`, `Auditoria`.
- Precio basico en `Basico`; reglas, tablas, prioridades y vigencia en `Precio avanzado`.
- Media manager con drag/drop, cover image, captions localizados y orden posicional.
- Categorias con arbol, busqueda y breadcrumb de categoria.
- Brand como selector asistido y link a creacion si falta.

### Transporte
Incluye carriers, zones, warehouses, SLA policies, pickup points, rate rules, fulfillment y tracking.

Endpoints base:

- `GET /api/v1/admin/shipping/warehouses?organizationId=:org&shopId=:shop&includeInactive=false`
- `PUT /api/v1/admin/shipping/warehouses?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/shipping/sla-policies?organizationId=:org&shopId=:shop&includeInactive=false`
- `PUT /api/v1/admin/shipping/sla-policies?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/shipping/pickup-points?organizationId=:org&shopId=:shop&includeInactive=false`
- `PUT /api/v1/admin/shipping/pickup-points?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/shipping/fulfillments?organizationId=:org&shopId=:shop&status=:status&limit=:limit&offset=:offset`
- `PATCH /api/v1/admin/shipping/fulfillments/:fulfillmentId/status?organizationId=:org&shopId=:shop`

Payload orientativo de regla de tarifa:

```json
{
  "carrierId": "carrier-id",
  "zoneId": "zone-id",
  "rangeType": "WEIGHT",
  "from": 0,
  "to": 5,
  "priceMinor": 499,
  "currency": "EUR",
  "taxCode": "standard",
  "handlingFeeMinor": 0,
  "outOfRangeBehavior": "DISABLE_CARRIER"
}
```

Mandatos UX:

- Copiar el modelo mental PrestaShop: transportista, zonas, rangos por peso/precio, comportamiento fuera de rango, impuestos y manipulacion.
- Separar configuracion de cotizacion y fulfillment.
- No mostrar stock como owned por Shipping; stock pertenece a Inventory.

### Pagos
Incluye payment systems, affiliations, routing rules, card lookup y revision operativa de transacciones.

Endpoints base:

- `GET /api/v1/admin/payments/affiliations?organizationId=:org&shopId=:shop&includeInactive=false`
- `POST /api/v1/admin/payments/affiliations?organizationId=:org&shopId=:shop`
- `PATCH /api/v1/admin/payments/affiliations/:affiliationId?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/payments/payment-systems?organizationId=:org&shopId=:shop&includeInactive=false`
- `POST /api/v1/admin/payments/payment-systems?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/payments/rules?organizationId=:org&shopId=:shop&includeInactive=false`
- `POST /api/v1/admin/payments/rules?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/payments/card-lookup?organizationId=:org&shopId=:shop`

Mandatos UX:

- Separar configuracion segura de credenciales, reglas de routing y pruebas de provider.
- Nunca renderizar secretos completos.
- Toda accion de activar/desactivar provider debe pedir confirmacion e indicar impacto.

### Clientes
Incluye customer 360, direcciones, compras y consentimientos.

Endpoints base:

- `GET /api/v1/admin/customers?organizationId=:org&shopId=:shop&limit=:limit&offset=:offset&q=:q&email=:email`
- `POST /api/v1/admin/customers?organizationId=:org&shopId=:shop`
- `PATCH /api/v1/admin/customers/:customerId?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/customers/:customerId?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/customers/:customerId/addresses?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/customers/:customerId/addresses?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/customers/:customerId/purchases?organizationId=:org&shopId=:shop&limit=:limit&offset=:offset`

Mandatos UX:

- Customer 360 con resumen, direcciones, pedidos, postventa, comunicaciones y logs.
- No mostrar PII innecesaria en tablas si no aporta a la tarea.

### Pedidos, facturas y postventa
Endpoints base:

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

Mandatos UX:

- Pedidos como centro operativo: estado, pago, shipping, factura, cliente y postventa.
- Facturas no se editan como pedido; son documentos fiscales derivados.
- Postventa debe mostrar linea temporal, evidencias, resoluciones, refund y logistica inversa.

### CMS, Routing/SEO y Storefront preview
Endpoints base:

- `GET /api/v1/admin/cms/pages?organizationId=:org&shopId=:shop&locale=:locale&status=:status&pageType=:pageType&limit=:limit&offset=:offset`
- `POST /api/v1/admin/cms/pages?organizationId=:org&shopId=:shop&locale=:locale`
- `PATCH /api/v1/admin/cms/pages/:pageId/draft?organizationId=:org&shopId=:shop&locale=:locale`
- `POST /api/v1/admin/cms/pages/:pageId/publish?organizationId=:org&shopId=:shop&locale=:locale`
- `GET /api/v1/admin/routing-seo/routes?organizationId=:org&shopId=:shop&locale=:locale`
- `POST /api/v1/admin/routing-seo/routes?organizationId=:org&shopId=:shop&locale=:locale`
- `GET /api/v1/admin/routing-seo/resolve?organizationId=:org&shopId=:shop&locale=:locale&path=:path`
- `GET /api/v1/admin/routing-seo/sitemap?organizationId=:org&shopId=:shop&locale=:locale`

Mandatos UX:

- CMS administra drafts y publicacion; Storefront solo renderiza contenido publicado.
- Routing/SEO debe mostrar canonical, aliases, redirects, sitemap y resolucion de path.
- Preview debe abrir una ruta UI que consuma BFF como Storefront, no datos internos.

### Automatizacion, comunicaciones, analitica y logs
Endpoints base:

- `GET /api/v1/admin/automation/rules?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/automation/rules?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/automation/rules/:ruleId/activate?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/automation/executions?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/automation/executions/:executionId/retry?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/communications/templates/email?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/communications/templates/email?organizationId=:org&shopId=:shop`
- `POST /api/v1/admin/communications/templates/email/:templateId/preview?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/communications/deliveries?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/analytics/events?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/analytics/reports/summary?organizationId=:org&shopId=:shop&from=:iso&to=:iso`

Home Admin:

- Debe abrir en `Analitica` con KPIs, graficas y alertas operativas.
- Inspiracion PrestaShop: ventas, pedidos, conversion, visitantes, registros, cupones, categorias, metodos de pago, zonas, monedas, productos mas vendidos y catalog health.
- Inspiracion Shopify: dashboard con cards de metricas, acceso a reportes detallados y actividad reciente.
- Inspiracion WordPress: panel de salud tecnica con issues criticos, mejoras recomendadas y checks pasados.
- Ecommium debe sumar: health BFF/servicios, outbox/DLQ, cache/projection status, search provider, comunicaciones, automatizaciones y logs de negocio.

## Storefront
El Storefront se implementa despues del Admin base. Debe usar App Router, rutas dinamicas por path y resolucion via BFF.

Endpoints base:

- `GET /api/v1/storefront/resolve-path?organizationId=:org&shopId=:shop&locale=:locale&path=:path`
- `GET /api/v1/storefront/page?organizationId=:org&shopId=:shop&locale=:locale&path=:path&limit=:limit&offset=:offset`
- `GET /api/v1/storefront/navigation/categories/tree/:levels`
- `GET /api/v1/storefront/search`
- `POST /api/v1/storefront/search/events`
- `GET /api/v1/storefront/plp/:categorySlug`
- `GET /api/v1/storefront/pdp/:productSlug`
- `GET /api/v1/storefront/me/purchases?organizationId=:org&shopId=:shop`
- `GET /api/v1/storefront/me/invoices`
- `POST /api/v1/storefront/me/after-sales/cases?organizationId=:org&shopId=:shop`

Mandatos UX:

- Tomar la plantilla base PrestaShop como referencia visual inicial: breadcrumbs claros, tipografia legible, PDP estructurada, PLP filtrable, carrito visible y checkout por pasos.
- Mejorar con Next.js: streaming, Server Components, image optimization, metadata dinamica, route-level loading, cache control y prefetch prudente.
- No usar `at` temporal en PLP publica cacheable salvo que el contrato BFF lo permita.
- Reportar eventos de busqueda, PDP, add-to-cart y purchase-complete via BFF.

## Ejecuciones por paquete
La IA debe ejecutar trabajos como procesos cerrables, con evidencia y tests.

### servicio_configuracion
Proceso 1: crear shell Admin, login/context selector, cliente BFF, permisos base y health general.

Proceso 2: implementar Organization/Shop context, herencia de settings por campo y selector multistore.

Proceso 3: implementar Employees, Profiles y Permissions con tabs `Empleados`, `Perfiles`, `Permisos`, `Auditoria`.

Proceso 4: implementar fiscal profile, locale/currency/country/timezone, unidades y publicBaseUrl.

Proceso 5: tests contractuales, a11y, E2E de permisos y performance del shell Admin.

### servicio_catalogo
Proceso 1: listado de productos con filtros, busqueda, paginacion y acciones masivas.

Proceso 2: formulario producto `Basico` con media, categoria, brand y default variant.

Proceso 3: tabs avanzados: combinaciones, precio, SEO, transporte, opciones y auditoria.

Proceso 4: media manager, categorias, brand, specifications y variant options.

Proceso 5: Search Admin preview e indexacion controlada.

Proceso 6: tests E2E producto draft -> activo -> preview -> search.

### servicio_pricing
Proceso 1: UI de precio basico integrada en producto.

Proceso 2: price tables, fixed price por SKU y computed price.

Proceso 3: reglas avanzadas, prioridades, vigencia, simulador y auditoria.

Proceso 4: pruebas de payload y performance en tablas grandes.

### servicio_transporte
Proceso 1: carriers, zones y rangos por peso/precio.

Proceso 2: warehouses, docks/SLA policies y pickup points.

Proceso 3: fulfillment list/detail/status y tracking.

Proceso 4: simulador de cotizacion por carrito/contexto.

Proceso 5: E2E carrier activo -> checkout quote -> fulfillment.

### servicio_pagos
Proceso 1: payment systems y affiliations.

Proceso 2: routing rules y card lookup.

Proceso 3: testing/sandbox provider y estado operativo.

Proceso 4: revision de transacciones, settlements, refunds y errores.

### servicio_operacion
Proceso 1: dashboard Analytics con KPIs, rangos de fecha y cards.

Proceso 2: logs de negocio y filtros por tenant/shop/actor/correlationId.

Proceso 3: Automation rules/executions con retry.

Proceso 4: Communications templates/deliveries.

Proceso 5: health center estilo WordPress Site Health.

### servicio_storefront
Proceso 1: resolver rutas, layout publico, navegacion y breadcrumbs.

Proceso 2: PLP con filtros, sort, facetas, cache-friendly rendering.

Proceso 3: PDP con media, variantes, precio, disponibilidad y SEO.

Proceso 4: cart/checkout sobre BFF.

Proceso 5: cuenta cliente, compras, facturas y postventa.

Proceso 6: Lighthouse, Core Web Vitals, Playwright y pruebas responsive.

## QA y testing obligatorio
Cada modulo debe entregar:

- `npm run lint`
- `npm run build`
- Tests unitarios para helpers, schemas y mappers.
- Tests contractuales contra payloads BFF documentados.
- Playwright E2E para flujos criticos.
- Tests de accesibilidad con axe o equivalente en pantallas Admin principales.
- Tests responsive desktop/tablet/mobile.
- Evidencia manual con backend levantado por `./scripts/postman-services.sh` desde el repo composable cuando el flujo dependa de servicios reales.

La IA debe documentar comandos usados y cualquier test no ejecutado.

## Performance y velocidad
Gates minimos:

- Lighthouse performance >= 90 en Storefront y >= 85 en Admin.
- LCP p75 <= 2.5s.
- INP p75 <= 200ms.
- CLS p75 <= 0.1.
- TTFB publico cacheable objetivo <= 500ms local/canary; Admin <= 900ms salvo reportes pesados.
- JS inicial Admin por ruta <= 250KB gzip salvo pantallas con graficas/editor, que deben usar lazy loading.
- Tablas Admin deben soportar paginacion server-side; no cargar datasets completos si el BFF ofrece `limit/offset`.
- Graficas, editores, mapa/log viewers y media manager deben ser componentes lazy.
- Toda pantalla debe tener skeleton o loading state sin layout shift.

Instrumentacion:

- Crear componente aislado `WebVitals` con `useReportWebVitals`.
- Enviar metricas a `POST /api/v1/storefront/analytics/events` o endpoint BFF equivalente cuando exista contrato.
- Guardar budgets en `tests/performance` y fallar CI si se exceden.

## Seguridad
- No renderizar permisos como fuente de verdad; usarlos solo para UX. El BFF decide.
- No mostrar errores crudos del BFF si contienen trazas.
- No registrar tokens, cookies, passwords, API keys, fiscal IDs completos o datos sensibles en consola.
- Sanitizar rich text antes de preview si el BFF no devuelve HTML seguro.
- Confirmar acciones destructivas: borrar producto hard, desactivar provider de pago, cancelar fulfillment, reembolso, cerrar caso postventa.

## Criterios de cierre de cualquier cambio
Antes de cerrar una tarea:

1. La UI consume solo `apps/bff`.
2. No se creo backend paralelo en Next.js.
3. No se modifico codigo fuera de `ecommium_ui` sin solicitud explicita.
4. El modulo respeta Organization/Shop/locale y permisos.
5. Los payloads estan tipados y validados.
6. La UX mantiene el patron PrestaShop-like basico/avanzado.
7. Se ejecutaron lint/build/tests aplicables.
8. Se verifico performance si la pantalla afecta shell, Admin dashboard, PLP, PDP, checkout o tablas grandes.
9. Se dejo evidencia de comandos y gaps.

## Referencias externas usadas para estas decisiones
- Next.js Project Structure: https://nextjs.org/docs/app/getting-started/project-structure
- Next.js Server and Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components
- Next.js Caching: https://nextjs.org/docs/app/guides/caching
- Next.js Backend for Frontend: https://nextjs.org/docs/app/guides/backend-for-frontend
- Next.js Data Security: https://nextjs.org/docs/app/guides/data-security
- Next.js Lazy Loading: https://nextjs.org/docs/app/guides/lazy-loading
- Next.js `useReportWebVitals`: https://nextjs.org/docs/app/api-reference/functions/use-report-web-vitals
- PrestaShop Admin Area: https://docs.prestashop-project.org/v.8-documentation/user-guide/discovering-administration-area
- PrestaShop Product Catalog: https://docs.prestashop-project.org/v.8-documentation/user-guide/selling/managing-catalog
- PrestaShop Managing Products: https://docs.prestashop-project.org/v.8-documentation/user-guide/selling/managing-catalog/managing-products
- PrestaShop Shipping: https://docs.prestashop-project.org/v.8-documentation/user-guide/improving-shop/managing-shipping
- PrestaShop Employees: https://docs.prestashop-project.org/v.8-documentation/user-guide/configuring-shop/advanced-parameters/team/employees
- PrestaShop Profiles: https://docs.prestashop-project.org/v.8-documentation/user-guide/configuring-shop/advanced-parameters/team/profiles
- PrestaShop Permissions: https://docs.prestashop-project.org/v.8-documentation/user-guide/configuring-shop/advanced-parameters/team/permissions
- PrestaShop Multistore: https://docs.prestashop-project.org/v.8-documentation/user-guide/managing-multiple-stores/multistore-interface
- Shopify Analytics: https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports
- WordPress Dashboard: https://wordpress.org/documentation/article/dashboard-screen/
- WordPress Site Health: https://wordpress.org/documentation/article/site-health-screen/
- Web Vitals: https://web.dev/articles/vitals
- Lighthouse Performance Scoring: https://developer.chrome.com/docs/lighthouse/performance/performance-scoring

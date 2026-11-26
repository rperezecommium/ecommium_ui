# Evidencias visuales actualizadas — 5 de noviembre de 2026

Capturas tomadas con Playwright contra el build de producción local y un BFF
simulado explícito. No son evidencia de integración con servicios reales.
Se actualizaron los recorridos de tiendas, Comunicaciones, Seguridad, Categorías,
Marcas, Media y Servicios. Media y Servicios ya no muestran el ID debajo del input.
Se añadieron cuatro capturas de tablet/móvil. Galería acumulada: 39 imágenes.

Validación de esta sesión: npm run build PASS; 11 recorridos Playwright PASS.
Los E2E comprueban también que el ID ya no aparece bajo ambos inputs.
No se ejecutó una nueva auditoría axe ni Lighthouse.

En móvil el buscador se adapta a una columna; la captura muestra también las
limitaciones actuales del shell: sidebar encima del contenido y topbar con
contenido horizontal. Las tablas mantienen desplazamiento horizontal. Estas
capturas no certifican que todo el shell sea responsive.

Comandos:

```sh
npm run build
ECOMMIUM_QA_SCREENSHOTS=true npx playwright test tests/e2e/admin-login.spec.ts tests/e2e/admin-credentials.spec.ts --grep 'communications configuration saves|communications audit filters|communications template editor|communications tabs isolate|category list creates|brand list creates|media library uses|offerings list shares|Team Security replaces|shop read preparation retries'
ECOMMIUM_QA_SCREENSHOTS=true npx playwright test tests/e2e/admin-installation.spec.ts --grep 'SYSTEM session without a shop'
```

Las imágenes 16 (solo lectura) conservan su captura anterior; el resto se
recapturó en esta sesión. El manifiesto incluye fecha, dimensiones y SHA-256.

## Contexto sin bloque permanente de preparación

![Contexto sin bloque permanente de preparación](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/01-context-without-preparation-block.png)

## Formulario de alta de tienda

![Formulario de alta de tienda](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/02-create-shop-form.png)

## Preparación integrada en Crear tienda

![Preparación integrada en Crear tienda](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/03-create-shop-recovery.png)

## Alta completada y continuación

![Alta completada y continuación](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/04-create-shop-ready.png)

## Proveedor: información unificada arriba al 100 %

![Proveedor: información unificada arriba al 100 %](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/05-provider-unified.png)

## Configuración del proveedor desde la barra

![Configuración del proveedor desde la barra](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/06-provider-configuration.png)

## Configuración guardada en el resumen unificado

![Configuración guardada en el resumen unificado](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/07-provider-saved.png)

## Enviar prueba conservado bajo Estado técnico

![Enviar prueba conservado bajo Estado técnico](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/08-test-email.png)

## Plantillas: pestaña, tabla y formulario al 100 %

![Plantillas: pestaña, tabla y formulario al 100 %](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/09-template-filters-full-width.png)

## Crear plantilla en panel lateral

![Crear plantilla en panel lateral](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/10-template-editor.png)

## Preview de plantilla y activación

![Preview de plantilla y activación](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/11-template-preview.png)

## Auditoría: filtros completos y Ver fallidas

![Auditoría: filtros completos y Ver fallidas](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/12-audit-failed-filter.png)

## Detalle de entrega fallida

![Detalle de entrega fallida](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/13-delivery-detail.png)

## Entrega recuperada tras reintentar

![Entrega recuperada tras reintentar](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/14-delivery-retried.png)

## Plantillas en móvil

![Plantillas en móvil](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/15-templates-mobile.png)

## Controles según permisos

![Controles según permisos](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/16-templates-read-only.png)

## Equipo: Seguridad y dispositivos

![Equipo: Seguridad y dispositivos](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/18-team-security-devices.png)

## Panel lateral para cambiar contraseña

![Panel lateral para cambiar contraseña](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/19-team-security-password-drawer.png)

## Panel lateral de confirmación sensible

![Panel lateral de confirmación sensible](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/20-team-security-step-up-drawer.png)

## Categorías: buscador y edición en fila

![Categorías: buscador y edición en fila](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/21-category-search-list.png)

## Categorías: alta lateral

![Categorías: alta lateral](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/22-category-create-drawer.png)

## Categorías: menú soft y hard

![Categorías: menú soft y hard](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/23-category-actions-menu.png)

## Categorías: filtro tras soft simulado

![Categorías: filtro tras soft simulado](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/24-category-soft-deleted.png)

## Marcas: buscador y edición en fila

![Marcas: buscador y edición en fila](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/25-brand-search-list.png)

## Marcas: alta lateral

![Marcas: alta lateral](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/26-brand-create-drawer.png)

## Marcas: menú soft y hard

![Marcas: menú soft y hard](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/27-brand-actions-menu.png)

## Marcas: filtro tras soft simulado

![Marcas: filtro tras soft simulado](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/28-brand-soft-deleted.png)

## Media: biblioteca y buscador

![Media: biblioteca y buscador](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/29-media-library-list.png)

## Media: menú de acciones

![Media: menú de acciones](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/30-media-library-actions.png)

## Media: alta lateral

![Media: alta lateral](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/31-media-create-drawer.png)

## Media: colección creada y detalle

![Media: colección creada y detalle](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/32-media-created-detail.png)

## Servicios: buscador y edición en fila

![Servicios: buscador y edición en fila](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/33-offerings-search-list.png)

## Servicios: alta lateral

![Servicios: alta lateral](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/34-offerings-create-drawer.png)

## Servicios: menú de acciones

![Servicios: menú de acciones](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/35-offerings-actions-menu.png)

## Servicios: edición lateral

![Servicios: edición lateral](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/36-offerings-edit-drawer.png)

## Media: tablet 768px

![Media: tablet 768px](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/37-media-tablet.png)

## Media: móvil 390px

![Media: móvil 390px](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/38-media-mobile.png)

## Servicios: tablet 768px

![Servicios: tablet 768px](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/39-offerings-tablet.png)

## Servicios: móvil 390px

![Servicios: móvil 390px](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/40-offerings-mobile.png)

# CMS Fase6 — Migración y retirada gradual

2026-11-20. Inicio expresamente autorizado por el usuario. Fase5 conserva
pendiente Employee lector real; esta autorización de avance no la certifica.

## Viabilidad acotada

Referencia: matriz de nueve filas y A10 en cms-phase-1-contracts-and-compatibility.md.
Baseline de contratos UI:23/23PASS. Node22, Prisma/Jest, PostgreSQL desechable,
Playwright y BFF/CMS/ReadIndex operativos, usados en las fases anteriores.
Esta evaluación precedió a la implementación. Estado actualizado en el informe de QA.

Inventario SQL de solo lectura en Organization111/Shop222/es-ES:
cuatro páginas contractVersion0 PUBLISHED y una contractVersion1 UNPUBLISHED.
- Privacidad newsletter:1visual.module v2.
- Home: slider.fullWidth, category.imageTiles, commerce.productGrid,
  visual.module v2 y16plp.categoryIntro.
- Página de prueba de módulos:3visual.module v1,2v2, slider.fullWidth,
  banner.hero ycarousel.
- Selección Bike Brakes:commerce.productGrid.
Ninguna referencia definitionId en las últimas versiones inventariadas. Esto no
acredita ausencia en otros locales/tiendas/versiones: esos casos requieren ensayos.
Home no es convertible bajo el contrato vigente: pageComposition rechaza tipos
plp.*. Se debe conservar íntegra y accesible en legacy; no ampliar tipos ni
eliminar bloques para aparentar equivalencia.

## Evidencias de código y dependencias directas

- UI app/(admin)/admin/cms/page.tsx: deriva al compositor cuando contractVersion1;
  mantiene CmsAdminPage para legacy. builder/page.tsx conserva Builder mezclado.
- CMS prisma.page-composition.repository.ts: lock rechaza contractVersion distinto
  de1 con `Legacy page requires explicit migration`. version() asume composición
  tanto en latest como published. Debe admitir publicación legacy junto a borrador
  convertido sin reescribir la versión publicada.
- CMS visual-module-reference.resolver.ts: resuelve ACTIVE y aplica contentValues,
  pero filtra referencias no encontradas. Reutilizar la resolución de contenido,
  nunca el descarte silencioso para migrar: registrar y bloquear todo faltante.
- Reutilizar adaptador visual v1→v2, materializeSection y validadores PAGE/MODULE;
  comprobar con fixtures representativos que no normalizan pérdida de contenido.
- UI cms-layout-preview.tsx y renderer público legacy: regiones, áreas, columnas,
  placements, visibilidad, anchos, gaps, tokens y fallback de bloques sin ubicación.
  El conversor debe reproducir el orden/render público, no inferirlo del editor.
- Storefront cms page ya selecciona por presencia de page.composition. Conservar
  DTO/lectura pública del snapshot publicado legacy hasta Publicar explícito.
- Tabla CmsPageCompositionOperation existente: candidata para operación MIGRATE
  idempotente; no se propone nueva tabla/servicio ni almacenamiento Next.js.
- ReadIndex mantiene snapshot Admin; comprobar lectura de latest/published mixtos
  antes de afirmar que no precisa cambio. No se amplía su alcance por suposición.

## Concreción aprobada

El usuario aprobó expresamente la conversión explícita y retirada gradual y los
dos endpoints acotados de migración. No requieren nueva confirmación.

1. UX: desde una página legacy, «Migrar al nuevo editor» abre revisión de
   compatibilidad y preview. «Convertir borrador» conserva pageId/ruta/SEO y la
   publicación actual. Si no es convertible, muestra causas y conserva legacy.
   Después de convertir, Páginas usa el compositor. Builder deja de ofrecer
   edición de páginas nuevas; enlaces de páginas convertidas van al compositor.
   No eliminar ruta/editor legacy ni sus dependencias mientras existan documentos
   no convertibles. Headers/Footers y settings heredables permanecen separados.
2. Contratos nuevos acotados CMS/BFF (implementados en esta fase):
   - POST /admin/cms/pages/:pageId/migration-preview: sin escritura, devuelve
     sourceRevision opaca, composición candidata si es válida e issues precisos.
   - POST /admin/cms/pages/:pageId/migrate: contractVersion1, operationId y
     expectedSourceRevision; devuelve recibo de página compuesto existente.
   CMS deriva el documento, no acepta una conversión arbitraria calculada por UI.
   Preview visual reutiliza el endpoint de hidratación/renderer de Fase4.
3. La revisión fuente abarca borrador, settings/layout efectivos y definiciones
   ACTIVE utilizadas. El commit verifica la fuente y rechaza cambios concurrentes.
   Replay conserva recibo, no duplica versión ni modifica publicación. Reutilizar
   coordinación persistente existente y cerrar escrituras legacy tardías sobre
   páginas convertidas; no liberar reservas por ensayo/error.
4. Conversión explícita de layout a secciones/contenedores; módulos materializados,
   IDs/ARIA/fragmentos/CSS remapeados, referencias Media conservadas. Layout efectivo
   se materializa en la composición; no cambia las plantillas de settings origen.
   Campos/semánticas sin equivalencia demostrable bloquean, no se descartan.

## Secuencia y validación

1. Aprobar concreción UX/contratos. Implementar conversor owner y diagnóstico;
   casos de cada fila de matriz: v1/v2, referencias activas/faltantes/archivadas,
   registered, layouts/placements, CSS, Media y límites; cero pérdida silenciosa.
2. Migración atómica y lectura latest/published mixta. PostgreSQL desechable:
   preview sin writes, fuente alterada409, replay, carrera con editor legacy,
   rollback, publicación previa intacta, publicar nuevo y reapertura.
3. BFF/UI: permisos/contexto/Media, revisión y acción explícita, errores conservan
   original; preview existente. Nada de conversión automática al abrir o guardar.
4. E2E con documentos QA y servicios reales: conservar versión pública antes y
   después de convertir borrador; publicar explícitamente; comparar contenido,
   comportamiento, Media y CSS1440/768/390. Verificar Header/Footer/settings legacy.
5. Retirar únicamente accesos/responsabilidades sustituidos y comprobados. Mantener
   compatibilidad de documentos no convertibles. No borrar código o datos antes
   de demostrar sustitución. Informe A10 por cada fila, sin porcentaje artificial.

## Estado posterior a la evaluación

El usuario aprobó también la coordinación persistente acotada de las mutaciones
legacy. Conversión, endpoints, UI y coordinación implementados; compilación,
unidades, PostgreSQL y E2E representativo reales ejecutados. No se modificó
ReadIndex ni se migraron páginas comerciales. Se conserva legacy para Home y
otras semánticas sin equivalencia demostrada.

Fase6 IMPLEMENTADA CON VERIFICACIÓN PARCIAL. A10 no certificado. Evidencias,
resultados por fila y pendientes en [informe](../qa/cms-phase-6-status-20261120.md).

# CMS Fase 4 — Simplificación de Páginas

2026-11-20. Autorizada por el usuario; UX aprobada: mantener CMS→Páginas,
Página (título/SEO), Composición y Previsualizar. Legacy conserva su editor;
no conversión automática ni trabajo de Fase5/6. Fases2/3 mantienen verificación parcial.

## Viabilidad y dependencias comprobadas

- El schema aprobado contiene composition, draftRequest, receipt y publishRequest.
  Reutilizar SectionDocument y su validación/copia, registro MODULE, Media BFF y
  CmsSectionView. Límites agregados:24 secciones/120 nodos/8 niveles/1MiB.
- CMS Page/PageVersion solo representan blocks. UpdateDraft guarda página y
  versión por separado y rechaza páginas publicadas; Publish guarda versión,
  página y outbox separadamente. No cumplen aún el snapshot atómico ni CAS nuevos.
- Reutilizar CmsPage/CmsPageVersion con campos aditivos opcionales para composición
  y revisión, y persistencia de operaciones aprobada en Fase1. No tabla alternativa
  de páginas ni nuevos servicios. Legacy mantiene su gramática.
- Páginas Admin lee CMS a través de CmsClientApiV1Adapter, no ReadIndex (a diferencia
  de MODULE/SECTION). Conservar ese recorrido. El snapshot CMS de ReadIndex puede
  incluir los campos aditivos sin migrar las lecturas ni extender el servicio.
- Publicación usa CmsRoutingSeoPublisherPort; mismo path y versionId confirmado.
  Preparar operación/snapshot, resolver ruta, confirmar con CAS y outbox atómicos.
  Replay no repite efectos completados. Sin bearer persistido ni nuevo worker.
- Storefront actualmente entrega/hidrata/renderiza blocks. Debe transportar
  composition y recorrer módulos registrados para hidratar configuración dinámica
  mediante el mecanismo BFF existente, sin persistir productos/precios hidratados.
- UI: cms-admin-page/actions/admin.ts y ruta /admin/cms; cliente público y
  storefront-cms-page.tsx; renderizador compartido packages/cms-blocks/src/react.tsx.

## Secuencia y validación

1. Validación del documento completo y copia, con tests de identidades/presupuestos
   agregados entre secciones, CSS y tipos exclusivos PLP incompatibles.
2. Persistencia/transacciones y contratos CMS/BFF: crear/replay, guardar/reabrir,
   título/SEO/composición coherentes; dos escritores, scope/locale, fallos de
   publicación y recuperación. PostgreSQL desechable antes de activar migración.
3. Transporte público y renderer compartido: orden, Media, CSS de página limitado
   a wrappers, hidratación comercial y equivalencia preview/publicado.
4. UI aprobada: lista ordenada de copias de secciones, CSS, metadata, CAS,
   publicación del recibo confirmado, borrador preservado ante errores.
5. Integración Employee real, BFF/CMS y Storefront, responsive1440/768/390,
   regresión legacy/Header/Footer, permisos y fallos A2/A3/A6/A7/A8/A11.

Herramientas presentes: Node/Jest/Prisma/Playwright; scripts PostgreSQL aislados
existentes y servicios canónicos usados en Fase3. No confundir disponibilidad
previa con una prueba de salud o integración de Fase4 ejecutada.
Baseline ejecutado: contratos UI22 PASS; CMS publish/update-draft/get-published
3 suites/11 PASS. Son baseline legacy/especificación, no certificación de Fase4.
No se ha aplicado migración ni publicado ninguna página durante esta evaluación.

## Estado tras incrementos

Implementación y pruebas parciales registradas en
[el informe de Fase4](../qa/cms-phase-4-status-20261120.md).
[Envelopes implementados y límites pendientes](cms-phase-4-page-commands.md).
La migración se aplicó al CMS configurado tras las pruebas de coordinación. Preview dinámico autorizado e implementado; validación integrada pendiente.
No hay certificación ni avance de fase.

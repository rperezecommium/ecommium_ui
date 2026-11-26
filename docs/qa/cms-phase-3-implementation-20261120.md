# Fase 3 — Árbol de secciones

Fecha: 2026-11-20. Estado: **IMPLEMENTADO CON VERIFICACIÓN PARCIAL**.
No certificada. Fase4 no iniciada. La aprobación de avanzar desde Fase2 no
certifica los pendientes de aquella fase.

## Implementación realizada

- CMS→Secciones, Biblioteca/Diseño, con permisos Employee existentes.
- Árbol stack/flex/grid: insertar, mover, ordenar y eliminar contenedores;
  impedir ciclos y respetar profundidad8/nodos120 antes de persistir.
- Insertar módulos como copias materializadas con identidades nuevas. Editar
  la copia dentro de la sección sin guardar cambios en su módulo de biblioteca.
- Presentación responsive, CSS de sección dirigido a wrappers y renderizado
  de piezas mediante el renderizador compartido. No cambia la composición pública.
- Guardar/reabrir SECTION; creación idempotente y actualización con CAS.
  Conflicto conserva el borrador; reintento ambiguo conserva operationId/payload.
- CMS persiste en CmsSection; BFF valida contrato, contexto y Media; ReadIndex
  proyecta sections y resuelve listado/detalle por Organization/Shop/locale.

Archivos principales: `src/modules/cms/cms-section-builder-client.tsx`,
`cms-section-tree.ts`, `cms-independent-sections.ts`, acciones/tipos SECTION,
`app/(admin)/admin/cms/secciones/page.tsx`, `packages/cms-blocks/src/react.tsx`.
Backend: value object/repositorio/use case/controller SECTION en CMS;
use case/controller y puertos CMS/ReadIndex en BFF; lector/proyección en ReadIndex.

## Contratos y activación

Se conserva el schema aprobado: sectionCreate/sectionUpdate/sectionReceipt.
GET/POST `/api/v1/admin/cms/sections`, GET/PATCH `/:sectionId`; locale obligatorio.
Crear devuelve identidades materializadas y recibo persistido; mismo operationId
y entrada reproduce el recibo original, diferente entrada409. PATCH exige
expectedRevision y cambia revisionToken. No endpoint de clonación ni versionado UX.
Media conserva IDs compartidos y validación mediante el lector existente.
No almacén de negocio Next.js, lectura directa UI→CMS ni sustitución del legacy.

Migración aditiva `20261120000300_independent_sections` aplicada a la base CMS
configurada (Neon/cms_app), sin reescribir páginas. Build/reinicio CMS, BFF Admin
y ReadIndex mediante scripts canónicos, supervisor reiniciado; salud200.
El worker consumió los eventos de migración antes del reinicio del CMS y obtuvo
el snapshot antiguo: se diagnosticó por tiempos/eventos y se reemitieron los
cuatro scopes existentes con cms_commerce_read_emit_scope después del reinicio.
Evento fd50307f-efca-4137-b2eb-0507cd688695 observado aplicado.
Orden de despliegue: migrar, reiniciar nueva fuente, refrescar snapshots y
comprobar aplicación antes de habilitar la lectura SECTION.

## Pruebas realmente ejecutadas

| Prueba | Resultado / alcance |
| --- | --- |
| CMS Jest SECTION + copia MODULE | 7 PASS |
| BFF Jest SECTION + MODULE | 10 PASS |
| ReadIndex Jest SECTION + MODULE | 6 PASS |
| PostgreSQL desechable con migraciones y clases productivas | 9 PASS, base eliminada; no equivale a E2E |
| UI helpers SECTION + MODULE | 5 PASS |
| npm run test:cms-contracts | 22 PASS |
| Playwright SECTION aislado, 1440/768/390 | PASS; componentes reales, acciones simuladas, axe sin contraste |
| Playwright MODULE aislado, tres anchos | PASS, regresión compartida |
| Employee real Chrome→UI→BFF→CMS→ReadIndex | Crear, insertar Media, mover a profundidad3, guardar/reabrir, renombrar copia y reabrir PASS |
| Dos pestañas Employee reales | Segundo escritor guarda; obsoleto409 conserva borrador y no pisa revisión PASS |
| GET SECTION sin autenticación | 401 |
| URL pública del asset compartido | 200 |
| Builds CMS/BFF/ReadIndex y UI | PASS |
| npm run lint | 0 errores, 3 avisos previos ajenos a SECTION |

Colección Postman actualizada con crear/listar/reabrir/guardar SECTION y variables
de recibo/revisión/operationId; JSON y rutas comprobados. No se ejecutó la colección
como suite HTTP y no se contabiliza como certificación.

Scripts reproducibles: backend `scripts/test-cms-phase3-postgres.cjs`; UI
`tests/cms-section-tree.test.mjs`, `tests/e2e/cms-independent-sections-browser.mjs`.
Evidencias: [PostgreSQL](cms-phase-3-postgres-20261120.json),
[integración real](cms-phase-3-live-20261120.json).
El JSON de integración corrobora el documento persistido; las interacciones
fueron observadas en navegador, no son un E2E automatizado completo.

## Criterios de aceptación originales

| ID y criterio | Resultado y evidencia |
| --- | --- |
| A1 Copia independiente | Regresión parcial: copia de módulo editada/reabierta en sección sin alterar biblioteca; no repite toda Fase2 |
| A2 Identidad íntegra | Parcial: IDs nuevos y remapeo verificados en helpers/SQL; dos copias en browser aislado. Falta recorrido integrado completo links/ARIA/CSS |
| A3 Contexto y permisos | Parcial: scope/locale SQL y lector, guards, Employee escritor y anónimo401. Faltan Employee solo lectura y scope/locale ajenos por HTTP real |
| A4 Media compartida segura | Regresión parcial: mismo asset y URL200 en sección. Sustitución en sección y permisos ajenos no ejecutados |
| A5 Espacios anidados | Verificado: árbol/movimiento/guardar/reabrir reales; ciclo rechazado en pruebas de árbol y selección de destinos aislada |
| A6 Responsive y CSS | Parcial: tres viewports aislados y padding de wrapper sin fuga; faltan contenedores con integración real y contraste Compacta calculado contra Productos |
| A7 Página coherente | NO INICIADO, Fase4 |
| A8 Conflicto/publicación | Guardado concurrente real y CAS SQL PASS; publicación queda para Fase4 |
| A9 Plantilla independiente | NO INICIADO, Fase5 |
| A10 Compatibilidad | Parcial: MODULE SQL/browser y contratos; no se ha recorrido la matriz completa ni publicación legacy |
| A11 Fallos de edición | Parcial: invalidación y retry estable en browser aislado, replay SQL y conflicto real. No se ha probado toda la matriz de fallos con backend |

## Regresiones y limitaciones

Se mantiene Builder legacy; no se han migrado páginas ni cambiado su publicación.
Esto no demuestra por sí solo regresión publicada: Headers/Footers/Storefront
requieren recorrido integrado pendiente. Tampoco se certifica rendimiento máximo
del árbol, todos los módulos registrados, contraste accesible ni aislamiento de
propiedades CSS heredadas (la comprobación ejecutada cubre selectores/padding).
No se modificaron permisos para inventar perfiles de prueba. No se eliminaron
assets ni se publicaron páginas. Quedan recursos QA creados durante la prueba.

No hay aprobación de certificación implícita. La siguiente fase es
**4 — Simplificación de Páginas**, que no se inicia en esta entrega.

# CMS — cierre de Fase 1, 2026-11-20

## Resultado

**CERTIFICADA: definición de contratos y compatibilidad de Fase 1.**
D1–D3 aprobadas expresamente. No iniciadas fases2–6. No se certifica implementación
funcional futura ni disponibilidad de endpoints nuevos.

Se completaron los seis entregables originales: contratos propuestos, copia
independiente, identidad/contexto/Media/CSS, guardado/conflictos/publicación, matriz
de compatibilidad y aceptación. Las decisiones figuran en ADR0324 y contrato61 del
backend. El esquema ejecutable es la forma normativa; los validadores owner
existentes y las reglas escritas completan restricciones entre nodos/propiedades.

## Evidencia ejecutada

| Comprobación | Resultado observado | Alcance |
| --- | --- | --- |
| npm run test:cms-contracts | 19/19PASS | Requests/recibos,8 tipos funcionales,visual v2,CSS,bindings,identidad,Media local y presupuestos |
| node scripts/test-cms-phase1-postgres.cjs (backend) | 4 controlesPASS;2 bases retiradas | PostgreSQL real,clases CMS/Routing existentes y HTTP local |
| node tests/e2e/cms-unified-builder-browser.mjs | 3 casos responsivePASS | Editor real con acciones simuladas,preview/CSP/markup/axe/foco |
| npm run lint | 0 errores,3avisos anteriores | UI completa |
| npm run build | PASS | UI completa |
| HTTP BFF local fuera del sandbox | health200,biblioteca401,páginas401 | Denegación real sin sesión; cero mutaciones |
| CMS45/BFF10 anteriores | PASS | Suites focalizadas existentes; no sumar como tests únicos |

Los tres avisos lint están en customers-admin-actions.ts,request-client.ts e
invoice-document-pdf.ts. La suite UI CMS general auditada conserva35PASS/1FAIL por
la comprobación textual Biblioteca visual; no se eliminó ni se debilitó esa prueba.
No se declara que toda la suite general esté verde.

El ensayo PostgreSQL usa dos bases con nombre aleatorio bajo ce-postgres, aplica
los schemas Prisma existentes y las elimina al finalizar. No lee/escribe las tablas
CMS de la tienda. Crea identidad sintética solo dentro de esas bases y demuestra:

1. Copia inline independiente tras persistencia, cambio del original y reconexión.
2. Lecturas de repositorios rechazan otro contexto de página/definición.
3. Fallo inyectado después de crear la ruta pero antes de guardar versión CMS;
   el reintento publica el snapshot almacenado con una sola ruta y un outbox.
4. Repetir resolución/publicación de ruta con misma entidad/path no duplica la ruta.

[Resultado persistido del ensayo](cms-phase-1-postgres-20261120.json).
HTTP de ensayo invoca use cases Routing reales; no es un E2E de Employee/BFF.
El token es efímero y no se imprime. La inyección de fallo se limita al harness,
no altera código de producción ni sustituye persistencia por memoria.

## Criterios originales y cierre

| Entregable | Evidencia | Resultado |
| --- | --- | --- |
| Contratos propuestos | JSON Schema de composición/envelopes,contrato61 y ADR0324 | Acordados y formas comprobadas |
| Copia independiente | Reglas de remapeo y ensayo inline real,reapertura/origen | Semántica definida y soporte de persistencia contrastado |
| Identidad/contexto/Media/CSS | Negativos de IDs/bindings/selectores/URL; owner validators; scope de repositorio | Restricciones especificadas y conformidad focalizada |
| Guardado/conflictos/publicación | Protocolo CAS/operationId/snapshot; fallo/reintento real del puerto actual | Contrato definido y mecanismo actual reutilizable contrastado |
| Matriz de compatibilidad |9 clases legacy; inline/referencias/settings/site parts/publicado | Transición explícita y sin conversión automática |
| Casos de aceptación | A1–A11 con fases y pruebas exigidas | Conservados, no declarados funcionalmente superados |

## Límites y diferencias registradas

- HTTP000 previo era una restricción del sandbox. Se corrigió con comprobaciones
  autorizadas externas; no se necesitó levantar/reiniciar los servicios activos.
- Los schemas/ensayos no están conectados a rutas de producción. CAS,tabla de
  operaciones,árbol,secciones y plantillas nuevas se implementarán en sus fases.
- El normalizador actual admite src asset: con assetRefs vacío. La especificación
  nueva lo rechaza, también en contentValues media; test demuestra ambas condiciones.
  Integrar ese rechazo corresponde a Fase2. No se cierra SEC007 ni otros hallazgos.
- Media ID/URL/propiedad: conformidad de contrato y recorrido existente identificados;
  no se subió ni borró un asset real. Ese E2E continúa siendo requisito de Fase2.
- El ensayo de recuperación prueba mismo path, no concurrencia de publicación ni
  fallos distribuidos arbitrarios. La transacción/CAS nuevos se prueban en fase4.
- El presupuesto byte/nodos se probó en fronteras.120 módulos pequeños normalizados
  suman31820bytes (~2ms en esta máquina); no es SLA,benchmark de UI ni certificación
  de composiciones máximas renderizadas.
- Playwright usa acciones simuladas y axe excluye contraste según el pendiente
  transversal existente. No sustituye Employee→BFF→CMS ni certifica el editor nuevo.

## Reproducción

UI: npm run test:cms-contracts; npm run lint; npm run build.
La prueba semántica requiere el checkout backend con dependencias CMS/BFF instaladas;
ECOMMIUM_CONTRACT_BACKEND_ROOT permite indicar su ruta. Sin él falla, no omite tests.
Ajv6.15.0 ya instalado se declara ahora directamente como dependencia de desarrollo;
no se cambió la versión resuelta. Metadata package/lock verificada coincidente.

Backend: node scripts/test-cms-phase1-postgres.cjs. Requiere Docker local y
ce-postgres; descubre autorización en memoria,no imprime secretos. Solo crea/elimina
sus bases. No cargar URLs de bases comerciales en este script.

UI regresión: node tests/e2e/cms-unified-builder-browser.mjs.
No usar scripts/cms-e2e.mjs con defaults sintéticos contra datos comerciales.

## Siguiente fase

Fase2 — Constructor independiente de módulos. NO INICIADA. Esperar autorización
expresa posterior a este cierre. La certificación de Fase1 no equivale a certificar
ninguna funcionalidad todavía no implementada de fases2–6.

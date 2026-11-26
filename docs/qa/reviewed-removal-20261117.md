# Eliminación revisada — activada y revisión manual verificada

Continuación autorizada por Ricardo del plan1–5. La implementación sustituye
el borrador anterior de revisión conservadora. Se aplicó únicamente la migración
`20261117160000_reviewed_removal` y se reiniciaron los tres servicios autorizados.
No se eliminaron impuestos/tablas comerciales.

## Implementado

- Tax sustituto compatible con país y vigencia fiscal; preserva importe
  almacenado y taxIncluded, muestra neto/impuesto/bruto recalculados.
- Tabla sustituta recibe todos los precios/reglas de origen, incluidos inactivos
  y futuros. Sin sustituta solo se retiran con respaldo demostrado.
- Pricing usa resolución de reglas, producto/variante/variante predeterminada.
  BFF obtiene la herencia de Catalog y la vuelve a obtener al confirmar, ignorando
  lo que envíe el navegador. Comprueba contextos, tramos y límites de vigencia.
- Contextos/carritos que conservan el código antiguo deben disponer de respaldo
  válido; si no, se bloquea. No se reescriben snapshots de Checkout ni se inventa
  un alias del código eliminado. La revisión muestra también su total de respaldo.
- Impacto versionado, invalidación en límites temporales, confirmación atómica,
  rollback y recibo repetible. Paginación de50 filas para consultar todo el impacto.
- Schemas UI verifican importes, monedas, IDs, bloqueos, opciones, contexto y
  recibo exacto. Bloqueos traducidos a mensajes operativos.
- Cambio guardado y lecturas actualizadas son estados separados. La comprobación
  solo lee el recibo y la prueba ReadIndex de todos los contextos; no repite la
  eliminación. La UI no anuncia COMPLETE ante un fallo o retraso de lectura.

## Validación y límites

Comandos UI: `node --test tests/pricing-reviewed-removal.test.mjs
tests/pricing-admin.test.mjs tests/pricing-tax-actions.test.mjs`,
`npm run lint`, `npm run build`, después `npx playwright test
tests/e2e/admin-login.spec.ts --grep 'reviewed .* removal'`. Axe y responsive
se evalúan en ambos diálogos a1440/768/390px.

Backend: Jest Pricing/BFF/ReadIndex, builds y eslint focalizado.
`node scripts/pricing/test-reviewed-removal-postgres.mjs` desde composable
usa una base UUID desechable en ce-postgres y la retira al terminar. Incluye
producción BFF→adapter HTTP→Pricing HTTP→PostgreSQL con identidad sintética,
sustitución, cobertura, protección legacy, concurrencia, replay y rollback.
La prueba SQL ReadIndex usa tablas mínimas con dos contextos; no simula ni
acredita por sí sola la entrega viva de Rabbit/relays/worker.

El límite de10.000 casos por precio bloquea impactos excesivos. La revisión
monetaria muestra un escenario identificado, no todos los totales posibles.
No hay transacción distribuida con cambios independientes de Catalog; se
revalida su metadata al confirmar. No se cambió la política pública de precios.

La documentación canónica está en composable:
`.docs/01-decisions/ADR-0321-reviewed-pricing-reference-removal.md` y
`.docs/qa/reviewed-pricing-removal-20261117.md`.

## Antes de dar por terminada la activación

Preflight de migraciones, aprobación del plan exacto del entorno según AGENTS.md
del backend y aplicación únicamente de20261117160000_reviewed_removal.
Reiniciar solo Pricing, BFF Admin y Commerce ReadIndex mediante el launcher
canónico. Verificar sesión/permisos, revisión/cancelación y salud. La convergencia
a través del worker vivo requiere un scope de prueba autorizado, sin usar
impuestos o tablas comerciales como datos de ensayo. No certifica producción.

## Resultados registrados

193 pruebas Pricing,33 BFF,6 ReadIndex y21 UI PASS. Tres integraciones
PostgreSQL PASS (nueva revisión más primitivas legacy protegidas). Builds de
los cuatro componentes y Prisma validate PASS. Lint UI0 errores/3 avisos previos;
Pricing/BFF focalizado PASS. ReadIndex no declara lint. Flujo Playwright y axe
de ambos diálogos a1440/768/390 PASS con fixtures explícitas.

Preflight configurado de solo lectura: únicamente pendiente
20261117160000_reviewed_removal, sin migraciones fallidas. Ningún cambio comercial
ejecutado. El circuito vivo Rabbit/relays/worker queda para la activación
controlada; las pruebas aisladas no lo sustituyen.

Regresión final Playwright:6 PASS (dos flujos revisados con axe y responsive, dos controles de permisos, activación y alineación). No se ejecutó un rebuild global ni se modificaron datos comerciales.

## Activación autorizada — 2026-11-17

Ricardo autorizó explícitamente únicamente20261117160000_reviewed_removal y
reinicio selectivo Pricing/BFF Admin/Commerce ReadIndex. Preflight confirmó
única pendiente y ninguna fallida; migrate deploy terminó0 con Node22.
El launcher canónico reinició solo esos tres procesos y comprobó200 en
Pricing health, BFF Admin health y ReadIndex ready. El supervisor conserva
sus siete relays, ReadIndex worker y Catalog-retirement vivos, sin reiniciarlos.

Antes/después iguales:2590 precios,2302 activos,335 asignaciones de tabla,
912 fiscales y20 referencias. Tombstones fiscales/de tablas0 y recibos nuevos0.
No se crearon, eliminaron, desactivaron ni trasladaron recursos comerciales.

La revisión protegida de Pricing y BFF sin sesión devuelve401; no se usó
credencial técnica para suplantar un Employee. La sesión Employee guardada
del navegador entra, pero no ofrece tienda seleccionable; la revisión/cancelación
manual en tienda y la observación del transporte vivo de una operación quedan
pendientes de un contexto autorizado. No se cambiaron permisos, contraseñas ni
asignaciones para forzar esa prueba. Las pruebas BFF→HTTP Pricing y SQL de
convergencia descritas arriba siguen siendo aisladas, no evidencia de una
eliminación comercial ni de producción.

Logs privados de activación en /tmp/reviewed-removal-migration-activation.log y
/tmp/reviewed-removal-restart.log; baseline de contadores en
/tmp/reviewed-removal-activation-before.json, sin credenciales.

## Revisión manual autenticada completada — 2026-11-17

Ricardo seleccionó Tienda Barcelona (tienda-barcelona) e identificó Employee
ricardo@lavour.es. Se utilizó esa sesión por la UI normal, sin extraer cookies
o tokens ni suplantarla con credenciales técnicas. No se cambiaron permisos.

- Impuesto Default IVA:7 precios afectados. Sin sustituto, confirmación bloqueada.
  Al elegir IVA general España21%, se obtiene revisión válida y los siete netos,
  impuestos y brutos anteriores/posteriores. Un precio con impuesto incluido
  conserva120,44€ brutos y recalcula neto/impuesto; un precio neto20€ pasa en la
  revisión de22€ a24,20€ brutos. Se canceló, sin marcar consentimiento ni confirmar.
- Tabla B2B España Retail: revisión válida con0 asignaciones. Se canceló.
- Tabla legacy vip:6 precios afectados. Sin destino, bloquea3 por ausencia de
  cobertura. Elegir VIP table como sustituta conserva el bloqueo porque las
  consultas que mantienen el código antiguo quedarían sin precio para esas3
  asignaciones. Mensajes traducidos y confirmación deshabilitada. Se canceló.
- Tras cancelar, el listado conserva sus6 tablas. Comprobación SQL de solo
  lectura:2590 precios,2302 activos,335 asignaciones de tabla,912 fiscales,20
  referencias; iguales al baseline. Tombstones0/0, recibos0.

Queda cerrado el bloqueo anterior de acceso/contexto para revisión y cancelación.
No se ensayó una eliminación real ni su propagación completa por Rabbit/worker
en la base comercial: el transporte de la operación permanece acreditado solo
en las pruebas aisladas descritas arriba. No se amplía ese alcance ni se declaran
modificados datos comerciales.

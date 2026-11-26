# Eliminación permanente de características — 2026-11-07

## Alcance y comportamiento

Implementación solicitada después de revisar los límites de Desactivar. Junto a esa acción se incorpora Eliminar definitivamente en listado y formulario, solo con permiso `catalog.specifications.delete` y capacidad BFF habilitada. Desactivar sigue siendo reversible y conserva asignaciones. Eliminar borra solo el campo, sus valores y sus asignaciones; conserva productos, grupo y características hermanas.

Al abrir: indicador Calculando impacto de eliminación → resumen canónico de productos/categorías/todas las tiendas compartidas. Advertencia irreversible. Si hay productos se exige escribir el nombre canónico exacto; si no hay, botón de confirmación explícita. Cancelar no muta. Durante envío se bloquean doble clic/cierre. 409 retira la confirmación anterior y exige recalcular. Employee/contexto/version/scope se verifican también en BFF/Catalog.

Antes del POST se guarda operationId UUID en la URL. Un resultado incierto navega al seguimiento de ese mismo recibo; reload conserva la referencia. Comprobar estado solo lee. Reintentar sincronización envía `{}` al retry de ese recibo y no repite la eliminación. La autorización del recibo se vuelve a comprobar sobre todos los scopes. El seguimiento permanece accesible con permiso aunque el flag se deshabilite después.

No se declara completado solo porque desaparezca del listado: se verifican también selecciones de productos, definiciones y readiness en todos los contextos comerciales activos ReadIndex de todas las tiendas registradas afectadas. Una tienda/contexto no verificable impide éxito. Solicitar invalidación por el puerto existente no certifica entrega final en caches/proveedores externos.

## Implementación backend

Contrato completo: `/Users/ricardoperez/Documents/ecommium/composable_ecommerce/.docs/06-interfaces/48-specification-field-permanent-deletion.md`.

Catalog persiste recibo/auditoría/targets/outbox con el borrado en transacción SERIALIZABLE. Los eventos scope.targets contienen como máximo100 productos y utilizan el nuevo reason allowlisted `specification-field-deleted`. La reemisión consulta targets persistidos y nunca repite DELETE. Tombstones impiden que un editor antiguo recree el mismo fieldId. La edición ordinaria sigue funcionando antes de la migración gracias a comprobación de metadata. No se añade backend paralelo ni app/api de dominio; todas las Server Actions consumen StoreAdmin BFF con Employee/contexto.

## Pruebas y evidencia

- `npm test`: **605 PASS**, incluidos6 nuevos casos del contrato/acciones de borrado. Permiso write no equivale a delete, contexto cambiado bloquea, payload no admite actor/scopes del navegador, validación de identidad/contadores y guard de disponibilidad fail closed.
- `npm run lint`:0 errores,3 avisos previos ajenos en customers-admin-actions/request-client/invoice-document-pdf.
- `npm run build`:PASS, TypeScript incluido.
- `npx playwright test tests/e2e/admin-login.spec.ts --grep 'feature permanent deletion'`: **3 PASS**, BFF fixture y Next de producción en puertos efímeros. Usada/sin uso, spinner, cancelar/foco/Escape, nombre escrito, doble clic→un POST, conflicto409, permisos/flag, respuesta perdida/reload y retry solo sincronización. Axe sin violaciones a1440/768/390; sin overflow horizontal.
- Backend: builds Catalog/BFF/CommerceReadIndex/Employees PASS. Catalog5 pruebas del caso de uso, BFF16 de controlador de eliminación/lifecycle/taxonomía y RI5 del repositorio PASS. Prisma validate offline con URLs ficticias válidas PASS; no conecta/migra.
- `node --test services/catalog/test/specification-lifecycle.integration.cjs`: PASS con PostgreSQL real **local desechable**.2.000 productos/4.000 selecciones; tras retirar expresamente una selección del fixture, borrado retira1.999 del campo elegido y conserva2.000 del hermano y todos los productos. Alcance parcial403, revisión obsoleta409/nombre erróneo400 sin recibo ni cambio; actor auditado, repetición idempotente, operación distinta rechazada, tombstone y reemisión. Todos los eventos emitidos validados con sourceEvent real de ReadIndex y lotes<=100.
- El mismo test ejecuta SQL real del seguimiento ReadIndex con2 contextos activos; selección/definición residual en el segundo contexto impide cero global, contexto no READY y scope sin contextos no confirman.
- Budget JS:9 chunks únicos reales de clientModules RSC + rootMainFiles;151.808 bytes gzip, por debajo de250KiB. No hay librerías pesadas nuevas ni descarga de productos en la UI. La consulta de capacidad se hace en servidor; impacto solo al abrir. No se ejecutó Lighthouse/carga ni se certifican TTFB/LCP/INP productivos.

Los primeros intentos Docker/puertos del sandbox necesitaron ejecución autorizada fuera del sandbox. Las pruebas finales no acceden a Neon ni cambian datos de negocio reales.

## Activación pendiente

No se han aplicado migraciones reales ni recargado servicios reales con esta nueva funcionalidad. Catalog tiene API local pero sus URLs DB vigentes apuntan a **Neon, catalog_app**. La migración aditiva crea specification_field_deletions y specification_field_deletion_targets; ReadIndex requiere índice GIN local. Destino remoto requiere aprobación final concreta antes de ejecutar. No ejecutar migrate deploy a ciegas con migraciones ajenas pendientes.

Orden preparado: revisar/aplicar solo migración aprobada Catalog, migración de índice por el flujo ReadIndex, API/worker RI con nuevo reason antes de productores, Catalog/BFF/Employees, y finalmente `CATALOG_SPECIFICATION_FIELD_DELETE_ENABLED=true` en Catalog. Sin flag/tablas, capability false y UI oculta Eliminar. Verificación real posterior: abrir impacto y cancelar; no borrar datos reales de prueba por iniciativa propia. No se da por desplegada la funcionalidad ni se certifica mutación de producción.

Postman agrega capability/impacto/confirmación/seguimiento/retry. Confirmación destructiva y reemisión requieren opt-in de un único envío; variable se restablece a false antes del envío, preservando operationId si se pierde respuesta.

Regresión final conjunta: `npx playwright test tests/e2e/admin-login.spec.ts --grep 'feature permanent deletion|feature deactivation|catalog attributes and features page'`: **7 PASS**. Employees permissions-catalog **5 PASS**; lint focalizado Catalog/BFF sin errores; build final UI/BFF/RI PASS. El preflight SQL verifica capability=false antes de las tablas y true después en la base desechable. `git diff --check` de las superficies editadas sin errores. La activación real continúa pendiente y no se ha eliminado ningún dato real.

## Activación completada con autorización — 2026-11-07

El usuario autorizó expresamente migrar Catalog/Neon y activar el flujo. El apartado anterior de activación pendiente describe el estado previo a esa autorización.

- Catalog catalog_app: solo20261107210000 aplicada por Prisma;36 migraciones terminadas,0 pendientes, sin fallos nuevos. Conserva drift histórico de20260513130000_add_variant_shipping_profile sin reescribirlo.
- ReadIndex local: solo20261107211000 aplicada en4 schemas con el migrador canónico sobre conjunto privado limitado a ya aplicadas+autorizada. Se conservan las dos pendientes antiguas de invalidación PLP en a/b/c; no hubo despliegue ajeno por arrastre.
- API/worker RI preparados antes de productor. Catalog/BFF/Employees recargados por restart-selected del script canónico con Node22/npm10. Flag guardado solo en configuración privada Catalog. Primero se observan0 botones con capability apagada; tras habilitar se observan6 botones.
- UI real Employee: Eliminar definitivamente aparece en listado/formulario. Durabilidad muestra1 producto,2 categorías,11 tiendas; confirmación bloqueada sin nombre exacto. Abrir y cancelar desde ambas superficies conserva Activa y vuelve al listado sin diálogos abiertos. Se conserva el borrador de producto en otra pestaña.
- Readiness Catalog/StoreAdmin BFF/Employees/ReadIndex HTTP200; worker READY. Tabla de operaciones de borrado0 y targets0: ninguna eliminación real realizada.

La verificación HTTP privada detectó3 productos/2 definiciones en2 contextos ReadIndex frente a1 producto canónico. Se corrigió el evento specificationGroup de eliminación para incluir fieldId y recorrer por keyset de25 los productos que **el propio índice** conserva con ese campo. Los refresca desde snapshots actuales, aunque ya no figuren entre las asignaciones canónicas capturadas. Mantiene los targets canónicos durables en lotes de100. El consumidor descubre además contextos activos del scope autorizado, los une a la configuración y solo marca proyectado tras recorrer todos. No amplía scopes, inventa contexts ni borra productos por iniciativa propia.

Se corrigió también el BFF para que el seguimiento no exija un único contexto comercial configurado: selecciona un contexto válido de transporte y la consulta ReadIndex comprueba todos. Scope sin acceso o contexto/tienda no operativo continúa pendiente, no falso éxito. No se certifican los bindings/consumidores de todos los scopes históricos del entorno.

Pruebas finales adicionales:13 BFF (incluida configuración multicontexto y rechazo de scope ajeno),9 RI (replay de referencias obsoletas y descubrimiento de contexto adicional), SQL PostgreSQL desechable PASS con27 referencias paginadas, aislamiento de contexto/scope, idempotencia y preservación de2.000 productos. Builds Catalog/RI/BFF y lint focalizado BFF PASS. Esta fase no cambia UI ni repite sin motivo sus605 unitarios/7 E2E previamente aprobados.

Scripts y resultados privados: composable_ecommerce/.tmp/specification-cleanup-20261107/activation-*.json/log y procesos; no contienen secretos en la evidencia sanitizada. No se usa un bearer técnico para operaciones Employee. No se rotan permisos/credenciales ni se purgan colas/DLQ. Rollback operativo: flag Catalog=false y recarga selectiva Catalog; no revierte borrados reales. Contrato48 y docs138/139/backlog/plan sincronizados.

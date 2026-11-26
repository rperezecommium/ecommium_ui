# Evidencia de eliminación revisada — 2026-11-09

Estado: implementación local preparada; activación remota bloqueada, no completada.

## Validación ejecutada

- UI: `npm run lint` sin errores (tres advertencias previas ajenas); `npm run build` y TypeScript correctos.
- UI: tests de contrato de eliminación, sitemap, identidad del borrador y guardado:12 pasan.
- Playwright: tres casos pasan (10,5s): confirmación/cancelación, doble clic, recuperación tras respuesta perdida, variante persistida. Incluyen axe sin incidencias y anchos1440/768/390. Fixtures aislados; no modifican productos reales.
- Catalog: saga y autorización25 pasan. BFF: namespace y PDP12 pasan. Search: ledger y adaptador9 pasan.
- `scripts/catalog-retirement.integration.cjs`: ocho pruebas pasan con PostgreSQL local real y esquemas desechables; se limpiaron al terminar. Usa proveedores de binarios/Search simulados.
- Builds de Catalog, Inventory, Pricing, Media, Routing/SEO, CMS, Search, ReadIndex y BFF correctos durante la implementación. Manifiesto BFF525 rutas validado.
- Surface E2E Storefront pasa. Surface E2E Admin falla en coupons (503 frente a200), fuera de la superficie modificada; no se declara suite global verde.
- `node --check scripts/catalog-retirement-runtime.mjs` pasa. Postman actualizado con opt-in QA y referencia `QA-RETIREMENT-`; no ejecutado contra datos reales.

## Límites y bloqueo

No se aplicaron las seis migraciones a bases remotas ni se activaron flags. La revisión automática rechazó el DDL remoto por alcance de autorización y posible uso compartido. No se eliminó BICI-20260929-172 ni otro producto real. Falta validación integrada en runtime después de autorización remota. No hay certificación de borrado Google/CDN real, performance de producción ni Lighthouse nuevo. Historial fiscal, backups y auditoría no se purgan. El ledger Search requiere persistencia compartida si hay varios escritores.

Lint focalizado final: Catalog, Pricing y Media pasan. Inventory, Routing/SEO, CMS y Search no tienen configuración ESLint local resoluble; el comando no pudo ejecutarse para esos cuatro servicios. Sus builds indicados arriba sí pasaron.


## Activación autorizada — 2026-11-09

Ricardo autorizó expresamente las migraciones remotas. `catalog-retirement-runtime.mjs apply --allow-remote` aplicó las seis migraciones y `enable` verificó las seis APPLIED y configuró flags locales. Reinicio canónico de los once servicios afectados: health correcto. Prueba Playwright real en curso con QA-RETIREMENT-20261109-1543; BICI-20260929-172 se conserva activo en el listado. Esta actualización sustituye el bloqueo de activación descrito anteriormente.


## Resultado real tras activación

Playwright con sesión Employee real: creó QA-RETIREMENT-20261109-1543 y variante talla QA1543. Cancelar no eliminó. Variante: operación322b7dc5-d0c6-4a6e-8b78-983b833bc7b7 COMPLETED; padre conservado. Producto: operación58ffee55-0ea4-4655-9478-bf45e881c261 COMPLETED; retirada incluyó una ruta SEO. Tras cerrar: cero filas QA y una fila BICI-20260929-172 en la página del listado. PDP QA404; sitemap XML200 no-store, sin slug QA. No se borraron productos reales del usuario.

Se corrigió la verificación ReadIndex que agotaba el timeout: una consulta agregada con filtro indexado de producto sustituye nueve consultas secuenciales. Prueba real:159ms, dos contextos activos y cero referencias. Build ReadIndex y ocho integraciones SQL aisladas vuelven a pasar. Se cubrieron respuestas públicas de error con no-store (dos tests BFF pasan; build correcto).

Límite: el QA real fue un borrador sin binarios ni stock/precios persistidos; las dependencias completas y medios se validaron con PostgreSQL local y proveedores simulados. No equivale a certificar eliminación real de binarios Google ni purga CDN de producción.

## Extensión asíncrona — cierre de laboratorio 2026-11-09

Estado: implementación en código, validada en laboratorio; **no activada en la base remota**. No confundir con las seis migraciones y el QA síncrono autorizado anteriormente. BICI-20260929-172 no se eliminó ni se modificó en estas pruebas.

Comando final backend (Node22.23.2): `node scripts/catalog-retirement.integration.cjs --worker --ui` → **14 comprobaciones PASS**. PostgreSQL local `ce-postgres` en schemas aleatorios `retirement_qa_*`, exchange/colas privadas Rabbit `qa.retirement.*`, archivos locales desechables. Ejecuta repositorios SQL de los owners y el coordinador existentes; worker es un proceso separado del entrypoint Catalog consumer. Al terminar limpia sus schemas, colas/exchange y archivos. El escenario UI ejecuta Next compilado, Chromium y el controller/use-case/repository Catalog reales con auth sintética limitada al laboratorio; BFF y proveedores externos tienen bridges controlados. No es sesión Employee de producción ni certificación de Google/CDN.

Evidencia comprobada por assertions:

- Rechazo de default variant y scope ajeno; idempotencia y ausencia de cambios de origen antes de la confirmación legacy.
- Barreras de stock/reservas y de escrituras antiguas; borrado variante conserva padre/galería; producto limpia opciones, medios, precios, stock y SEO multilenguaje/cadenas de redirects; CMS compartido bloquea antes de limpiar.
- COMPLETED espera todos los contextos activos de ReadIndex; prueba con proyección residual sigue pendiente y solo completa al desaparecer.
- Aceptación asíncrona escribe PENDING, origen inactivo, fences y outbox en un commit. Antes de arrancar el worker aún existen filas y binarios físicos.
- SIGKILL real de Search recupera ledger y lock; SIGKILL del worker **después del efecto Media y antes de guardar recibo** recupera la misma operación, prueba ausencia de original/miniatura y no repite destructivamente metadata ya eliminada. Incluye503 temporal de Pricing y reintento.
- Dos variantes hermanas se procesan con exclusión por producto y conservan padre/default/stock29. En este caso el proceso worker tiene admisión asíncrona desactivada: las operaciones ya aceptadas aún conservan avance, resultado y auditoría durables.
- **200 solicitudes durables** terminan todas con concurrencia2 y reinicio real del worker durante la cola; cada operación tiene log COMPLETED y no quedan targets pendientes de esa tanda.
- UI: confirmación retira la fila en menos de5s sin iniciar worker; el API se mata con SIGKILL y vuelve en el mismo puerto; refrescar no hace reaparecer el producto; navegar a eliminaciones funciona; se cierra un navegador Chromium separado y solo entonces arranca el worker. Final: misma operación COMPLETED, filas de origen0, originales/miniaturas ausentes, log COMPLETED y **cero POST del navegador para impulsar pasos**. Última ejecución de este E2E: PASS5,6s (tiempo total del test, no duración del borrado remoto).

Comandos complementarios:

- UI `npx playwright test tests/e2e/admin-login.spec.ts --grep 'catalog retirement (confirms|blocks|removes)'` →3PASS (confirmación/cancelación/responsive/axe, respuesta perdida con la misma clave, variante conserva padre).
- UI `node --test tests/catalog-deletion.test.mjs tests/storefront-category-context.test.mjs` →8PASS. `npm run build` PASS. `npm run lint`:0errores y3warnings preexistentes ajenos a estos cambios.
- Catalog saga9PASS; Search ledger5PASS; Inventory auth/admission5PASS; BFF visibility/cache5PASS; validación de mutaciones pendientes en los seis owners30PASS; Media contexto gobernado del worker2PASS. Los builds de Catalog, Inventory, Pricing, Media, RoutingSEO, CMS, Search y BFF pasan.
- Lint focalizado Catalog/Pricing/Media PASS tras formato. Inventory/RoutingSEO/CMS/Search carecen de configuración ESLint en sus paquetes; no se creó una configuración nueva para ocultar ese gap. Builds y tests de esas superficies sí ejecutados.

### Bloqueo preciso de activación

Consulta **solo lectura** `node scripts/catalog-retirement-runtime.mjs plan --async` detecta Catalog remoto, fingerprint `ac6e6e9ef656`, migración `20261109200000_catalog_retirement_async` **PENDING**, SHA256 `38cb1f7caad4d076b200975353bd7d535418e9d66a037210e4fc5ba201d4c53d`.

La migración añade a `catalog_retirement_operations` cinco columnas (`next_attempt_at`, `attempts`, `audit_events`, `audit_delivered`, `audit_next_at`) y dos índices (`catalog_retirement_due`, `catalog_retirement_target`). No borra datos, no crea otra tabla de operaciones ni migra otros dominios. Es necesaria para scheduling, reintentos y entrega recuperable de auditoría; la aceptación asíncrona falla cerrada si no existe. No se ejecutó DDL remoto ni `enable --async`; el modo previo permanece disponible.

Siguiente acción de activación, exclusivamente tras autorización remota específica: `catalog-retirement-runtime.mjs apply --async --allow-remote`, comprobar APPLIED/checksum; `enable --async --scopes-file <archivo privado revisado>`; reiniciar APIs afectadas y arrancar el consumer existente con `./scripts/postman-services.sh catalog-retirement-worker`. Configurar ese proceso bajo el supervisor existente para reiniciarlo tras reboot. Después verificar en el entorno conectado un producto QA con binarios exclusivos y no tocar BICI ni datos ajenos al laboratorio.

Límites reales: la verificación actual de proveedores y consultas públicas usa puertos controlados; no prueba eliminación de objetos Google reales, recuperación multi-host de Search ni purga inmediata de CDN externo. La activación CLI exige edge `none`/no-store. Los contadores paginados pueden converger después de ocultar las filas. Estos límites no se declaran resueltos por los14PASS.

## Activación asíncrona autorizada y prueba conectada — 2026-11-09

Ricardo autorizó expresamente aplicar la migración adicional. Se ejecutó únicamente `catalog-retirement-runtime.mjs apply --async --allow-remote`: Catalog remoto fingerprint `ac6e6e9ef656`, migración `20261109200000_catalog_retirement_async` APPLIED, SHA256 `38cb1f7caad4d076b200975353bd7d535418e9d66a037210e4fc5ba201d4c53d`. Cinco columnas y dos índices; ninguna otra migración ni borrado directo por SQL. Sustituye el bloqueo de activación descrito en el cierre de laboratorio anterior.

Activación con scope Organization11111111-1111-4111-8111-111111111111 / Shop22222222-2222-4222-8222-222222222222, edge `none`/no-store. Reinicio canónico de APIs afectadas. Worker incorporado **al supervisor existente** `scripts/commerce-read-runtime.mjs`; `postman-services.sh up/up-missing/restart-selected` ya arranca ese supervisor. No hay nuevo servicio, framework ni supervisor paralelo. Sus pruebas incluyen perfil opcional y reinicio/drenado:2PASS. El supervisor reanudó el worker dos veces después de SIGKILL real; queda activo y no pausado. Se probó reinicio de API y worker, no reboot físico del ordenador ni instalación de autostart del SO.

### Hallazgos reales corregidos antes del cierre

- Pricing y Media no habían registrado el prefijo HTTP interno, aunque disponían del guard: capability/prepare devolvían404. La variante quedó RETRYABLE/BLOCKED de forma durable, sin reaparecer ni fingir éxito. Se registraron ambos prefijos en sus controllers existentes;18 pruebas HTTP (tres por cada uno de los seis owners) verifican rutas, scope y separación de credencial Employee/máquina. Se reencoló **la misma operación** desde Admin; terminó sin reconstruir el flujo.
- Corregido el identificador de admisión de precios a `pricing_id`, la columna real de su snapshot.
- Durante PENDING, filtrar el DTO de resolve-path podía dejar una respuesta200 incompleta y producir una página404 con estado200. BFF ahora devuelve404/no-store antes de ejecutar resolve-path/page para el path de un producto pendiente. Dos regresiones nuevas de preflight y dos previas de caché pasan (4PASS). Nueva comprobación Playwright real con worker pausado: HTTP404, noindex y producto ausente mientras la operación seguía PENDING/step0.

### Pruebas desde Admin real

Playwright inició sesión Employee mediante el login de la UI. Creó exclusivamente `QA-ASYNC-20261109-2017`, publicó precio19.95EUR, varianteL con stock1, imagen PNG exclusiva, tres miniaturas Google y SEO. PDP inicial200 y sitemap contenía el slug; original y tres miniaturas respondían200 en Google Storage.

| Solicitud | Operación | Resultado |
|---|---|---|
| VarianteL QA | da165a88-902f-49ab-bf0d-0e5c6b805552 | COMPLETED/15; precio y stock de variante retirados; padre, galería y SEO conservados;25/25 registros de auditoría entregados |
| Producto QA | cb76c909-fa78-446b-8d31-c3ecdd0b94f9 | COMPLETED/15;17/17 registros entregados; sin producto, variantes, precios, stock, media ni rutas operativas |
| Borrador mínimo QA de SEO | e30b53eb-c732-441e-99b9-e00f06ce7b97 | COMPLETED/15;17/17 registros entregados;404/noindex comprobado durante PENDING |

Confirmación del producto principal: modal cerrado tras **1825ms**, retorno al catálogo y cierre real de un **Chrome aislado**. No se cerraron las pestañas existentes del usuario. Con worker pausado se confirmó PENDING/step0 durable, origen inactivo y archivos todavía existentes. Reinicio real del API Catalog: la solicitud permaneció. SIGKILL del worker identificado: el supervisor lo repuso y completó la misma operación sin navegador abierto ni POST del navegador para avanzar pasos.

Verificación final independiente: los seis participantes devuelven proof complete=true para las tres operaciones; ReadIndex real devuelve **dos contextos activos, remaining0 y complete=true**; Log real devuelve registros COMPLETED por correlationId. Google Storage devuelve **404 para el original y las tres miniaturas**. Ambas PDP QA devuelven404/noindex; sitemap200 sin ambos slugs. El listado Admin no muestra QA tras refrescar. BICI-20260929-172 sigue presente; no se editaron ni eliminaron productos ajenos a estos QA.

Evidencia privada saneada en `.tmp/catalog-retirement-runtime/final-proof.json`, consultas de solo lectura y capturas Playwright en el repo UI. Scripts privados de verificación no contienen credenciales: las leen de la custodia existente sin imprimirlas. Solo se conservan recibos, auditoría y tombstones intencionales. La prueba de cola200 corresponde al laboratorio descrito arriba; no se crearon200 productos en las bases conectadas. No certifica CDN externo, recuperación multi-host de Search ni provisión productiva.

Operación: usar Node22 y `./scripts/postman-services.sh up-missing`; consultar `node scripts/commerce-read-runtime.mjs status`. Apagar con el launcher/supervisor existentes, sin borrar scopes, credenciales, ledger ni recibos. No apagar worker ni retirar token mientras queden solicitudes aceptadas. La lógica durable permite recuperarlas al volver a levantar el stack, independientemente del navegador.

# Baja de características de prueba — 2026-11-07

Petición: retirar únicamente las tres características QA PW 20261106 de Tienda Barcelona, Organization Ecommium Default Organization, locale es-ES. Se conserva material/durabilidad/elasticidad y los demás datos reales.

## Evidencia real

Las acciones de baja usan la sesión Employee del navegador y exclusivamente StoreAdmin BFF. La UI hace GET del grupo y PATCH del grupo conservando campos y relaciones, con isActive=false para el campo seleccionado. No hay eliminación física contractual implementada en esta UI.

La respuesta canónica del PATCH confirmó el campo y su isActive=false para:

- Compatibilidad QA PW 20261106: 38f6ec95-c641-4cd2-9907-238499d0f8db.
- Compatibilidad QA PW 20261106 B: 980d8bc7-9948-4ed4-8a6f-8f818c16701f.
- Compatibilidad QA PW 20261106 C: 28913a6a-9e06-4fcf-b262-e44de8576c5f.

Las tres acciones alcanzaron el redirect updatedFieldId correspondiente con expectedActive=false, que solo ocurre después de comprobar identidad y estado de respuesta. La lectura posterior sigue mostrando ocho campos activos, incluidos los tres anteriores. Por tanto, la baja está confirmada por la mutación, pero NO está certificada su convergencia ni su desaparición del editor. No se afirma eliminación física ni limpieza completa. No se ocultan filas localmente ni se inyectan fixtures. Ya existía el gap de lectura en catalog-feature-create-20261106.md.

## Corrección UI

Antes la acción ignoraba BffResult y revalidaba incluso ante rechazo. Ahora muestra error público/status/correlationId cuando falla, exige confirmación de identidad/estado y distingue confirmación de mutación de lectura pendiente. Se preserva la pestaña de atributos/características. Refrescar repite solo la lectura y mantiene el aviso de la última operación. Los parámetros de URL son presentación, nunca autorización ni sustitución de datos BFF.

La instrumentación temporal de diagnóstico registró solo claves de formulario y ok/status; fue retirada. No se imprimieron tokens/cookies ni datos sensibles. No se consultó ni modificó el repo backend, bases de datos o servicios internos.

## Gap y siguiente paso

Investigar en backend la discrepancia entre PATCH canónico y GET de especificaciones/ReadIndex, su invalidación y la convergencia de la proyección para esta tienda. La UI no dispone de un contrato documentado de resincronización ni debe inventarlo. Se solicita sincronización explícita conforme a AGENTS.md antes de acceder al repo backend. La petición de autorización queda pendiente.

## Validación

- node --test tests/catalog-feature-update.test.mjs tests/catalog-feature-create.test.mjs tests/product-feature-flow.test.mjs: 16 PASS.
- npm run lint: 0 errores, 3 warnings preexistentes (customers-admin-actions, request-client, invoice-document-pdf).
- npm run build: PASS, TypeScript incluido.
- Navegador Playwright con BFF real: tres bajas confirmadas, banner de lectura pendiente visible, lista desactualizada comprobada.
- No se levantó/reinició backend ni se ejecutó postman-services.sh; estaba disponible.
- No se ejecutaron suite E2E aislada completa, axe, responsive o Lighthouse. No cambian shell, consultas, datasets ni cargas JS; la limitación operativa pendiente es la proyección backend.

## Cierre tras autorización de backend

Ricardo autorizó revisar/corregir backend. La API ReadIndex estaba activa, pero no había relay Catalog ni consumidor ReadIndex ejecutándose. Se recuperaron ambos con configuración/credenciales locales existentes, sin cambios de código backend, rotaciones, migraciones ni reconstrucción global. Se dejaron activos.

El usuario renovó login Employee. Comprobación real Playwright del2026-11-07 a las19:43 Europe/Madrid:

- Tienda Barcelona, características activas: siete reales y cero QA.
- Inactivas: las tres QA con los fieldId ya identificados.
- Producto nuevo, categoría bicicletas: General/Material, material/durabilidad/elasticidad y pintura/Pintura; no aparecen los tres grupos Pruebas UI PW. No se guardó ni creó producto.

Resultado: baja lógica y limpieza visible verificadas, no eliminación física. El incremento de características reales visibles respecto a la lectura anterior corresponde también a la sincronización recuperada. Se conservan los pendientes históricos generales de eventos; no se certifica supervisión de workers tras reboot. Evidencia backend: `.docs/03-architecture/24-specification-cleanup-recovery.md` en composable_ecommerce.

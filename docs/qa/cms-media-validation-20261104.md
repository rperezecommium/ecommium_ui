# CMS vacío e imágenes corruptas — 2026-11-04

## Resultado y causa
Corrección autorizada en UI, Media y cliente BFF de Media. El constructor CMS omitía la validación UI; Media almacenaba el original antes de decodificar; el BFF convertía todos los rechazos de Media en503. Esto podía dejar originales sin colección y presentar un archivo inválido como caída de servicio.

- El constructor valida antes de consultar/crear colecciones y envía el archivo normalizado.
- Media valida y genera miniaturas de todo el lote antes de escribir; Sharp rechaza contenido corrupto/truncado y limita la entrada a40 millones de píxeles. Las imágenes válidas conservan original y tres variaciones.
- Create/add-items esperan todos los escritores del lote antes de compensar un fallo de storage, metadata o transacción. Se retiran únicamente claves nuevas del intento, también ante PUT persistido cuya respuesta se pierde. Borrados fallidos se informan como compensación incompleta.
- El BFF conserva400 para entrada inválida en ambas operaciones de subida, con mensaje público. Fallos operativos conservan503. No cambian otras operaciones ni endpoints.

## CMS vacío
No reproduce el fallo en el código actual: las pruebas existentes de configuración inicial pasan. Lectura real del BFF con tenant seed y locale fr-FR sin contenido: pages200 con0 items, site-parts200 con0 items y settings/global200 con configurationState INITIAL. No se escribió configuración por leer. No se añadió fallback que convierta500 en lista vacía ni se alteró contenido existente.

## Evidencia
| Control | Resultado |
| --- | --- |
| UI `npm test` |557 aprobadas |
| UI lint/build | Aprobados;3 advertencias preexistentes |
| Media `npm test -- --runInBand` |79 aprobadas, incluidas10 nuevas de decodificación/compensación |
| Media build + ESLint de archivos afectados | Aprobados |
| BFF media-client/media.controller/cms-admin-settings/manage-admin-cms |27 aprobadas |
| BFF build + ESLint de archivos afectados | Aprobados |
| CMS configuración inicial/site-parts/listado |5 aprobadas |
| BFF real → Media actualizado: PNG con firma válida y cuerpo truncado |400; antes del ajuste del cliente BFF devolvía503 |
| Playwright listado CMS | Aprobado |
| Playwright listado Media | Falla esperando petición de miniatura asset-admin-1 small_default; no llega a la baja. Este recorrido no usa el constructor CMS modificado. No se presenta como aprobado ni se amplía aquí la reparación general de la suite pendiente |

Reinicio local acotado: `./scripts/postman-services.sh restart-selected media` y luego `restart-selected bff-admin`, con Node22 y supervisor separado. No se reinició CMS ni otros servicios. No se certifica producción.

## Límites y artefactos
No se crearon colecciones ni otros datos de negocio. No se accedió directamente a buckets. La ausencia de escrituras en el rechazo y la compensación se verifican con el decodificador Sharp real y storage/repository instrumentados; la prueba BFF real confirma400, sin inventar un conteo remoto de objetos.

El posible huérfano histórico `22222222-2222-4222-8222-222222222222/qa-20261104-media-c34317fd/` continúa en el ledger previo de limpieza; no se afirma eliminado. No hay API BFF para retirar ese objeto suelto. La compensación cubre errores capturados: un apagado abrupto o un borrado denegado siguen requiriendo reconciliación operativa; no se promete atomicidad distribuida.

Scripts y evidencia sanitizada en `/private/tmp/import-ui-review/cms-*`, `media-*`; trazas E2E fallidas en `test-results/`. Permanecen identificados para limpieza cuando se ordene. No se añaden tareas de proveedor, permisos ni infraestructura. SEC-007 conserva sus otros pendientes (por ejemplo polyglots).

## Seguimiento de suite E2E
El fallo histórico de espera de miniatura queda cubierto por la actualización
de la suite: imagen del detalle desplazada a vista, decodificación comprobada
y petición al BFF verificada con el permiso real en el mock. Pasada completa
96/96. Véase `e2e-suite-refresh-20261104.md`; la evidencia previa se conserva.

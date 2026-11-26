# Desactivación revisada de características — 2026-11-07

## Resultado

Implementación autorizada1–5: acción Desactivar, revisión canónica de impacto, confirmación explícita, progreso y prevención de doble envío, comprobación separada de ReadIndex, validación de permisos/contexto/versión en servidor. La UI sólo consume StoreAdmin BFF; no se añadió app/api ni se alteró autenticación.

La papelera y el botón Eliminar se sustituyen por Desactivar en listado y formulario. La casilla Activa no permite desactivar directamente una definición activa desde el formulario; se usa la revisión. El endpoint PATCH genérico BFF tampoco permite saltar el flujo de baja y la antigua Server Action falla cerrada.

El modal calcula productos realmente asignados, categorías afectadas (vínculos del grupo y categorías de productos con asignación) y tiendas donde se comparte. Catalog tiene definiciones globales; no se inventa aislamiento por tienda. BFF exige acceso del Employee a todos los scopes afectados o responde403 antes de devolver el impacto. Confirmar manda sólo expectedVersion; los scopes autorizados se derivan en servidor y se revalidan en la transacción.

Después de confirmar: Desactivando → Cambio guardado/Comprobando → Completado sólo cuando GET del grupo BFF/ReadIndex confirma field.isActive=false. Una comprobación automática acotada y posteriores comprobaciones manuales no reenvían la mutación. Si se pierde respuesta se consulta primero el impacto canónico;409 obliga a recalcular. Cancelar antes de confirmar no cambia datos. El dialog nativo conserva foco/teclado y no cierra el panel de edición padre con Escape.

## Corrección de persistencia

Backend: saveGroup borraba todos los campos antes de reinsertarlos. Las FK CASCADE podían borrar sus selecciones. Ahora conserva campos/valores por upsert, preserva relaciones/traducciones y rechaza omitir campos/valores asignados o usar IDs de otra definición. La baja dedicada cambia sólo actividad/fechas en transacción SERIALIZABLE, con versión derivada del estado/huella de asignaciones/categorías/scopes. No borra asignaciones y es idempotente ante reintento sobre inactivo. No recupera posibles pérdidas históricas ni añade borrado físico al flujo UI.

Contrato backend sincronizado: `.docs/06-interfaces/47-specification-field-deactivation.md`; endpoints GET deactivation-impact/POST deactivate y Postman con confirmación manual opt-in. El POST Postman se omite salvo adminSpecificationConfirmDeactivation=true; no ejecutar sobre datos reales sin revisar.

## Validación

- `node --test tests/feature-deactivation.test.mjs tests/catalog-feature-update.test.mjs tests/catalog-feature-create.test.mjs tests/product-feature-flow.test.mjs`:22 PASS.
- `npm run lint`:0 errores,3 warnings previos ajenos.
- `npm run build`:PASS, TypeScript incluido.
- `PLAYWRIGHT_HTML_OPEN=never npx playwright test tests/e2e/admin-login.spec.ts --grep 'feature deactivation|catalog attributes and features page' --workers=1 --reporter=line`:4 PASS. Incluye cancelar, spinner, doble clic→una mutación, lectura desactualizada sin falso éxito,409, respuesta incierta sin segundo POST, permiso denegado, formulario/listado y Escape del modal anidado.
- Axe sin violaciones en el modal a1440/768/390px; sin overflow horizontal y restauración de foco. Se corrigió contraste del texto de contexto y se utiliza confirmación secundaria para la operación reversible, sin relajar reglas axe.
- Backend BFF:24 pruebas de controlador/alcance/permisos PASS; builds Catalog/BFF y lint focalizado correctos.
- SQL real: `node --test services/catalog/test/specification-lifecycle.integration.cjs` PASS. Base local desechable creada/eliminada;4.000 asignaciones y dos campos. Editar conserva4.000, omitir campo/valor asignado se rechaza, IDs ajenos se rechazan, alcance parcial403, revisión obsoleta409, desactivar conserva las3.999 restantes después de una eliminación explícita de fixture y no toca el otro campo. Repetir confirmación no vuelve a mutar.

Los primeros intentos E2E estuvieron bloqueados por listener EPERM del sandbox; se ejecutaron fuera con autorización automática. Ajustes posteriores de selectores y contraste están cubiertos por el recorrido final. No se ejecutó Lighthouse ni prueba de carga; no cambian el shell, las consultas iniciales del listado ni se descargan productos para calcular impacto. Sólo se carga el resumen al abrir el modal. No hay librerías pesadas nuevas.

## Verificación real sin mutación

Catalog y BFF Admin recargados selectivamente mediante script canónico con Node22/npm10; no se detuvieron los demás servicios. En runner efímero se conserva el supervisor en sesión independiente para mantener los listeners después del comando. Health3001/3026 comprobados.

Sesión Employee renovada por el usuario. En Tienda Barcelona se abrió Desactivar durabilidad: impacto real1 producto,2 categorías,11 tiendas compartidas. Se canceló; modal cerrado y durabilidad continúa Activa. No se desactivó ningún dato real para esta certificación. El borrador existente en otra pestaña se conservó: la revisión automática rechazó salir con cambios sin guardar; se canceló navegación y se abrió otra pestaña.

No se rotaron secretos, migraron bases reales ni purgaron eventos. No se cierra el backlog general de seguridad, la sincronización histórica ni las limitaciones de despliegue. La prueba E2E de mutación es con BFF simulado y la preservación se certifica además con PostgreSQL real aislado; no se presenta como mutación de producción.

Cierre de regresión ampliada: `npm test` completo **599 PASS**, build final PASS,
cuatro E2E finales PASS. La consulta de impacto real confirmó los contadores y se
canceló sin mutación. La base SQL desechable volvió a pasar tras comprobar el
resultado de cada upsert para evitar colisiones concurrentes de identidad.

Budget JS de la compilación final:9 chunks únicos (clientModules del manifiesto
RSC de la ruta + rootMainFiles de build-manifest),149.907 bytes gzip en total,
por debajo de256.000 bytes del límite Admin250KiB. Cálculo con gzipSync sobre
los archivos reales .next/static/chunks; no equivale a Lighthouse/TTFB/INP.

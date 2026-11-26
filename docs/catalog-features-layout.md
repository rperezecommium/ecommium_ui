# Características y atributos: bloques y tabla — 2026-11-07

2026-11-09: fondo del select igualado a la barra gris del listado reutilizando `--product-list-header-bg`. `npm run build` PASS; `npm run lint` sin errores y con3 avisos previos. Sin revisión en navegador ni E2E para este cambio de color.

2026-11-09, ajuste de densidad solicitado: retiradas las líneas secundarias «Pos.» y «Ficha tecnica/Combinacion» del listado; select de valores reducido a32px (excepción explícita solicitada respecto a los40px generales). `npm run build` PASS; sin E2E ni revisión visual en navegador para este ajuste.

2026-11-09: la columna Valores muestra un select nativo por fila con «Ver valores (N)» y los valores activos. Sin valores muestra su estado vacío. La edición y retirada siguen en el panel de edición. Select con nombre accesible por característica, foco visible y altura mínima de40px; sin JavaScript adicional ni peticiones nuevas. Validación: `npm run lint` (0 errores,3 avisos previos), `npm run build` PASS y `node --test tests/catalog-feature-create.test.mjs tests/catalog-feature-update.test.mjs` (10 PASS). No se ejecutaron E2E, axe, revisión visual con BFF ni mediciones de performance en este ajuste.

La pantalla comparte la superficie y densidad de Productos/Equipo: título compacto, pestañas con Crear como enlace azul a la derecha, filtros independientes a ancho completo, bloque gris de contador/acciones y tabla sin tarjeta ni sombra. Se retira la introducción repetida y Volver a productos; Usar en producto permanece en la barra del listado.

Se reutilizan productListPage, productListSearchPanel, productListGrid/Header/Table y employeesToolbar/TextAction. Las excepciones quedan limitadas a adminFeaturePage: filtros que envuelven y pasan a columna en móvil, tabla con scroll interno, celdas5px8px, nombres sin negrita y acciones de32px suaves (editar azul/desactivar ámbar/eliminar rojo). No se añaden colores, dependencias, lecturas ni JS. Las confirmaciones, permisos y seguimiento de ReadIndex conservan sus acciones.

Validación:28 pruebas focalizadas de características PASS; build PASS; lint0 errores/3 avisos previos ajenos. Seis E2E de desactivación/eliminación PASS, incluidos axe del modal a1440/768/390. La expectativa anterior de filtros nowrap se actualiza a wrap por el comportamiento adaptable solicitado y se repite el recorrido de filtros/creación/edición.

Revisión real con Employee: bloque de filtros y cabecera gris rgb239239236, celdas5px8px. Sin overflow del documento a1440/768/390; tabla con scroll interno en tableta/móvil. Axe sobre adminFeatureContent sin violaciones. Solo lecturas/revisión visual en datos reales; no se envían mutaciones de negocio. El borrador existente en otra pestaña se conserva.

Budget de JS de la ruta:9 chunks,151.808 bytes gzip (<250KiB), sin incremento respecto a la compilación previa. No se ejecuta Lighthouse ni se certifican tiempos de carga productivos. `git diff --check` de las superficies editadas sin errores.

Comprobación manual: `npm run dev` → Catálogo → Características; backend ya existente por `./scripts/postman-services.sh` en composable. Este cambio no consulta ni modifica el repo backend.

Cierre: el recorrido de filtros/alta/valores/edición pasa tras actualizar las dos expectativas visuales obsoletas (wrap y texto compartido rgb11/11/11). Total7 recorridos E2E aprobados, ejecutados como6 de lifecycle y1 de catálogo; no se relajaron los controles de permisos, confirmación ni preservación de datos. El primer build detectó la retirada accidental del import Plus usado por el formulario; se restauró y build/lint finales pasan.

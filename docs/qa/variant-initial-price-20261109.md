# Precio inicial de variantes — 2026-11-09

Botones de fila: Editar base azul suave y Quitar rojo suave, borde del tono y fuente600, hover más marcado; reutiliza tokens Admin. Sin cambios funcionales. Build PASS y lint0 errores/3 avisos previos. Sin revisión visual/E2E nuevos para este ajuste de color.

Densidad general Admin autorizada: variables `--admin-control-height:32px` y `--admin-control-font-size:12px`; regla compartida para inputs de una línea y selects simples dentro de adminShell, incluidos readonly y formularios laterales. Prevalece sobre mínimos anteriores de40px. Excluye checkbox/radio, archivos, color/range, botones, hidden, textarea y listas múltiples por sus dimensiones propias. Storefront no cambia. Build PASS; lint0 errores/3 avisos previos. Prueba E2E de variantes añade comprobación de altura/fuente; no se certifica revisión de todos los módulos ni nuevas mediciones axe/performance.

Nuevo ajuste visual: radio de selección y checks Activa/Visible a escala0,6 (40% menores); fuente de inputs de texto/número a12px, igual a los encabezados. Alcance exclusivo productCombinationTable. Build PASS y lint0 errores/3 avisos previos.

Compactación de fila solicitada: precio100px, stock72px, checks Activa/Visible en horizontal sin wrap, celdas centradas verticalmente. Se conservan40px de alto en inputs y scroll interno de tabla. Sin cambios de datos/BFF. `npm run lint`:0 errores/3 avisos previos; `npm run build`:PASS. E2E `npx playwright test tests/e2e/admin-login.spec.ts -g 'new manual and generated variants start'`:PASS con comprobaciones de ancho y alineación a1440/768/390px, además de edición/generación de precios. Sin nuevas mediciones de performance ni axe.

Limpieza visual solicitada en tabla: retiradas las etiquetas Directa/Portada producto/Heredada bajo miniaturas, variantId, nombre secundario de la base, Pendiente de guardar y resumen Atributos bajo el nombre de variante. Se conservan datos del draft, asignaciones, selector y validaciones inline. `npm run build` PASS; `npm run lint` sin errores/3 avisos previos. Sin nuevas pruebas E2E, axe, responsive ni performance para esta retirada de textos.

Simplificación de controles aprobada: variantes adicionales muestran solo checks Activa/Visible; se retira el badge duplicado y Desactivar/Reactivar de la columna Acción. Quitar queda exclusivamente para variantes no persistidas. La fila base conserva badges informativos. Stock inicial0 y precio editable se conservan. Sin cambios de contrato BFF. Verificación:55 unitarios PASS, build PASS, lint0 errores/3 avisos previos. Sin nuevos controles axe, responsive o performance para esta retirada de controles.

Corrección posterior: el precio de default seguía guardado, pero editorBasePrice lo ignoraba al pasar a modo variantes. Ahora se conserva como base cuando el producto no tiene precio positivo; la validación de publicación reconoce ese precio y editarlo conserva su identidad VARIANT. Prueba de regresión en modo variantes incluida. Se retiran Heredar y badges de precio de la tabla; queda el importe editable y el fallback visible. La edición toma fiscalidad/contexto de la base efectiva. Stock sigue independiente. Validación repetida:55 unitarios PASS, build PASS, lint0 errores/3 avisos previos.

Crear manualmente, generar/reemplazar o añadir combinaciones inicializa el precio editable de cada variante nueva desde el precio positivo del producto; en su ausencia usa el precio de defaultVariantId, también en modo variantes. Copia importe y contexto fiscal/comercial sin pricingId ni marca de eliminación. Cada copia es independiente: cambiarla no cambia el padre ni las demás variantes. Es un valor inicial, no sincronización posterior. No cambia variantes existentes al añadir combinaciones. Reemplazar conserva el precio persistido de defaultVariantId.

Persistencia mediante el draft y POST /admin/product-save-operations existente; sin endpoints ni acceso al backend nuevos.

Validación:

- `node --test tests/product-editor.test.mjs tests/product-save-operation-action.test.mjs`: 55 PASS, incluyendo copia independiente, prioridad producto/default, contexto fiscal e identidad persistida.
- `npm run lint`: 0 errores, 3 avisos previos ajenos.
- `npm run build`: PASS.
- `npx playwright test tests/e2e/admin-login.spec.ts -g 'product editor presents variant options as combination attributes'`: 1 PASS.
- `npx playwright test tests/e2e/admin-login.spec.ts -g 'new manual and generated variants start'`: 1 PASS; precio inmediato, edición independiente y generación/reemplazo.

Playwright necesitó permisos para abrir servidores loopback tras EPERM del sandbox. La primera expectativa del nuevo E2E confundía precio neto con bruto (49,90 netos eran60,38 con IVA); se corrigió la entrada al campo con impuestos y pasó. Fixtures BFF locales; sin mutaciones en servicios reales. Sin medición de performance ni axe/responsive nuevos: no cambia estructura visual ni carga inicial de datos.

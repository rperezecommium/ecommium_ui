# Servicio asignado invisible hasta recargar

Reproducido el 2026-11-11 en Tienda Barcelona/es-ES, producto 080eb6a9-11e6-45c9-8719-fc326225452e, variante BICI-20260929-173 (Argon 18 / S).

## Evidencia real

El panel inicialmente mostraba cero servicios. Se abrió Servicios adicionales, se eligió Ensamblaje (10,55 EUR / Activo) y se pulsó Agregar servicio. La UI respondió `offering attached to variant`, volvió al listado y conservó 0 asociados. Al cerrar, el panel seguía diciendo «No hay servicios adicionales asociados a esta variante». Tras recargar y seleccionar la misma variante, Ensamblaje apareció con 10,55 EUR / Activo.

La asociación real permanece creada. No se guardó el formulario general ni se añadieron otros servicios. No se activaron, desactivaron ni eliminaron servicios.

## Código y conclusión

`product-actions.ts`, attachExistingOfferingToVariantAction, ejecuta PUT `/admin/offerings/:offeringId/variants/:variantId` seguido de GET `/admin/offerings/variants/:variantId`. Devuelve ok según el resultado de la lectura, sin verificar que incluya el offeringId recién asociado. `product-editor-client.tsx`, assignExistingOfferingToSelectedVariant, sustituye la lista local por result.offerings y muestra éxito. Una lectura parseada vacía deja vacío tanto el contador como el panel.

La recarga usa otro recorrido: getProductEditorData en products.ts hidrata offeringsByVariant mediante POST `/admin/offerings/variants/resolve-batch`. El cliente HTTP usa no-store; no hay evidencia para atribuir el fallo al cache fetch de Next.

Confirmado: la asignación persiste y el refresco inmediato no acredita su presencia. No se capturaron cuerpos HTTP del BFF ni se inspeccionó el backend: queda pendiente distinguir retraso de proyección, diferencia entre GET/batch o incompatibilidad del DTO GET con parseOfferingList. No se atribuye una causa interna concreta.

## Corrección propuesta y límites

Verificar presencia del ID tras asignar; distinguir asociación aceptada de listado actualizado; preservar la lista previa si falla la lectura; utilizar una lectura contractual coherente con la hidratación o reintentos GET acotados si BFF declara consistencia eventual. No repetir PUT para refrescar. Cubrir lectura vacía, fallo de refresco y cambio de variante durante la petición. Si cambia el contrato, requiere sincronización explícita.

Esta tarea solo reproduce y documenta: sin cambios de código, sin lint/build nuevos ni tests de escritura adicionales. No se consultó/modificó el repo backend ni se cerraron hallazgos de seguridad.

## Corrección UI posterior

El refresco de asignación, retirada y activación se unifica con la hidratación inicial mediante `resolveOfferingsBatchByVariants`. La asignación verifica la presencia del offeringId antes de reemplazar el estado y comunicar éxito; ante lectura fallida/no confirmada, conserva la lista previa y evita recomendar repetir la mutación. No se atribuye causa interna al GET ni se amplía el contrato.

Validación: ESLint focalizado PASS; `npm run build` PASS; Playwright `added offering appears immediately in the variant services table` PASS, comprobando alta y fila visible sin navegar ni recargar con BFF de fixtures. No se repitió una mutación sobre datos reales en esta corrección.


### Causa confirmada y corrección de múltiples servicios
El BFF enruta GET/batch por `readIndex()`, mientras el PUT escribe mediante Pricing. La corrección UI anterior no resolvía el retraso de esa proyección. El PUT ahora incluye una instantánea canónica opcional `offerings`, obtenida de Pricing con el mismo contexto después de asociar. La UI usa la lista completa para mantener todos los servicios de la variante, sin esperar la proyección ni inventar asociaciones. Consultas normales conservan read-index. Playwright cubre dos altas consecutivas y ambas filas visibles aun con proyección vacía; controlador BFF verifica contexto y lista completa. Sin migración.

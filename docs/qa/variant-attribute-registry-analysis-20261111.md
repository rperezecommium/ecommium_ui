# Discrepancia entre atributos registrados y opciones de variantes

Fecha: 2026-11-11. Estado: diagnóstico confirmado en código UI y en una ficha real; corrección y reconciliación pendientes.

## Resultado

El requisito «todo atributo utilizado por una variante debe estar registrado en el catálogo de atributos» no está garantizado por la UI actual. El generador crea códigos libres, mientras el listado consulta exclusivamente grupos de especificaciones. El selector asistido sí utiliza definiciones existentes, pero convierte sus identidades en slugs de nombres al asignar opciones.

No se modificaron productos, variantes ni definiciones durante este diagnóstico. No se consultó el repositorio backend ni bases de datos. La verificación de UI usó sesión Employee, Ecommium Default Organization / Tienda Barcelona / es-ES.

## Evidencia de UI

Listado `/admin/catalogo/atributos-caracteristicas?tab=attributes`: cinco atributos activos visibles, Color, Diámetro de disco, Talla de cuadro, Configuración de transmisión y Posición. Estos registros proceden de la carga parcial realizada en esta conversación antes de solicitar su parada; no representan el estado histórico anterior a esa carga. No aparecen Talla ni size.

Producto `080eb6a9-11e6-45c9-8719-fc326225452e`, Argon 18 bicicleta de gravel grey matter rival 1 - Serie 172:

| Referencia | Estado observado en Variantes |
| --- | --- |
| BICI-20260929-172 | Variante predeterminada; asignación de atributos deshabilitada. |
| BICI-20260929-173 | Variante adicional `/ S`; muestra literalmente `size: s`, aunque size/Talla no figura en el catálogo visible. |
| BICI-20260929-174 | Variante adicional `/ gris`; muestra `Color: Gris`, mediante coincidencia con la definición de Color actualmente disponible. Esto no demuestra una relación persistida por ID. |

La ficha ofrece Diámetro de disco y Posición junto a Talla de cuadro y Color: carga atributos activos sin limitar el selector a los grupos de la categoría del producto. El desplegable «Generar variantes desde atributos» contiene dos entradas de texto libre, Color y Talla. Se inspeccionaron las variantes sin guardar; la ficha conservó «Sin cambios».

Esto confirma al menos una opción de variante sin correspondencia en el catálogo visible. No constituye un censo de los 1.750 productos del listado ni demuestra la tabla física donde persiste el backend.

## Hallazgos en el repositorio UI

1. `src/modules/catalogo/product-editor-client.tsx`, `combinationRows` y `requestCombinationGeneration`: el generador crea `attributeCode: color` y `attributeCode: size` con valores derivados del texto libre. No llama al alta de definiciones ni exige elegir atributos registrados.
2. `product-variant-attribute-actions.ts`, `createCommonVariantAttributes`: el alta de Talla, Color y Acabado es una acción explícita separada. Reutiliza campos por nombre/actividad/tipo, sin comprobar vínculo a la categoría solicitada ni completar los valores faltantes.
3. `product-editor-client.tsx`, `variantAttributeCode`, `variantAttributeValueCode` y `updateVariantAttributeSelection`: el selector parte de fieldId/fieldValueId, pero guarda slugs de los nombres en attributeCode/valueCode. Renombres, traducciones o nombres iguales entre grupos pueden perder o confundir la correspondencia. «Talla» produce talla; el generador produce size; «Talla de cuadro» produce talla-de-cuadro.
4. `product-editor-validation.ts`, `validateProductDraft`: verifica opciones completas, duplicados por atributo y combinaciones repetidas. No recibe el catálogo para validar existencia, actividad o vínculo a categoría de atributo y valor.
5. `product-actions.ts`, `saveProductDraftAction`: el flujo de guardado actual envía el draft a `POST /admin/product-save-operations` por BFF, sin reconciliación de definiciones en la UI. El gateway de `products.ts` también expone `/admin/variants/:variantId/options`, y `product-save-orchestrator.ts` transmite attributeCode/valueCode/isActive. No se ha inspeccionado la implementación interna del BFF: no se atribuye su transacción o almacenamiento físico.
6. `catalog-attributes-features.ts`, `listCatalogAttributeFeatureData`: el listado consulta `/admin/specifications/groups` con limit=100, offset=0, includeFields=true. No recorre páginas ni descubre definiciones a partir de las opciones usadas por variantes. El filtro Atributos exige isStockKeepingUnit y, por defecto, actividad. Más de 100 grupos o un flag incorrecto pueden ocultar registros; no se ha demostrado que expliquen este caso.
7. `products.ts`, carga de `variantAttributeFields`, y render del editor: se ofrecen todos los atributos SKU activos recibidos. `findVariantAttributeField` busca por ID o slug del nombre; si no encuentra coincidencia, el render muestra los códigos de la opción sin una advertencia de falta de registro. Así se mantiene visible `size: s` mientras el catálogo está incompleto.

## Sincronización necesaria con el contrato BFF

La corrección debe garantizar la identidad y existencia de la definición antes de aceptar una opción de variante, también para importaciones y otros clientes. No basta con insertar atributos desde el render o mostrar opciones huérfanas como si fueran definiciones.

Contrato propuesto, sujeto a sincronización explícita:

- Identidad canónica estable de atributo y valor en el comando de variante, con scope Organization/Shop y relación de categoría explícita. Los nombres localizados son etiquetas; los códigos heredados necesitan una resolución inequívoca.
- Generación a partir del catálogo; cuando el empleado crea un atributo/valor desde producto, alta o reutilización idempotente vía BFF con permisos correspondientes antes de aceptar la combinación. Si el alta falla, no confirmar éxito de la variante.
- BFF valida referencia existente/activa y alcance; devuelve un error de campo para referencias inexistentes o ambiguas. La estrategia transaccional, compensaciones y concurrencia pertenecen al BFF.
- Auditoría paginada de opciones existentes por BFF para detectar definición ausente, valor ausente, inactividad, ambigüedad y categoría no vinculada. Resolver size/talla y nombres duplicados mediante una revisión explícita; preservar variantId, SKU, precios, inventario y selecciones.
- Paginación completa del catálogo y feedback de referencias no resueltas en el editor. Pruebas para ambos caminos de creación y para datos heredados.

No se ejecutó reconciliación ni se crearon contratos o endpoints alternativos. Pendiente sincronización explícita antes de cambiar el contrato de guardado.

## Validación y límites

- `node --test tests/product-variant-attribute-presets.test.mjs tests/product-editor.test.mjs`: 48 pruebas PASS (4 de atributos habituales y 44 del editor). No acredita integración con BFF ni impone el invariante de registro previo.
- Inspección manual real de listado de atributos, ficha, dos variantes adicionales y generador; ninguna mutación durante el diagnóstico.
- Sin lint/build nuevos: solo se añade documentación, sin cambio ejecutable. Sin pruebas E2E de escritura ni de backend por el alcance de análisis.
- Pendiente censo completo por BFF y comprobación de persistencia/contratos backend. Los hallazgos existentes de securityReadme.md permanecen sin cambios.

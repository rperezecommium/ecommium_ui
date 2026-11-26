# Prueba integral real: Catálogo > Productos

Fecha: 2026-11-06. Herramienta: Playwright MCP, sesión Employee real en localhost:5173, Organization Ecommium Default Organization / Tienda Barcelona, es-ES, EUR, ES, canal web. Se probaron las ocho pestañas del editor. No se sustituyó el BFF por fixtures y no se llamaron servicios internos ni bases de datos.

**Resultado general: NO APROBADO.** El BFF confirmó el guardado del producto con todos los bloques principales, pero el recorrido de lectura/edición y la ejecución del precio específico no pudieron validarse. Un badge Correcto de una operación de escritura no certifica la lectura posterior ni que el precio se aplique.

## Producto de prueba

- Nombre: Casco QA integral PW 20261106.
- Producto: `9fd81ffc-51b3-45cc-8448-80b60e666e13`.
- SKU principal: `QA-PW-20261106-CASCO`. EAN de control:2000000000015.
- Slug: casco-qa-integral-pw-20261106.
- Categoría: Accesorios y componentes. Marca:Giro.
- Resumen y descripción de QA identifican expresamente que no es una oferta comercial real.
- Variante predeterminada: `5a77ecf9-e4e1-4669-8a6d-40c88641787b`.
- Combinaciones negro/M y negro/L generadas desde el editor, EAN2000000000022 y2000000000039; IDs confirmados `fb263385-63b6-4d5a-baa5-3afbe8534ced` y `cc38bf37-e361-4fb4-8262-76b5905ec049`.
- Dos imágenes WebP existentes del repo utilizadas como assets de prueba. Subida confirmada, imágenes cargadas de452×452, portada y metadata editadas.
- Características: Tiempo de garantía=3 años y durabilidad=20.
- Precio base:100 EUR netos, IVA21%=21 EUR, bruto121 EUR; coste60 y precio tachado150 EUR.
- Precio específico:99 EUR con impuestos incluidos, mínimo3 unidades, grupoVIP, paísES, canalWeb, políticaDefault, sin tabla específica y vigencia ilimitada.
- Stock principal10−2 reservadas−1 seguridad=7 disponibles. VarianteM8−1−1=6; varianteL5−1−0=4.
- Paquete:350g,250×200×300mm, coste adicional2,50 EUR, textos de entrega con y sin stock.
- SEO: título, keywords, meta description, canonical `/casco-qa-integral-pw-20261106/p`, alias `/qa/casco-integral-pw-20261106`. Se solicitó ruta/alias inactivos y exclusión del sitemap durante la prueba.
- Operación de guardado: `pso_96e360a6-e1a1-475c-83d6-25e7bfb3ea34`, estado `saved_unpublished`. Correlación `ui-1793972797640-067704ff9afed`.
- Quedó sin publicar. La publicación efectiva y el checkout no se certifican con los bloqueos descritos.

## Cobertura por pestaña

| Pestaña | Prueba ejecutada | Resultado |
| --- | --- | --- |
| Ajustes básicos | Nombre,slug,SKU,EAN,resumen,descripción,categoría,marca,selección de dos características y navegación entre cajas | Datos conservados entre pestañas; BFF confirmó catálogo y características. No pudo verificarse la reapertura por fallo de lectura. |
| Imágenes | Subida múltiple,portada,alt,título y carga real de los archivos | Dos assets Subida y ambas imágenes con naturalWidth452/naturalHeight452. La metadata seguía en el editor tras guardar. |
| Variantes | Generador negro×M/L,referencias,EAN,stock,atributos,filtrar M y limpiar,selección M/L en preview | Dos variantes con IDs y atributos Guardado tras la operación. Filtro dejó producto+M; limpiar restauró las tres filas. Preview cambió referencias,EAN y stock6/4 correctamente. |
| Precio | Base,IVA,coste,tachado,regla específica,simulación de condiciones y control con un producto existente | Cálculo local100+21=121 correcto; bloque de escritura Correcto. Todas las simulaciones fallaron por servicio no disponible. Aplicación de99 EUR no validada. |
| Inventario | Cantidades,reservas,seguridad,stock propio de M/L y cálculo de disponibles | Aritmética local7/6/4 correcta; BFF confirmó Stock guardado. Relectura independiente bloqueada. |
| Transporte | Peso,dimensiones,coste,textos regionalizados y selector de transportistas | BFF confirmó el bloque; selector de carriers sin configuración disponible, aviso de solicitud no válida. No hay simulador de transporte dentro de esta pestaña. |
| SEO | Metadatos,canonical,alias,estado de ruta y sitemap | BFF confirmó SEO. Tras guardar, Auditoría pasó a ACTIVE aunque se había seleccionado INACTIVE; sitemap permaneció excluido. El contador Aliases activos mostró1 para el alias marcado inactivo. |
| Auditoría | IDs,estado de operación,bloques,errores,correlaciones | Reportó los bloques descritos abajo. Sin errores de campo. Ese éxito de escritura no implica que ReadIndex pueda devolver el producto. |

## Badges de guardado realmente observados

| Bloque | Estado de la respuesta |
| --- | --- |
| catalog | Correcto |
| variants | Correcto |
| media | Sin cambios: las subidas ya habían ocurrido mediante la operación remota de media |
| variantMedia | Sin cambios; solo se comprobó herencia de portada en la preview local, no una asignación propia nueva |
| specifications | Correcto |
| pricing | Correcto |
| inventory | Correcto |
| shipping | Correcto |
| routingSeo | Correcto |
| publish | Sin cambios: se eligió Guardar borrador |

La barra mostró Sin publicar / Guardado. También quedaron dos botones Continuar editando y un aviso de borrador local después del éxito, lo que produce feedback redundante o contradictorio.

## Precio específico: comprobación efectiva

La matriz está en `evidence/20261106/product-full/pricing-scenarios.json`.

| Contexto | Resultado esperado según la regla configurada | Resultado real |
| --- | --- | --- |
| VIP,2 unidades |121 EUR: no llega al mínimo | Error: servicio no disponible |
| Todos,3 unidades |121 EUR: no pertenece aVIP | Error: servicio no disponible |
| VIP,3 unidades |99 EUR: cumple las condiciones | Error: servicio no disponible |

Antes del guardado ya había fallado la simulación. Después del guardado fallaron todas las condiciones anteriores. Como control de alcance, se abrió **sin modificar** el producto existente Argon18 `080eb6a9-11e6-45c9-8719-fc326225452e`: su editor sí cargó, pero el simulador falló igual. Reiniciar sí limpió el error y volvió a Sin simular. No se afirma que el servicio de Pricing completo esté caído: las escrituras fueron confirmadas; lo observado es el fallo del endpoint de preview consumido por la UI.

## Fallos reproducidos y prioridades

### P1 — El producto recién guardado no puede reabrirse

Abrir `/admin/products/9fd81ffc-51b3-45cc-8448-80b60e666e13` mostró No se pudo cargar el producto / servicio no disponible. Una segunda comprobación volvió a fallar con correlación `ui-1793973088965-7643569340de3`. La búsqueda exacta mediante el formulario, sin el filtro Activo, devolvió Productos(0). La primera URL manual de búsqueda omitió dos dígitos de la fecha; se corrigió por el formulario y el resultado exacto siguió siendo0. No se confunde ausencia del listado con ausencia de escritura: la operación BFF sí confirmó el producto.

### P1 — Simulador bloqueado y badge ambiguo

No fue posible demostrar la aplicación o exclusión de la regla específica. Además, un fallo de servicio queda acompañado por Sin precio aplicable y Fallback:No; ese estado no debe interpretarse como una resolución comercial válida.

### P1 — Se pierde la ficha de edición tras un refresco/remontaje

La pestaña original seguía en `/admin/products/new` tras guardar. Durante el recorrido se observó una recarga/remontaje espontáneo y pasó a un producto vacío. Recuperar en el banner no restauró la ficha. El código del guardián guarda formularios, mientras gran parte del editor está fuera de un form y tiene almacenamiento propio. No se ha demostrado qué originó la recarga. Los datos habían recibido confirmación de guardado, pero la combinación de ruta/new y fallo de reapertura impidió seguir trabajando sobre esa misma ficha. No se crearon productos duplicados para esconder este fallo.

### P2 — Características con UUID en la preview

Tras guardar, la vista previa mostró IDs de field y value en lugar de Tiempo de garantía/3 años y durabilidad/20. La selección previa sí usaba nombres legibles.

### P2 — Servicio asociado pero contador cero

En negro/M se seleccionó Ensamblaje10,55 EUR. La operación respondió offering attached to variant, pero el modal siguió mostrando0 asociados y la preview no mostró el servicio. No se repitió la asociación para evitar duplicaciones; falta verificar la lectura de esa relación.

### P2 — Estado SEO y contador de aliases

Se solicitó INACTIVE; después del guardado Auditoría mostró ACTIVE. El contador de aliases activos contó uno aun estando marcado inactivo. Se requiere contrastar la respuesta de la operación y la presentación, sin inferir que la ruta pública esté efectivamente expuesta: Storefront tampoco pudo consultarse.

### P2 — Lookups y avisos contradictorios

Al inicio falló el lookup fiscal; después sí aparecieron reglas y el cálculo funcionó. Offerings también llegó a mostrar opciones pese al warning anterior. Price tables y configuración de Shipping mantuvieron avisos de indisponibilidad. La UI no debe conservar un aviso obsoleto cuando un lookup se recupera.

## Otras comprobaciones y límites

- Vista previa local: renderizó título,resumen,descripción,marca,precio base,tachado,impuestos,paquete,variantes y stock.
- Ver en tienda: la ruta Admin de preview no pudo cargar el producto Admin antes de consultar Storefront. No se verificó PDP pública, búsqueda pública ni checkout.
- Guardar abrió el diálogo de requisitos completos y ofreció publicar/borrador. Se eligió borrador para completar los controles antes de una publicación. No se certifican activación/desactivación ni duplicación de este producto con la lectura actual bloqueada.
- No se probó una asignación propia de imagen por variante ni un override de precio adicional: el refresco y la imposibilidad de reabrir cortaron esa continuación. No se presentan como aprobados.
- No se modificó el producto Argon18 utilizado como control.
- No se corrigió código de aplicación en este recorrido: es una auditoría funcional real con hallazgos y evidencia. No se ejecutaron lint/build,axe,Lighthouse ni la suite con BFF simulado en esta auditoría, porque no sustituyen estos resultados reales.
- El backend no se modificó ni reinició y no se accedió a bases de datos.

## Evidencia

`docs/qa/evidence/20261106/product-full/` contiene18 snapshots de Playwright del recorrido y la matrizJSON. Los emails de empleado se redactaron en las copias. La prueba no registra tokens,cookies ni contraseñas.

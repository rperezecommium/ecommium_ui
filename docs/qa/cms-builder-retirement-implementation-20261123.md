# Transición del Builder a composición independiente

Estado: implementación y verificación en curso, 23 de noviembre de 2026.
No acredita todavía la retirada completa del Builder ni cambios de publicación.

## Trabajo implementado

- Inventario por contexto en `/admin/cms/transicion`, consultado exclusivamente en
  BFF. Páginas paginadas y Header/Footer; distingue independiente, convertible,
  bloqueado y avisos de ubicaciones antiguas. No muta el contenido inspeccionado.
- Guardado Header/Footer: creación de pieza y primera revisión en una transacción;
  guardado con bloqueo/comprobación de revisión y timestamp en la misma transacción.
  `expectedRevision` es obligatorio para actualizar/publicar secciones independientes.
  Los formularios anteriores también envían su revisión cuando están actualizados.
  Publicar comprueba la revisión confirmada y adquiere el mismo bloqueo de padre.
- Recuperación de creación incierta: la UI conserva `creationId`, usado como ID de
  la copia. «Comprobar copia» solo lee ese ID en el contexto Employee. No repite POST.
  Un segundo POST con la misma identidad no crea otra pieza. No hay recibo de creación
  eterno tras un borrado explícito; no se anuncia idempotencia ilimitada.
- Ajustes `designSettings` en PAGE, SECTION, MODULE y layout del shell: ancho máximo,
  gaps de módulos/columnas y colores por base/desktop/tablet/mobile. Campos sin
  override heredan; desmarcar restaura herencia. Resolución común preview/Storefront;
  presentación específica y CSS mantienen su prioridad. Se conservan los breakpoints
  de los renderers existentes; no se acredita una unificación de todos los umbrales
  históricos con tokens.breakpoints.
- MODULE registrado declara `editableFields`, acotado por su tipo y excluyendo
  presentación. La edición dentro de una sección conserva los campos no declarados
  y el diseño. Los visuales siguen usando contentSchema/contentValues.
- Reproducción owner-side Header/Footer con instantáneas visuales materializadas,
  nunca referencias vivas. Nuevo POST `site-parts/:id/reproduction-preview`, con
  validación y Media en BFF. Layout y posiciones exteriores se conservan.
- Composición PAGE admite layout de áreas/columnas y placement de SECTION. El editor
  reutiliza el editor compartido de áreas; el renderer conserva las clases y el
  comportamiento responsive de la página existente, incluido el umbral de 760px.
- PAGE conserva el contenido editorial PLP en `plpModules`: módulos independientes,
  destino por ruta/slug y posición antes/después del listado. Su editor permite
  insertar copias, editar campos declarados, reordenar, duplicar y quitar localmente.
  La entrega PLP lee exclusivamente versiones publicadas y mantiene tenant/locale.
- Slider público y preview independiente utilizan StorefrontCmsSlider; no se cambia
  su reproductor por una imagen estática durante la conversión.
- Conversión visual V1 conserva metadatos de raíz y orden mixto de contenido/espacios
  mediante envoltorios transparentes. `display: contents` se añade al registro seguro.
- Ubicaciones inexistentes se retienen como avisos visibles en el borrador; publicar
  exige corregirlas. También se bloquea publicar módulos PLP sin destino. La
  validación autoritativa se ejecuta en la transacción del lifecycle CMS.
- Layouts/ajustes de plantillas viven en `/admin/cms/plantillas?kind=layout`, junto
  a las plantillas de composición. El enlace antiguo redirige preservando parámetros.
  Los contratos y registros de ambos tipos se conservan.

## Inventario real observado antes de crear las nuevas copias

Barcelona, es-ES: 9 páginas. Independientes: «pagina probando», «QA Fase5 página
 destino» y «QA Fase6 migración». Legacy: Home, Privacidad del newsletter, Seleccion
Bike Brakes, para probar modulos y los dos borradores QA Fase6 referencia
missing/archived. Estos dos últimos carecen de definición activa: no se fabrica
contenido para reemplazarla.

Header/Footer: las dos copias anteriores con secciones; Header principal,
Header mínimo checkout, POCH_HD, QA Header archivado, Footer principal y QA Footer
archivado. Las asignaciones originales no se han cambiado.

## Copias nuevas confirmadas en Chrome

- Privacidad del newsletter · Ensayo Secciones:
  `b2136f9b-af8c-4429-8fab-221aedf40067`.
- Seleccion Bike Brakes · Ensayo Secciones:
  `9d5266de-a70f-4c9f-a99d-f885192e0309`.

Estas dos páginas se crearon como borradores, con otra ruta, sin publicar ni modificar el origen.
El primer preview de productos mostró UNAVAILABLE por la espera acotada de
hidratación. La PLP pública BFF bike-brakes respondió 200, total20, al comprobarla;
no se amplió el presupuesto ni se certifica todavía equivalencia visual completa.

## Verificación acumulada durante la implementación

- PostgreSQL local aislado, esquema desechable: dos guardados simultáneos producen
  un ganador y un conflicto409; edición obsoleta no cambia nombre/contenido; creación
  fallida revierte la pieza; creationId repetido no duplica; publicación funciona.
- Pruebas focalizadas CMS de concurrencia y reproducción; conversión de visuales,
  layout/Home/PLP, entrega PLP publicada y aislamiento por tienda/categoría.
- UI: contratos CMS24, helpers de herencia/campos declarados, reproducción y publicación.
- Playwright aislado1440/768/390: shell, módulos, secciones y compositor de páginas; edición,
  errores CSS/JSON, reintentos idénticos, readonly, no overflow y axe sin contraste
  por el pendiente previo. Se comprueba gap responsive y restauración de herencia.
  Los fixtures del slider no certifican el reproductor Swiper real.
- Builds CMS/BFF/UI y lint UI correctos en los puntos de control ejecutados.
  Último pase UI completo: build correcto y lint0 errores/3 advertencias previas.

## Cierre pendiente

Comparación final contra el original en Home/Header checkout, referencia Media
de la página de pruebas y su reproducción íntegra; resolver o conservar
explícitamente los borradores QA rotos; validar el
inventario de dependencias antes de retirar el acceso al Builder. No eliminar
helpers compartidos de visuales, rich text, Media, estilos, preview o Storefront.
No se han migrado, publicado, asignado ni borrado los documentos originales.


## Última comprobación en la pantalla del usuario

- Home: copia DRAFT `5b0ef493-4246-4f12-a0ea-948186ad3a97`, creada desde
  Transición. Fuente publicada21 bloques; copia5 secciones y16 módulos PLP.
  Slider Swiper real observado en preview, incluidas las imágenes y la adaptación
  móvil. La cuadrícula mostró temporalmente UNAVAILABLE; tras cargar volvió a mostrar
  sus10 productos con precios en EUR en tablet y móvil. La categoría pública
  devolvió200. No equivale a publicar ni a certificar equivalencia pixel a pixel.
- Header mínimo checkout: copia DRAFT `de1e82c0-ca3d-433e-8b4d-93c3c29ce6ad`,
  sin asignaciones, creación confirmada en Chrome Work. El href HTTPS de origen
  se conserva como dato: el renderizador compartido sigue usando su fallback
  interno; no se ha cambiado el destino efectivo del original ni de la copia.
- V1: se preservan contentBinding explícitos, se rechazan aliases contradictorios
  y se permiten color/textAlign heredables sobre contenedores. El resto de reglas
  de tipografía permanece igual. Pruebas específicas cubren ambos casos.
- Página `para probar modulos`: persiste un bloqueo real por backgroundImage
  `url(/storefront/cms/consult-works-engineers.jpg)`. El contrato independiente
  requiere asset de Media. No fabricar mediaAssetId, omitir el fondo ni debilitar
  esa validación. Falta resolver la referencia antes de reproducirla íntegramente.
- Último pase UI: build correcto; lint0 errores/3 avisos previos; contratos24/24;
  helpers/acciones shell y publicación20/20. Playwright shell, módulos y página
  pasa1440/768/390. Controller BFF de piezas8/8. CMS conversión visual y módulo50/50 tras conservar color/textAlign.

El Builder sigue disponible por los bloqueos de datos y la comparación pendiente.
Retirarlo ahora no sería una entrega completa: aún existen documentos legacy.


Para cerrar el bloqueo de Media hace falta una correspondencia explícita entre
el fondo estático legado y un mediaAssetId vigente. El preview de migración actual
no acepta un mapa de sustituciones. Contrato propuesto para sincronizar con BFF:
`assetMappings: [{sourceUrl, mediaAssetId}]`, opcional en la reproducción; Media
valida existencia y scope, owner verifica que solo cambian las referencias
identificadas y devuelve la procedencia en el recibo. No implementar este mapa en
Next como dominio alternativo ni modificar los originales para superar el bloqueo.

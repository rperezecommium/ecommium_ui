# Selectores de atributos PDP — 2026-11-16

La ficha compartida `StorefrontPdpContentClient` muestra, debajo de la combinación seleccionada y antes de los servicios, una fila por atributo real de las variantes BFF. Cada valor aparece como botón rectangular; los valores se deduplican por atributo y se conserva el orden recibido. No se generan tallas, colores, materiales ni combinaciones ficticias.

Los botones y las miniaturas utilizan el mismo `selectVariant`: imagen, referencia, precio, disponibilidad y servicios se actualizan con la misma identidad de variante. Se mantiene el resto de atributos cuando existe la combinación; ante combinaciones incompletas se selecciona una variante real que conserve el máximo de atributos anteriores, con desempate estable por orden recibido. Valores exclusivamente no disponibles quedan deshabilitados, como las miniaturas actuales. No se mutan productos, precios ni stock.

La selección es accesible mediante tabla con encabezados de fila, grupos con nombre, botones nativos, aria-pressed y foco visible; cuadrícula por atributo con borde y botones con min-width27px, min-height29px y padding5px5px, según ajuste solicitado. La vista previa Admin reutiliza el mismo componente y conserva su modo sin compra/analítica.

Pruebas ejecutadas: `npm test` (688 PASS, incluidos5 casos de agrupación/combinaciones/agotados/identidad), `npm run lint` (0errores/3avisos anteriores) y `npm run build` (PASS). Logs locales en `/tmp/ecommium-pdp-options-20261116/` y respaldo previo de los dos archivos existentes modificados, sin resetear el árbol de trabajo.

Revisión contra servicios reales: `/pdp/argon_18_gravel`, producto de la captura. Sus datos actuales proporcionan talla S y color GRIS; no se añaden valores de ejemplo que no estén configurados. Se mantiene el contrato de datos, los clientes BFF, el saneamiento de rich text y el contexto Storefront. No se ejecutan compras para esta modificación visual.

Comprobación Playwright real: COLOR/GRIS y SIZE/S actualizan imagen y combinación; volver a seleccionar GRIS por miniatura produce el mismo texto, imagen y precio que su botón. Axe del selector:9reglas pasan,0infracciones WCAG2A/AA/2.1AA. Desktop1440 y móvil390 sin desbordamiento del documento; las filas ajustan los valores a varias columnas. A768px existe un desbordamiento previo de la PDP (documento1260px), idéntico al ocultar completamente los nuevos grupos; no se amplía este cambio al layout general. Detalle reproducible: `pdp-variant-options-20261116.json`. No se ejecutó Lighthouse ni una nueva compra sandbox, ajenos a esta selección visual.

Ajuste final solicitado: contenedor CSS grid con borde por atributo, gap5px; botones min-width27px, min-height29px, padding5px5px. Valores computados verificados en navegador.

Aclaración visual final: tabla con bordes compartidos como Características clave; una fila por atributo, nombre a la izquierda y botones a la derecha. Se conserva27px/29px/padding5px. Sustituye al contenedor separado por atributo de la primera iteración.

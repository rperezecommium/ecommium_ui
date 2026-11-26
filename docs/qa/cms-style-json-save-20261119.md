# Styles JSON directo y publicación — 2026-11-19

## Evidencia

El usuario indica pérdida de datos en Header mínimo checkout después de
Guardar y publicar y confirma que editó Styles JSON directo. La UI real muestra
ACTIVE revisión 3 con confirmación de publicación. Una consulta Prisma de solo
lectura de esa cabecera confirma:

- Revisión 1: columnas 50/50, sin presentación.
- Revisión 2: columnas 70/30, sin presentación.
- Revisión 3 ACTIVE: columnas 70/30 conservadas; logo sin presentación y carrito
  con `presentation.styles.base = {}`.

Los valores de estilos buscados no están en esas revisiones: no se trata solo de
un mapper del inspector ocultando valores persistidos. No se dispone del texto
original introducido; no se afirma cuál fue su error concreto.

## Fallo reproducido y corrección

Al limpiar/reemplazar el textarea, el objeto vacío podía aplicarse al snapshot.
Si el texto siguiente era JSON incompleto, CSS con selectores o una propiedad no
admitida, el inspector lo mantenía local con una ayuda pequeña; Guardar y publicar
seguía enviando el último snapshot válido, que podía ser vacío, y mostraba éxito.

Ahora el inspector identifica el borrador inválido con aria-invalid, marcador de
validación y error explícito con ejemplo de objeto plano. El formulario intercepta
Guardar/Guardar y publicar, conserva el texto, enfoca el campo y cancela el envío
si hay un Styles JSON directo inválido visible. El JSON válido conserva el flujo
de aplicación inmediata al snapshot, preview y payload.

Además la publicación compara layout/bloques enviados con la revisión DRAFT
confirmada por BFF (todos los valores remitidos, arrays completos y ordenados;
se permiten defaults adicionales del servidor y trim de cadenas). Si el recibo
pierde contenido o estilos, no se llama a publicar. El resultado de publicación
requiere el mismo revisionId activo y composición conservada antes de redirigir
con éxito. Una confirmación ambigua permanece como error local con advertencia
de revisar Historial antes de repetir la publicación.

## Validación

- `npm test`: 737/737, incluidos recibo incompleto y revisión publicada incorrecta.
- `npm run lint`: 0 errores, tres avisos anteriores de otros módulos.
- `npm run build`: correcto.
- `node tests/e2e/cms-unified-builder-browser.mjs`: tres tamaños, incluyendo caso
  de carrito ACTIVE con textarea vacío → CSS pendiente → bloqueo sin acción;
  texto conservado → JSON válido con padding/background/radius → publicación
  simulada con valores presentes. Mantiene regresiones de preview/roundtrip/axe.

No se ha guardado, publicado ni alterado la cabecera real. El acceso de diagnóstico
al repositorio/backend y a sus revisiones fue de solo lectura. Las mutaciones de
navegador son simuladas. No se certifica un guardado Employee conectado ni se
reconstruyen valores que nunca llegaron a las revisiones disponibles. No hay
cambios backend, migraciones ni nuevas rutas. La protección del textarea cubre el
inspector visible; no convierte el campo en un editor de CSS libre ni aplica
importaciones JSON pendientes por iniciativa propia.

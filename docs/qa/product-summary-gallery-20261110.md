# Galería de resumen — 2026-11-10

Se incorpora la distribución del boceto: primera imagen de portada destacada
ocupando dos filas, miniaturas a su derecha en dos filas y desbordamiento
horizontal nativo cuando no caben más columnas. La imagen seleccionada se
amplía debajo; object-fit contain conserva el producto completo. Los botones
incluyen nombre, aria-pressed y foco visible. El contenedor permite scroll de
teclado. La portada se ordena primero sin mutar el orden del borrador.

No cambia la asignación de imágenes ni los payloads de guardado/BFF.
Lint: 0 errores, 3 warnings existentes fuera de los archivos modificados.
Build: correcto.
No se ejecutaron E2E, axe ni Lighthouse. La revisión visual en Chrome quedó
pendiente porque el usuario tenía una captura GoFullPage en curso; no se
interrumpió la captura.

## Ajuste solicitado tras captura jnnt

Se retiran la imagen ampliada inferior y el bloque Tipo/Precio/Variantes/Imágenes.
La galería superior se reduce a dos filas de 60px con miniaturas de 76px y
portada de 144px de ancho; en móvil las filas son de 52px. Se conserva el
scroll horizontal y su foco de teclado. Las imágenes son estáticas, sin
botones de selección que apunten a una ampliación ya eliminada.

## Unificación de imágenes y metadata — captura jpnm

Se retira la pestaña Imágenes y su formulario duplicado de la columna principal.
El panel derecho cambia Resumen por Imágenes e incorpora Añadir imagen como
botón visual de enlace que abre el mismo selector de archivos. Seleccionar una
miniatura cambia la metadata compacta (Título/Alt en una fila; Portada/Activa
en la siguiente). Cada imagen tiene papelera para quitarla del borrador con
la misma operación existente, sin cambiar contratos de guardado. Se preserva
el selector de asignación a variantes en la pestaña Variantes.

Verificación final:
- npm run lint: correcto, 0 errores y 3 warnings preexistentes.
- npm run build: correcto.
- node --test tests/product-editor.test.mjs: 42/42 correctos.
- Chrome con sesión/BFF existente: selección de segunda imagen verificada por
  cambio de campos Título/Alt y captura visual. Sin mutar ni guardar datos.
- No se ejecutaron subida/eliminación real, E2E automatizado, axe,
  Lighthouse ni comprobaciones responsive en dispositivo.

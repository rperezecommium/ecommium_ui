# Selector rápido de imágenes de variantes — 2026-11-10

Sustituye el panel lateral por un popover en portal anclado al botón de imagen.
Excluye la imagen efectiva actual y las inactivas. Mantiene la función de
asignación, portada de variante 0, herencia y guardado del cambio anterior.
Botón de quitar portada/restaurar herencia condicionado al estado actual.
No modifica la tabla ni sus anchos al abrirse. Scroll interno acotado,
reposicionamiento al scroll/resize/variación de tamaño, Escape/clic fuera,
recorrido por teclado y restauración de foco tras selección/cierre.

Validación:
- npm run build: correcto.
- npm run lint: sin errores; tres avisos previos fuera del cambio.
- node --test tests/product-variant-media.test.mjs tests/product-editor.test.mjs
  tests/product-save-operation-action.test.mjs tests/product-save-attempt.test.mjs
  tests/product-bff-scope.test.mjs: 71/71 correctos.
- La inspección visual quedó pendiente: Chrome tenía otra ventana del usuario
  activa. No se cambió su pestaña ni se guardaron asignaciones reales.
- No se ejecutaron E2E, axe, QA responsive ni Lighthouse. Se conserva pendiente
  la prueba del guardado contra BFF anotada en product-variant-images.md.

Ajuste tbii/tcfg: se elimina cabecera, cierre y explicación del selector;
se mantiene cierre por Escape/clic fuera/selección. Miniaturas de 30px de alto
(antes 60px), popover 160px y espaciado reducido. Sin portada pasa a botón de
icono ImageIcon con aria-label/title, manteniendo la misma acción.
Verificación focalizada: npx eslint del selector sin errores. No se repitieron
build, tests ni comprobaciones visuales para este ajuste visual.

# Precios específicos: tabla y panel lateral — 2026-11-13

Petición: lista independiente con el estilo de Productos y enlace visual
«Agregar precio específico» que abre el formulario en el lateral.

## Implementación

- `product-editor-client.tsx`: lista siempre visible, estado vacío útil, contador,
  columnas de aplicación/precio/unidades/duración/contexto/estado/acciones.
  Reutiliza `productListGrid`, `productListTable` y sus acciones compactas.
- El botón con apariencia de enlace usa `productImageAddLink` y anuncia un diálogo.
  Alta y edición reutilizan `AdminResourceDrawer`; se renderiza un único formulario
  únicamente mientras el panel está abierto. Guardar una regla cierra el lateral;
  Cancelar, Cerrar y Escape no cambian el borrador.
- El callback de cierre es estable para no reiniciar el foco al escribir. El
  drawer compartido mantiene el foco dentro y lo devuelve al disparador al cerrar.
- `globals.css`: contenedor de tabla con scroll horizontal acotado y formulario
  lateral de dos columnas, una en móvil, con los tokens existentes del Admin.
- No cambia el cálculo, los payloads, las condiciones, las fechas ni el momento
  de persistencia: las reglas se aplican al guardar el producto por el BFF.
  No hay cambios de backend ni operaciones sobre precios comerciales.

## Validación

```sh
npm run lint
npm run build
node --test tests/product-price-dates.test.mjs tests/product-bff-scope.test.mjs tests/product-editor.test.mjs tests/product-save-operation-action.test.mjs tests/pricing-admin.test.mjs
npx playwright test tests/e2e/admin-login.spec.ts -g 'product editor applies the pricing preview simulator|specific prices use a separate|product pricing preserves legacy BASE|pricing simulator sends future Madrid' --reporter=line
```

- **83 pruebas unitarias/contractuales PASS**.
- **5 Playwright PASS** en Next real con BFF fixture. Comprueban estado vacío,
  ausencia del formulario inline, alta de dos combinaciones sin reemplazarse,
  edición de una sin modificar la otra, Cancelar/Escape, foco al escribir,
  ciclo Tab/Shift+Tab, retorno al disparador y ausencia de guardado BFF automático.
- Se conservan las pruebas de BASE contextual, edición/reapertura del cambio
  horario de Madrid y simulación futura con variante, grupo y cantidad.
- Axe de los campos del formulario: **0 violaciones**. Drawer sin desbordamiento
  a 1440/768/390; tabla dentro de contenedor horizontal acotado al viewport.
- Build correcto. Lint: **0 errores y 3 warnings anteriores** de variables sin uso
  en customers-admin-actions, request-client e invoice-document-pdf.
- Capturas revisadas: `specific-prices-table.png` y `specific-price-drawer.png`
  bajo `test-results/admin-login-specific-price-5cdea-d-a-cancellable-side-drawer/`.

La evidencia es de UI con fixtures. No se ejecutan mutaciones sobre un BFF
comercial ni se recertifica el núcleo de Pricing en esta modificación visual.
La comprobación axe está acotada a los campos; no es una auditoría completa de
toda la pantalla. El scroll horizontal de la tabla en móvil es intencional.

## Ajuste visual confirmado por Ricardo

Se elimina «Precio» y su descripción. La caja de la lista tiene un único título
«Precio específico», h2 de 18px como el anterior, sin contador. El simulador se
extrae de esa caja y se muestra debajo como panel independiente de fondo blanco.
La lista reutiliza los colores de Productos, cabecera gris clara, separadores
finos y acciones compactas, sin marco adicional alrededor de la tabla.

Corrección posterior de fidelidad a la referencia: se retira también el fondo,
borde y padding de la tarjeta exterior de la lista. Panel y tabla transparentes
sobre el fondo de la página, igual que Productos. Únicamente el simulador
conserva su caja blanca. La regresión comprueba estilos computados transparentes,
borde/padding de 0px y fondo blanco del simulador.

Por petición posterior, se eliminan también las líneas secundarias de las celdas:
tipo de aplicación bajo el nombre, impuestos bajo el precio y canal/política
bajo el contexto. Solo cambia su presentación; esos campos siguen en el formulario
y en el borrador. La prueba del listado comprueba que no se rendericen subtítulos.
La separación entre el título/enlace de alta y la tabla pasa de 12px a 24px
para dar más espacio al inicio del listado.
En el lateral, «Aplicar a» ocupa una fila completa; los demás campos conservan
la distribución de dos columnas del formulario y el apilado responsive móvil.

Los mismos comandos de validación vuelven a pasar: 83 pruebas unitarias y 5
Playwright, lint sin errores (tres avisos previos) y build correcto. La regresión
de navegador comprueba explícitamente el título sin contador, ausencia del texto
retirado, separación DOM de ambos paneles y fondo blanco del simulador.

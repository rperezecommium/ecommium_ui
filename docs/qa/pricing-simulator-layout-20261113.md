# Distribución del simulador de precios

Cambio exclusivamente visual en `product-editor-client.tsx` y `app/globals.css`.
Las tres cajas tienen separación visible de 16px sobre el fondo de la página;
el contenedor exterior es transparente y no hay una superficie blanca común.
Corrección de separación verificada mediante build y el E2E del simulador:
1 pasa, con medidas de los dos gaps de 16px y captura revisada.
Formulario en tres columnas de escritorio, dos en tablet y una en móvil.
Resultado separado en tabla blanca: nombre del artículo, precio base y precio
aplicado. Se omiten pricingId, fuente, precio específico redundante y la franja
de contexto. Las condiciones mantienen solicitado/regla/estado en otra caja con
el estilo compartido del listado de productos. No se modifica el cálculo ni el
contrato o los parámetros enviados al BFF.

Validación ejecutada:

- `npm run build`: correcto.
- `npm run lint`: sin errores; mismas tres advertencias previas por símbolos sin uso.
- `npx playwright test tests/e2e/admin-login.spec.ts -g 'product editor applies the pricing preview simulator|pricing simulator sends future Madrid' --reporter=line`: 2 pasan.
- Se comprueban tres campos en la primera fila, orden de columnas, nombre,
  ausencia del ID y de la franja gris, fondo blanco y límites a 768/390px.
- El escenario Madrid conserva las peticiones de variante, grupo, cantidad y
  fecha futura sin guardar datos reales.
- Captura revisada visualmente en
  `test-results/admin-login-product-editor-6a549-ulator-from-the-pricing-tab/pricing-simulator-tables.png`.

Las pruebas usan el BFF de fixtures de Playwright, no servicios comerciales
reales. Logs locales: `/tmp/ecommium-simulator-layout-{build,lint,e2e}.log`.

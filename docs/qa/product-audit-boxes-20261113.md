# Auditoría: inventario, precios fijados y Routing/SEO

Se conserva el resumen de inventario. Debajo se añade «Precios fijados» con el
mismo componente visual (`details.productBasicSection`) y separación visible.
Al final aparece Routing/SEO cuando existe canonical, resolución o aliases.
Se retiran de esta pestaña IDs técnicos, trazabilidad de guardado, bloques
persistidos, recuperación y correlaciones. Los reportes y la gestión del guardado
siguen funcionando fuera de esta vista; no se eliminan datos ni contratos.

El resumen de precios lee el borrador existente: registros habituales del
producto y variantes, incluidos BASE contextuales, y precios específicos.
Muestra artículo, tipo, importe, unidades mínimas, contexto, vigencia y estado.
Omite registros marcados para eliminación y no duplica un pricingId compartido.
No calcula precios efectivos ni crea, transforma o guarda reglas.

Validación:

- `npm run build`: correcto.
- `npm run lint`: sin errores; tres advertencias anteriores por símbolos sin uso.
- `npm test`: 670 pasan, 0 fallos.
- Playwright: `product audit shows only` y `product audit includes` verifican
  precios habituales, variante con precio propio, precio específico, BASE
  contextual VIP, canonical configurado y ocultación de SEO sin datos. También
  verifican que abrir Auditoría no genera nuevas peticiones BFF.
- El borrador nuevo conserva el precio inicial cero definido por el modelo.
- Captura revisada: `test-results/admin-login-product-audit--231b4--SEO-without-extra-requests/audit-boxes.png`.

Pruebas con el BFF de fixtures; no con servicios comerciales reales.
Logs locales: `/tmp/ecommium-audit-boxes-{build,lint,unit,e2e}.log`.

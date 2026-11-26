# Precio normal y reglas especiales — QA UI 2026-11-16

Implementado sobre ADR-0316 y contratos existentes: normal sin default/país/canal obligatorios; reglas específicas opcionales y legacy conservadas. Precio normal básico sin/con impuestos; reglas/tablas/fechas en Precio. Cero explícito válido, moneda ausente rechazada y selectores vacíos visibles. No se añade motor de dominio en Next.

Migración **exacta aprobada**: 1.211 BASE/1.208 productos, importes e impuestos conservados, cero cambios inesperados. Manifiesto/journal canónicos en el informe backend, no duplicados en este repo.

Compras con servicios reales:

| Compra | Comprador / proveedor | Producto + transporte = pago/pedido |
| --- | --- | --- |
| 10055 | invitado / Stripe test, livemode=false | 26,62 +11,35 =37,97 EUR |
| 10056 | registrado / PayPal sandbox | 26,62 +11,35 =37,97 EUR |

Persistencia, huella Checkout/Payments, captura PSP e inventario verificados: un pedido, una liquidación y una reserva por compra. Stock QA autorizado2→1→0; no se inventa stock físico ni se realiza un cobro real. Reintento concurrente devuelve el mismo10056 sin duplicación. Cantidad100.000 rechazada400 sin cambiar cantidad1 ni importe2.662. Las confirmaciones y seguimientos10055/10056 son consultables.

Validación: UI683 PASS, lint0errores/3avisos anteriores, build PASS; BFF1031, Pricing171, Checkout68, ReadIndex86 PASS; ensayo PostgreSQL/HTTP por sockets PASS, distinto del E2E desplegado. Admin muestra22,00 neto/26,62 bruto y conserva dos específicos. Categoría bicicletas sin sesión muestra16 fichas/500. Responsive básico1440/1024/390 sin desbordamiento horizontal. Comandos: `npm test`, `npm run lint`, `npm run build`, navegador Playwright sobre stack levantado por script canónico.

Axe en drawer de específico:18 reglas pasan; falla contraste de ayuda3,86:1 y primario2,33:1 con tokens compartidos previos. No se declara accesibilidad global aprobada ni nueva certificación Lighthouse/CWV/CDN. Permanecen fuera de alcance producción, entrega física, incidencias históricas10050/10051 y protección exhaustiva de baja del último habitual. Los precios fuera del manifiesto conservan sus restricciones; no se promete cobertura normal del catálogo entero.

[Contrato local](../composable-reference/regular-and-specific-prices-contract.md). [Informe canónico completo, plan, migración y recuperación](../../../ecommium/composable_ecommerce/.docs/qa/regular-pricing-20261116.md). Evidencias pequeñas sin secretos en `regular-pricing-20261116-evidence/`; snapshots privados permanecen fuera del repo.

# Corrección del recorrido comercial — evidencia 2026-11-16

**Resultado: implementación local parcial validada; recorrido E2E NO VALIDADO por configuración comercial, según decisión expresa del usuario. No se declara completado el objetivo integral.** No se hicieron cobros reales ni se alteraron reglas/precios/pesos/stock para conseguir una prueba.

## Plan controlado (mayor a menor complejidad)

1. **Contexto persistido — muy alta.** Causa: PDP enviaba país/canal; Checkout perdía ese contexto y usaba defaults globales. BFF/Checkout/ShopContext y DTO Prisma. Snapshot aditivo, fuente país explícita, preservar moneda histórica. Depende de contratos03/05/ADR0316/0317. Riesgo: migración/legado y mercado obsoleto. Aceptación: dos tiendas/monedas persisten sin contaminación y Pricing recibe snapshot; fallo sin datos completos. Revertir código y mantener columna nullable.
2. **Revalidación — alta.** Causa: lectura/actualización y suma de SKU no comprobaban siempre la cantidad final ni actualizaban precio/cupón. Checkout/Pricing/Inventory/Promotions. Revalidator obligatorio, candidato separado y control optimista. Depende1. Riesgo: latencia, rechazos legítimos y conflictos. Aceptación: cantidad agregada real, stock insuficiente sin guardado parcial,409 concurrente y fallo owner cerrado. Revertir casos de uso/repositorio conjuntamente.
3. **Vinculación pago/pedido — alta.** Causa: campos browser podían dominar contenido y pago no quedaba ligado a los hechos del carrito; upsert alteraba pedidos repetidos. BFF/Payments/Orders. Huella servidor, snapshot interno, SETTLED + Inventory COMMITTED, índice único, replay inmutable y recuperación idempotente. Depende1/2. Riesgo: rechazar transacciones antiguas no vinculadas e índice sobre duplicados. Aceptación: discrepancias tenant/cart/moneda/importe/líneas/transacción/inventario rechazadas; retry no cobra dos veces. Revertir coordinadamente; mantener índice hasta auditar, no borrar transacciones.
4. **Paquete y origen reales — media-alta.** Causa: peso/origen/dock ficticios ocultaban configuración ausente. Catalog/Shipping/Inventory/Checkout/UI. Paquete efectivo owner, almacén activo que sirve destino y con stock; identificador SLA servicio+origen. Depende1/2. Riesgo: catálogos incompletos pasan a fallar explícitamente. Aceptación: falta peso u origen elegible rechaza; no defaults1000g/warehouse-default. Revertir gateways y contrato juntos, sin fabricar datos.
5. **Capacidades PSP/moneda UI — media.** Causa: inferencia por nombre/defaults de moneda y métodos de certificación confundibles. Payments/BFF/UI. Lista pública segura filtrada por ruta real y provider explícito; moneda canónica carrito. Depende1/2/3/4 para compra. Riesgo: ya no ofrecer métodos mal configurados. Aceptación: nombre no suplanta proveedor, no fuga secretos y respuesta coherente con ruta. Revertir DTO y consumidor juntos.
6. **Validación de laboratorio — media.** Ejecutar gates anteriores antes del E2E. Reutilizar servicios/BD y sandbox autorizados; sin modificar datos reales. Riesgo: config legítimamente incompleta. Criterio integral: selección→cantidad→Shipping→sandbox→consulta persistida; queda NO VALIDADO si cualquier etapa falla. QA SQL aislado crea/elimina solamente su propia base.

Ejecución respetó dependencias aunque la lista está ordenada por complejidad. Copias previas por archivo: `/tmp/ecommium-commercial-20261116/originals/{backend,ui}` (marcadores `.absent` para archivos nuevos). Conservan cambios previos del usuario; no hay commit/reset global. No constituyen respaldo externo permanente.

## Cambios por servicio

- Checkout: contexto JSON nullable y factory runtime separada de seed; interceptor request; revalidator obligatorio; reprice/cupón/stock/cantidad agregada; invalidación; merge y control optimista; snapshot interno para pedido pagado.
- BFF: contexto resuelto ShopContext sin fallback global; adapters propagan snapshot; importe/referencia/venta derivadas del carrito del actor; hash servidor; pedido desde snapshot y validación de pago/inventario.
- Pricing: **sin cambios de reglas ni configuración**. Checkout deja de imponer moneda/país/canal/grupo globales y respeta ADR0316. Sessions/segmentación conserva opt-in ADR0317.
- Shipping: disponibilidad por origen y paquete de Catalog; no autoseed durante lectura de configuración ni fallback de peso/origen.
- Payments: métodos públicos sin secretos, provider/entorno explícitos, ruta real; huella y metadata protegidas; inventario de intención guardada y replay sin recaptura.
- Orders: índice único por pago, creación/replay inmutables, rechazo de datos distintos y evento estable.
- UI: moneda del carrito tiene precedencia; contexto explícito, país de dirección vacío hasta selección, sin peso/origen ficticios; métodos con provider explícito.

## Configuración observada, sin mutaciones

1711 productos activos en tienda del laboratorio. Solo «Ajustador de frenos en cromo» (producto e388f867-cf90-4fa9-bab6-2a2a2c5dcbc8) tiene peso efectivo40g; sus variantes no tienen stock en almacén activo Shipping8df995ce-cae9-4a4f-b63a-85c7f453edf5. El único SKU con stock allí, eabf9119-13cd-425a-87ba-28112934a260, no tiene peso. El stock del SKU Sunrace se encuentra en `warehouse-default`, que no es origen Shipping configurado. No se movió.

Para iniciar el stack cuando se vaya a retomar la prueba: `./scripts/postman-services.sh up-missing`; tras migraciones y coordinación, `./scripts/postman-services.sh restart-selected <servicio> [servicio...]` debe usar los nombres admitidos por el script, no ejecutar contra schemas antiguos.

Las reglas efectivas EUR/ES/web permiten PayPal; Stripe configurado exige USD. No se cambió moneda ni routing para forzar Stripe. Hay credenciales sandbox configuradas (no se incluyen secretos). El usuario autorizó aprobación humana PayPal, pero nunca se alcanzó esa etapa por Shipping. No se autorizó ningún cargo ni se capturó dinero.

## Pruebas y límites

Los resultados finales y comandos quedan en `commercial-purchase-20261116-evidence/checks.json` y logs resumidos. Builds de Checkout, Shipping, Payments, Orders, BFF y UI; suites completas de cada paquete. UI lint sin errores, tres advertencias existentes. Lint backend focalizado conserva incidencias preexistentes (parámetros sin uso/interfaz vacía); Shipping carece de configuración ESLint. No se presenta lint backend como PASS integral.

Prueba reproducible `scripts/qa/cart-commercial-integration.cjs`: Docker ce-postgres, migraciones Checkout en BD propia desechable, repositorio/casos de uso compilados reales y HTTP Catalog/Pricing/Inventory reales. Verifica GBP/GB/retail y JPY/JP/mobile en dos shops aislados (persistencia, no compra en esos mercados); EUR/ES/web con SKU real, qty1→2→3, oracle Pricing real sin precios comerciales esperados fijos, exceso stock rechazado, persistencia sin cambio parcial y carrera409. Elimina su BD incluso al fallar. No escribe en BD comerciales de owners.

Reproducir desde raíz backend tras builds:

```sh
./scripts/postman-services.sh status
QA_ORGANIZATION_ID=<org-real> QA_SHOP_ID=<shop-real> QA_VARIANT_ID=<sku-real> QA_CURRENCY=<moneda-real> QA_COUNTRY=<pais-real> QA_CHANNEL=<canal-real> QA_LOCALE=<locale-real> node scripts/qa/cart-commercial-integration.cjs
```

Para levantar laboratorio usar subcomandos canónicos documentados de `./scripts/postman-services.sh`, sin despliegue/migración comercial implícita. Por paquete: `npm run build` y `npm test -- --runInBand`. UI: `npm run lint`, `node --test tests/*.test.mjs`, `npm run build`.

**NO VALIDADO:** navegador guest y Customer con stack modificado completo; compra con varios mercados y segmentación autenticada; descuentos/tiers reales configurados; cotización válida para un SKU con peso+stock reales; autorización/captura sandbox; pedido E2E y efectos de todos los owners; caída/reintento distribuido extremo a extremo; Lighthouse/axe/responsive de este recorrido. Unitarios usan dobles explícitos; no sustituyen estos gates. No se aplicaron las migraciones nuevas a las bases comerciales ni se reiniciaron sus procesos con schema nuevo.

## Fuera de alcance documentado

Se observaron superficies heredadas que requieren revisión separada: permisos/ownership guest en mutaciones directas legacy, precisión calendario laboral de promesas `bd`, restricciones de transportista por producto, y cobertura general de schemas UI que permanece pendiente en securityReadme. No se implementan nuevas funcionalidades ni se cierran hallazgos de seguridad sin evidencia. La recuperación automática completa desde UI tras fallo Inventory sigue pendiente de prueba real; el servicio permite replay existente de settlement sin recaptura.

## Reversión

Detener consumidores del cambio antes de revertir. Comparar cada archivo con su backup previo, restaurar únicamente los de esta intervención y retirar nuevos archivos solo tras comprobar que no recibieron trabajo posterior. Reconstruir paquetes. Conservar datos/columna additive; no ejecutar DROP ni UPDATE de negocio. Auditar duplicados antes de desplegar índice Orders; si su creación falla, no desplegar Orders dependiente. Código rollback no revierte capturas ni inventario: cualquier transacción financiera usa sus procedimientos de owner.

## Resultados finales registrados

| Paquete | Pruebas PASS | Build |
|---|---:|---|
| Checkout |66|PASS|
| Shipping |41|PASS|
| Payments |74|PASS|
| Orders |29|PASS|
| BFF |1025|PASS|
| UI |671|PASS|

Total1906 pruebas. Añadidos contratos de procedencia del país, aislamiento request, fallos de owner y query duplicada; mismatch de transacción e inventario; suplantación de provider por nombre; protección metadata y retry de inventario sin recaptura. No son1906 compras reales.

Además se ejecutó `node scripts/qa/order-payment-idempotency-integration.cjs`: migraciones y repositorio Orders sobre PostgreSQL aislado, un registro por pago, replay inmutable,409 por cambio comercial y P2002 al violar directamente índice. Sus registros técnicos son fixtures exclusivos de una BD eliminada, no pedidos comerciales. Logs en evidencia.

Se retiró el bypass global CHECKOUT_INVENTORY_AVAILABILITY_ENABLED y el almacén global de ese resolver: la disponibilidad agregada procede de Inventory y Shipping valida después el origen real. Un fallo de red al consultar servicios adicionales Pricing ya no se trata como una lista vacía. No se han editado variables privadas del laboratorio.

Delta exacto respecto al estado previo sucio: backend `.docs/qa/commercial-purchase-20261116-evidence/task-changes.patch` y `files.json` con hashes antes/después. La copia original en /tmp y este patch permiten revisar/revertir solo esta intervención; no aplicar reversión sobre archivos modificados posteriormente sin comparación.

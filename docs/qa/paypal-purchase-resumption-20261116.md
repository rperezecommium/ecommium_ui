# Prueba comercial PayPal y Stripe sandbox — resultado 2026-11-16

**Último resultado: PayPal invitado10053 y Stripe invitado10054 VALIDADOS en sandbox con datos simulados; históricos parcialmente pendientes. Ver continuación al final.**

**Resultado previo: pedido10052 VALIDADO en sandbox con datos simulados.** Conserva snapshot pagado,1 captura,1 pedido,1 reserva, stock1→0 y reintentos concurrentes sin duplicados. Los intentos previos fallidos y sus pendientes se mantienen documentados. Ver sección final.

**Estado histórico de los primeros intentos: NO SUPERADA integralmente.** El primer pago y pedido existen y son consultables, pero la auditoría detectó dos reservas para una unidad. Se corrigió el defecto y se probó con PostgreSQL real. El segundo intento, ya con esa corrección activa, espera aprobación con comprador PayPal sandbox. No sustituir este estado por PASS basándose en HTTP201 o en la pantalla de confirmación.

## Configuración explícita y datos simulados autorizados

El usuario acordó usar la política comercial `default` para B2C de esta tienda; invitado y registrado tienen la misma regla, sin crear grupos ni precios duplicados. Selección server-side `ECOMMIUM_STOREFRONT_TRADE_POLICY`, sin valor por defecto en código. Requiere Organization/Shop canónicos explícitos; solo se adjunta a rutas comerciales del mismo tenant/shop. No se obtiene de idioma/geolocalización, Shop defaults, perfil ni del primer precio encontrado. Configuración privada del laboratorio selecciona `default`; no se publican sus secretos. Otra tienda conserva su propia selección o ninguna. Conflicto de selección se rechaza.

Producto080eb6a9-11e6-45c9-8719-fc326225452e, variante f03e68e1-2690-4be7-8d32-feb82b580e9c: paquete simulado6kg y1200×700×250mm. Stock QA3 en origen8df995ce-cae9-4a4f-b63a-85c7f453edf5, sin alterar las29 unidades de warehouse-default. Se utilizó dirección de entrega simulada Murcia30001/MU, porque las tarifas EUR existentes cubren esa zona. Documento de contacto de tipo sandbox, solo en snapshot del pedido, sin editar documento Customer. Se usó tarjeta del generador oficial PayPal, no una tarjeta real ni números completos en esta evidencia.

Esto es validación técnica de sandbox con datos simulados; no acredita medidas, existencias físicas, fiscalidad completa ni aptitud para producción.

## Correcciones adicionales demostradas durante la prueba

1. **Política no transmitida.** Pricing devolvía404 sin tradePolicy; con la política configurada existente devuelve la regla582250c8-69ec-4712-89b4-faf945403edb. UI/BFF conservan la selección server-side por tienda sin cambiar precios. Precio con impuesto configurado4196,12€.
2. **Lecturas y merge concurrentes.** Lecturas idénticas ya no escriben por cambiar solo updatedAt. Merge PostgreSQL serializa actores con locks transaccionales antes de leer/eliminar links. BFF preserva409 de Checkout.
3. **Tarifas de otra moneda.** Shipping estaba aplicando reglas USD a EUR, incluso marcándolas gratuitas por umbral. Ahora filtra moneda antes de tramos, umbrales y comportamiento fuera de rango. No hubo cambio de tarifas. Con regla EUR de zona QA: envío0,61€; total4196,73€.
4. **Replay Orders.** Dominio usa null y parser omite campos opcionales de recogida; se normaliza esa equivalencia en la identidad comercial, sin ignorar otros hechos. Un pedido persistido puede reintentarse tras rotación del carrito solo después de comprobar tenant y propietario persistidos; se verifica el snapshot histórico/pago y se rechaza otro comprador o carrito. BFF preserva409 Orders.
5. **Inventory duplicado bajo concurrencia.** Dos callbacks podían leer ausencia de venta y guardar dos reservas/descuentos en escrituras separadas. Venta ahora ejecuta lectura, validación, stock y reservas en una sola transacción PostgreSQL; bloquea saleId y claves de stock, agrega líneas duplicadas y rechaza reutilización con otras cantidades/hechos. Eventos se publican después de commit. No se borraron ni maquillaron las reservas históricas del intento fallido.

## Evidencia del primer intento

- Carrito: of_bce7893d-284d-4599-912f-fdeaaacc3648.
- Transacción y pedido técnico:85f83766-9d40-439e-aef9-6aee9584d818; referencia humana10050.
- Moneda/contexto: EUR/ES/web/default, país DELIVERY_ADDRESS tras cotización.
- Producto419612 minor + envío61 minor = total419673 minor.
- PayPal sandbox: captura9A088904TV472883V, consultada directamente por API owner sandbox, estadoCOMPLETED, EUR4196,73. Una liquidación persistida y un pedido persistido.
- Cuenta cliente muestra «Pedido #10050», total4196,73€, producto1×4196,12€; seguimiento accesible.
- **FALLO:** Inventory conserva dos reservas CONFIRMED de1 unidad para el mismo saleId/carrito:367ccfed-0a45-4e4d-9278-0a4ba49181c4 y4e8d5619-0b57-488f-a861-7bcbfeb5e33f. On-hand QA pasó3→1, en vez de3→2. No se certifica coherencia de este intento.
- La sesión Customer caducó durante la investigación; se inició de nuevo con la misma cuenta y se recuperó el mismo pedido sin capturar de nuevo. No se mezclan credenciales de tienda y PayPal.

## Segundo intento y bloqueo externo actual

Carrito of_17b2011d-a3ef-4f8c-89a8-cf0c46561c51; transacción eeaac384-4dee-48db-acbd-3550c376c90d; PayPal order6TM95306SC7011640. Contexto y precio correctos; contacto, cotización EUR y envío guardados por UI/BFF. Importe419673 minor. Estado Payments PAYMENT_DATA_RECEIVED: no se ha aprobado/capturado este segundo pago ni confirmado su pedido.

PayPal ofreció checkout sin cuenta en el primer intento. En este segundo muestra creación/inicio de cuenta y dejó de ofrecer el interruptor de invitado. Se pidió al usuario aprobar con comprador PayPal sandbox o facilitar sus credenciales sandbox. No se creó una cuenta PayPal, no se inventó aprobación y no se usaron sus credenciales Storefront como credenciales PayPal. Mantener la pestaña pendiente. Si caduca, recuperar según estado owner antes de iniciar otra transacción.

## Pruebas ejecutadas

| Paquete | Pruebas satisfactorias |
|---|---:|
| UI |674|
| BFF |1028|
| Checkout |66|
| Shipping |42|
| Payments |74|
| Orders |30|
| Inventory |44|

1958 pruebas unitarias/contratos en total; no son1958 compras. Builds de paquetes afectados y UI satisfactorias. Lint UI sin errores y3 avisos existentes. Lint backend focalizado mantiene incidencias anteriores; Shipping e Inventory carecen de configuración ESLint. No presentarlos como gate integral aprobado.

`inventory-sale-concurrency-integration.cjs` PASS con PostgreSQL real aislado: dos solicitudes simultáneas misma venta → una reserva/descuento; ventas distintas sobre stock insuficiente → una aceptada; cambio de intención → rechazo; fallo dentro de transacción → rollback. BD propia eliminada al terminar. No reemplaza el segundo E2E pendiente.

Navegador invitado en contexto nuevo sin cookie Customer: PDP → add201 → carrito → cantidad1→2→1 con PATCH200; precio4196,12 coincidente. Compra invitada completa/pago invitado Storefront NO VALIDADOS (la compra pagada fue Customer con tarjeta invitada dentro de PayPal, conceptos distintos).

Comprobaciones persistidas/PSP: script `scripts/qa/verify-sandbox-purchase.cjs`, solo lectura, requiere QA_PAYMENT_TRANSACTION_ID/QA_CART_ID/QA_ORIGIN_STOCK_BEFORE. Guarda resultado e informa fallo si reservas/stock no coinciden; la evidencia del primer intento dice FAILED_INVENTORY_UNIQUENESS. No se sustituyó por un mock ni se eliminaron los registros para obtener PASS.

## Pendientes y reversión

- Aprobar segundo pago sandbox y verificar exactamente un pedido/liquidación/reserva, decremento de una unidad, importe PSP y consulta UI.
- Reconciliar por procedimientos de Inventory la reserva/unidad extra del primer intento; pendiente, conservada como evidencia. No borrar filas ni ajustar cifras a ciegas. Un rollback de código no revierte stock/capturas.
- Compra Storefront invitada completa, Stripe, matrices de países/tiendas/grupos y fiscalidad completa siguen NO VALIDADOS. No modificar reglas USD/ES/web de Stripe para forzar EUR.
- Se aplicaron y registraron las migraciones aditivas Checkout20261116110000 y Orders20261116120000, tras auditoría sin duplicados de pago. Se reiniciaron servicios del laboratorio con Node22 canónico, incluida la corrección Inventory (sin migración nueva para esta).
- Copias previas por archivo en `/tmp/ecommium-commercial-20261116/originals`, sin resets del estado previo sucio. Variable privada de política: revertir solo la línea ECOMMIUM_STOREFRONT_TRADE_POLICY cuando corresponda; no publicar la copia privada de env. Retirar selección server-side de forma coordinada con consumidores. Restaurar código no elimina datos de negocio aditivos ni históricos.


## Resultado final tras aprobación del comprador sandbox

**Compra registrada PayPal sandbox VALIDADA con datos simulados: pedido10052.** Esto no cambia ni oculta los fallos históricos de10050/10051, ni certifica producción o Stripe. No se almacenan credenciales del comprador en documentos.

El comprador sandbox proporcionado inició sesión y aprobó los pagos. Se añadió a su cuenta PayPal sandbox una dirección QA Murcia30001, sin cambiar su dirección preferida; se seleccionó para que coincidiera con el destino cotizado. Al repetir, se reutilizó esa misma dirección QA. Se empleó financiación simulada de la cuenta sandbox; no una tarjeta/cuenta real. No se efectuaron cobros reales.

### Segundo intento10051 y corrección de conservación

Transacción eeaac384-4dee-48db-acbd-3550c376c90d: PayPal capturó4196,73EUR, capture07754293A3795792J; Orders creó10051 y la cuenta lo muestra. La auditoría posterior detectó que el cliente borraba las líneas del carrito pagado con DELETE antes de forceNewCart; su snapshot quedó en0 en vez de419673. **Ese intento no acredita conservación del snapshot. No se reconstruyó el carrito perdido con JSON inventado.**

Se sustituyó esa limpieza por `rotatePurchasedCart` en checkout y retorno PSP: solicita un nuevo carrito distinto y vacío, verifica la respuesta y actualiza el contador/local pointer, sin DELETE del pagado. Fallo de creación/identidad se propaga. Un409 al crear pedido ya no se trata como éxito. Tests de UI que exigían el comportamiento destructivo se actualizaron al contrato correcto, más3 pruebas ejecutables del helper.

Durante el replay real se confirmó además que GET Orders devuelve DTO plano, no envelope `order`; BFF acepta ambos y mantiene comprobación de propietario antes del snapshot histórico. Se añadió prueba contractual de la forma real.

### Última compra de control10052

Se registró una unidad QA adicional de laboratorio en el mismo origen mediante Admin/BFF, partiendo de0; no es reposición física ni se alteran precios/reglas. Es un nuevo fixture explícito para comprobar la corrección, sin borrar ni modificar la anomalía previa.

| Hecho verificado en owners/PSP | Resultado |
|---|---|
| Carrito conservado |of_4311c255-4f20-434c-a1c1-48571133a8f2, líneas y total originales|
| Transacción/pedido |c5f89706-efaf-4d75-902e-49c7f72fcb9c / referencia10052|
| Producto / envío / total |419612 +61 =419673 minor EUR|
| Contexto persistido |EUR / ES / web / default / DELIVERY_ADDRESS|
| Regla Pricing real |582250c8-69ec-4712-89b4-faf945403edb; importe coincidente|
| Huella comercial |Snapshot Checkout conservado coincide SHA256 con Payments|
| Captura PayPal sandbox consultada |7TF501019R947402H, COMPLETED,4196,73EUR|
| Dirección PSP |País, código postal, ciudad y calle coinciden con Checkout|
| Liquidaciones / pedidos |1 /1|
| Inventory |1 reserva CONFIRMED de1 unidad; stock QA1→0|
| Consulta navegador |Confirmación, Mis compras y seguimiento10052 accesibles|
| Dos reintentos concurrentes |201/201, mismo pedido10052 y evento3b7b6020-629d-50b0-a737-94c06189706b|
| Verificación tras reintentos |Sigue1 pedido,1 liquidación,1 reserva; stock0, sin nuevo cobro|

Evidencia canónica `paypal-purchase-20261116-evidence/final-purchase-10052.json`; checker directo PSP/Prisma `scripts/qa/verify-sandbox-purchase.cjs` terminó0, sin mocks. Comando final:

```sh
QA_PAYMENT_TRANSACTION_ID=c5f89706-efaf-4d75-902e-49c7f72fcb9c QA_CART_ID=of_4311c255-4f20-434c-a1c1-48571133a8f2 QA_ORIGIN_STOCK_BEFORE=1 QA_TRADE_POLICY=default QA_VERIFY_PROVIDER_ADDRESS=true QA_PSP_INSTRUMENT=SANDBOX_BUYER QA_EVIDENCE_OUTPUT=/tmp/ecommium-commercial-20261116/paid-purchase-final-evidence.json node scripts/qa/verify-sandbox-purchase.cjs
```

UI677 y BFF1029 PASS; total actualizado1962 pruebas de código, además de los ensayos PostgreSQL y la compra sandbox. `npm run lint` UI sin errores,3 avisos previos; `npm run build` UI PASS. Gates backend y límites de lint anteriores se mantienen.

### Límites que permanecen

-10050 conserva dos reservas y una unidad extra descontada: reconciliación histórica pendiente por procedimientos del owner; no borrada para obtener PASS.
-10051 perdió su snapshot antes de corregir la limpieza; se conserva el pedido/pago y la incidencia, sin rellenar historia artificial.
-No hubo compra Storefront invitada completa ni Stripe; invitado solo carrito/cantidades.
-La selección de dirección PSP se alineó manualmente. La imposición automática de la dirección por el adapter no queda acreditada por este test; requiere revisar su contrato antes de certificarla.
-Paquete, stock, dirección y documento son simulados autorizados; fiscalidad completa/matrices de segmentos/otros tenants y producción no certificadas.


## Continuación: invitado, Stripe e incidencias históricas — 2026-11-16 14:20 UTC

**Invitado PayPal10053 y Stripe10054 VALIDADOS en sandbox con datos simulados.** Esta sección actualiza los pendientes de las secciones anteriores, que se conservan como historial. La conciliación histórica sigue parcialmente pendiente; no se declara cierre integral del objetivo original.

### Pruebas nuevas con servicios y proveedores reales

Navegador aislado `guest-commercial-validation`, sin cookie Customer: producto080eb6a9 → añadir → contacto invitado → dirección QA Murcia30001 → Shipping cotizado y guardado → PSP sandbox → retorno → confirmación → seguimiento sin login. Orders conserva customerId nulo y guestSessionId presente. El login en PayPal sandbox pertenece al proveedor y no convierte al visitante en cliente registrado de Storefront. No se enviaron credenciales a la documentación ni se usaron cobros reales.

| Comprobación | PayPal invitado | Stripe invitado |
|---|---|---|
| Pedido |10053|10054|
| Transacción |fae52554-e803-4d5a-9e47-85c9886ff147|ac8564e4-19b2-406b-83a5-8880cb74398a|
| Importe |419673 minor EUR|419673 minor EUR|
| Producto + envío |419612 +61|419612 +61|
| Captura PSP |7AS57939C5788162H COMPLETED|ch_3UcQk4CAxhBYlrpM0fy1EoLH succeeded, livemode=false|
| Pedido / liquidación / reserva |1 /1 /1|1 /1 /1|
| Stock origen QA |1→0|1→0|
| Snapshot pagado |Conservado; hash coincide Payments|Conservado; hash coincide Payments|
| Reintentos simultáneos |201/201, mismo10053|201/201, mismo10054|
| Verificación posterior |Sin capturas/pedidos/reservas adicionales|Sin capturas/pedidos/reservas adicionales|
| Seguimiento invitado |/pedido/10053/seguimiento confirmado|/pedido/10054/seguimiento confirmado|

Pricing real582250c8-69ec-4712-89b4-faf945403edb; contexto EUR/ES/web/default, countrySource DELIVERY_ADDRESS. Stripe confirma amount=amount_received=amount_captured=419673, amount_capturable=0, PaymentIntent succeeded y metadata de Organization/Shop/transacción/carrito coincidente. También se compararon líneas, cantidades, importes y dirección Orders con Checkout; no solo HTTP200. Stripe no recoge dirección de envío: el destino validado permanece en Checkout/Orders, sin afirmar igualdad con una dirección inexistente en PSP.

### Decisión comercial Stripe autorizada

El usuario autorizó expresamente: «La tienda debe admitir Stripe en EUR; autorizar su configuración comercial». Se creó por Admin → BFF → Payments la regla `stripe-es-eur-web`, Stripe ES EUR WEB, stripe-card → stripe-affiliate, prioridad300, EUR/ES/WEB, mínimo1000 minor, sin máximo. Se conserva la regla USD anterior y su resto de condiciones. No se alteró Pricing ni se creó precio para el producto probado. Stripe tiene clave test, y el proveedor confirmó livemode=false. Instrumento de prueba de [documentación oficial Stripe](https://docs.stripe.com/testing); no datos reales de tarjeta.

Antes de esta autorización se auditaron40 precios USD activos: grupos b2c/vip-table/vip/ES/web, cockpit-vip/vip/US/mobile y un precio universal. Los dos productos USD consultados que podrían servir al contexto ES no existen en el catálogo de esta tienda; por eso no se forzó una compra USD. Evidencia `stripe-usd-price-audit.json`.

Gap UI fuera del alcance: el formulario Crear regla no muestra salesChannel, aunque su schema/action ya lo soportan. Se envió WEB mediante el formulario existente para respetar el alcance de canal, y se verificó el valor persistido. No se añadió una pantalla ni se amplió la regla a todos los canales.

### Tratamiento de los incidentes históricos

- **10050: efecto sobre stock compensado; anomalía de reservas conservada.** Lectura previa confirmó dos reservas CONFIRMED de1 para una única compra y stock QA0 después de los intentos posteriores. Se restituyó exactamente1 unidad mediante el ajuste existente Admin/BFF Inventory. Evento owner `inventory.stock-level.upserted.v1` af7a738e-0e2b-4d1d-a822-50a06dcf3385, 14:08:31 UTC, stock0→1. Esa unidad se usó después en10053. No fue devolución física ni se abrió un caso posventa ficticio. Las dos reservas originales se conservan; no se borraron ni se falseó su estado. **Conciliación formal de reservas NO RESUELTA:** release no cambia reservas confirmadas, y el contrato Inventory de recovery/reconcile permanece DRAFT/NOT_IMPLEMENTED. No se introdujo SQL correctivo ni una funcionalidad de recuperación fuera del alcance.
- **10051: carrito histórico NO RECUPERADO.** Pedido y pago419673EUR se conservan, pero Checkout tiene0 líneas/total0. No se encontró snapshot íntegro auténtico en los logs y artefactos disponibles; una huella SHA256 y el pedido no permiten reconstruir exactamente todos los campos del carrito. Se conserva el daño documentado, sin inventar JSON ni reescribir el historial. Recuperación pendiente de una copia auténtica y procedimiento owner aprobado. El defecto ya corregido no se reproduce en10052/10053/10054.

Para Stripe10054 se creó por Admin una nueva unidad de stock QA explícita,0→1, consumida1→0. No se trasladó stock de warehouse-default; sus29 unidades permanecen intactas. Compensar10050 no añade un fixture nuevo: corrige su descuento duplicado. Total de unidades QA introducidas como fixture5, cinco compras válidas de1, un descuento duplicado histórico+1 y compensación+1: stock QA final0.

### Evidencias, comandos y límites

JSON: `guest-purchase-10053.json`, `stripe-purchase-10054.json`, `historical-incidents-followup.json`, `stripe-eur-config.json`. El JSON invitado conserva en ownerScriptLimitationsAtRun el texto genérico histórico del verificador; la comprobación adicional del navegador y de identidad persistida acredita ahora invitado. Las limitaciones antiguas no se usan como evidencia de una prueba nueva.

- `QA_PAYMENT_TRANSACTION_ID=fae52554-e803-4d5a-9e47-85c9886ff147 QA_CART_ID=of_e93dd98a-dd28-43a4-bd88-8831071df23a QA_ORIGIN_STOCK_BEFORE=1 QA_TRADE_POLICY=default QA_VERIFY_PROVIDER_ADDRESS=true node scripts/qa/verify-sandbox-purchase.cjs`: PASS antes y después de replay.
- `QA_PAYMENT_TRANSACTION_ID=ac8564e4-19b2-406b-83a5-8880cb74398a QA_CART_ID=of_8cf06bff-e4d0-43d8-9280-a1ab1a314031 QA_ORIGIN_STOCK_BEFORE=1 QA_TRADE_POLICY=default node scripts/qa/verify-stripe-sandbox-purchase.cjs`: PASS; consulta PSP real solo lectura y aserciones de persistencia.
- `node --check scripts/qa/verify-stripe-sandbox-purchase.cjs`: PASS.

En esta continuación no se cambió código de producción, migraciones ni defaults; solo configuración autorizada, ajuste/fixture explícitos, script de verificación de solo lectura y evidencia. No se repitieron suites/build/lint/a11y/performance sin cambios de runtime/UI; sus resultados anteriores siguen fechados en las secciones previas y no se presentan como nuevos. Tampoco se cierra el backlog de seguridad por haber completado una compra.

Reversión de configuración: desactivar únicamente `stripe-es-eur-web` mediante Admin con confirmación; conservar USD. Esto no revierte pagos sandbox ni pedidos ya persistidos. No repetir el ajuste compensatorio ni restar una unidad a ciegas: la compensación ya fue consumida por10053. Un cambio futuro debe partir de nueva lectura owner y preservar ambos eventos e incidencias. Las copias previas de archivos siguen en `/tmp/ecommium-commercial-20261116/originals`.

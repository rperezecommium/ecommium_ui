# ADR-0318 — Contrato del recorrido comercial (2026-11-16)

Estado: implementación local; compra completa NO VALIDADA. Amplía aditivamente los contratos03/05 y ADR0316/0317; no modifica reglas legítimas de Admin.

## Autoridad y recorrido

| Dato | Origen/autoridad | Transporte |
|---|---|---|
| Organization/Shop | contexto canónico de despliegue + validación de actor BFF | Next → BFF → owners |
| Moneda/país/canal/locale inicial | ShopContext efectivo o selección explícita | query BFF → ALS por request → Checkout |
| País detectado | señal del navegador sin autoridad comercial | no se convierte en país de entrega |
| País de entrega | dirección normalizada y cotizada por Checkout/Shipping | snapshot DELIVERY_ADDRESS solo tras éxito |
| Grupo cliente | Sessions vigente, ADR0317 y sus flags coordinados | no query ni default global |
| Precio/tablas/políticas | Pricing, reglas contextuales y universales vigentes | Checkout usa snapshot y cantidad agregada |
| Peso/dimensiones | paquete efectivo de Catalog | Shipping consulta owner; no peso ficticio |
| Origen/stock | almacenes activos de Shipping + disponibilidad Inventory | SLA identifica servicio y almacén real |
| Provider/entorno | ruta Payments + configuración segura del adapter | DTO público allowlisted |
| Importe de pago | carrito canónico revalidado | BFF reemplaza importe/moneda/referencia del navegador |
| Pedido | snapshot persistido de Checkout y transacción Payments | BFF valida tenant/actor/huella/liquidación/inventario |

`commercialContext` persistido en Orderform: `{currency,country,channel,locale,countrySource,priceTableId?,tradePolicy?}`. La moneda del carrito prevalece en UI. `countrySource` es SHOP_DEFAULT o SELECTED desde el borde; DELIVERY_ADDRESS solo desde Checkout. No hay geolocalización ni conversión monetaria implícita. Carritos antiguos no vacíos conservan moneda; si sus reglas no resuelven se rechazan, no se reetiquetan. Cambios de defaults no sustituyen snapshots existentes. Checkout.storeContext sigue siendo una configuración distinta.

Las rutas existentes `/orderforms/*`, `/storefront/checkout/context`, `/payments/transactions` y `/orders` reciben contexto resuelto por BFF. Requieren valores completos al crear carrito. Fallar ShopContext no habilita defaults globales. Las referencias de tabla/política siguen los filtros de Pricing, no constituyen permisos. Todo grupo cliente se obtiene por la verificación existente de Sessions.

Lecturas públicas y mutaciones de líneas recalculan sobre una copia; cantidades agregadas, precios, stock y cupón se validan antes de guardar. Cambios invalidan envío/pago. Conflicto de versión devuelve409; fallo de owner no permite persistencia parcial. Merge se valida dentro de transacción y no mezcla monedas diferentes.

## Pago y pedido

`checkoutSnapshotHash` SHA256 calculada por BFF vincula tenant/cart/contexto/totales/líneas/ofertas/cupón/envío. No incluye timestamps de lectura ni claim paid del navegador. Payments guarda la huella como metadato reservado. Un ID reutilizado con hechos comerciales distintos se rechaza. La intención de venta Inventory procede del SLA y líneas del servidor, no de metadata libre del navegador; saleId coincide con transactionId.

Para compras vinculadas se exige proveedor configurado real (PayPal/Stripe); adapters de certificación no sustituyen al PSP. Listado público de métodos aplica ruta real, moneda, país, canal e importe. Devuelve solamente identidad/nombre/grupo/tipo/installments/provider/environment; nunca configurationJson ni credenciales. Provider debe ser explícito, no inferido del nombre.

`GET /orderforms/:id/snapshot` es interno Checkout, no un endpoint Storefront BFF. Comprueba tenant/actor y devuelve estado persistido sin volver a consultar stock/precio después de liquidar. La UI no puede enviar snapshotOnly para saltarse revalidación pública. Se usa para construir pedido de hechos pagados; reconsultar disponibilidad después del compromiso podría rechazar stock vendido correctamente.

Para crear pedido se exige transactionId correcto, mismo tenant/cart/currency/value/hash, estado SETTLED e inventoryCommit COMMITTED con saleId=transactionId. Líneas/direcciones/impuestos/logística salen del snapshot servidor. Pedidos repetidos conservan datos y evento estable; discrepancia devuelve409. Índice único tenant/paymentTransactionId evita pedidos duplicados.

Una liquidación con Inventory FAILED no confirma pedido. Repetir la solicitud de settlement existente recupera solo el compromiso idempotente Inventory, sin repetir captura. Emite `payments.transaction.inventory-reconciled.v1` (transactionId, inventoryCommit) y persiste resultado. El replay confirmado no repite Inventory. No se añade endpoint ni UX de recuperación; la comprobación automática de este camino a través de UI/PSP real sigue NO VALIDADA.

## Despliegue y compatibilidad

Migraciones Checkout20261116110000 (columna nullable) y Orders20261116120000 (índice único) no aplicadas a bases comerciales. Auditar duplicados históricos antes del índice. Desplegar schema → Checkout → BFF/Payments/Shipping/Orders → UI; flags ADR0317 deben mantenerse coordinados, no activados de forma unilateral. No habilitar nada sobre procesos antiguos esperando que una build los reinicie.

Colección Postman incluye carpeta ADR0318 y variables comerciales vacías para resolver con datos reales. No guardar claves ni fixtures comerciales. Recuperar código por archivos usando backup de esta intervención; conservar columnas/datos aditivos. Nunca resetear repositorios sucios ni revertir pedidos/cobros con rollback de código.

Disponibilidad de Checkout no admite el antiguo bypass global ni fuerza un almacén global: Inventory resuelve disponibilidad agregada y Shipping determina luego el origen elegible. Error de red en offerings Pricing devuelve indisponibilidad, no ausencia de servicios.

## Selección explícita de política y reintentos — 2026-11-16

El usuario autorizó default para B2C de la tienda del laboratorio. UI admite ECOMMIUM_STOREFRONT_TRADE_POLICY server-only, sin fallback, ligado a sus Organization/Shop canónicos. Solo se añade a query de rutas comerciales del mismo contexto; no se infiere de Shop defaults ni implica grupo de cliente. Otro tenant no hereda esa selección. La configuración actual no duplica reglas para invitados/registrados.

Shipping filtra moneda de tarifa antes de evaluar tramos/umbral/out-of-range. Inventory sale commit es transaccional y serializa venta y claves de stock, agrega cantidades repetidas y devuelve409 ante reutilización con hechos diferentes; rollback completo si falla una línea. HTTP existente sin campos nuevos; publicar evento solo tras commit.

Orders replay comprueba propietario del pedido persistido antes de leer snapshot de carrito archivado sin actor actual; después verifica huella, importe, liquidación e inventario. No permite acceder a snapshots de otros compradores. Opcionales de pickup ausentes/null son equivalentes en identidad; importes, líneas y direcciones siguen comparándose. Conflictos Checkout/Orders se conservan como409 en BFF.

E2E de primer intento FALLÓ por Inventory duplicado; segundo pendiente de aprobación PSP. Evidencia actual: ../qa/paypal-purchase-resumption-20261116.md. No sustituye a la validación completa exigida por ADR0318.

## Cierre PayPal de la compra10052
Rotar carrito tras compra no elimina líneas del snapshot pagado: UI usa forceNewCart y verifica un ID distinto/vacío. Un409 de Orders no equivale a éxito. BFF admite GET Orders plano y envelope, verificando propiedad antes de leer snapshot histórico. Compra10052 validada con PSP sandbox/owners reales y datos simulados; huella persistida y replay concurrente coincidentes. Primeros intentos conservan incidencias10050 (duplicado Inventory) y10051 (carrito vaciado). Ver informe de reanudación; Stripe/compra invitada completa y producción no certificados.

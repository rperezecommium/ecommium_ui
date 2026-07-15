# Automation UX — Fase 1: entender y ordenar

## Estado

Implementada en la UI Admin el 15 de julio de 2026.

## Objetivo

Hacer comprensible la capacidad actual de Automation sin cambiar el motor, sus
eventos, sus acciones, sus permisos ni las reglas ya creadas.

La primera pantalla debe responder, antes de hablar de configuracion tecnica:

1. A que organizacion y tienda aplica el trabajo.
2. Que situaciones de negocio puede observar Automation.
3. Que acciones puede ejecutar hoy.
4. Donde se encuentran los detalles avanzados cuando son necesarios.

## Inventario actual

Automation recibe eventos publicados por el composable y puede ejecutar estas
acciones controladas:

| Accion tecnica | Explicacion para Admin |
| --- | --- |
| `SEND_EMAIL` | Enviar una comunicacion con una plantilla ya configurada. |
| `BUSINESS_LOG` | Dejar un registro operativo para seguimiento. |
| `HTTP_REQUEST` | Avisar a una integracion autorizada. |
| `EMIT_EVENT` | Notificar a otro proceso de la plataforma. |

Las reglas siguen teniendo los estados `DRAFT`, `ACTIVE`, `PAUSED` y
`ARCHIVED`. Esta fase no altera esas transiciones ni activa reglas nuevas.

## Catalogo de situaciones de negocio

| Area | Situacion que se muestra en UI | Evento actual |
| --- | --- | --- |
| Pedidos | Pedido confirmado | `orders.order.confirmed.v1` |
| Pagos | Pago confirmado | `payments.transaction.settled.v1` |
| Envios | Envio en preparacion | `shipping.fulfillment.created.v1` |
| Envios | Envio listo para recogida | `shipping.fulfillment.ready-to-pick.v1` |
| Envios | Envio empaquetado | `shipping.fulfillment.packed.v1` |
| Envios | Envio enviado | `shipping.fulfillment.shipped.v1` |
| Envios | Envio entregado | `shipping.fulfillment.delivered.v1` |
| Facturacion | Factura disponible | `invoice.issued.v1` |
| Postventa | Solicitud postventa recibida | `after-sales.case.submitted.v1` |
| Postventa | Reembolso completado | `after-sales.refund-completed.v1` |

El catalogo no afirma que todos los casos tengan una plantilla de email lista.
Solo explica los eventos que el servicio ya admite para reglas. La disponibilidad
de una accion concreta se valida al crearla o activarla en fases posteriores.

## Decisiones UX de esta fase

- La pantalla muestra que las reglas y ejecuciones se aplican a la tienda activa.
- Se enseña el nombre y el alias humano de la tienda; el identificador de
  organizacion queda como referencia secundaria mientras el contrato de contexto
  no exponga un nombre de organizacion.
- Los eventos se agrupan por Pedidos, Pagos, Envios, Facturacion y Postventa.
- Los nombres tecnicos se conservan dentro de un detalle, porque son necesarios
  para soporte y para el modo avanzado.
- "Defaults email transaccional" se presenta como avisos preparados para el
  cliente y explica que crea o actualiza reglas activas en la tienda actual.

## Fuera de alcance

Esta fase no incorpora un creador visual, borradores desde plantillas, pruebas
con datos simulados, programacion temporal ni una nueva API BFF. Esos cambios
forman parte de las fases 2 a 6 del plan UX.

## Criterios de aceptacion

- Una persona entiende el alcance de la pantalla sin conocer `organizationId` o
  `shopId`.
- Puede relacionar al menos los eventos de pedidos, envios y facturas con una
  situacion de negocio.
- Puede acceder al nombre tecnico del evento sin que este domine la pantalla.
- Las reglas existentes, endpoints BFF, permisos, acciones y editor JSON se
  mantienen sin cambios de comportamiento.

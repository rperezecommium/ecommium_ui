# Automation UX — Fase 3: biblioteca y borradores seguros

## Estado

Implementada en la UI Admin el 15 de julio de 2026.

## Objetivo

Permitir crear automatizaciones habituales sin usar JSON y sin activar nada por
accidente. Cada recomendacion crea una unica regla en estado `DRAFT` para la
organizacion y tienda activas.

## Recomendaciones disponibles

| Recomendacion | Evento | Plantilla que debe estar activa |
| --- | --- | --- |
| Aviso de entrega al cliente | `shipping.fulfillment.delivered.v1` | `shipping.delivered` |
| Aviso de factura disponible | `invoice.issued.v1` | `invoice.available` |

La biblioteca usa solo contratos BFF existentes. No crea plantillas, no
configura proveedores de email y no activa reglas.

## Protecciones

1. La tarjeta identifica la tienda activa y el resultado que se creara.
2. La UI consulta Comunicaciones para comprobar que la plantilla existe y esta
   `ACTIVE` en el locale de la tienda.
3. Si no esta lista, bloquea la creacion y dirige a Comunicaciones.
4. El boton explicita "Crear borrador para revisar".
5. Tras crear, se abre el detalle de la regla para revisarla o activarla de
   forma deliberada.

## Compatibilidad

- Las reglas creadas con JSON siguen siendo validas y editables.
- Los endpoints heredados de activacion masiva siguen disponibles en una zona
  avanzada; no se eliminan ni se cambian.
- El BFF conserva la autoridad sobre permisos, scope y estado inicial de la
  regla.

## Siguiente paso

La fase 4 sustituira el editor JSON como primera opcion para reglas nuevas,
reutilizando el mismo modelo de borrador y las mismas validaciones.

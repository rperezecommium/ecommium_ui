# Perfil comercial: resolución del gap — 2026-11-18

El diagnóstico inicial y los pendientes documentados quedaron resueltos en el
alcance autorizado. [Activación y evidencia](../qa/customer-commercial-activation-20261118.md).

Se confirmó: credenciales internas ausentes, las dos migraciones sin aplicar y
flags sin activar. Tras aplicar la activación apareció un dato histórico PERSON;
el owner lo presenta como PRIVATE_BUYER en la lectura canónica, sin reescribir
perfiles ni conceder privilegios. El perfil real carga grupo y auditoría sin aviso.

El contrato de historial quedó sincronizado con backend: GET
`/admin/customers/:customerId/commercial-membership/history` con Organization/Shop,
customers.read, paginación20/100 y actor/motivo/fecha/revisión/before-after de
pertenencia. No hay endpoint alternativo Next ni acceso directo UI a owners/SQL.
La política se guarda por el BFF existente desde Configuración/Precios/Parámetros.

Se corrigieron dos diferencias adicionales entre UI y BFF: omitir pertenencia
sin cambios para conservar grupos inactivos; exigir Empresa antes de aprobar B2B.

Límites que permanecen: los importes y la revalidación de carrito se comprobaron
con BFF/owners PostgreSQL reales del laboratorio, con fixtures explícitas para
Catalog/Inventory/Shop/identidad Employee. No se certifica compra/cobro real,
producción/CDN ni todos los códigos históricos de buyerType. No se autoriza
convertir otros valores desconocidos a Particular o Empresa automáticamente.

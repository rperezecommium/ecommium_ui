# Automatización UX — Fase 4: creador visual de reglas

## Objetivo

Hacer que la creación de una regla habitual pueda entenderse sin conocer eventos técnicos ni editar JSON.

## Experiencia incorporada

- El botón principal **Crear regla** abre un asistente de cuatro pasos: cuándo ocurre, condición, acción y revisión.
- Las situaciones se muestran agrupadas por área de negocio y con nombres comprensibles.
- Para los dos avisos de email ya preparados (entrega y factura), el asistente reutiliza la misma definición segura y comprueba que la plantilla esté activa en el contexto actual.
- Para cualquier otra situación, permite crear un borrador que registra el evento para el equipo.
- El resumen deja claro el alcance: tienda, idioma y mercado activos.
- Todo resultado se guarda como borrador. La activación sigue siendo una acción separada desde el detalle de la regla.

## Límites deliberados

El asistente visual cubre casos sencillos y seguros. Las integraciones HTTP, emisión de eventos, filtros complejos y configuraciones personalizadas continúan disponibles en **modo avanzado**; no se elimina ninguna capacidad existente.

## Resultado esperado

Una persona puede crear una primera regla sin entender JSON, mientras que las personas técnicas mantienen acceso a toda la flexibilidad anterior.

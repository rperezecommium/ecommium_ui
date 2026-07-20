# Automation UX — Fase 2: validar el nuevo modelo de experiencia

## Estado

Prototipo navegable implementado el 15 de julio de 2026.

## Objetivo

Validar que una persona entiende una automatizacion antes de entrar al editor
avanzado. El prototipo no crea, modifica ni activa reglas.

## Tres tareas de validacion

1. Identificar como avisar a un cliente cuando se entrega su pedido.
2. Identificar como avisar cuando una factura esta disponible.
3. Identificar como avisar al equipo cuando llega una solicitud postventa.

Cada recorrido explica cuatro ideas en el mismo orden:

1. **Cuando ocurre**: la situacion que inicia la automatizacion.
2. **Si se cumple**: la condicion adicional, si existe.
3. **Que queremos hacer**: el resultado que busca la persona.
4. **Donde aplica**: la tienda y mercado activos.

## Limites del prototipo

- No llama al BFF para crear ni modificar reglas.
- No cambia el estado de ninguna regla existente.
- No oculta el editor JSON; el enlace a creacion avanzada sigue disponible.
- No promete que una plantilla de Comunicaciones este lista: la comprobacion
  operativa se incorporara antes de activar en fases posteriores.

## Criterio para avanzar a la fase 3

En una prueba con operadores de Admin, al menos el 85 % debe poder explicar el
resultado y el alcance de cada uno de los tres recorridos sin ayuda. Las dudas
deben registrarse contra uno de estos puntos: lenguaje, orden de pasos,
visibilidad del alcance o seguridad de activacion.

## Resultado esperado de las fases siguientes

- Fase 3: convertir los casos preparados en borradores revisables.
- Fase 4: transformar este recorrido en un creador visual que guarde reglas.
- Fase 5: mostrar ejecuciones y fallos con el mismo lenguaje de negocio.
- Fase 6: conservar y conectar el modo avanzado para casos no cubiertos.

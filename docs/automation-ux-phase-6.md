# Automatización UX — Fase 6: avanzado y migración gradual

## Objetivo

Introducir la experiencia simple sin obligar a rehacer ni arriesgar las reglas que ya existen.

## Experiencia incorporada

- Cada regla indica si es compatible con el asistente visual o si necesita mantenerse en modo avanzado.
- Las reglas con filtros, secuencias, integraciones, eventos técnicos o datos personalizados siguen usando el editor avanzado y conservan todos sus datos.
- Cuando una regla tiene una equivalencia exacta en el asistente, se puede crear una **copia visual en borrador**.
- La copia nunca modifica, pausa, archiva ni activa la regla original. Su descripción conserva la referencia a la regla de origen para que la revisión sea comprensible.
- El listado muestra la forma recomendada de edición y la sección de compatibilidad resume la situación de las reglas visibles.

## Regla de seguridad de migración

Solo se ofrece una copia visual cuando el evento, las condiciones, la acción y la configuración coinciden con un caso sencillo soportado. Si hay cualquier personalización, se mantiene el modo avanzado en lugar de transformar la regla de forma incompleta.

## Resultado esperado

La adopción puede ser progresiva: las nuevas reglas habituales usan la interfaz visual y las configuraciones especializadas siguen siendo editables sin pérdida de capacidad.

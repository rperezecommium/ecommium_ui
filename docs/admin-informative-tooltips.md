# Tooltips informativos de Admin

## Objetivo

Usar un tooltip para explicar un concepto de negocio poco familiar justo donde el operador debe tomar una decisión. El tooltip complementa la interfaz; no sustituye la ayuda extensa, los mensajes de validación ni la documentación operativa.

## Módulo obligatorio

Usar `AdminInfoTooltip` desde `src/shared/ui/admin-info-tooltip.tsx`. No crear tooltips ad hoc ni usar el atributo HTML `title`.

```tsx
import { AdminInfoTooltip } from "../../shared/ui/admin-info-tooltip";

<AdminInfoTooltip
  label="Más información sobre precios fijados"
  title="¿Qué es un precio fijado?"
  description="Define un importe concreto para una variante dentro de una Price table."
  example="Una mochila cuesta 50 €. En Mayoristas puedes fijarla en 42 €, sin cambiar el precio general."
/>
```

El icono debe ser hermano del enlace o botón que acompaña; nunca se anida un botón de ayuda dentro de otro elemento interactivo.

## Redacción

- Empezar por qué hace el concepto y cuándo se aplica.
- Usar lenguaje de operación, no nombres de endpoints, DTOs ni implementación interna.
- Mantener la descripción en una o dos frases cortas.
- Añadir un ejemplo cotidiano solo si reduce la ambigüedad.
- Etiquetar el ejemplo con `Ejemplo:` y mantenerlo en una sola frase.

## Cuándo usarlo

- Conceptos de negocio que un Admin puede no conocer: precio fijado, pipeline, política comercial o proyección.
- Consecuencias de una acción que no sean evidentes, especialmente antes de activar, pausar o recalcular.

No usarlo para errores de formulario, ayuda obligatoria de un campo, texto largo, permisos o acciones destructivas: esas situaciones requieren validación inline, banner, confirmación o documentación enlazada.

## Accesibilidad e interacción

- El control tiene una etiqueta accesible específica: `Más información sobre…`.
- En escritorio se abre al pasar el cursor o recibir foco; en móvil se abre al tocarlo.
- Se cierra al retirar el cursor, perder el foco o pulsar `Esc`.
- El contenido usa `role="tooltip"` y se vincula al control mediante `aria-describedby` mientras está visible.
- No depender únicamente del hover.
- El contenido se monta como popover flotante fuera de contenedores con scroll, para que no quede recortado por tabs o tablas.

## Checklist de entrega

- El texto está localizado y es comprensible para un operador no técnico.
- La ayuda aparece junto al concepto, sin romper la navegación ni anidar controles interactivos.
- Se puede abrir con teclado, cerrar con `Esc` y usar con toque.
- Se usan tokens visuales Admin existentes y el tooltip no tapa la acción principal en móvil.
- Añadir o actualizar una prueba de la pantalla afectada y ejecutar `npm run lint` y `npm run build`.

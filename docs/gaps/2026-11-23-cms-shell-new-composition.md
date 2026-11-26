# Reproducción Header/Footer con el CMS nuevo

Fecha: 2026-11-23. Ensayo autorizado, sin publicación ni sustitución de originales.
Contexto observado en Chrome: Tienda Barcelona, es-ES.

## Evidencia real

Header principal tienda: `3bceeba0-ba5d-485a-a27d-537c0cd87949`, revisión 4,
activo, un uso. Tres áreas: utilidades (30/40/30), principal (18/64/18),
categorías (100%). Tipos observados mediante Portabilidad JSON, sin guardar
el original: store.market, content.announcementBar, store.assurances,
store.logo, commerce.search, customer.account, commerce.cart, catalog.navigation.
También existe Header mínimo checkout activo, revisión 11, un uso; aún no ensayado.

Footer principal tienda: `88a9bfd4-cd92-4e14-8e7a-7e66decfb3dd`, revisión 3,
activo, un uso. Área Información 28/18/18/18/18, gap 32px; área Legal 100%.
Logo, información/contacto, cuatro grupos de enlaces, redes y copyright.

Módulo visual nuevo guardado por UI → Server Action → BFF:
`265232eb-0603-4f1a-99d9-600b68ebd203`.
Nombre: «Ensayo nuevo CMS · Footer principal · 2026-11-23».
46 nodos; imagen, títulos, párrafos, enlaces y estructura con variantes tablet/mobile.
Importación mediante la herramienta actual de Portabilidad visual JSON.
Primer intento mediante tecleo nativo alteró acentos; se corrigió íntegramente
mediante pegado antes de guardar. No se considera una pérdida del editor.
Guardar mostró «Módulo guardado». Ajuste posterior height:auto fue rechazado
con «La solicitud no es válida»; al retirar ese valor el guardado fue confirmado.

Sección nueva guardada, insertando copia de ese módulo:
`63c09729-dc2d-4c11-8151-f9b9187a68cd`, mismo nombre.
UI confirmó «Sección guardada» y cambió a su URL canónica.
No se creó ni publicó una página, ni se asignó esta sección a un Footer.

## Resultado y límites

La estructura y el contenido estático son reproducibles con las herramientas
actuales. El ensayo NO es equivalente visualmente: falta fidelidad de estilos,
comprobar destinos y ajustar logo. La preview móvil mostró recorte/altura grande:
VisualImage en packages/cms-blocks/src/react.tsx tiene fallback minHeight180px,
height490px y backgroundSize cover. Width160px no basta: se requieren valores
explícitos compatibles de altura, altura mínima y encaje. No es prueba de que
falte el control; es un ajuste pendiente del ensayo. No se certifica responsive,
accesibilidad, comportamiento público, igualdad visual ni herencia global.

No se creó un Header ficticio con buscador/cuenta/carrito estáticos para aparentar
equivalencia. El menú real de Módulos y el schema local coinciden: visual y ocho
registered, ninguno de los ocho tipos observados en el Header.

## Gaps de contrato que requieren sincronización explícita

1. Admitir los bloques funcionales del shell en módulos independientes con props
   tipadas y validación BFF/CMS, reutilizando los renderers funcionales existentes.
   No sustituir búsqueda, cuenta, carrito o navegación dinámica por enlaces decorativos.
2. Definir composición nueva de Header/Footer y su vínculo con revisiones,
   publicación y asignaciones de site parts existentes. Hoy esos formularios
   guardan layout + blocks; la sección nueva no es un site part asignable.
   Reutilizar su ciclo de vida, permisos cms.settings y BFF; no crear otro backend.
3. Acordar resolución de tokens/herencia de Global → contexto de página/shell →
   sección → módulo, overrides y reset. No congelar defaults como copia implícita.
4. Homogeneizar aceptación de valores de estilo entre importador UI y BFF.
   No ampliar la allowlist unilateralmente por el rechazo de height:auto.

Validación necesaria antes de implementar: contratos locales sincronizados,
compatibilidad legacy, copia independiente, Media, permisos/contexto,
CAS, publicación/asignaciones, preview inerte y comparación1440/768/390.

## Páginas antiguas

No se han reproducido ni convertido en esta intervención. La evidencia previa
en docs/contracts/cms-phase-6-readiness.md y docs/qa/cms-phase-6-status-20261120.md
describe límites de migración de Home, layouts y tipos funcionales. Es evidencia
del 20 de noviembre, no un inventario vivo del 23. Hace falta revisar páginas
actuales antes de decidir por cada una. Builder y todos los originales permanecen.

No se consultó ni modificó el repositorio backend. No hubo cambios de código
productivo ni cierres de hallazgos de seguridad. El objetivo global sigue pendiente.

## Actualización tras autorización de sincronización

El usuario autorizó explícitamente ampliar BFF/backend. Tipos funcionales y
transporte de secciones dentro de revisiones existentes implementados, sin DDL.
Copias DRAFT reales creadas desde la UI Employee:
- Header: `086e7014-fba8-4948-84f4-e833b4dd103f`.
- Footer: `f798ce38-22de-4bb9-b230-ded1eaa3d564`.
No publicadas ni asignadas. Sustituyen el bloqueo de tipos/transporte para este
ensayo; no certifican herencia global, concurrencia o retirada de Builder.
El módulo/sección visual inicial permanece como ensayo anterior, no como la
reproducción funcional definitiva. Informe vigente: ../qa/cms-shell-independent-sections-20261123.md.

Actualización de cierre constructivo, 2026-11-24: el alta vacía incorpora secciones
de biblioteca y permite editar módulos independientes, guardar, publicar y asignar
por página sin el editor antiguo. Header y footer de la demostración se construyeron
manualmente, se publicaron y se asignaron únicamente a la nueva landing; originales
y defaults conservados. La carencia descrita de creación desde cero queda resuelta.
Seguimiento y límites vigentes: [cierre constructivo](../qa/cms-construction-demo-20261124/closure-status.md).

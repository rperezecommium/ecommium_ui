# Secciones: controles por fila y arrastre — 2026-11-22

Espacios y módulos usa CmsSectionTreeEditor. Cada pieza salvo raíz tiene tirador,
Subir/Bajar, Entrar en contenedor anterior, Sacar del contenedor y papelera. Las
flechas conservan orden de hermanos; entrar añade al final del contenedor hermano
anterior y salir coloca después del contenedor padre. Las acciones imposibles
están deshabilitadas. La raíz, obligatoria por contrato, no se mueve ni elimina.
El selector de destino existente se conserva para desplazamientos lejanos.

Pointer Events con captura sobre el tirador, ratón/táctil y umbral6px. Centro de
fila contenedor = dentro; borde superior/inferior = antes/después. En módulos solo
antes/después. La raíz recibe dentro. Indicación visual de destino y anuncio
accesible con espacio reservado para que no desplace las filas durante el gesto.
Escape/pointercancel/lostcapture cancelan y limpian; scroll al mover cerca del
borde del viewport. El árbol no se modifica hasta soltar en un destino válido.
Botones accesibles ofrecen alternativa al arrastre y tienen foco visible.

Los helpers rehúsan raíz, identidad propia, descendientes, anidar en módulo y
profundidad excedida; moveSpace conserva IDs y snapshots de módulos. Eliminar
confirma nombre e impacto sobre hijos; retira solo del borrador de sección,
no del módulo de biblioteca. Guardar utiliza el BFF existente sin nuevo endpoint.
Se bloquea organización mientras hay una edición de copia pendiente o no hay
permiso/disponibilidad de escritura; no se reintroduce diseño interno de módulos.

Validación:
- 4 pruebas nuevas de flechas, destinos, índices antes/después, ciclos,
  profundidad, eliminación, preservación del origen y contenido.
- 15 pruebas relacionadas de renderer y contenido de copias.
- Chromium Playwright aislado a1440/768/390: flechas entrar/salir, pointer drag
  módulo dentro, contenedor con subárbol después, rechazo de descendiente,
  Escape, eliminación cancelada/confirmada de módulo y contenedor, raíz protegida.
- A390 se prueba también touchStart/move/end nativo mediante CDP.
- Axe del árbol y formularios PASS con contraste excluido por pendiente transversal;
  sin overflow a tres tamaños. Regresiones anteriores de copias/CSS/guardado/
  errores/perfiles de lectura continúan PASS.
- npm run lint:0errores/3avisos anteriores. npm run build:PASS.
- Lectura de Chrome real: controles presentes junto a todas las piezas de la
  sección abierta (dos contenedores y cuatro módulos); no se movieron/eliminaron
  ni guardaron datos reales durante esta entrega.

Límites: BFF de mutaciones con dobles en browser tests; no se certifica guardado
real de una reordenación nueva, ni accesibilidad global de previews con regiones
duplicadas (pendiente previo). No cambios backend, autenticación o contratos;
no se cierran hallazgos de securityReadme.md.

## Simplificación posterior — 2026-11-22

Sustituye la disponibilidad del selector de destino descrita arriba: se retiran
Mover a contenedor y Mover al final junto con estado/listado de destinos legacy.
Arrastrar antes/después/dentro cubre destinos lejanos; flechas por fila conservan
la alternativa sin arrastre. La regresión ahora usa Entrar en contenedor anterior
y certifica ausencia de los controles retirados.

Distribución + Añadir contenedor y Módulo de biblioteca + Insertar copia se
alinean en dos filas horizontales, con selector flexible y botón al extremo.
Por debajo480px se apilan para conservar espacio y evitar overflow.

La presentación del contenedor usa un modo específico del inspector compartido:
excluye tipografía (color de texto, familia, tamaño, peso, interlineado y alineación)
y no ofrece el JSON genérico, Motion ni Hover. Conserva visibilidad responsive,
layout, dimensiones, fondo/media, espaciados y bordes. No elimina valores legacy
persistidos ni modifica los controles de diseño en Módulos u otras superficies.

Validación: Playwright1440/768/390 con coordenadas de selectores y botones para
alineación horizontal a1440/768, ausencia de tipografía en todos los scopes,
presencia de fondo/padding y regresiones completas de puntero/táctil/CSS/copias.
Build/lint correctos (tres avisos anteriores);19 pruebas relacionadas PASS.
No hubo cambios de datos reales ni publicación durante esta simplificación.

Ajuste explícito posterior: Distribución y Módulo de biblioteca comparten ahora
una misma fila horizontal, cada selector con su acción a la derecha. Selectores
y botones miden40px, botones usan tokens primarios azul/cian, texto blanco y
hover/pressed compartidos. A600px o menos se apilan los dos grupos, conservando
botón junto a su selector. Playwright verifica coordenadas/alturas/colores reales
a1440/768, responsive390 y regresiones completas PASS. Build y lint correctos
(tres avisos previos). Sustituye la disposición anterior en dos filas.

Corrección de altura tras evidencia del usuario: adminShell aplica densidad32px
a los selectores con especificidad superior; botón fijo40px dejaba diferencia8px.
Ambos controles ahora usan --admin-control-height y --admin-control-font-size del
shell, con fallback40px/14px fuera del Admin. La prueba previa no incluía
adminShell y por ello daba un falso positivo de igualdad40px. Fixture corregido
con clase adminShell (lienzo principal a ancho completo, sin sidebar simulado).
Playwright exige alturas reales32px para ambos pares a1440/768/390; PASS junto a
alineación, color primario y regresiones anteriores. Build y lint PASS con tres
avisos previos. Sustituye la afirmación anterior de40px en el Admin real.

Estilos del contenedor usa details/summary nativo, cerrado inicialmente y
operable mediante clic, Enter y Espacio. El contenido permanece montado para
conservar edición, scope y seguimiento de subida al plegar. El nodo nuevo vuelve
a su estado inicial plegado. Regresión1440/768/390 abre por clic, verifica campos
y cierra por Enter; suite completa PASS. Build/lint correctos (avisos previos).

Separación visual solicitada: el editor izquierdo se divide en tres superficies
blancas independientes con borde Admin y12px de separación: composición (nombre,
árbol y acciones de contenedor/campos de copia), estilos del contenedor colapsables
y CSS de la sección. La explicación de alcance del CSS pertenece a la tercera
caja; se elimina la doble tarjeta dentro de ella. Fieldset exterior sin borde ni
padding, conserva bloqueo de permisos/guardado. La preview continúa en su caja.
Playwright1440/768/390 comprueba tres cajas blancas, bordes y separación reales,
apertura/cierre y regresiones previas PASS. Build/lint PASS (avisos previos).

Creación junto al árbol: cada contenedor, incluida raíz identificada como
Contenedor principal, tiene+ azul «Añadir contenedor dentro de…». Añade un hijo
vertical vacío al padre pulsado y selecciona el nuevo nodo para mostrarlo en
preview/estilos. No añade hermanos al seleccionado ni depende del contexto del
formulario inferior. Módulos sin botón de creación; raíz sigue sin mover/eliminar.
Helper clona, valida destino/IDs/presupuesto y conserva el origen si falla.
6 pruebas de helpers +15 relacionadas PASS; Playwright1440/768/390 valida+ raíz
por teclado y+ anidado por clic, destino correcto y regresiones completas. Build/
lint correctos con tres avisos previos. Sin mutaciones de recursos reales.

Módulos y Secciones: Biblioteca/Diseño reutilizan adminTabs/adminTab/adminTabActive
(badges redondeados y selección negra); estado activo aria-current conservado/
añadido y Diseño deshabilitado sin documento. Crear módulo usa fila alineada y
misma variable de altura/tipografía32px del selector. Pruebas Chromium de ambas
pantallas con adminShell a1440/768/390 verifican badges, alturas y alineación,
además de regresiones existentes:PASS. Build/lint correctos con avisos previos.
Tipos disponibles proceden del registro de bloques y filtro de contrato local;
no se añade pantalla de gestión de tipos ni cambia el contrato.

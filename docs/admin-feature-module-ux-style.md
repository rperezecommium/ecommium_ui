# Guia UX/UI: Caracteristicas tecnicas

## Diagnostico de dolor

La version anterior mezclaba tres flujos en el mismo espacio: busqueda, creacion y edicion inline. Eso hacia que todos los controles compitieran por atencion y que la tabla dejara de funcionar como tabla. El usuario no podia distinguir rapido si estaba filtrando, creando una caracteristica, editando una fila o agregando valores.

Los principales antipatrones detectados:

- Formularios incrustados en filas de tabla, con inputs grandes y acciones dispersas.
- Filtros duplicados arriba y dentro del listado.
- Botones textuales grandes para acciones repetitivas de fila.
- Valores mostrados como lista secundaria, en vez de chips escaneables y editables.
- Checkboxes de estado poco legibles para estados importantes como Activa, Filtrable y Visible en ficha.

## Arquitectura propuesta

La pantalla queda separada en tres zonas con responsabilidades claras:

- Filtros: una barra horizontal compacta para ID, nombre, grupo, estado, Buscar y Limpiar.
- Vista de datos: una tabla limpia con ID, caracteristica, grupo, valores, estado y acciones.
- Acciones de creacion/edicion: drawer lateral derecho, abierto solo cuando el usuario crea o edita.

Este patron aplica divulgacion progresiva: la tabla siempre esta disponible para comparar y encontrar registros; los formularios aparecen solo cuando hay intencion de modificar datos.

## Componentes

- Chips de valores: cada valor se muestra como chip azul claro estilo PrestaShop, con una accion `x` para quitarlo.
- Acciones de fila: usar iconos `Editar` y `Eliminar`, no botones textuales gigantes.
- Estado: usar badge visual `Activa` o `Inactiva`.
- Toggles: usar switches para Activa, Filtrable y Visible en ficha cuando son ajustes binarios persistentes.
- Drawer: cabecera blanca con borde inferior, cuerpo blanco, campos apilados y acciones al final.
- Backdrop de drawer: cuando el panel lateral este abierto, el fondo debe quedar atenuado con el gris PrestaShop `#363a41` y el contenido principal debe desenfocarse con `filter: blur(...)`, dejando claro que la interaccion principal esta dentro del panel.
- Inputs del drawer: todos los inputs, selects y campos inline deben compartir `min-height: 40px`, `border-radius: 4px`, borde `--admin-border`, fondo blanco y padding horizontal de `12px`. No usar controles nativos sin normalizar dentro del panel.

## Color y tono visual

Usar los tokens existentes del admin:

- Primario: `--admin-primary` `#25b9d7`
- Primario hover: `--admin-primary-hover`
- Sidebar/drawer header: `--admin-sidebar-bg`
- Texto principal: `--admin-text`
- Texto secundario: `--admin-text-muted`
- Bordes: `--admin-border`
- Fondo: `--admin-bg`
- Exito: `--admin-success`
- Peligro: `--admin-danger`

Evitar paletas nuevas para este modulo. El aspecto debe sentirse PrestaShop: claro, funcional, denso, con bordes discretos y sombras solo en superficies importantes.

## Antes vs. despues

| Area | Antes | Despues |
| --- | --- | --- |
| Filtros | Duplicados y mezclados con tabla | Barra horizontal unica |
| Creacion | Formulario siempre visible | Drawer `Crear caracteristica` |
| Edicion | Inputs dentro de cada fila | Drawer `Editar caracteristica` |
| Valores | Lista oculta o controles dispersos | Chips con `x` para quitar |
| Acciones | Botones grandes por fila | Iconos de editar/eliminar |
| Estados | Checkboxes poco claros | Badge en tabla y toggles en drawer |

## Regla de implementacion

En modulos administrativos de catalogo, la tabla no debe contener formularios complejos. La tabla sirve para leer, comparar y seleccionar. La creacion y edicion deben vivir en modal o drawer, salvo ajustes atomicos muy pequenos como quitar un chip de valor.

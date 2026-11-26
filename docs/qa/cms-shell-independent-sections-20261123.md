# Header/Footer mediante el CMS nuevo

2026-11-23. Implementación y comprobación parcial. Objetivo global de retirada
Builder NO cerrado. Autorización explícita para UI/BFF/CMS recibida en el chat.

## Entrega

Contrato MODULE UI/BFF/CMS sincronizado con13 tipos shell. Props y enlaces
cerrados; no se persisten estado de cliente/carrito ni datos comerciales.
CmsSectionView recibe un renderer funcional inyectado por el shell. Preview usa
componentes inertes existentes. cms.section guarda snapshots SECTION en blocks
JSON de la revisión Header/Footer existente, con layout/placements conservados.
No se añadió tabla, migración, endpoint ni BFF alternativo.

Reproducción explícita desde el original crea un DRAFT y verifica el recibo.
Tipologías/props sin equivalencia se bloquean; visual.module legacy aún requiere
materialización y no se convierte mediante este helper. Editor embebido reutiliza
Secciones, inserta copias MODULE y guarda la revisión de la pieza. Se bloquea
save/cambio de selección con CSS/JSON inválido o edición de módulo pendiente.
No se publicó ni asignó ninguna copia.

## Evidencia viva

Servicios locales CMS/BFF Admin/Storefront reactivados por script canónico con
Node22/npm10 y health200. Primer intento sandbox terminó con inspección denegada;
reintento autorizado fuera del sandbox completó arranque y salud de los tres.
Sin cambios de credenciales ni DDL.

Chrome del usuario, Employee/Tienda Barcelona/es-ES:
- Fuente Header principal tienda3bceeba0-ba5d-485a-a27d-537c0cd87949, revisión4.
- Copia Header086e7014-fba8-4948-84f4-e833b4dd103f.
- Fuente Footer principal tienda88a9bfd4-cd92-4e14-8e7a-7e66decfb3dd, revisión3.
- Copia Footerf798ce38-22de-4bb9-b230-ded1eaa3d564.

Creación y reapertura reales. Preview Header: logo, búsqueda, cuenta/carrito y
navegación real del catálogo visibles. Preview Footer: logo negativo, contenido,
cinco columnas, grupos/enlaces, redes y copyright visibles. Ambas previews
cambian a1440/768/390 mediante controles existentes. No se midió pixel diff ni
se certificó comportamiento comercial público de copias no publicadas.

La apertura del editor marcaba dirty por reordenación de claves JSON de props
(document/contractVersion). Corregido preservando el objeto/envelope original
al modificar documento. No se modificaron datos originales para corregirlo.

## Validación

- UI:23 contratos;9 pruebas de copia/composición/esquemas sincronizados PASS.
- CMS:23 pruebas de secciones/copia/site parts/use case PASS.
- BFF:28 pruebas de boundary, guards HTTP, Media previa y preview PAGE PASS.
- Builds CMS/BFF bajo Node22 PASS; UI build PASS. Lint UI0errores/3avisos previos.
- Playwright del editor embebido PASS1440/768/390: no marca dirty al abrir,
  edita/guarda una sección sin cambiar otra, bloquea CSS incompleto, abre/cierra
  preview con moneda explícita, protege la salida con CSS pendiente, respeta readonly y no desborda horizontalmente. Axe PASS sin contraste
  por el pendiente transversal de tokens. Son dobles de acciones: no equivalen
  al BFF real. Archivo: tests/e2e/cms-shell-sections-browser.mjs.
- La primera pasada de axe detectó regiones de sección y módulo con el mismo
  nombre. El wrapper de módulo ahora se identifica como «Módulo: …»; regresión
  repetida PASS.

## Pendientes explícitos

- CAS atómico site parts: preflight de revisión/fecha no garantiza exclusión
  concurrente. No se cierra ese límite legacy.
- Herencia completa Global→shell/sección/módulo y UI de restauración por campo.
- Edición de props registered por declaración del creador: conserva gap22nov.
- Equivalencia visual con mediciones/pixel diff y recorrido público de copias,
  sin sustituir originales como parte del ensayo.
- Reproducción de Header mínimo checkout y páginas legacy; helper bloquea
  visual.module sin materialización y semánticas no equivalentes.
- Perfiles reales de sólo lectura/scope ajeno y regresión integral de publicación/
  asignaciones. No se modifican permisos para facilitar el ensayo.

No retirar Builder. No afirmar certificación global de CMS ni producción.

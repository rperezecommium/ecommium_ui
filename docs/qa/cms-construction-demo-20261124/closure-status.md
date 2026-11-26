# Cierre definitivo de CMS

Alcance cerrado autorizado por Ricardo: módulos, secciones, plantillas, páginas/landings, headers y footers. PDP y PLP quedan fuera. Las construcciones se realizan mediante la UI y los comandos BFF existentes; no se importan árboles ni se inyectan documentos para acreditar resultados.

| Implementación | Estado | Evidencia de cierre |
| --- | --- | --- |
| 1. Finalizar Prototype | Completada | Módulo de biblioteca guardado/reabierto y dos copias publicadas mediante inspector. Sin desbordamiento interno a 1440/820/390; móvil viewport/documento 375/375. Capturas `prototype-fixed-*.jpg`, mediciones `prototype-responsive-fixed.json`. Offset/rotación validados UI/CMS/BFF: 19+34+17 pruebas y builds correctos. El desbordamiento global tablet 1260 ya existía en el header original; se verificará con el header de secciones en 4. |
| 2. Edición independiente de copias | Completada | 7 módulos de landing y 12 de shell comprobados mediante UI; 17 instancias en secciones header/footer. Textos y opciones editados, guardados, reabiertos y restaurados. Navegaciones repetidas conservan sus títulos independientes. Imagen Sol High sustituida mediante Media solo en su copia (asset 9d235f09-17b0-4a8a-8436-d110b6f54594); original conserva asset 8695ac0f-697e-42de-b59f-b5ca318074f8. Enlace editado/reabierto/restaurado. Inspector compartido, campos configurables, espera acotada de revisión y reapertura corregida. 23 pruebas correctas, lint sin errores y build correcto. Evidencias copy-*.json. |
| 3. Páginas y landings | Completada | Plantillas SECTION y PAGE actualizadas mediante inspectores (Prototype responsive). Landing 4d493b72-2cc5-42f8-8d37-f1b2ebf859b6 creada desde plantilla, sección y módulo añadidos desde bibliotecas, contenidos personalizados, cierre al listado/reapertura/publicación real. Storefront /demostracion-cms-cierre: 7 secciones, 9 instancias, 7 módulos distintos. Sus secciones no desbordan en 1440/820/390. Slider vacío sustituido por Media real y editable; cuatro CTA /contact y /case-study sustituidos solo en esta copia por /module-test-page y /demostracion-cms-modulos con nuevas etiquetas. Navegación comprobada. 10 pruebas de páginas/plantillas y build correctos; lint del cambio sin errores. El header antiguo desborda tablet y queda incluido en 4. |
| 4. Headers y footers | Completada | Alta vacía e inserción manual de sección de biblioteca, reutilizando el compositor y su inspector. Header f0b81f4e-f5e5-4f0d-b858-3956ad8420c8 (8 módulos) y footer 1f4c2e56-5fc1-4416-a042-3bd3b4b36e60 (9 instancias): contenidos personalizados, guardado, reapertura, publicación y asignación PAGE a la landing de cierre. Defaults, originales y otras superficies conservados. Nueva publicación real de ambas piezas después de retirar el editor antiguo; revisión final header 72c915d1-a9b6-401d-9b70-ef6bc72e41a8 y footer 803f9b24-f3db-4a8e-859d-36b7ac12c2b2. |

Builder: retirado en la UI del laboratorio después de completar los cuatro recorridos y la comprobación integral. Ruta/pantalla antiguas ausentes; retirados también el editor exclusivo de shell, sus acciones UI sin consumidores y el harness exclusivo obsoleto. Se conservan inspectores, catálogo, renderers, Media y contratos compartidos. La ruta /admin/cms/builder muestra «No encontramos esta página».

Los inventarios y capturas iniciales de esta carpeta acreditaban solo los recursos guardados. Las evidencias finales indicadas debajo acreditan el cierre de estos cuatro procesos en Barcelona/es-ES; los informes de conversión anteriores no sustituyen esta prueba constructiva.


## Comprobación integral final

Landing publicada: [Demostración CMS · Cierre constructivo](http://localhost:5173/demostracion-cms-cierre).
Construida desde plantilla PAGE, sección de biblioteca y módulo de biblioteca;
7 secciones y 9 instancias de los 7 módulos visuales de la demostración.
Header y footer construidos desde vacío con las secciones de biblioteca, sin
convertir documentos para esta demostración ni inyectar árboles/datos por API.
Las bibliotecas muestran 19 módulos, 10 secciones y 2 plantillas con el prefijo
«Demostración CMS». Evidencia nominal: [bibliotecas finales](integral-libraries-final.json).

Guardar/cerrar/reabrir/publicar se comprobó desde UI real. Después de la retirada
se reabrieron y republicaron la landing, el header y el footer; Storefront conserva
los contenidos personalizados y las revisiones publicadas. Se comprobaron búsqueda
real, apertura/cierre de cuenta, enlace a carrito, privacidad y página de referencia.
Las asignaciones PAGE solo afectan a la nueva landing. El shell original sigue
resolviendo en /privacidad-newsletter; POCH_HD permanece con sus dos secciones.

| Ancho solicitado | Ancho útil / documento | Header / footer | Secciones landing |
| --- | --- | --- | --- |
| 1440 | 1425 / 1425 | Sin desbordamiento | 7/7 sin desbordamiento |
| 1280 | 1265 / 1265 | Sin desbordamiento | 7/7 sin desbordamiento |
| 820 | 805 / 805 | Sin desbordamiento | 7/7 sin desbordamiento |
| 390 | 375 / 375 | Sin desbordamiento | 7/7 sin desbordamiento |

Los 15 px restantes corresponden a la barra vertical del navegador. El menú
real de 11 categorías necesitó salto de línea en Base, además de Tablet; quedó
guardado mediante el editor en módulo fuente, sección de biblioteca y copia del
header. El renderer compartido permite encoger las envolturas de módulos con
minWidth:0. No se oculta el desbordamiento con recortes del contenido.

Evidencias posteriores a la retirada:
- [Mediciones y revisiones finales](integral-responsive-final.json).
- Capturas integral-final-1440.jpg, integral-final-1280.jpg, integral-final-820.jpg e integral-final-390.jpg.
- [Interacciones reales](integral-interactions.json), [shell original conservado](integral-original-shell.json) y [POCH_HD conservado](integral-poch-preserved.json).
- [Inventario BFF visible en Transición](integral-transition-inventory.json): 16 páginas independientes; todas las piezas activas y los ensayos con contenido usan secciones. Dos QA archivadas se conservan; la cabecera QA vacía pudo abrir su preview sin editor antiguo.
- [Ruta retirada](retired-builder-route.json) y retired-builder-route.jpg.
- [Media independiente](copy-image-link-persistence.json): copia con asset 9d235f09-17b0-4a8a-8436-d110b6f54594; fuente con asset 8695ac0f-697e-42de-b59f-b5ca318074f8.

## Correcciones y contratos del cierre

- Inspector compartido para diseño/campos de copias; campos configurables y cambios aislados del original.
- Visibilidad acotada del revisionToken tras escritura confirmada; no repite mutaciones cuando el read model tarda.
- Envoltura estricta de cms.section conservada al leer y volver a guardar; evita el rechazo BFF al segundo guardado de un shell.
- Posicionamiento top/left con longitudes seguras, rotación existente expuesta en inspector y flexWrap admitido por CMS igual que UI/BFF. Schemas UI/BFF/CMS sincronizados.
- Inserción de secciones y asignación por página reutilizan los contratos BFF existentes; no se crearon endpoints ni almacenamiento alternativo ni DDL.
- Guardado/publicación nuevos conservan CAS, permiso de publicación separado y comparación del recibo completo, incluida identidad y revisión. Acciones antiguas exclusivas retiradas.

Las sustituciones de contenido se limitan a copias editables: Media válida del
slider, imagen de Sol High de la sección y cuatro destinos inexistentes de CTA.
Las etiquetas de esos CTA también se ajustaron al destino real. Los originales
y las páginas previamente publicadas no se sustituyeron por la nueva landing.

## Pruebas y límites acreditados

- node --test tests/cms-*.test.mjs: 83 PASS, 0 FAIL tras la retirada final.
- npm run test:cms-contracts: 25 PASS durante este cierre.
- CMS visual-module: 35 PASS, incluido flexWrap y offsets seguros.
- BFF validaciones dirigidas: 17 PASS durante este cierre.
- Builds UI, CMS y BFF correctos; build UI final posterior a la retirada correcto.
- npm run lint: 0 errores; 3 avisos previos en clientes, cliente HTTP y PDF de facturas, ajenos al alcance.
- Comprobación de espacios del cambio CMS correcta; git diff --check global detecta espacios previos en product-editor-client.tsx, que no se modificaron para esta tarea.

Esto acredita el laboratorio Barcelona/es-ES y el alcance cerrado solicitado.
PDP/PLP no se adaptaron ni certificaron. Las comprobaciones de permisos de este
cierre incluyen guards de lectura/escritura y publicación; no se repitió un login
real de Employee lector en esta intervención. El slider usado tiene una diapositiva:
no se presenta como nueva certificación de autoplay o de múltiples diapositivas.
No se certifica despliegue de producción ni equivalencia universal de todas las
combinaciones que pudiera admitir Builder.


## Retirada de Transición solicitada después del cierre — 2026-11-24

Retirados el acceso del menú y la ruta /admin/cms/transicion, los controles de
revisión/conversión/reproducción de páginas y shell, sus Server Actions y los
helpers/harness exclusivos que quedaron sin consumidores. Se conserva el listado
BFF de páginas que utiliza Asignaciones PAGE, renombrado a
listCmsShellAssignmentPages, sin cambios de contrato. Páginas abre directamente
Editar; los compositores, bibliotecas, Media, datos, publicaciones y asignaciones
se conservan. No se ejecutaron mutaciones de contenido ni se modificó backend.

Verificación posterior: menú CMS sin Transición; ruta eliminada muestra
«No encontramos esta página»; editor de landing abre sus 7 secciones; el selector
PAGE carga las 16 páginas reales; Storefront mantiene 7 secciones/9 instancias y
las mismas revisiones publicadas del header y footer. Evidencia:
[comprobación](transition-removed-check.json) y [captura](cms-without-transition.jpg).

- node --test tests/cms-*.test.mjs tests/contracts/cms-phase-*.test.mjs: 99 PASS, 0 FAIL (74 CMS + 25 contratos; las pruebas exclusivas de conversión retirada se eliminaron).
- npm run lint: 0 errores, 3 avisos previos ajenos a CMS.
- npm run build: correcto. Se regeneraron los tipos/cache locales de Next que todavía apuntaban a la ruta eliminada; sin cambiar código para eludir la comprobación.
- git diff --check de los archivos afectados: correcto.
- Navegación real Employee, lectura del selector PAGE y lectura Storefront correctas; no se repiten publicación, E2E de creación, axe, Lighthouse ni la matriz responsive completa, al tratarse de retirada de controles y código exclusivos sin cambios de estilos ni contenido.


## Retirada de «Layout y ajustes» y «Layout base» — 2026-11-24

Por solicitud del usuario se retira la capa de administración de plantillas
heredadas: vista ?kind=layout, pestañas, listado/alta/edición/eliminación,
asignación desde settings de página, Server Actions, clientes, tipos y
normalizadores exclusivos. Ajustes básicos deja de consultar el catálogo y usos
de plantillas antiguas, y elimina el editor global «Layout base». La biblioteca
actual ofrece únicamente plantillas de composición PAGE/SECTION. Los dos accesos
antiguos (?kind=layout y Ajustes básicos ?tab=templates) redirigen a esa biblioteca.

Se conservan los valores globales de diseño utilizados por el CMS actual, fuentes
BFF y el editor compartido de áreas dentro de cada composición. El guardado global
envía solo {tokens}, con permiso cms.settings.write; no envía el layout ocultado.
Los settings de página omiten templateId del PATCH para conservar referencias
históricas sin permitir nuevas asignaciones desde el formulario. No se borraron
plantillas persistidas, contenidos, publicaciones ni asignaciones; no se modificó
backend, esquemas de datos ni endpoints de compatibilidad.

Comprobación real Employee posterior al login restaurado por el usuario:
- El acceso antiguo redirige a /admin/cms/plantillas; no hay pestañas «Layout y ajustes».
- Las plantillas de demostración PAGE y SECTION se reabren en sus compositores: 6 secciones en PAGE y sección «Promociones en columnas» en SECTION. PAGE mantiene la configuración de áreas propia.
- Ajustes básicos muestra Tokens globales, Colores y Espaciado/responsive; no existe layoutJson ni selector templateId en ese formulario.
- Biblioteca y formulario global sin desbordamiento interno a 1440/820/390.
- Landing publicada: 7 secciones/9 instancias. Header 72c915d1-a9b6-401d-9b70-ef6bc72e41a8 y footer 803f9b24-f3db-4a8e-859d-36b7ac12c2b2, sin cambios de revisión.
- /module-test-page mantiene el encabezado «para probar modulos» y el shell original.

Evidencias: [comprobación](legacy-layout-retired-check.json),
[biblioteca actual](templates-without-legacy-layout.jpg),
[ajustes globales](global-settings-without-base-layout.jpg) y capturas
layout-retired-templates-*.jpg/layout-retired-globalSettings-*.jpg.

Pruebas: node --test tests/cms-*.test.mjs tests/contracts/cms-phase-*.test.mjs:
101 PASS, 0 FAIL (76 CMS + 25 contratos). Incluyen conservación de layout mediante
PATCH de tokens, rechazo de lector y omisión de asignación legacy enviada por el
formulario; se conserva la prueba de lectura de settings históricos resueltos.
Lint: 0 errores/3 avisos anteriores ajenos. Build y comprobación de espacios de
los archivos afectados correctos. No se ejecutaron escrituras de contenido,
creación/publicación E2E, axe ni Lighthouse adicionales para esta retirada.

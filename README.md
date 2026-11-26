# Ecommium UI

Catálogo → Características/Atributos comparte los bloques y tabla compactos de
Productos/Equipo: filtros grises a ancho completo, contador y acciones separados,
Crear junto a las pestañas y celdas densas con acciones suaves. Los filtros se
adaptan a móvil y la tabla conserva scroll interno. Confirmaciones y permisos
se mantienen. [Detalle y validación](docs/catalog-features-layout.md).

Transporte, Precios, SEO, Search, Productos, Stock, Media y CMS no muestran
resúmenes técnicos de Organization/Shop junto a moneda, país, canal o idioma.
Transporte elimina «Volver a productos». El contexto operativo se conserva
en selectores, formularios y peticiones BFF.

Transporte adopta el patrón de Equipo en Zonas, Transportistas, Servicios y
Reglas de tarifa: listas sin tarjeta ni encabezado duplicado, fondo neutro,
cabecera gris y celdas compactas. «Crear…» aparece como enlace azul subrayado
a la derecha, a 6px del listado. Editar/guardar usa azul suave; activar verde
y desactivar ámbar. Los paneles laterales conservan sus formularios BFF y añaden
Escape, foco contenido, cierre por fondo y restauración de foco.
Revisión manual: `npm run dev` → Configuración → Transporte; backend canónico
con `./scripts/postman-services.sh up` desde composable.

Configuración → Precios carga los resultados de la pestaña activa y las listas
necesarias para sus filtros con un máximo de dos lecturas simultáneas por carga.
El editor de producto aplica el mismo límite a sus seis listas de Pricing.
Esto evita que el fan-out de una pantalla exceda la admisión de ReadIndex y
produzca `503 READ_INDEX_BUSY`. No se modifican permisos, pools ni contratos.
Los fallos de carga muestran el error; solo una respuesta correcta vacía muestra
«0 registros» y el estado vacío. Validación: `node --test tests/pricing-admin.test.mjs`;
arranque UI: `npm run dev`, Configuración → Precios → Impuestos. El backend
se levanta desde composable con `./scripts/postman-services.sh up`.

Crear y Editar tienda comparten ancho completo, formulario sin encabezado repetido
y filas de campos comunes: Organization, identidad/dominios y estado/región.
Organization se muestra de solo lectura al editar. Shop group y activación
permanecen como opciones propias de creación, después de los campos comunes.

Contexto elimina el encabezado del selector y su badge técnico; sus guardados
se alinean juntos a la derecha y conservan formularios independientes. Crear
Organization y Crear tienda aprovechan todo el ancho, sin la ayuda lateral de
onboarding ni acciones superiores duplicadas. Editar tienda elimina su encabezado
repetido y conserva el guardado azul dentro del formulario.

Contexto → Herencia muestra directamente la lista, sin el indicador de contrato
ni el título y subtítulo técnicos. Comparte con Equipo la cabecera gris,
las celdas compactas y la superficie neutra del listado.

Las acciones «Crear empleado», «Crear perfil» y «Asignar permisos» comparten
separación de 6px respecto al contenido. La asignación conserva su formulario
en un panel lateral; no se muestran el indicador técnico de salud, el encabezado
repetido del catálogo ni su endpoint. Los avisos de indisponibilidad se conservan.

En Equipo, «Crear empleado» se abre desde la acción del listado en un panel
lateral; se elimina su antigua pestaña y la etiqueta técnica del endpoint.
Los enlaces antiguos `?tab=create-employee` siguen abriendo el formulario lateral,
incluidos los retornos con errores de validación.

Equipo utiliza una superficie neutra continua, sin tarjetas de resumen. Perfiles
muestra el listado sin caja blanca ni encabezado repetido; el enlace «Crear perfil»
y la acción de edición abren un panel lateral con cierre, Escape y gestión de foco.
Los formularios conservan sus acciones BFF y validaciones existentes.
El espaciado de Equipo conserva el fondo `#f4f4f2`, las celdas `5px 8px` y
la cabecera gris. Las acciones de 32px utilizan tonos suaves: azul para editar
y guardar, verde para activar y ámbar para desactivar o enviar invitaciones de
credenciales. El rojo se reserva para acciones destructivas reales. Los estilos
están limitados a esta pantalla; se elimina el encabezado repetido de Empleados.

Las pestañas de Equipo, productos, precios, transporte, SEO, Search, CMS, pagos,
clientes, pedidos y postventa comparten badges redondeados con selección negra.
El mismo estilo se aplica a Contexto y al selector de acceso/registro Storefront,
con foco visible y distribución adaptable, conservando sus acciones y enlaces.
La navegación de secciones se sitúa fuera de las tarjetas blancas de contenido;
Equipo separa sus badges del panel de empleados, perfiles y permisos.

La pantalla de contexto Admin utiliza navegación por badges, con la opción activa
en negro. El resumen de contexto se conserva junto al selector; se retiran las
cuatro tarjetas superiores duplicadas. Cada pestaña muestra únicamente sus cajas.
La zona horaria de la organización se edita en Contexto con guardado independiente
por BFF, conservando sus demás ajustes; no modifica la selección de sesión Admin.

## CMS Header y Footer

Admin ofrece bibliotecas independientes en `/admin/cms/headers` y
`/admin/cms/footers`: alta, draft, preview, historial, publicacion, duplicado,
asignacion por default/superficie y archivo protegido por uso. Storefront
resuelve el shell por BFF para Home, CMS, PLP, PDP, Search, Cart, Checkout,
Account y Error, con fallback al header legado si CMS no entrega una pieza.

Headers y Footers se dividen en badges Biblioteca y Diseño. Asignaciones
se abre desde el enlace derecho en un panel lateral compartido. No hay vista
de Historial. Biblioteca es la entrada inicial; Editar abre Diseño. La navegación
conserva el elemento y locale en la URL. Guardar borrador vuelve a Diseño y
guardar asignaciones vuelve a abrir su panel lateral.

En Diseño, «Guardar y publicar» envía la composición actual: guarda el borrador
antes de publicar. Un fallo de guardado impide
la publicación; un fallo posterior informa de que el borrador quedó guardado.
Los errores aparecen inline y conservan la composición local para reintentar.

Ambas bibliotecas reutilizan el compositor de Secciones: una pieza vacía permite
insertar secciones de biblioteca como copias independientes, editar sus módulos
con el inspector compartido, ordenar y retirar copias, guardar, previsualizar y
publicar. Asignaciones admite también una página concreta mediante un selector
de páginas reales. Los documentos históricos con formato anterior conservan su
contenido y la vista previa compartida, sin el editor exclusivo retirado.

Los modulos de sistema conservan comportamiento real para logo, busqueda,
navegacion, cuenta, carrito y mercado; el footer soporta navegacion, contacto,
newsletter, legal, pagos y social. `commerce.productGrid` puede pintar hasta 20
productos hidratados por BFF sin guardar precio ni disponibilidad en CMS.
El logo admite una imagen publica segura con fallback textual; el renderer
publico obedece ancho, alineacion, spacing y visibilidad responsive de modulos y
areas.

## Editor de productos importados

El precio basico de un producto simple muestra el precio de su variante
predeterminada cuando existe. Editarlo conserva su `pricingId` y su destino
VARIANT, sin crear un precio PRODUCT duplicado. El stock predeterminado tiene
una sola entrada editable; se conservan almacen, reservas y stock de seguridad
cuando el BFF los devuelve. La carga omite `warehouseId` para que el BFF resuelva
el mismo contexto comercial del listado, sin imponer `main-warehouse`.
Validacion: `node --test tests/product-editor.test.mjs tests/product-bff-scope.test.mjs tests/product-save-operation-action.test.mjs`.

## Importacion CSV: infraestructura y resultado parcial

El seguimiento conserva la observacion cuando BFF indica
`authorizationRefreshPending: true`: el mismo usuario/sesion ha renovado la
credencial y el workflow aun debe comprobarla. No se oculta la pausa ni se envia
resume desde GET. Sin esa indicacion, una pausa requiere accion explicita.

Al seleccionar el CSV, Admin consulta readiness mediante su BFF sin enviar ni
procesar el archivo. Si todo responde, muestra "Sugerencia: sistema listo para
la importación" y habilita "Iniciar importación". Solo ese clic envia el archivo.
Si falta un componente, muestra la causa sin POST CSV y permite comprobar de nuevo
conservando el fichero. Cambiar los datos o el archivo invalida la comprobacion;
las respuestas de comprobaciones canceladas no habilitan el inicio. El BFF
repite el control antes de persistir. El resultado distingue publicados, guardados sin publicar, rechazados
y pendientes, con motivos paginados; las filas no identificables se muestran aparte.
La UI no decide publicacion ni accede directamente a owners/ReadIndex. Verificacion
local: `node --test tests/catalog-csv-import.test.mjs` y `npx tsc --noEmit`.
Prueba de navegador aislada (sin importaciones reales): `npm run build` y
`ECOMMIUM_STOREFRONT_BFF_BASE_URL=https://storefront.example.test npx playwright test tests/e2e/admin-login.spec.ts -g "CSV admission" --workers=1`.
La URL HTTPS es solo del entorno aislado de pruebas; estas pruebas Admin no llaman a Storefront.
La comprobacion acredita disponibilidad en ese momento, no disponibilidad futura.

Validacion manual reportada por el usuario el 2026-09-29: dos importaciones
consecutivas de 10 productos exitosas, la segunda seleccionando una categoria
nueva desde Admin. Tambien confirmo anadir productos del primer test al carrito.
Este punto de control no certifica checkout/pago ni cargas mayores.

Next.js application for the Ecommium ecommerce operations interface.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open http://localhost:5173 to view the app.

## Scripts

- `npm run dev` starts the local development server on port `5173`.
- `npm run build` creates a production build.
- `npm run start` runs the production server after building.
- `npm run lint` runs the Next.js ESLint configuration.
- `npm run perf:readindex-ui` measures selected UI routes with Playwright and writes JSON evidence under `.tmp/read-index-ui-performance/`.

## Admin

The Admin foundation starts at `/admin` and expects all business data to come
from the Ecommium BFF.

### Seguimiento de importación CSV

Antes de seleccionar el fichero se elige entre las categorias del CSV (por
defecto), una categoria existente o una nueva. El selector existente utiliza la
busqueda paginada del BFF, incluidas categorias inactivas; elegir una no cambia
su estado. La opcion nueva requiere nombre y Catalog la crea al aplicar el
import. La eleccion queda fijada con la subida y se recupera tras recargar.
`Nueva importación` prepara otro fichero sin borrar los datos del import anterior.
El transporte UI envia `categoryAssignment` al proxy autenticado, que lo valida
y lo incluye en `profile` del endpoint CSV BFF; no modifica el contenido del CSV.

En `/admin/products`, `UPLOADED` muestra preparación y no habilita aplicar hasta
`STAGED`. El BFF conserva y continúa el plan por owner; la UI sólo solicita aplicar,
consulta progreso y permite reanudar. Publicación aceptada no equivale a finalización:
el BFF comprueba ACK y convergencia ReadIndex antes de comunicar `COMPLETED`.
Se conservan las referencias de jobs incluso ante errores parciales. La recarga
recupera importJobId, operationId y contexto comercial desde almacenamiento local
por tenant, sin guardar tokens. Un reinicio del BFF o autorización caducada muestra
la importación pausada y requiere reanudar con la sesión actual.

Verificación aislada: `node --test tests/catalog-csv-import.test.mjs`. El contrato
canónico permanece en `.docs/06-interfaces/00-frontend-bff-contracts.md` del backend;
la UI y su ruta de reanudación sólo llaman al BFF.

### Commerce ReadIndex para lecturas

La UI no llama directamente a `commerce-read-index`; siempre consume `apps/bff`.
Para PLP Storefront, la UI puede solicitar el contrato compacto de tarjetas
activando cualquiera de estas variables de servidor:

```bash
ECOMMIUM_STOREFRONT_PLP_CARDS_ENABLED=true
ECOMMIUM_STOREFRONT_READ_INDEX_ENABLED=true
ECOMMIUM_STOREFRONT_PLP_READ_INDEX_ENABLED=true
```

Las dos variables `READ_INDEX` son alias explícitos para el rollout de
ReadIndex; la flag histórica de `PLP_CARDS` se conserva para rollback. El BFF
sigue decidiendo si responde desde ReadIndex o desde el camino legacy.

El listado Admin de productos mantiene el mismo contrato `/admin/products`. Si
el BFF devuelve filas compactas desde ReadIndex, la UI acepta `price.currentAmountMinor`,
`price.currency` y `selectedVariantId` sin realizar llamadas directas a Pricing,
Inventory, Catalog o Media.

Medición local de UI:

```bash
ECOMMIUM_UI_PERF_BASE_URL=http://127.0.0.1:5173 ECOMMIUM_UI_PERF_ROUTES=/,/plp/bike-brakes,/admin/products npm run perf:readindex-ui
```

La medición captura tiempos de navegador, peticiones fallidas y peticiones BFF
visibles desde el cliente. Las llamadas SSR de Next no aparecen como peticiones
del navegador; para p50/p95/p99 del endpoint ReadIndex sigue siendo la fuente
canónica el benchmark del monorepo backend.

### Instalación segura de Admin 0

La ruta pública server-rendered `/admin/installation` implementa el proceso
10/11 de ADR-0154 contra StoreAdmin BFF. No crea un backend Next.js alterno ni
llama a `services/*`:

- `NOT_INITIALIZED`, `FRESH_CLAIM_REQUIRED` y `REVIEW_REQUIRED` muestran solo
  el siguiente paso operativo, sin candidatos, emails, IDs o motivos internos.
- `FRESH_READY` acepta el claim efímero y la credencial elegida por el usuario;
  nunca permite enviar roles, permisos, tenant o IDs.
- `ADOPTION_REQUIRED` exige login Employee/Admin SYSTEM, reautenticación por
  contraseña actual y una credencial nueva. Tras completar, limpia la cookie UI
  porque BFF revoca todas las sesiones, incluida la actual.
- `COMPLETED` cierra el instalador. El primer tenant se crea después mediante
  los contratos normales de Organizations/Shops.

El mecanismo vigente no envía un claim ni una contraseña por email, ni genera
un enlace de activación. Un operador emite el claim de un solo uso desde la CLI
de `Employees`, lo entrega por un canal operativo seguro y el futuro Admin 0
lo introduce una sola vez en esta pantalla. La UI no guarda el claim y el BFF
no acepta un destino o una URL enviados por el navegador. Si en el futuro se
incorpora una invitación por enlace, deberá ampliar primero el contrato de
`Employees`/StoreAdmin BFF y configurar una URL pública confiable de la UI por
entorno; no debe resolverse ni inferirse desde el cliente.

Una sesión SYSTEM sin tiendas se conserva y entra en
`/admin/configuracion/contexto?tab=create-organization`. Desde allí crea la
Organization y después la Shop; una sesión ordinaria sin tiendas continúa
fallando cerrada. La certificación aislada se ejecuta con:

```bash
PLAYWRIGHT_HTML_OPEN=never npx playwright test tests/e2e/admin-installation.spec.ts
node --test tests/admin-installation.test.mjs tests/admin-login-action.test.mjs
```

El proceso 11/11 se orquesta desde el repositorio backend mediante
`scripts/admin-zero-final-certification.mjs`. Incluye estas pruebas, lint,
Playwright y el build de producción. StoreAdmin BFF puede devolver `503` cuando
`ADMIN_INSTALLATION_SURFACE_MODE` está deshabilitado; la UI falla cerrada y no
intenta un backend alternativo.

Para habilitar temporalmente esta superficie en un entorno controlado, el
proceso StoreAdmin BFF requiere `ADMIN_INSTALLATION_SURFACE_MODE=ENABLED`. La
UI conserva su propia URL pública en
`NEXT_PUBLIC_ECOMMIUM_PUBLIC_BASE_URL` para metadata; esa variable no autoriza
la instalación ni sustituye la configuración confiable del BFF.

### Credenciales Admin

El proceso 10/12 de ADR-0155 consume únicamente StoreAdmin BFF y no crea una
API de negocio en Next.js:

- Antes de mostrar «¿Olvidaste tu contraseña?», la UI consulta por servidor
  `GET /api/v1/admin/auth/password-recovery/availability`. Si no devuelve
  explícitamente `{ available: true }`, oculta el enlace y el formulario;
  nunca infiere cuentas ni entrega de email a partir de esta capacidad.
- `/auth/admin/password-recovery` solicita recuperación con respuesta uniforme
  solo cuando la capacidad está habilitada; no confirma si el email existe.
- El enlace de email debe apuntar a
  `/auth/admin/password-recovery/consume?token=...`. Esta ruta técnica elimina
  el token de la URL, aplica `no-store` y `Referrer-Policy: no-referrer`, y lo
  conserva solo en una cookie HttpOnly firmada de 15 minutos antes de mostrar
  `/auth/admin/password-recovery/complete`.
- Equipo > Seguridad (`/admin/configuracion/equipo?tab=security`) permite cambiar la contraseña propia en un panel lateral. La ruta anterior `/admin/configuracion/seguridad` redirige aquí conservando avisos y errores. La UI
  reautentica contra step-up y solicita revocar las demás sesiones; no guarda
  ni registra contraseñas.
- Si `GET /auth/me` devuelve `credentialState=MUST_CHANGE_PASSWORD`, la UI
  redirige a `/admin/password` y bloquea el shell administrativo hasta crear
  una contraseña personal.
- Solo un SuperAdmin SYSTEM con `system.admin` ve en `Configuración > Equipo`
  la acción de enviar una invitación de un solo uso para restablecer la
  credencial de otro empleado. La UI no ofrece contraseña temporal.
- En `Configuración > Equipo`, el selector de `Tienda predeterminada` solo
  muestra los `shopScopes` ya asignados al empleado. Se persiste mediante
  `PATCH /admin/employees/:employeeId/preferences` y aporta el contexto seguro
  que necesita la recuperación de contraseña; `Employees` vuelve a validar la
  misma invariante en servidor. Si una cuenta legacy tiene exactamente una
  tienda permitida, `Sessions` puede usarla para recuperación sin solicitar
  contexto en la pantalla pública; con varias, no adivina y necesita la
  preferencia explícita.

La URL base de recuperación es una configuración privada de Sessions/BFF por
entorno; no se resuelve ni se recibe desde el navegador. La prueba focal se
ejecuta con:

```bash
node --test tests/admin-credentials-ui.test.mjs tests/auth-session-payload.test.mjs
npx playwright test tests/e2e/admin-credentials.spec.ts
```

El proceso 11/12 quedó certificado junto con Employees, Sessions, StoreAdmin
BFF, Customer y Admin 0 mediante el gate del monorepo, ejecutado con Node 22:

```bash
node ../composable_ecommerce/scripts/admin-credentials-integrated-certification.mjs --full \
  --ui-root="$(pwd)"
```

El gate usa BFFs simulados para sus e2e UI, no ejecuta migraciones ni tráfico
contra entornos vivos; el rollout fail-closed del proceso 12/12 se certifica
desde el monorepo antes de cualquier activación de cohorte.

El proceso 12/12 establece `ADMIN_CREDENTIAL_SURFACE_MODE=DISABLED` como
postura predeterminada del StoreAdmin BFF. Si la superficie no está habilitada
para una cohorte, la UI recibe `503` genérico y no intenta ningún acceso directo
a Sessions/Employees. El cambio a `ENABLED` y el rollback están documentados en
el runbook del monorepo; nunca son una decisión del navegador.

## CMS blocks

El listado de paginas CMS permite eliminar definitivamente paginas `DRAFT` o
`UNPUBLISHED` mediante el StoreAdmin BFF. La accion exige confirmacion escrita,
queda deshabilitada mientras la pagina esta `PUBLISHED` y, tras completarse,
retira la fila del listado. CMS desactiva la ruta canonica retenida y elimina
versiones/settings asociados antes de responder `{ pageId, deleted: true }`.

`packages/cms-blocks` is the shared CMS block catalog for Admin, Storefront and
the independent CMS editors. It owns block types, presets, editor metadata,
normalization, JSON serialization helpers and shared React renderers while
keeping all BFF access in the UI modules.

`slider.fullWidth` dispone de editor estructurado para crear, duplicar,
reordenar y eliminar diapositivas sin editar JSON. Cada slide configura imagen,
texto alternativo, titulo, subtitulo, CTA, posicion focal y alineacion del
contenido. El modulo define alturas de escritorio, tablet y movil, overlay,
autoplay e intervalo; Storefront lo renderiza con Swiper, controles accesibles,
teclado, gestos tactiles y respeto por `prefers-reduced-motion`. En paginas
`HOME`, un area y placement `full-width` permiten colocarlo inmediatamente bajo
el header sin breadcrumb, titulo visible, padding ni margen de pagina.

## CMS independiente y retirada de Builder

El CMS se gestiona desde Páginas, Módulos, Secciones, Plantillas, Headers y
Footers. El cierre constructivo de Barcelona/es-ES acredita además la creación
manual desde las bibliotecas: 19 módulos, 10 secciones y dos plantillas de la
demostración; landing, header y footer nuevos publicados y asignados desde UI.
La retirada incluye la ruta y pantalla de Builder y su editor exclusivo de shell.

Las páginas permiten copiar secciones, editar las copias y módulos visuales,
conservar estilos, recursos Media y comportamientos responsive, guardar y
publicar mediante comandos CAS/idempotentes del BFF. Los controles estructurados
existentes de slider y tarjetas de categoría se reutilizan en los módulos.
Headers y Footers conservan sus identidades y asignaciones de superficies.
La pantalla Transición y sus controles exclusivos de diagnóstico/conversión se
retiraron por decisión del usuario. La gestión cotidiana utiliza las bibliotecas
y los compositores actuales; los datos y publicaciones se conservan. Las plantillas
heredadas de «Layout y ajustes» y el editor global «Layout base» también se han
retirado. Plantillas contiene únicamente composiciones PAGE/SECTION; las áreas y
columnas propias de cada composición se mantienen. Ajustes básicos conserva los
valores predeterminados de diseño. Su guardado actualiza solo tokens y preserva
el layout guardado. Los enlaces antiguos de plantillas heredadas redirigen a la
biblioteca de composición; no se eliminan datos históricos ni publicaciones.

Se conservan el catálogo y los renderers compartidos, la edición visual,
rich text, Media y los lectores de snapshots históricos. El nombre técnico
`admin:cms-builder:view` y la colección Media `CMS Builder Assets` se mantienen
por compatibilidad de permisos/activos; no abren el editor retirado.
La recuperación de publicaciones usa `restorePublished:true` sobre una versión
publicada histórica, con revisión esperada y el mismo coordinador de Routing.

El seguimiento y las evidencias están en
[el cierre constructivo vigente](docs/qa/cms-construction-demo-20261124/closure-status.md).
Los informes de conversión anteriores son evidencia histórica, no sustituyen
esta demostración de construcción desde las bibliotecas.

## Storefront signup human verification

The Storefront signup form always sends passive anti-abuse signals to the BFF:
`startedAt`, honeypot `company`, and action `customer_signup`.

Optional Turnstile verification is controlled only with browser-safe public
configuration:

- `NEXT_PUBLIC_ECOMMIUM_SIGNUP_HUMAN_VERIFICATION=off|turnstile`, defaults to
  `off`.
- `NEXT_PUBLIC_ECOMMIUM_TURNSTILE_SITE_KEY`, public Cloudflare Turnstile site
  key used only when signup verification is `turnstile`.

Never expose the Turnstile secret key in this repo or any `NEXT_PUBLIC_*`
variable. The secret belongs only to the BFF/Sessions runtime.

Configuration matrix:

- `off`: no Turnstile widget is rendered, signup remains available, and only
  passive signals are sent in `humanVerification`.
- `turnstile` with `NEXT_PUBLIC_ECOMMIUM_TURNSTILE_SITE_KEY`: the signup UI
  renders Cloudflare Turnstile, stores the resulting token in `turnstileToken`,
  and posts `provider: "turnstile"` plus the token to the BFF.
- `turnstile` without `NEXT_PUBLIC_ECOMMIUM_TURNSTILE_SITE_KEY`: signup fails
  closed. The UI keeps submit disabled, shows a configuration error, and the
  server action refuses requests without `turnstileToken` before calling the
  BFF.

Manual local checks:

```bash
NEXT_PUBLIC_ECOMMIUM_SIGNUP_HUMAN_VERIFICATION=off npm run dev
NEXT_PUBLIC_ECOMMIUM_SIGNUP_HUMAN_VERIFICATION=turnstile NEXT_PUBLIC_ECOMMIUM_TURNSTILE_SITE_KEY=<site-key> npm run dev
```


## Newsletter del home (MVP local, 2026-10-02)

El módulo existente usa `newsletterForm`, editable mediante Builder, con partes
email/consent/privacy/feedback y estilos declarativos. El storefront recibe la
política vigente desde Consent a través de BFF. Server Actions validan payload,
contexto canónico y origen; nunca aceptan URLs de destino del visitante.
Confirmación y baja requieren acción explícita, retiran fragmentos y no guardan
tokens en storage. Admin publica políticas versionadas desde
`/admin/configuracion/consent/newsletter`, con permisos BFF.

Pruebas: `node --test tests/newsletter.test.mjs`, `npm run lint`, `npm run build`.
Flujo local certificado: home → Mailpit (`http://localhost:8025`) → confirmación
→ baja; sin campañas externas. Privacidad de pruebas, retención y despliegue
productivo pendientes. Arranque backend: `./scripts/postman-services.sh`
en el repositorio composable_ecommerce; UI: `npm run dev`.


## Cuadrícula de categoría en home

`commerce.productGrid` se crea/configura desde CMS Builder: búsqueda de
categoría activa, orden, máximo 20 productos, columnas desktop/móvil, ancho,
separación y título/subtítulo. Home v19 usa Componentes, 12 productos y 6 por fila en escritorio, precio
ascendente y ancho 90%. Tarjetas con marca, imagen, enlace y precio; descuento
y talla solo cuando BFF los proporciona. UI consume exclusivamente BFF.
Pruebas: `node --test tests/product-grid.test.mjs tests/cms-admin.test.mjs`,
`npm run lint`, `npm run build`; responsive verificado en browser.
Backend: `./scripts/postman-services.sh up-missing` desde composable_ecommerce.


## Footer editorial de ciclismo

Footer principal revisión 3, configurado/publicado por Builder con cinco
columnas, logo en negativo, grupos titulados y franja con cuatro iconos sociales
SVG locales. Textos y contactos de ejemplo autorizados; enlaces sociales
generales, editables para sustituirlos por cuentas reales. Responsive 5/2/1
columnas; mantiene margin-top 0px y evita gaps fuera del ancho del footer.
Pruebas: `node --test tests/footer-cycling.test.mjs tests/cms-admin.test.mjs`.

## Cabeceras de categoría con imagen de fondo

`Cabecera PLP` (`plp.categoryIntro`) se edita en CMS → Builder, página Home,
vista PLP. Cada bloque apunta a su `Slug categoria`: imagen URL, título, texto,
modo fondo, altura (160–600px), oscurecimiento (0–90%), color y posición.
Guardar draft y publicar Home activa los bloques dirigidos a las categorías;
no se muestran en el contenido del home. Se configuraron las 16 categorías
visibles con fotos existentes acordes a su temática. Categorías relacionadas
comparten fotografía y pueden cambiarla independientemente. Las nuevas categorías
requieren añadir su bloque; no se asigna una foto automáticamente.

La PLP sustituye su introducción fija cuando BFF entrega `plp.categoryIntro`
antes de la lista y mantiene un h1 semántico. Sin bloque conserva texto de
respaldo sin el antiguo cuadro decorativo. El modo lateral anterior sigue válido.
No hay endpoints nuevos ni cambios de owners; media local o HTTPS seguro,
texto escapado, valores visuales acotados y sin fetch servidor de URLs de fondo.

Validación: `npm run lint`, `npm run build`,
`node --test tests/category-banner.test.mjs tests/cms-admin.test.mjs tests/storefront-plp.test.mjs tests/storefront-public-routing.test.mjs`.
Playwright comprobó las 16 rutas y el banner en desktop/tablet/mobile.
La cabecera no desborda; a 768px se observó desbordamiento ajeno al banner
asociado al drawer de autenticación existente. Lighthouse no ejecutado.
Para verificar con servicios locales: `./scripts/postman-services.sh up-missing`
desde composable, `npm run dev` en esta UI, abrir `/plp/bike-brakes`.

## Imagen desplegable y Cloud Run (O15, 2026-10-20)

Dockerfile multistage con output standalone y usuario node; .dockerignore usa allowlist y excluye .env/credenciales. Misma imagen por organización; configuración y secreto de cookie sólo al arrancar. El preflight exige BFF HTTPS, contexto Organization/Shop coherente y secreto de cookie >=32; rechaza bearer técnico, fixtures o clave Google. Health técnico GET /api/health no consulta datos ni certifica BFF.

Construir: `docker build --platform linux/amd64 -t ecommium-ui:o15 .`. Evaluar: `node --test tests/deployment-preflight.test.mjs tests/admin-login-action.test.mjs`. La imagen escucha PORT=8080; recibir variables ECOMMIUM_* y secreto desde el entorno del despliegue, nunca argumentos de build ni archivos .env dentro de la imagen. El workflow frontend-image genera OCI AMD64 sin credenciales de proveedor ni publicación automática. Publicar en Artifact Registry y desplegar requiere accesos comprobados y el plan gobernado DEPLOY_FRONTEND_SERVICE del composable. Una imagen local o su health no certifican tienda pública, dominio ni recorrido comercial. API Cloud Run actualmente pendiente de habilitación manual.

Referencia: https://nextjs.org/docs/app/api-reference/config/next-config-js/output . Los resultados de lint/build y gates se registran al finalizar la evaluación O15.

Evaluación O15 2026-10-20: imagen Linux AMD64 ecommium-ui:o15-test construida con Next16.3.0/TypeScript completos PASS, usuario node, health200 y formulario real de acceso200. Pruebas de preflight/login20 PASS; lint0 errores/3 advertencias. Contenedor y secreto sintético efímero de evaluación retirados; imagen local conservada. Sin publicación de imagen, workflow ejecutado en GitHub o despliegue Google. Faltan API Cloud Run habilitada, acceso de publicación/deploy comprobado, identidad runtime de privilegio mínimo, secreto real por referencia y BFF accesibles. El origen público/NEXT_PUBLIC_* y la separación de dominios Admin/Storefront conservan gate explícito antes del rollout: no se certifican por el health o formulario local.


## Evaluación Admin 0 — 2026-10-20

Pruebas aisladas existentes de instalación: fresh, review, adopción y onboarding4/4 PASS; instalación/login17 unitarias PASS. Dos selectores Playwright Password se limitaron al input[name=password] para no coincidir con el botón Mostrar password. No cambia el producto ni sus contratos; se reutilizó el build disponible, sin reconstrucción. Esta evaluación usa BFF de prueba y no certifica MFA, adopción o despliegue live. La continuación autenticada O10 se documenta en el backend, plan19/ADR-0302.


## O15 — una imagen con configuración por organización

Perfil opt-in ECOMMIUM_UI_ROUTING_MODE=SEPARATED_V1. Configurar cuatro orígenes
distintos: ECOMMIUM_UI_STOREFRONT_ORIGIN, ECOMMIUM_UI_ADMIN_ORIGIN y las dos
variables BFF existentes. ECOMMIUM_SIGNUP_HUMAN_VERIFICATION=off|turnstile y
ECOMMIUM_TURNSTILE_SITE_KEY se leen en servidor y sólo esos valores públicos se
entregan al provider cliente. No se entregan bearer, cookie secret o URLs internas.
El fallback NEXT_PUBLIC se mantiene para el perfil anterior; V2 exige los nuevos
valores explícitos. Cookie Admin sigue Secure/httpOnly/host-only.

Un proceso sirve tienda y Admin en nombres separados. Admin raíz lleva a /admin;
/admin, /auth y /api/admin no se sirven en el host Storefront; desconocidos404.
/api/health permite la sonda nativa sin Host comercial y sólo indica vida del
proceso. La tienda resuelta por BFF debe coincidir con el despliegue configurado.
metadata/provider se renderizan por petición con connection: no quedan ligados
al build. No se añade un BFF paralelo ni se cambia la autenticación.

ShopStatus se alinea con ACTIVE|INACTIVE; nuevo formulario INACTIVE por defecto.
Comprobación: npm run build; npm test. Desde el composable:
./scripts/postman-services.sh platform-frontend integration-smoke|integration-open.
Este comando usa BFF/servicios reales, TLS acotado y Admin temporal Linux; requiere
VM e imágenes preparadas según plan20. No necesita dominio público ni modifica
.env.local. La publicación Cloud Run/DNS y OAuth/Turnstile reales siguen pendientes.


Evaluación O15 final (2026-10-21): 497 unitarias PASS, TypeScript PASS,
Playwright instalación/adopción4 PASS, lint0 errores/3 advertencias previas.
Recorrido real desde el composable: diez controles PASS con login/alta y reinicio;
la tienda consulta su catálogo existente, el Admin crea datos sólo en base temporal.
Imagen local AMD64 ecommium-ui:o15-separated-test construida y proceso health200
comprobado; no fue publicada en Google. En el perfil separado el fallo de contexto
responde503 textual/no-store y los redirects usan su origen público admitido.
El layout dinámico permite configuración por petición; no se certifica latencia
productiva ni OAuth/Turnstile reales. Detalles y evidencia en plan20 del composable.


### O15 — recorrido funcional OCI (2026-10-21)

La misma imagen local o15-separated-test ya se evaluó conectada a servicios
reales:11 controles PASS, CPU1/memoria512MiB, login/alta en Admin temporal Linux,
reinicio de web conservando sesión y dos instancias con distinta configuración
pública. No se montaron fuentes/node_modules/.next dentro del contenedor.
El recorrido Node anterior conserva10 PASS. Desde el composable:
`./scripts/postman-services.sh platform-frontend container-integration-smoke`
o `container-integration-open`. Preparación, evidencia y límites en plan21 de
.docs del composable. No hay publicación DNS/Cloud Run ni certificación productiva.

## Consent detrás del proxy de despliegue (2026-10-22)

En producción el transporte Consent compara el Host recibido con el origen público
HTTPS configurado, aunque Next construya request.url con la dirección interna del
contenedor. Las decisiones verifican Origin contra ese mismo origen público ya
validado; no confían en x-forwarded-host ni aceptan dominios o puertos distintos.
La ausencia de política publicada sigue siendo NOT_CONFIGURED, no una autorización
para tecnologías opcionales. No se precarga contenido comercial.
Pruebas: `node --test tests/storefront-consent-proxy.test.mjs tests/storefront-consent.test.mjs tests/storefront-consent-gates.test.mjs tests/deployment-routing.test.mjs`.

La corrección se ha comprobado también con navegador e imagen reales frente al
BFF y Consent/PostgreSQL aislados: NOT_CONFIGURED, cookie Secure y otra Shop400.
En la raíz del composable: `TMPDIR=/private/tmp ./scripts/postman-services.sh platform-frontend consent-smoke`.
Este ensayo de privacidad no certifica el recorrido completo de PO.


## Admin 0 antes de crear Organization/Shop

El perfil explícito `ECOMMIUM_UI_SURFACE=ADMIN` valida
`ECOMMIUM_UI_ADMIN_ORIGIN`, `ECOMMIUM_ADMIN_BFF_BASE_URL` y un secreto de sesión
privado de al menos 32 caracteres. No admite token técnico, modo de routing mixto
ni campos Storefront inventados. Sólo expone Admin/Auth y sus rutas técnicas en
el Host/puerto configurados; rechaza Storefront y dominios ajenos. Requiere HTTPS;
el ensayo local admite HTTP únicamente si web y BFF están en 127.0.0.1.
El perfil Storefront conserva su validación de arranque y contexto.

El formulario `/admin/installation` sigue creando la cuenta mediante Admin BFF;
PO sólo prepara/autoriza y enlaza. El claim nunca se obtiene por un endpoint UI.
Integración evaluada en el repositorio composable bajo O10/ADR-0307.

El preflight de la imagen y el arranque Next reutilizan el mismo validador del perfil ADMIN; el Dockerfile incluye ese módulo técnico. El perfil Storefront conserva su preflight anterior.

Evaluación local:45 pruebas focalizadas, lint y build PASS. En el composable,
`TMPDIR=/private/tmp ./scripts/postman-services.sh platform-admin-bootstrap panel-smoke`
reproduce el recorrido real desde PO vacío hasta alta/login y reinicio web/backend.
La variante `panel-open` usa Chrome visible. Ambos eliminan sus datos de ensayo;
`platform-organizations start` conserva el laboratorio para el recorrido humano.


2026-10-30 — Transporte retira «Incluir inactivos», su filtro y la propagación
de `includeInactive` por URL o formularios. La configuración BFF solo devuelve
recursos activos; el parámetro retirado provoca HTTP 400. Desactivar retira el
recurso del listado y no permite reactivarlo desde esa pantalla. La validación
y gestión privadas de Shipping conservan los inactivos cuando los necesitan.


2026-10-30 — SEO reutiliza el patrón de Equipo en Rutas, Redirects y Sitemap:
superficie neutra, listas sin tarjeta ni encabezado duplicado, cabecera gris,
celdas compactas y acciones suaves. Crear ruta/redirect son enlaces azules
subrayados alineados a la derecha, a 6px del listado. Transporte y SEO comparten
un contenedor lateral técnico con Escape, cierre por fondo y control del foco;
los formularios, filtros, permisos y contratos BFF permanecen operativos.
Revisión: `npm run dev` → Configuración → SEO; backend con el script canónico
`./scripts/postman-services.sh up` desde el repositorio composable.


2026-10-30 — El bloque de importación CSV de productos vive en
`/admin/catalogo/importar`, accesible desde Catálogo → Importar, debajo de Stock.
Productos deja de montar el importador. Se reutiliza el mismo componente,
contexto y carga de categorías; se conservan los endpoints BFF y la recuperación
del trabajo por tenant. La nueva pantalla exige contexto antes de montar el
formulario. Revisión manual: `npm run dev` → Catálogo → Importar; backend
con `./scripts/postman-services.sh up` desde composable.


2026-10-30 — El listado de Productos muestra el nombre sin la línea secundaria
del slug. El slug se conserva en los datos y en la edición del producto.

2026-11-04 — Catálogo → Importar reorganiza el formulario en Archivo, Categorías
y Opciones, con campos en dos columnas, casillas compactas y ajustes avanzados
de inventario desplegables. La plantilla queda junto al archivo; revisión,
comprobación de disponibilidad y acciones se agrupan al pie. Los estados se
muestran en español y los identificadores técnicos quedan en un desplegable
durante el seguimiento. CSS local basado en los tokens Admin, sin cambiar
payloads, endpoints ni el control de disponibilidad previo al envío.
Validación: `npm test`, `npm run lint`, `npm run build` y
`ECOMMIUM_STOREFRONT_BFF_BASE_URL=https://storefront.example.test npx playwright test tests/e2e/admin-login.spec.ts -g 'CSV admission' --workers=1`.
Revisión visual con BFF local en 1440/768/390px; no se crearon productos ni jobs.
Resultado: 514 unitarias y 5 E2E de admisión PASS; lint sin errores (3 avisos
previos), build PASS. Axe sin incidencias en el formulario a 1440/768/390px,
sin desbordamiento horizontal. Readiness real bloquea el envío con los workers
apagados tras la limpieza; no acredita una importación completa en ese estado.


Preparación de tiendas: Configuración > Contexto muestra el estado de lectura del
contexto activo y permite reintentar por BFF sin repetir el alta. Ver el contrato
en `docs/composable-reference/README.md`. La disponibilidad técnica se distingue
del estado operativo de la tienda.


Altas de categorías, marcas y configuración de pagos: formularios y payloads
alineados al BFF, validación inline y conservación de valores tras rechazo.
Configuración de pagos inactiva por defecto, con confirmación al activar.
El BFF propaga `includeInactive` para listar y seleccionar configuración inactiva.
Evidencia y datos de ensayo: `docs/qa/form-create-contracts-20261104.md`.


Permisos/sesión Admin: capacidades de Equipo separadas entre gestión de empleados
y seguridad de perfiles, taxonomía sin edición/borrado para lectores, y permisos
canónicos de Payments configuración. Snapshot auth/me por render; cambio de
contraseña actualiza cookie tras verificación y conserva renovación/defaultContext.
Evidencia y límites: `docs/qa/admin-permissions-session-20261104.md`.

Indicadores de salud: un HTTP 200 no confirma salud operativa. Errores explícitos
se muestran degradados; respuestas sin señal válida quedan Sin confirmar.
Evidencia: `docs/qa/admin-health-indicator-20261104.md`.

Suite E2E (2026-11-04): `npm run test:e2e` compila y ejecuta los escenarios
con un worker y BFF simulados aislados. Storefront usa HTTPS loopback de prueba;
no necesita servicios reales ni ocupa el servidor de desarrollo. Para repetir
sin recompilar: `npx playwright test`. Sin build previo falla con una indicación
explícita. Selectores, pestañas, lazy media y contratos de mocks actualizados.
Evidencia y límites: `docs/qa/e2e-suite-refresh-20261104.md`.

## Editor de producto: correcciones funcionales de 2026-11-06

El guardado conserva una copia local estructurada con identidades confirmadas y
usa un deadline propio de60s para la operación multiowner; lecturas mantienen15s.
El guardian no ofrece recuperación genérica de formularios en fichas que ya tienen
recuperación de producto. Precio base conserva su identidad separada de reglas
específicas; el simulador diferencia error técnico de ausencia de precio. Captions,
actividad y portada de assets persistidos se marcan para guardar por BFF. Nueva
ficha deja el almacén para resolución del contexto BFF y no fija main-warehouse.
Pruebas, evidencia de API y Playwright, resultados y límites en
[QA de reparación](docs/qa/product-editor-repair-20261106.md).

## Características de producto por categoría

La ficha técnica muestra los grupos vinculados a la categoría con un selector por
campo. «Añadir otra característica» busca campos adicionales; «Administrar
características» permite crear campos, añadir valores y compartir grupos con otra
categoría desde un lateral, conservando el producto. Los atributos de variantes
permanecen separados y cambiar la categoría no borra selecciones existentes.
El alta comparte formulario con Catálogo > Características. Evidencia y límites:
[QA del flujo](docs/qa/product-feature-flow-20261106.md).

Catálogo → Características usa Desactivar con cálculo de impacto, confirmación y
progreso. Preserva asignaciones de productos, comprueba permisos sobre todos los
alcances compartidos y exige revisión actualizada; distingue guardado de
sincronización ReadIndex. Evidencia y comandos: `docs/qa/feature-deactivation-20261107.md`.


## Eliminación revisada — 2026-11-09

Implementación y pruebas locales: [evidencia](docs/qa/catalog-retirement-20261109.md). Activación pendiente de autorización para seis migraciones remotas; ninguna aplicada. Validación de permiso/contexto y rechazo de identidad de borrador remoto incompatible añadidos. Los hallazgos de seguridad pendientes existentes permanecen abiertos.


Actualización 2026-11-09: autorización remota recibida, seis migraciones APPLIED y flags locales activos. Playwright real completó eliminación de variante y producto QA; BICI-20260929-172 preservado. Evidencia: catalog-retirement-20261109.md en QA. Sustituye el estado previo de activación bloqueada.

### Eliminaciones en segundo plano

La UI reconoce la aceptación durable `PENDING` y retira el elemento tras202; no muestra eliminación completada ni ejecuta pasos del worker. Seguimiento en `/admin/catalogo/eliminaciones` con GET y reencolado explícito. Contrato actualizado en `docs/composable-reference/README.md`; evidencia en `docs/qa/catalog-retirement-20261109.md`. Activación asíncrona remota pendiente de la migración Catalog específica.

2026-11-09 — Activación asíncrona autorizada por Ricardo: migración adicional Catalog APPLIED, worker integrado al supervisor existente y pruebas Playwright conectadas de variante/producto, cierre de navegador y reinicios PASS. Tres operaciones QA COMPLETED; seis owner proofs correctos; ReadIndex dos contextos/remaining0; Log verificable; original y tres miniaturas Google404; PDP404/noindex y sitemap sin QA. Se corrigieron prefijos internos faltantes de Pricing/Media y preflight404 durante PENDING. BICI preservado. Sustituye el estado previo PENDING de activación; no certifica producción/CDN ni recuperación Search entre hosts. Evidencia: QA catalog-retirement-20261109. Los pendientes de seguridad ajenos permanecen abiertos.


Correcciones controladas del editor (2026-11-12): confirmación canónica de relaciones de servicios, resolución de la marca asignada por ID, contrato HTML explícito, confirmación de altas con ID, recuperación fiscal y404 de producto inexistente. Precio propio de variante verificado en UI/BFF real. [Evidencia y límites](docs/qa/products-audit-20261111.md#correcciones-controladas-2026-11-12).


Clientes → Perfil incorpora Grupo comercial, asignado por el administrador al crear o editar, y aprobación empresarial B2B. Se consume BFF y se guarda junto con el perfil de forma transaccional; no hay VIP automático por compras. Detalle, comandos y límites en `docs/qa/customer-commercial-segmentation-20261112.md`.


Selección comercial Storefront: `ECOMMIUM_STOREFRONT_TRADE_POLICY` es opcional y server-only, sin valor predeterminado. Cuando se configura, exige Organization/Shop canónicos del despliegue y se transmite solo en sus rutas comerciales. Debe elegirse explícitamente conforme a reglas Pricing; no se deduce de locale ni de Shop defaults, ni asigna un grupo Customer. Evidencia sandbox y pendientes: [compra PayPal](docs/qa/paypal-purchase-resumption-20261116.md).

## Precio normal y reglas especiales — 2026-11-16

Admin distingue normal en básico y específicos en Precio, sin inyectar default/web/ES en los precios. Conserva reglas legacy, moneda y fiscalidad; cero explícito no equivale a ausencia. [Contrato BFF sincronizado](docs/composable-reference/regular-and-specific-prices-contract.md) y [evidencias UI/E2E](docs/qa/regular-pricing-20261116.md).

Pricing incorpora revisión versionada y sustitución antes de eliminar impuestos o tablas. La UI diferencia escritura y convergencia de lecturas, permite revisar todo el impacto paginado y verificar sin repetir la mutación. Activación configurada pendiente; [implementación y pruebas](docs/qa/reviewed-removal-20261117.md).

2026-11-17 — Activación posterior de eliminación revisada autorizada y aplicada:20261117160000_reviewed_removal y reinicio selectivo Pricing/BFF Admin/ReadIndex. Health200 y datos comerciales intactos. La prueba manual de tienda queda pendiente de contexto Employee; ver `docs/qa/reviewed-removal-20261117.md`.


## Eliminación de cabeceras y pies de página

Biblioteca y Diseño ofrecen Eliminar con confirmación escrita y permiso CMS de
escritura. Las piezas en uso están bloqueadas: retirar o reemplazar asignaciones
antes de eliminar. Asignaciones permite retirarlas explícitamente restaurando
herencia. El BFF/CMS vuelve a comprobar el uso y protege carreras.
Evidencia: [QA](docs/qa/cms-site-part-deletion-20261119.md).

### Editor visual CMS compartido (2026-11-19)

Builder, Headers y Footers reutilizan `cms-visual-editor.tsx`: árbol, catálogo de
nodos, inspector, estilos por dispositivo, movimiento, Media, JSON y presets.
`cms-visual-editing-panel.tsx` adapta esos controles al editor de site parts;
`cms-editor-history.ts` comparte las transiciones de deshacer/rehacer. La vista
previa usa `StorefrontSitePartView` en modo inerte, con el renderer público de
módulos visuales y bloques de sistema. Los builders se cargan dinámicamente.

En Diseño: añadir un módulo visual desde Elementos; seleccionar un nodo en el
árbol o canvas; editar contenido y Styles responsive en Inspector. “Diseño del
área” abre el mismo inspector para su presentación. Los bloques funcionales
conservan sus campos de negocio y añaden presentación visual. Los módulos CMS
ACTIVE se insertan como referencias; su estructura requiere desvincular una
copia o editar la definición desde Builder. Los presets locales usan la misma
clave/versionado del Builder. Guardar y publicar envía el snapshot completo.

Evidencia y límites: `docs/qa/cms-builder-unification-20261119.md`.

### Preview del borrador de Headers y Footers

El botón **Preview** del constructor abre la pieza actual, incluidos cambios sin
guardar, en un viewport independiente con el renderer y CSS públicos. Incluye
Desktop/Tablet/Mobile y ancho real configurable. No guarda ni publica. Escape
cierra la vista y devuelve el foco al botón. La navegación de reserva y las
referencias no disponibles se identifican; cuenta/carrito se muestran como
visitante sin ejecutar acciones comerciales.
Evidencia: `docs/qa/cms-site-part-preview-20261119.md`.

### Una caja CSS por Header/Footer

En Diseño, **Estilos del bloque completo** es la caja de CSS de la pieza, con
Base/Desktop/Tablet/Mobile. Acepta reglas como `a { color: red; }`,
`a:hover { color: blue; }` y `:scope { padding: 20px; }`. Los selectores se limitan
a esa pieza y los valores usan el registro seguro del Builder. El CSS se guarda
en el layout de la revisión y aparece en el mismo Preview público. Sustituye la
edición de Styles JSON directo por nodo en Headers/Footers; los datos anteriores
se conservan. Ver `docs/qa/cms-single-block-stylesheet-20261119.md`.

### Estándar de tablas «Compacta»

La petición «dale los estilos Compacta a esta tabla» invoca la
[guía obligatoria Compacta](docs/admin-compacta-style.md), referenciada en
[AGENTS.md](AGENTS.md). Documenta estructura, herencia, tokens, medidas,
tipografía, badges, acciones, responsive y verificación frente a Productos.

## Contenido de módulos en Secciones

Secciones → Diseño → Editar copia del módulo muestra los campos de contenido
expuestos desde Módulos → Diseño (Content binding y Actualizar campo de contenido).
El formulario conserva textos iniciales y modifica solo esa copia. Aplicar a la
sección incorpora el cambio al borrador; Guardar lo envía por el flujo BFF existente.
Secciones no permite rediseñar módulos: solo los campos que expuso el creador.
El diseño y CSS del módulo se trabajan en Módulos. Los contenedores de la sección
conservan sus controles propios de fondo, padding y distribución. Los módulos
sin campos expuestos se conservan sin edición de contenido.
[Evidencia y límites](docs/qa/cms-section-module-content-20261122.md).

En Secciones → Diseño, Espacios y módulos incluye controles junto a cada pieza:
↑/↓ ordenan, → entra en el contenedor anterior y ← sale un nivel. El tirador
permite arrastrar módulos o contenedores completos antes/después de otra pieza
o dentro de un contenedor. Papelera confirma la retirada y avisa si hay hijos.
Los movimientos quedan en el borrador hasta Guardar.
[QA y límites](docs/qa/cms-section-tree-controls-20261122.md).

Secciones alinea Distribución/Añadir contenedor y Biblioteca/Insertar copia en
filas horizontales (apiladas en móvil estrecho). Los contenedores ofrecen controles
estructurales, fondo y espaciado; la tipografía queda en el diseño del módulo.
Se retiran Mover a contenedor/Mover al final: organización por flechas o arrastre.

Secciones conecta árbol y preview mediante resaltado del área seleccionada.
Seleccionar área permite elegir una envoltura directamente y Mostrar límites
ayuda a distinguir contenedores. La caja CSS ofrece el selector real y acciones
para copiarlo o preparar una regla; los nodos internos del módulo no son destinos.
[QA y límites](docs/qa/cms-section-area-selection-20261122.md).

Plantillas ofrece «Crear nueva plantilla» como enlace a la derecha de los badges
Disponibles/Archivadas. Permite comenzar con una sección o página vacía y abrir
su diseño. Las pestañas de CMS comparten los badges de navegación, incluidos
dispositivos y ámbitos CSS.
[QA y límites](docs/qa/cms-template-create-and-tabs-20261122.md).

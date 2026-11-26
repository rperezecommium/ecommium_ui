# Activación de condiciones comerciales — 2026-11-18

## Resultado

Activación autorizada por Ricardo después del diagnóstico de solo lectura.
El perfil Admin real que mostraba el aviso ahora carga grupo, aprobación e
historial sin error. Se verificó con la sesión Employee existente, sin guardar
cambios en ese cliente. El historial devuelve0 cambios para ese perfil.

La causa tenía dos capas: faltaban credenciales/migraciones/activación y, al
resolverlas, se hizo visible un dato histórico `buyerType=PERSON`. Customers
adapta únicamente ese código observado a PRIVATE_BUYER al leer hechos comerciales;
no reescribe el perfil ni infiere grupos o aprobación. Otros códigos desconocidos
fallan explícitamente. UI mantiene validación canónica y diagnósticos de campos
incompatibles sin valores crudos ni trazas.

## Cambios y estado operativo

- Dos migraciones aditivas exactas, verificadas por checksum: Customers
  `20261112200000_commercial_membership` y Sessions
  `20261112200000_commercial_segmentation`. No se ejecutó migrate deploy sobre
  bases comerciales ni se aplicaron otras migraciones pendientes.
- Credenciales internas independientes en custodia privada del backend
  `.secrets/commercial-context/`0700; cuatro archivos0600. La UI recibe solo su
  flag, nunca secretos internos. Arranque y restart-selected cargan el archivo
  correspondiente al servicio; no sustituye una sesión Employee.
- Customers3007, Sessions3006, Checkout3003, BFF Storefront3025 y Admin3026
  reiniciados selectivamente por postman-services, health200. Se comprobaron
  presencia/longitud mínima de secretos y flags en procesos sin imprimir valores.
- Política guardada por UI→BFF con Employee real, derivación de actor y revisión:
  Organization11111111-1111-4111-8111-111111111111 /
  Shop22222222-2222-4222-8222-222222222222 (Tienda Barcelona).
  allowedGroups=[vip,b2b-pro], registeredGroup=null, b2bGroup=b2b-pro. Se reutilizan
  grupos activos existentes de Pricing. No hay asignación automática por compras
  ni nueva regla de importes.
- Nuevo historial paginado por BFF/Customers, limitado20 por defecto/100 máximo;
  fecha, actor, motivo, revisión y before/after de grupo/aprobación. El snapshot
  inicial no inventa un tipo comprador anterior que no almacena la auditoría.
- Configuración/Precios/Parámetros incluye política por scope y permisos. Al
  guardar conserva visualmente sus selecciones; el helper genérico mantiene su
  comportamiento anterior salvo opt-in resetOnSuccess=false de este formulario.
- El perfil omite pertenencia cuando grupo/aprobación no cambian: puede guardar
  datos personales conservando una asignación inactiva. Cambiar a otro grupo
  sigue requiriendo uno activo validado por BFF.
- Aprobación B2B exige Empresa, con validación de navegador y Server Action.
  Tipo comprador, grupo y aprobación permanecen separados.

## Validación

- `npm test`:712 PASS, sin omitidas, incluida regresión admin-login-action.
- `npm run build`: correcto, TypeScript incluido.
- `npm run lint`:0 errores/3 warnings anteriores ajenos al cambio funcional.
- Playwright `-g 'commercial profile'`:14 escenarios; asignación/cambio/retirada,
  creación, conflictos, fallos/recuperación, permisos, inactivos, B2B, política,
  auditoría/paginación y responsive desktop/tablet/mobile. Axe sin contraste por
  el pendiente transversal de tokens existente.
- Regresión adyacente Clientes/Pricing:3 PASS.
- Customers:25 pruebas focales; BFF:11. Builds y ESLint focalizado sin --fix.
- Laboratorio PostgreSQL/HTTP/Playwright: Customers/Sessions/Pricing reales en
  tres bases locales propias, BFF y sesiones firmadas, actor auditado, scope,
  permisos, paginación, rollback y carreras. Precios ordinario12100/VIP9680/B2B8470
  en datos QA explícitos. Checkout usa el grupo verificado, revalida carrito al
  retirar grupo e invalida datos de pago obsoletos. Se prueba recuperación de
  owner y revocación de sesión. Catalog/Inventory/Shop/identidad Employee son
  fixtures explícitas del laboratorio; no certifica esos owners o PSP reales.
- El laboratorio se adaptó al contrato vigente de contexto comercial explícito
  e inventario aislado; ya no consulta Inventory comercial desde el ensayo.
- Drawer móvil: el menú izquierdo se pliega mediante su control real antes de
  abrir el formulario. Se conserva el gate de selector>100px y visible dentro de
  viewport, así como el estándar compartido20–50%/default40%. No se relajaron
  límites ni tolerancias; los campos se adaptan al ancho disponible.

Logs locales: `.tmp/customer-commercial-{build,lint,all-tests,e2e,adjacent-e2e}.log`;
backend `/private/tmp/commercial-{customers,bff}-{build,tests,lint}.log` y
`/private/tmp/commercial-integrated.log`. Recibos sin secretos:
`.tmp/commercial-activation-migrations.json` y `commercial-activation-counts.json`.
El backend mantiene su contrato50, Postman y QA equivalente sincronizados.

## Reproducción

En UI:

```sh
npm run build
npm run lint
npm test
npx playwright test tests/e2e/admin-login.spec.ts -g 'commercial profile' --workers=1
```

En composable (Node22/npm10 para el arranque canónico):

```sh
./scripts/postman-services.sh restart-selected customers sessions checkout bff-storefront bff-admin
ECOMMIUM_UI_REPO=/Users/ricardoperez/Documents/ecommium_ui node scripts/pricing/test-customer-commercial-context.mjs
```

El segundo comando crea/elimina únicamente tres bases commercial_qa propias y
procesos propios. No ejecutar migrate deploy global para reproducir la activación
comercial: las dos migraciones ya tienen recibo APPLIED/checksum comprobado.

## Límites y reversión

No se hizo una compra/cobro ni se asignaron grupos a clientes comerciales.
La aplicación del precio y revalidación Checkout se certifica en laboratorio
SQL/HTTP; no se certifica una compra real completa, PSP, CDN, Lighthouse, carga o
el comportamiento de todas las rutas públicas personalizadas con un Customer
comercial. La política se verificó persistida con la sesión Admin real.

Reversión funcional: desactivar coordinadamente los tres flags UI/BFF/Checkout,
reiniciar los consumidores correspondientes y comprobar la vuelta al modo previo.
Conservar tablas, política, membresías y auditoría; no ejecutar DROP ni migraciones
inversas. Mantener credenciales si Admin debe seguir leyendo la pertenencia;
rotación/revocación se coordina entre BFF/Sessions/Customers conforme a la custodia
138 del backend. No revocar sesiones Employee ni alterar precios históricos.

Se preservan los hallazgos pendientes de seguridad. No se certifica producción
ni una migración general de tipos comprador históricos distintos de PERSON.

## Simplificación del perfil y consulta de auditoría

Se elimina el textarea «Motivo del cambio comercial» y la consulta embebida del
historial en el perfil (incluida la vista de solo lectura). La Server Action usa
la descripción automática «Asignación manual desde el perfil Admin» e ignora un
motivo añadido manualmente al FormData. Se conservan revisión, validación de
aprobación B2B y resumen del cambio antes de guardar.

La nueva pantalla `/admin/logs` consulta la auditoría comercial existente del
cliente seleccionado mediante el mismo endpoint BFF paginado. Sidebar y pantalla
exigen lectura de clientes; la pestaña Actividad tiene acceso directo con el
cliente preseleccionado. Muestra fecha, ID de empleado, operación, grupo y
aprobación anterior/nueva y revisión. No duplica registros, no cambia contratos,
no elimina auditoría histórica ni introduce escrituras de negocio fuera del BFF.
La consulta es por cliente; no es un agregador global de todos los servicios.

Validación: `npm test` (712/712), `node --test tests/customers-admin.test.mjs`
(27/27), `npm run build` y `npm run lint` (0 errores, 3 warnings previos).
Playwright `admin-login.spec.ts -g 'commercial profile'` (14/14): guardado,
conflictos, lectura, paginación en Logs, accesibilidad y responsive. Regresión adicional de
acceso denegado a Logs sin `customers.read`: 1/1, total 15 casos E2E aprobados.
Esta iteración valida UI con BFF de prueba; no realiza mutaciones de clientes
reales ni vuelve a ejecutar el laboratorio SQL de la activación anterior.

# Security backlog de `ecommium_ui`

2026-11-19 — Publicación Header/Footer: la UI guarda la composición antes de
publicar, comprueba identidad del recibo y detiene la publicación si falla el
guardado. Los errores conservan el estado local; Employee, cookies HttpOnly,
permisos y contexto BFF no cambian. No cierra hallazgos previos ni acredita
atomicidad o concurrencia. Pruebas y límites:
`docs/qa/cms-site-parts-publish-20261119.md`.

> Estado general: **pendiente de remediacion**  
> Ultima auditoria: **2026-08-04**  
> Alcance auditado: repositorio UI `ecommium_ui`; no incluye codigo del BFF, infraestructura, CDN/WAF ni configuracion de despliegue.

## Proposito y regla de lectura

Este documento conserva los gaps de seguridad confirmados durante la auditoria defensiva del repositorio. Forma parte del orden de lectura obligatorio definido en `AGENTS.md`.

Antes de modificar autenticacion, sesiones, contexto multitenant, clientes BFF, Route Handlers, Storefront, checkout, pagos, media, facturas o configuracion de Next.js:

1. Leer este documento completo.
2. Identificar los hallazgos afectados por el cambio.
3. Evitar ampliar o reintroducir los riesgos pendientes.
4. Actualizar el estado solo después de implementar la correccion y aportar pruebas.

No marcar un hallazgo como resuelto por ocultar una accion en la UI. La autorizacion debe validarse en el borde servidor/BFF correspondiente.

## Resumen ejecutivo

La auditoria encontro:

- 2 riesgos criticos condicionados a que `ECOMMIUM_ADMIN_BFF_TOKEN` exista en el servidor.
- 5 riesgos altos en autenticacion indirecta, XSS, pagos, dependencias, tenant isolation y media.
- Varios riesgos medios de sesiones, validacion, exposicion de errores, analytics, cabeceras y resiliencia.

El repositorio no debe considerarse listo para exposicion publica hasta corregir como minimo `SEC-001` a `SEC-004` y verificar el estado real de `ECOMMIUM_ADMIN_BFF_TOKEN` en todos los entornos desplegados.

## Convenciones de estado

- `PENDIENTE`: confirmado en el codigo y sin correccion verificada.
- `CONDICIONAL`: el codigo contiene el gap, pero la explotabilidad depende del BFF o de infraestructura no auditada.
- `EN PROGRESO`: existe una correccion incompleta o todavia no validada.
- `RESUELTO`: correccion implementada, revisada y cubierta por pruebas.
- `ACEPTADO`: riesgo aceptado explicitamente, con responsable, justificacion y fecha de revision.

## P0 — Accion inmediata

### SEC-001 — Cookie Admin no autenticada combinada con bearer tecnico

- Severidad: **CRITICA** si `ECOMMIUM_ADMIN_BFF_TOKEN` esta configurado.
- Estado: **RESUELTO**.
- Evidencia:
  - `src/shared/auth/session.ts:35-70`: parsea JSON de cookie sin firma y confia en identidad, scope y permisos; valores invalidos pueden caer a `EMPLOYEE` y `admin`.
  - `src/shared/auth/admin-bearer.ts:7-12`: considera utilizable una sesion sin access token cuando existe el bearer global.
  - `src/modules/auth/admin-session-actions.ts:241-254`: puede devolver esa sesion sin validarla mediante `/auth/me`.
  - `app/(admin)/admin/layout.tsx:15-19`: solo comprueba que la sesion no sea nula.
  - `src/shared/bff/client.ts:12-20`: sustituye la ausencia de token de sesion por `ECOMMIUM_ADMIN_BFF_TOKEN`.
- Impacto: una peticion puede autoatribuirse una identidad o permisos Admin y hacer que el servidor use su credencial tecnica privilegiada.
- Correccion requerida:
  1. Eliminar el fallback al token tecnico de cualquier request iniciado por usuario.
  2. Prohibir el token tecnico en produccion o aislarlo en un flujo de desarrollo imposible de activar accidentalmente.
  3. Sustituir la cookie JSON por una sesion opaca server-side o una cookie autenticada/cifrada con rotacion de claves.
  4. Aplicar un guard comun `requireAdminSession(permission)` en layouts, Server Actions y Route Handlers.
  5. Exigir `scope=admin`, principal `ADMIN|EMPLOYEE` y validacion vigente mediante `/auth/me`.
- Criterio de cierre:
  - Una cookie fabricada o alterada nunca autentica al usuario.
  - Una sesion sin access token no provoca el uso de un bearer global.
  - Tests negativos cubren cookie manipulada, scope Customer, principal invalido y permisos revocados.

Resolucion:
- Estado: RESUELTO
- Fecha: 2026-08-07
- Cambio: la cookie Admin queda autenticada mediante HMAC SHA-256 con `ECOMMIUM_UI_ADMIN_SESSION_SECRET` (mínimo 32 caracteres), admite solo sesiones `EMPLOYEE/admin` con access token y falla cerrada si falta o se altera la firma. `ECOMMIUM_UI_ADMIN_SESSION_PREVIOUS_SECRET` permite rotar la clave sin invalidar inmediatamente la sesión activa. El cliente Admin, la carga de contexto y la renovación ya no utilizan `ECOMMIUM_ADMIN_BFF_TOKEN`; la sesión local que lo usaba se retira.
- Pruebas: `node --test tests/admin-session-cookie.test.mjs tests/admin-bearer.test.mjs tests/bff-headers.test.mjs tests/admin-bff-client.test.mjs tests/admin-route-access.test.mjs tests/admin-resource-proxies.test.mjs` cubre firma, manipulación, ausencia de secreto, rotación, bearer ausente y el rechazo del token técnico.
- Riesgo residual: configurar y custodiar `ECOMMIUM_UI_ADMIN_SESSION_SECRET` en todos los entornos; las cookies anteriores sin firma obligarán a iniciar sesión de nuevo.

Resolucion complementaria:
- Estado: RESUELTO
- Fecha: 2026-08-11
- Cambio: la cookie Admin firmada persiste una sesión compacta y deja de duplicar `roles` y `permissions` fuera del access token. Al leerla, la UI reconstruye esos metadatos desde los claims del bearer para navegación/gating superficial, mientras el BFF sigue validando identidad y permisos reales.
- Pruebas: `node --test tests/admin-session-cookie.test.mjs tests/admin-login-action.test.mjs`, suite ampliada de auth/guards y validación visible Playwright contra `/admin`.
- Riesgo residual: si en el futuro el bearer emitido por Sessions crece por encima del límite de cookie del navegador, habrá que migrar a sesión opaca server-side; la prueba de regresión cubre la duplicación actual.

### SEC-002 — Proxies Admin sin autenticacion y permiso explicitos

- Severidad: **CRITICA/ALTA**, condicionada al bearer tecnico.
- Estado: **RESUELTO**.
- Evidencia:
  - `src/shared/config/admin-context.ts:48-65`: acepta contexto legacy no firmado y sin principal.
  - `app/api/admin/media-assets/[mediaAssetId]/content/route.ts:26-49`: no exige employee ni permiso y usa `token ?? adminBffToken`.
  - `app/(admin)/admin/pagos/invoices/[invoiceId]/document/route.ts:50-72`: mismo patron para facturas.
- Impacto: una peticion directa con contexto fabricado e identificador conocido puede hacer que el servidor recupere documentos usando su credencial privilegiada. Los Route Handlers no heredan la proteccion del layout.
- Correccion requerida:
  1. Validar sesion employee y permiso especifico dentro de cada handler.
  2. Obtener Organization/Shop desde contexto autorizado por el BFF, no desde una cookie no autenticada.
  3. Eliminar el bearer tecnico de ambas rutas.
  4. Añadir respuestas uniformes `401`, `403` y `404` que no permitan enumeracion.
- Criterio de cierre: tests de integracion demuestran que solicitudes anonimas, cookies alteradas, tenant cruzado y permisos insuficientes no recuperan contenido.

Resolucion:
- Estado: RESUELTO
- Fecha: 2026-08-07
- Cambio: ambos Route Handlers aplican `requireAdminRouteAccess`, que valida el bearer de la cookie contra `/auth/me`, exige principal `EMPLOYEE` con `scope=admin`, permiso `media.assets.write` o `invoices.manage` y limita el contexto al listado autorizado por `/admin/context/available`. El proxy usa después ese bearer explícito y no puede caer a `ECOMMIUM_ADMIN_BFF_TOKEN`.
- Pruebas: `node --test tests/admin-route-access.test.mjs tests/admin-resource-proxies.test.mjs tests/admin-bff-client.test.mjs` cubre ausencia de bearer, Customer, permiso insuficiente, tenant cruzado, bloqueo del handler antes de alcanzar BFF y propagación exclusiva del bearer Employee.
- Riesgo residual: el BFF sigue siendo la autoridad final de permisos y pertenencia de cada recurso.

### SEC-003 — XSS almacenado potencial en rich text de PDP

- Severidad: **ALTA**.
- Estado: **EN PROGRESO**.
- Evidencia: el PDP y el preview Admin renderizan HTML enriquecido mediante `dangerouslySetInnerHTML`; esta capa necesita una política de saneado común y defensa en el BFF.
- Impacto: HTML malformado puede eludir un sanitizador regex y ejecutar codigo en el origen publico, con acceso a estado de navegador y capacidad de realizar acciones same-origin.
- Correccion requerida:
  1. Usar un sanitizador basado en parser y mantenido, con allowlist estricta de tags, atributos y protocolos.
  2. Sanear en el borde servidor/BFF y mantener defensa adicional antes de renderizar.
  3. Compartir una unica politica de saneado entre preview Admin y Storefront.
  4. Añadir CSP y pruebas adversariales de mXSS, SVG, entidades, atributos y protocolos.
- Criterio de cierre: corpus de payloads XSS no produce nodos, atributos ni URLs activas y no existe saneado HTML basado unicamente en regex.

Resolucion parcial de UI:
- Estado: EN PROGRESO
- Fecha: 2026-08-07
- Cambio: `sanitize-html` aporta una política única, basada en parser y allowlist, para el preview Admin de producto y el PDP Storefront. Solo permite tags/atributos mínimos, elimina SVG/MathML, estilos, eventos y contenido activo, y limita enlaces a rutas locales, anclas, HTTPS, `mailto:` o `tel:` sin credenciales.
- Pruebas: `node --test tests/rich-text-sanitizer.test.mjs` cubre script, SVG, MathML, mXSS, URLs activas, atributos de evento y HTML permitido.
- Pendiente para cierre: el BFF debe mantener saneamiento equivalente antes de persistir o servir contenido rico, y la CSP se implementará en el endurecimiento de cabeceras (7/7).

### SEC-004 — URL de redireccion de pago no validada

- Severidad: **ALTA**.
- Estado: **RESUELTO**.
- Evidencia:
  - `src/modules/storefront/payments.ts`: normalizaba `redirectUrl` como cualquier string devuelto por el BFF/proveedor.
  - `src/modules/storefront/checkout-client.tsx`: entrega una URL ya validada a `window.location.assign`.
- Impacto: phishing, redireccion a un dominio controlado o ejecucion de esquemas activos si un upstream devuelve una URL maliciosa.
- Correccion requerida:
  1. Parsear con `new URL` y rechazar errores de normalizacion.
  2. Permitir unicamente `https:`.
  3. Aplicar allowlist exacta de hosts PSP por proveedor y entorno.
  4. Rechazar credenciales embebidas, caracteres de control y hosts ambiguos.
- Criterio de cierre: tests rechazan `javascript:`, `data:`, HTTP, dominios parecidos, userinfo, controles, URLs relativas y hosts no configurados.

Resolucion:
- Estado: RESUELTO
- Fecha: 2026-08-07
- Cambio: el checkout valida dos veces la URL antes de redirigir: solo HTTPS, sin puerto, credenciales ni caracteres de control y con host exacto autorizado por proveedor (`www.paypal.com`, `www.sandbox.paypal.com` o `checkout.stripe.com`).
- Pruebas: `node --test tests/storefront-payments.test.mjs tests/storefront-checkout-context.test.mjs` cubre esquemas activos, HTTP, hosts parecidos, userinfo, puertos, controles, rutas relativas y cruce de proveedor.
- Riesgo residual: ampliar la integración a un PSP nuevo requiere declarar y probar su allowlist antes de habilitar redirecciones.

## P1 — Riesgos altos

### SEC-005 — Dependencias con vulnerabilidades altas

- Severidad: **ALTA**.
- Estado: **RESUELTO** para dependencias de producción; revisar periódicamente el audit.
- Evidencia obtenida el 2026-08-04:
  - `npm audit --omit=dev`: 3 paquetes de produccion con severidad alta.
  - Next `16.2.9`, incluyendo advisories aplicables al uso de Proxy y Server Actions.
  - PostCSS `8.5.15`, fijado en `package.json:30-32` mediante override.
  - Sharp `0.34.5`.
  - El audit completo añadio `brace-expansion` y `js-yaml` como dependencias de desarrollo altas.
- Referencias observadas:
  - <https://github.com/advisories/GHSA-6gpp-xcg3-4w24>
  - <https://github.com/advisories/GHSA-m99w-x7hq-7vfj>
  - <https://github.com/advisories/GHSA-89xv-2m56-2m9x>
  - <https://github.com/advisories/GHSA-p9j2-gv94-2wf4>
- Correccion requerida: actualizar a versiones corregidas compatibles, regenerar el lockfile y revisar el diff. El audit sugirio Next `16.3.0`, PostCSS `>=8.5.23` y Sharp `>=0.35.0` en la fecha de revision; confirmar de nuevo antes de implementar.
- Criterio de cierre: `npm audit --omit=dev` sin vulnerabilidades altas/criticas no aceptadas, instalacion limpia con `npm ci`, lint, tests y build correctos.

Resolucion:

- Estado: RESUELTO (produccion)
- Fecha: 2026-08-07
- Cambio: el manifiesto y lockfile fijan Next `16.3.0` y el override de PostCSS `8.5.23`; su arbol transitivo instala Sharp `0.35.3`. No se aplico `npm audit fix --force`.
- Pruebas: `npm ci` reinstala 422 paquetes desde el lockfile; `npm audit --omit=dev --json` devuelve 0 vulnerabilidades; `npm ls next postcss sharp --all` confirma las versiones corregidas. `npm run lint` no da errores.
- Riesgo residual: `npm audit --json` reporta dos vulnerabilidades altas solo en herramientas de desarrollo (`brace-expansion` y `js-yaml`). La simulacion de `npm audit fix --dry-run` propone actualizarlas, pero también reescribe muchas dependencias binarias opcionales; queda pendiente revisarlo como cambio de supply chain acotado. La suite y build completos siguen bloqueados por fallos de test/tipos preexistentes fuera de SEC-005.

### SEC-006 — Storefront falla abierto hacia contexto Admin o tenant fixture

- Severidad: **ALTA**.
- Estado: **RESUELTO**.
- Evidencia:
  - `src/modules/storefront/storefront-context.ts:13-52`: hereda defaults Admin y finalmente usa UUID hardcodeados.
  - `src/modules/storefront/pdp.ts:107-125`: resolucion duplicada.
  - `app/checkout/confirmation/page.tsx:15-19,88-103`: resolucion duplicada en confirmacion.
  - `src/shared/config/env.ts:1-20`: bases BFF con fallback silencioso a HTTP localhost y sin schema runtime.
- Impacto: una configuracion incompleta puede servir, consultar o mutar el tenant equivocado.
- Correccion requerida:
  1. Crear schema runtime de entorno Storefront y fallar al arrancar en produccion si falta contexto.
  2. No heredar `ECOMMIUM_DEFAULT_*` de Admin.
  3. Permitir fixtures solo bajo modo de desarrollo explicito.
  4. Exigir HTTPS fuera de desarrollo.
  5. Validar que el tenant de la sesion Customer coincide con el contexto activo.
- Criterio de cierre: una configuracion incompleta de produccion impide arrancar y no existe fallback a un tenant real/fixture.

Resolucion:

- Estado: RESUELTO
- Fecha: 2026-08-07
- Cambio: `storefront-env` valida en runtime la URL BFF, Organization y Shop exclusivos de Storefront; rechaza URL no HTTPS en producción, no usa `ECOMMIUM_DEFAULT_*` de Admin y solo habilita el fixture con `ECOMMIUM_UI_ALLOW_STOREFRONT_FIXTURES=true` bajo desarrollo. PDP y confirmación de checkout consumen el contexto común. Una sesión Customer sin el mismo `organizationId` y `shopId` se rechaza antes de reutilizar o persistir su bearer.
- Pruebas: `node --test tests/storefront-context.test.mjs tests/storefront-bff-client.test.mjs tests/storefront-plp.test.mjs tests/storefront-account.test.mjs` cubre ausencia de contexto, aislamiento de defaults Admin, fixture explícito, HTTPS en producción y tenant cruzado de sesión Customer.
- Riesgo residual: el BFF conserva la autorización definitiva del bearer y debe rechazar igualmente cualquier contexto o recurso de otro tenant.

### SEC-007 — Upload y servido de contenido activo bajo el origen Admin

- Severidad: **ALTA** si el BFF acepta HTML, SVG o polyglots.
- Estado: **CONDICIONAL**; requiere validar el contrato/comportamiento del BFF sin modificar su repo por iniciativa propia.
- Evidencia:
  - `src/modules/catalogo/media-admin-actions.ts:49-98`: acepta archivos no vacios sin allowlist, magic bytes, limite individual ni cantidad.
  - `src/modules/catalogo/media-admin-page.tsx:351-354,482-485`: inputs sin restriccion efectiva a tipos seguros.
  - `app/api/admin/media-assets/[mediaAssetId]/content/route.ts:51-75`: refleja `Content-Type` y bytes sin `nosniff` ni descarga forzada para tipos desconocidos.
  - `src/modules/configuracion/communications-admin-actions.ts:302-323`: confia en `File.type`, controlable por el cliente.
- Impacto: contenido activo subido por un usuario puede ejecutarse desde el mismo origen Admin.
- Correccion requerida: allowlist exacta, comprobacion de firma binaria, limites de bytes/cantidad/dimensiones, normalizacion de nombre, rechazo o saneado robusto de SVG y revalidacion obligatoria en BFF. Servir desconocidos como `application/octet-stream; attachment` y añadir `X-Content-Type-Options: nosniff`.
- Criterio de cierre: tests rechazan HTML, SVG activo, MIME falso, polyglots, archivos sobredimensionados y nombres maliciosos; el BFF confirma la misma politica.

Resolución parcial de UI:
- Estado: EN PROGRESO
- Fecha: 2026-08-07
- Cambio: la UI acepta exclusivamente JPG, PNG y WebP con firma binaria coherente, limita cada archivo a 8 MB y cada envío a 12, normaliza el nombre y limita los selectores de archivo. El proxy de Admin añade `nosniff`, limita la respuesta y solo sirve esos tipos inline; cualquier otro contenido se descarga como binario.
- Pruebas: `node --test tests/media-upload-security.test.mjs tests/admin-resource-proxies.test.mjs` cubre SVG/HTML, MIME falseado, lote excesivo, normalización y descarga forzada.
- Pendiente para cierre: el BFF debe imponer la misma política, validar dimensiones/decodificación y rechazar polyglots antes de persistirlos.

## P2 — Riesgos medios y hardening

### SEC-008 — Logout Customer no revoca la sesion remota

- Severidad: **MEDIA**.
- Estado: **PENDIENTE**.
- Evidencia:
  - `src/modules/storefront/storefront-account-actions.ts:350-353`: solo elimina cookie local.
  - `src/modules/storefront/storefront-account.ts:554-585`: ya existe una operacion BFF de revocacion que el logout habitual no usa.
- Correccion requerida: todos los logout deben revocar la sesion actual y limpiar la cookie en `finally`. Probar que el token previo deja de ser valido.

Resolución de UI:
- Estado: RESUELTO
- Fecha: 2026-08-07
- Cambio: el logout habitual llama primero a `/auth/sessions/logout-current` mediante el flujo Customer existente y limpia siempre la cookie local en `finally`, incluso si el BFF no está disponible.
- Pruebas: `node --test tests/storefront-account.test.mjs` verifica que el flujo usa la operación de revocación remota existente.
- Riesgo residual: el BFF sigue siendo responsable de invalidar el bearer ya emitido y de cubrirlo con una prueba de integración.

### SEC-009 — Mensajes crudos del BFF expuestos al navegador

- Severidad: **MEDIA**.
- Estado: **PENDIENTE**.
- Evidencia: `src/shared/bff/request-client.ts:24-41,103-130` conserva mensajes/cuerpos crudos; rutas como `app/api/storefront/cart/route.ts:90-92` y `app/account/invoices/[invoiceId]/document/route.ts:65-68` los devuelven.
- Correccion requerida: mapear status/codigos a mensajes publicos, limitar bytes de error, registrar detalle redacted solo en servidor y devolver correlation ID.

Resolución de UI:
- Estado: RESUELTO
- Fecha: 2026-08-07
- Cambio: el cliente BFF central asigna mensajes públicos por código HTTP y ya no lee ni propaga cuerpos, errores de parseo o excepciones crudas del upstream; conserva el `correlationId` para diagnóstico.
- Pruebas: `node --test tests/storefront-bff-client.test.mjs` comprueba que un detalle sensible del BFF no llega al resultado público.

### SEC-010 — Payloads abiertos, limites insuficientes y proteccion CSRF incompleta

- Severidad: **MEDIA**.
- Estado: **PENDIENTE**.
- Evidencia:
  - `app/api/storefront/checkout/route.ts:112-198`.
  - `app/api/storefront/payments/transactions/route.ts:74-95`.
  - `app/api/storefront/cart/items/route.ts:68`.
  - `app/api/storefront/search/events/route.ts:31-49`.
  - `next.config.ts:4-7`: limite global de Server Actions de 12 MB.
- Correccion requerida: schemas estrictos de request y response, rechazo de claves desconocidas, longitudes/profundidad/cantidad maximas, `Content-Type` obligatorio, limites de cuerpo y guard comun de `Origin`/Fetch Metadata. Mantener la autorizacion final en el BFF.

Resolución parcial de UI:
- Estado: EN PROGRESO
- Fecha: 2026-08-07
- Cambio: el endpoint de eventos de búsqueda ahora exige JSON, valida origen/Fetch Metadata, limita el cuerpo a 32 KB, rechaza claves y tipos de evento no permitidos, limita cadenas y elementos, y fija el tenant al contexto Storefront activo.
- Pendiente para cierre: aplicar el mismo helper y schemas específicos a checkout, pagos, carrito y todas las respuestas BFF.

### SEC-011 — Analytics de compra manipulables desde query string

- Severidad: **MEDIA**.
- Estado: **PENDIENTE**.
- Evidencia:
  - `app/checkout/confirmation/page.tsx:41-103`: construye revenue, tax, cost, transaction y productos desde parametros controlables.
  - `src/modules/storefront/purchase-complete-client.tsx:26-45`: envia el evento.
- Impacto: contaminacion de metricas y automatizaciones mediante eventos de compras falsas.
- Correccion requerida: generar `purchase-complete` en servidor/BFF desde una orden pagada verificada, con idempotencia, schema estricto y rate limiting.

Resolución parcial de UI:
- Estado: EN PROGRESO
- Fecha: 2026-08-07
- Cambio: la confirmación de checkout ya no construye ni envía `purchase-complete` a partir de `revenue`, productos, impuesto, coste o moneda de la query string; el endpoint público tampoco admite ese tipo de evento.
- Pruebas: `node --test tests/storefront-plp.test.mjs` comprueba la ausencia de los campos manipulables en la página de confirmación.
- Pendiente para cierre: el BFF debe emitir el evento desde una orden pagada verificada, con idempotencia y rate limit. La métrica de compras queda temporalmente desactivada hasta disponer de ese contrato seguro.

### SEC-012 — Cabeceras de seguridad ausentes en el repositorio

- Severidad: **MEDIA**; puede estar parcialmente mitigado por la plataforma, no auditada.
- Estado: **PENDIENTE**.
- Evidencia: `next.config.ts:3-9` no define CSP, `frame-ancestors`, `nosniff`, Referrer-Policy ni Permissions-Policy.
- Correccion requerida:
  - CSP con nonce y allowlist minima compatible con Turnstile y proveedores necesarios.
  - `frame-ancestors 'none'` o politica explicita.
  - `X-Content-Type-Options: nosniff`.
  - Referrer-Policy restrictiva.
  - Permissions-Policy minima.
  - `poweredByHeader: false`.
  - HSTS en el terminador TLS.
- Criterio de cierre: verificar cabeceras efectivas sobre Admin, Storefront, auth, media y documentos en el entorno desplegado.

Resolución parcial de UI:
- Estado: EN PROGRESO
- Fecha: 2026-08-07
- Cambio: Next aplica CSP con fuentes mínimas para la propia UI y Turnstile, bloquea framing y objetos, desactiva `X-Powered-By`, añade `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options` y HSTS. El límite global de Server Actions baja a 10 MB.
- Pruebas: `node --test tests/security-hardening.test.mjs` comprueba la configuración declarada.
- Pendiente para cierre: validar las cabeceras efectivas tras CDN/terminador TLS y sustituir `script-src 'unsafe-inline'` por nonces compatibles con Next antes de retirar esa compatibilidad temporal.

### SEC-013 — Tokens de reset/activacion en URL y frontera Admin fail-open

- Severidad: **MEDIA**.
- Estado: **PENDIENTE**.
- Evidencia:
  - `app/auth/password-reset/page.tsx:7-11` y `src/modules/storefront/password-reset-client.tsx:16-26,47-49`.
  - `app/auth/activate/page.tsx:8-20` y `src/modules/storefront/storefront-activation-form.tsx:42-44`.
  - `src/modules/auth/auth-session-payload.ts:158-160` permite Customer/storefront.
  - `src/shared/auth/session.ts:57-63` usa defaults permisivos ante principal/scope invalidos.
- Correccion requerida: intercambiar secretos de URL inmediatamente por nonce HttpOnly de vida corta y redirigir a URL limpia; redaccion de logs y `no-referrer`. Hacer parsing de sesion fail-closed y persistir permisos actualizados de `/auth/me`.

Resolución parcial de UI para credenciales Admin:
- Estado: EN PROGRESO
- Fecha: 2026-08-14
- Cambio: la recuperación Admin usa `/auth/admin/password-recovery/consume` como
  Route Handler técnico. Extrae el token de la URL, lo firma en una cookie
  HttpOnly de 15 minutos limitada al flujo, responde `no-store` y
  `Referrer-Policy: no-referrer`, y redirige a un formulario sin token. Ningún
  componente cliente ni almacenamiento web recibe ese secreto. El BFF sigue
  siendo quien invalida/consume el token de un solo uso.
- Pruebas: `node --test tests/admin-credentials-ui.test.mjs` cubre las rutas,
  cookie firmada, limpieza de URL, no-store, no-referrer y el bloqueo
  `MUST_CHANGE_PASSWORD`.
- Pendiente para cierre: aplicar el mismo patrón a la recuperación y activación
  Customer existentes, y sustituir el token sellado por un nonce verdaderamente
  opaco cuando el contrato BFF exponga un intercambio de token seguro.

### SEC-014 — IP de cliente falsificable y anti-bot fail-open

- Severidad: **MEDIA**, dependiente del ingress y rate limiting BFF.
- Estado: **CONDICIONAL**.
- Evidencia:
  - `src/modules/storefront/storefront-auth-actions.ts:108-116`: reenvia `x-forwarded-for`, `cf-connecting-ip` y `x-real-ip` recibidos.
  - `src/modules/storefront/storefront-human-verification.ts:5-16`: cualquier configuracion distinta de `turnstile` desactiva la verificacion.
- Correccion requerida: confiar en un unico header generado por un proxy conocido, impedir acceso directo, validar Turnstile server-side en BFF y fallar cerrado en produccion. El flag publico solo debe controlar el widget.

### SEC-015 — Falta de limites y resiliencia en proxies BFF

- Severidad: **MEDIA**.
- Estado: **PENDIENTE**.
- Evidencia:
  - `proxy.ts:12-35,82-92`: consulta el BFF para cualquier path publico desconocido.
  - `src/shared/bff/request-client.ts:103-108`: llamadas sin timeout explicito.
  - Descargas de media/factura cargan respuestas completas mediante `arrayBuffer()` sin tope.
- Correccion requerida: limites de path y respuesta, `AbortSignal.timeout`, streaming cuando aplique, cache negativa, rate limit y circuit breaker para resolucion publica.

Resolución parcial de UI:
- Estado: EN PROGRESO
- Fecha: 2026-08-07
- Cambio: todas las llamadas BFF comparten un timeout de 15 segundos; el proxy público rechaza rutas, query strings y profundidades excesivas antes de consultar BFF; media y las facturas limitan respuestas binarias a 8 MB y 10 MB respectivamente.
- Pruebas: `node --test tests/security-hardening.test.mjs tests/admin-resource-proxies.test.mjs` cubre la configuración y los límites del proxy media.
- Pendiente para cierre: streaming para documentos grandes, cache negativa/rate limit/circuit breaker coordinados en CDN/BFF y observabilidad de timeouts.

### SEC-016 — URLs externas secundarias sin politica comun

- Severidad: **BAJA/MEDIA**.
- Estado: **PENDIENTE**.
- Evidencia:
  - `src/modules/storefront/order-tracking-page.tsx:107`: URL de seguimiento sin validacion estricta de protocolo/host.
  - `src/modules/storefront/storefront-auth-actions.ts:59-65`: redirect local no rechaza barras inversas y controles como lo hace `public-path.ts`.
- Correccion requerida: helper unico para URLs externas e internas; HTTPS y allowlist cuando exista un conjunto de proveedores conocido; origen exacto para redirects locales.

### SEC-017 — Evidencia Storefront serializada como Base64

- Severidad: **ALTA** antes del cierre de ADR-0157; el binario ampliaba el
  payload JSON, confiaba en metadatos controlables por el navegador y no era
  compatible con el contrato de cuarentena multipart.
- Estado: **EN PROGRESO**.
- Evidencia previa: `src/modules/storefront/storefront-account-actions.ts`
  convertía el `File` a `contentBase64` y `src/modules/storefront/storefront-account.ts`
  lo reenviaba como JSON.

Resolución parcial de UI:

- Fecha: 2026-08-19.
- Cambio: la Server Action valida nombre, tipo exacto, tamaño máximo de 10 MiB
  y firma JPEG/PNG/WebP antes de construir un `FormData` con solo `file`,
  `idempotencyKey` y `messageId` opcional. No fija `Content-Type`, por lo que
  `fetch` genera el boundary multipart; no se crea Route Handler bajo `app/api`
  ni se accede a Media/bucket. La lectura es una ruta técnica autenticada de Mi
  cuenta que solo reenvía el binario del BFF y entrega JPEG con `private,
  no-store`, `nosniff` y `no-referrer`. La UI informa el límite de 15 imágenes
  por caso y usa estados públicos para rechazo, cuota o indisponibilidad. El
  límite de Server Actions deja 64 KiB de envoltura sobre los 10 MiB de binario,
  mientras BFF sigue imponiendo el máximo definitivo.
- Pruebas: `node --test tests/storefront-account.test.mjs`, `npm run lint` y
  `npm run build` en verde; lint conserva tres warnings preexistentes ajenos.
- Pendiente para cierre: pruebas de abuso/IDOR de contrato en 6/8 y certificación
  Playwright visible contra BFF/Media/ClamAV reales en 7/8. El rollout BFF
  permanece `DISABLED` hasta entonces.

## Supply chain y proceso pendientes

- `packageManager` fija npm `10.9.2` y `engines` acota Node/npm; el workflow `supply-chain` ejecuta `npm ci`, audit de producción y lint en cada PR y push a `main`.
- Añadir CI con `npm ci`, lint, tests, build, audit de produccion con excepciones versionadas, dependency review, secret scanning, SAST y SBOM.
- Verificar desde instalacion limpia; durante la auditoria `npm ls` detecto `@emnapi/runtime@1.11.1` como extraneous local.
- No ejecutar `npm audit fix --force` sin revisar cambios de version y comportamiento.

## Controles positivos observados

- Storefront usa el cliente y base BFF dedicados; no se encontro uso residual del token Admin en su cliente comun.
- El flujo Admin implementa intento de refresh ante `401/403` antes de cerrar la sesion.
- Cookies de tokens usan `HttpOnly`, `SameSite=Lax` y `Secure` en produccion.
- No se encontraron tokens almacenados en `localStorage`.
- Los redirects publicos derivados del BFF tienen validaciones basicas de ruta local.
- El preview HTML de plantillas email usa iframe con `sandbox` vacio.
- No se encontraron secretos reales mediante la busqueda regex basica del arbol e historial reciente.

Estos controles no neutralizan los hallazgos pendientes y deben preservarse durante las correcciones.

## Evidencia de la auditoria inicial

- `npm audit --omit=dev --json`: fallo por 3 paquetes de produccion con severidad alta.
- `npm audit --json`: 5 paquetes con severidad alta al incluir desarrollo.
- `npm test`: termino con un fallo preexistente no relacionado con seguridad en `tests/orders-admin.test.mjs:105`, que esperaba `/admin/pagos?invoiceId=`.
- Busqueda regex basica de secretos: sin hallazgos; no equivale a una auditoria completa con Gitleaks/TruffleHog ni cubre secretos externos.
- No se realizaron pruebas destructivas, explotacion contra entornos ni cambios en el backend.

## Orden recomendado de remediacion

1. Confirmar en secreto si `ECOMMIUM_ADMIN_BFF_TOKEN` existe en cualquier despliegue. No imprimir su valor. Si existe, restringir Admin, rotarlo y retirar el fallback.
2. Corregir `SEC-001` y `SEC-002`, con pruebas negativas de autenticacion, permisos y tenant isolation.
3. Corregir `SEC-003` y `SEC-004` antes de exponer contenido rico o pagos reales.
4. Actualizar dependencias de `SEC-005` y ejecutar instalacion limpia, tests y build.
5. Hacer fail-closed el contexto Storefront (`SEC-006`).
6. Cerrar media activa, schemas, errores, analytics y logout.
7. Aplicar cabeceras, limites, timeouts y controles de supply chain.

## Plantilla para actualizar un hallazgo

Al cambiar un estado, añadir debajo del hallazgo:

```text
Resolucion:
- Estado: RESUELTO | ACEPTADO
- Fecha: YYYY-MM-DD
- Commit/PR: identificador
- Cambio: resumen concreto
- Pruebas: comandos y resultado
- Riesgo residual: descripcion o ninguno conocido
```

No borrar el historial del hallazgo. Si reaparece, volver a `PENDIENTE` y documentar la regresion.

## O15 — paquete de despliegue, 2026-10-20

Se conserva el estado de los hallazgos existentes. El contenedor nuevo falla cerrado ante ausencia/conflicto de contexto, BFF sin HTTPS, secreto de cookie menor de32 o bearer técnico/fixture/credencial Google en su entorno. Build por allowlist sin .env ni credenciales; usuario node. Cookie sólo en runtime y, en Cloud Run, por referencia versionada de Secret Manager. Pruebas nuevas de preflight y regresión admin-login20 PASS; lint0 errores/3 advertencias; build AMD64 y health/formulario login PASS. No certifica permisos mínimos de una cuenta Google, exposición pública o autenticación funcional BFF; estos siguen pendientes del gate remoto. No se cierra ningún hallazgo de seguridad adicional por esta entrega.


### O15 — evaluación acotada de separación de hosts (2026-10-21)

Perfil SEPARATED_V1: host allowlist, rutas Admin/Storefront separadas, cabecera
Storefront de entrada descartada y contexto resuelto fijado al despliegue. Cookie
Admin httpOnly/Secure/host-only comprobada en integración real; provider público
sólo modo/site key. Fallo de contexto503 sin fixture y redirects con origen
configurado. Diez controles de integración y regresión497/Playwright4 PASS.
Esto no cierra otros hallazgos de autenticación ni acredita Cloudflare/MFA,
OAuth, Turnstile o exposición pública de producción. Pendientes anteriores se
conservan; no se interpreta esta nota como auditoría completa de seguridad.

### Consent — origen público detrás de proxy (2026-10-22)

Ajuste autorizado expresamente por Ricardo: Host exacto contra origen público
HTTPS configurado; Origin de mutaciones contra el origen validado y no contra la
URL interna de Next. No se admite x-forwarded-host como autoridad. Pruebas ejecutan
el transporte real con URL interna y rechazan Host ajeno/ambiguo, Admin, puerto
incorrecto, otra Shop, configuración insegura y Origin ausente/ajeno/HTTP o
sec-fetch-site cross-site. Regresión acotada 17 PASS. Los secretos internos de
Consent siguen exclusivamente en backend; no cambian los pendientes de seguridad
anteriores ni se certifica exposición pública de producción.

Validación final de esta corrección: regresión de privacidad ampliada **27 PASS**,
TypeScript completo PASS y navegador real → imagen OCI → BFF → Consent/PostgreSQL
PASS con NOT_CONFIGURED, cookie Secure y otra Shop400. Fixture de transporte
explícita; no acredita el kernel ni el recorrido completo de PO. La imagen de
ensayo incorpora dependencias Linux completas del mismo lockfile tras rechazar
un primer paquete incompleto. No cambia los hallazgos de seguridad anteriores.


2026-10-22 — O10/ADR-0307: perfil ADMIN opt-in anterior al tenant. No se modifica
el cierre SEC-006 de Storefront: su perfil conserva validación de BFF/contexto.
Admin valida configuración, Host/puerto y superficie propios; prohíbe token
administrativo técnico y mezcla de perfiles. Sólo HTTP loopback emparejado para
el ensayo; HTTPS fuera de él. No cambia autenticación/refresh, CSRF, cookie ni
permisos BFF. Evaluación:45 pruebas focalizadas, lint y build PASS; dos recorridos reales
PO→formulario→BFF→login con12 controles PASS cada uno, incluido reinicio de web
y backend con sesión conservada y login nuevo. Autoridad/TTY del ensayo sintéticas;
no acredita MFA o exposición remota ni cierra otros hallazgos de este backlog.


### Evidencia adicional de sesión/permisos Admin — 2026-11-04

Sin cambiar el estado de los hallazgos generales pendientes: auth/me se valida
por render (cache por render), permisos/roles explícitamente vacíos sustituyen
privilegios anteriores, y un cambio de contraseña retenido guarda la sesión
HttpOnly solo tras confirmar identidad y NORMAL. Equipo, taxonomía y Payments
configuración ocultan las acciones probadas sin su permiso de escritura.
Se conserva refresh ante 401/403, rotación HttpOnly y defaultContext. El handoff
técnico de renovación bloquea cross-site y no admite redirects externos.
Pruebas/evidencia/alcance: `docs/qa/admin-permissions-session-20261104.md`.
No se afirma cierre de los riesgos Customer, infraestructura, CSP ni del resto
de acciones UI no cubiertas por este trabajo.

### SEC-007 — evidencia adicional, 2026-11-04

Se preservan los pendientes generales. Constructor CMS valida antes de crear
recursos; Media decodifica el lote con límite de píxeles antes de persistir y
compensa errores capturados de escritura/transacción. BFF conserva400 en subidas
rechazadas, sin detalle crudo. No se certifican polyglots, caída abrupta ni
limpieza histórica. Evidencia: `docs/qa/cms-media-validation-20261104.md`.

## SEC-018 — Guardado de características podía borrar asignaciones por cascada

- Estado: **CORREGIDO EN CÓDIGO; VALIDADO LOCALMENTE** (2026-11-07).
- Evidencia: saveGroup eliminaba/reinsertaba specification_fields; FK de product_specification_selections con ON DELETE CASCADE.
- Corrección autorizada en Catalog: upsert conservando IDs/relaciones/traducciones, rechazo de retirada de campos/valores asignados e IDs ajenos; baja dedicada no destructiva con control transaccional de versión/alcance. BFF valida Employee/permisos sobre todos los scopes compartidos y bloquea baja por PATCH genérico. UI exige revisión de impacto, confirmación y diferencia guardado de ReadIndex.
- Pruebas: PostgreSQL aislado con4.000 asignaciones;24 controles BFF y22 unitarios UI;4 E2E y axe responsive; builds y lint focalizado. Ver `docs/qa/feature-deactivation-20261107.md`.
- Riesgo residual: no restaura selecciones históricas perdidas, no certifica despliegue productivo, no cubre borrado físico de grupos ni cierra hallazgos anteriores. La verificación real de UI abrió/canceló la revisión; las mutaciones se probaron en fixtures/base desechable.

2026-11-07 — Extensión de SEC-018: eliminación **intencional** individual mediante permiso separado `catalog.specifications.delete`, impacto revisado/versión/nombre escrito si hay uso, actor/scopes derivados en BFF y recibo/targets/outbox atómicos. El guard de tombstone rechaza recreación por editor obsoleto. Retry no repite borrado y complete exige ReadIndex sin definiciones/selecciones en todos los contextos activos.605 unitarios UI,3 E2E/axe responsive y SQL local desechable PASS; conserva pendientes y límites anteriores. Migración/activación Neon no ejecutadas; no certifica producción, recuperación de selecciones históricas ni borrado de grupos. [Evidencia](docs/qa/feature-deletion-20261107.md).

2026-11-07 — SEC-018: activación expresamente autorizada en Catalog/Neon y ReadIndex local. UI real revisada/cancelada; auditoría de borrados0/targets0. Defensa adicional contra referencias históricas desactualizadas: consumidor recorre selecciones del índice en páginas y contextos activos del scope antes de completar. Pruebas9 RI/13 BFF y SQL desechable PASS; conserva permisos y pendientes anteriores. Evidencia de activación en docs/qa/feature-deletion-20261107.md.


## Eliminación revisada — 2026-11-09

Implementación y pruebas locales: [evidencia](docs/qa/catalog-retirement-20261109.md). Activación pendiente de autorización para seis migraciones remotas; ninguna aplicada. Validación de permiso/contexto y rechazo de identidad de borrador remoto incompatible añadidos. Los hallazgos de seguridad pendientes existentes permanecen abiertos.


Actualización 2026-11-09: autorización remota recibida, seis migraciones APPLIED y flags locales activos. Playwright real completó eliminación de variante y producto QA; BICI-20260929-172 preservado. Evidencia: catalog-retirement-20261109.md en QA. Sustituye el estado previo de activación bloqueada.

2026-11-09 — Extensión asíncrona de eliminación: sesión/permisos/confirmación se validan al aceptar; ejecución usa cliente interno con scope separado del Employee, sin guardar bearer en operaciones. UI valida `asynchronous` booleano y estados, distingue aceptada/completada y no impulsa pasos desde polling. Lecturas de catálogo excluyen PENDING; histórico/carrito/checkout conservan DTOs. Pruebas locales de identidad/scope, reintentos y reinicios; no certifica proveedores remotos ni cierra hallazgos pendientes. Migración adicional Catalog remota no aplicada.

2026-11-09 — Activación asíncrona autorizada por Ricardo: migración adicional Catalog APPLIED, worker integrado al supervisor existente y pruebas Playwright conectadas de variante/producto, cierre de navegador y reinicios PASS. Tres operaciones QA COMPLETED; seis owner proofs correctos; ReadIndex dos contextos/remaining0; Log verificable; original y tres miniaturas Google404; PDP404/noindex y sitemap sin QA. Se corrigieron prefijos internos faltantes de Pricing/Media y preflight404 durante PENDING. BICI preservado. Sustituye el estado previo PENDING de activación; no certifica producción/CDN ni recuperación Search entre hosts. Evidencia: QA catalog-retirement-20261109. Los pendientes de seguridad ajenos permanecen abiertos.


2026-11-16 — Recorrido comercial: moneda y contexto canónicos; BFF deriva pago/pedido del snapshot servidor y exige SETTLED + Inventory COMMITTED; provider explícito. No se cierran hallazgos pendientes de schemas, autorización ni ownership legacy. Suites y SQL aislado verificados; **NO VALIDADO** navegador guest/Customer→Shipping→PSP sandbox→pedido por configuración legítima sin peso+stock coincidentes. No hay cobros ni datos comerciales alterados. Ver [evidencia](docs/qa/commercial-purchase-20261116.md).


2026-11-16 — Reanudación PayPal: política server-side acotada al tenant/shop y replay de pedido histórico con comprobación de propietario persistido previa. Nuevo hallazgo demostrado Inventory: concurrencia producía doble reserva para un pago; corregido mediante transacción/locks y probado sobre PostgreSQL aislado. El historial afectado sigue pendiente de reconciliación; segundo E2E exige aprobación sandbox. No se cierran hallazgos pendientes de autenticación, schemas ni matrices de permisos. [Evidencia](docs/qa/paypal-purchase-resumption-20261116.md).


2026-11-16 — Conservación postcompra: eliminado DELETE del carrito pagado; rotación verifica identidad nueva y carrito vacío, y409 no se acepta como pedido exitoso. Reintento real verifica propiedad y DTO Orders plano. Compra10052 contrastada con PSP sandbox y owners, sin duplicados. Incidencias históricas10050/10051 y demás hallazgos pendientes se conservan. No certifica producción ni la imposición automática de dirección PSP.

2026-11-16 14:20 UTC — Continuación comercial: PayPal invitado10053 y Stripe invitado10054 completaron PSP sandbox, pedido y seguimiento, sin cookie Customer. Se verificaron captura real de sandbox, snapshot, identidad guest persistida y replays concurrentes. La regla Stripe EUR/ES/WEB fue autorizada expresamente por el usuario. Esta evidencia no cierra hallazgos pendientes de autorización/ownership legacy ni certifica producción. Históricos10050/10051 siguen parcialmente pendientes. Ver [evidencia actualizada](docs/qa/paypal-purchase-resumption-20261116.md).

## Evidencia acotada Pricing — 2026-11-16

Se revisó la superficie de producto/preview/guardado antes de modificarla. Se conserva Employee/BFF, contexto multitienda y autoridad backend; no se añaden tokens a localStorage ni llamadas de negocio directas de UI a servicios/PSP. Credenciales sandbox/sesión no se incorporan a código, documentación o evidencias. Los precios no reciben ES/web/default/EUR artificiales desde los payloads corregidos. El laboratorio distingue stock/dirección/documento QA de datos físicos reales.

UI683 tests, lint0errores/3avisos anteriores, build correcto; compras invitado Stripe test y registrado PayPal sandbox verificadas con persistencia. Este alcance no cierra hallazgos pendientes anteriores de autenticación, handlers API heredados, PII u otras superficies. El aviso axe de contraste en tokens Admin se documenta sin rediseño transversal. [QA](docs/qa/regular-pricing-20261116.md).

## Impuestos: acciones revisadas — 2026-11-17

Antes de tocar las acciones de impuestos se revisó el backlog vigente. UI oculta
alta/baja/eliminación sin pricing.admin.write y valida confirmación/recibo; BFF
conserva Employee, permiso y scope. Borrado definitivo tiene endpoint propio, sin
fallback al DELETE de baja. El diálogo informa de la retirada de asignaciones y
preserva históricos fiscales. Backend autorizado incorpora transacción, fence y
pruebas aisladas de scope/rollback/escritor obsoleto; no se han borrado impuestos
comerciales durante QA. No cierra hallazgos generales anteriores ni acredita
producción. Axe excluye color-contrast por el pendiente transversal de tokens.
Evidencia y estado de activación: `docs/qa/tax-removal-20261117.md`.

2026-11-17 — Price tables: botones/destructivos con confirmación y permiso UI;
endpoint BFF Employee/pricing.admin.write/scope; recibo estricto sin fallback a
baja legacy. Backend autorizado desactiva/retira asignaciones atómicamente y
rechaza recreación/reactivación obsoleta con fences. Aislamiento/rollback y
negativos de scope probados en base desechable. No se eliminan tablas
comerciales, ni se cierran hallazgos generales. Contraste transversal sigue
pendiente. Estado de activación y evidencia: QA price-table-list-actions-20261117.

2026-11-17 — Activación Price tables autorizada: migración exacta aplicada,
Pricing/BFF Admin healthy tras reinicio. Datos/asignaciones conservados,
tombstones0. Endpoints sin sesión401. No cierra hallazgos anteriores ni acredita
un borrado comercial; confirma instalación de los guards probados en laboratorio.

2026-11-17 — Eliminación revisada de Pricing: se conservan los pendientes existentes. La UI valida esquemas anidados y recibos exactos; BFF deriva scope y herencia Catalog, no acepta autoridad del navegador. El estado de lecturas consulta recibo persistido y ReadIndex sin repetir eliminación. Nuevas pruebas negativas de DTO/scope/version/recibo y protección de rutas anteriores; no modifica autenticación ni acredita producción. Véase `docs/qa/reviewed-removal-20261117.md`.

## Perfil comercial Customer — 2026-11-18

Revisado el backlog vigente antes de modificar Clientes. La edición mantiene
Employee/cookie HttpOnly/BFF, añade guard UI de escritura, valida grupo/revisión/
aprobación/tipo y motivo acotado, y valida identidad del recibo. Snapshot comercial
proyectado por allowlist antes de serializar a cliente; no se exponen cuerpos de
error ni se aceptan actores comerciales del navegador. Fallos de lectura omiten
pertenencia; conflictos conservan borrador sin sobrescritura automática. No cambia
refresh/defaultContext ni activa flags.705 unitarios/contractuales,10 Playwright,
lint/build correctos; axe sin contraste por pendiente transversal. No se han
certificado BFF real, auditoría persistida ni precios/checkout; no se cierran los
hallazgos pendientes anteriores. [Alcance y límites](docs/qa/customer-commercial-profile-20261118.md).

### Activación comercial autorizada — 2026-11-18

Sustituye los pendientes operativos de la entrada anterior para el scope verificado:
dos migraciones aditivas instaladas, credenciales server-side independientes bajo
custodia0700/0600 del backend y flags coordinados. Ningún secreto interno en UI,
Postman o logs. Auditoría GET Employee/admin/customers.read/tenant→Customers por
workload, con paginación y proyección; no BFF paralelo. Política guardada con actor
Employee real; sin grupo predeterminado ni asignaciones a clientes. Compatibilidad
PERSON→PRIVATE_BUYER en lectura sin reescritura; otros códigos fallan cerrados.
B2B exige Empresa y aprobación; edición personal conserva grupo inactivo sin
reenviar membresía. Perfil real leído sin aviso ni modificación.712 unitarios,
14 E2E/3 adyacentes y laboratorio SQL/HTTP/Playwright; axe mantiene exclusión de
contraste por pendiente transversal. No cierra hallazgos generales ni certifica
compra/cobro real, proveedores/CDN o producción. [Alcance](docs/qa/customer-commercial-activation-20261118.md).

### Simplificación del perfil y Logs — 2026-11-18

El motivo ya no es un input: la Server Action establece una descripción fija e
ignora valores inyectados en el formulario. El historial se consulta en
`/admin/logs` por cliente/contexto con Employee y permiso de lectura de clientes,
mediante el endpoint BFF existente; mantiene validación de DTO y paginación.
No se alteran autenticación, persistencia ni los pendientes generales anteriores.
Evidencia: `docs/qa/customer-commercial-activation-20261118.md`.

### Confirmación de cambios comerciales — 2026-11-18

Autorizado backend/UI: contraseña del Employee conectado verificada por Sessions
en cada escritura comercial, exigida por todas las rutas BFF afectadas sin
confiar en flags/actor/evidencia del navegador ni un step-up anterior. BFF retira
el secreto antes de Customers; auditoría transaccional y DTO allowlist. La UI
limpia el secreto al enviar/cancelar/fallar y mantiene el borrador. Rate limit
local por empleado; coordinación distribuida no certificada. Sin cambios en
refresh/defaultContext y sin cierre de pendientes generales. Evidencia y límites:
`docs/qa/commercial-change-reauthentication-20261118.md`.

### Corrección del destino de logs comerciales — 2026-11-18

Se retiran el menú/ruta `/admin/logs` y el enlace desde Actividad: solo consultaban el historial de Customers y no representaban el servicio central. El backend autorizado entrega ahora el evento a `services/log` desde la auditoría transaccional, con reintentos. Se conserva el endpoint de historial por compatibilidad; la UI no lo usa. No se modifican autenticación ni confirmación con contraseña. Esta entrada sustituye las referencias anteriores a ese menú; no cierra pendientes de seguridad generales. Evidencia: `docs/qa/customer-commercial-log-delivery-20261118.md`.


### Eliminación de Header/Footer — 2026-11-19

Employee/cms.settings.write/tenant en BFF; UI valida nombre, identidad, usos y
recibo. Backend protege referencias concurrentes y evita recreación por guardado
obsoleto. PostgreSQL desechable y negativos de guards probados; no se borraron
piezas reales ni se cierran hallazgos generales. Evidencia y límites:
`docs/qa/cms-site-part-deletion-20261119.md`.

### CMS: presentación compartida — evidencia 2026-11-19

La nueva presentación de áreas/bloques funcionales usa el registro visual
existente y validación BFF + CMS. El renderer filtra valores de CSS y escapa URLs
antes de emitir reglas responsive. Regresión de CSS malicioso y URLs privadas en
`tests/cms-unified-builder.test.mjs` y pruebas CMS/BFF. Se preservan los pendientes
anteriores; esta evidencia se limita a la nueva superficie. La preview no ejecuta
acciones de compra ni envíos de formularios. Detalles en
`docs/qa/cms-builder-unification-20261119.md`.

### CMS Preview de borrador — evidencia 2026-11-19

Preview usa srcdoc estático y portal React; sandbox permite same-origin para el
portal, sin scripts/forms/popups/top-navigation. `frame-src` incorpora `'self'`;
se preservan frame-ancestors none y X-Frame-Options DENY. No se serializa el
borrador en una URL ni se crean rutas públicas de draft. Navegación por BFF con
contexto explícito y verificación Employee/CMS. Cuenta/carrito en modo inerte;
sin analítica ni mutaciones al abrir. Pruebas con CSP de producción, enlaces
inertes, permisos/contexto y cierre/foco. Se mantienen los pendientes existentes.
Alcance y límites: `docs/qa/cms-site-part-preview-20261119.md`.

### CMS: confirmación de composición publicada — 2026-11-19

Styles JSON directo inválido bloquea el envío del formulario sin descartar el
texto. Publicación exige recibo DRAFT con composición conservada y revisión
ACTIVE coincidente antes de mostrar éxito. Pruebas negativas de recibos truncados
y regresión de formulario con carrito/JSON pendiente. Sin mutaciones sobre la
cabecera real y sin cambios de permisos ni cierre de pendientes generales.
Evidencia: `docs/qa/cms-style-json-save-20261119.md`.

### CMS hoja de estilos de bloque — 2026-11-19

CSS se interpreta con PostCSS y se persiste como reglas canónicas por scope.
Selectores acotados al ID de la pieza, sin escapes/combinadores de hermanos;
valores pasan por el registro Builder, validador BFF y normalizador CMS. Sin
URLs/imports/at-rules/script. Renderer vuelve a filtrar claves/valores/selectores.
CSS incompleto bloquea guardado y conserva el texto. No modifica CSP, permisos
ni estado de hallazgos generales anteriores. Se declara directamente PostCSS
8.5.23, la versión ya forzada/instalada. QA y límites:
`docs/qa/cms-single-block-stylesheet-20261119.md`.

## CMS Fase2 — evidencia acotada, 2026-11-20

La nueva ruta Módulos exige sesión Employee/permisos y contexto; mutaciones
pasan por BFF. Sin tokens en navegador ni almacenamiento alternativo en Next.
Schema cerrado, validación owner, CAS, copia estructural y CSS acotado probados
localmente; BFF comprueba Media con lector existente. Los tests BFF con dobles
no certifican autorización real ni acceso a Media: integración autenticada pendiente.
No se cierran hallazgos pendientes anteriores. Véase
[QA Fase2](docs/qa/cms-phase-2-implementation-20261120.md).

Actualización Fase2 activada: listado nuevo sin sesión devuelve401; Employee real
creó/copió/archivó piezas QA y un editor obsoleto fue rechazado sin sobrescribir.
Permisos read-only y scope ajeno aún pendientes. Upload fallido ahora muestra
feedback; no se debilitaron validaciones Media ni se inventaron referencias.

2026-11-20 — Fase2 Media: extensión autorizada sin producto, validación UUID si presente y Shop/permisos existentes conservados. Subida/copia/reemplazo reales verificados sin extraer sesión Employee; producto draft rechaza colección CMS. No se cierra ningún hallazgo pendiente ni se certifican perfiles read-only/scope ajeno aún no probados en vivo.

## CMS SECTION — actualización 2026-11-20

Fase3 implementada y activada con verificación parcial: rutas BFF SECTION,
locale obligatorio, permisos cms.pages.read/write, validación Media reutilizada,
CAS e idempotencia owner; lectura exclusiva ReadIndex. No altera autenticación
ni cierra hallazgos previos. Pendiente probar perfiles Employee solo lectura y
scope/locale ajenos en integración real. Informe: [Fase3](docs/qa/cms-phase-3-implementation-20261120.md).

### CMS Rich text WYSIWYG — 2026-11-21

El inspector de nodos richText usa Tiptap con carga diferida y guarda el HTML
formateado en la propiedad existente html. El renderer compartido Admin/Storefront
aplica la política allowlist de sanitize-html antes de emitir HTML. La política
existente se centraliza en packages/cms-blocks/src/rich-text.ts y la importación
compartida anterior se conserva como reexport; htmlEmbed sigue escapado. Los nodos
antiguos con solo text conservan texto literal. Regresión de formato, serialización
V2, scripts, eventos y URLs activas; lint sin errores (tres avisos previos), build
y comprobación de negrita en Chrome correctos. No se guardó ni publicó el módulo
del usuario; persistencia BFF real y responsive/a11y completos no certificados.
No se cierran los hallazgos pendientes anteriores.

2026-11-21 — Rich text CMS: barra con iconos, tachado, citas, código,
listas anidadas, enlaces y fuente HTML. Los enlaces del editor reutilizan la misma
validación de destinos del saneador; la allowlist de renderizado no se amplía.
Pruebas de preservación de formatos y seguridad correctas; build y lint correctos
(tres avisos anteriores). Barra y apertura de fuente comprobadas en Chrome sobre
un borrador nuevo sin guardar. No modifica el editor de Productos ni cierra
pendientes anteriores.

### CMS Icon — 2026-11-22

Selector visual con búsqueda sobre 36 iconos Lucide ya instalados (licencia ISC).
Identidad serializada como texto lucide:<clave> en props.text existente; SVGs
proceden exclusivamente del registro importado, sin HTML/SVG arbitrario ni URLs.
Los símbolos legacy permanecen escapados. Tamaño/color usan los estilos del nodo.
Pruebas de serialización V2, renderizado SVG allowlist y escape de entrada
maliciosa correctas: 21 pruebas relacionadas, lint sin errores (tres avisos
previos), build correcto. No certifica guardado BFF real ni responsive/a11y
completos; no cierra hallazgos anteriores.

### CMS nodos estructurales/contenido — 2026-11-22

Inserción y movimiento limitados a destinos estructurales en los helpers UI;
importaciones validan jerarquía. Árboles legacy conservados y recuperables sin
migración automática ni borrado. No cambia el contrato BFF ni sustituye validación
servidor; no cierra hallazgos previos. Pruebas y límites, incluidos dos fallos
preexistentes de inventario y QA visual pendiente, en
`docs/qa/cms-visual-node-categories-20261122.md`.

### CMS shell con secciones independientes — 2026-11-23

Ampliación autorizada en BFF/CMS/UI. Configuración registered cerrada, enlaces
acotados, validación de presentación y Media anidados antes del owner; UI verifica
sesión Employee, permiso cms.settings.write y contexto antes de reproducir/guardar.
Reutiliza revisiones/site parts y preview inerte existentes; no se publicaron ni
asignaron las copias de ensayo. La comprobación previa de revisión/fecha de la UI
no es CAS atómico: ese límite legacy se mantiene abierto. No cierra hallazgos
generales ni acredita aislamiento real con perfiles/scope ajenos. Evidencia y
límites: docs/qa/cms-shell-independent-sections-20261123.md.


2026-11-23 — Continuación CMS: guardado atómico/CAS Header/Footer y revisión
confirmada al publicar, creación estable y recuperación por lectura, campos
registered declarados, herencia visual y layout/targeting PLP independiente.
La comprobación de CAS previa UI se sustituye por validación transaccional owner
para el flujo nuevo. No cierra hallazgos generales ni certifica producción;
no cambia sesiones ni permisos y no se han publicado originales. Evidencia,
contratos y límites: docs/qa/cms-builder-retirement-implementation-20261123.md.

2026-11-24 — Cierre CMS en laboratorio: se acreditan denegaciones reales de
Employee lector (mutaciones/publicación y shop ajeno), CAS y replay de migración
y publicación/recuperación. Media real validada por scope/estado/URL; no se
añadieron APIs Next de negocio ni permisos automáticos a perfiles humanos.
Builder exclusivo retirado tras comprobar documentos/Storefront. Las identidades
temporales cierran todas sus sesiones y se desactivan; custodia temporal eliminada.
No cierra hallazgos generales pendientes ni certifica producción, contraste
global o ausencia de overflow tablet previo. Evidencias en
docs/qa/cms-builder-retirement-closure-20261124.md.

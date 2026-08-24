# Security backlog de `ecommium_ui`

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

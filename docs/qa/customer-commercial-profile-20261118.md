# Condiciones comerciales del cliente — 2026-11-18

Actualización tras autorización: la activación y el perfil real se verificaron.
El estado inicial siguiente se conserva como historial; el estado vigente y
los resultados finales están en [activación](customer-commercial-activation-20261118.md).

## Resultado y alcance

Implementada la superficie UI autorizada del plan1–6, con validación aislada.
No se afirma cierre integral: el diagnóstico autenticado del entorno comercial,
la lectura del historial comercial y el recorrido real hasta Pricing/checkout
siguen pendientes. [Dependencias y propuesta de contrato](../gaps/2026-11-18-customer-commercial-operational-validation.md).

La implementación conserva un único grupo manual por cliente/contexto y separa:
identidad Particular/Empresa, grupo comercial y aprobación B2B. No introduce
VIP automático por compras, múltiples grupos, tarifas calculadas en Next ni
asignaciones públicas de privilegios.

## Comportamiento

- Bloque «Condiciones comerciales» separado de los datos personales y preferencias,
  con Organization/Shop/locale visibles. Acceso a Pricing solo con permiso de
  gestión; no duplica la configuración de grupos.
- Selector de grupos activos, opción sin grupo y conservación de asignación
  inactiva/no disponible. Catálogo vacío se diferencia de error de lectura.
- Revisión de grupo/aprobación anterior y propuesto antes de guardar. Motivo
  opcional de hasta500 caracteres; motivo predeterminado si no se informa.
- Perfil y pertenencia se envían juntos al BFF. Revisión entera segura no negativa,
  código de grupo acotado, aprobación/tipo de comprador válidos. El recibo de
  escritura debe identificar al cliente; un PATCH no acepta otra identidad.
- Server Action comprueba sesión Admin/Employee y permiso customers.addresses.write
  antes de crear/editar. BFF sigue siendo la autoridad final de permisos/scope.
- Formularios de edición conservan el borrador cuando hay error409 o validación.
  No se revalida/redirige en error; el mensaje409 informa del conflicto.
- El guardado correcto tiene confirmación visible también en la ficha, donde antes
  solo se transportaba el mensaje por query sin renderizarlo.
- Sin permiso de escritura, se consulta y presenta pertenencia canónica en modo
  lectura, sin controles de edición ni enlace de gestión Pricing no autorizado.
- Fallos de grupos y pertenencia se presentan por separado; detalles plegables
  muestran endpoint y estado, sin cuerpo upstream/trazas/secretos. Un2xx cuyo
  parseo falla se identifica como respuesta incompatible, no como catálogo vacío.
- Error de lectura omite commercialMembership al guardar datos personales.
  «Volver a consultar» recupera la lectura sin guardar ni borrar el borrador.
- Proyección allowlisted del snapshot antes de entregarlo al componente cliente:
  groupCode, b2bApproved, revision, buyerType. No serializa campos extra del owner.
- No cambia refresh/defaultContext, cookies, tokens, flags de activación o checkout.

## Comprobaciones ejecutadas

- `npm test`: **705 PASS**,0 fallos/omitidas. `.tmp/customer-commercial-all-tests.log`.
- `npm run lint`: **0 errores**,3 warnings preexistentes: customerEmptyMutation,
  fallbackError y PdfInvoicePayload. `.tmp/customer-commercial-lint.log`.
- `npm run build`: correcto. `.tmp/customer-commercial-build.log`.
- `npx tsc --noEmit`: correcto durante implementación; build volvió a comprobar
  TypeScript con los cambios finales.
- `npx playwright test tests/e2e/admin-login.spec.ts -g 'commercial profile' --workers=1`:
  **10 PASS**. `.tmp/customer-commercial-e2e.log`.
- Regresión de auth mínima `node --test tests/admin-login-action.test.mjs` incluida
  en la suite705 y ejecutada también con la selección focal inicial.
- `git diff --check` sobre los archivos modificados de Clientes/tests: correcto.

Escenarios Playwright con Next compilado y BFF HTTP sintético explícito:

1. Asignar VIP, cambiar a Profesional y retirar grupo, con revisiones0→3.
2. Conflicto409 conserva nombre, grupo y motivo; no muestra detalle sensible.
3. Pricing403 diferencia fallo de permisos y omite pertenencia al guardar.
4. Pertenencia404 diferencia recurso ausente y omite pertenencia al guardar.
5. DTO canónico inválido diferencia contrato incompatible y omite pertenencia.
6. Employee lector ve grupo/aprobación, sin controles ni mutaciones.
7. Catálogo activo vacío conserva el grupo histórico y no muestra fallo de carga.
8. Campos dentro del viewport1366/768/390 y axe sobre el bloque comercial.
9. Creación del cliente con VIP y revisión canónica al reabrir el perfil.
10. Recuperar una lectura503 conserva el nombre escrito y no envía mutaciones.

Axe excluye únicamente color-contrast por el pendiente transversal de tokens
Admin ya documentado; no equivale a certificar contraste ni toda la aplicación.
Las fixtures verifican bearer Employee y Organization/Shop en lecturas/mutaciones.
No sustituyen pruebas de autorización del BFF real ni transacciones de sus owners.

## Incidencias de ejecución resueltas

El sandbox bloqueó inicialmente listen loopback con EPERM; la ejecución con
permiso de red local completó los tests. Iteraciones detectaron etiquetas
accesibles ambiguas y ausencia de feedback de éxito en la ficha; corregidas y
verificadas en la ejecución final. No quedan fallos de estos diez escenarios.

## No ejecutado / pendiente

- No se ejecutó scripts/postman-services.sh desde backend: AGENTS limita el repo
  de trabajo y el plan no autoriza intervenir en ese repo. No se arrancaron ni
  reiniciaron servicios comerciales.
- No se modificaron datos reales ni se hizo una compra/cobro. No se aplicaron
  migraciones ni flags; no se usaron credenciales técnicas como Employee.
- No se certifica Admin→Customer→precio personalizado→checkout real, aislamiento
  backend, carritos abiertos, auditoría persistida ni históricos fiscales.
- Sin Lighthouse, medición de CLS/LCP/INP o prueba de carga en este alcance.
- El historial comercial requiere sincronizar un DTO de lectura; no se inventó
  uno ni se consumieron rutas internas.

Los estados del backlog de seguridad se conservan. Esta entrega no cierra los
hallazgos generales pendientes de autorización, schemas o infraestructura.

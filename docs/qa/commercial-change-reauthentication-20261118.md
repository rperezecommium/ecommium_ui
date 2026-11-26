# Reautenticación por cambio comercial — 2026-11-18

## Resultado

Autorizada por Ricardo la implementación en UI y backend. El guardado de grupo,
aprobación B2B o tipo comprador abre un diálogo centrado con valores anteriores
y nuevos y la contraseña del empleado conectado. Cancelar no envía cambios;
contraseña incorrecta conserva los datos editados y exige volver a escribir el
secreto. La contraseña no usa estado React ni almacenamiento de navegador y se
limpia al enviar/cancelar/cerrar. La edición personal sin cambios comerciales no
pide contraseña.

El BFF exige `currentPassword` en cada petición mutadora comercial y verifica
contra Sessions con el bearer Employee actual. No basta el step-up previo ni
su flag general. POST de cliente, PATCH del perfil y PUT directo de membresía
cubiertos; omitir commercialMembership no elude cambios de buyerType. En una
edición personal se retira buyerType si coincide, para evitar reescrituras de un
cambio concurrente ajeno. BFF retira la contraseña antes de invocar Customers y
sobrescribe actor/evidencia que pudiera enviar el navegador.

La auditoría existente guarda atómicamente con el cambio método PASSWORD,
verificationId, verifiedAt y sessionId. También incorpora el tipo comprador
cuando está disponible en los snapshots nuevos. Logs muestra la confirmación y
los valores anteriores/nuevos; los registros antiguos se distinguen como «sin
verificación registrada». No se crean tablas, tokens de autorización ni BFF UI.
La propuesta inicial de un token separado fue sustituida por esta verificación
en la misma petición (ADR-0322), sin persistencia/consumo distribuido adicional.

## Validación

- `npm test`: 713/713 unitarios/contractuales UI.
- `node --test tests/customers-admin.test.mjs tests/admin-login-action.test.mjs`:
  43/43, incluyendo contraseña obligatoria, espacios conservados, ausencia del
  secreto en edición personal y proyección de la auditoría.
- `npm run build`: correcto. `npm run lint`: 0 errores, 3 avisos anteriores.
- Playwright, casos `commercial profile`: 16 casos, incluyendo cancelación,
  contraseña incorrecta, borrador conservado, limpieza, permisos, paginación,
  conflictos y alta. Diálogo a 390px y axe (contraste excluido por pendiente
  transversal existente).
- BFF: 24 pruebas focalizadas (confirmación por petición, metadatos forjados,
  tres rutas, tipo sin membresía, caída/stale/malformed, límite y grupos).
- Customers: 28 pruebas focalizadas; metadatos malformados/caducados rechazados.
- Builds BFF/Customers y ESLint focalizado sin errores.
- Laboratorio real PostgreSQL/HTTP/Playwright mediante script comercial:
  contraseña verificada con Argon2id y sesión persistida, falta/contraseña
  incorrecta403 sin cambio de revisión, evidencia persistida sin secreto,
  rollback/concurrencia, VIP/B2B/impuestos y alta/edición desde navegador.
  Repositorio de cuenta Employee explícito de prueba; sin acceso a contraseñas
  de empleados reales. Las tres bases commercial_qa propias fueron eliminadas.

## Activación y límites

Se ejecutó el arranque canónico con Node22:
`./scripts/postman-services.sh restart-selected customers bff-admin`.
Ambos servicios locales listos/health200. No se aplicaron migraciones ni se
modificaron clientes reales. La comprobación de escritura real se hizo solo en
bases desechables; no se usó la contraseña del administrador real en evidencias.

No se altera refresh, defaultContext, permisos ni se cierra el backlog general
de seguridad. El límite por empleado usa el store local BFF (10/15min por
proceso): no certifica límite global entre réplicas, despliegue productivo ni
protección de accesos workload internos comprometidos. Transporte TLS sigue
siendo obligatorio fuera de desarrollo loopback. Postman reutiliza
`authAdminPassword` del entorno privado, sin valores nuevos en colección.

### Limpieza visual solicitada del perfil

Retirados del bloque comercial el resumen inline, la explicación de Pricing y
el enlace de configuración señalados por Ricardo. El resumen anterior/nuevo
permanece en el diálogo al guardar, junto con la contraseña; no cambian BFF,
auditoría ni validaciones de error. Eliminados imports/estilo sin uso y consulta
de sesión que solo servía al enlace retirado. Build y 28 pruebas de Clientes
correctos; regresión de navegador focalizada en guardar y confirmar/cancelar.

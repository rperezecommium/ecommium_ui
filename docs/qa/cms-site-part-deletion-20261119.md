# Eliminación protegida de Header/Footer — 2026-11-19

## Comportamiento

Eliminar en Biblioteca y Diseño, visible con permiso cms.settings.write.
Uso >0 deshabilita el botón. El diálogo exige escribir el nombre, avisa de la
pérdida de revisiones y conserva el contexto. La Server Action consulta detalle
y usos, valida identidad/nombre y envía DELETE al BFF; verifica recibo exacto.
Un 409 mantiene el diálogo y explica que el recurso sigue en uso o cambió.
Solo un recibo válido vuelve a Biblioteca sin seleccionar el recurso borrado.

Asignaciones ofrece «Retirar asignación (heredar)». Envía null para la pieza
seleccionada, sin sobrescribir la otra. Backend elimina una fila vacía con
breadcrumb AUTO, restaurando herencia. Si la pieza sigue usada por otra
superficie/página/default, su borrado continúa bloqueado.

## Backend autorizado

Nuevo DELETE con Employee/tenant/roles/cms.settings.write. CMS valida el scope
y hace eliminación condicional sin referencias; FK RESTRICT protege carreras,
revisiones se eliminan por cascada. Creación INSERT y guardado UPDATE separados
impiden que un editor antiguo recree el recurso eliminado. No cambia Media,
auth/refresh/defaultContext ni requiere migraciones.

## Pruebas

- `npm test`: 729 aprobadas.
- UI build correcto; lint cero errores y tres advertencias existentes ajenas.
- CMS: 43 suites, 186 pruebas aprobadas; build correcto.
- BFF: pruebas HTTP con guards reales y Sessions simulado, más adaptador HTTP:
  acceso sin sesión/sin permiso/Customer/otra tienda denegado, contexto propagado.
  Resultado final: 2 suites, 13 pruebas.
- PostgreSQL16 desechable, código CMS/Prisma compilado: 21 controles aprobados;
  Header/Footer en DRAFT/ACTIVE/ARCHIVED, cascada, scope, escrituras obsoletas,
  tres scopes de asignación/liberación y doce carreras asignar/eliminar.
- `node tests/e2e/cms-site-part-delete-browser.mjs`: tres tamaños
  1440/768/390; diálogo real hidratado, confirmación, bloqueo por uso,
  conflicto simulado, Cancelar/Escape/foco y axe. Contraste excluido por el
  pendiente transversal. Sin borrados reales.
- BFF lint focalizado sin errores. CMS no tiene configuración ESLint: su
  comando estándar no pudo ejecutarse. Se validaron los cinco archivos
  modificados con ESLint y reglas TypeScript recomendadas, sin errores.
- Manifiesto BFF regenerado; Postman añade DELETE desactivado por defecto.

## Activación y límites

Supervisor canónico local, solo CMS y BFF Admin; Node22 requerido. No se aplican
migraciones ni se eliminan cabeceras de usuario. La prueba integrada de borrado
usa únicamente PostgreSQL desechable, no una sesión Employee comercial.
No certifica producción ni recuperación de una pieza eliminada.

Activación comprobada con `./scripts/postman-services.sh restart-selected cms
bff-admin` usando Node22: health CMS200, Admin200, nuevo DELETE sin sesión401.
Contenedor PostgreSQL de pruebas detenido y retirado después del ensayo.
`npm run manifest:routes:check`: manifiesto actual,538 endpoints.

Contrato backend: `.docs/06-interfaces/60-cms-site-part-deletion.md` en el
monorepo autorizado. Los pendientes generales de seguridad se conservan.

# Eliminación de Header/Footer — contrato propuesto

Fecha: 2026-11-19. Ricardo autorizó cambios backend/UI. Endpoint y UI
implementados, probados en laboratorio aislado y activados en CMS/BFF Admin
locales. La propuesta siguiente se conserva como historial. Evidencia:
`../qa/cms-site-part-deletion-20261119.md`.

## Gap confirmado

Al iniciar el trabajo no existía DELETE para estos recursos; solo archivo.
La autorización inicial era de lectura. El usuario autorizó después implementar
el contrato de eliminación en ambos repositorios; el gap queda resuelto en código.
Archivar conserva su significado y no sustituye la eliminación definitiva.

## Regla solicitada

- Toda pieza en uso queda bloqueada para eliminación, sea activa o no.
- Una pieza activa sin asignaciones puede eliminarse tras confirmación explícita.
- Eliminar no libera asignaciones automáticamente: antes deben sustituirse o
  retirarse por el flujo de asignaciones, con sus permisos y contexto.
- La comprobación definitiva corresponde al BFF/CMS; el contador UI es informativo.

## Contrato a implementar

`DELETE /api/v1/admin/cms/site-parts/:sitePartId?organizationId=:org&shopId=:shop&locale=:locale`

Employee autenticado, guards Admin/tenant/roles, permiso `cms.settings.write`,
sin bearer técnico. El backend valida pertenencia al contexto antes de actuar.
La confirmación humana se exige en UI escribiendo el nombre del elemento.

Respuesta validada por identidad y literal:

```json
{ "sitePartId": "identidad-eliminada", "deleted": true }
```

Errores: 401/403 acceso; 404 identidad no accesible; 409 pieza asignada o
conflicto concurrente. Error seguro, sin detalles internos.

## Integridad

Eliminar pieza y revisiones en una operación transaccional con aislamiento de
Organization/Shop/locale. Impedir borrado si existen referencias en
`cms_shell_assignments`; conservar FKs RESTRICT ante asignación concurrente.
No eliminar Media ni otros recursos compartidos.
Revisar guardado/publicación existentes para que un editor obsoleto no recree
la pieza mediante upsert ni escriba revisiones después de la eliminación.
Aplicar el mecanismo existente de invalidación si corresponde al recurso.

## UI preparada para el contrato

Biblioteca y Diseño: acción Eliminar; deshabilitada si usageCount > 0, con mensaje
«En uso: reemplaza o retira sus asignaciones antes de eliminar».
Confirmación con nombre y aviso de eliminación definitiva de revisiones.
La acción vuelve a consultar usos antes del DELETE, pero la garantía atómica
permanece en backend. Un 409 conserva el recurso y explica el bloqueo.
Solo tras recibo válido se vuelve a Biblioteca sin seleccionar el recurso borrado.
No sustituir DELETE por archive ni introducir app/api como BFF paralelo.

## Liberación previa

Usar `GET /admin/cms/site-parts/:id/usage` para identificar asignaciones.
Reemplazar por otra pieza activa o limpiar el campo correspondiente con null
mediante el POST existente de shell-assignments. Conservar la otra pieza,
scope, scopeKey y política breadcrumb; revisión antes de retirar la asignación.
No realizar liberaciones implícitas al pulsar Eliminar.

## Pruebas requeridas

- Eliminar draft, archived y active sin usos; cascada de revisiones.
- Rechazar uso por DEFAULT/SURFACE/PAGE, incluso si cambia tras revisar en UI.
- Rechazar scope ajeno y permiso insuficiente, sin fugas ni escrituras.
- Probar carrera asignar/eliminar y guardar/publicar desde editor obsoleto.
- Recibo erróneo no se representa como borrado exitoso.
- Playwright de confirmación, bloqueo, liberación previa y borrado en datos
  desechables; axe/responsive; lint/build de ambos repositorios.

La implementación backend requerirá sincronizar contrato, documentación y pruebas
del monorepo conforme a su AGENTS.md. No se autoriza borrar elementos existentes
por la mera aprobación del desarrollo.

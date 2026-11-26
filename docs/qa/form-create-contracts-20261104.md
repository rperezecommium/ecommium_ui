# Altas de categorías, marcas y pagos — 2026-11-04

Etapas 1–5 implementadas y verificadas localmente. Alcance: cinco formularios,
sus schemas/mappers/Server Actions y propagación autorizada de includeInactive
en BFF. No se cambiaron owners, ReadIndex, autenticación, shell ni transacciones.

| Causa confirmada por BFF | Solución |
| --- | --- |
| Categoría: 400 description is required; keywords vacío también 400 | Campos requeridos y schema específico: name/slug/title/description/keywords/isActive. |
| Marca: 400 text is required; keywords vacío también 400 | Campos name/text/siteTitle/keywords/isActive; no slug. |
| Método: 400 group is required | Payload group/type; elimina groupName/methodType/provider. |
| Afiliación: 400 providerName is required | Payload providerName/merchantId. |
| Errores ignorados o elevados sin feedback de formulario | Errores visibles, ARIA inline, foco en resumen, campos preservados y bloqueo durante envío. |
| BFF ignoraba includeInactive y ocultaba altas inactivas | Sincronización aprobada por Ricardo: controlador → caso de uso → port → lector BFF. ReadIndex ya admitía el filtro. |

Reglas: importes/prioridad enteros no negativos, máximo >= mínimo; cuotas
positivas cuando se habilitan. Respuestas de creación validadas antes del éxito.
Mínimos y ausencia de máximo se serializan conforme al contrato (0/null).
No se introducen identificadores ni textos ficticios para superar validaciones.
Los campos requeridos los completa el usuario. El nombre mantiene la
normalización de texto plano existente. No hay Next API ni BFF alternativo.

Pagos inicia inactivo; activar exige confirmación de impacto. El alta de catálogo
se oculta sin su permiso de escritura; BFF sigue siendo autoridad. Se conservan
los flujos Admin defaultContext y refresh. No se cerraron riesgos generales del
backlog de seguridad ajenos a estas superficies.

## Verificación

- `npm run lint`: 0 errores, 3 avisos previos.
- `npm test`: 521 pass; incluye regresiones de login/contexto y los schemas/acciones.
- `npm run build`: PASS.
- `npx playwright test tests/e2e/admin-login.spec.ts --grep 'canonical creation|catalog creation is hidden|payment activation requires' --workers=1`: 7 pass.
- `npm --prefix apps/bff test -- --runInBand manage-payments.use-case http-admin-payments-read-index.reader`: 26 pass; BFF build PASS.
- Lint focalizado BFF ejecutado: 5 errores previos por parámetros authorization
  sin uso en getPaymentSystem/listAdminTransactions/getAdminTransaction/
  getAffiliation/getRule. No se alteraron esos métodos para ampliar este trabajo.
  Los archivos/filtros nuevos no tienen hallazgos de lint.
- Pruebas reales desde navegador contra BFF: las cinco altas aceptadas y leídas
  en sus listados con 200; todos los registros de ensayo inactivos. La regla pudo
  seleccionar el método y la afiliación inactivos recién creados.
- Axe sin violaciones en los cinco formularios a 1440/768/390 px (15 comprobaciones),
  sin overflow. Capturas revisadas en móvil/escritorio. Acciones con superficie
  primaria suave y texto legible siguiendo el patrón actual del backoffice;
  estilos acotados al componente, sin cambios globales de paleta.
- Los tres includeInactive inválidos devuelven 400 en BFF real.
- E2E cubre rechazo, conservación, posterior éxito, rango monetario inválido,
  ausencia de permiso y cancelación/aceptación de activación en BFF simulado.
  No activó proveedores reales. No se ejecutó Lighthouse: no cambió shell,
  dashboard ni tablas grandes; no se certifica performance de producción.

La revisión identificó y resolvió la diferencia entre detalle de pago 200 y
listado sin inactivos. No se ocultó como éxito de propagación ni se activaron
registros para hacerlos aparecer. No se realizó ningún cobro, cancelación,
reembolso ni llamada de prueba a un PSP.

## Inventario para retirada cuando se autorice

| Recurso | Identificador | Estado |
| --- | --- | --- |
| categories | `19b1eced-3634-4815-8fc8-f4b231b4c11e` | Inactivo |
| brands | `1894442a-6211-46bd-8309-0e29cfdd1290` | Inactivo |
| payments/payment-systems | `qa-forms-20261104-system` | Inactivo |
| payments/affiliations | `qa-forms-20261104-affiliation` | Inactivo |
| payments/rules | `qa-forms-20261104-rule` | Inactivo |

Organization `11111111-1111-4111-8111-111111111111`, Shop
`22222222-2222-4222-8222-222222222222`. No se crearon empleados, tiendas ni
organizaciones en esta prueba. Las solicitudes de payload antiguo fueron
rechazadas con 400; no generaron recursos. PATCH de keywords vacío se rechazó
con 400, sin cambios. Registros retenidos para revisión; no se borraron sin orden.
Al retirarlos: regla antes que afiliación/método, después marca/categoría, siempre
por BFF y únicamente estos IDs. Los vínculos de otros registros no se modifican.

Resultados sin secretos: [JSON](form-create-contracts-20261104.json).
Registro privado, scripts de ensayo y capturas: `/private/tmp/import-ui-review/forms-*`
y `/private/tmp/import-ui-review/form-contract-*`. `test-results` contiene la
última ejecución de Playwright. No hay credenciales en esos archivos; las sesiones
de prueba se cerraron al finalizar. No se certificó ni desplegó producción.

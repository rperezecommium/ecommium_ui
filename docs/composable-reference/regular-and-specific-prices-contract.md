# Precio normal y reglas especiales — snapshot 2026-11-16

Referencia sincronizada con ADR-0316 y contratos BFF vigentes para la evolución autorizada por Ricardo. No introduce otro motor de precios ni endpoints.

- `Price` normal: BASE sin tabla/política/canal/grupo/país/vigencia/fixed/tramos; conserva Organization/Shop/PRODUCT o VARIANT/moneda/fiscalidad. BASE contextual sigue siendo específico. El normal no exige default y respalda consultas sin regla específica aplicable.
- Admin usa básico para precio normal sin/con impuestos y avanzado para específicos/fechas/contexto/tablas/prioridades existentes. Los selects vacíos son explícitos, sin seleccionar visualmente la primera regla cuando el valor real está vacío.
- Payloads de precio no heredan ES/web/default. Moneda procede del precio o contexto comercial identificado; si falta al persistir se valida, no se inventa EUR. Cero normal explícito no equivale a un borrador vacío.
- `POST/PATCH /admin/prices` mantiene `priceKind:REGULAR|SPECIFIC` opcional. Regular rechaza condiciones. Convertir un contextual a regular exige intención explícita; no se convierte un habitual en contextual editándolo.
- `POST /admin/product-save-operations` conserva draft/response. `specificPrices` persistidos con `dirty:false` no se reescriben; editar marca true, éxito marca false. Omitir dirty conserva compatibilidad. Se conserva source, identidad, fiscalidad y condiciones legacy al leer/guardar otros campos.
- Fechas ISO/timezone explícitos se conservan. UTC solo es zona técnica neutral si falta; no representa un mercado. No se agregan descuentos porcentuales dinámicos.
- Simulación usa selección/contexto Admin disponible y ninguna política implícita. La UI no atribuye pertenencia VIP a una consulta ni crea grupos diferentes por autenticación. Buyer context y totales definitivos siguen siendo responsabilidad BFF/owners.
- El contexto server-only default previamente autorizado de la tienda se conserva para reglas antiguas excluidas. Su presencia no es requisito del normal. No hay nueva constante oculta de contexto ni conversión de divisas.

Se aprobó y ejecutó la conversión exacta de1.211 BASE/1.208 productos sin cambiar importes/impuestos. No se migran reglas IMPORT/FIXED/VIP/admin ni se promete precio normal en todo el catálogo. Estrategias de caché/proyección/invalidación y herencia de ADR-0316 conservadas.

Evidencia UI: [QA](../qa/regular-pricing-20261116.md). Canonical backend: `.docs/qa/regular-pricing-20261116.md` en composable_ecommerce, con manifiesto y journal completos sin secretos. Sin producción, entrega física ni cierre de pendientes ajenos a Pricing.

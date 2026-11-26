# Categorías Storefront y política comercial — 2026-11-16

Corregido en UI; sin cambios backend ni datos comerciales.

Causa demostrada: PLP elegía `view=cards` antes de que el cliente común añadiera la política comercial explícita del despliegue. BFF responde403 `PLP_CARDS_PRIVATE_CONTEXT_UNSUPPORTED` a cards+tradePolicy. La misma petición con política, sin cards, responde200 y conserva productos y precios. No era ausencia de productos ni se debía eliminar la política `default`.

Corrección: resolver la política con el helper compartido antes de elegir la vista. Con política/tabla/grupo o autorización Customer se usa el contrato completo existente; cards conserva su opt-in para contexto público compatible. No hay retry/fallback tras un403, no se cambia contrato, no se borran cookies ni se cambian reglas de precios. Otra tienda sin política sigue pudiendo usar cards. El parser corresponde a la vista seleccionada.

Pruebas: npm test679 PASS, incluidas dos regresiones ejecutables para tienda con política y otra tienda sin ella; npm run build PASS; npm run lint0 errores/3 avisos preexistentes. Navegador conectado al BFF real, sesión normal y contexto aislado: Frenos20 productos/16 tarjetas, Cockpit20/16, Bicicletas500/16; sin error y con precios reales. Search sin texto conserva su estado vacío previo, no se convirtió en listado general.

No se modificó UX/CSS; no se repitieron axe/Lighthouse/responsive porque el cambio solo selecciona el contrato de lectura compatible. No certifica todos los contextos comerciales ni cierra pendientes de seguridad. Reversión: revertir únicamente el cambio de selección en plp.ts y sus pruebas; volvería el rechazo403 si cards y política siguen activos. Copias previas en /tmp/ecommium-commercial-20261116/originals.

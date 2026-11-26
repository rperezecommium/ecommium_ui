# SEO bajo Datos principales — 2026-11-10

SEO deja de ser una pestaña y pasa a una caja desplegable abierta por defecto,
inmediatamente después de Datos principales dentro de Ajustes básicos. Conserva
los campos, estado, resumen, aliases, canonical, sitemap y handlers originales.
La navegación de recuperación del bloque routingSeo apunta ahora a Ajustes
básicos para evitar una pestaña inexistente. Sin cambios de contratos BFF.

Validación: npm run lint; npm run build; node --test tests/product-editor.test.mjs.
No se ejecutaron E2E automatizados, revisión visual, axe, responsive ni Lighthouse.

## Aviso de resolución descartable

El aviso verde incorpora cierre con nombre accesible y preferencia persistente
localStorage ecommium:hide-seo-resolution-notice. Al cerrarlo se oculta en todos
los productos del mismo navegador/origen y se sincroniza entre pestañas.
Solo se almacena hidden; no contiene datos de producto ni sesión. Si el navegador
bloquea almacenamiento, el cierre sigue funcionando durante el montaje actual.
No afecta a los errores de guardado ni a las alertas del BFF.

Validación de este ajuste: npm run lint y npm run build. No se ejecutaron
pruebas de navegador, E2E, axe ni Lighthouse.

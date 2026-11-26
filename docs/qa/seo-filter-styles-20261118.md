# Filtros SEO — 2026-11-18

Rutas y Redirecciones usaban pricingFilterBar sin display flex/grid, apilando
los campos a ancho completo. CSS aislado del formulario aporta distribución
flex adaptable, separación, foco y altura40px mediante variable local que
prevalece sobre la densidad global32px. No cambia consultas, contratos ni datos.

Verificación: Chrome real confirmó distribución horizontal; npm run lint0 errores
(3 avisos anteriores); npm run build PASS; Playwright seo configuration manages
routes1/1 PASS, incluyendo altura40px de los cuatro campos, ancho móvil390 y
operaciones existentes de rutas/redirecciones contra BFF de pruebas. Primer
intento detectó override32px y se corrigió; segundo ajustó localizador de select
por nombre de campo. No se ejecutó axe, Lighthouse ni suite completa.

Corrección visual posterior: el usuario señaló el recuadro de Productos.
SEO reutiliza ahora `productListSearchPanel` y su token compartido de fondo:
fondo gris, borde, radio4px y padding12px. Se añade SEO al alcance del token
existente, sin crear otro color. Build correcto; diff sin errores de whitespace.

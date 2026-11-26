# Ancho de listas de Transporte

2026-11-03. El contenedor, las listas y sus tablas ocupan el 100% del área
Admin disponible. Se corrige la combinación anterior de width:max-content y
min-width:0 que permitía encoger tablas como Zonas. Aplica a Zonas,
Transportistas, Servicios y Reglas; no modifica formularios ni contratos BFF.

Validación: `node --test tests/shipping-admin.test.mjs` (11 PASS),
`npm run lint`, `npm run build`, `git diff --check`.
Pendiente revisión visual responsive, axe y Lighthouse con sesión real.

# Primer ajuste de Variantes — 2026-11-10

Se eliminan el subtítulo descriptivo y los desplegables Filtros/Acciones masivas
del bloque Producto y variantes. Se conserva Añadir variante, generador, tabla,
estados y guardado. Se retiran estados, tipos y helpers exclusivos de esos
controles para que no queden filtros ocultos; la tabla muestra draft.variants.
Sin cambios BFF ni operaciones de dominio.

Validación: npm run build correcto; tests/product-editor.test.mjs 42/42;
npm run lint ejecutado y revisión focalizada con npx eslint sobre el editor
tras limpiar el helper sin uso. Sin E2E, axe, QA visual/responsive o Lighthouse.

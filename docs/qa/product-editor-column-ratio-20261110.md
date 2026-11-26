# Ficha de producto: reparto 60/40 — 2026-11-10

Solicitud: aprovechar el espacio repartiendo las dos columnas aproximadamente
60/40. productEditorLayout usa 3fr/2fr en lugar de un panel fijo de 340px.
Se conservan el gap de 16px y las reglas existentes de una columna a 1100px
o menos. No cambian formularios, estado, permisos ni peticiones BFF.

Verificación: inspección de la cascada CSS y de la composición del editor.
No se repitieron lint/build ni se ejecutaron E2E/Lighthouse para este ajuste
exclusivamente de proporción CSS.

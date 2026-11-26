# Producto único y acciones — 2026-11-10

Análisis local: draftFromProduct conserva la variante predeterminada y deriva
mode=variants cuando existen variantes adicionales. addManualVariant y el
generador ya asignan mode=variants y copian precios sin compartir su identidad
persistida. La pestaña Variantes está disponible siempre. No se necesita elegir
un tipo para crear producto ni cambiar contratos BFF.

Se retiran Volver al catálogo, los selectores de tipo y el descriptor simple/con
variantes de la cabecera. Se incorpora un único enlace Agregar producto a
/admin/products/new. Añadir variantes conserva la conversión automática existente;
quitar la última variante del borrador restablece mode=simple, sin eliminar ni
recrear la variante predeterminada.

Eliminar producto se mueve exclusivamente al pie, conservando permisos, bloqueo
con cambios sin guardar/guardado activo y el componente CatalogDeletionButton
con revisión de impacto y confirmación de referencia gestionadas por BFF. La
eliminación individual de variantes permanece en su tabla propia.

Validación:
- npm run lint: 0 errores y 3 warnings previos.
- npm run build: correcto.
- node --test tests/product-editor.test.mjs tests/catalog-deletion.test.mjs:
  49/49 correctos.
- No se ejecutó eliminación ni guardado de conversión real. La inspección visual
  quedó pendiente porque Chrome tenía otra ventana activa del usuario.
- Sin E2E automatizado, axe, Lighthouse ni QA móvil en este ajuste.

# Playwright real: producto, variante y eliminación — 2026-11-09

Resultado: NO se puede declarar implementación sin fallos. Se detectaron tres incidencias reproducibles durante este recorrido. Prueba mediante playwright-cli sobre http://localhost:5173, sesión Employee y contexto real. Sin mocks, sin SQL ni llamadas de dominio fuera de UI. No se modificó BICI-20260929-172.

Fixture: QA-RETIREMENT-20261109-FULL, producto c6ca08e9-54e3-4737-93f0-ea6454c4f27e. PNG sintético propio 320×240, una variante talla QA-FULL.

## Incidencias observadas

1. Stock inicial de variante =0; requisito previo del usuario =1. Generador Talla → Generar variantes reproduce el fallo. El precio se heredó correctamente:121.00. [Captura](evidence/catalog-retirement-live/01-stock-inicial-0.png).
2. Revisión previa muestra «Producto preparado para publicar» al tener imagen/precio/stock, pero Publicar termina con «No se puede publicar todavia: titulo SEO, meta descripcion». Guardó datos fuera de línea; el mensaje previo es incompleto. Se completaron ambos campos y la publicación funcionó. [Captura](evidence/catalog-retirement-live/02-publicacion-seo.png).
3. Imagen subida, guardada y cargada en Admin (también después de reabrir); listado indica1 media. PDP pública del padre y variante muestra «Imagen no disponible» y no renderiza imagen de producto (solo logos). Sigue ocurriendo después de eliminar la variante y conservar el padre. No se atribuye aún causa a UI/BFF/ReadIndex/Media: este recorrido prueba el síntoma. [PDP](evidence/catalog-retirement-live/04-pdp-activo.png).

## Comprobaciones que pasan

- Crear producto, subir PNG, categoría/marca, precio base100 neto /121 IVA incluido21%, stock padre3.
- Variante con atributo; precio heredado121 editable. Cambiar a133.10 y stock2; guardar y reabrir conserva133.10/2.
- Completar SEO y publicar. Listado muestra activo, visible,121€, cantidad3 y1 media. [Listado](evidence/catalog-retirement-live/03-listado-activo.png).
- PDP200; seleccionar variante muestra133,10€, disponible2 y referencia propia. [Variante](evidence/catalog-retirement-live/05-pdp-variante.png).
- Sitemap XML200 e incluye canonical QA antes del borrado.
- Referencia incorrecta deshabilita confirmación; Escape cierra sin eliminar; Cancelar conserva producto/variante.
- Revisión variante detecta stock2, un registro stock y un precio. [Impacto](evidence/catalog-retirement-live/06-impacto-variante.png).
- Variante completa: operación1ac91c32-4fcb-4d26-a0c9-8c060d616e30, mensaje «Eliminación completada y actualización pública comprobada». [Éxito](evidence/catalog-retirement-live/07-variante-eliminada.png).
- Nueva navegación PDP200: variante ausente, padre121€ y disponible3. Galería Admin permanece cargada. [Padre](evidence/catalog-retirement-live/08-pdp-padre-conservado.png).
- Revisión producto detecta stock3, un registro stock, un precio, una imagen, una colección y una ruta. [Impacto](evidence/catalog-retirement-live/09-impacto-producto.png).
- Operación producto6bb17d44-8a4b-4308-8507-baefafcb8795 iniciada; cerrar con Continuar después y reabrir desde Eliminaciones pendientes recupera la misma operación.

## Alcance

No se cambió código de aplicación durante esta prueba. No se ejecutaron lint/build porque esta entrega agrega evidencia, no implementación. No prueba ausencia universal de fallos ni reservas concurrentes, recursos compartidos, todos los permisos/idiomas, fallos de proveedor o rendimiento. Hubo un timeout del guion al buscar una tabla después de que el producto pasara a simple al perder su última variante; se verificó el estado mediante nueva navegación, sin contabilizar ese timeout como fallo de producto.

Una acción combinada de lectura de almacén y edición QA fue rechazada por revisión automática al interpretarse como edición del producto original. No se ejecutó. Se separó la lectura sin mutación y se comprobó la identidad exacta QA antes de editar; no queda bloqueo de autorización pendiente.

## Resultado final de limpieza

Producto6bb17d44-8a4b-4308-8507-baefafcb8795 COMPLETED con mensaje de actualización pública comprobada. [Confirmación](evidence/catalog-retirement-live/10-producto-eliminado.png). Listado recargado:0 filas QA. [Listado final](evidence/catalog-retirement-live/11-listado-sin-producto.png). Navegador público nuevo sin cookies: PDP404, sitemap200 y canonical QA ausente. [404](evidence/catalog-retirement-live/12-pdp-404.png). El producto QA y su variante ya no quedan operativos. La prueba confirma los recibos del flujo para medios; no inspecciona directamente el bucket ni backups.

El guion tuvo además un error de API de automatización (`page.browser`); se corrigió a `page.context().browser()` y la comprobación se ejecutó correctamente. No fue un fallo de la aplicación.

Comprobación final de solo lectura de BICI-20260929-172: Activo, producto con variantes, stock predeterminado29. No se guardaron cambios en esa ficha.

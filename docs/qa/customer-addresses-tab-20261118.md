# Direcciones del cliente — pestaña y panel lateral

Se separa Direcciones de Perfil mediante badge propio en la navegación Customer
360. «Agregar nueva» es un enlace a la derecha de los badges, visible solo con
permiso de escritura y en la pestaña Direcciones. La tabla reutiliza
adminTable/productListTable (cabecera, densidad y hover) con scroll horizontal.
Crear y editar reutilizan AdminResourceDrawer con drawerId estable
customer-address, formulario adaptable y los mismos Server Actions/BFF.

Cerrar, cancelar y guardar conservan tab=direcciones. Las URLs anteriores con
addressMode válido abren la sección Direcciones aunque indiquen Perfil. Se
ignoran modos desconocidos. No cambian endpoints, permisos ni dominio backend.

Comprobaciones: npm run build; npm run lint (sin errores, tres avisos previos);
node --test tests/customers-admin.test.mjs tests/admin-drawer-size.test.mjs
(32/32). Playwright focalizado: navegación Perfil→Direcciones, alta/cancelación,
edición con datos cargados/cierre, navegación Compras y regresión comercial.
Pruebas con BFF de fixture; no se modifican direcciones de clientes reales.

Corrección tras comparación visual en Chrome con Catálogo→Productos: el estilo
vigente requiere productListPage/productListGrid, además de productListTable.
Direcciones reutiliza ahora esos contenedores, cabecera gris en mayúsculas,
filas compactas y acciones de Productos; se retira la card blanca y la negrita
del nombre. El formulario lateral queda fuera del contenedor del listado para
conservar sus estilos propios. Verificado visualmente en la sesión Admin real,
sin guardar direcciones. Build/lint y 32 pruebas focalizadas correctos.

Extensión solicitada a Compras y Facturación: mismos contenedores de Productos,
cabeceras/filas/acciones compactas, sin card blanca ni nombres en negrita.
La tabla resumen de Facturación adopta el estilo sin forzar ancho mínimo de
listado. Se conservan enlaces a pedidos/facturas, paginación y permisos.
Build y 28 pruebas de Clientes correctos; lint sin errores (tres avisos previos).
Dos E2E aprobados: navegación Perfil/Direcciones/Compras/Facturación y restricción
de compras sin permiso. No se han realizado mutaciones de negocio.

# Creación de características — 2026-11-06

## Cambio de UI

El formulario de alta usa AdminMutationForm para conservar los campos y enfocar el error cuando el BFF rechaza la petición. La Server Action valida nombre/categoría, comprueba ok y exige que la respuesta confirme la identidad y el tipo de la característica. Solo revalida/redirige tras esa confirmación. Nunca devuelve excepciones ni cuerpos crudos del upstream.

Después del alta, el campo creado se identifica en el listado por su fieldId. Si ReadIndex todavía no lo entrega, la UI distingue la creación confirmada del listado pendiente de actualizar y ofrece Actualizar listado sin repetir la mutación. Si el alta es inactiva, el filtro se abre en inactivos. No se usa un servicio interno ni se rellena el listado con datos canónicos para sustituir ReadIndex.

## Prueba real con Playwright

Sesión Employee introducida por el usuario, Organization Ecommium Default Organization, Shop Tienda Barcelona, locale es-ES. Las peticiones y mutaciones pasan por BFF StoreAdmin.

- La primera prueba de la conversación no mostraba la nueva fila. La ausencia en ReadIndex no bastaba para concluir que Catalog no la hubiera creado; se corrige aquel diagnóstico.
- Los reintentos con el primer grupo devolvieron HTTP400; la UI corregida mantuvo nombre, categoría, grupo y valores, y mostró mensaje público, status y correlationId. No se obtuvo detalle estructurado de la causa, por lo que no se afirma que aquel400 fuese necesariamente duplicidad.
- Un grupo de prueba nuevo B obtuvo confirmación válida de creación, pero el listado siguió con las cuatro características anteriores.
- Con el código final, `Compatibilidad QA PW 20261106 C`, grupo `Pruebas UI PW 20261106 C`, categoría bicicletas y valores Compatible / No compatible obtuvo identidad confirmada `28913a6a-9e06-4fcf-b262-e44de8576c5f`. La pantalla mostró el aviso de creación confirmada/lectura pendiente; Actualizar listado no generó otra alta y el registro siguió ausente en la lectura.
- Se dejaron los registros de prueba confirmados; no se borraron datos ni se asignaron a productos.
- La herramienta reportó HTTP500 en la navegación de desarrollo aunque el formulario y las Server Actions siguieron operativos. La salida de Next está en la TTY del proceso, sin log de archivo disponible; no se reinició el proceso del usuario. No se certifica que ese estado del entorno esté resuelto.

## Contraste de backend autorizado solo en lectura

Se consultaron el controlador BFF admin-catalog-taxonomy, el cliente Catalog del BFF, el DTO y caso de uso create-group y los contratos de frontend. POST devuelve el detalle canónico del grupo; GET groups/get-group de BFF se apoya en ReadIndex. El caso de uso de Catalog valida nombre/categoría/campos, persiste el grupo y publica invalidación. La causa operativa exacta de la lectura desactualizada no se ha determinado. No se modificó ni reinició backend ni se accedió a sus bases de datos.

Pendiente: sincronización/investigación de la proyección ReadIndex y del circuito de invalidación para esta tienda. Las fuentes locales de UI no acreditan un mecanismo contractual de refresh/read-your-writes para grupos de especificaciones. No se introduce un endpoint alternativo ni se oculta el gap con datos locales. Los intentos de consultar OpenAPI público del BFF devolvieron404.

## Validación

- `node --test tests/catalog-feature-create.test.mjs`:5 PASS: validación previa, rechazo, confirmación de identidad/tipo, redirección tras alta y ocultación de excepciones.
- `npm run build`: PASS.
- `npm run lint`:0 errores;3 advertencias preexistentes.
- `npx playwright test tests/e2e/admin-login.spec.ts --grep 'catalog attributes and features page|feature creation keeps|confirmed feature creation' --reporter=line`:3 PASS. Incluye creación/edición/valores, rechazo400 con campos conservados/foco y alta confirmada con proyección retrasada que se recupera sin otro POST.
- El primer selector de prueba exacto por label de categoría no coincidía con el nombre accesible; se ajustó al select por name. El recorrido final está en verde.
- No se ejecutaron Lighthouse ni auditoría axe completa. La prueba real conserva el pendiente de ReadIndex y la observación HTTP500 indicados arriba.

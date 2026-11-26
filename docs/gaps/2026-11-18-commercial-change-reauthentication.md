# Reautenticación para cambios comerciales de clientes

Estado: sustituida por la implementación autorizada en ADR-0322 del backend.
Se eligió verificar la contraseña dentro de cada petición de escritura, en vez
de emitir un token aparte: misma vinculación a la ejecución, sin almacenamiento
ni consumo de tokens distribuidos. Contrato y evidencia vigentes en
`docs/qa/commercial-change-reauthentication-20261118.md`.
El resto de este documento conserva la propuesta inicial para trazabilidad.

## Evidencia local

La UI dispone de `POST /admin/session/step-up` con `{ currentPassword }` para
confirmar al empleado conectado. La lectura devuelve estado, método, fechas y
`enforcement`. La referencia comercial documenta POST/PATCH de cliente y PUT de
membresía con permiso, contexto, revisión y actor derivado en BFF, pero no
establece una prueba obligatoria de reautenticación ligada al cambio comercial.
No se da por implementado un guard comercial por existir el step-up general.

## Contrato propuesto para sincronizar

Reutilizar la verificación de contraseña de Sessions, a través del BFF, para
emitir una autorización opaca breve y de un solo uso, ligada a:

- Empleado y sesión autenticados, sin aceptar actor desde UI.
- Organization/Shop y cliente objetivo; la creación debe ligarse al payload de
  creación o resolverse mediante el mismo mecanismo transaccional.
- Operación comercial y resumen canónico de los valores propuestos, incluido
  tipo comprador, grupo, aprobación B2B y revisión esperada.
- Caducidad breve (propuesta: 2 minutos) y un identificador de verificación.

Propuesta de ruta BFF: `POST /admin/customers/commercial-change-confirmations`
con contexto, objetivo y valores propuestos, más `currentPassword`. Respuesta
cerrada `{ confirmationToken, expiresAt }`, no-store. Ninguna contraseña ni token
se registra o persiste en el navegador. La UI conserva el token únicamente para
el intento inmediato de guardado y limpia el input de contraseña al enviar,
cancelar, fallar o cerrar el diálogo.

Todos los caminos BFF que pueden modificar condiciones comerciales (creación,
PATCH de perfil y PUT de membresía) deben exigir y validar la autorización,
independientemente del flag general de step-up. No debe bastar con un booleano,
un timestamp del navegador o una confirmación previa para otra operación.
La edición personal que conserve las condiciones no debe pedir contraseña.
Un cambio de payload, contexto, cliente, sesión o revisión invalida la prueba.

La validación/consumo debe coordinarse para que dos escrituras no reutilicen una
prueba. Un fallo de persistencia no debe autorizar un reintento diferente; tras
conflicto, recargar y revisar exige una confirmación nueva. El registro de éxito
comercial conserva su atomicidad con el cambio e incluye método, fecha e ID de
verificación derivados por servidor. La auditoría no contiene contraseña, hash
de contraseña, bearer ni token opaco. Los intentos fallidos se limitan por
sesión/empleado con errores genéricos.

## UX y pruebas de aceptación

Al guardar un cambio comercial, diálogo centrado con cliente, valores anteriores
y nuevos, contraseña del empleado actual, Cancelar y Confirmar cambio comercial.
Cancelar no escribe; contraseña incorrecta conserva el borrador comercial, pero
limpia el secreto. Mantener los permisos vigentes; reautenticar no los amplía.

Pruebas negativas BFF: sin prueba, expirada, consumida, cliente/contexto/sesión
ajenos, payload alterado, permiso revocado, contraseña incorrecta y dependencia
no disponible. Cubrir todas las rutas mutadoras, concurrencia, rollback y
metadatos de auditoría. UI: cancelación, doble envío, error/conflicto, borrador,
limpieza de contraseña, edición personal sin reautenticación, responsive y axe.
Preservar refresh y defaultContext; ejecutar la regresión de login antes de tocar
autenticación.

No se ha añadido un diálogo que pueda confundirse con una protección servidor
ya activa. No se han consultado ni modificado repositorios backend en esta fase.

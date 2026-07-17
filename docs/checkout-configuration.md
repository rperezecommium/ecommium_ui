# Configuración Admin de Checkout

La pantalla `Admin > Configuración > Checkout` opera exclusivamente contra el
BFF. Requiere una sesión Admin con el permiso
`checkout.configuration.write`; la UI lo comprueba antes de cargar o guardar y
el BFF conserva la autorización definitiva.

## Contrato utilizado

- `GET /api/v1/admin/checkout/configuration/orderform?organizationId=:org&shopId=:shop`
- `PATCH /api/v1/admin/checkout/configuration/orderform?organizationId=:org&shopId=:shop`

`GET` puede devolver `configurationState: INITIAL`: muestra valores iniciales,
pero no existe todavía un registro persistido. Un `PATCH` válido lo materializa
y la respuesta pasa a `PERSISTED`.

La UI toma `storeContext` del contexto Admin activo. El formulario no permite
editar idioma, moneda ni país desde Checkout para evitar una segunda fuente de
verdad. Solo se editan score de ReCAPTCHA, flags y métodos de pago. La
desactivación de Checkout exige escribir `DESACTIVAR CHECKOUT`; esa
comprobación se aplica también en la Server Action.

## Prueba manual integrada

1. Levantar el backend canónico desde el repo composable con
   `./scripts/postman-services.sh up`.
2. Levantar la UI con `npm run dev` y abrir
   `/admin/configuracion/checkout` con una sesión que tenga
   `checkout.configuration.write`.
3. En una tienda sin configuración, comprobar el banner inicial y abrir
   `Editar configuración`; el panel lateral no debe mostrar campos de moneda,
   país ni idioma.
4. Cambiar una regla de Checkout y guardar; el panel se cierra y la respuesta
   debe pasar a `PERSISTED`.
5. Volver a abrir `Editar configuración`, desmarcar `Checkout activo para esta tienda`: el botón queda bloqueado hasta
   escribir `DESACTIVAR CHECKOUT`. Confirmar que el banner final muestra la
   nueva versión.

La prueba automatizada equivalente es:

```bash
npx playwright test tests/e2e/checkout-configuration.spec.ts
```

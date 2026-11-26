# Carrito rechaza precio vendible — 2026-11-16

## Estado

Reproducido contra UI localhost:5173 y BFF Storefront 127.0.0.1:3025/api/v1. Sin lectura ni cambios del repositorio backend. Pendiente autorización explícita para sincronizar contrato y diagnosticar la implementación backend conforme a AGENTS.md. No se guardan credenciales, cookies ni tokens en esta evidencia.

## Reproducción

Contexto: Organization 11111111-1111-4111-8111-111111111111, Shop 22222222-2222-4222-8222-222222222222, locale es-ES, currency EUR, country ES, channel web. Cantidad 1.

- Invitado desde PDP: GET /api/storefront/cart responde200 y devuelve orderform vacío; POST /api/storefront/cart/items responde400. El botón cambia temporalmente a No añadido y el contador permanece vacío.
- Cuenta Customer indicada por el usuario: login confirmado por Mi cuenta/Cerrar sesión; GET /api/storefront/cart responde400 antes de enviar items. La consulta autenticada directa al BFF confirma400 y mensaje no applicable selling price.
- Invitado nuevo directo al BFF: GET /orderforms/current200; POST /orderforms/:id/items400 con mensaje no applicable selling price. Se evita depender de un carrito previo o del estado del navegador.
- Sunrace desviador trasero rs2, COMP-20260929-323, variantId 628a7c27-b140-4259-8641-faa4313dc600: PDP BFF200, precio VARIANT EUR1318; añadir al carrito400.
- Shimano desviador trasero ty21, COMP-20260929-038, variantId 2babb856-f565-4efd-8c46-291d726475ee: PDP BFF200, precio VARIANT EUR1559; añadir al carrito400.
- Un carrito nuevo solicitado con currency EUR devuelve totals.currency USD. La UI añade storefrontContext.currency EUR a esa respuesta y su normalizador prioriza esa moneda sobre totals.currency. Repetir con currency USD también termina en400, de modo que la discrepancia no basta para explicar por sí sola el fallo.

## Interpretación y límites

El rechazo se reproduce sin pasar por los handlers Next, por lo que no es exclusivamente un fallo del botón, almacenamiento local o sesión Customer. Hay una divergencia observable entre precio publicado en PDP y precio vendible resuelto por Orderforms. No se confirma si se debe al contexto comercial, moneda persistida, tabla/canal/grupo, vigencia, identidad de precio VARIANT u otra validación interna. El fallo de current autenticado puede estar relacionado con recálculo de su carrito; esa causa interna sigue sin confirmar.

## Superficie UI

- cart-client.tsx AddToCartButton captura y descarta el error; solo muestra No añadido.
- request-client.ts transforma400 en La solicitud no es válida.; se conserva el comportamiento de redacción de errores existente.
- app/api/storefront/cart y cart/items reenvían contexto y payload al BFF. No se modifican estos handlers heredados ni se crea una vía alternativa al BFF.

## Siguiente paso propuesto

Con autorización de sincronización: contrastar el contexto de pricing usado por PDP y por creación/recálculo/add de Orderforms; comprobar moneda canónica, targets de variante, vigencia y reglas aplicables. Mantener al backend como autoridad del precio: no enviar el importe mostrado por PDP como precio manual ni inventar fallback. Después, probar guest y Customer con los mismos productos, comprobar líneas/moneda/totales y mejorar feedback UI mediante un código de error público documentado.

Pruebas: navegador Playwright real y llamadas HTTP al BFF disponible. No se ejecutan lint/build ni suites porque no se modifica código. No se realiza checkout, pago, compra ni modificación de precios/configuración. Las pruebas generan carritos de invitado y pueden intentar reconciliación del carrito de la cuenta al consultar current; no se afirma rollback interno del BFF.

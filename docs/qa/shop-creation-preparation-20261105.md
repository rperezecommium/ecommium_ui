# Preparación integrada en crear tienda — 2026-11-05

## Cambio

Se retira el bloque permanente de Contexto. Crear tienda redirige tras el alta
a su paso de finalización, conservando consulta del estado y retry:true sobre
la tienda creada. El formulario de creación permanece oculto durante ese paso
para evitar repetir el alta. READY ofrece Continuar. Editar tienda conserva
recuperación tras abandonar el alta o para tiendas existentes.

El destino es independiente de la selección activa: cada acción lo valida y
resuelve por BFF; exige identidad coincidente y locale/currency/country
resueltos. El seguimiento no cambia la cookie de contexto. El BFF conserva la
autenticación, los permisos y el alcance tenant definitivos. Sin permiso de
gestión se consulta el estado sin mostrar el botón de recuperación.

## Confirmación previa

Lectura backend expresamente autorizada, sin modificaciones: createShop del
BFF solicita preparación; el dispatcher entrega intenciones durables y confirma
recepción tras persistencia. El coordinador conserva FAILED hasta un retry
explícito y reanuda PENDING/RUNNING al arrancar. La preparación automática de
alta no reemplaza la recuperación manual.

## Validación

- `node --test tests/shop-creation-preparation.test.mjs tests/shop-read-preparation.test.mjs`: 6 PASS. Destino diferente del activo, configuración regional resuelta, retry sin alta repetida, referencias inválidas, contexto incompleto/ajeno y creación con/sin selección activa.
- `npx playwright test tests/e2e/admin-login.spec.ts --grep 'shop read preparation'`: 2 PASS. Ausencia del bloque en Contexto, recuperación hasta READY, permiso de gestión y panel sin desbordamiento a 1440/768/390 px.
- `npx playwright test tests/e2e/admin-installation.spec.ts --grep 'SYSTEM session without a shop'`: 1 PASS. Organization → crear tienda → fallo de preparación → retry → READY → Continuar. Un solo POST de alta.
- `npm run lint`: sin errores, 3 advertencias preexistentes ajenas.
- `npm run build`: PASS.

Los E2E usan BFF simulado y servidores loopback. La primera ejecución E2E
necesitó permiso de escucha local; se repitió fuera del sandbox. Un intento de
onboarding coincidió con un build y devolvió Internal Server Error; repetido
tras terminar el build pasó. No acredita el despliegue ni la preparación real:
BFF local estaba detenido. No se ejecutaron axe ni Lighthouse; se verifican
etiquetas del alta y responsive en las pruebas existentes, sin certificar una
auditoría completa de accesibilidad o budgets de rendimiento.

# Precio con condiciones — 2026-11-18

Decisión: conservar Rules como agrupación de precios existentes. Se añadió un
enlace azul a la derecha y un panel compartido `pricing-conditional-price`.
La Server Action valida campos, sesión, permiso y recibo BFF; usa POST
`/admin/prices` con contexto canónico. No cambia contratos ni backend.

Validación ejecutada:

- `npm run lint`: sin errores; tres advertencias preexistentes.
- `npm run build`: correcto.
- `node --test tests/pricing-conditional-price.test.mjs tests/admin-drawer-size.test.mjs`: 9/9.
- `npx playwright test tests/e2e/admin-login.spec.ts -g 'Rules creates a conditional price' --workers=1`: 1/1. Abre el panel, rechaza ID inválido conservando borrador, guarda y retorna a la tabla seleccionada; comprueba payload y condiciones vacías.

El E2E utiliza BFF simulado. No se creó un precio real ni se verificó la
propagación real a ReadIndex; el mensaje avisa del posible retraso del listado.
No se ejecutaron auditorías axe, Lighthouse ni una matriz responsive específica
de este formulario. No se modificó el estándar de tamaño de los drawers.

## Separación de creación y edición

Los formularios incrustados en filas de Rules se retiraron. Cada fila ofrece
Editar grupo y Desactivar grupo, con paneles compartidos separados e identidad
estable. Editar modifica los precios existentes del grupo mediante el PATCH
existente; crear continúa usando exclusivamente POST /admin/prices. La
desactivación mantiene la confirmación DELETE en su propio panel.

Revalidación: lint sin errores (tres advertencias previas), build correcto,
4/4 pruebas de drawers y E2E ampliado 1/1. El E2E verifica ausencia de formularios
en la tabla, apertura/cierre de edición y desactivación y el flujo de creación.
No ejecuta cambios reales ni el guardado de edición/desactivación. El primer
intento E2E coincidió con build en curso; se repitió tras su finalización.

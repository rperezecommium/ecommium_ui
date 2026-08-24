# Validación y entrega: flujo Admin de Postventa

## Propósito

El Admin resuelve un caso a través de una conversación clara con la customer.
La interfaz no permite editar estados técnicos ni ejecutar impactos aislados
para los expedientes creados con el flujo guiado. After Sales y StoreAdmin BFF
mantienen la autoridad sobre transiciones, asignación automática, pagos,
devoluciones, inventario, documentos, comunicaciones y auditoría.

El drawer presenta cuatro secciones:

1. **Caso**: solicitud, conversación, líneas y evidencias.
2. **Propuesta**: solución ofrecida y respuesta de la customer.
3. **Ejecución**: avance factual de la solución acordada.
4. **Historial**: recorrido cronológico del expediente. Reúne apertura,
   conversación, evidencias, propuestas, ejecución, prueba de cierre y cierre
   final con lenguaje humano. No muestra tablas vacías, UUIDs ni estados
   técnicos como contenido principal.

Los enlaces antiguos siguen siendo compatibles: `operacion` abre **Caso**,
`devolucion` y `resolucion` abren **Ejecución**, y `auditoria` abre
**Historial**. Los expedientes creados antes del acuerdo guiado agrupan su
operativa histórica bajo **Ejecución**.

## Flujo que debe verificarse

```text
Cliente abre caso
  → alerta Caso nuevo en la cola
  → Admin atiende e inicia revisión (se asigna automáticamente)
  → conversación y evidencias
  → propuesta enviada
  → Esperando al cliente / Invernando si BFF expira la propuesta
  → cliente acepta
  → Procesar solución
  → Finalizar solución + registrar prueba interna de cierre (nota y, opcionalmente, imagen privada)
  → Listo para cerrar
  → Cerrar caso
```

La cola conserva también las alertas de **Mensaje del cliente** y
**Evidencia pendiente**. Atender una alerta solo elimina esa tarea y abre el
mismo caso con el foco correspondiente; no cambia el estado del caso ni borra
las otras alertas.

## Prueba manual controlada

1. Levantar el composable desde su repositorio con
   `./scripts/postman-services.sh up` y confirmar que `after-sales` y
   `bff-admin` están disponibles.
2. En esta UI, ejecutar `npm run dev` y abrir `http://localhost:5173`.
3. Iniciar sesión con una cuenta Employee que tenga contexto activo y
   `after-sales.manage`.
4. Crear o usar un caso `SUBMITTED`. Confirmar que aparece una tarea **Caso
   nuevo** y aumenta el contador lateral de Postventa.
5. Pulsar **Atender**. Confirmar que se retira únicamente esa tarea, se abre
   el caso y la primera transición a revisión deja responsable al Employee de
   la sesión.
6. En **Caso**, enviar un mensaje y revisar una evidencia. Confirmar que los
   nuevos avisos se muestran como **Mensaje del cliente** y **Evidencia
   pendiente** sin exponer su contenido en la cola.
7. En **Propuesta**, enviar una solución. Confirmar **Esperando al cliente**.
   No inferir aceptación desde la UI: la expiración y la aceptación pertenecen
   al BFF.
8. Después de que la customer acepte, entrar en **Ejecución**, pulsar
   **Procesar solución** y comprobar que el BFF devuelve el avance factual.
9. Cuando BFF permita terminar, completar en el mismo formulario de
   **Finalizar solución** la explicación al cliente, la nota interna y, si hace
   falta, una imagen JPG/PNG/WebP privada. Confirmar que aparece el plazo de
   autocierre y que la prueba no se muestra al cliente. Si el comando falla, el
   expediente continúa en ejecución: no hay una solución finalizada sin prueba
   que reintentar.
10. En **Historial**, comprobar que el recorrido se lee de principio a fin:
    apertura, conversación, evidencias, propuestas, ejecución, prueba de
    cierre y cierre. La nota y la imagen de la prueba deben estar marcadas
    **Solo equipo** y abrirse únicamente desde Admin. No deben aparecer
    colecciones vacías ni referencias técnicas.
11. Con la prueba activa, confirmar **Listo para cerrar**, cerrar el expediente
    y comprobar que el recorrido permanece en modo consulta.
12. Repetir la consulta con `admin:after-sales:view` sin
    `after-sales.manage`: se pueden leer cola, caso e historial, pero no se
    muestran controles de atención, respuesta, propuesta o ejecución.

## Validación automatizada

```bash
node --test tests/after-sales-admin.test.mjs
npm run lint
npm run build
```

La suite de Postventa cubre la matriz de estados, propuestas, ejecución,
focos de cola, revalidación del badge, errores públicos, validación de entrada,
permisos de solo lectura y el recorrido cronológico sin tablas técnicas o
vacías.

## Rollout y reversión

- Desplegar la UI junto a StoreAdmin BFF que exponga `solution-proposals`,
  `solution-execution` y `solution-finalization`. `solution-completion` y
  `closure-proofs` quedan disponibles solo para compatibilidad y recuperación.
- Verificar primero con un caso de prueba y una cuenta `after-sales.manage`.
- Observar que las mutaciones devuelven mensajes públicos y que el badge de la
  cola se actualiza.
- Si se necesita revertir la UI, desplegar la revisión anterior: no se han
  creado datos locales ni migraciones. Los casos y propuestas ya persistidos
  siguen siendo propiedad de After Sales y se conservan.

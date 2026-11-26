# Diagnóstico de postventa — 2026-11-16

Revisión solicitada de la regresión del último caso del cliente yolaica70@…; solo lectura. No se modificaron reglas, estados, stock, plantillas, servicios, procesos ni funciones SQL; no se reenviaron correos ni se crearon casos de prueba.

## Hallazgos demostrados

Caso ASC-ZKYB5R58JT (`10dbbecc-e113-4c06-85a1-6c4d45735c59`), pedido10056, creado16/11/2026 a18:05:38 Europe/Madrid. After Sales conserva estadoSUBMITTED, un mensaje, una evidencia y dos tareasOPEN (NEW_CASE/EVIDENCE_REVIEW). Sus eventos de negocio submitted/evidence-added figuran PUBLISHED. No hay pérdida del expediente en su owner.

Admin Postventa muestra29casos históricos, último24/08, cero pendientes y no contiene el caso nuevo. BFF lee listado/resumen desde ReadIndex; la discrepancia está antes de la presentación. `commerce_read_outbox` de After Sales contiene5eventos pendientes, desde17:05:39Z hasta17:05:48Z, attempts0/published_atNULL. No confundir ese outbox de proyección con el outbox de eventos de negocio anterior.

Los PID registrados en `.tmp/relay-recovery-20261104/processes.json` para After Sales y Communications ya no existen. El inventario real solo encuentra relays dedicados Catalog/Pricing/Inventory/Media/RoutingSEO. `scripts/commerce-read-runtime.mjs` enumera precisamente esos cinco; no inicia After Sales/Communications/Shipping/Employees. Las APIs de estos owners siguen activas: HTTPhealth no demuestra que sus proyecciones se actualicen. La recuperación manual del04/11 está documentada en `.docs/03-architecture/22-admin-commerce-relays-recovery.md`; el supervisor posterior cubre solo el subconjunto de catálogo. No se ha demostrado quién o qué detuvo los procesos antiguos.

## Correo

Regla activa `6ac48d20-a2d8-4431-9abf-961cccf9fda7`, plantilla `after-sales.case.submitted` activa es-ES y proveedor SMTP activo. Estas configuraciones son anteriores a este trabajo y no fueron alteradas durante el diagnóstico.

Automation recibió el evento `899e27b7-ad06-439d-b38d-a8a30d5a2df1`; ejecución `f739ff9f-2491-47dc-97bd-642cd07da809` FAILED, pasoSEND_EMAIL FAILED. Communications devuelve400 por SQL42702: `column reference "data" is ambiguous`. No hay delivery persistido para ese evento.

Causa localizada: función `communications_commerce_read_capture_attempt()`, variablePL/pgSQL `data` y columna `communication_deliveries.data`; el SELECT usa `WHERE delivery_id=(data->>'delivery_id')::uuid` sin desambiguar. La función instalada coincide con esa definición. Migración `20260924123000_communications_commerce_read_admin_state` aplicada el24/09/2026 09:16:25Z; código registrado en commit2e84daa6a del25/09. No hay diff local de esa migración ni del caso de uso de envío.

**Entrega SMTP no confirmada.** El caso de uso llama primero al proveedor y luego persiste el resultado/intento; el fallo del trigger puede impedir guardar tanto éxito como fallo. Por ello ausencia de delivery no prueba que SMTP no recibiera el mensaje. No se ejecutó retry, para no duplicar un envío potencialmente recibido.

## Relación con los cambios recientes

Los respaldos por archivo de `/tmp/ecommium-commercial-20261116/originals` y `/tmp/ecommium-regular-20261116/originals` no contienen modificaciones de After Sales ni Communications. El código SQL defectuoso y su instalación son anteriores. Los cambios de presentación de Postventa están documentados en `postventa-tabs-20261116.md`; su E2E usó BFF simulado y no certificó el flujo real. No explicarían un error SQL en Communications ni eventos de proyección con attempts0.

No puede atribuirse con esta evidencia toda la regresión a una persona o sesión. Sí queda demostrado un arranque operativo incompleto y un defecto previo de integración de Communications con ReadIndex. Las pruebas recientes de compra/Pricing no certifican postventa ni todos los relays administrativos.

## Recuperación necesaria, todavía no ejecutada

1. Incorporar los relays propietarios ya existentes al arranque/supervisión canónica usando sus perfiles y credenciales vigentes, sin otros workers paralelos ni llamadas owner como fallback de lectura BFF.
2. Corregir el trigger mediante migración nueva del owner Communications (variable inequívoca y columnas calificadas); no editar la migración histórica ni desactivar las proyecciones. Probar delivery+attempt real en PostgreSQL aislado, preservando identidad/idempotencia y privacidad.
3. Drenar los cinco eventos de proyección existentes, sin recrear el caso ni alterar published_at manualmente; exigir aplicación ReadIndex, caso visible y contador2 mediante BFF/UI.
4. Antes de recuperar el correo, contrastar aceptación SMTP; si procede, reintentar selectivamente la ejecución original, con autorización de envío y sin modificar reglas/plantillas. Su estado debe verificarse en Automation/Communications y proveedor.
5. Validar apertura/mensaje/evidencia/alerta/email y reinicio del stack. El recorrido completo de cierre/refund no se ejecutó ni se certifica en este diagnóstico.

Consultas realizadas: Prisma/SQL SELECT sobre Customers, After Sales, Automation y Communications; lectura de código/ADRs/migraciones; inventario de procesos y arranque canónico; inspección Playwright de Admin real. Datos locales técnicos sin secretos en `/tmp/ecommium-aftersales-diagnosis-20261116/` con resultados privados0600. Las consultas fallidas del diagnóstico fueron de introspección/campos/perfil de lectura; no produjeron mutaciones.

## Actualización posterior: reparación autorizada

[Recuperación ejecutada](after-sales-recovery-20261116.md): relays integrados al arranque, trigger corregido por nueva migración, cinco eventos originales recuperados y dos avisos visibles tras reinicio completo. Caso/mensaje/evidencia intactos. El envío original no se reintenta y su recepción permanece NO VALIDADA, pendiente de comprobar el buzón.

# Recuperación Postventa — 2026-11-16

Se corrigieron el arranque incompleto de los relays After Sales/Communications y el trigger SQL ambiguo de Communications. No se modificó código UI, contratos BFF, reglas, plantillas ni el expediente.

Admin real tras reinicio completo: caso ASC-ZKYB5R58JT del pedido10056 visible, testigo2 y dos filas de pendientes (Caso nuevo/Evidencia pendiente). Mensaje y evidencia privada conservados; imagen200/decodificada. Cuenta del cliente autenticada → Postventa → Mis casos: mismo expediente, un mensaje y una evidencia. Owner compara igual que antes: SUBMITTED y mismos timestamps/contadores. No se atiende/cierra ni recrea el caso.

Pruebas: Communications74, After Sales119, runtime/launcher3 y PostgreSQL real1 PASS; buildsPASS. SMTP Gmail autenticado sin envío. **Correo original NO VALIDADO:** ejecución sigueFAILED, sin entrega persistida; el usuario aún no ha comprobado el buzón. No se reenvía porque el proveedor pudo recibirlo antes del fallo de persistencia. No se declara un E2E de correo completo ni producción.

[Informe canónico, migración, comandos, recuperación y evidencias](../../../ecommium/composable_ecommerce/.docs/qa/after-sales-recovery-20261116.md). El diagnóstico inicial se conserva como histórico.

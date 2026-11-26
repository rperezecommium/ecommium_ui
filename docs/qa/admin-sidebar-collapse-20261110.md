# Plegado de navegación Admin — 2026-11-10

Referencias consultadas antes de implementar:
- https://atlassian.design/components/navigation-system/layout — navegación plegable, control explícito y transición.
- https://v10.carbondesignsystem.com/patterns/global-header/ — control para abrir navegación del producto.

Implementación: pestaña de borde de 22 × 36 px (reducida a petición del usuario), chevron direccional de 14 px, tooltip,
aria-expanded/aria-controls y navegación oculta inert. Transiciones de 160 ms
con prefers-reduced-motion. El shell sigue componiéndose en servidor y delega
solo el estado visual en AdminSidebarFrame. No hay persistencia ni llamadas BFF
nuevas. En escritorio recupera 248 px; bajo 1100 px el panel se superpone al
contenido y mantiene scroll propio.

Validación:
- npm run lint: correcto, 0 errores; 3 warnings preexistentes fuera del cambio.
- npm run build: correcto.
- Chrome, sesión existente con BFF disponible, ficha de producto: ocultar y
  mostrar verificados mediante árbol accesible y captura visual; contenido
  ensanchado y formulario conservado, sin guardar datos.
- No se ejecutaron suites E2E automatizadas, axe, pruebas responsive físicas
  ni Lighthouse/budgets. La comprobación manual fue de escritorio. No se
  ejecutaron comandos del backend ni se modificó su repositorio.

## Persistencia de posición

AdminSidebarFrame guarda expanded/collapsed en la cookie de preferencia visual
ecommium_admin_sidebar (Path=/admin, SameSite=Lax, un año; Secure con HTTPS).
AdminShell lee la preferencia en servidor para renderizar la posición inicial
sin esperar un efecto del navegador. No contiene identidad ni tokens y no
modifica cookies de sesión. Primera visita sin preferencia: menú abierto.

Validación: Chrome, ocultar y recargar conserva oculto; abrir y recargar conserva
abierto. Se comprobó Sin cambios antes de recargar. npm run lint sin errores
(tres avisos previos), npm run build correcto. No se ejecutaron Lighthouse,
axe, pruebas responsive ni E2E automatizadas para esta preferencia.

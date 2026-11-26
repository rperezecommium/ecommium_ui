# Cierre de CMS > Transición

Autorización: 24 de noviembre de 2026, UI y backend; laboratorio Barcelona/es-ES.
Registro histórico del proceso de conversión y publicación. No acredita por sí solo la construcción manual desde bibliotecas. El único seguimiento vigente del alcance posterior es [Cierre constructivo](cms-construction-demo-20261124/closure-status.md).

| Implementación | Estado | Problema, componentes y comprobación de cierre |
| --- | --- | --- |
| 1. Confirmar estado real | Completada | Pantalla Employee `/admin/cms/transicion` consultada en Chrome: 12 páginas, 6 independientes y 6 legacy (4 publicadas, 2 QA negativas). Headers/Footers originales y copias inventariados; navegación y ruta Builder todavía activas. Contraste con informe del 23/11. Servicios locales disponibles: UI307 sin sesión, BFF401 sin bearer; el aislamiento de terminal causaba el diagnóstico previo de indisponibilidad. |
| 2. Resolver bloqueos | Completada | Media de página de módulos, referencias QA y capacidades necesarias; conversión CMS/BFF/UI y recursos Media reales. |
| 3. Validar reproducciones | Completada | Edición, guardado, publicación, dinámicos, herencia y responsive de páginas y shell; comparar original/copia. |
| 4. Permisos y regresiones | Completada | Employee lector, cuatro fallos actuales, contratos y recorridos integrados. Los arreglos del harness pueden adelantarse para permitir verificar 2–3. |
| 5. Transición efectiva | Completada | Migración/publicación/asignación en laboratorio, recuperación y lectura Storefront. |
| 6. Retirada Builder | Completada | Eliminar únicamente accesos, rutas y código exclusivo cuando 1–5 estén acreditados. |
| 7. Certificación final | Completada | Recorrido posterior completo y regresión. |

## Baseline y evidencia

- `node --test tests/cms-*.test.mjs tests/contracts/cms-phase-*.test.mjs`: 86 PASS, 4 FAIL. Dos expectativas estáticas antiguas; harness renderer sin `design-settings`; harness cliente sin mock `server-only`.
- Existe el binario original `public/storefront/cms/consult-works-engineers.jpg`: se evaluará subirlo por Media antes de recurrir a una sustitución editorial.
- Chrome conserva sesión Employee válida en el contexto autorizado. No se extraen sus credenciales.
- Informes anteriores: [implementación 23/11](cms-builder-retirement-implementation-20261123.md), [Fase6](cms-phase-6-status-20261120.md). Sus resultados históricos no equivalen a certificación actual.

## Evidencia acumulada de cierre

- Reparación Media implementada en preview/migrate CMS/BFF/UI: mapa explícito, fuente/replay ligados a hash, control Media real y snapshot público intacto. Asset original subido por UI Employee: `83645ca6-2e1b-4dc0-abf6-1f9bb6da27e4`. No se sustituyó por otra imagen: se incorporó el archivo original al owner Media. Fondo reemplazable desde la edición de copia embebida.
- Se admitió únicamente el stack tipográfico ya usado por Consult works (`Impact, Haettenschweiler, Arial Narrow Bold, sans-serif`); no se abre CSS arbitrario.
- Página de módulos `85d5afdc-b5fe-46f1-9cd0-e468a44840e8`: borrador convertido mediante UI real. Lectura BFF pública antes/después: mismo snapshot de versión57; aún sin publicar la composición.
- QA missing/archived: versión1 original conservada; versión2 añade aviso editorial explícito y editable en lugar de referencia no resoluble, sin publicación. Ambos convertidos posteriormente al compositor. No se reactivó la definición archivada ni se borró la inexistente.
- Home original `ea43dfd4-3972-4a9f-bb4c-4a5762c2b15a`: conversión del borrador confirmada en UI. Publicación original aún preservada.
- Carencia de gestión resuelta: página incorpora editor de Secciones existente, con selección única, edición de copia y bloqueo de guardado mientras hay módulo pendiente. Playwright1440/768/390 PASS: edición, payload guardado, placement y segunda sección intactos.
- Última suite focalizada UI:106/106 PASS. Lint0 errores/3 avisos anteriores. Typecheck PASS. Build UI PASS en punto de control anterior a la última incorporación del editor embebido; repetir al cierre.
- CMS25 pruebas previas +3 reparación/tipografía PASS; BFF6 pruebas de migración PASS; PostgreSQL11 controles PASS (incluye mapa cambiado durante replay, rollback y publicación previa intacta).
- Cuenta lectora: detectada inconsistencia real del catálogo Employees; se añaden `cms.settings.read/write`, ya exigidos por BFF. Employees14 pruebas PASS y build PASS; reinicio selectivo local. Cuenta temporal autorizada por Ricardo, pruebas/retirada en curso. No se alteran permisos de empleados existentes.
- Baselines públicos y capturas en `cms-retirement-live-20261124/`: cuatro páginas1440/768/390. Todas HTTP200; overflow tablet768 previo presente en las cuatro, también en privacidad sin contenido complejo. No atribuirlo a la transición ni ocultarlo en la comparación.

- Cierre2: los dos QA ya abren en compositor y conservan su historial. La página de módulos se convirtió con Media original y tipografía conservada. El compositor permite editar sus secciones sin Builder; los fondos reparados ofrecen reemplazo Media. La conversión de shell sobre su propia identidad reutiliza PATCH con CAS; guarda solo draft y conserva asignaciones/publicación.
- Perfil lector real completado: ocho controles PASS de Sessions/BFF/UI, incluida denegación403 de cuatro mutaciones y tienda ajena,401 anónimo, login/contexto automático y ausencia de botones de escritura. Cuenta temporal desactivada y logout realizado. [Informe](cms-reader-live-20261124.json), [captura](cms-reader-live-20261124.png).
- Cierre4 aún no declarado: requiere repetir regresión tras la sustitución y retirada final.

## Cierre de 3–5 y puerta de retirada

- Las comprobaciones públicas de 3 se cierran después de publicar en 5: dependencia necesaria para validar el recorrido completo real, con recuperación acreditada antes de sustituir las otras páginas.
- [Publicación/recuperación/republicación real de Privacidad](cms-publication-recovery-live-20261124.json): PASS; snapshot anterior restaurado por comando CAS coordinado, borrador independiente conservado, replay idéntico y republicación desde Admin. No se añadieron endpoints de almacenamiento ni escrituras UI fuera de BFF.
- Fallo previo a efectos: la cuenta escritora temporal carecía de `routing-seo.routes.write`; se añadió solo a esta identidad. CMS distingue rechazo en GET previo a escrituras de fallo incierto de POST/PATCH. Solo el primero permite reintentar la misma reserva; PostgreSQL13 controles y adapter7 pruebas PASS. [Recuperación auditada](cms-routing-read-recovery-20261124.json).
- [Publicaciones originales de páginas](cms-pages-publication-live-20261124.json) y [shell](cms-shell-publication-live-20261124.json): mismas identidades, paths y rutas, historial anterior conservado. No se publicaron los QA missing/archived.
- [Inventario público final](cms-published-verification-20261124.json): cuatro páginas independientes, nueve superficies de shell con idénticas asignaciones, doce páginas editables independientes.
- [Shell público comparado](cms-retirement-live-20261124/shell-after.json):9/9 muestras con textos, enlaces y altura idénticos. Corregidos espacio18px Home y herencia tipográfica que añadía2px al header móvil; prueba específica de presentación PASS.
- [Páginas antes](cms-retirement-live-20261124/before.json)/[después](cms-retirement-live-20261124/after.json):12 muestras HTTP200, textos/enlaces idénticos, imágenes cargadas y sin errores JS; Home/Privacidad/BikeBrakes geometría de headings idéntica. En módulos, variación4.5px en posición final móvil al resolver el recurso/tipografía; sin pérdida de contenido, enlaces o interacción. Overflow tablet768 ya estaba en baseline.
- [Interacciones públicas](cms-public-functions-live-20261124.json):9 controles PASS, slider adelante/atrás, acceso de cuenta, campos de newsletter, privacidad y productos hidratados en tres anchos. No se enviaron comunicaciones.
- UI107/107 PASS antes de última regresión tipográfica; build PASS actual, prueba específica16/16 PASS. Navegador de módulos/secciones shell/compositor:3 anchos PASS cada uno, readonly, errores/reintentos y axe sin contraste. La exclusión de contraste es anterior y queda explícita: no certifica ausencia global de defectos a11y.

## Retirada y certificación posterior

- Eliminados menú/ruta `app/(admin)/admin/cms/builder/page.tsx`, pantalla/cliente exclusivos y `saveCmsBuilderDraftAction`; no quedan URLs activas al editor en app/src ni entrada en el manifiesto de build. La URL anterior llega al boundary de no encontrado (Next puede responder200 por streaming); no monta el editor retirado.
- Conservados renderers V1/V2 y de snapshots históricos, Media y editor visual compartidos. El control de tarjetas se extrajo antes de retirar el cliente; el slider reutiliza el editor estructurado existente. Los nombres técnicos de permiso/colección Media se conservan por compatibilidad, sin abrir Builder.
- UI108/108 PASS; CMS248/248 PASS (52 suites); BFF CMS81/81 PASS (13 suites). La ampliación BFF detectó mocks de interfaces antiguos, actualizados con sus métodos vigentes. PostgreSQL13 controles PASS; Employees14/14 PASS.
- Lint0 errores/3 avisos preexistentes; build y typecheck PASS. Se regeneraron tipos Next y se eliminó exclusivamente el tipo generado obsoleto de la ruta retirada.
- [Recorrido real posterior](cms-final-roundtrip-live-20261124.json): crear página, copiar dos secciones con identidades independientes, guardar, reabrir/editar/guardar, publicar por Admin y visualizar por Storefront. Página QA `65cc92ed-6f56-4912-b46d-54120e6b61f7` retirada después mediante despublicación UI, con historial conservado. La comprobación inicial de despublicación se adelantaba a la respuesta; el recibo BFF definitivo confirma UNPUBLISHED y ninguna operación pendiente.
- [Employee lector](cms-reader-live-20261124.json) repetido tras retirada:8 controles PASS y cuenta desactivada; incluye bloqueo BFF y ausencia de acciones UI.
- Navegador posterior: compositor y módulos PASS en1440/768/390; errores, payload conservado/replay, readonly y axe excluyendo contraste. La regresión shell y la comparación pública final se registran al concluir.

## Resultado definitivo

Las siete implementaciones quedan completadas en el laboratorio autorizado.
Builder está retirado; no quedan documentos necesarios cuya edición dependa de
su pantalla. Los doce documentos existentes son independientes; se añade un
decimotercero, creado y despublicado durante la certificación. Cuatro páginas
originales y cuatro site parts están publicados con sus identidades anteriores.

- [Certificación consolidada](cms-retirement-certification-20261124.json).
- [Media original entregada realmente](cms-media-delivery-live-20261124.json).
- [Cierre de cuentas temporales](cms-temporary-accounts-cleanup-20261124.json): logout-all200, cuentas inactivas, sesión escritora anterior401/403 y archivo de credenciales eliminado. No se cambiaron empleados humanos.
- Capturas de creación/edición y publicación: [Admin](cms-final-roundtrip-admin-20261124.png), [Storefront](cms-final-roundtrip-public-20261124.png).
- Verificación pública posterior:12/12 muestras HTTP200, sin errores JS y con imágenes cargadas; shell9/9 conserva texto, enlaces y altura. Interacciones9/9 PASS.
- Límites conservados y explícitos: laboratorio Barcelona/es-ES;3 avisos lint anteriores; overflow768 anterior; axe excluye contraste. La variación4.5px en módulos móvil tras resolver Media/tipografía no elimina contenido ni capacidad. La retirada no se presenta como despliegue ni certificación global de producción.

Contratos adaptados: mapa Media de migration-preview/migrate; catálogo Employees
para cms.settings.read/write; selección histórica restorePublished en PUBLISH.
Se reutilizan los endpoints existentes y el CAS de drafts/publicaciones/shell;
sin DDL, almacenamiento alternativo ni API Next de dominio.

Incidencias de contenido: imagen original subida al owner Media; ninguna imagen
ficticia. Dos referencias QA irresolubles sustituidas por avisos identificados
y editables, originales conservados en historial y nunca publicados.
No quedan bloqueos técnicos abiertos para retirar Builder en este alcance.

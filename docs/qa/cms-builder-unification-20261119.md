# Unificación de Builder, Headers y Footers — 2026-11-19

Se implementa la reutilización del editor existente, sin un inspector paralelo:

- `cms-visual-editor.tsx`: controles, árbol, catálogo, registro de estilos,
  mutadores, contenido, presets y serialización extraídos del Page Builder.
- `cms-visual-editing-panel.tsx`: composición de esos controles en site parts,
  Media, referencias compartidas y presentación de áreas/bloques funcionales.
- `cms-editor-history.ts`: transiciones de historial compartidas.
- `CmsPresentationView` y `CmsBlockRenderer`: representación compartida de
  presentación y módulos visuales; CSS público responsive acotado por nodo.
- `CmsSystemBlockView`: representación de bloques de sistema compartida por
  tienda y preview. Cuenta/carrito son inertes en preview; no se envían formularios.
- Los dos builders se cargan dinámicamente. Las tres cajas siguen independientes
  y a ancho completo: canvas, elementos e inspector.

Guardado: los módulos inline usan v2 y las referencias usan
`{definitionId, contentValues}`. Áreas y bloques funcionales conservan presentación
opcional con la gramática v2, validada en BFF y CMS. Resolver shell usa las mismas
definiciones ACTIVE que páginas, con contenido por instancia. Presets locales
comparten clave y versionado con Builder. Una referencia no disponible se conserva
sin ofrecer la edición de una copia ficticia. Las subidas deshabilitan guardar y
publicar mientras están pendientes; una respuesta tardía no sustituye un bloque
desmontado y combina el estado vigente del módulo.

Comprobaciones ejecutadas:

| Superficie | Comando / resultado |
| --- | --- |
| UI | `npm test`: 733/733 |
| UI | `npm run lint`: 0 errores; 3 avisos preexistentes en clientes/request-client/invoice PDF |
| UI | `npm run build`: correcto |
| CMS | Jest completo: 44 suites, 193/193 |
| CMS | `npm run build`: correcto |
| BFF | Jest `src/modules/cms src/shared/cms-client`: 8 suites, 43/43 |
| BFF | ESLint focalizado en archivos cambiados: correcto |
| BFF | `npm run build`: correcto |
| BFF | `npm run manifest:routes:check`: vigente, 538 endpoints; sin rutas nuevas |
| Navegador | `node tests/e2e/cms-unified-builder-browser.mjs`: 1440, 768 y 390 px |

Chromium monta el editor real con acciones de guardado simuladas: crea v2,
deshace/rehace, edita estilos base/mobile de un área, guarda, remonta y comprueba
su conservación; ejecuta axe sobre Inspector (sin contraste); comprueba estilos
públicos responsive y viewport explícito. Las pruebas SSR verifican presets,
serialización compacta, historial y rechazo/escape de CSS malicioso. CMS comprueba
roundtrip real de entidades/use cases draft → publish → resolve con repositorio
en memoria, más referencias ACTIVE y ausencia de definiciones. BFF comprueba
validación de presentación y mantiene pruebas de guards existentes.

Lint CMS: el servicio no contiene configuración ESLint propia. Se ejecutó ESLint
programático con el parser instalado y `plugin:@typescript-eslint/recommended`:
aparecen tres diagnósticos previos (`_ignored`, `_hydration`, `cloneJsonValue`) en
archivos existentes; no se cambió la configuración ni se suprimieron reglas.

Runtime local actualizado con Node 22:
`./scripts/postman-services.sh restart-selected cms bff-admin`.
Ambos health listos: CMS :3017 y BFF Admin :3026.

Límites: las pruebas no publican, asignan ni eliminan contenido real y no
sustituyen una sesión Employee conectada. No se ejecutaron Lighthouse ni upload
Media real en esta entrega. Una imagen publicada requiere URL pública devuelta
por Media; el proxy privado Admin no garantiza acceso público y se descarta al
persistir. La preview usa datos operativos disponibles y cuenta/carrito inertes;
los controles de estilos por dispositivo no sustituyen QA de la página completa
en cada viewport. No se certifica producción. Sin migraciones nuevas.

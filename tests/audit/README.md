# Auditoría reproducible de Productos

`npm run audit:products` ejecuta lint, build, unitarias y la selección de catálogo de `admin-login.spec.ts` con BFF simulado. Genera `stages.json`, logs, `e2e.json`, `report.json`, `report.md` y evidencia Playwright en `artifacts/products-audit/<fecha>/`. No habilita el laboratorio de retirada real. No certifica servicios reales ni cobertura completa; las coincidencias de la matriz son una ayuda de inventario.

Para regenerar un informe existente sin repetir mutaciones:

```sh
node scripts/audit-products.mjs --collect-only --results=artifacts/products-audit/20261111/maintained
```

Los dos nuevos escenarios de desactivación/retirada de servicios fallan intencionadamente contra el comportamiento actual para detectar la regresión; sus expectativas expresan el resultado correcto, no están marcados como expected-failure. El caso nuevo de transporte + SEO pasa. El informe narrativo y la distinción entre deuda de tests y defectos confirmados están en `docs/qa/products-audit-20261111.md`.

## Spec real optativo

`tests/e2e/products-live-audit.spec.ts` no se ejecuta por defecto. Requiere `PRODUCTS_LIVE_AUDIT=true`, `PRODUCTS_AUDIT_CREDENTIALS_FILE` y un UUID de producto QA explícito según las variables del spec. El fichero de credenciales utiliza el formato de valores Postman existente; no copiar contraseñas a tests, logs o repositorio. La URL se limita a localhost/127 y el spec comprueba el SKU QA antes de mutar.

Usar un conjunto QA aislado y revisar el estado antes de repetir: el flujo no debe tratarse como idempotente sobre cualquier producto existente. No utilizar el Argon original ni datos de negocio. La primera ejecución real de esta auditoría falló en login; las comprobaciones reales posteriores fueron manuales con sesión iniciada por el usuario. El borrado permanente exige confirmación específica y no está autorizado por ejecutar este runner.

Los artefactos locales se ignoran en Git; las capturas versionables de esta auditoría están en `docs/qa/evidence/products-audit-20261111/` y solo muestran datos sintéticos de QA y contexto operativo.

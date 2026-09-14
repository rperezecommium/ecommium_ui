"use client";

import { useState } from "react";
import type { ConsentConfiguration, ConsentIntegrationCatalogEntry, ConsentPolicy, ConsentScopeType, ConsentSystemProfile } from "./consent-configuration-admin";
import { saveConsentDraftAction } from "./consent-configuration-admin-actions";
import { ConsentConfigurationPreview } from "./consent-configuration-preview";

const initialPolicy = (locale: string): ConsentPolicy => ({
  firstLayerRejectAction: true, optionalPurposesPreselected: false,
  purposes: [{ purposeKey: "necessary", necessary: true, content: { [locale]: { title: "Necesarias", description: "Seguridad y funcionamiento de la tienda." } } }],
  services: [{ serviceKey: "turnstile", purposeKeys: ["necessary"], thirdParty: true, content: { [locale]: { name: "Cloudflare Turnstile", description: "Prevención de abuso en el registro." } } }],
  resources: [{ resourceKey: "turnstile-script", serviceKey: "turnstile", purposeKeys: ["necessary"], resourceType: "SCRIPT", classification: "NECESSARY", cleanupRequired: true }],
});
const key = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
const integrationServiceKey = (providerKey: string, services: ConsentPolicy["services"]) => {
  const base = `${providerKey}-service`;
  let candidate = base;
  let sequence = 2;
  while (services.some((service) => service.serviceKey === candidate)) candidate = `${base}-${sequence++}`;
  return candidate;
};
const purposeContent = (purposeKey: string) => purposeKey === "analytics"
  ? { title: "Analítica", description: "Medición de audiencia y uso de la tienda." }
  : purposeKey === "marketing"
    ? { title: "Marketing", description: "Medición de campañas y publicidad opcional." }
  : { title: purposeKey, description: "Finalidad opcional." };
const scopeLabel = (scopeType: ConsentScopeType) => scopeType === "SHOP" ? "esta Shop" : "esta Organization";
const purposeLabel = (policy: ConsentPolicy, purposeKey: string, locale: string) => {
  const purpose = policy.purposes.find((candidate) => candidate.purposeKey === purposeKey);
  const title = purpose?.content[locale]?.title ?? purposeKey;
  return `${title} (${purpose?.necessary ? "necesaria" : "opcional"})`;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- referencia temporal del editor completo durante la migracion de Consent.
function LegacyConsentConfigurationForm({ configuration, inheritedConfiguration, integrationCatalog, integrationCatalogError, scopeType }: { configuration: ConsentConfiguration | null; inheritedConfiguration?: ConsentConfiguration | null; integrationCatalog: ConsentIntegrationCatalogEntry[]; integrationCatalogError?: string; scopeType: ConsentScopeType }) {
  const initialConfiguration = configuration ?? inheritedConfiguration;
  const locale = initialConfiguration?.defaultLocale ?? "es-ES";
  const [policy, setPolicy] = useState<ConsentPolicy>(initialConfiguration?.policy ?? initialPolicy(locale));
  const [profile, setProfile] = useState<ConsentSystemProfile>(initialConfiguration?.systemProfile ?? "ES_AEPD");
  const [defaultLocale, setDefaultLocale] = useState(locale);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [integrationNotice, setIntegrationNotice] = useState("");
  const updatePurpose = (index: number, patch: Partial<ConsentPolicy["purposes"][number]>) => setPolicy((current) => ({ ...current, purposes: current.purposes.map((item, position) => position === index ? { ...item, ...patch } : item) }));
  const updateService = (index: number, patch: Partial<ConsentPolicy["services"][number]>) => setPolicy((current) => ({ ...current, services: current.services.map((item, position) => position === index ? { ...item, ...patch } : item) }));
  const updateResource = (index: number, patch: Partial<ConsentPolicy["resources"][number]>) => setPolicy((current) => ({ ...current, resources: current.resources.map((item, position) => position === index ? { ...item, ...patch } : item) }));
  const addIntegration = () => {
    const entry = integrationCatalog.find((candidate) => `${candidate.providerKey}@${candidate.contractVersion}` === selectedProvider);
    if (!entry) return;
    if (policy.services.some((service) => service.integration?.providerKey === entry.providerKey && service.integration.contractVersion === entry.contractVersion)) {
      setIntegrationNotice("Esta integración ya está declarada en el borrador.");
      return;
    }
    const existingPurpose = policy.purposes.find((purpose) => purpose.purposeKey === entry.requiredPurposeKey);
    if (entry.requiredPurposeClassification !== "OPTIONAL" || existingPurpose?.necessary) {
      setIntegrationNotice(`La finalidad ${entry.requiredPurposeKey} debe ser opcional para añadir ${entry.displayName}.`);
      return;
    }
    const serviceKey = integrationServiceKey(entry.providerKey, policy.services);
    setPolicy({
      ...policy,
      purposes: existingPurpose ? policy.purposes : [...policy.purposes, { purposeKey: entry.requiredPurposeKey, necessary: false, content: { [defaultLocale]: purposeContent(entry.requiredPurposeKey) } }],
      services: [...policy.services, {
        serviceKey,
        purposeKeys: [entry.requiredPurposeKey],
        thirdParty: entry.thirdParty,
        content: { [defaultLocale]: { name: entry.displayName, description: "Tecnología opcional declarada por la tienda." } },
        integration: { providerKey: entry.providerKey, contractVersion: entry.contractVersion, enabled: true, publicConfig: Object.fromEntries(entry.fields.map((field) => [field.key, ""])) },
      }],
      resources: [...policy.resources, ...entry.requiredResourceTypes.map((resourceType) => ({ resourceKey: `${serviceKey}-${resourceType.toLowerCase()}`, serviceKey, purposeKeys: [entry.requiredPurposeKey], resourceType, classification: entry.requiredPurposeClassification, cleanupRequired: true }))],
    });
    setIntegrationNotice("");
    setSelectedProvider("");
  };
  const managedServices = policy.services.filter((service) => service.integration);
  const declaredServices = policy.services.filter((service) => !service.integration);
  return <form action={saveConsentDraftAction} className="adminCard adminFormStack consentConfigurationForm">
    <input name="configurationVersionId" type="hidden" value={configuration?.configurationVersionId ?? ""} />
    <input name="expectedUpdatedAt" type="hidden" value={configuration?.updatedAt ?? ""} />
    <input name="policy" type="hidden" value={JSON.stringify(policy)} />
    {inheritedConfiguration && !configuration ? <div className="adminBanner adminBannerInfo"><strong>Nuevo override de {scopeType === "SHOP" ? "esta Shop" : "esta Organization"}.</strong><p>Parte de la configuración heredada para que puedas ajustarla aquí. Guardar no cambia el nivel de origen.</p></div> : null}
    <label className="adminField"><span>Scope</span><select defaultValue={configuration?.scopeType ?? scopeType} disabled={Boolean(configuration)} name="scopeType"><option value="SHOP">Shop activa</option><option value="ORGANIZATION">Organization</option></select>{configuration ? <input name="scopeType" type="hidden" value={configuration.scopeType} /> : null}</label>
    <label className="adminField"><span>Locale por defecto</span><input name="defaultLocale" onChange={(event) => setDefaultLocale(event.target.value)} value={defaultLocale} /></label>
    <label className="adminField"><span>Locales soportados</span><input defaultValue={initialConfiguration?.supportedLocales.join(", ") ?? locale} name="supportedLocales" placeholder="es-ES, en-GB" /></label>
    <label className="adminField"><span>Perfil regulatorio</span><select name="systemProfile" onChange={(event) => setProfile(event.target.value as ConsentSystemProfile)} value={profile}><option value="ES_AEPD">España (AEPD)</option><option value="EU_BASELINE">Base UE</option></select></label>
    <label className="adminSwitch"><input checked={profile === "ES_AEPD" ? true : policy.firstLayerRejectAction} onChange={(event) => setPolicy({ ...policy, firstLayerRejectAction: event.target.checked })} type="checkbox" /><span>Mostrar Rechazar en primera capa</span></label>
    <label className="adminSwitch"><input checked={profile === "ES_AEPD" ? false : policy.optionalPurposesPreselected} disabled={profile === "ES_AEPD"} onChange={(event) => setPolicy({ ...policy, optionalPurposesPreselected: event.target.checked })} type="checkbox" /><span>Preseleccionar finalidades opcionales</span></label>
    <section className="consentFormSection"><h2>Finalidades</h2><p className="adminHelpText">Explican al usuario para qué se usa cada tecnología. Las necesarias siempre permanecen activas.</p>{policy.purposes.map((purpose, index) => <div className="consentInlineFields" key={`${purpose.purposeKey}-${index}`}><label className="adminField"><span>Clave interna</span><input aria-label="Clave de finalidad" onChange={(event) => updatePurpose(index, { purposeKey: key(event.target.value) })} value={purpose.purposeKey} /></label><label className="adminField"><span>Título visible</span><input aria-label="Título" onChange={(event) => updatePurpose(index, { content: { ...purpose.content, [defaultLocale]: { ...purpose.content[defaultLocale], title: event.target.value } } })} value={purpose.content[defaultLocale]?.title ?? ""} /></label><label className="adminField"><span>Descripción visible</span><input aria-label="Descripción" onChange={(event) => updatePurpose(index, { content: { ...purpose.content, [defaultLocale]: { ...purpose.content[defaultLocale], description: event.target.value } } })} value={purpose.content[defaultLocale]?.description ?? ""} /></label><label className="adminCheckbox"><input checked={purpose.necessary} onChange={(event) => updatePurpose(index, { necessary: event.target.checked })} type="checkbox" />Necesaria</label><button className="adminButton adminButtonTiny" disabled={policy.purposes.length === 1} onClick={() => setPolicy({ ...policy, purposes: policy.purposes.filter((_, position) => position !== index) })} type="button">Quitar</button></div>)}<button className="adminButton" onClick={() => setPolicy({ ...policy, purposes: [...policy.purposes, { purposeKey: "preferences", necessary: false, content: { [defaultLocale]: { title: "Preferencias", description: "Personalización opcional." } } }] })} type="button">Añadir finalidad</button></section>
    <section aria-labelledby="consent-integrations-title" className="consentFormSection consentIntegrationsSection"><div className="adminCardHeader"><div><h2 id="consent-integrations-title">Integraciones aprobadas</h2><p>Elige una herramienta disponible y pega únicamente el identificador que solicita. Se aplicará en {scopeLabel(scopeType)}.</p></div></div>{integrationCatalogError ? <div className="adminBanner adminBannerError">No se pudo cargar el catálogo aprobado: {integrationCatalogError}</div> : <div className="consentProviderSelector"><label className="adminField"><span>Proveedor disponible</span><select aria-label="Proveedor aprobado" onChange={(event) => setSelectedProvider(event.target.value)} value={selectedProvider}><option value="">Selecciona una integración aprobada</option>{integrationCatalog.map((entry) => <option key={`${entry.providerKey}@${entry.contractVersion}`} value={`${entry.providerKey}@${entry.contractVersion}`}>{entry.displayName}</option>)}</select></label><button className="adminButton adminButtonPrimary" disabled={!selectedProvider} onClick={addIntegration} type="button">Añadir proveedor</button></div>}{integrationCatalog.length === 0 && !integrationCatalogError ? <p className="adminHelpText">No hay proveedores disponibles ahora. Un proveedor solo aparece aquí cuando puede cargarse y retirarse de forma segura.</p> : null}{integrationNotice ? <p className="adminHelpText" role="status">{integrationNotice}</p> : null}{managedServices.map((service) => {
      const index = policy.services.indexOf(service);
      const entry = integrationCatalog.find((candidate) => candidate.providerKey === service.integration?.providerKey && candidate.contractVersion === service.integration?.contractVersion);
      const integration = service.integration!;
      return <section className="adminCard consentIntegrationCard" key={service.serviceKey}><div className="adminCardHeader"><div><h3>{entry?.displayName ?? service.content[defaultLocale]?.name ?? "Integración aprobada"}</h3><p>{entry?.description ?? "Proveedor gestionado. Su carga real queda bloqueada hasta que Storefront reciba consentimiento válido."}</p></div><button className="adminButton adminButtonTiny" onClick={() => setPolicy({ ...policy, services: policy.services.filter((candidate) => candidate.serviceKey !== service.serviceKey), resources: policy.resources.filter((resource) => resource.serviceKey !== service.serviceKey) })} type="button">Quitar integración</button></div>{entry ? <><div className="consentIntegrationMeta"><span>Finalidad: <strong>{purposeLabel(policy, entry.requiredPurposeKey, defaultLocale)}</strong></span><span>Se aplica en: <strong>{scopeLabel(scopeType)}</strong></span></div><div className="consentInlineFields"><label className="adminField"><span>Nombre visible</span><input aria-label={`Nombre de ${entry.displayName}`} onChange={(event) => updateService(index, { content: { ...service.content, [defaultLocale]: { ...service.content[defaultLocale], name: event.target.value } } })} value={service.content[defaultLocale]?.name ?? ""} /></label>{entry.fields.map((field) => <label className="adminField" key={field.key}><span>{field.label}</span><input aria-label={`${field.label} de ${entry.displayName}`} maxLength={field.maxLength} onChange={(event) => updateService(index, { integration: { ...integration, publicConfig: { ...integration.publicConfig, [field.key]: event.target.value.trim() } } })} pattern={field.pattern} placeholder={field.helpText} required={field.required} value={integration.publicConfig[field.key] ?? ""} /><small>{field.helpText}</small></label>)}</div></> : <div className="adminBanner adminBannerError">No se puede editar esta integración sin su especificación aprobada. Recupera el catálogo antes de guardar.</div>}</section>;
    })}</section>
    <section className="consentManualSection"><h2>Inventario técnico avanzado</h2><p className="adminHelpText">Estos servicios y recursos no instalan software ni crean cookies. Solo describen tecnologías ya usadas por la tienda. Para añadir un tercero nuevo usa Integraciones aprobadas.</p><h3>Servicios declarados</h3>{declaredServices.map((service) => { const index = policy.services.indexOf(service); return <div className="consentInlineFields" key={`${service.serviceKey}-${index}`}><label className="adminField"><span>Clave del servicio</span><input aria-label="Clave de servicio" onChange={(event) => updateService(index, { serviceKey: key(event.target.value) })} value={service.serviceKey} /></label><label className="adminField"><span>Finalidad asociada</span><input aria-label="Finalidades del servicio" onChange={(event) => updateService(index, { purposeKeys: event.target.value.split(",").map(key).filter(Boolean) })} value={service.purposeKeys.join(", ")} /></label><label className="adminField"><span>Nombre visible</span><input aria-label="Nombre del servicio" onChange={(event) => updateService(index, { content: { ...service.content, [defaultLocale]: { ...service.content[defaultLocale], name: event.target.value } } })} value={service.content[defaultLocale]?.name ?? ""} /></label><label className="adminCheckbox"><input checked={service.thirdParty} onChange={(event) => updateService(index, { thirdParty: event.target.checked })} type="checkbox" />Tercero</label><button className="adminButton adminButtonTiny" onClick={() => setPolicy({ ...policy, services: policy.services.filter((candidate) => candidate.serviceKey !== service.serviceKey), resources: policy.resources.filter((resource) => resource.serviceKey !== service.serviceKey) })} type="button">Quitar</button></div>; })}<h3>Recursos tecnológicos declarados</h3><p className="adminHelpText">Un recurso solo queda registrado. “Limpieza al retirar” no borra nada hasta que exista un limpiador revisado para esa tecnología.</p>{policy.resources.filter((resource) => !policy.services.find((service) => service.serviceKey === resource.serviceKey)?.integration).map((resource) => { const index = policy.resources.indexOf(resource); return <div className="consentInlineFields" key={`${resource.resourceKey}-${index}`}><label className="adminField"><span>Clave del recurso</span><input aria-label="Clave de recurso" onChange={(event) => updateResource(index, { resourceKey: key(event.target.value) })} value={resource.resourceKey} /></label><label className="adminField"><span>Servicio asociado</span><select aria-label="Servicio del recurso" onChange={(event) => updateResource(index, { serviceKey: event.target.value })} value={resource.serviceKey}>{declaredServices.map((service) => <option key={service.serviceKey} value={service.serviceKey}>{service.serviceKey}</option>)}</select></label><label className="adminField"><span>Tipo de recurso</span><select aria-label="Tipo de recurso" onChange={(event) => updateResource(index, { resourceType: event.target.value as ConsentPolicy["resources"][number]["resourceType"] })} value={resource.resourceType}>{["COOKIE", "LOCAL_STORAGE", "SESSION_STORAGE", "INDEXED_DB", "SCRIPT", "PIXEL", "IFRAME", "REQUEST"].map((type) => <option key={type}>{type}</option>)}</select></label><label className="adminCheckbox"><input checked={resource.cleanupRequired} onChange={(event) => updateResource(index, { cleanupRequired: event.target.checked })} type="checkbox" />Limpieza al retirar</label><button className="adminButton adminButtonTiny" onClick={() => setPolicy({ ...policy, resources: policy.resources.filter((candidate) => candidate.resourceKey !== resource.resourceKey) })} type="button">Quitar</button></div>; })}</section>
    <ConsentConfigurationPreview locale={defaultLocale} policy={policy} />
    <p className="adminHelpText">La UI no acepta scripts, HTML, URLs de carga, posición de header/footer ni secretos. Cada proveedor requiere un adapter revisado y una regla CSP propia antes de poder aparecer en el catálogo.</p>
    <button className="adminButton adminButtonPrimary" type="submit">{configuration ? "Guardar borrador" : "Crear borrador"}</button>
  </form>;
}

/**
 * Presentación operativa: no expone el inventario interno porque no instala ni
 * retira nada por sí mismo. Los datos ya existentes se preservan al guardar.
 */
export function ConsentConfigurationForm({ configuration, inheritedConfiguration, integrationCatalog, integrationCatalogError, scopeType }: { configuration: ConsentConfiguration | null; inheritedConfiguration?: ConsentConfiguration | null; integrationCatalog: ConsentIntegrationCatalogEntry[]; integrationCatalogError?: string; scopeType: ConsentScopeType }) {
  const source = configuration ?? inheritedConfiguration;
  const defaultLocale = source?.defaultLocale ?? "es-ES";
  const [policy, setPolicy] = useState<ConsentPolicy>(source?.policy ?? initialPolicy(defaultLocale));
  const [selectedProvider, setSelectedProvider] = useState("");
  const [integrationNotice, setIntegrationNotice] = useState("");
  const selectedEntry = integrationCatalog.find((entry) => `${entry.providerKey}@${entry.contractVersion}` === selectedProvider);
  const managedServices = policy.services.filter((service) => service.integration);
  const visiblePurposes = policy.purposes.filter((purpose) => purpose.necessary || managedServices.some((service) => service.purposeKeys.includes(purpose.purposeKey)));

  const updateService = (serviceKey: string, patch: Partial<ConsentPolicy["services"][number]>) => setPolicy((current) => ({ ...current, services: current.services.map((service) => service.serviceKey === serviceKey ? { ...service, ...patch } : service) }));
  const updatePurpose = (purposeKey: string, content: { title: string; description: string }) => setPolicy((current) => ({ ...current, purposes: current.purposes.map((purpose) => purpose.purposeKey === purposeKey ? { ...purpose, content: { ...purpose.content, [defaultLocale]: content } } : purpose) }));

  const addIntegration = () => {
    if (!selectedEntry) return;
    if (managedServices.some((service) => service.integration?.providerKey === selectedEntry.providerKey && service.integration.contractVersion === selectedEntry.contractVersion)) {
      setIntegrationNotice(`${selectedEntry.displayName} ya está configurado.`);
      return;
    }
    const serviceKey = integrationServiceKey(selectedEntry.providerKey, policy.services);
    setPolicy((current) => ({
      ...current,
      purposes: current.purposes.some((purpose) => purpose.purposeKey === selectedEntry.requiredPurposeKey) ? current.purposes : [...current.purposes, { purposeKey: selectedEntry.requiredPurposeKey, necessary: false, content: { [defaultLocale]: purposeContent(selectedEntry.requiredPurposeKey) } }],
      services: [...current.services, { serviceKey, purposeKeys: [selectedEntry.requiredPurposeKey], thirdParty: true, content: { [defaultLocale]: { name: selectedEntry.displayName, description: selectedEntry.description } }, integration: { providerKey: selectedEntry.providerKey, contractVersion: selectedEntry.contractVersion, enabled: true, publicConfig: Object.fromEntries(selectedEntry.fields.map((field) => [field.key, ""])) } }],
      resources: [...current.resources, ...selectedEntry.requiredResourceTypes.map((resourceType) => ({ resourceKey: `${serviceKey}-${resourceType.toLowerCase()}`, serviceKey, purposeKeys: [selectedEntry.requiredPurposeKey], resourceType, classification: "OPTIONAL" as const, cleanupRequired: true }))],
    }));
    setIntegrationNotice(`Completa el identificador de ${selectedEntry.displayName} y guarda el borrador.`);
  };

  const removeIntegration = (serviceKey: string) => {
    setPolicy((current) => ({ ...current, services: current.services.filter((service) => service.serviceKey !== serviceKey), resources: current.resources.filter((resource) => resource.serviceKey !== serviceKey) }));
    setIntegrationNotice("El proveedor se quitará al guardar el borrador. La versión publicada no cambia hasta publicar una revisión.");
  };

  return <form action={saveConsentDraftAction} className="adminForm consentConfigurationForm">
    <input name="configurationVersionId" type="hidden" value={configuration?.configurationVersionId ?? ""} />
    <input name="expectedUpdatedAt" type="hidden" value={configuration?.updatedAt ?? ""} />
    <input name="scopeType" type="hidden" value={scopeType} />
    <input name="defaultLocale" type="hidden" value={defaultLocale} />
    <input name="supportedLocales" type="hidden" value={source?.supportedLocales.join(", ") ?? defaultLocale} />
    <input name="systemProfile" type="hidden" value={source?.systemProfile ?? "ES_AEPD"} />
    <input name="policy" type="hidden" value={JSON.stringify(policy)} />
    {inheritedConfiguration && !configuration ? <div className="adminBanner adminBannerInfo">Esta versión parte de la Organization. Al guardarla crearás una configuración propia para {scopeLabel(scopeType)}.</div> : null}

    <div className="consentConfigurationWorkspace">
    <div className="consentConfigurationEditorColumn">
    <section aria-labelledby="consent-approved-services-title" className="consentFormSection consentIntegrationsSection">
      <div className="adminCardHeader"><div><h2 id="consent-approved-services-title">Servicios aprobados</h2><p>Elige una herramienta y pega únicamente el identificador que te entrega. La carga se bloqueará hasta que la persona acepte.</p></div></div>
      {integrationCatalogError ? <div className="adminBanner adminBannerError">No se pudo cargar el catálogo aprobado: {integrationCatalogError}</div> : <div className="consentProviderSelector"><label className="adminField"><span>Herramienta</span><select aria-label="Proveedor aprobado" onChange={(event) => setSelectedProvider(event.target.value)} value={selectedProvider}><option value="">Elige un servicio para configurar</option>{integrationCatalog.map((entry) => <option key={`${entry.providerKey}@${entry.contractVersion}`} value={`${entry.providerKey}@${entry.contractVersion}`}>{entry.displayName}</option>)}</select></label><button className="adminButton adminButtonPrimary" disabled={!selectedEntry} onClick={addIntegration} type="button">Añadir y configurar</button></div>}
      {selectedEntry ? <div className="adminBanner adminBannerInfo"><strong>{selectedEntry.displayName}</strong><p>{selectedEntry.description}</p><p>Se pedirá permiso para {purposeContent(selectedEntry.requiredPurposeKey).title.toLowerCase()}.</p></div> : null}
      {integrationCatalog.length === 0 && !integrationCatalogError ? <p className="adminHelpText">No hay servicios disponibles ahora.</p> : null}
      {integrationNotice ? <p className="adminHelpText" role="status">{integrationNotice}</p> : null}
      {managedServices.length === 0 ? <p className="adminHelpText">Aún no hay servicios opcionales. Sin identificador guardado, Storefront no carga servicios externos.</p> : null}
      {managedServices.map((service) => {
        const integration = service.integration!;
        const entry = integrationCatalog.find((candidate) => candidate.providerKey === integration.providerKey && candidate.contractVersion === integration.contractVersion);
        if (!entry) return <div className="adminBanner adminBannerError" key={service.serviceKey}>Esta integración ya no está aprobada. Recarga el catálogo antes de guardar.</div>;
        return <article className="adminCard consentIntegrationCard" key={service.serviceKey}><div className="adminCardHeader"><div><h3>{entry.displayName}</h3><p>{entry.description}</p></div><button className="adminButton adminButtonTiny" onClick={() => removeIntegration(service.serviceKey)} type="button">Quitar</button></div><p className="adminHelpText">Se activa solo al aceptar {purposeContent(entry.requiredPurposeKey).title.toLowerCase()} en {scopeLabel(scopeType)}.</p><div className="consentInlineFields">{entry.fields.map((field) => <label className="adminField" key={field.key}><span>{field.label}</span><input aria-label={`${field.label} de ${entry.displayName}`} maxLength={field.maxLength} onChange={(event) => updateService(service.serviceKey, { integration: { ...integration, publicConfig: { ...integration.publicConfig, [field.key]: event.target.value.trim() } } })} pattern={field.pattern} placeholder={field.helpText} required={field.required} value={integration.publicConfig[field.key] ?? ""} /><small>{field.helpText}</small></label>)}</div></article>;
      })}
    </section>
    <details className="consentAdvancedSettings"><summary>Ajustes del banner</summary><p className="adminHelpText">En España, rechazar las opciones debe estar disponible desde el primer paso.</p><label className="adminCheckbox"><input checked={policy.firstLayerRejectAction} onChange={(event) => setPolicy({ ...policy, firstLayerRejectAction: event.target.checked })} type="checkbox" />Mostrar “Rechazar opcionales” al inicio</label></details>
    </div>
    <div className="consentConfigurationPreviewColumn">
      <section aria-labelledby="consent-customer-copy-title" className="consentFormSection"><h2 id="consent-customer-copy-title">Texto que verá el cliente</h2><p className="adminHelpText">Explica para qué se utiliza cada categoría. Las necesarias siempre permanecen activas.</p>{visiblePurposes.map((purpose) => { const content = purpose.content[defaultLocale] ?? { title: "", description: "" }; return <div className="consentInlineFields" key={purpose.purposeKey}><label className="adminField"><span>Título</span><input aria-label={`Título de ${purpose.purposeKey}`} onChange={(event) => updatePurpose(purpose.purposeKey, { ...content, title: event.target.value })} value={content.title} /></label><label className="adminField"><span>Explicación</span><input aria-label={`Explicación de ${purpose.purposeKey}`} onChange={(event) => updatePurpose(purpose.purposeKey, { ...content, description: event.target.value })} value={content.description} /></label><span className="consentPurposeStatus">{purpose.necessary ? "Siempre activa" : "Opcional"}</span></div>; })}</section>
      <ConsentConfigurationPreview locale={defaultLocale} policy={policy} />
    </div>
    </div>
    <p className="adminHelpText">No pegues scripts, HTML ni URLs. Esta lista solo contiene servicios que ya tienen una integración revisada.</p>
    <button className="adminButton adminButtonPrimary" type="submit">{configuration ? "Guardar borrador" : "Crear borrador"}</button>
  </form>;
}

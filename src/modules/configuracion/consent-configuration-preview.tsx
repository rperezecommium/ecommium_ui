import { storefrontConsentCopy } from "../storefront/storefront-consent-copy";
import type { ConsentPolicy } from "./consent-configuration-admin";

type LocalizedPurpose = ConsentPolicy["purposes"][number]["content"][string] | undefined;

function localizedPurpose(
  purpose: ConsentPolicy["purposes"][number],
  locale: string,
): LocalizedPurpose {
  return purpose.content[locale] ?? Object.values(purpose.content)[0];
}

/**
 * Representación local del borrador. No recibe ni ejecuta URLs, HTML o código
 * de integraciones: el propósito es revisar la información que se guardaría.
 */
export function ConsentConfigurationPreview({ locale, policy }: { locale: string; policy: ConsentPolicy }) {
  const copy = storefrontConsentCopy(locale);
  const configuredServices = policy.services.filter((service) => service.integration);

  return <section className="consentDraftPreview" aria-labelledby="consent-draft-preview-title">
    <div className="consentDraftPreviewHeader">
      <div>
        <h2 id="consent-draft-preview-title">Previsualización segura</h2>
        <p>Representa el borrador local. No guarda cambios ni carga tecnologías.</p>
      </div>
      <span className="consentDraftPreviewBadge">Local</span>
    </div>
    <div className="consentDraftPreviewCanvas">
      <p className="consentDraftPreviewEyebrow">{copy.eyebrow}</p>
      <h3>{copy.title}</h3>
      <p>{copy.description}</p>
      <div className="consentDraftPreviewActions" aria-label="Acciones representadas">
        {policy.firstLayerRejectAction ? <span className="consentDraftPreviewButton">{copy.reject}</span> : null}
        <span className="consentDraftPreviewButton">{copy.configure}</span>
        <span className="consentDraftPreviewButton consentDraftPreviewButtonPrimary">{copy.accept}</span>
      </div>
      <div className="consentDraftPreviewPurposes">
        <h4>{copy.settingsTitle}</h4>
        <ul>
          {policy.purposes.map((purpose) => {
            const content = localizedPurpose(purpose, locale);
            return <li key={purpose.purposeKey}>
              <div>
                <strong>{content?.title || purpose.purposeKey}</strong>
                <small>{content?.description || purpose.purposeKey}</small>
              </div>
              <span>{purpose.necessary ? copy.necessary : copy.disabled}</span>
            </li>;
          })}
        </ul>
      </div>
    </div>
    {configuredServices.length ? <div className="consentDraftPreviewTechnology">
      <strong>Servicios opcionales configurados</strong>
      <ul>{configuredServices.map((service) => { const purpose = policy.purposes.find((candidate) => candidate.purposeKey === service.purposeKeys[0]); return <li key={service.serviceKey}>{purpose ? localizedPurpose(purpose, locale)?.title : "Opcional"}: {service.content[locale]?.name ?? service.integration?.providerKey}</li>; })}</ul>
    </div> : null}
    <p className="consentDraftPreviewNotice">Las acciones son solo una representación: no persisten decisiones, no solicitan al BFF y no ejecutan integraciones de terceros.</p>
  </section>;
}

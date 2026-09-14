export type StorefrontConsentCopy = {
  title: string;
  description: string;
  eyebrow: string;
  accept: string;
  reject: string;
  configure: string;
  save: string;
  settingsTitle: string;
  settingsDescription: string;
  necessary: string;
  enabled: string;
  disabled: string;
  close: string;
  review: string;
  unavailable: string;
  retry: string;
  saving: string;
  policyUnavailable: string;
  saveFailed: string;
  withdraw: string;
};

const copyByLanguage: Record<string, StorefrontConsentCopy> = {
  en: {
    title: "Your privacy choices",
    description: "We use necessary technologies to keep the store working. You can accept, reject, or choose the optional ones.",
    eyebrow: "Privacy",
    accept: "Accept all",
    reject: "Reject optional",
    configure: "Manage choices",
    save: "Save choices",
    settingsTitle: "Privacy choices",
    settingsDescription: "Choose which optional purposes you allow. Necessary technologies are always active to keep the store working.",
    necessary: "Necessary",
    enabled: "Enabled",
    disabled: "Disabled",
    close: "Close privacy choices",
    review: "Privacy and cookies",
    unavailable: "We could not load your privacy choices. Optional technologies remain disabled.",
    retry: "Try again",
    saving: "Saving your choices",
    policyUnavailable: "We cannot save your choices until the current privacy policy is available.",
    saveFailed: "We could not save your choices. Optional technologies remain disabled.",
    withdraw: "Withdraw consent",
  },
  es: {
    title: "Tus decisiones de privacidad",
    description: "Usamos las tecnologías necesarias para que la tienda funcione. Puedes aceptar, rechazar o elegir las opcionales.",
    eyebrow: "Privacidad",
    accept: "Aceptar todo",
    reject: "Rechazar opcionales",
    configure: "Configurar",
    save: "Guardar selección",
    settingsTitle: "Preferencias de privacidad",
    settingsDescription: "Elige qué finalidades opcionales autorizas. Las necesarias permanecen activas para que la tienda funcione.",
    necessary: "Necesaria",
    enabled: "Activada",
    disabled: "Desactivada",
    close: "Cerrar preferencias de privacidad",
    review: "Privacidad y cookies",
    unavailable: "No pudimos cargar las preferencias de privacidad. Las tecnologías opcionales permanecen desactivadas.",
    retry: "Reintentar",
    saving: "Guardando tus preferencias",
    policyUnavailable: "No podemos guardar preferencias hasta recuperar la política vigente.",
    saveFailed: "No pudimos guardar tu elección. Las tecnologías opcionales siguen desactivadas.",
    withdraw: "Retirar consentimiento",
  },
};

export function storefrontConsentCopy(locale: string): StorefrontConsentCopy {
  return copyByLanguage[locale.split("-")[0]?.toLowerCase()] ?? copyByLanguage.en;
}

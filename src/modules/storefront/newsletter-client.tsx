"use client";
import { useState, useEffect, useId, useRef, type ReactNode } from "react";
import Link from "next/link";
import {
  CmsNewsletterContext,
  type CmsNewsletterFormProps,
} from "../../../packages/cms-blocks/src/newsletter-form";
import {
  loadNewsletterPolicy,
  submitNewsletter,
  completeNewsletter,
  type NewsletterPolicy,
  type NewsletterResult,
} from "./newsletter-actions";
export function NewsletterProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const [policy, setPolicy] = useState<NewsletterPolicy | null>(null);
  const [message, setMessage] = useState(
    "Cargando información de consentimiento…",
  );
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void loadNewsletterPolicy().then((r) => {
      if (alive) {
        setPolicy(r.policy ?? null);
        setMessage(r.message);
      }
    });
    return () => {
      alive = false;
    };
  }, [enabled]);
  return (
    <CmsNewsletterContext.Provider
      value={(props) => (
        <NewsletterForm {...props} policy={policy} unavailable={message} />
      )}
    >
      {children}
    </CmsNewsletterContext.Provider>
  );
}
function NewsletterForm({
  label,
  placeholder,
  submitLabel,
  style,
  inputStyle,
  consentStyle,
  privacyStyle,
  feedbackStyle,
  privacyLabel,
  policy,
  unavailable,
}: CmsNewsletterFormProps & {
  policy: NewsletterPolicy | null;
  unavailable: string;
}) {
  const id = useId(),
    [email, setEmail] = useState(""),
    [accepted, setAccepted] = useState(false),
    [pending, setPending] = useState(false),
    [result, setResult] = useState<NewsletterResult | null>(null);
  return (
    <form
      className="cmsNewsletterForm"
      aria-label="Suscripción al newsletter"
      action={async () => {
        if (!policy || pending) return;
        setPending(true);
        setResult(null);
        try {
          const r = await submitNewsletter({
            email,
            locale: policy.locale,
            consent: {
              accepted,
              policyVersionId: policy.policyVersionId,
              fingerprint: policy.fingerprint,
            },
          });
          setResult(r);
          if (r.ok) {
            setEmail("");
            setAccepted(false);
          }
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="storefrontVisuallyHidden" htmlFor={id + "-email"}>
        {label}
      </label>
      <input
        style={inputStyle}
        id={id + "-email"}
        name="email"
        type="email"
        maxLength={254}
        autoComplete="email"
        placeholder={placeholder}
        value={email}
        required
        disabled={pending || !policy}
        onChange={(e) => setEmail(e.target.value)}
        aria-describedby={id + "-result"}
      />
      {policy && (
        <>
          <label
            style={consentStyle}
            className="cmsNewsletterConsent"
            htmlFor={id + "-consent"}
          >
            <input
              id={id + "-consent"}
              name="consent"
              type="checkbox"
              checked={accepted}
              required
              disabled={pending}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span>{policy.text}</span>
          </label>
          <Link
            style={privacyStyle}
            className="cmsNewsletterPrivacy"
            href={policy.privacyPath}
          >
            {privacyLabel || "Política de Privacidad"}
          </Link>
        </>
      )}
      <button
        type="submit"
        style={style}
        disabled={pending || !policy || !accepted}
      >
        {pending ? "Enviando…" : submitLabel}
      </button>
      <p
        style={feedbackStyle}
        id={id + "-result"}
        role="status"
        aria-live="polite"
      >
        {result?.message || (!policy ? unavailable : "")}
      </p>
    </form>
  );
}
export function NewsletterTokenPage({
  kind,
}: {
  kind: "confirmations" | "unsubscriptions";
}) {
  const token = useRef(""),
    captured = useRef(false),
    [pending, setPending] = useState(false),
    [result, setResult] = useState<NewsletterResult | null>(null);
  useEffect(() => {
    if (captured.current) return;
    captured.current = true;
    const p = new URLSearchParams(location.hash.slice(1));
    token.current = p.get("token") ?? "";
    history.replaceState(null, "", location.pathname);
  }, []);
  return (
    <main className="storefrontShell" style={{ padding: "48px 24px" }}>
      <h1>
        {kind === "confirmations" ? "Confirma tu suscripción" : "Darse de baja"}
      </h1>
      <p>
        {kind === "confirmations"
          ? "Pulsa el botón para confirmar que quieres recibir nuestro newsletter."
          : "Pulsa el botón para dejar de recibir el newsletter de esta tienda."}
      </p>
      <button
        type="button"
        disabled={pending || result?.ok}
        onClick={async () => {
          setPending(true);
          try {
            setResult(await completeNewsletter(kind, token.current));
          } finally {
            setPending(false);
          }
        }}
      >
        {pending
          ? "Procesando…"
          : kind === "confirmations"
            ? "Confirmar suscripción"
            : "Confirmar baja"}
      </button>
      <p role="status" aria-live="polite">
        {result?.message}
      </p>
    </main>
  );
}

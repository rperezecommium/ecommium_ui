"use client";
import {
  createContext,
  useContext,
  type ReactNode,
  type CSSProperties,
} from "react";
export type CmsNewsletterFormProps = {
  label: string;
  placeholder: string;
  submitLabel: string;
  style?: CSSProperties;
  inputStyle?: CSSProperties;
  consentStyle?: CSSProperties;
  privacyStyle?: CSSProperties;
  feedbackStyle?: CSSProperties;
  privacyLabel?: string;
};
export const CmsNewsletterContext = createContext<
  ((props: CmsNewsletterFormProps) => ReactNode) | null
>(null);
export function CmsNewsletterForm(props: CmsNewsletterFormProps) {
  const render = useContext(CmsNewsletterContext);
  if (render) return render(props);
  return (
    <div className="cmsNewsletterForm" aria-label="Vista previa de newsletter">
      <label>
        {props.label}
        <input
          disabled
          type="email"
          placeholder={props.placeholder}
          style={props.inputStyle}
        />
      </label>
      <label style={props.consentStyle}>
        <input disabled type="checkbox" />
        Quiero recibir el newsletter.
      </label>
      <button disabled style={props.style} type="button">
        {props.submitLabel}
      </button>
      <small>Vista previa: no recoge ni envía datos.</small>
    </div>
  );
}

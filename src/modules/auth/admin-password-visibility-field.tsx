"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type AdminPasswordVisibilityFieldProps = {
  autoComplete: string;
  label?: string;
  name: string;
  required?: boolean;
};

export function AdminPasswordVisibilityField({
  autoComplete,
  label = "Password",
  name,
  required = false,
}: AdminPasswordVisibilityFieldProps) {
  const [visible, setVisible] = useState(false);
  const inputId = useId();
  const buttonLabel = visible ? "Ocultar password" : "Mostrar password";

  return (
    <label className="adminField" htmlFor={inputId}>
      <span>{label}</span>
      <span className="adminPasswordControl">
        <input
          autoComplete={autoComplete}
          id={inputId}
          name={name}
          required={required}
          type={visible ? "text" : "password"}
        />
        <button
          aria-label={buttonLabel}
          aria-pressed={visible}
          className="adminPasswordToggle"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          {visible ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
        </button>
      </span>
    </label>
  );
}

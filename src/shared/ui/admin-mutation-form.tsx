"use client";
import {
  cloneElement,
  createContext,
  useActionState,
  useContext,
  useEffect,
  useId,
  useRef,
  startTransition,
  type ReactElement,
  type ReactNode,
} from "react";
import styles from "./admin-mutation-form.module.css";
import type { AdminFormState } from "../validation/admin-form-state";
const Errors = createContext<Record<string, string>>({});
export function AdminMutationForm({
  action,
  children,
  className,
  label,
  activationWarning,
  resetOnSuccess = true,
}: {
  action: (state: AdminFormState, data: FormData) => Promise<AdminFormState>;
  children: ReactNode;
  className?: string;
  label: string;
  activationWarning?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, dispatch, pending] = useActionState(action, {});
  const form = useRef<HTMLFormElement>(null),
    feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.success && resetOnSuccess) form.current?.reset();
    if (state.error) feedback.current?.focus();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={form}
      aria-label={label}
      className={`${styles.form} ${className ?? ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        if (
          activationWarning &&
          data.get("active") &&
          !window.confirm(activationWarning)
        )
          return;
        startTransition(() => dispatch(data));
      }}
    >
      <Errors.Provider value={state.fieldErrors ?? {}}>
        {state.error ? (
          <div
            className="adminBanner adminBannerError"
            role="alert"
            tabIndex={-1}
            ref={feedback}
          >
            {state.error}
          </div>
        ) : null}
        {state.success ? (
          <div className="adminBanner" role="status">
            {state.success}
          </div>
        ) : null}
        <fieldset
          disabled={pending}
          aria-busy={pending}
          style={{
            border: 0,
            padding: 0,
            margin: 0,
            minWidth: 0,
            display: "contents",
          }}
        >
          {children}
        </fieldset>
        {pending ? <p role="status">Guardando…</p> : null}
      </Errors.Provider>
    </form>
  );
}
export function MutationField({
  name,
  label,
  children,
}: {
  name: string;
  label: string;
  children: ReactElement<{
    id?: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
  }>;
}) {
  const id = useId(),
    errors = useContext(Errors),
    error = errors[name];
  return (
    <label className="adminField" htmlFor={id}>
      <span>{label}</span>
      {cloneElement(children, {
        id,
        "aria-invalid": !!error,
        "aria-describedby": error ? id + "-error" : undefined,
      })}
      {error ? <span id={id + "-error"}>{error}</span> : null}
    </label>
  );
}

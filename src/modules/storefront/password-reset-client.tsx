"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  confirmStorefrontPasswordReset,
  requestStorefrontPasswordReset,
} from "./storefront-auth-actions";
import type { StorefrontAuthActionState } from "./auth-types";

const initialState: StorefrontAuthActionState = {
  status: "idle",
  message: "",
};

export function StorefrontPasswordResetClient({ token }: { token?: string }) {
  const [requestState, requestAction, requestPending] = useActionState(
    requestStorefrontPasswordReset,
    initialState,
  );
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmStorefrontPasswordReset,
    initialState,
  );
  const [showPassword, setShowPassword] = useState(false);
  const isConfirm = Boolean(token);
  const state = isConfirm ? confirmState : requestState;

  return (
    <main className="storefrontAuthPage">
      <section className="storefrontAuthPanel">
        <Link className="storefrontAuthBackLink" href="/">
          Ecommium
        </Link>
        <h1>{isConfirm ? "Crear nueva password" : "Recuperar password"}</h1>
        <p>
          {isConfirm
            ? "Define una nueva password. Cerraremos las sesiones abiertas por seguridad."
            : "Te enviaremos un enlace si existe una cuenta activa con ese email."}
        </p>
        {state.message ? (
          <div className={state.status === "error" ? "storefrontAuthNotice storefrontAuthNoticeError" : "storefrontAuthNotice storefrontAuthNoticeSuccess"}>
            {state.message}
          </div>
        ) : null}
        {isConfirm ? (
          <form action={confirmAction} className="storefrontAuthForm">
            <input name="token" type="hidden" value={token} />
            <label className="storefrontAuthField">
              <span>Nueva password</span>
              <span className="storefrontAuthPasswordControl">
                <input minLength={8} name="password" required type={showPassword ? "text" : "password"} />
                <button onClick={() => setShowPassword(!showPassword)} type="button">
                  {showPassword ? "Ocultar" : "Ver"}
                </button>
              </span>
            </label>
            <button className="storefrontAuthSubmit" disabled={confirmPending} type="submit">
              {confirmPending ? "Guardando..." : "Actualizar password"}
            </button>
          </form>
        ) : (
          <form action={requestAction} className="storefrontAuthForm">
            <label className="storefrontAuthField">
              <span>Email</span>
              <input defaultValue={requestState.email} name="email" required type="email" />
            </label>
            <button className="storefrontAuthSubmit" disabled={requestPending} type="submit">
              {requestPending ? "Enviando..." : "Enviar enlace"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

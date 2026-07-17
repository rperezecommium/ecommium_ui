"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  activateStorefrontCustomerAction,
} from "./storefront-auth-actions";
import type { StorefrontAuthActionState } from "./auth-types";

const initialState: StorefrontAuthActionState = {
  status: "idle",
  message: "",
};

export function StorefrontActivationForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(
    activateStorefrontCustomerAction,
    initialState,
  );

  if (state.status === "success") {
    return (
      <>
        <h1>Cuenta activada</h1>
        <p>{state.message}</p>
        <Link className="storefrontAuthSubmit storefrontAuthPanelLink" href="/?customerLogin=1">
          Iniciar sesión
        </Link>
      </>
    );
  }

  return (
    <>
      <h1>Activa tu cuenta</h1>
      <p>Confirma la activación para terminar de crear tu cuenta y recuperar automáticamente tus compras elegibles.</p>
      {state.message ? (
        <p aria-live="polite" className="storefrontAuthNotice storefrontAuthNoticeError">
          {state.message}
        </p>
      ) : null}
      <form action={action}>
        <input name="token" type="hidden" value={token} />
        <button className="storefrontAuthSubmit" disabled={pending} type="submit">
          {pending ? "Activando..." : "Activar cuenta"}
        </button>
      </form>
    </>
  );
}

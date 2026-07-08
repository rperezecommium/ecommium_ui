"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, LogOut, Rocket, User, UserRound, X } from "lucide-react";
import {
  loginStorefrontCustomer,
  signupStorefrontCustomer,
} from "./storefront-auth-actions";
import { logoutStorefrontCustomer } from "./storefront-account-actions";
import type { StorefrontAuthActionState } from "./auth-types";

type AuthMode = "login" | "signup";

const initialState: StorefrontAuthActionState = {
  status: "idle",
  message: "",
};

export function StorefrontAuthEntry({
  customerEmail,
}: {
  customerEmail?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [signupStartedAt, setSignupStartedAt] = useState("");

  function show(nextMode: AuthMode) {
    setMode(nextMode);
    if (nextMode === "signup") {
      setSignupStartedAt(new Date(Date.now() - 8000).toISOString());
    }
    setOpen(true);
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    if (nextMode === "signup") {
      setSignupStartedAt(new Date(Date.now() - 8000).toISOString());
    }
  }

  return (
    <>
      <div className="storefrontAuthEntry" aria-label="Cuenta cliente">
        {customerEmail ? (
          <>
            <Link className="storefrontAuthLoginButton" href="/account">
              <UserRound aria-hidden="true" size={18} />
              <span>Mi cuenta</span>
            </Link>
            <form action={logoutStorefrontCustomer} className="storefrontAuthLogoutForm">
              <button className="storefrontAuthLogoutButton" type="submit">
                <LogOut aria-hidden="true" size={18} />
                <span>Cerrar sesion</span>
              </button>
            </form>
          </>
        ) : (
          <>
            <button className="storefrontAuthLoginButton" onClick={() => show("login")} type="button">
              <User aria-hidden="true" size={18} />
              <span>Iniciar Sesion</span>
            </button>
            <button className="storefrontAuthRegisterButton" onClick={() => show("signup")} type="button">
              <Rocket aria-hidden="true" size={18} />
              <span>Registrate</span>
            </button>
          </>
        )}
      </div>
      {!customerEmail ? (
        <AuthDrawer
          mode={mode}
          onClose={() => setOpen(false)}
          open={open}
          setMode={changeMode}
          signupStartedAt={signupStartedAt}
        />
      ) : null}
    </>
  );
}

function AuthDrawer({
  mode,
  onClose,
  open,
  setMode,
  signupStartedAt,
}: {
  mode: AuthMode;
  onClose: () => void;
  open: boolean;
  setMode: (mode: AuthMode) => void;
  signupStartedAt: string;
}) {
  const [loginState, loginAction, loginPending] = useActionState(loginStorefrontCustomer, initialState);
  const [signupState, signupAction, signupPending] = useActionState(signupStorefrontCustomer, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const state = mode === "login" ? loginState : signupState;
  const pending = mode === "login" ? loginPending : signupPending;

  useEffect(() => {
    if (loginState.status === "success") {
      const timer = window.setTimeout(onClose, 650);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [loginState.status, onClose]);

  return (
    <div className={open ? "storefrontDrawerLayer storefrontDrawerLayerOpen" : "storefrontDrawerLayer"}>
      <button aria-label="Cerrar" className="storefrontDrawerBackdrop" onClick={onClose} type="button" />
      <aside aria-label="Cuenta cliente" aria-modal="true" className="storefrontAuthDrawer" role="dialog">
        <div className="storefrontAuthDrawerHeader">
          <div>
            <span>Cuenta cliente</span>
            <h2>{mode === "login" ? "Iniciar sesion" : "Crear cuenta"}</h2>
            <p>{mode === "login" ? "Accede a tus pedidos y preferencias." : "Crea tu cuenta y activala desde tu email."}</p>
          </div>
          <button aria-label="Cerrar" className="storefrontDrawerIconButton" onClick={onClose} type="button">
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        <div className="storefrontAuthTabs" role="tablist">
          <button aria-selected={mode === "login"} onClick={() => setMode("login")} role="tab" type="button">
            Iniciar sesion
          </button>
          <button aria-selected={mode === "signup"} onClick={() => setMode("signup")} role="tab" type="button">
            Crear cuenta
          </button>
        </div>
        {state.message ? (
          <p className={state.status === "error" ? "storefrontAuthNotice storefrontAuthNoticeError" : "storefrontAuthNotice storefrontAuthNoticeSuccess"}>
            {state.message}
          </p>
        ) : null}
        {mode === "login" ? (
          <form action={loginAction} className="storefrontAuthForm">
            <AuthField defaultValue={loginState.email} label="Email" name="email" type="email" />
            <PasswordField show={showPassword} toggle={() => setShowPassword(!showPassword)} />
            <button className="storefrontAuthSubmit" disabled={pending} type="submit">
              {pending ? "Entrando..." : "Iniciar sesion"}
            </button>
            <Link className="storefrontAuthAuxLink" href="/auth/password-reset">
              He olvidado mi password
            </Link>
          </form>
        ) : (
          <form action={signupAction} className="storefrontAuthForm">
            <div className="storefrontAuthGrid">
              <AuthField label="Nombre" name="firstName" type="text" />
              <AuthField label="Apellido" name="lastName" type="text" />
            </div>
            <AuthField defaultValue={signupState.email} label="Email" name="email" type="email" />
            <PasswordField show={showPassword} toggle={() => setShowPassword(!showPassword)} />
            <input name="startedAt" type="hidden" value={signupStartedAt} />
            <label className="storefrontAuthTrap">Empresa<input autoComplete="off" name="company" tabIndex={-1} /></label>
            <button className="storefrontAuthSubmit" disabled={pending} type="submit">
              {pending ? "Creando..." : "Crear cuenta"}
            </button>
          </form>
        )}
      </aside>
    </div>
  );
}

function AuthField({ defaultValue, label, name, type }: { defaultValue?: string; label: string; name: string; type: string }) {
  return (
    <label className="storefrontAuthField">
      <span>{label}</span>
      <input defaultValue={defaultValue} name={name} required type={type} />
    </label>
  );
}

function PasswordField({ show, toggle }: { show: boolean; toggle: () => void }) {
  return (
    <label className="storefrontAuthField">
      <span>Password</span>
      <span className="storefrontAuthPasswordControl">
        <input minLength={8} name="password" required type={show ? "text" : "password"} />
        <button aria-label={show ? "Ocultar password" : "Mostrar password"} onClick={toggle} type="button">
          {show ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
        </button>
      </span>
    </label>
  );
}

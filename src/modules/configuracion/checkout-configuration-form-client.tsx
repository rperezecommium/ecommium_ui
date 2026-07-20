"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateCheckoutConfigurationAction,
} from "./checkout-configuration-admin-actions";
import type {
  CheckoutConfigurationState,
  CheckoutOrderformConfiguration,
} from "./checkout-configuration-admin";

type CheckoutConfigurationFormProps = {
  configuration: CheckoutOrderformConfiguration;
  inDrawer?: boolean;
  state: CheckoutConfigurationState;
};

function SaveButton({ deactivationConfirmed, isActive }: { deactivationConfirmed: boolean; isActive: boolean }) {
  const { pending } = useFormStatus();
  const blocked = !isActive && !deactivationConfirmed;

  return (
    <button
      className="adminButton adminButtonPrimary"
      disabled={pending || blocked}
      type="submit"
    >
      {pending ? "Guardando…" : isActive ? "Guardar configuración" : "Confirmar desactivación"}
    </button>
  );
}

function methodsLabel(methods: string[]) {
  return methods.length > 0 ? methods.join(", ") : "Sin métodos configurados";
}

function antiBotSensitivityValue(value: number) {
  return String(value);
}

export function CheckoutConfigurationForm({ configuration, inDrawer = false, state }: CheckoutConfigurationFormProps) {
  const [isActive, setIsActive] = useState(configuration.isActive);
  const [deactivationConfirmation, setDeactivationConfirmation] = useState("");
  const deactivationConfirmed = deactivationConfirmation === "DESACTIVAR CHECKOUT";
  const paymentMethods = configuration.orderFormConfiguration.paymentSystemToCheckFirstInstallment;
  const antiBotValue = antiBotSensitivityValue(configuration.orderFormConfiguration.recaptchaMinScore);
  const hasCustomAntiBotValue = !["0.3", "0.5", "0.7"].includes(antiBotValue);

  return (
    <form action={updateCheckoutConfigurationAction} className={`pricingDenseForm adminSection checkoutConfigurationForm${inDrawer ? " checkoutConfigurationDrawerForm" : ""}`}>
      {!inDrawer ? <div className="adminCardHeader">
        <div>
          <h2>Editar configuración</h2>
          <p>Los cambios se validan antes de enviarse al BFF. Checkout conserva la validación definitiva.</p>
        </div>
        <SaveButton deactivationConfirmed={deactivationConfirmed} isActive={isActive} />
      </div> : null}

      {state === "INITIAL" ? (
        <div className="adminBanner adminBannerWarning">
          Este será el primer guardado de la tienda: confirmará y materializará la configuración actual.
        </div>
      ) : null}

      {!isActive ? (
        <section className="adminBanner adminBannerWarning" aria-live="polite">
          <strong>Vas a desactivar Checkout.</strong>
          <p>Las operaciones de orderForm quedarán bloqueadas para esta tienda hasta reactivarlo.</p>
          <label className="adminField">
            <span>Escribe DESACTIVAR CHECKOUT para confirmar</span>
            <input
              aria-label="Confirmar desactivación de Checkout"
              name="confirmDeactivate"
              onChange={(event) => setDeactivationConfirmation(event.target.value)}
              placeholder="DESACTIVAR CHECKOUT"
              required
              value={deactivationConfirmation}
            />
          </label>
        </section>
      ) : null}

      <section className="adminSection">
        <h3>Estado</h3>
        <div className="adminFormGrid">
          <label className="adminCheckboxField">
            <input
              checked={isActive}
              name="isActive"
              onChange={(event) => setIsActive(event.target.checked)}
              type="checkbox"
            />
            <span>Checkout activo para esta tienda</span>
          </label>
          <label className="adminCheckboxField">
            <input defaultChecked={configuration.orderFormConfiguration.recaptchaValidation} name="recaptchaValidation" type="checkbox" />
            <span>Exigir validación ReCAPTCHA</span>
          </label>
          <label className="adminField">
            <span>Sensibilidad anti-bot</span>
            <select defaultValue={antiBotValue} name="recaptchaMinScore" required>
              {hasCustomAntiBotValue ? <option value={antiBotValue}>Personalizada</option> : null}
              <option value="0.3">Baja</option>
              <option value="0.5">Media</option>
              <option value="0.7">Alta</option>
            </select>
          </label>
        </div>
      </section>

      <section className="adminSection">
        <h3>Compra</h3>
        <div className="adminFormGrid">
          <label className="adminCheckboxField">
            <input defaultChecked={configuration.orderFormConfiguration.savePersonalDataAsOptIn} name="savePersonalDataAsOptIn" type="checkbox" />
            <span>Exigir consentimiento de datos</span>
          </label>
          <label className="adminCheckboxField">
            <input defaultChecked={configuration.orderFormConfiguration.allowManualPrice} name="allowManualPrice" type="checkbox" />
            <span>Permitir precio manual</span>
          </label>
          <input
            name="paymentSystemToCheckFirstInstallment"
            type="hidden"
            value={paymentMethods.join(", ")}
          />
          {paymentMethods.length > 0 ? (
            <div className="checkoutConfigurationReadonlyValue">
              <span>Métodos primera cuota</span>
              <strong>{methodsLabel(paymentMethods)}</strong>
            </div>
          ) : null}
        </div>
      </section>

      {inDrawer ? (
        <div className="checkoutConfigurationDrawerFooter">
          <SaveButton deactivationConfirmed={deactivationConfirmed} isActive={isActive} />
        </div>
      ) : null}
    </form>
  );
}

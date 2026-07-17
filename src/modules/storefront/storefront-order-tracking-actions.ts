"use server";

import { requestStorefrontTrackingAccessRecovery } from "./order-tracking";

type TrackingRecoveryActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function requestStorefrontTrackingRecoveryAction(
  previousState: TrackingRecoveryActionState,
  formData: FormData,
): Promise<TrackingRecoveryActionState> {
  void previousState;
  const orderReference = formString(formData, "orderReference");
  const email = formString(formData, "email");

  if (!orderReference || !emailPattern.test(email)) {
    return {
      status: "error",
      message: "Indica una referencia y un email validos.",
    };
  }

  const result = await requestStorefrontTrackingAccessRecovery({ orderReference, email });
  if (!result.ok) {
    return {
      status: "error",
      message: "No pudimos solicitar el enlace ahora. Intentalo de nuevo en unos minutos.",
    };
  }

  return {
    status: "success",
    message: "Si los datos coinciden con una compra, recibirás un nuevo enlace de seguimiento por email.",
  };
}

export type StorefrontAuthMode = "login" | "signup";

export type StorefrontAuthActionState = {
  status: "idle" | "success" | "error" | "activation_pending";
  message: string;
  email?: string;
  verificationResetKey?: string;
};

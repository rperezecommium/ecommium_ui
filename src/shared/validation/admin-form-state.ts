export type AdminFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};
export class AdminFormValidationError extends Error {
  constructor(readonly fieldErrors: Record<string, string>) {
    super("Revisa los campos indicados.");
  }
}
export function formFailure(error: unknown): AdminFormState {
  return error instanceof AdminFormValidationError
    ? { error: error.message, fieldErrors: error.fieldErrors }
    : {
        error:
          "No se pudo preparar la solicitud. Revisa los datos e inténtalo de nuevo.",
      };
}

export function buildAdminLoginPayload(email: string, password: string) {
  return {
    email,
    password,
    scope: "admin",
  };
}

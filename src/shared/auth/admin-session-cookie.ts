import { createHmac, timingSafeEqual } from "node:crypto";

const version = "v1";
const minimumSecretLength = 32;

function validSecret(value: string | undefined) {
  const secret = value?.trim();
  return secret && Buffer.byteLength(secret, "utf8") >= minimumSecretLength ? secret : null;
}

function getSessionSecret() {
  return validSecret(process.env.ECOMMIUM_UI_ADMIN_SESSION_SECRET);
}

function getVerificationSecrets() {
  return [
    getSessionSecret(),
    validSecret(process.env.ECOMMIUM_UI_ADMIN_SESSION_PREVIOUS_SECRET),
  ].filter((secret): secret is string => Boolean(secret));
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function hasAdminSessionCookieSecret() {
  return Boolean(getSessionSecret());
}

export function sealAdminSessionCookie(payload: string) {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error("ECOMMIUM_UI_ADMIN_SESSION_SECRET must be configured with at least 32 characters");
  }

  const encodedPayload = Buffer.from(payload, "utf8").toString("base64url");
  const signedValue = `${version}.${encodedPayload}`;
  return `${signedValue}.${sign(signedValue, secret)}`;
}

export function unsealAdminSessionCookie(value: string | undefined) {
  const secrets = getVerificationSecrets();
  if (secrets.length === 0 || !value) {
    return null;
  }

  const [cookieVersion, encodedPayload, receivedSignature, ...extra] = value.split(".");
  if (cookieVersion !== version || !encodedPayload || !receivedSignature || extra.length > 0) {
    return null;
  }

  const signedValue = `${cookieVersion}.${encodedPayload}`;
  const received = Buffer.from(receivedSignature, "utf8");
  const signatureMatches = secrets.some((secret) => {
    const expected = Buffer.from(sign(signedValue, secret), "utf8");
    return received.byteLength === expected.byteLength && timingSafeEqual(received, expected);
  });
  if (!signatureMatches) {
    return null;
  }

  try {
    return Buffer.from(encodedPayload, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

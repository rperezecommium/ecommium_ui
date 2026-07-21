import { requestBff } from "../../shared/bff/client";

export type AdminStepUpState = {
  status: "REQUIRED" | "VERIFIED";
  method: "PASSWORD" | "TOTP" | "PASSKEY" | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  enforcement: "DISABLED" | "ENABLED";
};

export type AdminDeviceSession = {
  sessionId: string;
  createdAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
  device: {
    deviceId: string | null;
    deviceName: string | null;
    userAgent: string | null;
    ipAddress: string | null;
  };
};

export type AdminSecurityData = {
  stepUp: AdminStepUpState | null;
  sessions: AdminDeviceSession[];
  errors: string[];
};

function parseStepUp(value: unknown): AdminStepUpState {
  const record = value as Record<string, unknown>;
  if (
    (record.status !== "REQUIRED" && record.status !== "VERIFIED") ||
    (record.enforcement !== "DISABLED" && record.enforcement !== "ENABLED")
  ) {
    throw new Error("Respuesta de verificación reforzada no válida.");
  }

  return {
    status: record.status,
    method: record.method === "PASSWORD" || record.method === "TOTP" || record.method === "PASSKEY"
      ? record.method
      : null,
    verifiedAt: typeof record.verifiedAt === "string" ? record.verifiedAt : null,
    expiresAt: typeof record.expiresAt === "string" ? record.expiresAt : null,
    enforcement: record.enforcement,
  };
}

function parseSessions(value: unknown): AdminDeviceSession[] {
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.sessions)) throw new Error("Respuesta de dispositivos no válida.");

  return record.sessions.flatMap((item) => {
    const session = item as Record<string, unknown>;
    const device = session.device as Record<string, unknown> | null;
    if (
      typeof session.sessionId !== "string" ||
      typeof session.createdAt !== "string" ||
      typeof session.lastSeenAt !== "string" ||
      typeof session.isCurrent !== "boolean" ||
      !device
    ) return [];

    return [{
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      isCurrent: session.isCurrent,
      device: {
        deviceId: typeof device.deviceId === "string" ? device.deviceId : null,
        deviceName: typeof device.deviceName === "string" ? device.deviceName : null,
        userAgent: typeof device.userAgent === "string" ? device.userAgent : null,
        ipAddress: typeof device.ipAddress === "string" ? device.ipAddress : null,
      },
    }];
  });
}

export async function getAdminSecurityData(): Promise<AdminSecurityData> {
  const [stepUpResult, sessionsResult] = await Promise.all([
    requestBff("/admin/session/step-up", { parse: parseStepUp }),
    requestBff("/admin/sessions", { parse: parseSessions }),
  ]);

  return {
    stepUp: stepUpResult.ok ? stepUpResult.data : null,
    sessions: sessionsResult.ok ? sessionsResult.data : [],
    errors: [
      ...(stepUpResult.ok ? [] : [stepUpResult.error]),
      ...(sessionsResult.ok ? [] : [sessionsResult.error]),
    ],
  };
}

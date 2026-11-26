export type ConfirmedHealthStatus = "ok" | "degraded" | "unavailable" | "unknown";
export type HealthAssessment = {
    status: ConfirmedHealthStatus;
    message: string;
};
const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : '';
const failed = new Set(['error', 'failed', 'failure', 'unhealthy', 'degraded', 'warning', 'warn', 'critical', 'alert', 'down', 'unavailable', 'offline', 'stopped']);
const nonempty = (value: unknown) => value !== undefined && value !== null && value !== false && value !== '' && (!Array.isArray(value) || value.length > 0);
export function assessHealth(value: unknown): HealthAssessment {
    const root = record(value);
    if (!root)
        return { status: 'unknown', message: 'Respuesta de salud no válida; estado sin confirmar.' };
    const status = text(root.status), readiness = record(root.readiness), consumer = record(root.consumer), observability = record(root.observability), persistence = record(root.persistence);
    if (['down', 'unavailable', 'offline'].includes(status))
        return { status: 'unavailable', message: 'El servicio informa que no está disponible.' };
    if (failed.has(status) || root.ok === false || root.healthy === false || root.success === false || nonempty(root.error) || nonempty(root.errors))
        return { status: 'degraded', message: 'El servicio informa de un error o degradación.' };
    if (root.ready === false || readiness?.ready === false || Array.isArray(readiness?.missingRequiredEventTypes) && readiness.missingRequiredEventTypes.length > 0)
        return { status: 'degraded', message: 'El servicio no está preparado para operar.' };
    if (observability && failed.has(text(observability.severity)))
        return { status: 'degraded', message: 'El servicio informa de alertas operativas.' };
    const consumerDisabled = root.consumerEnabled === false || consumer?.enabled === false || text(consumer?.status) === 'disabled';
    if (consumer && !consumerDisabled && (consumer.connected === false || consumer.channelReady === false || failed.has(text(consumer.status))))
        return { status: 'degraded', message: 'El consumidor de eventos no está operativo.' };
    if (readiness?.consumerRequired === true && consumerDisabled)
        return { status: 'degraded', message: 'Un consumidor requerido está deshabilitado.' };
    const databaseRequired = root.databaseRequired === true || ['prisma', 'postgres', 'postgresql'].includes(text(root.persistenceDriver ?? persistence?.driver));
    if (databaseRequired && (root.databaseConfigured === false || persistence?.databaseConfigured === false))
        return { status: 'degraded', message: 'La base de datos requerida no está configurada.' };
    const checks = record(root.checks);
    if (checks && Object.values(checks).some(check => check === false || failed.has(text(check)) || failed.has(text(record(check)?.status))))
        return { status: 'degraded', message: 'Una comprobación de salud informa de un fallo.' };
    const booleans = [root.ok, root.healthy, root.ready, root.success, readiness?.ready, consumer?.connected, consumer?.channelReady];
    if (booleans.some(flag => flag !== undefined && typeof flag !== 'boolean'))
        return { status: 'unknown', message: 'La respuesta contiene señales de salud no válidas.' };
    if (status === 'ok' || status === 'healthy')
        return { status: 'ok', message: 'El servicio confirma que está operativo.' };
    return { status: 'unknown', message: 'El BFF respondió, pero no confirma el estado operativo.' };
}

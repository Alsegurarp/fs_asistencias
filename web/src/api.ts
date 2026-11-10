import { accessToken, auth } from './auth'

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string,
    public correlationId?: string, public errors: { field: string; message: string }[] = []) {
    super(message)
  }
}

async function request(path: string, method = 'GET', body?: unknown, idempotencyKey?: string): Promise<Response> {
  const token = await accessToken()
  const multipart = body instanceof FormData
  const response = await fetch(`/api/v1${path}`, {
    method,
    redirect: 'error',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined || multipart ? {} : { 'Content-Type': 'application/json' }),
      ...(idempotencyKey === undefined ? {} : { 'Idempotency-Key': idempotencyKey }),
    },
    body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
  })
  if (!response.ok) {
    if (response.status === 401) auth.clearToken()
    const problem = await response.json().catch(() => ({}))
    throw new ApiError(response.status, problem.code || '', problem.detail || problem.title || `HTTP ${response.status}`,
      problem.correlationId || response.headers.get('X-Correlation-Id') || undefined, problem.errors || [])
  }
  return response
}

export async function api<T>(path: string, method = 'GET', body?: unknown, idempotencyKey?: string): Promise<T> {
  const response = await request(path, method, body, idempotencyKey)
  return response.status === 204 ? undefined as T : response.json()
}

export async function apiDownload(path: string, method = 'GET', body?: unknown): Promise<{ blob: Blob; filename: string }> {
  const response = await request(path, method, body)
  const filename = /filename="([^"]+)"/i.exec(response.headers.get('Content-Disposition') || '')?.[1]
    .replace(/[\\/\u0000-\u001f\u007f]/g, '_') || 'zenit.csv'
  return { blob: await response.blob(), filename }
}

export type Me = { userId: string; displayName: string; roles: string[]; tenant: { name: string; timeZone: string; upcomingBreakPolicy?: UpcomingBreakPolicy | null } | null }
export type Page<T> = { items: T[]; nextCursor: string | null }
export type Site = { id: string; name: string; timeZone: string; latitude: number; longitude: number; radiusMeters: number; status: string }
export type Employee = { id: string; externalId: string; displayName: string; siteId: string | null; employmentStart: string; employmentEnd: string | null; status: string; activeCardId: string | null; currentScheduleId?: string | null
  /** Desde el contrato 0.21.0. */
  source: 'manual' | 'csv' | 'api' | 'connector'; activeCardLabel?: string | null; createdAt?: string }
export type Card = {
  id: string; label: string; status: string; keyVersion?: number | null
  assignment: { employeeId: string; employeeName?: string; employeeExternalId?: string; since?: string } | null
  /** Quien la tuvo por última vez; `until` nulo si sigue asignada. */
  latestAssignment?: { employeeId: string; employeeName: string; employeeExternalId: string; since: string; until: string | null } | null
  createdAt?: string; updatedAt?: string
}
export type TenantUsage = { tenantId: string; month: string; timeZone: string; from: string; to: string; complete: boolean; employeesWithAttendance: number; employeesInPeriod: number; cardsAssigned: number; devicesActive: number; attendanceEvents: number }
export type Tenant = { id: string; name: string; slug: string; timeZone: string; weekStartsOn: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'; breakPolicy: BreakPolicy; status: string; createdAt: string; autoCloseAfterHours: number | null; breakPolicyChange: BreakPolicyChange | null }
export type BreakPolicy = 'not_considered' | 'marked'
/** Cambio programado de la política de comida; entra en `effectiveOn`, un inicio de semana de la empresa. */
export type BreakPolicyChange = { id: string; breakPolicy: BreakPolicy; effectiveOn: string; effectiveAt: string; reason: string; scheduledAt: string }
export type UpcomingBreakPolicy = { breakPolicy: BreakPolicy; effectiveOn: string; effectiveAt: string }
export type Device ={ id: string; mode: 'personal' | 'terminal'; status: 'active' | 'revoked' | 'replaced'; employeeId: string | null; employeeName?: string | null; siteId: string | null; label: string | null; model: string; appVersion: string; enrolledAt: string; lastSeenAt: string | null; revokedAt: string | null }
export type DeviceEnrollment = { id: string; mode: 'personal' | 'terminal'; employeeId: string | null; siteId: string | null; label: string | null; code: string; status: string; expiresAt: string; createdAt: string }
export type TenantUser ={ id: string; email: string; displayName: string; roles: string[]; status: 'invited' | 'active' | 'disabled'; createdAt: string; linkedAt: string | null; employeeId: string | null; siteIds?: string[] }

export function permissions(roles: string[]) {
  return {
    personal: roles.includes('trabajador'),
    attendance: roles.some(r => ['admin_empresa', 'rh', 'supervisor', 'auditor'].includes(r)),
    sites: roles.some(r => ['admin_empresa', 'rh', 'supervisor', 'auditor'].includes(r)),
    employees: roles.some(r => ['admin_empresa', 'rh', 'supervisor', 'auditor'].includes(r)),
    cards: roles.some(r => ['admin_empresa', 'rh', 'auditor'].includes(r)),
    devices: roles.some(r => ['admin_empresa', 'rh', 'auditor'].includes(r)),
    manageDevices: roles.some(r => ['admin_empresa', 'rh'].includes(r)),
    incidents: roles.some(r => ['admin_empresa', 'rh', 'supervisor', 'auditor'].includes(r)),
    closures: roles.some(r => ['admin_empresa', 'rh', 'supervisor', 'auditor'].includes(r)),
    exports: roles.some(r => ['admin_empresa', 'rh', 'auditor'].includes(r)),
    users: roles.includes('admin_empresa'),
    schedules: roles.some(r => ['admin_empresa', 'rh', 'supervisor', 'auditor'].includes(r)),
    imports: roles.some(r => ['admin_empresa', 'rh'].includes(r)),
    settings: roles.some(r => ['admin_empresa', 'rh', 'supervisor', 'auditor'].includes(r)),
    editSettings: roles.includes('admin_empresa'),
    editSites: roles.includes('admin_empresa'),
    editDirectory: roles.some(r => ['admin_empresa', 'rh'].includes(r)),
    resolveIncidents: roles.some(r => ['admin_empresa', 'rh', 'supervisor'].includes(r)),
    closeWeeks: roles.some(r => ['admin_empresa', 'rh'].includes(r)),
    reopenClosures: roles.includes('admin_empresa'),
  }
}

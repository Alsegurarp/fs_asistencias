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

export async function apiDownload(path: string): Promise<{ blob: Blob; filename: string }> {
  const response = await request(path)
  const filename = /filename="([^"]+)"/i.exec(response.headers.get('Content-Disposition') || '')?.[1]
    .replace(/[\\/\u0000-\u001f\u007f]/g, '_') || 'zenit.csv'
  return { blob: await response.blob(), filename }
}

export type Me = { userId: string; displayName: string; roles: string[]; tenant: { name: string; timeZone: string } | null }
export type Page<T> = { items: T[]; nextCursor: string | null }
export type Site = { id: string; name: string; timeZone: string; latitude: number; longitude: number; radiusMeters: number; status: string }
export type Employee = { id: string; externalId: string; displayName: string; siteId: string | null; employmentStart: string; employmentEnd: string | null; status: string; activeCardId: string | null; currentScheduleId?: string | null }
export type Card = { id: string; label: string; status: string; assignment: { employeeId: string } | null }
export type TenantUser = { id: string; email: string; displayName: string; roles: string[]; status: 'invited' | 'active' | 'disabled'; createdAt: string; linkedAt: string | null; employeeId: string | null }

export function permissions(roles: string[]) {
  return {
    sites: roles.some(r => ['admin_empresa', 'rh', 'supervisor', 'auditor'].includes(r)),
    employees: roles.some(r => ['admin_empresa', 'rh', 'supervisor', 'auditor'].includes(r)),
    cards: roles.some(r => ['admin_empresa', 'rh', 'auditor'].includes(r)),
    incidents: roles.some(r => ['admin_empresa', 'rh', 'supervisor', 'auditor'].includes(r)),
    closures: roles.some(r => ['admin_empresa', 'rh', 'supervisor', 'auditor'].includes(r)),
    exports: roles.some(r => ['admin_empresa', 'rh', 'auditor'].includes(r)),
    users: roles.includes('admin_empresa'),
    schedules: roles.some(r => ['admin_empresa', 'rh', 'supervisor', 'auditor'].includes(r)),
    imports: roles.some(r => ['admin_empresa', 'rh'].includes(r)),
    editSites: roles.includes('admin_empresa'),
    editDirectory: roles.some(r => ['admin_empresa', 'rh'].includes(r)),
    resolveIncidents: roles.some(r => ['admin_empresa', 'rh', 'supervisor'].includes(r)),
    closeWeeks: roles.some(r => ['admin_empresa', 'rh'].includes(r)),
    reopenClosures: roles.includes('admin_empresa'),
  }
}

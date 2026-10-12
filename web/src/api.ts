import { accessToken, auth } from './auth'

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string,
    public correlationId?: string, public errors: { field: string; message: string }[] = []) {
    super(message)
  }
}

export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = await accessToken()
  const response = await fetch(`/api/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    if (response.status === 401) auth.clearToken()
    const problem = await response.json().catch(() => ({}))
    throw new ApiError(response.status, problem.code || '', problem.detail || problem.title || `HTTP ${response.status}`,
      problem.correlationId || response.headers.get('X-Correlation-Id') || undefined, problem.errors || [])
  }
  return response.status === 204 ? undefined as T : response.json()
}

export type Me = { displayName: string; roles: string[]; tenant: { name: string; timeZone: string } | null }
export type Page<T> = { items: T[]; nextCursor: string | null }
export type Site = { id: string; name: string; timeZone: string; latitude: number; longitude: number; radiusMeters: number; status: string }
export type Employee = { id: string; externalId: string; displayName: string; siteId: string | null; employmentStart: string; employmentEnd: string | null; status: string; activeCardId: string | null }
export type Card = { id: string; label: string; status: string; assignment: { employeeId: string } | null }

export function permissions(roles: string[]) {
  return {
    sites: roles.some(r => ['admin_empresa', 'rh', 'supervisor', 'auditor'].includes(r)),
    employees: roles.some(r => ['admin_empresa', 'rh', 'supervisor', 'auditor'].includes(r)),
    cards: roles.some(r => ['admin_empresa', 'rh', 'auditor'].includes(r)),
    editSites: roles.includes('admin_empresa'),
    editDirectory: roles.some(r => ['admin_empresa', 'rh'].includes(r)),
  }
}

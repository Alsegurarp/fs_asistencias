import { useQuery, type useQueryClient } from '@tanstack/react-query'
import { ApiError, type Site } from './api'
import { allPages } from './lists'
import type { ScheduleWithValidity } from './personnelModel'

/** Lo que comparten las pantallas de Personal y horarios: listas cortas, errores y qué actualizar. */

export function useSchedules() {
  return useQuery({ queryKey: ['schedules', 'all'], queryFn: () => allPages<ScheduleWithValidity>('/schedules'), retry: false, staleTime: 60_000 })
}
export function useSites() {
  return useQuery({ queryKey: ['sites', 'all'], queryFn: () => allPages<Site>('/sites'), retry: false, staleTime: 60_000 })
}

/** El mensaje del servidor, con el detalle de cada campo y la referencia. */
export function problemText(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback
  const fields = error.errors.map(item => item.message).join(' ')
  return `${fields || error.message}${error.correlationId ? ` Referencia: ${error.correlationId}.` : ''}`
}

/** Invalida lo que cambia cuando cambia una persona: la lista, sus conteos, su ficha y la asistencia. */
export function refreshPeople(cache: ReturnType<typeof useQueryClient>) {
  for (const key of ['employees', 'employee', 'employee-summary', 'schedule-assignments', 'cards', 'card-summary', 'attendance-weeks', 'attendance-summary']) void cache.invalidateQueries({ queryKey: [key] })
}

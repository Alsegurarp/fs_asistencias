import { expect, it } from 'vitest'
import type { Incident } from './incidentModel'
import { activityText, bellNotices, dateLine, firstName, firstSteps, pendingNotices, unseen, zoneName, type AuditEntry } from './panelModel'

const summary = {
  date: '2026-11-06', weekStart: '2026-11-02', timeZone: 'America/Mexico_City', siteId: null, people: 42,
  day: { marked: 38, attendanceEvents: 81, onShift: 34, noEntry: 4, foreignSite: 1 },
  week: { ordinaryMinutes: 71160, overtimeMinutes: 405, withOvertime: 3, withAttention: 4, missingExit: 3 },
  incidents: { open: 6, highSeverity: 1, unassigned: 4 },
  previousWeek: { weekStart: '2026-10-26', people: 42, closed: 39, agreed: 31, objected: 1 },
  devices: { active: 6, silent: 1 }, mostHours: [],
}
const closures = { weekStart: '2026-10-26', closed: 39, reopened: 0, blocked: 3, acknowledgements: { agreed: 31, objected: 1, none: 7 } }
const incident = (id: string, severity: string, type = 'missing_pair'): Incident => ({ id, type, severity, status: 'open', employeeId: 'e2', siteId: 's1', eventIds: [], openedAt: '2026-11-06T06:05:00Z',
  assigneeUserId: null, resolution: null, employeeName: 'Luis Hernández', occurredAt: '2026-11-05T23:10:00Z' })

it('saluda por el nombre y dice el día con la ciudad de la zona', () => {
  expect(firstName('Mariana Ortiz')).toBe('Mariana')
  expect(dateLine('2026-11-06', 'America/Mexico_City')).toBe('viernes 6 de noviembre, hora de Ciudad de México')
  expect(zoneName('America/Bahia_Banderas')).toBe('Bahía de Banderas')
  expect(zoneName('Europe/Madrid')).toBe('Madrid')
})

it('lo pendiente lleva a donde se atiende y su clave cambia con la cifra', () => {
  const notices = pendingNotices({ summary, closures })
  expect(notices.map(notice => [notice.title, notice.text, notice.to])).toEqual([
    ['Objeción a un cierre', 'Una persona no está conforme con la semana 26 oct – 1 nov', '/cierres?semana=2026-10-26&acuse=objecion'],
    ['Semanas sin cerrar', '3 personas bloqueadas en 26 oct – 1 nov, por incidencias o tramos abiertos', '/cierres?semana=2026-10-26&pestana=bloqueadas'],
    ['Lector sin señal', 'Un lector lleva más de 24 horas sin dar señal', '/dispositivos'],
  ])
  const more = pendingNotices({ summary: { ...summary, previousWeek: { ...summary.previousWeek, objected: 2 }, devices: { active: 6, silent: 2 } }, closures: { ...closures, blocked: 1 } })
  expect(more.map(notice => notice.text)).toEqual([
    '2 personas no están conformes con la semana 26 oct – 1 nov', '1 persona bloqueada en 26 oct – 1 nov, por incidencias o tramos abiertos', '2 lectores llevan más de 24 horas sin dar señal',
  ])
  expect(more.map(notice => notice.key)).not.toEqual(notices.map(notice => notice.key))
  // Supervisión no lee dispositivos y una semana sin pendientes no avisa.
  expect(pendingNotices({ summary: { ...summary, devices: null, previousWeek: { ...summary.previousWeek, objected: 0 } }, closures: { ...closures, blocked: 0 } })).toEqual([])
})

it('la campana suma el cambio de comida y sólo las incidencias de severidad alta', () => {
  const notices = bellNotices({
    upcoming: { breakPolicy: 'marked', effectiveOn: '2026-11-16', effectiveAt: '2026-11-16T06:00:00Z' },
    incidents: [incident('i1', 'high', 'clock_anomaly'), incident('i2', 'medium')], summary, closures, timeZone: 'America/Mexico_City', today: '2026-11-06',
  })
  expect(notices.map(notice => notice.title)).toEqual(['Cambio programado', 'Incidencia de severidad alta', 'Objeción a un cierre', 'Semanas sin cerrar', 'Lector sin señal'])
  expect(notices[0].text).toBe('La comida se marca desde el lun 16 nov')
  expect(notices[1]).toMatchObject({ text: 'Luis Hernández: hora del teléfono alterada', when: 'ayer 17:10', to: '/incidencias?incidencia=i1', tone: 'error' })
  expect(unseen(notices, [notices[0].key, 'algo que ya no está']).map(notice => notice.key)).toEqual(notices.slice(1).map(notice => notice.key))
  expect(bellNotices({ upcoming: { breakPolicy: 'not_considered', effectiveOn: '2026-11-16', effectiveAt: '' }, timeZone: 'America/Mexico_City', today: '2026-11-06' })[0].text)
    .toBe('La comida deja de marcarse desde el lun 16 nov')
})

it('la actividad dice quién hizo qué, con el nombre de lo que tocó', () => {
  const entry = (action: string, actor: AuditEntry['actor'], target: string | null = null): AuditEntry =>
    ({ id: action, at: '2026-11-06T16:41:00Z', action, actor, target: { type: 'x', id: null, displayName: target }, metadata: {} })
  const person = { type: 'user' as const, id: 'u1', displayName: 'Rocío Navarro' }
  expect(activityText(entry('card.assigned', person, 'T-0042'))).toEqual({ who: 'Rocío Navarro', what: 'asignó la tarjeta T-0042' })
  expect(activityText(entry('incident.assigned', person, 'Carmen Vega'))).toEqual({ who: 'Rocío Navarro', what: 'tomó la incidencia de Carmen Vega' })
  expect(activityText(entry('user.invited', person, 'Hugo Peña'))).toEqual({ who: 'Rocío Navarro', what: 'invitó a Hugo Peña' })
  // Al entrar por primera vez la cuenta se liga sola: no se dice dos veces el nombre.
  expect(activityText(entry('user.linked', { type: 'user', id: 'u2', displayName: 'Carmen Vega' }, 'Carmen Vega'))).toEqual({ who: 'Carmen Vega', what: 'entró por primera vez' })
  expect(activityText(entry('user.linked', person, 'Carmen Vega'))).toEqual({ who: 'Rocío Navarro', what: 'ligó la cuenta de Carmen Vega' })
  expect(activityText(entry('incident.opened', { type: 'system', id: null, displayName: null }, 'Luis Hernández'))).toEqual({ who: 'Se abrió', what: 'una incidencia de Luis Hernández' })
  expect(activityText(entry('week.closed', { type: 'system', id: null, displayName: null }, 'Ana Torres'))).toEqual({ who: 'Zenit', what: 'cerró la semana de Ana Torres' })
  expect(activityText(entry('week.closed', person))).toEqual({ who: 'Rocío Navarro', what: 'cerró la semana' })
  expect(activityText(entry('algo.nuevo', { type: 'user', id: null, displayName: null }))).toEqual({ who: 'Operación del servicio', what: 'hizo un cambio' })
})

it('los primeros pasos marcan lo que la empresa ya tiene', () => {
  const none = firstSteps({ sites: [], schedules: 0, employees: 0, cards: 0, devices: 0, users: 1 })
  expect(none.map(step => step.done)).toEqual([true, false, false, false, false, false, false])
  const some = firstSteps({ sites: [{ name: 'Matriz Centro', radiusMeters: 120 }], schedules: 2, employees: 0, cards: 0, devices: 1, users: 3 })
  expect(some.filter(step => step.done).map(step => step.key)).toEqual(['empresa', 'sedes', 'horarios', 'lectores', 'equipo'])
  expect(some[1]).toMatchObject({ detail: '1 sede: Matriz Centro, círculo de 120 m', action: 'Agregar otra', to: '/configuracion/sedes' })
  expect(some.map(step => step.to)).toEqual(['/configuracion', '/configuracion/sedes', '/personal/horarios', '/personal/importaciones', '/dispositivos/tarjetas', '/dispositivos', '/usuarios'])
})

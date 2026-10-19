import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const base = new URL(process.argv[2] || 'https://zenit.fastsolution.com.mx')
const tokenPath = process.argv[3] || 'secrets/android-development-token.txt'
assert.equal(base.protocol, 'https:')
assert.equal(base.pathname, '/')
assert.ok(!base.username && !base.password && !base.search && !base.hash)
assert.ok(process.argv.includes('--fictitious-data'), 'Indica --fictitious-data en una empresa destinada a pruebas')
const prefix = `qa-${randomUUID().slice(0, 20)}`
const evidence = { origin: base.origin, prefix, startedAt: new Date().toISOString(), checks: [], cleanup: [] }
mkdirSync('build', { recursive: true })
async function api(path, method = 'GET', body, expected = 200, key) {
  const token = readFileSync(tokenPath, 'utf8').trim().replace(/^Bearer\s+/i, '')
  assert.match(token, /^[\w-]+\.[\w-]+\.[\w-]+$/)
  const headers = { Authorization: `Bearer ${token}` }
  if (key) headers['Idempotency-Key'] = key
  if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body) }
  const response = await fetch(`${base.origin}/api/v1${path}`, { method, headers, body, signal: AbortSignal.timeout(20000) })
  const result = await response.json()
  assert.equal(response.status, expected, `${method} ${path}: HTTP ${response.status}, ${result.code || ''}`)
  return result
}
function csvImport(csv, dryRun = true, key = randomUUID()) {
  const form = new FormData()
  form.set('file', new Blob([csv], { type: 'text/csv' }), 'ensayo.csv')
  form.set('dryRun', String(dryRun))
  return api('/imports/csv', 'POST', form, 202, key)
}
let site
let failure
try {
  const me = await api('/me')
  assert.ok(me.tenant && me.roles.includes('admin_empresa'))
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: me.tenant.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]))
  const today = `${parts.year}-${parts.month}-${parts.day}`
  const later = new Date(`${today}T12:00:00Z`)
  later.setUTCDate(later.getUTCDate() + 7)
  const future = later.toISOString().slice(0, 10)
  site = await api('/sites', 'POST', { name: prefix, timeZone: me.tenant.timeZone, latitude: 19.4326, longitude: -99.1332, radiusMeters: 100 }, 201)
  evidence.siteId = site.id
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map(dayOfWeek => ({ dayOfWeek, startTime: '09:00', endTime: '17:00', breakMinutes: 30 }))
  const schedule = await api('/schedules', 'POST', { name: `${prefix}-actual`, timeZone: me.tenant.timeZone, validFrom: today, validTo: future, days }, 201)
  const saved = await api(`/schedules/${schedule.id}`)
  assert.deepEqual(saved.days, days)
  assert.equal(saved.validFrom, today)
  const employee = await api('/employees', 'POST', { externalId: `${prefix}-manual`, displayName: 'Ensayo horarios', siteId: site.id, employmentStart: today }, 201)
  await api(`/employees/${employee.id}/schedule-assignments`, 'POST', { scheduleId: schedule.id, validFrom: today }, 201)
  assert.equal((await api(`/employees/${employee.id}`)).currentScheduleId, schedule.id)
  const futureSchedule = await api('/schedules', 'POST', { name: `${prefix}-futuro`, timeZone: me.tenant.timeZone, validFrom: future, validTo: future, days }, 201)
  await api(`/employees/${employee.id}/schedule-assignments`, 'POST', { scheduleId: futureSchedule.id, validFrom: future }, 201)
  assert.equal((await api(`/employees/${employee.id}`)).currentScheduleId, schedule.id)
  evidence.scheduleIds = [schedule.id, futureSchedule.id]
  evidence.checks.push('Horario 09–17 con descanso, persistencia y asignación futura sin alterar el horario vigente')

  const header = 'external_id,display_name,employment_start,site_name\n'
  const valid = `${prefix}-csv,Ensayo importacion,${today},${prefix}\n`
  const csv = `${header}${valid}${prefix}-invalido,Ensayo rechazado,fecha-invalida,${prefix}\n`
  const preview = await csvImport(csv)
  assert.equal(preview.status, 'ready')
  assert.deepEqual(preview.counts, { total: 2, accepted: 1, rejected: 1 })
  assert.equal((await api(`/employees?siteId=${site.id}&limit=100`)).items.length, 1)
  evidence.checks.push('Validación CSV mixta informa un error y no modifica el padrón')
  const key = randomUUID()
  const applied = await csvImport(csv, false, key)
  assert.equal(applied.status, 'applied')
  assert.equal((await csvImport(csv, false, key)).id, applied.id)
  await csvImport(csv, false)
  const rows = (await api(`/employees?siteId=${site.id}&limit=100`)).items
  assert.equal(rows.length, 2)
  const imported = rows.find(row => row.externalId === `${prefix}-csv`)
  assert.ok(imported)
  assert.equal(imported.employmentStart, today)
  assert.equal(imported.siteId, site.id)
  await csvImport(`${header}${prefix}-csv,Ensayo corregido,${today},${prefix}\n`, false)
  assert.equal((await api(`/employees/${imported.id}`)).displayName, 'Ensayo corregido')
  assert.equal((await api(`/employees?siteId=${site.id}&limit=100`)).items.length, 2)
  const unknown = await csvImport(`${header}${prefix}-otro,Ensayo sin sede,${today},sede-inexistente-${prefix}\n`)
  assert.equal(unknown.counts.accepted, 0)
  assert.equal(unknown.counts.rejected, 1)
  const empty = new FormData()
  empty.set('file', new Blob([''], { type: 'text/csv' }), 'vacio.csv')
  empty.set('dryRun', 'true')
  await api('/imports/csv', 'POST', empty, 422, randomUUID())
  evidence.checks.push('Aplicación parcial, idempotencia, repetición sin duplicados, actualización, sede inexistente y archivo vacío')
  evidence.result = 'passed'
} catch (error) {
  failure = error
  evidence.result = 'failed'
  evidence.error = error.message
} finally {
  if (site) {
    try {
      const rows = (await api(`/employees?siteId=${site.id}&limit=100`)).items
      for (const row of rows) {
        assert.ok(row.externalId.startsWith(prefix), 'La limpieza sólo puede tocar empleados propios del ensayo')
        assert.equal((await api(`/employees/${row.id}`, 'PATCH', { status: 'inactive' })).status, 'inactive')
        evidence.cleanup.push({ employeeId: row.id, status: 'inactive' })
      }
      assert.equal((await api(`/sites/${site.id}`, 'PATCH', { status: 'inactive' })).status, 'inactive')
      evidence.cleanup.push({ siteId: site.id, status: 'inactive' })
    } catch (error) { evidence.cleanupError = error.message; failure ||= error; evidence.result = 'failed' }
  }
  evidence.finishedAt = new Date().toISOString()
  evidence.remaining = 'Falta la ejecución de las pantallas y la sesión completa del navegador, y permisos con cuentas de otros roles.'
  writeFileSync(`build/${prefix}-directory.json`, JSON.stringify(evidence, null, 2))
  console.log(`Horarios/importación API: ${evidence.result}; evidencia en build/${prefix}-directory.json`)
}
if (failure) throw failure

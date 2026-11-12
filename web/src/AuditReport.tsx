import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Box, Button, Stack, TextField, Typography, useMediaQuery } from '@mui/material'
import { api, ApiError, type Me, type Page } from './api'
import { addDays, csv, timeIn, todayIn } from './attendanceModel'
import { type AuditEntry, type AuditSummary, actionText, actorText, actorTypes, auditGroups } from './auditModel'
import { color, phoneQuery, shadow } from './design'
import { type Picked, PersonPicker } from './DeviceForms'
import { saveFile } from './files'
import { Icon } from './Icons'
import { dateInZone, zonedInstants } from './incidentModel'
import { allPages } from './lists'
import { problemText } from './personnelData'
import { FormatSwitch, ReportSheet, SheetHeader, printSheet } from './ReportSheet'
import type { PaperKey } from './reportsModel'
import { PageHeader } from './Shell'
import type { Screen, Section } from './sections'
import { shortDay } from './settingsModel'
import { Badge, FilterChip, Note, Pager, Pane, SelectBox, SkeletonRows, tableSx, visuallyHidden } from './ui'

type Props = { me: Me; context: string; section: Section; screens: Screen[]; screen: Screen }

const pageSize = 12
/** Lo más que se lleva a la hoja o al CSV; más allá, se pide acotar el periodo. */
const sheetLimit = 4000

/** «31 oct 18:40». */
function whenAt(instant: string, timeZone: string) { return `${shortDay(dateInZone(instant, timeZone)).replace(/^\S+ /, '')} ${timeIn(instant, timeZone)}` }

/**
 * Bitácora (REP-07 y 08): quién hizo qué y cuándo, con los filtros del
 * servidor en la dirección (`?desde=`, `?hasta=`, `?quien=`, `?accion=` y
 * `?persona=`). La vista previa (`?vista=previa`) lleva la lista completa a
 * una hoja para imprimir o guardar como PDF, o a un CSV.
 */
export function AuditReport({ me, context, section, screen }: Props) {
  const timeZone = me.tenant!.timeZone
  const today = todayIn(timeZone)
  const phone = useMediaQuery(phoneQuery)
  const [params, setParams] = useSearchParams()
  const from = params.get('desde') || addDays(today, -30)
  const to = params.get('hasta') || today
  const actor = actorTypes.find(item => item.key === params.get('quien')) || actorTypes[0]
  const group = auditGroups.find(item => item.key === params.get('accion')) || auditGroups[0]
  const personId = params.get('persona') || ''
  const preview = params.get('vista') === 'previa'
  const [person, setPerson] = useState<Picked | null>(null)
  const change = (values: Record<string, string | null>, replace = false) => setParams(current => {
    const next = new URLSearchParams(current)
    for (const [key, value] of Object.entries(values)) if (value) next.set(key, value); else next.delete(key)
    return next
  }, { replace })

  const wrongRange = from > to
  const filters = new URLSearchParams()
  const start = zonedInstants(`${from}T00:00`, timeZone)[0]
  const end = zonedInstants(`${addDays(to, 1)}T00:00`, timeZone)[0]
  if (start) filters.set('from', start)
  if (end) filters.set('to', end)
  if (actor.key) filters.set('actorType', actor.key)
  if (group.key) filters.set('group', group.key)
  if (personId) { filters.set('targetType', 'employee'); filters.set('targetId', personId) }
  const scope = filters.toString()
  const filtered = !!(actor.key || group.key || personId || params.get('desde') || params.get('hasta'))

  const [pages, setPages] = useState<{ scope: string; cursors: string[] }>({ scope, cursors: [''] })
  const cursors = pages.scope === scope ? pages.cursors : ['']
  const cursor = cursors.at(-1)!
  const list = useQuery({ queryKey: ['audit-log', scope, cursor], enabled: !wrongRange && !preview, retry: false,
    queryFn: () => api<Page<AuditEntry>>(`/audit-log?${scope}&limit=${pageSize}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`) })
  const summary = useQuery({ queryKey: ['audit-summary', scope], enabled: !wrongRange, retry: false, queryFn: () => api<AuditSummary>(`/audit-log/summary?${scope}`) })
  const total = summary.data ? (summary.data.capped ? `más de ${summary.data.cap.toLocaleString('es-MX')}` : summary.data.total.toLocaleString('es-MX')) : '…'
  const rows = list.data?.items || []
  const offset = (cursors.length - 1) * pageSize
  const scopeText = [`${shortDay(from, true).replace(/^\S+ /, '')} – ${shortDay(to, true).replace(/^\S+ /, '')}`,
    group.key ? group.label.toLowerCase() : 'todas las acciones', actor.key ? actor.label.toLowerCase() : 'todos', ...(person ? [person.displayName] : [])].join(' · ')

  const header = <PageHeader context={context} section={section} screens={[screen]} current={screen} title="Bitácora"
    description="quién hizo qué y cuándo: personas, lectores y el sistema"
    actions={<Button variant="text" component={Link} to="/reportes" startIcon={<Icon name="back" size={16} />}>Elegir otro reporte</Button>} />

  if (preview) return <>
    {header}
    <AuditPreview me={me} scope={scope} scopeText={scopeText} total={summary.data} from={from} to={to} />
    <Stack direction="row" sx={{ flex: 'none', justifyContent: 'flex-start', pb: 1 }}>
      <Button variant="outlined" onClick={() => change({ vista: null })}>Anterior</Button>
    </Stack>
  </>

  return <>
    {header}
    <Box component="form" aria-label="Filtros" noValidate onSubmit={event => event.preventDefault()}
      sx={{ flex: 'none', background: color.white, borderRadius: '20px', boxShadow: shadow.card, p: '14px 16px', display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <TextField name="desde" label="Desde" type="date" size="small" value={from} onChange={event => change({ desde: event.target.value || null }, true)}
          error={wrongRange} slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }} />
        <TextField name="hasta" label="Hasta" type="date" size="small" value={to} onChange={event => change({ hasta: event.target.value || null }, true)}
          error={wrongRange} helperText={wrongRange ? '«Desde» va antes de «Hasta».' : undefined} slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }} />
      </Stack>
      <Box role="group" aria-label="Quién actuó" sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
        {actorTypes.map(item => <FilterChip key={item.key || 'todos'} small={phone} pressed={item.key === actor.key} onClick={() => change({ quien: item.key || null })}>{item.label}</FilterChip>)}
      </Box>
      <SelectBox name="accion" label="Acción" value={group.key} onChange={value => change({ accion: value || null })} options={auditGroups.map(item => ({ value: item.key, label: item.label }))} />
      <Box sx={{ minWidth: 240, flex: '1 1 240px', maxWidth: 360 }}>
        <PersonPicker label="Persona" value={personId ? person || { id: personId, displayName: 'Persona elegida', externalId: '' } : null}
          onChange={value => { setPerson(value); change({ persona: value?.id || null }) }} />
      </Box>
      {filtered && <Button variant="text" onClick={() => { setPerson(null); setParams({}, { replace: true }) }}>Quitar filtros</Button>}
    </Box>
    <Pane titleId="bitacora-lista" title={wrongRange ? 'Revisa el periodo' : `${total} ${summary.data?.total === 1 ? 'acción' : 'acciones'} con estos filtros`}
      detail="se actualiza al cambiar un filtro"
      footer={rows.length ? <Pager text={`${offset + 1}–${offset + rows.length}`} hasPrevious={cursors.length > 1} hasNext={!!list.data?.nextCursor}
        onPrevious={() => setPages({ scope, cursors: cursors.slice(0, -1) })} onNext={() => setPages({ scope, cursors: [...cursors, list.data!.nextCursor!] })} /> : undefined}>
      {list.isError ? <Box sx={{ p: 2 }}><Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
        <Note tone="error">{list.error instanceof ApiError && list.error.status === 403 ? 'Tu rol ya no puede consultar la bitácora.' : problemText(list.error, 'No pudimos cargar la bitácora.')}</Note>
        <Button variant="outlined" onClick={() => void list.refetch()}>Reintentar</Button>
      </Stack></Box> : !list.isPending && !rows.length ? <Stack spacing={1} sx={{ p: 4, alignItems: 'center', textAlign: 'center' }}>
        <Typography sx={{ fontWeight: 600 }}>{wrongRange ? 'El periodo no tiene días' : 'Ninguna acción con estos filtros'}</Typography>
        {filtered && !wrongRange && <Typography sx={{ fontSize: 13, color: color.muted }}>Prueba con otro periodo o quita algún filtro.</Typography>}
      </Stack> : <Box sx={{ overflowX: 'auto' }}>
        {list.isPending && <Typography role="status" sx={visuallyHidden}>Cargando la bitácora…</Typography>}
        <Box component="table" sx={{ ...tableSx, '& td:last-of-type': { whiteSpace: 'normal', minWidth: 260 } }}>
          <thead><tr><th scope="col">Fecha y hora</th><th scope="col">Quién</th><th scope="col">Acción</th></tr></thead>
          <tbody>
            {list.isPending ? <SkeletonRows columns={3} rows={8} /> : rows.map(entry => <tr key={entry.id}>
              <Box component="td" sx={{ color: color.muted, fontVariantNumeric: 'tabular-nums' }}>{whenAt(entry.at, timeZone)}</Box>
              <td>{entry.actor.type === 'system' ? <Badge tone="neutral">Sistema</Badge> : <strong>{actorText(entry)}</strong>}</td>
              <td>{actionText(entry)}</td>
            </tr>)}
          </tbody>
        </Box>
      </Box>}
    </Pane>
    <Typography sx={{ flex: 'none', fontSize: 12.5, color: color.muted }}>La bitácora no se puede editar; cada fila guarda su referencia. La lista completa sale en la vista previa.</Typography>
    <Stack direction="row" sx={{ flex: 'none', justifyContent: 'flex-end', pb: 1 }}>
      <Button variant="contained" disabled={wrongRange || !summary.data?.total} onClick={() => change({ vista: 'previa' })}>Ver vista previa</Button>
    </Stack>
  </>
}

/** La lista completa con estos filtros, en una hoja para imprimir o en un CSV. */
function AuditPreview({ me, scope, scopeText, total, from, to }: { me: Me; scope: string; scopeText: string; total?: AuditSummary; from: string; to: string }) {
  const timeZone = me.tenant!.timeZone
  const [format, setFormat] = useState<'pdf' | 'csv'>('pdf')
  const [paper, setPaper] = useState<PaperKey>('carta-v')
  const [generated] = useState(() => new Date().toISOString())
  const tooMany = !!total && (total.capped || total.total > sheetLimit)
  const all = useQuery({ queryKey: ['audit-log', 'todo', scope], enabled: !!total && !tooMany, retry: false, staleTime: 60_000,
    queryFn: () => allPages<AuditEntry>(`/audit-log?${scope}`, sheetLimit / 200) })
  const entries = useMemo(() => all.data || [], [all.data])
  useEffect(() => { document.title = 'Bitácora · Zenit' }, [])
  if (tooMany) return <Note tone="warn">Con estos filtros hay {total!.capped ? `más de ${total!.cap.toLocaleString('es-MX')}` : total!.total.toLocaleString('es-MX')} acciones. La hoja y el CSV llegan hasta {sheetLimit.toLocaleString('es-MX')}: acorta el periodo o filtra por acción.</Note>
  if (all.isError) return <Note tone="error">{problemText(all.error, 'No pudimos cargar la bitácora completa.')}</Note>
  if (!all.data) return <Typography role="status" sx={{ color: color.muted }}>Cargando la bitácora completa…</Typography>
  const lines = entries.map(entry => [whenAt(entry.at, timeZone), actorText(entry), actionText(entry)])
  const generatedText = `${shortDay(dateInZone(generated, timeZone), true).replace(/^\S+ /, '')}, ${timeIn(generated, timeZone)}`
  const downloadCsv = () => saveFile(new Blob([csv([
    ['fecha_hora', 'zona_horaria', 'tipo_de_actor', 'quien', 'accion', 'codigo_de_accion', 'tipo_de_objeto', 'objeto', 'referencia'],
    ...entries.map(entry => [entry.at, timeZone, entry.actor.type, actorText(entry), actionText(entry), entry.action, entry.target.type, entry.target.displayName || entry.target.id || '', entry.correlationId || entry.id]),
  ])], { type: 'text/csv;charset=utf-8' }), `zenit-bitacora-${from}-${to}.csv`)
  return <Stack spacing={1.5} sx={{ minHeight: 0 }}>
    <Stack direction="row" useFlexGap sx={{ gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
      <FormatSwitch value={format} onChange={value => setFormat(value as 'pdf' | 'csv')} options={[{ key: 'pdf', label: 'PDF' }, { key: 'csv', label: 'CSV' }]} />
      <Typography sx={{ fontSize: 13, color: color.muted }}>{scopeText}</Typography>
    </Stack>
    {format === 'pdf' ? <>
      <ReportSheet title="Bitácora" paper={paper} onPaper={setPaper}>
        <SheetHeader company={me.tenant!.name} title={`Bitácora · ${scopeText.split(' · ')[0]}`} lines={[
          `${entries.length.toLocaleString('es-MX')} ${entries.length === 1 ? 'acción' : 'acciones'} · ${scopeText.split(' · ').slice(1).join(' · ')}`,
          `Generada por ${me.displayName} el ${generatedText}, hora de la empresa`,
        ]} />
        <table>
          <thead><tr><th scope="col" style={{ width: '18%' }}>Fecha y hora</th><th scope="col" style={{ width: '22%' }}>Quién</th><th scope="col">Acción</th></tr></thead>
          <tbody>{lines.map((line, index) => <tr key={entries[index].id}>{line.map((cell, column) => <td key={column} className={column === 0 ? 'muted' : undefined}>{cell}</td>)}</tr>)}</tbody>
        </table>
        <Box sx={{ mt: '12pt', fontSize: '7.5pt', color: '#5E6E89' }}>Registro sin ediciones posibles; cada fila guarda su referencia. Esta hoja se imprimió desde el portal.</Box>
      </ReportSheet>
      <Note>«Descargar PDF» abre la impresión del navegador: elige «Guardar como PDF». La hoja no queda registrada como descarga.</Note>
      <Stack direction="row" useFlexGap sx={{ gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Button variant="outlined" onClick={printSheet}>Imprimir</Button>
        <Button variant="contained" onClick={printSheet}>Descargar PDF</Button>
      </Stack>
    </> : <Box component="section" aria-labelledby="bitacora-csv" sx={{ background: color.white, borderRadius: '20px', boxShadow: shadow.card, p: '18px 20px', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography component="h2" id="bitacora-csv" sx={{ fontSize: 15, fontWeight: 700 }}>CSV de la bitácora</Typography>
      <Typography sx={{ fontSize: 14 }}>{entries.length.toLocaleString('es-MX')} {entries.length === 1 ? 'fila' : 'filas'}, una por acción, con la fecha y hora exacta, quién, la acción en palabras y su código, el objeto y su referencia.</Typography>
      <Box><Button variant="contained" onClick={downloadCsv}>Descargar CSV</Button></Box>
      <Typography sx={{ fontSize: 12.5, color: color.muted }}>Lo arma el portal con lo que devuelve la bitácora; no queda registrado como descarga.</Typography>
    </Box>}
  </Stack>
}

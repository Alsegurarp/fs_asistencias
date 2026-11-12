import { type ReactNode } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Button, Stack, Typography, useMediaQuery } from '@mui/material'
import { api, apiDownload, ApiError, type Me, type Page, permissions } from './api'
import { color, phoneQuery, shadow } from './design'
import { saveFile } from './files'
import { Icon, type IconName } from './Icons'
import { problemText, useSites } from './personnelData'
import { type ExportRecord, exportStatusOf, scopeLabel, whenText } from './reportsModel'
import { PageHeader } from './Shell'
import type { Screen, Section } from './sections'
import { Badge, Note, Pane, SkeletonRows, tableSx, visuallyHidden } from './ui'

type Props = { me: Me; context: string; section: Section; screens: Screen[]; screen: Screen; dossier: boolean }

/**
 * Reportes y expediente (REP-01): qué se puede generar y lo generado hace
 * poco. Cada reporte abre su asistente; sólo aparece lo que el rol permite.
 */
export function Reports({ me, context, section, screen, dossier }: Props) {
  const allowed = permissions(me.roles)
  const audit = me.roles.some(role => role === 'admin_empresa' || role === 'auditor')
  const timeZone = me.tenant!.timeZone
  const phone = useMediaQuery(phoneQuery)
  const exports = useQuery({ queryKey: ['exports', 'recientes'], enabled: allowed.exports, retry: false,
    queryFn: () => api<Page<ExportRecord>>('/exports?limit=8'), refetchInterval: query => query.state.data?.items.some(item => item.status === 'queued') ? 5000 : false })
  const sites = useSites()
  const siteName = (id: string | null) => (id ? sites.data?.find(site => site.id === id)?.name : undefined)
  const latest = exports.data?.items[0]
  const rows = exports.data?.items || []
  return <>
    <PageHeader context={context} section={section} screens={[screen]} current={screen} title="¿Qué quieres generar?"
      description="elige uno; un asistente te guía y te muestra cómo queda antes de descargar o imprimir" />
    <Box sx={{ flex: 'none', display: 'grid', gridTemplateColumns: phone ? '1fr' : 'repeat(auto-fit, minmax(260px, 1fr))', gap: 2 }}>
      {allowed.exports && <ReportCard icon="reports" title="Reporte para nómina" to="/reportes/nomina"
        detail="Horas ordinarias y extra y acuses de una semana cerrada, por persona y sede. En PDF para revisar o firmar, o en CSV para tu sistema de nómina."
        note={latest ? `Último: ${scopeLabel(latest.weekStart, siteName(latest.siteId))}${latest.createdAt ? `, ${whenText(latest.createdAt, timeZone)}` : ''}` : undefined} />}
      <ReportCard icon="closures" title="Expediente de la empresa" to={dossier ? '/reportes/expediente' : undefined}
        detail="Copia íntegra de toda tu información, con manifiesto y huellas, para auditorías o inspecciones. Se descarga una sola vez y pide confirmar tu identidad."
        note={dossier ? 'Tienes el permiso explícito' : 'Requiere permiso explícito; lo concede Administración'} />
      {audit && <ReportCard icon="list" title="Bitácora" to="/reportes/bitacora"
        detail="Quién hizo qué y cuándo: personas, lectores y el sistema. Filtra por periodo, por quién actuó, por la acción o por la persona, y sácala en PDF o CSV."
        note="Administración y Auditoría" />}
    </Box>
    {allowed.exports && <Pane titleId="recientes" title="Generados recientemente" detail="cada descarga queda en la bitácora">
      {exports.isError ? <Box sx={{ p: 2 }}><Note tone="error">{exports.error instanceof ApiError && exports.error.status === 403 ? 'Tu rol ya no puede consultar los reportes.' : problemText(exports.error, 'No pudimos cargar los reportes.')}</Note></Box>
        : !exports.isPending && !rows.length ? <Stack spacing={1} sx={{ p: 4, alignItems: 'center', textAlign: 'center' }}>
          <Typography sx={{ fontWeight: 600 }}>Todavía no se ha generado ningún reporte</Typography>
          <Typography sx={{ fontSize: 13, color: color.muted }}>El primero aparece aquí en cuanto lo pidas.</Typography>
        </Stack> : <Box sx={{ overflowX: 'auto' }}><Box component="table" sx={tableSx}>
          <thead><tr><th scope="col">Tipo</th><th scope="col">Periodo o alcance</th><th scope="col">Pidió</th><th scope="col">Cuándo</th><th scope="col">Estado</th><th scope="col"><Box component="span" sx={visuallyHidden}>Acciones</Box></th></tr></thead>
          <tbody>
            {exports.isPending ? <SkeletonRows columns={6} rows={3} /> : rows.map(record => <tr key={record.id}>
              <td><strong>Reporte para nómina</strong></td>
              <td>{scopeLabel(record.weekStart, siteName(record.siteId))}</td>
              <Box component="td" sx={{ color: color.muted }}>{record.requestedByName || '—'}</Box>
              <Box component="td" sx={{ color: color.muted }}>{record.createdAt ? whenText(record.createdAt, timeZone) : '—'}</Box>
              <td><Badge tone={exportStatusOf(record).tone}>{exportStatusOf(record).label}</Badge></td>
              <Box component="td" sx={{ textAlign: 'right' }}><ExportActions record={record} /></Box>
            </tr>)}
          </tbody>
        </Box></Box>}
    </Pane>}
  </>
}

function ReportCard({ icon, title, detail, note, to }: { icon: IconName; title: string; detail: string; note?: string; to?: string }) {
  return <Box component="section" aria-label={title} sx={{ background: color.white, borderRadius: '20px', boxShadow: shadow.card, p: '18px 20px', display: 'flex', flexDirection: 'column', gap: 1.25, opacity: to ? 1 : 0.85 }}>
    <Box aria-hidden="true" sx={{ width: 42, height: 42, borderRadius: '12px', background: 'linear-gradient(145deg, #EEF4FE 0%, #DCE7FC 100%)', color: color.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} /></Box>
    <Typography component="h2" sx={{ fontSize: 17, fontWeight: 700 }}>{title}</Typography>
    <Typography sx={{ fontSize: 13.5, color: color.inkSoft, lineHeight: 1.55, flex: 1 }}>{detail}</Typography>
    {note && <Typography sx={{ fontSize: 12.5, color: color.muted }}>{note}</Typography>}
    <Box>{to ? <Button variant="contained" component={Link} to={to} aria-label={`Empezar: ${title}`} sx={{ color: `${color.white} !important` }}>Empezar</Button>
      : <Button variant="outlined" disabled>Empezar</Button>}</Box>
  </Box>
}

/** Lo que se puede hacer con un exporte según su estado: verlo, descargarlo una vez o pedirlo de nuevo. */
function ExportActions({ record }: { record: ExportRecord }) {
  const cache = useQueryClient()
  const refresh = () => void cache.invalidateQueries({ queryKey: ['exports'] })
  const download = useMutation({ mutationFn: () => apiDownload(`/exports/${record.id}/download`), onSuccess: ({ blob, filename }) => { saveFile(blob, filename); refresh() }, onError: refresh })
  const again = useMutation({ mutationFn: () => api<ExportRecord>('/exports', 'POST', { weekStart: record.weekStart, format: 'csv', ...(record.siteId ? { siteId: record.siteId } : {}) }, crypto.randomUUID()), onSuccess: refresh })
  const preview = `/reportes/nomina?${new URLSearchParams({ paso: '3', semana: record.weekStart, ...(record.siteId ? { sede: record.siteId } : {}) })}`
  let actions: ReactNode = null
  if (record.status === 'ready') actions = <>
    <Button size="small" component={Link} to={preview}>Vista previa</Button>
    <Button size="small" variant="outlined" disabled={download.isPending} onClick={() => download.mutate()}>{download.isPending ? 'Descargando…' : 'Descargar'}</Button>
  </>
  else if (record.status !== 'queued') actions = <>
    <Button size="small" component={Link} to={preview}>Vista previa</Button>
    <Button size="small" variant="outlined" disabled={again.isPending} onClick={() => again.mutate()}>{record.status === 'failed' ? 'Reintentar' : 'Pedir de nuevo'}</Button>
  </>
  const error = download.error || again.error
  return <Stack direction="row" spacing={0.75} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
    {error && <Typography role="alert" sx={{ fontSize: 12, color: color.error }}>{problemText(error, 'No se pudo.')}</Typography>}
    {actions}
  </Stack>
}

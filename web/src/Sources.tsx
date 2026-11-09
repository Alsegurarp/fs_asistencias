import { useQuery } from '@tanstack/react-query'
import { Box, Stack, Typography } from '@mui/material'
import { api, type Me, type Page } from './api'
import { todayIn } from './attendanceModel'
import { color } from './design'
import { whenText } from './incidentsView'
import { type AuditEntry, activityText } from './panelModel'
import { PersonnelHeader } from './Personnel'
import type { Checkpoint } from './personnelModel'
import type { Screen, Section } from './sections'
import { Badge, Note, Pane, SkeletonRows, tableSx, visuallyHidden } from './ui'

type Props = { me: Me; context: string; section: Section; screens: Screen[]; screen: Screen }

const kinds: Record<Checkpoint['type'], string> = { csv: 'Archivo CSV', api: 'Sistema de nómina', connector: 'Conector' }
const types: Record<Checkpoint['type'], string> = { csv: 'CSV', api: 'API', connector: 'Conector' }
const states: Record<Checkpoint['status'], { label: string; tone: 'ok' | 'warn' | 'error' }> = {
  active: { label: 'Activa', tone: 'ok' }, paused: { label: 'En pausa', tone: 'warn' }, error: { label: 'Con error', tone: 'error' },
}

/**
 * Fuentes del padrón (PAD-10): de dónde llegan las personas, hasta qué punto
 * se leyó cada fuente y, para Administración, los cambios recientes del padrón
 * de la bitácora. Lo ven Administración y RH.
 */
export function Sources(props: Props) {
  const { me } = props
  const timeZone = me.tenant!.timeZone
  const today = todayIn(timeZone)
  const readsLog = me.roles.includes('admin_empresa')
  const checkpoints = useQuery({ queryKey: ['checkpoints'], queryFn: () => api<{ items: Checkpoint[] }>('/integrations/checkpoints').then(data => data.items), retry: false })
  const changes = useQuery({ queryKey: ['audit-log', 'padron'], enabled: readsLog, retry: false, queryFn: () => api<Page<AuditEntry>>('/audit-log?group=directory&limit=10') })
  const rows = checkpoints.data || []
  return <>
    <PersonnelHeader {...props} />
    <Pane titleId="fuentes-tabla" title={checkpoints.isPending ? 'Cargando fuentes…' : `${rows.length} ${rows.length === 1 ? 'fuente' : 'fuentes'}`}
      footer={<Typography sx={{ flex: 'none', p: '10px 16px', fontSize: 12.5, color: color.subtle, borderTop: `1px solid ${color.lineSoft}` }}>Una fuente en pausa no recibe cambios hasta reanudarla.</Typography>}>
      {checkpoints.isPending && <Typography role="status" sx={visuallyHidden}>Cargando fuentes…</Typography>}
      {checkpoints.isError ? <Box sx={{ p: 2 }}><Note tone="error">No pudimos cargar las fuentes del padrón.</Note></Box>
        : !checkpoints.isPending && !rows.length ? <Stack spacing={1} sx={{ p: 4, alignItems: 'center', textAlign: 'center' }}>
          <Typography sx={{ fontWeight: 600 }}>Todavía no hay fuentes</Typography>
          <Typography sx={{ fontSize: 13, color: color.muted, maxWidth: 440 }}>Una fuente aparece al aplicar el primer CSV o al conectar el sistema de nómina. Las altas a mano no son una fuente.</Typography>
        </Stack>
          : <Box sx={{ overflowX: 'auto' }}><Box component="table" sx={tableSx}>
            <thead><tr><th scope="col">Fuente</th><th scope="col">Tipo</th><th scope="col">Estado</th><th scope="col">Último punto</th><th scope="col">Versión</th><th scope="col">Actualizada</th></tr></thead>
            <tbody>
              {checkpoints.isPending ? <SkeletonRows columns={6} rows={2} /> : rows.map(row => <tr key={row.sourceId}>
                <td><strong>{kinds[row.type] || row.type}</strong></td>
                <td>{types[row.type] || row.type}</td>
                <td><Badge tone={states[row.status]?.tone || 'neutral'}>{states[row.status]?.label || row.status}</Badge></td>
                <Box component="td" sx={{ color: color.muted }}>{row.cursor || '—'}</Box>
                <Box component="td" sx={{ color: color.muted }}>{row.sourceVersion || '—'}</Box>
                <td>{whenText(row.updatedAt, timeZone, today)}</td>
              </tr>)}
            </tbody>
          </Box></Box>}
    </Pane>
    {readsLog && <Pane titleId="fuentes-cambios" title="Cambios recientes del padrón">
      {changes.isPending ? <Typography role="status" sx={{ p: 2, fontSize: 13, color: color.muted }}>Cargando cambios…</Typography>
        : changes.isError ? <Box sx={{ p: 2 }}><Note tone="error">No pudimos cargar los cambios.</Note></Box>
          : !changes.data.items.length ? <Typography sx={{ p: 2, fontSize: 13, color: color.muted }}>Todavía no hay cambios en el padrón.</Typography>
            : <Box component="table" sx={tableSx}>
              <thead><tr><th scope="col">Cuándo</th><th scope="col">Cambio</th><th scope="col">Quién</th></tr></thead>
              <tbody>{changes.data.items.map(entry => {
                const { who, what } = activityText(entry)
                return <tr key={entry.id}><td>{whenText(entry.at, timeZone, today)}</td><td>{what.charAt(0).toUpperCase() + what.slice(1)}</td><Box component="td" sx={{ color: color.muted }}>{who}</Box></tr>
              })}</tbody>
            </Box>}
    </Pane>}
  </>
}

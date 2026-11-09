import { useId, useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Box, ButtonBase, Popover, Stack, Typography } from '@mui/material'
import { api, type Me, type Page } from './api'
import { type AttendanceSummary, todayIn } from './attendanceModel'
import type { ClosureSummary } from './closureModel'
import { color, font, shadow } from './design'
import { Icon } from './Icons'
import type { Incident } from './incidentModel'
import { type Notice, bellNotices, unseen } from './panelModel'
import { IconTile, visuallyHidden } from './ui'

/**
 * Lo que leen el Panel y la campana: los totales de hoy, los cierres de la
 * semana anterior y las incidencias abiertas más graves. Las dos piezas usan
 * las mismas claves, así que el portal pide cada ruta una vez.
 */
export function usePanelData(me: Me, enabled: boolean) {
  const timeZone = me.tenant?.timeZone || 'America/Mexico_City'
  const today = todayIn(timeZone)
  const summary = useQuery({ queryKey: ['attendance-summary', today, ''], enabled, retry: false, staleTime: 60_000,
    queryFn: () => api<AttendanceSummary>(`/attendance/summary?${new URLSearchParams({ date: today })}`) })
  const previous = summary.data?.previousWeek?.weekStart
  const scope = new URLSearchParams({ week: previous || '' }).toString()
  const closures = useQuery({ queryKey: ['closure-summary', scope], enabled: enabled && !!previous, retry: false, staleTime: 60_000,
    queryFn: () => api<ClosureSummary>(`/week-closures/summary?${scope}`) })
  const incidents = useQuery({ queryKey: ['incidents', 'panel'], enabled, retry: false, staleTime: 60_000,
    queryFn: () => api<Page<Incident>>('/incidents?status=open&sort=severity&limit=5') })
  return { timeZone, today, summary, closures, incidents }
}

const seenKey = 'zenit.avisos.vistos'
function readSeen(): string[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(seenKey) || '[]')
    return Array.isArray(saved) ? saved.filter((item): item is string => typeof item === 'string') : []
  } catch { return [] }
}
function saveSeen(keys: string[]) { try { window.localStorage.setItem(seenKey, JSON.stringify(keys)) } catch { /* sin almacenamiento: sólo dura la visita */ } }

/** Los avisos de la campana para quien entra, con el cambio de comida de `/me`. */
export function useNotices(me: Me, enabled: boolean): Notice[] {
  const { timeZone, today, summary, closures, incidents } = usePanelData(me, enabled)
  if (!enabled) return me.tenant?.upcomingBreakPolicy ? bellNotices({ upcoming: me.tenant.upcomingBreakPolicy, timeZone, today }) : []
  return bellNotices({ upcoming: me.tenant?.upcomingBreakPolicy, incidents: incidents.data?.items, summary: summary.data, closures: closures.data, timeZone, today })
}

/**
 * CTA-03. La campana cuenta los avisos que la persona todavía no ve; «Marcar
 * como vistos» lo recuerda en este navegador, porque los avisos no se guardan
 * en el servidor. Un aviso cuya cifra cambia vuelve a contar.
 */
export function NoticesButton({ notices }: { notices: Notice[] }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [seen, setSeen] = useState(readSeen)
  const id = useId()
  const pending = unseen(notices, seen)
  const close = () => setAnchor(null)
  const markSeen = () => { const keys = notices.map(notice => notice.key); saveSeen(keys); setSeen(keys) }
  const label = pending.length ? `Avisos, ${pending.length} sin ver` : 'Avisos'
  return <>
    <ButtonBase aria-label={label} aria-haspopup="dialog" aria-controls={anchor ? id : undefined} aria-expanded={anchor ? true : undefined} onClick={event => setAnchor(event.currentTarget)}
      sx={{ position: 'relative', width: 40, height: 40, flex: 'none', borderRadius: '50%', color: color.white, '&:hover': { background: 'rgba(255,255,255,0.14)' }, '&.Mui-focusVisible': { boxShadow: `0 0 0 2px ${color.white}` } }}>
      <Icon name="bell" size={22} />
      {pending.length > 0 && <Box component="span" aria-hidden="true" sx={{ position: 'absolute', top: 3, right: 2, minWidth: 18, height: 18, px: '5px', borderRadius: 999, background: color.countBg, color: color.countInk,
        fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 2px ${color.deep}` }}>{pending.length}</Box>}
    </ButtonBase>
    <Popover open={!!anchor} anchorEl={anchor} onClose={close} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { id, role: 'dialog', 'aria-labelledby': `${id}-title`, sx: { width: 360, maxWidth: 'calc(100vw - 24px)', mt: 1, borderRadius: '18px', boxShadow: shadow.menu, fontFamily: font } } }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, p: '14px 16px 10px' }}>
        <Typography component="h2" id={`${id}-title`} sx={{ fontSize: 15, fontWeight: 700 }}>Avisos</Typography>
        {notices.length > 0 && <ButtonBase onClick={markSeen} disabled={!pending.length} sx={{ minHeight: 36, px: 1, borderRadius: '8px', color: color.link, fontFamily: font, fontSize: 13, fontWeight: 600,
          '&.Mui-disabled': { color: color.subtle }, '&:hover': { background: color.hover }, '&.Mui-focusVisible': { outline: `2px solid ${color.accent}` } }}>Marcar como vistos</ButtonBase>}
      </Stack>
      {notices.length === 0
        ? <Typography sx={{ p: '4px 16px 16px', fontSize: 13, color: color.muted }}>Nada pendiente por ahora.</Typography>
        : <Box component="ul" sx={{ listStyle: 'none', m: 0, p: '0 8px', maxHeight: 420, overflow: 'auto' }}>
          {notices.map(notice => {
            const fresh = !seen.includes(notice.key)
            return <li key={notice.key}>
              <Box component={Link} to={notice.to} onClick={close} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', p: '10px 8px', borderRadius: '12px', textDecoration: 'none', color: `${color.ink} !important`, '&:hover': { background: color.hover } }}>
                <IconTile icon={notice.icon} tone={notice.tone} size={36} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box component="strong" sx={{ display: 'block', fontSize: 13.5 }}>{notice.title}{fresh && <Box component="span" sx={visuallyHidden}>, sin ver</Box>}</Box>
                  <Box component="span" sx={{ display: 'block', fontSize: 13, color: color.muted }}>{notice.text}</Box>
                  {notice.when && <Box component="span" sx={{ display: 'block', fontSize: 12, color: color.subtle, mt: '2px' }}>{notice.when}</Box>}
                </Box>
                {fresh && <Box aria-hidden="true" sx={{ width: 8, height: 8, mt: '6px', flex: 'none', borderRadius: '50%', background: color.accent }} />}
              </Box>
            </li>
          })}
        </Box>}
      <Typography sx={{ p: '10px 16px 14px', fontSize: 12, color: color.subtle, borderTop: `1px solid ${color.lineSoft}`, mt: 1 }}>
        Los avisos salen de incidencias, cierres y lectores que ya existen; se actualizan al abrir el portal.
      </Typography>
    </Popover>
  </>
}

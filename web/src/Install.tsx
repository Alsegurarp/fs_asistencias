import { useId, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Box, Button, ButtonBase, Drawer, Stack, Typography } from '@mui/material'
import { color, gradient, shadow } from './design'
import { Icon, ZenitMark } from './Icons'
import { dismissInstall, installDismissed, useDataTime, useInstall, useOnline } from './offline'

/** Hora local de los datos más recientes, como «10:42». */
function clock(time: number | null) {
  return time ? new Date(time).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }) : null
}

/** «En línea · datos de las 10:42», al pie del menú lateral. */
export function ConnectionStatus() {
  const online = useOnline()
  const time = clock(useDataTime())
  return <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 12, color: color.muted, px: 1 }}>
    <Box component="span" aria-hidden="true" sx={{ width: 8, height: 8, flex: 'none', borderRadius: '50%', background: online ? color.okMark : color.warnInk }} />
    {online ? 'En línea' : 'Sin conexión'}{time ? ` · datos de las ${time}` : ''}
  </Box>
}

/** «Instalar Zenit»: sólo aparece cuando el navegador ofrece instalarlo. */
export function InstallButton() {
  const { available, install } = useInstall()
  if (!available) return null
  return <ButtonBase onClick={() => void install()} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 1.25, minHeight: 44, px: 1.5, borderRadius: '12px', color: color.link, fontSize: 14, fontWeight: 600,
    '&:hover': { background: color.hover }, '&.Mui-focusVisible': { outline: `2px solid ${color.accent}` } }}>
    <Icon name="download" size={18} />Instalar Zenit
  </ButtonBase>
}

/** EST-06: sin red se ve lo último que se cargó; lo que escribe espera a que vuelva. */
export function OfflineNotice() {
  const online = useOnline()
  const cache = useQueryClient()
  const time = clock(useDataTime())
  if (online) return null
  return <Box role="status" sx={{ flex: 'none', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 12px', p: '10px 12px 10px 14px', borderRadius: '14px', background: color.warnBg, color: color.noteInk, fontSize: 13.5, lineHeight: 1.45 }}>
    <Box component="span" sx={{ flex: '1 1 260px' }}><strong>Sin conexión.</strong> {time ? `Ves lo que se cargó a las ${time}.` : 'Ves lo último que se cargó.'} Resolver, cerrar o exportar vuelve a estar disponible cuando haya red.</Box>
    <Button variant="outlined" size="small" onClick={() => void cache.refetchQueries({ type: 'active' })} sx={{ minHeight: 36, borderRadius: 999, background: color.white }}>Reintentar</Button>
  </Box>
}

/** En el teléfono, la píldora «Sin conexión» de la barra superior. */
export function OfflinePill() {
  const online = useOnline()
  if (online) return null
  return <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, minHeight: 32, px: 1.5, borderRadius: 999, background: color.white, color: color.warnInk, fontSize: 12, fontWeight: 700 }}>
    <Icon name="offline" size={14} strokeWidth={2.2} />Sin conexión
  </Box>
}

const benefits = [
  { icon: 'panel' as const, text: 'Se abre desde tu pantalla de inicio' },
  { icon: 'offline' as const, text: 'Consultas lo último que viste aunque no haya señal' },
  { icon: 'sync' as const, text: 'Se actualiza sola; no pasa por la tienda' },
]

/** TEL-03: en el teléfono, la invitación a instalar; «Ahora no» no vuelve a insistir. */
export function InstallSheet() {
  const { available, install } = useInstall()
  const [closed, setClosed] = useState(installDismissed)
  const titleId = useId()
  const close = () => { dismissInstall(); setClosed(true) }
  return <Drawer anchor="bottom" open={available && !closed} onClose={close}
    slotProps={{ paper: { role: 'dialog', 'aria-modal': true, 'aria-labelledby': titleId, sx: { borderRadius: '28px 28px 0 0', p: '12px 22px 26px', boxShadow: shadow.menu } } }}>
    <Stack spacing={1.75}>
      <Box aria-hidden="true" sx={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 999, background: color.fieldSoft }} />
      <Stack direction="row" spacing={1.75} sx={{ alignItems: 'center' }}>
        <Box aria-hidden="true" sx={{ width: 64, height: 64, flex: 'none', borderRadius: '18px', background: gradient.badge, boxShadow: '0 10px 20px rgba(29,74,159,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ZenitMark size={40} /></Box>
        <Box>
          <Typography id={titleId} component="h2" sx={{ fontSize: 20, fontWeight: 700 }}>Instala Zenit</Typography>
          <Typography sx={{ fontSize: 14, color: color.muted }}>El portal de tu empresa, como app</Typography>
        </Box>
      </Stack>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1.25, fontSize: 14 }}>
        {benefits.map(item => <Box component="li" key={item.text} sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Box aria-hidden="true" sx={{ width: 36, height: 36, flex: 'none', borderRadius: '12px', background: gradient.tile, color: color.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={item.icon} size={18} /></Box>{item.text}
        </Box>)}
      </Box>
      <Button variant="contained" onClick={() => void install().then(close)} sx={{ minHeight: 56, fontSize: 17 }}>Instalar</Button>
      <Button onClick={close} sx={{ alignSelf: 'center', minHeight: 44, fontSize: 15 }}>Ahora no</Button>
    </Stack>
  </Drawer>
}

/** Mi perfil: «Zenit en este equipo». */
export function InstallRow() {
  const { available, installed, install } = useInstall()
  return <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, p: '12px 14px', border: `1px solid ${color.line}`, borderRadius: '14px' }}>
    <Box aria-hidden="true" sx={{ width: 36, height: 36, flex: 'none', borderRadius: '12px', background: gradient.tile, color: color.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="download" size={18} /></Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Box sx={{ fontSize: 14, fontWeight: 600 }}>Zenit en este equipo</Box>
      <Box sx={{ fontSize: 12.5, color: color.muted }}>{installed ? 'Ya está instalado; ábrelo desde tu pantalla de inicio' : available ? 'Ábrelo como app, sin buscar la página' : 'Instálalo desde el menú del navegador: «Instalar» o «Agregar a la pantalla de inicio»'}</Box>
    </Box>
    {available && <Button variant="outlined" size="small" onClick={() => void install()} sx={{ minHeight: 36, borderRadius: 999 }}>Instalar</Button>}
  </Stack>
}

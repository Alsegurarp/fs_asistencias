import { useEffect } from 'react'
import { Link } from 'react-router'
import { Box, ButtonBase, Stack, Typography } from '@mui/material'
import type { Me } from './api'
import { color, gradient, shadow } from './design'
import { Icon, type IconName } from './Icons'
import { initials, rolesText } from './Shell'
import { type Group, type Section, personalScreen } from './sections'

const card = { background: color.white, borderRadius: '18px', boxShadow: shadow.card, overflow: 'hidden' } as const
const row = { display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 52, p: '6px 12px', textDecoration: 'none', color: `${color.ink} !important`, width: '100%', textAlign: 'left', fontFamily: 'inherit',
  '&:hover': { background: color.rowHover } } as const

function Tile({ icon }: { icon: IconName }) {
  return <Box aria-hidden="true" sx={{ width: 36, height: 36, flex: 'none', borderRadius: '12px', background: gradient.tile, color: color.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={18} /></Box>
}

/** TEL-06: el resto de las secciones en teléfono, agrupadas como en el menú lateral. */
export function More({ me, groups, firstPath, context, personal, onSignOut }: {
  me: Me; groups: Group[]; firstPath: (section: Section) => string; context: string; personal: boolean; onSignOut: () => void
}) {
  useEffect(() => { document.title = 'Más · Zenit' }, [])
  return <Stack spacing={1.5} sx={{ maxWidth: 560, width: '100%', mx: 'auto' }}>
    <Typography component="h1" sx={{ fontSize: 22, fontWeight: 700 }}>Más</Typography>
    <Stack direction="row" spacing={1.5} sx={{ ...card, alignItems: 'center', p: '12px 14px' }}>
      <Box aria-hidden="true" sx={{ width: 46, height: 46, flex: 'none', borderRadius: '50%', background: gradient.badge, color: color.white, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials(me.displayName)}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 700 }} noWrap>{me.displayName}</Typography>
        <Typography sx={{ fontSize: 13, color: color.muted }}>{rolesText(me)} · {context}</Typography>
      </Box>
    </Stack>
    {groups.map(group => <Box key={group.key}>
      <Typography component="h2" sx={{ p: '0 6px 4px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: color.subtle }}>{group.label}</Typography>
      <Box component="ul" sx={{ ...card, listStyle: 'none', m: 0, p: 0 }}>
        {group.sections.map(section => <li key={section.key}>
          <Box component={Link} to={firstPath(section)} sx={row}>
            <Tile icon={section.icon} /><Box component="span" sx={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{section.label}</Box>
            <Box component="span" sx={{ color: color.muted, display: 'flex' }}><Icon name="chevron" size={16} /></Box>
          </Box>
        </li>)}
      </Box>
    </Box>)}
    <Box component="ul" sx={{ ...card, listStyle: 'none', m: 0, p: 0 }}>
      {personal && <li><Box component={Link} to={personalScreen.path} sx={row}><Tile icon="attendance" /><Box component="span" sx={{ flex: 1, fontSize: 15, fontWeight: 600 }}>Mi asistencia</Box></Box></li>}
      <li><ButtonBase onClick={onSignOut} sx={row}><Tile icon="logout" /><Box component="span" sx={{ flex: 1, fontSize: 15, fontWeight: 600 }}>Cerrar sesión</Box></ButtonBase></li>
    </Box>
  </Stack>
}

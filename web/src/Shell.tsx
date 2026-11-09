import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { Box, ButtonBase, Divider, MenuItem, MenuList, Popover, Stack, ThemeProvider, Typography, createTheme, useMediaQuery } from '@mui/material'
import type { Me } from './api'
import { color, font, gradient, phoneQuery, shadow } from './design'
import { Icon, ZenitMark } from './Icons'
import { type Group, type Screen, type Section, dossierCallbackPath, joinNames, personalScreen, roleLabel } from './sections'

const menuKey = 'zenit.menu.oculto'
function readHidden() { try { return window.localStorage.getItem(menuKey) === '1' } catch { return false } }
function saveHidden(hidden: boolean) { try { window.localStorage.setItem(menuKey, hidden ? '1' : '0') } catch { /* sin almacenamiento: sólo dura la visita */ } }

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] || '?').slice(0, 2)).toUpperCase()
}

export function rolesText(me: Me) { return joinNames(me.roles.map(roleLabel)) }

/** La sección del menú a la que pertenece una dirección. */
export function sectionFor(groups: Group[], pathname: string): Section | undefined {
  const sections = groups.flatMap(group => group.sections)
  if (pathname === dossierCallbackPath) return sections.find(section => section.screens.some(screen => screen.key === 'dossier'))
  return sections.find(section => section.screens.some(screen => screen.path === pathname))
}

type ShellProps = {
  me: Me
  email?: string
  groups: Group[]
  /** Pantallas visibles de cada sección, para enlazar a la primera. */
  firstPath: (section: Section) => string
  context: string
  onSignOut: () => void
  notice?: ReactNode
}

/**
 * Marco del lienzo: barra superior azul, menú lateral ocultable con secciones
 * plegables y contenido con desplazamiento propio. En teléfono el menú pasa a
 * la barra inferior (TEL-06) y la página se desplaza completa.
 */
export function Shell({ me, email, groups, firstPath, context, onSignOut, notice }: ShellProps) {
  const phone = useMediaQuery(phoneQuery)
  const [hidden, setHidden] = useState(readHidden)
  const { pathname } = useLocation()
  const active = sectionFor(groups, pathname)
  const hasMenu = groups.length > 0
  const sideId = useId()
  const toggle = () => { setHidden(value => { saveHidden(!value); return !value }) }

  return <Box sx={{ height: '100dvh', minHeight: 560, display: 'flex', flexDirection: 'column', fontFamily: font, color: color.ink, background: gradient.page,
    [`@media ${phoneQuery}`]: { height: 'auto', minHeight: '100dvh' } }}>
    <Box component="a" href="#contenido" sx={{ position: 'absolute', left: 16, top: -80, zIndex: 1500, p: '10px 16px', borderRadius: '12px', background: color.white, color: color.link, fontWeight: 600, textDecoration: 'none', '&:focus': { top: 8 } }}>Ir al contenido</Box>
    <Box component="header" sx={{ flex: 'none', minHeight: 60, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, p: '10px 16px 10px 20px', color: color.white, background: gradient.top,
      [`@media ${phoneQuery}`]: { position: 'sticky', top: 0, zIndex: 10, p: '10px 12px 10px 16px' } }}>
      {hasMenu && !phone && <ButtonBase onClick={toggle} aria-controls={sideId} aria-expanded={!hidden} aria-label={hidden ? 'Mostrar el menú lateral' : 'Ocultar el menú lateral'}
        title="Mostrar u ocultar el menú lateral" sx={{ width: 40, height: 40, flex: 'none', borderRadius: '10px', color: color.white, background: hidden ? 'rgba(255,255,255,0.18)' : 'transparent', '&:hover': { background: 'rgba(255,255,255,0.14)' }, '&.Mui-focusVisible': { boxShadow: `0 0 0 2px ${color.white}` } }}>
        <Icon name="menu" size={22} strokeWidth={2} />
      </ButtonBase>}
      <Box component={Link} to="/" aria-label="Zenit, ir al inicio" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: `${color.white} !important`, textDecoration: 'none', minHeight: 40 }}>
        <ZenitMark size={30} /><Typography component="span" sx={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>Zenit</Typography>
      </Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minHeight: 40, pl: 1.75, borderLeft: '1px solid rgba(255,255,255,0.3)', fontSize: 14, fontWeight: 600, [`@media ${phoneQuery}`]: { display: 'none' } }}>
        <Icon name="building" size={18} /><span>{context}</span>
      </Stack>
      <Box sx={{ flex: 1 }} />
      <AccountMenu me={me} email={email} context={context} onSignOut={onSignOut} />
    </Box>
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', [`@media ${phoneQuery}`]: { display: 'block' } }}>
      {hasMenu && !phone && !hidden && <Box component="aside" id={sideId} sx={{ flex: '0 0 232px', height: '100%', overflow: 'auto', background: color.white, borderRight: `1px solid ${color.line}`, p: '14px 10px' }}>
        <SideNav groups={groups} active={active} firstPath={firstPath} label={me.tenant ? 'Secciones del portal' : 'Secciones de la consola'} />
      </Box>}
      <Box component="main" id="contenido" tabIndex={-1} sx={{ flex: 1, minWidth: 0, height: '100%', overflow: 'auto', p: '18px 24px', display: 'flex', flexDirection: 'column', gap: 1.25, outline: 'none',
        [`@media ${phoneQuery}`]: { height: 'auto', overflow: 'visible', p: '16px 16px 96px' } }}>
        {notice}
        <Outlet />
      </Box>
    </Box>
    {hasMenu && phone && <BottomNav groups={groups} active={active} firstPath={firstPath} pathname={pathname} />}
  </Box>
}

const navLinkSx = {
  display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 44, p: '8px 12px', borderRadius: '12px', color: color.inkSoft, textDecoration: 'none', fontSize: 14, fontWeight: 500,
  '& svg': { color: color.accent, flex: 'none' },
  '&:hover': { background: color.hover, color: color.ink },
  '&[aria-current="page"]': { background: gradient.tile, color: color.deep, fontWeight: 600 },
} as const

function SideNav({ groups, active, firstPath, label }: { groups: Group[]; active?: Section; firstPath: (section: Section) => string; label: string }) {
  return <Box component="nav" aria-label={label} sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
    {groups.map(group => <Box component="details" key={group.key} open sx={{ m: '0 0 6px',
      '& > summary': { listStyle: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 36, p: '6px 12px', borderRadius: '10px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: color.subtle, cursor: 'pointer',
        '&::-webkit-details-marker': { display: 'none' },
        '&::after': { content: '""', width: 7, height: 7, mr: 0.5, borderRight: `2px solid ${color.subtle}`, borderBottom: `2px solid ${color.subtle}`, transform: 'rotate(45deg)', transition: 'transform .2s' },
        '&:hover': { background: color.hover, color: color.ink } },
      '&:not([open]) > summary::after': { transform: 'rotate(-45deg)' },
      '& > a': { mt: '2px' } }}>
      <summary>{group.label}</summary>
      {group.sections.map(section => <Box component={Link} key={section.key} to={firstPath(section)} aria-current={active?.key === section.key ? 'page' : undefined} sx={navLinkSx}>
        <Icon name={section.icon} />{section.label}
      </Box>)}
    </Box>)}
  </Box>
}

function BottomNav({ groups, active, firstPath, pathname }: { groups: Group[]; active?: Section; firstPath: (section: Section) => string; pathname: string }) {
  const sections = groups.flatMap(group => group.sections)
  const shown = sections.length <= 4 ? sections : sections.slice(0, 3)
  const more = sections.length > 4
  const item = { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5, minHeight: 56, borderRadius: '16px', textDecoration: 'none', fontSize: 12, fontWeight: 500, color: `${color.inkSoft} !important`,
    '& svg': { color: color.accent },
    '&[aria-current="page"]': { background: gradient.tile, color: `${color.deep} !important`, fontWeight: 600, '& svg': { color: color.deep } } } as const
  return <Box component="nav" aria-label="Secciones" sx={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20, display: 'grid', gridTemplateColumns: `repeat(${shown.length + (more ? 1 : 0)}, minmax(0, 1fr))`, gap: 0.5, p: '8px 10px 18px', background: color.white, borderRadius: '24px 24px 0 0', boxShadow: shadow.bottomNav }}>
    {shown.map(section => <Box component={Link} key={section.key} to={firstPath(section)} aria-current={active?.key === section.key ? 'page' : undefined} sx={item}>
      <Icon name={section.icon} size={22} />{section.short}
    </Box>)}
    {more && <Box component={Link} to="/mas" aria-current={pathname === '/mas' || (!!active && !shown.includes(active)) ? 'page' : undefined} sx={item}>
      <Icon name="more" size={22} />Más
    </Box>}
  </Box>
}

/** CTA-02. Perfil, seguridad, instalar y ayuda llegan con sus pantallas. */
function AccountMenu({ me, email, context, onSignOut }: { me: Me; email?: string; context: string; onSignOut: () => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const navigate = useNavigate()
  const menuId = useId()
  const close = () => setAnchor(null)
  const personal = me.roles.includes('trabajador') && !!me.tenant
  const itemSx = { gap: 1.5, minHeight: 44, color: color.ink, fontSize: 14, fontWeight: 600, '& svg': { color: color.accent } }
  return <>
    <ButtonBase aria-label={`Cuenta de ${me.displayName}, ${rolesText(me)}`} aria-haspopup="menu" aria-controls={anchor ? menuId : undefined} aria-expanded={anchor ? true : undefined}
      onClick={event => setAnchor(event.currentTarget)}
      sx={{ width: 40, height: 40, flex: 'none', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.6)', background: color.white, color: color.deep, fontSize: 13, fontWeight: 700, fontFamily: font, '&.Mui-focusVisible': { boxShadow: `0 0 0 2px ${color.white}` } }}>
      {initials(me.displayName)}
    </ButtonBase>
    <Popover open={!!anchor} anchorEl={anchor} onClose={close} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { sx: { width: 300, mt: 1, borderRadius: '18px', boxShadow: shadow.menu } } }}>
      <Stack direction="row" spacing={1.5} sx={{ p: '14px 16px 12px', alignItems: 'center' }}>
        <Box aria-hidden="true" sx={{ width: 44, height: 44, flex: 'none', borderRadius: '50%', background: gradient.badge, color: color.white, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials(me.displayName)}</Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }} noWrap>{me.displayName}</Typography>
          {email && <Typography sx={{ fontSize: 13, color: color.muted }} noWrap>{email}</Typography>}
          <Typography sx={{ fontSize: 12, color: color.subtle }}>{rolesText(me)} · {context}</Typography>
        </Box>
      </Stack>
      <Divider />
      <MenuList id={menuId} aria-label="Cuenta" autoFocusItem={!!anchor} sx={{ py: 1 }}>
        {personal && <MenuItem onClick={() => { close(); void navigate(personalScreen.path) }} sx={itemSx}><Icon name="attendance" />Mi asistencia</MenuItem>}
        <MenuItem onClick={() => { close(); onSignOut() }} sx={itemSx}><Icon name="logout" />Cerrar sesión</MenuItem>
      </MenuList>
    </Popover>
  </>
}

/** Encabezado de página del lienzo: ruta, título, descripción y pestañas. `description` reemplaza la de la sección. */
export function PageHeader({ context, section, screens, current, actions, description = section.description }: { context: string; section: Section; screens: Screen[]; current: Screen; actions?: ReactNode; description?: string }) {
  const heading = useRef<HTMLHeadingElement>(null)
  const location = useLocation()
  const shown = useRef(location.pathname)
  useEffect(() => { document.title = `${section.label} · Zenit` }, [section.label])
  // Al llegar a otra pantalla, el lector de pantalla empieza por el título nuevo.
  // Un cambio sólo de filtros o de ficha (`?…`) no mueve el foco.
  useEffect(() => {
    if (location.key !== 'default' && shown.current !== location.pathname) heading.current?.focus()
    shown.current = location.pathname
  }, [location.key, location.pathname])
  return <>
    <Stack direction="row" useFlexGap sx={{ flex: 'none', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 1.5 }}>
      <Box>
        <Typography sx={{ fontSize: 13, color: color.subtle }}>{context} / {section.label}</Typography>
        <Typography component="h1" ref={heading} tabIndex={-1} sx={{ mt: '2px', fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', outline: 'none' }}>
          {section.label}{description && <Box component="span" sx={{ fontSize: 15, fontWeight: 500, color: color.muted }}> · {description}</Box>}
        </Typography>
      </Box>
      {actions && <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: 'wrap' }}>{actions}</Stack>}
    </Stack>
    {screens.length > 1 && <Box component="nav" aria-label={section.label} sx={{ flex: 'none', display: 'flex', flexWrap: 'wrap', gap: 0.5, borderBottom: `1px solid ${color.tabLine}` }}>
      {screens.map(screen => <Box component={Link} key={screen.key} to={screen.path} aria-current={screen.key === current.key ? 'page' : undefined}
        sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, px: 1.75, borderBottom: '2px solid transparent', color: `${color.muted} !important`, fontSize: 14, fontWeight: 600, textDecoration: 'none',
          '&[aria-current="page"]': { borderBottomColor: color.accent, color: `${color.deep} !important` }, '&:hover': { color: `${color.ink} !important` } }}>
        {screen.tab}
      </Box>)}
    </Box>}
  </>
}

/**
 * Pantalla anterior del portal dentro del marco nuevo, en un panel blanco. Sus
 * títulos h5 y h6 bajan a h2 y h3 para que el único h1 sea el de la página.
 * Se retira al reconstruir cada sección con el lienzo.
 */
export function LegacyScreen({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={outer => createTheme(outer, {
    typography: { h5: { fontSize: 18, fontWeight: 700 }, h6: { fontSize: 16, fontWeight: 600 } },
    components: { MuiTypography: { defaultProps: { variantMapping: { h5: 'h2', h6: 'h3' } } } },
  })}>
    <Box sx={{ background: color.white, borderRadius: '20px', boxShadow: shadow.table, p: { xs: 2, md: 2.5 } }}>{children}</Box>
  </ThemeProvider>
}

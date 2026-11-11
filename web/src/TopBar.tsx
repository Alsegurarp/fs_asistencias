import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Box, ButtonBase, MenuItem, MenuList, Popover, Stack, Typography, useMediaQuery } from '@mui/material'
import { api, type Card, type Device, type Employee, type Me, type Page, permissions } from './api'
import { color, font, phoneQuery, shadow } from './design'
import { ActivatePanel, RegisterCardModal } from './DeviceForms'
import { cardHolder, cardStatus, deviceName, sinceText } from './devicesModel'
import { Icon } from './Icons'
import { NewPersonModal, ScheduleModal } from './PersonnelForms'
import { visuallyHidden } from './ui'

/** Una tecla suelta es un atajo sólo si no se está escribiendo ni hay una ventana abierta. */
function shortcut(event: globalThis.KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (event.ctrlKey || event.metaKey || event.altKey) return false
  if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return false
  return !document.querySelector('[role="dialog"], [role="menu"], [role="presentation"]')
}

type Result = { key: string; group: string; title: string; detail: string; to: string }

/**
 * CTA-05: busca en personas, tarjetas y lectores desde la barra superior.
 * Cada grupo es una consulta al servidor con pocos resultados; sólo se busca
 * en lo que el rol puede ver. Enter abre el primero, las flechas recorren la
 * lista, Esc cierra y la tecla «/» enfoca la búsqueda.
 */
export function GlobalSearch({ me }: { me: Me }) {
  const allowed = permissions(me.roles)
  const navigate = useNavigate()
  const phone = useMediaQuery(phoneQuery)
  const timeZone = me.tenant!.timeZone
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  // Al salir del campo la lista se cierra después de un clic en ella; volver a entrar cancela ese cierre.
  const blurTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => { const timer = setTimeout(() => setSearch(text.trim()), 250); return () => clearTimeout(timer) }, [text])
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === '/' && shortcut(event)) { event.preventDefault(); setOpen(true); setTimeout(() => input.current?.focus(), 0) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => { setActive(0) }, [search])

  const enabled = search.length > 1
  const q = (extra: Record<string, string> = {}) => new URLSearchParams({ q: search, limit: '3', ...extra })
  const people = useQuery({ queryKey: ['employees', 'buscador', search], enabled: enabled && allowed.employees, retry: false, staleTime: 15_000,
    queryFn: () => api<Page<Employee>>(`/employees?${q({ status: 'active' })}`) })
  const cards = useQuery({ queryKey: ['cards', 'buscador', search], enabled: enabled && allowed.cards, retry: false, staleTime: 15_000,
    queryFn: () => api<Page<Card>>(`/cards?${q()}`) })
  const devices = useQuery({ queryKey: ['devices', 'buscador', search], enabled: enabled && allowed.devices, retry: false, staleTime: 15_000,
    queryFn: () => api<Page<Device>>(`/devices?${q({ status: 'active' })}`) })

  const now = new Date()
  const results: Result[] = [
    ...(people.data?.items || []).map(person => ({ key: `p-${person.id}`, group: 'Personas', title: person.displayName,
      detail: [person.externalId, person.activeCardLabel ? `tarjeta ${person.activeCardLabel}` : 'sin tarjeta'].join(' · '), to: `/personal?persona=${person.id}` })),
    ...(cards.data?.items || []).map(card => {
      const holder = cardHolder(card)
      return { key: `t-${card.id}`, group: 'Tarjetas', title: card.label,
        detail: `${cardStatus(card.status).label}${holder && !holder.past ? ` · asignada a ${holder.text}` : ''}`, to: `/dispositivos/tarjetas?tarjeta=${card.id}` }
    }),
    ...(devices.data?.items || []).map(device => ({ key: `l-${device.id}`, group: 'Lectores', title: deviceName(device),
      detail: `${device.mode === 'terminal' ? 'Terminal de sede' : 'Teléfono personal'} · señal ${sinceText(device.lastSeenAt, now)}`, to: `/dispositivos?${new URLSearchParams({ q: deviceName(device) })}` })),
  ]
  const groups = ['Personas', 'Tarjetas', 'Lectores'].map(group => ({ group, items: results.filter(item => item.group === group) })).filter(item => item.items.length)
  const loading = enabled && [people, cards, devices].some(query => query.fetchStatus === 'fetching')
  const close = () => { setOpen(false); setText(''); setSearch('') }
  const go = (result: Result | undefined) => { if (!result) return; close(); input.current?.blur(); void navigate(result.to) }
  const keys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); close(); input.current?.blur() }
    else if (event.key === 'Enter') { event.preventDefault(); go(results[active]) }
    else if (event.key === 'ArrowDown' && results.length) { event.preventDefault(); setActive(index => (index + 1) % results.length) }
    else if (event.key === 'ArrowUp' && results.length) { event.preventDefault(); setActive(index => (index - 1 + results.length) % results.length) }
  }
  const showList = open && enabled
  const where = [allowed.employees && 'personas', allowed.cards && 'tarjetas', allowed.devices && 'lectores'].filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' y $1')

  if (!allowed.employees && !allowed.cards && !allowed.devices) return null
  return <Box sx={{ position: 'relative', flex: '0 1 380px', minWidth: 0, [`@media ${phoneQuery}`]: { order: 10, flex: '1 1 100%' } }}>
    <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 40, px: 1.5, borderRadius: '12px', background: 'rgba(255,255,255,0.16)', color: color.white,
      '&:focus-within': { background: color.white, color: color.muted, boxShadow: `0 0 0 2px ${color.white}` } }}>
      <Icon name="search" size={18} />
      <Box component="input" ref={input} type="search" role="combobox" aria-label={`Buscar ${where}`} aria-expanded={showList} aria-controls={listId}
        aria-activedescendant={showList && results[active] ? `${listId}-${results[active].key}` : undefined} aria-autocomplete="list" autoComplete="off"
        placeholder={phone ? 'Buscar' : `Buscar ${where}`} value={text} maxLength={100}
        onChange={event => { setText(event.target.value); setOpen(true) }} onFocus={() => { clearTimeout(blurTimer.current); setOpen(true) }} onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150) }} onKeyDown={keys}
        sx={{ flex: 1, minWidth: 0, border: 0, outline: 'none !important', background: 'transparent', color: 'inherit', fontFamily: font, fontSize: 14, minHeight: 36,
          '&::placeholder': { color: 'inherit', opacity: 0.85 }, 'label:focus-within &': { color: color.ink } }} />
      {!phone && <Box component="kbd" aria-hidden="true" sx={{ px: 0.75, borderRadius: '6px', border: '1px solid currentColor', fontFamily: font, fontSize: 12, opacity: 0.8 }}>/</Box>}
    </Box>
    {showList && <Box id={listId} role="listbox" aria-label="Resultados de la búsqueda" onMouseDown={event => event.preventDefault()}
      sx={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, minWidth: 320, zIndex: 1400, background: color.white, color: color.ink, borderRadius: '16px', boxShadow: shadow.menu, overflow: 'hidden',
        [`@media ${phoneQuery}`]: { minWidth: 0 } }}>
      {groups.map(({ group, items }) => <Box key={group} role="group" aria-label={group} sx={{ py: 0.75, borderBottom: `1px solid ${color.lineSoft}` }}>
        <Typography aria-hidden="true" sx={{ px: 2, py: 0.5, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: color.subtle }}>{group} · {items.length}</Typography>
        {items.map(item => {
          const index = results.indexOf(item)
          return <Box key={item.key} id={`${listId}-${item.key}`} role="option" aria-selected={index === active} onClick={() => go(item)} onMouseEnter={() => setActive(index)}
            sx={{ display: 'flex', flexDirection: 'column', px: 2, py: 0.75, cursor: 'pointer', '&[aria-selected="true"]': { background: color.selected } }}>
            <Box component="span" sx={{ fontSize: 14, fontWeight: 600 }}>{item.title}</Box>
            <Box component="span" sx={{ fontSize: 12.5, color: color.muted }}>{item.detail}</Box>
          </Box>
        })}
      </Box>)}
      {!groups.length && <Typography role="status" sx={{ px: 2, py: 1.5, fontSize: 13.5, color: color.muted }}>{loading ? 'Buscando…' : `Nada coincide con «${search}».`}</Typography>}
      <Typography sx={{ px: 2, py: 1, fontSize: 12, color: color.subtle, background: color.page }}>Busca en {where} · Enter abre el primero · Esc cierra</Typography>
    </Box>}
    {showList && <Typography role="status" sx={visuallyHidden}>{loading ? 'Buscando…' : `${results.length} ${results.length === 1 ? 'resultado' : 'resultados'}`}</Typography>}
  </Box>
}

export type CreateKind = 'persona' | 'horario' | 'lector' | 'tarjeta'
type Option = { kind: CreateKind | 'cierre'; key: string; label: string; detail: string }

/** Lo que el menú Crear ofrece a un rol: sólo lo que puede hacer. */
export function createOptions(me: Me): Option[] {
  const allowed = permissions(me.roles)
  const options: (Option | false)[] = [
    allowed.editDirectory && { kind: 'persona', key: 'P', label: 'Dar de alta a una persona', detail: 'Personal y horarios' },
    allowed.editDirectory && { kind: 'horario', key: 'H', label: 'Crear un horario', detail: 'Turnos con su vigencia' },
    allowed.manageDevices && { kind: 'lector', key: 'L', label: 'Activar un lector', detail: 'Código de un solo uso' },
    allowed.editDirectory && { kind: 'tarjeta', key: 'T', label: 'Registrar una tarjeta', detail: 'Inventario de tarjetas' },
    allowed.closeWeeks && { kind: 'cierre', key: 'S', label: 'Cerrar la semana', detail: 'Toda la empresa o una sede' },
  ]
  return options.filter((item): item is Option => !!item)
}

/**
 * CTA-04: el menú Crear. Cada opción abre su ventana sobre la página
 * actual; «Cerrar la semana» lleva a Cierres, donde se elige el alcance.
 * La tecla «C» lo abre y la letra de cada opción la elige.
 */
export function CreateMenu({ me }: { me: Me }) {
  const navigate = useNavigate()
  const phone = useMediaQuery(phoneQuery)
  const options = createOptions(me)
  const button = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [opened, setOpened] = useState<CreateKind | null>(null)
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key.toLowerCase() === 'c' && shortcut(event) && button.current) { event.preventDefault(); setAnchor(button.current) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  if (!options.length) return null
  const choose = (option: Option) => {
    setAnchor(null)
    if (option.kind === 'cierre') void navigate('/cierres?cerrar=1')
    else setOpened(option.kind)
  }
  const done = () => { setOpened(null); setTimeout(() => button.current?.focus(), 0) }
  return <>
    <ButtonBase ref={button} aria-haspopup="menu" aria-controls={anchor ? menuId : undefined} aria-expanded={anchor ? true : undefined} onClick={event => setAnchor(event.currentTarget)}
      aria-label={phone ? 'Crear' : undefined} aria-keyshortcuts="C"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, minHeight: 40, px: phone ? 1.25 : 1.75, borderRadius: 999, background: color.white, color: color.deep, fontFamily: font, fontSize: 14, fontWeight: 700,
        '&:hover': { background: color.selected }, '&.Mui-focusVisible': { boxShadow: `0 0 0 2px ${color.white}, 0 0 0 4px ${color.accent}` } }}>
      <Box component="span" aria-hidden="true" sx={{ fontSize: 20, lineHeight: 1, fontWeight: 500 }}>+</Box>{!phone && 'Crear'}
    </ButtonBase>
    <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { sx: { width: 320, mt: 1, borderRadius: '18px', boxShadow: shadow.menu } } }}>
      <Typography sx={{ px: 2, pt: 1.5, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: color.subtle }}>Crear</Typography>
      <MenuList id={menuId} aria-label="Crear" autoFocusItem={!!anchor} sx={{ py: 0.75 }}
        onKeyDown={event => { const option = options.find(item => item.key === event.key.toUpperCase()); if (option) { event.preventDefault(); choose(option) } }}>
        {options.map(option => <MenuItem key={option.kind} onClick={() => choose(option)} aria-keyshortcuts={option.key} sx={{ gap: 1.5, minHeight: 52, py: 0.75 }}>
          <Stack sx={{ flex: 1, minWidth: 0 }}>
            <Box component="span" sx={{ fontSize: 14, fontWeight: 600, color: color.ink }}>{option.label}</Box>
            <Box component="span" sx={{ fontSize: 12.5, color: color.muted }}>{option.detail}</Box>
          </Stack>
          <Box component="kbd" aria-hidden="true" sx={{ minWidth: 24, height: 24, borderRadius: '6px', border: `1px solid ${color.line}`, color: color.muted, fontFamily: font, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{option.key}</Box>
        </MenuItem>)}
      </MenuList>
      <Typography sx={{ px: 2, pb: 1.5, fontSize: 12, color: color.subtle }}>Atajo: tecla C. Sólo aparece lo que tu rol puede hacer; cada opción abre su ventana sobre la página actual.</Typography>
    </Popover>
    <CreateWindow me={me} kind={opened} onClose={done} />
  </>
}

/** La ventana de cada opción, sobre la página actual. Al crear algo, se va a verlo. */
function CreateWindow({ me, kind, onClose }: { me: Me; kind: CreateKind | null; onClose: () => void }): ReactNode {
  const navigate = useNavigate()
  if (kind === 'persona') return <NewPersonModal me={me} onClose={onClose} onCreated={id => { onClose(); void navigate(`/personal?persona=${id}`) }} />
  if (kind === 'horario') return <ScheduleModal me={me} onClose={onClose} />
  if (kind === 'lector') return <ActivatePanel me={me} onClose={onClose} />
  if (kind === 'tarjeta') return <RegisterCardModal onClose={onClose} onRegistered={id => { onClose(); void navigate(`/dispositivos/tarjetas?tarjeta=${id}`) }} />
  return null
}

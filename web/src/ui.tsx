import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from 'react'
import { Link } from 'react-router'
import { Box, ButtonBase, Skeleton, Stack, Typography } from '@mui/material'
import { color, font, gradient, phoneQuery, shadow } from './design'
import { Icon, type IconName } from './Icons'

/**
 * Piezas del lienzo que comparten las secciones: etiquetas, filtros, tabla
 * con paginador y ficha lateral. Una sección nueva las usa en lugar de armar
 * las suyas (docs/construir-el-portal.md).
 */
export type Tone = 'ok' | 'warn' | 'error' | 'info' | 'neutral'

const tones: Record<Tone, { background: string; color: string }> = {
  ok: { background: color.okBg, color: color.ok },
  warn: { background: color.warnBg, color: color.warnText },
  error: { background: color.errorBg, color: color.error },
  info: { background: color.infoBg, color: color.link },
  neutral: { background: color.lineSoft, color: color.muted },
}
/** Color de texto suelto de cada tono, sobre blanco. */
export const toneText: Record<Tone, string> = { ok: color.ok, warn: color.warnText, error: color.error, info: color.link, neutral: color.muted }

/** Etiqueta de estado; con `to` es un enlace. */
export function Badge({ tone, children, to, state }: { tone: Tone; children: ReactNode; to?: string; state?: unknown }) {
  const sx = { display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 600, lineHeight: 1.4, p: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap',
    background: tones[tone].background, color: `${tones[tone].color} !important`, textDecoration: 'none' } as const
  if (to) return <Box component={Link} to={to} state={state} sx={{ ...sx, '&:hover': { textDecoration: 'underline' } }}>{children}</Box>
  return <Box component="span" sx={sx}>{children}</Box>
}

/** Filtro de un toque, como «Con alertas · 4». */
export function FilterChip({ pressed, onClick, children, small }: { pressed: boolean; onClick: () => void; children: ReactNode; small?: boolean }) {
  return <ButtonBase aria-pressed={pressed} onClick={onClick} sx={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 0.75, minHeight: small ? 34 : 36, px: 1.5, borderRadius: 999,
    border: `1px solid ${pressed ? color.fieldHover : color.fieldSoft}`, background: pressed ? gradient.tile : color.white, color: pressed ? color.deep : color.inkSoft,
    fontFamily: font, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', '&:hover': { borderColor: color.fieldHover }, '&.Mui-focusVisible': { outline: `2px solid ${color.accent}`, outlineOffset: 2 } }}>
    {children}
  </ButtonBase>
}

const fieldSx = { display: 'flex', alignItems: 'center', minHeight: 40, background: color.white, border: `1px solid ${color.fieldSoft}`, borderRadius: '10px', fontSize: 13,
  '&:focus-within': { borderColor: color.accent, boxShadow: `0 0 0 1px ${color.accent}` } } as const

export function SearchBox({ name, label, placeholder, value, onChange, grow }: { name: string; label: string; placeholder: string; value: string; onChange: (value: string) => void; grow?: boolean }) {
  return <Box component="label" sx={{ ...fieldSx, gap: 1, px: 1.5, color: color.subtle, flex: grow ? '1 1 auto' : '0 1 260px', minWidth: 160 }}>
    <Icon name="search" size={16} />
    <Box component="input" type="search" name={name} aria-label={label} placeholder={placeholder} value={value} maxLength={100} onChange={event => onChange(event.target.value)}
      sx={{ border: 0, outline: 'none !important', background: 'transparent', fontFamily: font, fontSize: 13, color: color.ink, width: '100%', minHeight: 36, '&::placeholder': { color: color.subtle, opacity: 1 } }} />
  </Box>
}

export function SelectBox({ name, label, value, onChange, options }: { name: string; label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return <Box component="label" sx={{ ...fieldSx, gap: 0.75, pl: 1.5, pr: 0.5, color: color.muted }}>
    {label}
    <Box component="select" name={name} value={value} onChange={event => onChange((event.target as HTMLSelectElement).value)}
      sx={{ border: 0, outline: 'none !important', background: 'transparent', fontFamily: font, fontSize: 13, fontWeight: 600, color: color.ink, minHeight: 36, maxWidth: 220, cursor: 'pointer' }}>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </Box>
  </Box>
}

/** «‹ 2 – 8 nov 2026 ›». */
export function WeekNav({ label, onPrevious, onNext, nextDisabled }: { label: string; onPrevious: () => void; onNext: () => void; nextDisabled?: boolean }) {
  const arrow = { width: 36, height: 36, borderRadius: '50%', color: color.link, '&:hover': { background: color.hover }, '&.Mui-disabled': { color: color.field }, '&.Mui-focusVisible': { outline: `2px solid ${color.accent}` } } as const
  return <Box sx={{ display: 'flex', alignItems: 'center', gap: '2px', background: color.white, border: `1px solid ${color.line}`, borderRadius: 999, p: '3px' }}>
    <ButtonBase aria-label="Semana anterior" onClick={onPrevious} sx={arrow}><Icon name="back" size={18} strokeWidth={2.2} /></ButtonBase>
    <Typography component="span" aria-live="polite" sx={{ fontSize: 14, fontWeight: 600, px: 1, whiteSpace: 'nowrap' }}>{label}</Typography>
    <ButtonBase aria-label="Semana siguiente" onClick={onNext} disabled={nextDisabled} sx={arrow}><Icon name="chevron" size={18} strokeWidth={2.2} /></ButtonBase>
  </Box>
}

/** Botón blanco de contorno, como «Exportar vista». */
export function OutlineButton({ icon, children, onClick, disabled }: { icon?: IconName; children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return <ButtonBase onClick={onClick} disabled={disabled} sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, minHeight: 42, px: 2, borderRadius: 999, border: `1px solid ${color.fieldSoft}`,
    background: color.white, color: color.link, fontFamily: font, fontSize: 14, fontWeight: 600, '&:hover': { background: color.hover, borderColor: color.fieldHover },
    '&.Mui-disabled': { color: color.subtle }, '&.Mui-focusVisible': { outline: `2px solid ${color.accent}`, outlineOffset: 2 } }}>
    {icon && <Icon name={icon} size={18} />}{children}
  </ButtonBase>
}

export function IconButton({ icon, label, onClick, ...rest }: { icon: IconName; label: string; onClick: (event: React.MouseEvent<HTMLButtonElement>) => void } & Record<`aria-${string}`, string | boolean | undefined>) {
  return <ButtonBase aria-label={label} onClick={onClick} {...rest} sx={{ width: 36, height: 36, flex: 'none', borderRadius: '10px', border: `1px solid ${color.line}`, background: color.white, color: color.muted,
    '&:hover': { background: color.hover }, '&.Mui-focusVisible': { outline: `2px solid ${color.accent}`, outlineOffset: 2 } }}>
    <Icon name={icon} size={18} />
  </ButtonBase>
}

/** Tarjeta blanca de una tabla, con su encabezado, su cuerpo con desplazamiento propio y su pie. */
export function Pane({ title, detail, titleId, actions, footer, children }: { title: ReactNode; detail?: ReactNode; titleId: string; actions?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  return <Box component="section" aria-labelledby={titleId} sx={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', background: color.white, borderRadius: '20px', boxShadow: shadow.table, overflow: 'hidden',
    [`@media ${phoneQuery}`]: { flex: 'none', minHeight: 'auto' } }}>
    <Stack direction="row" sx={{ flex: 'none', justifyContent: 'space-between', alignItems: 'center', gap: 1, p: '12px 16px', borderBottom: `1px solid ${color.lineSoft}` }}>
      <Typography component="h2" id={titleId} sx={{ fontSize: 14, fontWeight: 600 }}>{title}{detail && <Box component="span" sx={{ fontWeight: 400, color: color.muted }}> · {detail}</Box>}</Typography>
      {actions}
    </Stack>
    <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{children}</Box>
    {footer}
  </Box>
}

export function Pager({ text, onPrevious, onNext, hasPrevious, hasNext }: { text: string; onPrevious: () => void; onNext: () => void; hasPrevious: boolean; hasNext: boolean }) {
  const button = { width: 36, height: 36, borderRadius: '10px', border: `1px solid ${color.line}`, background: color.white, color: color.link, '&.Mui-disabled': { color: color.field }, '&:hover': { background: color.hover }, '&.Mui-focusVisible': { outline: `2px solid ${color.accent}` } } as const
  return <Stack direction="row" sx={{ flex: 'none', justifyContent: 'space-between', alignItems: 'center', p: '8px 16px', borderTop: `1px solid ${color.lineSoft}`, fontSize: 13, color: color.muted }}>
    <span>{text}</span>
    <Stack direction="row" spacing={0.75}>
      <ButtonBase aria-label="Página anterior" disabled={!hasPrevious} onClick={onPrevious} sx={button}><Icon name="back" size={16} strokeWidth={2.2} /></ButtonBase>
      <ButtonBase aria-label="Página siguiente" disabled={!hasNext} onClick={onNext} sx={button}><Icon name="chevron" size={16} strokeWidth={2.2} /></ButtonBase>
    </Stack>
  </Stack>
}

/** Estilos de una tabla del lienzo sobre `<table>`: encabezado fijo y fila elegida. */
export const tableSx = {
  width: '100%', borderCollapse: 'collapse', fontSize: 13,
  '& th': { position: 'sticky', top: 0, zIndex: 1, background: color.white, textAlign: 'left', fontWeight: 600, color: color.subtle, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', p: '10px 12px', borderBottom: `1px solid ${color.line}`, whiteSpace: 'nowrap' },
  '& td': { p: '9px 12px', borderBottom: `1px solid ${color.lineSoft}`, verticalAlign: 'middle', whiteSpace: 'nowrap' },
  '& tbody tr:hover td': { background: color.rowHover },
  '& tbody tr[data-selected="true"] td': { background: color.selected },
} as const

/** Filas de espera mientras llega la tabla (EST-09). */
export function SkeletonRows({ columns, rows = 10 }: { columns: number; rows?: number }) {
  return <>{Array.from({ length: rows }, (_, row) => <tr key={row} aria-hidden="true">
    {Array.from({ length: columns }, (_, column) => <td key={column}><Skeleton variant="rounded" height={10} width={`${60 + ((row * 7 + column * 13) % 35)}%`} sx={{ borderRadius: 999, bgcolor: color.lineSoft }} /></td>)}
  </tr>)}</>
}

/** Aviso dentro de una pantalla: naranja para lo que pide atención, azul para lo que explica. */
export function Note({ tone = 'info', children }: { tone?: 'warn' | 'info' | 'error'; children: ReactNode }) {
  const palette = tone === 'warn' ? { background: color.warnBg, color: color.noteInk, icon: 'notice' as const }
    : tone === 'error' ? { background: color.errorBg, color: color.error, icon: 'alert' as const } : { background: color.selected, color: color.inkSoft, icon: 'info' as const }
  return <Box role="note" sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', background: palette.background, color: palette.color, borderRadius: '12px', p: '10px 12px', fontSize: 12.5, lineHeight: 1.5,
    '& > svg': { flex: 'none', mt: '1px', color: tone === 'info' ? color.accent : palette.color } }}>
    <Icon name={palette.icon} size={16} /><Box>{children}</Box>
  </Box>
}

export type SheetTab = { key: string; label: string }

/**
 * Ficha lateral sobre la tabla (escritorio) o a pantalla completa (teléfono).
 * No es modal: la tabla sigue a la mano. Escape la cierra y el foco va al
 * título al abrirla; quien la abre devuelve el foco al cerrarla.
 */
export function SidePanel({ title, subtitle, initials, onClose, tabs, tab, onTab, children }: {
  title: string; subtitle?: ReactNode; initials: string; onClose: () => void; tabs: SheetTab[]; tab: string; onTab: (key: string) => void; children: ReactNode
}) {
  const id = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [title])
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex(item => item.key === tab)
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
    if (next < 0) return
    event.preventDefault()
    onTab(tabs[next].key)
    document.getElementById(`${id}-tab-${tabs[next].key}`)?.focus()
  }
  return <Box component="section" aria-labelledby={`${id}-title`} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}
    sx={{ position: 'fixed', top: 60, right: 0, bottom: 0, width: 440, maxWidth: '100%', zIndex: 40, display: 'flex', flexDirection: 'column', background: color.white, borderRadius: '20px 0 0 20px', boxShadow: shadow.drawer, overflow: 'hidden',
      [`@media ${phoneQuery}`]: { top: 0, width: '100%', borderRadius: 0, zIndex: 1300 } }}>
    <Stack direction="row" sx={{ flex: 'none', alignItems: 'center', gap: 1.5, p: '16px 18px', color: color.white, background: gradient.sheet }}>
      <ButtonBase aria-label="Volver a la lista" onClick={onClose} sx={{ display: 'none', width: 44, height: 44, flex: 'none', borderRadius: '50%', background: 'rgba(255,255,255,0.16)', color: color.white,
        [`@media ${phoneQuery}`]: { display: 'flex' }, '&.Mui-focusVisible': { outline: `2px solid ${color.white}` } }}><Icon name="arrowBack" /></ButtonBase>
      <Box aria-hidden="true" sx={{ width: 44, height: 44, flex: 'none', borderRadius: '50%', background: color.white, color: color.link, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
        [`@media ${phoneQuery}`]: { display: 'none' } }}>{initials}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography component="h2" id={`${id}-title`} ref={heading} tabIndex={-1} sx={{ fontSize: 17, fontWeight: 600, outline: 'none', [`@media ${phoneQuery}`]: { fontSize: 22, fontWeight: 700 } }} noWrap>{title}</Typography>
        {subtitle && <Typography sx={{ mt: '2px', fontSize: 13 }}>{subtitle}</Typography>}
      </Box>
      <ButtonBase aria-label="Cerrar ficha" onClick={onClose} sx={{ width: 36, height: 36, flex: 'none', borderRadius: '50%', background: 'rgba(255,255,255,0.14)', color: color.white,
        [`@media ${phoneQuery}`]: { display: 'none' }, '&:hover': { background: 'rgba(255,255,255,0.24)' }, '&.Mui-focusVisible': { outline: `2px solid ${color.white}` } }}><Icon name="close" size={18} strokeWidth={2} /></ButtonBase>
    </Stack>
    <Box role="tablist" aria-label="Ficha" onKeyDown={keys} sx={{ flex: 'none', display: 'flex', gap: 0.5, px: 1.5, borderBottom: `1px solid ${color.lineSoft}`, overflowX: 'auto' }}>
      {tabs.map(item => <ButtonBase key={item.key} role="tab" id={`${id}-tab-${item.key}`} aria-selected={item.key === tab} aria-controls={`${id}-panel`} tabIndex={item.key === tab ? 0 : -1}
        onClick={() => onTab(item.key)} sx={{ minHeight: 44, px: 1.5, fontFamily: font, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '2px solid transparent', color: color.muted,
          '&[aria-selected="true"]': { borderBottomColor: color.accent, color: color.deep }, '&:hover': { color: color.ink }, '&.Mui-focusVisible': { outline: `2px solid ${color.accent}`, outlineOffset: -2 } }}>
        {item.label}
      </ButtonBase>)}
    </Box>
    <Box role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${tab}`} sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: '14px 16px', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {children}
    </Box>
  </Box>
}

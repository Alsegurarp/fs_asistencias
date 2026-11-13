import type { ReactNode } from 'react'
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { color, font, glass, gradient, phoneQuery } from './design'
import { Icon, type IconName, ZenitMark } from './Icons'

const highlights = ['Cada marca queda con su evidencia', 'Las reglas laborales vigentes, aplicadas a cada semana', 'Tu información, aislada de la de otras empresas']

/**
 * Pantallas sin menú del lienzo (ACC-07, EST-01): panel de marca a la
 * izquierda y el mensaje a la derecha. En teléfono el panel se reduce a la marca.
 */
export function BrandLayout({ icon, title, lead, children }: { icon: IconName; title: string; lead: ReactNode; children: ReactNode }) {
  return <Box sx={{ minHeight: '100dvh', display: 'flex', flexWrap: 'wrap', fontFamily: font, color: color.ink, background: color.white }}>
    <Box component="section" aria-label="Zenit" sx={{ flex: '1 1 560px', position: 'relative', overflow: 'hidden', color: color.white, p: '48px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 4, background: gradient.brand,
      [`@media ${phoneQuery}`]: { p: 3, flexBasis: '100%' } }}>
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}><ZenitMark size={40} /><Typography component="span" sx={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.01em' }}>Zenit</Typography></Stack>
      <Stack spacing={2.25} sx={{ maxWidth: 520, [`@media ${phoneQuery}`]: { display: 'none' } }}>
        <Typography component="p" sx={{ fontSize: 40, lineHeight: 1.15, fontWeight: 700, letterSpacing: '-0.02em' }}>Control de asistencia para tu empresa</Typography>
        <Typography sx={{ fontSize: 17, lineHeight: 1.55 }}>Marcaje con tarjeta, incidencias, cierres semanales y reportes para nómina, en un solo lugar.</Typography>
        <Stack component="ul" spacing={1.25} sx={{ listStyle: 'none', m: 0, p: 0, fontSize: 15 }}>
          {highlights.map(text => <Stack component="li" key={text} direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
            <Box component="span" aria-hidden="true" sx={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name="check" size={14} /></Box>
            <span>{text}</span>
          </Stack>)}
        </Stack>
      </Stack>
      <span />
    </Box>
    <Box component="main" sx={{ flex: '1 1 460px', display: 'flex', alignItems: 'center', justifyContent: 'center', p: '40px 24px' }}>
      <Stack spacing={2.25} sx={{ width: '100%', maxWidth: 400 }}>
        <Box aria-hidden="true" sx={{ width: 64, height: 64, borderRadius: '20px', background: gradient.tile, color: color.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={30} /></Box>
        <Box>
          <Typography component="h1" sx={{ fontSize: 28, lineHeight: 1.25, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</Typography>
          <Typography sx={{ mt: 0.75, fontSize: 15, lineHeight: 1.5, color: color.muted }}>{lead}</Typography>
        </Box>
        {children}
      </Stack>
    </Box>
  </Box>
}

export function Note({ children }: { children: ReactNode }) {
  return <Typography sx={{ p: '12px 14px', borderRadius: '14px', background: color.hover, fontSize: 14, lineHeight: 1.5 }}>{children}</Typography>
}

/** ACC-07: la persona salió o la sesión venció. */
export function SessionEnded({ onSignIn }: { onSignIn: () => void }) {
  return <BrandLayout icon="clock" title="Tu sesión terminó"
    lead="Saliste de Zenit o pasó un rato sin actividad. Lo que guardaste está a salvo; lo que no alcanzaste a guardar hay que capturarlo de nuevo.">
    <Button variant="contained" size="large" sx={{ minHeight: 48, fontSize: 15 }} onClick={onSignIn}>Volver a entrar</Button>
  </BrandLayout>
}

/** EST-01: identidad válida sin acceso vigente a ninguna empresa. */
export function NoCompany({ email, onSignOut }: { email?: string; onSignOut: () => void }) {
  return <BrandLayout icon="person" title="Tu cuenta no tiene acceso a una empresa"
    lead={`${email ? `Entraste como ${email}, pero` : 'Entraste, pero'} ninguna empresa te ha dado acceso o el acceso se retiró.`}>
    <Note>Pide una invitación a quien administra tu empresa en Zenit.</Note>
    <Button variant="outlined" sx={{ minHeight: 46 }} onClick={onSignOut}>Cerrar sesión</Button>
  </BrandLayout>
}

/** EST-02: la empresa de la persona está suspendida; el portal no abre hasta reactivarla. */
export function CompanySuspended({ company, onSignOut }: { company?: string | null; onSignOut: () => void }) {
  return <BrandLayout icon="pause" title="Tu empresa está suspendida"
    lead={`${company || 'Tu empresa'} tiene el servicio de Zenit suspendido. El portal no está disponible hasta que se reactive.`}>
    <Note>Los lectores y teléfonos que ya estaban activados siguen registrando las marcas: nada se pierde y todo estará aquí al reactivar.</Note>
    <Note>Para reactivar el servicio, quien administra tu empresa debe ponerse en contacto con Zenit.</Note>
    <Button variant="outlined" sx={{ minHeight: 46 }} onClick={onSignOut}>Cerrar sesión</Button>
  </BrandLayout>
}

/** No se pudo hablar con el servicio de identidad: no hay sesión que mostrar. */
export function IdentityUnavailable() {
  // EST-06 al abrir Zenit sin red: la sesión se confirma con el servicio de identidad, que necesita señal.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return <BrandLayout icon="alert" title="Sin conexión" lead="Para entrar, Zenit confirma tu cuenta con el servidor y eso necesita red. Lo que ya tenías abierto se sigue viendo sin señal; para volver a entrar, conéctate e intenta de nuevo.">
    <Button variant="contained" size="large" sx={{ minHeight: 48, fontSize: 15 }} onClick={() => window.location.reload()}>Reintentar</Button>
  </BrandLayout>
  return <BrandLayout icon="alert" title="No pudimos conectar con el inicio de sesión" lead="El servicio que verifica tu cuenta no respondió. Intenta de nuevo en un momento.">
    <Button variant="contained" size="large" sx={{ minHeight: 48, fontSize: 15 }} onClick={() => window.location.reload()}>Reintentar</Button>
  </BrandLayout>
}

/** EST-03, EST-04 y EST-05: tarjeta de vidrio centrada dentro del portal. */
export function StateCard({ icon, eyebrow, title, children, reference, actions }: {
  icon: IconName; eyebrow: string; title: string; children: ReactNode; reference?: string; actions?: ReactNode
}) {
  return <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2 }}>
    <Box component="section" aria-labelledby="estado-titulo" sx={{ ...glass, width: '100%', maxWidth: 620, p: '40px 36px', borderRadius: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.75, textAlign: 'center',
      [`@media ${phoneQuery}`]: { p: '32px 20px' } }}>
      <Box aria-hidden="true" sx={{ width: 72, height: 72, borderRadius: '22px', background: gradient.badge, color: color.white, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 24px rgba(29,74,159,0.25)' }}><Icon name={icon} size={32} /></Box>
      <Typography component="span" sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: color.subtle }}>{eyebrow}</Typography>
      <Typography component="h1" id="estado-titulo" tabIndex={-1} sx={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em', outline: 'none' }}>{title}</Typography>
      <Typography sx={{ fontSize: 15, lineHeight: 1.55, color: color.muted, maxWidth: 480 }}>{children}</Typography>
      {reference && <Box component="code" sx={{ fontSize: 13, p: '6px 12px', borderRadius: '8px', background: color.hover, color: color.ink }}>Referencia {reference}</Box>}
      {actions && <Stack direction="row" useFlexGap spacing={1.25} sx={{ flexWrap: 'wrap', justifyContent: 'center', mt: 0.75 }}>{actions}</Stack>}
    </Box>
  </Box>
}

export function FullPageLoading({ label }: { label: string }) {
  return <Box sx={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: gradient.page }}>
    <Stack spacing={2} sx={{ alignItems: 'center', color: color.muted }}>
      <CircularProgress aria-label={label} />
      <Typography role="status" sx={{ fontSize: 14 }}>{label}</Typography>
    </Stack>
  </Box>
}


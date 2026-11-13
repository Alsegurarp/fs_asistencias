import { type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, Button, Stack, Typography } from '@mui/material'
import { api, type Me } from './api'
import { identityBase } from './auth'
import { color } from './design'
import { dossierPermissionKey } from './Dossiers'
import { Icon } from './Icons'
import { InstallRow } from './Install'
import { initials, rolesText } from './Shell'
import { joinNames, roleLabel } from './sections'
import { Modal, Note, SidePanel } from './ui'
import { support } from './usersModel'

/** `?perfil=1` abre Mi perfil y `?ayuda=1`, Ayuda y soporte, desde cualquier pantalla. */
export const profileParam = 'perfil'
export const helpParam = 'ayuda'

/** La consola de cuenta del servicio de identidad, donde se cambian la contraseña y el segundo factor. */
export const securityUrl = `${identityBase}/realms/zenit/account/account-security/signing-in`

/** Lo que alcanza a ver con sus roles, como en Usuarios y roles. */
export function myScope(roles: string[]) {
  if (roles.some(role => role === 'admin_empresa' || role === 'rh')) return 'Toda la empresa'
  if (roles.includes('auditor')) return 'Toda la empresa, consulta'
  if (roles.includes('supervisor')) return 'Las sedes que te asignaron'
  if (roles.includes('trabajador')) return 'Tu asistencia'
  if (roles.includes('operador_saas')) return 'La operación del servicio'
  return '—'
}

/**
 * Mi perfil (CTA-01; TEL-11 en teléfono, a pantalla completa): quién es, su
 * acceso y la seguridad de su cuenta. El nombre y el rol los cambia
 * Administración; la contraseña y el segundo factor, la consola de cuenta.
 */
export function ProfilePanel({ me, email, context, onClose, onSignOut }: { me: Me; email?: string; context: string; onClose: () => void; onSignOut: () => void }) {
  const permission = useQuery({ queryKey: dossierPermissionKey(me), queryFn: () => api<{ enabled: boolean }>('/me/dossier-permission'), enabled: !!me.tenant, retry: false })
  const roles = me.tenant ? me.roles : me.roles.filter(role => role === 'operador_saas')
  return <SidePanel title={me.displayName} subtitle={email} initials={initials(me.displayName)} eyebrow="Mi perfil" onClose={onClose}
    footer={<Button variant="outlined" color="error" onClick={onSignOut} sx={{ minHeight: 42 }}>Cerrar sesión</Button>}>
    <Group title="Tu acceso">
      <Fact label={me.tenant ? 'Empresa' : 'Servicio'} value={context} />
      <Fact label={roles.length > 1 ? 'Roles' : 'Rol'} value={roles.length ? (me.tenant ? rolesText(me) : roles.map(roleLabel).join(', ')) : 'Sin rol'} />
      <Fact label="Alcance" value={me.sites && roles.includes('supervisor') && !roles.some(role => role === 'admin_empresa' || role === 'rh' || role === 'auditor')
        ? (me.sites.length ? joinNames(me.sites.map(site => site.name)) : 'Ninguna sede asignada') : myScope(roles)} />
      {me.tenant && <Fact label="Expediente de la empresa" value={permission.isPending ? '…' : permission.data?.enabled ? 'Puede descargarlo' : 'No'} />}
      {me.tenant && <Fact label="En el padrón" value={me.employeeId ? 'Sí' : 'No'} />}
    </Group>
    <Typography sx={{ fontSize: 12.5, color: color.muted }}>Tu nombre y tu rol los cambia Administración; el correo no se cambia, se invita de nuevo.</Typography>
    <Group title="Seguridad" list={false}>
      <Action label="Contraseña" detail="12 caracteres o más" action="Cambiar" />
      <Action label="Segundo factor" detail="Activo · app de autenticación" action="Reconfigurar" />
    </Group>
    <Typography sx={{ fontSize: 12.5, color: color.muted }}>Se cambian en tu cuenta de Zenit, en otra pestaña; al terminar vuelve aquí.</Typography>
    <InstallRow />
  </SidePanel>
}

function Group({ title, children, list = true }: { title: string; children: ReactNode; list?: boolean }) {
  return <Box component="section" aria-label={title}>
    <Typography component="h3" sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: color.subtle, mb: 0.75 }}>{title}</Typography>
    <Box component={list ? 'dl' : 'div'} sx={{ m: 0, border: `1px solid ${color.line}`, borderRadius: '14px', overflow: 'hidden' }}>{children}</Box>
  </Box>
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 2, p: '10px 14px', '& + &': { borderTop: `1px solid ${color.lineSoft}` } }}>
    <Box component="dt" sx={{ fontSize: 13, color: color.muted }}>{label}</Box>
    <Box component="dd" sx={{ m: 0, fontSize: 14, fontWeight: 600, textAlign: 'right' }}>{value}</Box>
  </Stack>
}

function Action({ label, detail, action }: { label: string; detail: string; action: string }) {
  return <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 2, p: '10px 14px', '& + &': { borderTop: `1px solid ${color.lineSoft}` } }}>
    <Box>
      <Box sx={{ fontSize: 14, fontWeight: 600 }}>{label}</Box>
      <Box sx={{ fontSize: 12.5, color: color.muted }}>{detail}</Box>
    </Box>
    <Button component="a" href={securityUrl} target="_blank" rel="noopener" variant="outlined" size="small" aria-label={`${action} ${label.toLowerCase()} (se abre en otra pestaña)`}
      sx={{ minHeight: 36, borderRadius: 999 }}>{action}</Button>
  </Stack>
}

/** Ayuda y soporte: a quién escribir o llamar. */
export function HelpModal({ onClose }: { onClose: () => void }) {
  const link = { display: 'flex', alignItems: 'center', gap: 1.5, p: '12px 14px', borderRadius: '14px', border: `1px solid ${color.line}`, textDecoration: 'none', color: `${color.ink} !important`, '&:hover': { background: color.hover } } as const
  return <Modal id="ayuda-titulo" icon="info" title="Ayuda y soporte" subtitle="Escríbenos o llámanos; responde una persona" onClose={onClose} onSubmit={onClose} closable
    actions={<Button variant="contained" onClick={onClose}>Listo</Button>}>
    <Box component="a" href={`mailto:${support.email}?subject=${encodeURIComponent('Ayuda con Zenit')}`} sx={link}>
      <Icon name="notice" /><Box><Box component="strong" sx={{ display: 'block' }}>Correo</Box><Box component="span" sx={{ fontSize: 13, color: color.link, overflowWrap: 'anywhere' }}>{support.email}</Box></Box>
    </Box>
    <Box component="a" href={`tel:${support.tel}`} sx={link}>
      <Icon name="devices" /><Box><Box component="strong" sx={{ display: 'block' }}>Teléfono</Box><Box component="span" sx={{ fontSize: 13, color: color.link }}>{support.phone}</Box></Box>
    </Box>
    <Note>Si algo falló en una pantalla, incluye la referencia que aparece en el mensaje de error.</Note>
  </Modal>
}

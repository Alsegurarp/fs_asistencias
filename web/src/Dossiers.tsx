import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Button, Stack, Typography, useMediaQuery } from '@mui/material'
import { api, apiDownload, ApiError, type Me, type Page } from './api'
import { timeIn } from './attendanceModel'
import { auth, identityBase } from './auth'
import { color, phoneQuery, shadow } from './design'
import {
  type Dossier, type Manifest, dossierStatus, dossierStep, hashGroups, limitationText, manifestRows,
} from './dossierModel'
import { clearDossierVerification, dossierPkce, pendingVerification, prepareDossierRedirect, takeDossierVerification, verificationReturned, type Challenge } from './dossierFlow'
import { saveFile } from './files'
import { Icon } from './Icons'
import { dateInZone } from './incidentModel'
import { problemText } from './personnelData'
import { ReportSheet, SheetHeader, Stepper, printSheet } from './ReportSheet'
import type { PaperKey } from './reportsModel'
import { shortHash } from './reportsModel'
import { roleLabel } from './roles'
import { PageHeader } from './Shell'
import type { Screen, Section } from './sections'
import { shortDay } from './settingsModel'
import { Badge, Note, tableSx, visuallyHidden } from './ui'
import type { UserRow } from './usersModel'

export type { Dossier }
export function dossierOwner(me: Me) { return `${me.userId}:${auth.tokenParsed?.sub || ''}` }
export function dossierPermissionKey(me: Me) { return ['dossier-permission', dossierOwner(me)] }

type Props = { me: Me; context: string; section: Section; screen: Screen }

const steps = ['Preparar la copia', 'Confirmar que eres tú', 'Descargar']
const card = { background: color.white, borderRadius: '20px', boxShadow: shadow.card, p: '18px 20px', display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 } as const
const heading = { fontSize: 15, fontWeight: 700 } as const

/**
 * Expediente de la empresa (REP-05 y 06): una copia íntegra en un ZIP con
 * manifiesto y huellas. Se prepara, se confirma la identidad con contraseña
 * y segundo factor, y se descarga una sola vez. La verificación vive en
 * `dossierFlow.ts`: se canjea una vez y se descarta si cambia la cuenta.
 */
export function Dossiers({ me, context, section, screen }: Props) {
  const cache = useQueryClient()
  const timeZone = me.tenant!.timeZone
  const phone = useMediaQuery(phoneQuery)
  const owner = dossierOwner(me)
  const current = useRef(owner); current.current = owner
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [key, setKey] = useState(() => crypto.randomUUID())
  const [chosen, setId] = useState(() => pendingVerification()?.dossierId || '')
  const [returned, setReturned] = useState(verificationReturned)
  const [message, setMessage] = useState('')
  const permission = useQuery({ queryKey: dossierPermissionKey(me), queryFn: () => api<{ enabled: boolean }>('/me/dossier-permission'), retry: false })
  const allowed = permission.data?.enabled === true
  const history = useQuery({ queryKey: ['dossiers', owner], enabled: allowed, retry: false, queryFn: () => api<Page<Dossier>>('/dossiers?limit=10') })
  // Sin una elegida, la más reciente que sigue en curso o lista.
  const id = chosen || history.data?.items.find(item => ['queued', 'preparing', 'ready'].includes(item.status))?.id || ''
  const record = useQuery({ queryKey: ['dossier', owner, id], queryFn: () => api<Dossier>(`/dossiers/${id}`), enabled: !!id && allowed, retry: false,
    refetchInterval: query => query.state.error ? false : ['queued', 'preparing'].includes(query.state.data?.status || '') ? 3000 : false })
  const hasManifest = !!record.data?.manifestSha256
  const manifest = useQuery({ queryKey: ['dossier-manifest', owner, id], enabled: allowed && hasManifest, retry: false, staleTime: Infinity,
    queryFn: async () => { const file = await apiDownload(`/dossiers/${id}/manifest`); return { blob: file.blob, data: JSON.parse(await file.blob.text()) as Manifest } } })
  const holders = useQuery({ queryKey: ['users', 'expediente'], enabled: allowed && me.roles.includes('admin_empresa'), retry: false,
    queryFn: () => api<Page<UserRow>>('/users?dossierPermission=true&limit=50') })

  function checkAccount() { if (!mounted.current || current.current !== owner || dossierOwner(me) !== owner) throw new Error('La cuenta cambió. Inicia otra solicitud.') }
  const refreshHistory = () => void cache.invalidateQueries({ queryKey: ['dossiers', owner] })
  const request = useMutation({ mutationFn: () => api<Dossier>('/dossiers', 'POST', { formatVersion: 1 }, key), onSuccess: value => {
    checkAccount(); clearDossierVerification(); setReturned(false); setMessage(''); setId(value.id); setKey(crypto.randomUUID()); cache.setQueryData(['dossier', owner, value.id], value); refreshHistory()
  } })
  const verify = useMutation({ mutationFn: async () => {
    clearDossierVerification(); setReturned(false); setMessage('')
    const pair = await dossierPkce(); checkAccount()
    const challenge = await api<Challenge>(`/dossiers/${id}/challenges`, 'POST', { codeChallenge: pair.challenge }); checkAccount()
    const url = prepareDossierRedirect(id, owner, challenge, pair, identityBase)
    window.location.assign(url)
  } })
  const download = useMutation({ mutationFn: async () => {
    const proof = takeDossierVerification(owner); setReturned(false); checkAccount()
    const authorization = await api<{ authorization: string }>(`/dossiers/${proof.dossierId}/authorizations`, 'POST', proof.body); checkAccount()
    const file = await apiDownload(`/dossiers/${proof.dossierId}/download`, 'POST', { authorization: authorization.authorization }); checkAccount()
    saveFile(file.blob, file.filename); setMessage('El expediente se descargó. Guarda el manifiesto junto al ZIP para comprobar después sus huellas.'); window.history.replaceState(null, '', '/reportes/expediente')
  }, onSettled: () => { if (mounted.current) { void record.refetch(); refreshHistory() } } })
  const error = request.error || record.error || verify.error || download.error
  useEffect(() => {
    if (error instanceof ApiError && [401, 403].includes(error.status)) { clearDossierVerification(); setReturned(false); void cache.invalidateQueries({ queryKey: dossierPermissionKey(me) }); void cache.invalidateQueries({ queryKey: ['me'] }) }
  }, [error, cache, me])

  const header = <PageHeader context={context} section={section} screens={[screen]} current={screen} title="Expediente de la empresa"
    description="copia íntegra con manifiesto y huellas, para auditorías o inspecciones"
    actions={<Button variant="text" component={Link} to="/reportes" startIcon={<Icon name="back" size={16} />}>Elegir otro reporte</Button>} />
  if (permission.isPending) return <>{header}<Typography role="status" sx={{ color: color.muted }}>Consultando el permiso del expediente…</Typography></>
  if (permission.isError) return <>{header}<Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
    <Note tone="error">{problemText(permission.error, 'No pudimos consultar el permiso.')}</Note>
    <Button variant="outlined" onClick={() => void permission.refetch()}>Reintentar</Button>
  </Stack></>
  if (!allowed) return <>{header}<Note>Tu cuenta no tiene permiso para descargar el expediente de la empresa. Lo concede Administración en Usuarios y roles.</Note></>

  const data = record.data
  const step = dossierStep(data, returned)
  const busy = request.isPending || verify.isPending || download.isPending
  const day = (instant: string, year = true) => `${shortDay(dateInZone(instant, timeZone), year).replace(/^\S+ /, '')}, ${timeIn(instant, timeZone)}`
  const counts = manifest.data?.data.counts
  const rows = counts ? manifestRows(counts) : []
  const previous = (history.data?.items || []).filter(item => item.id !== id)

  let main: ReactNode
  if (!data || ['failed', 'expired', 'downloaded'].includes(data.status)) main = <>
    <Typography sx={{ fontSize: 14, lineHeight: 1.55 }}>Zenit toma una instantánea íntegra de la información de tu empresa y la empaqueta en un ZIP con manifiesto y la huella de cada archivo, para comprobar después que nada cambió.</Typography>
    {data && <Note tone={data.status === 'failed' ? 'error' : 'info'}>{data.status === 'failed' ? 'No se pudo preparar la copia anterior.' : data.status === 'downloaded' ? 'La copia anterior ya se descargó.' : 'La copia anterior venció sin descargarse.'} Para otra, prepara una nueva.</Note>}
    <Box><Button variant="contained" disabled={busy || (!!id && record.isPending)} onClick={() => request.mutate()}>{request.isPending ? 'Pidiendo…' : 'Preparar la copia'}</Button></Box>
  </>
  else if (data.status !== 'ready') main = <Typography role="status" sx={{ fontSize: 14 }}>Preparando la copia… se actualiza sola. Puede tardar unos minutos.</Typography>
  else main = <>
    <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
      <Badge tone="ok">Copia lista</Badge>
      <Typography sx={{ fontSize: 13, color: color.muted }}>Corte al {data.snapshotAt ? day(data.snapshotAt) : '…'}{rows.length ? ` · ${rows.length} secciones` : ''} · vence el {day(data.expiresAt, false)}</Typography>
    </Stack>
    {step === 2 ? <>
      <Typography component="h3" sx={{ ...heading, mt: 0.5 }}>Confirmar que eres tú</Typography>
      <Typography sx={{ fontSize: 14, lineHeight: 1.55 }}>Vuelves a iniciar sesión con tu contraseña y tu segundo factor. La autorización sirve para una sola descarga y sólo para esta copia; si cambian tu cuenta o tus permisos antes de descargar, se descarta.</Typography>
      <Stack direction="row" useFlexGap sx={{ gap: 1, flexWrap: 'wrap' }}>
        <Button variant="contained" disabled={busy} onClick={() => verify.mutate()}>{verify.isPending ? 'Abriendo la verificación…' : 'Confirmar que eres tú'}</Button>
        <Button variant="outlined" disabled={busy} onClick={() => request.mutate()}>Preparar una copia nueva</Button>
      </Stack>
    </> : <>
      <Note>Identidad confirmada · vale para una descarga de esta copia.</Note>
      <Typography sx={{ fontSize: 14, lineHeight: 1.55 }}>El ZIP se descarga <strong>una sola vez</strong>. Si la descarga se interrumpe, el archivo puede quedar incompleto y la autorización ya estará usada: prepara otra copia.</Typography>
      <Stack direction="row" useFlexGap sx={{ gap: 1, flexWrap: 'wrap' }}>
        <Button variant="contained" disabled={busy} onClick={() => download.mutate()}>{download.isPending ? 'Descargando…' : 'Descargar ZIP (una vez)'}</Button>
        <Button variant="outlined" disabled={busy} onClick={() => verify.mutate()}>Confirmar de nuevo</Button>
        <Button variant="text" disabled={busy} onClick={() => { clearDossierVerification(); setReturned(false); setMessage('Verificación descartada. Puedes confirmar otra vez.') }}>Descartar la verificación</Button>
      </Stack>
    </>}
  </>

  return <>
    {header}
    <Stepper steps={steps} step={message && data?.status === 'downloaded' ? 4 : step} phone={phone} />
    {error && <Note tone="error">{problemText(error, error.message || 'No se pudo completar.')}</Note>}
    {message && <Note>{message}</Note>}
    <Box sx={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : 'minmax(0, 1.1fr) minmax(0, 1fr)', gap: 2, alignItems: 'start' }}>
      <Stack spacing={2} sx={{ minWidth: 0 }}>
        <Box component="section" aria-labelledby="copia" sx={card}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography component="h2" id="copia" sx={heading}>{step === 1 ? 'Preparar la copia' : 'La copia'}</Typography>
            {data && <Badge tone={dossierStatus[data.status].tone}>{dossierStatus[data.status].label}</Badge>}
          </Stack>
          {main}
          {data?.manifestSha256 && <Box sx={{ fontSize: 12.5, color: color.muted, display: 'flex', flexDirection: 'column', gap: 0.25, overflowWrap: 'anywhere' }}>
            <span>Huella del manifiesto (SHA-256): <Box component="span" title={data.manifestSha256} sx={{ fontFamily: 'monospace' }}>{hashGroups(data.manifestSha256)}</Box></span>
            {data.fileSha256 && <span>Huella del ZIP (SHA-256): <Box component="span" title={data.fileSha256} sx={{ fontFamily: 'monospace' }}>{hashGroups(data.fileSha256)}</Box></span>}
            {manifest.data && <Box><Button size="small" onClick={() => saveFile(manifest.data!.blob, `expediente-${id}-manifest.json`)}>Guardar manifiesto</Button></Box>}
          </Box>}
        </Box>
        <Box component="section" aria-labelledby="anteriores" sx={{ ...card, p: 0, overflow: 'hidden' }}>
          <Typography component="h2" id="anteriores" sx={{ ...heading, p: '14px 18px 0' }}>Copias anteriores</Typography>
          {history.isError ? <Box sx={{ p: 2 }}><Note tone="error">{problemText(history.error, 'No pudimos cargar las copias.')}</Note></Box>
            : !previous.length ? <Typography sx={{ p: '4px 18px 16px', fontSize: 13, color: color.muted }}>{history.isPending ? 'Cargando…' : 'Todavía no hay otras copias tuyas.'}</Typography>
              : <Box sx={{ overflowX: 'auto' }}><Box component="table" sx={tableSx}>
                <thead><tr><th scope="col">Corte</th><th scope="col">Estado</th><th scope="col">Descargada</th><th scope="col">Huella del manifiesto</th></tr></thead>
                <tbody>{previous.map(item => <tr key={item.id}>
                  <td>{item.snapshotAt ? day(item.snapshotAt) : item.createdAt ? day(item.createdAt) : '—'}</td>
                  <td><Badge tone={dossierStatus[item.status].tone}>{dossierStatus[item.status].label}</Badge></td>
                  <Box component="td" sx={{ color: color.muted }}>{item.downloadedAt ? day(item.downloadedAt) : '—'}</Box>
                  <Box component="td" sx={{ fontFamily: 'monospace', color: color.muted }} title={item.manifestSha256 || undefined}>{shortHash(item.manifestSha256) || '—'}</Box>
                </tr>)}</tbody>
              </Box></Box>}
          <Typography sx={{ p: '8px 18px 14px', fontSize: 12.5, color: color.muted }}>Aquí están sólo las copias que pediste tú; las de los demás quedan en la bitácora.</Typography>
        </Box>
        {holders.data && <Box component="section" aria-labelledby="quien" sx={{ ...card, p: 0, overflow: 'hidden' }}>
          <Typography component="h2" id="quien" sx={{ ...heading, p: '14px 18px 0' }}>Quién puede descargarlo</Typography>
          <Box sx={{ overflowX: 'auto' }}><Box component="table" sx={tableSx}>
            <thead><tr><th scope="col">Persona</th><th scope="col">Rol</th><th scope="col">Permiso desde</th></tr></thead>
            <tbody>{holders.data.items.map(user => <tr key={user.id}>
              <td><strong>{user.displayName || user.email}</strong></td><td>{user.roles.map(roleLabel).join(', ')}</td>
              <Box component="td" sx={{ color: color.muted }}>{user.dossierPermissionSince ? shortDay(dateInZone(user.dossierPermissionSince, timeZone), true).replace(/^\S+ /, '') : '—'}</Box>
            </tr>)}</tbody>
          </Box></Box>
          <Typography sx={{ p: '8px 18px 14px', fontSize: 12.5, color: color.muted }}>El permiso es aparte del rol y se cambia en <Link to="/usuarios?expediente=1">Usuarios y roles</Link>.</Typography>
        </Box>}
      </Stack>
      <Stack spacing={2} sx={{ minWidth: 0 }}>
        <Box component="section" aria-labelledby="incluye" sx={{ ...card, p: 0, overflow: 'hidden' }}>
          <Box sx={{ p: '14px 18px 0' }}>
            <Typography component="h2" id="incluye" sx={heading}>Qué incluye esta copia</Typography>
            <Typography sx={{ fontSize: 13, color: color.muted }}>{manifest.data ? `Formato ${manifest.data.data.formatVersion} · ${rows.length} secciones` : 'Toda la información que conserva Zenit de tu empresa, sus versiones e instrucciones de consulta.'}</Typography>
          </Box>
          {manifest.isError && <Box sx={{ p: 2 }}><Note tone="error">{problemText(manifest.error, 'No pudimos leer el manifiesto.')}</Note></Box>}
          {!!rows.length && <Box component="table" sx={tableSx}>
            <thead><tr><th scope="col">Sección</th><th scope="col" style={{ textAlign: 'right' }}>Registros</th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.label}><td>{row.label}</td><Box component="td" sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.value}</Box></tr>)}</tbody>
          </Box>}
          {!!manifest.data?.data.limitations?.length && <Box component="ul" sx={{ m: '8px 18px 14px', pl: 2.5, fontSize: 12.5, color: color.muted, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            {manifest.data.data.limitations.map(code => <li key={code}>{limitationText(code)}</li>)}
          </Box>}
          {!manifest.data && !manifest.isError && <Typography sx={{ p: '8px 18px 16px', fontSize: 13, color: color.muted }}>{hasManifest ? 'Leyendo el manifiesto…' : 'Se ve cuando la copia esté lista.'}</Typography>}
        </Box>
        {data?.status === 'ready' && manifest.data && <Cover me={me} record={data} manifest={manifest.data.data} rows={rows} />}
      </Stack>
    </Box>
    <Typography sx={{ flex: 'none', fontSize: 12.5, color: color.muted }}>Descargar no autoriza borrar datos ni purgar los teléfonos. Cada paso queda en la bitácora.</Typography>
  </>
}

/** La carátula del expediente: resume lo que trae el ZIP, para imprimirla o guardarla junto a él. */
function Cover({ me, record, manifest, rows }: { me: Me; record: Dossier; manifest: Manifest; rows: { label: string; value: string }[] }) {
  const timeZone = me.tenant!.timeZone
  const [paper, setPaper] = useState<PaperKey>('carta-v')
  const snapshot = manifest.snapshotAt || record.snapshotAt || ''
  const when = snapshot ? `${shortDay(dateInZone(snapshot, timeZone), true).replace(/^\S+ /, '')}, ${timeIn(snapshot, timeZone)}` : '…'
  return <Box component="section" aria-labelledby="caratula" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
    <Typography component="h2" id="caratula" sx={heading}>Carátula del expediente <Box component="span" sx={{ fontSize: 13, fontWeight: 500, color: color.muted }}>· resume lo que trae el ZIP</Box></Typography>
    <ReportSheet title="Carátula del expediente" paper={paper} onPaper={setPaper}>
      <SheetHeader company={me.tenant!.name} title="Expediente de la empresa" lines={[
        `Formato ${manifest.formatVersion} · corte al ${when}, hora de la empresa`,
        `Solicitado por ${me.displayName}`,
      ]} />
      <table>
        <thead><tr><th scope="col">Sección</th><th scope="col" className="num">Registros</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.label}><td>{row.label}</td><td className="num">{row.value}</td></tr>)}</tbody>
      </table>
      <Box sx={{ mt: '12pt', fontSize: '8.5pt' }}>
        <div><strong>Huella del manifiesto (SHA-256)</strong></div>
        <Box sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{record.manifestSha256}</Box>
        <Box sx={{ mt: '4pt' }}><strong>Huella del ZIP (SHA-256)</strong></Box>
        <Box sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{record.fileSha256}</Box>
      </Box>
      <Box sx={{ mt: '12pt', fontSize: '7.5pt', color: '#5E6E89' }}>La copia completa va en el ZIP; esta carátula la resume.</Box>
    </ReportSheet>
    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}><Button variant="outlined" onClick={printSheet}>Imprimir carátula<Box component="span" sx={visuallyHidden}> del expediente</Box></Button></Box>
  </Box>
}

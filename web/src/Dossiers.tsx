import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Stack, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiDownload, ApiError, type Me } from './api'
import { auth, identityBase } from './auth'
import { ErrorNotice } from './Directory'
import { saveFile } from './Exports'
import { showTime } from './incidentModel'
import { clearDossierVerification, dossierPkce, pendingVerification, prepareDossierRedirect, takeDossierVerification, verificationReturned, type Challenge } from './dossierFlow'

export type Dossier = { id: string; status: 'queued' | 'preparing' | 'ready' | 'failed' | 'expired' | 'downloaded'; expiresAt: string; manifestSha256: string | null; fileSha256: string | null }
const statuses = { queued: 'En cola', preparing: 'Preparando', ready: 'Listo', failed: 'Falló la preparación', expired: 'Vencido', downloaded: 'Descarga consumida' }
export function dossierOwner(me: Me) { return `${me.userId}:${auth.tokenParsed?.sub || ''}` }
export function dossierPermissionKey(me: Me) { return ['dossier-permission', dossierOwner(me)] }

export function Dossiers({ me }: { me: Me }) {
  const cache = useQueryClient()
  const owner = dossierOwner(me)
  const current = useRef(owner); current.current = owner
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [key, setKey] = useState(() => crypto.randomUUID())
  const [id, setId] = useState(() => pendingVerification()?.dossierId || '')
  const [returned, setReturned] = useState(verificationReturned)
  const [message, setMessage] = useState('')
  const permission = useQuery({ queryKey: dossierPermissionKey(me), queryFn: () => api<{ enabled: boolean }>('/me/dossier-permission'), retry: false })
  const record = useQuery({ queryKey: ['dossier', owner, id], queryFn: () => api<Dossier>(`/dossiers/${id}`), enabled: !!id && permission.data?.enabled === true, retry: false,
    refetchInterval: query => query.state.error ? false : ['queued', 'preparing'].includes(query.state.data?.status || '') ? 3000 : false })
  function checkAccount() { if (!mounted.current || current.current !== owner || dossierOwner(me) !== owner) throw new Error('La cuenta cambió. Inicia otra solicitud.') }
  const request = useMutation({ mutationFn: () => api<Dossier>('/dossiers', 'POST', { formatVersion: 1 }, key), onSuccess: value => {
    checkAccount(); clearDossierVerification(); setReturned(false); setMessage(''); setId(value.id); setKey(crypto.randomUUID()); cache.setQueryData(['dossier', owner, value.id], value)
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
    saveFile(file.blob, file.filename); setMessage('El expediente se descargó. Conserva también las huellas y el manifiesto.'); window.history.replaceState(null, '', '/')
  }, onSettled: () => { if (mounted.current) void record.refetch() } })
  const manifest = useMutation({ mutationFn: async () => { const file = await apiDownload(`/dossiers/${id}/manifest`); checkAccount(); saveFile(file.blob, `expediente-${id}-manifest.json`) } })
  const error = request.error || record.error || verify.error || download.error || manifest.error
  useEffect(() => {
    if (error instanceof ApiError && [401, 403].includes(error.status)) { clearDossierVerification(); setReturned(false); void cache.invalidateQueries({ queryKey: dossierPermissionKey(me) }); void cache.invalidateQueries({ queryKey: ['me'] }) }
  }, [error, cache, me])
  if (permission.isPending) return <Typography role="status">Consultando permiso del expediente…</Typography>
  if (permission.isError) return <><ErrorNotice error={permission.error} /><Button onClick={() => void permission.refetch()}>Reintentar permiso</Button></>
  if (!permission.data?.enabled) return <Alert severity="info">Tu cuenta no tiene permiso para obtener el expediente empresarial.</Alert>
  const busy = request.isPending || verify.isPending || download.isPending || manifest.isPending
  return <Stack spacing={2}>
    <Typography variant="h5">Expediente empresarial</Typography>
    <Alert severity="info">Incluye todos los datos conservados de tu empresa, sus versiones e instrucciones de consulta. El archivo vence a las 24 horas. Cada descarga exige una verificación nueva con OTP.</Alert>
    <Button variant="contained" disabled={busy} onClick={() => request.mutate()}>{request.isPending ? 'Solicitando…' : 'Solicitar expediente'}</Button>
    {id && <>
      <Typography sx={{ overflowWrap: 'anywhere' }}>ID del expediente: {id}</Typography>
      <Button disabled={busy || record.isFetching} onClick={() => void record.refetch()}>Actualizar expediente</Button>
      {record.data && <>
        <Typography role="status">{statuses[record.data.status]}</Typography>
        <Typography>Vencimiento: {showTime(record.data.expiresAt, me.tenant!.timeZone)}</Typography>
        {record.data.status === 'ready' && <>
          <Button variant="contained" disabled={busy} onClick={() => verify.mutate()}>{verify.isPending ? 'Abriendo verificación…' : 'Verificar identidad para descargar'}</Button>
          {returned && <Button variant="contained" disabled={busy} onClick={() => download.mutate()}>{download.isPending ? 'Descargando…' : 'Continuar con la descarga verificada'}</Button>}
        </>}
        {['failed', 'expired', 'downloaded'].includes(record.data.status) && <Alert severity="info">Para obtener otro archivo, solicita un nuevo expediente y verifica tu identidad otra vez.</Alert>}
        {record.data.manifestSha256 && <>
          <Typography sx={{ overflowWrap: 'anywhere' }}>SHA-256 del manifiesto: {record.data.manifestSha256}</Typography>
          <Typography sx={{ overflowWrap: 'anywhere' }}>SHA-256 del ZIP: {record.data.fileSha256}</Typography>
          <Button disabled={busy} onClick={() => manifest.mutate()}>Guardar manifiesto del expediente</Button>
        </>}
      </>}
      {record.isError && <Alert severity="warning">La consulta automática se detuvo. Actualiza el estado para reintentar.</Alert>}
    </>}
    <Alert severity="warning">Si se interrumpe la descarga, el archivo puede quedar incompleto y la autorización ya estará consumida: solicita otro expediente. Descargar no autoriza borrar datos ni purgar el teléfono.</Alert>
    <ErrorNotice error={error} />
    {message && <Alert severity="success">{message}</Alert>}
    {returned && <Button disabled={busy} onClick={() => { clearDossierVerification(); setReturned(false); setMessage('Verificación descartada. Puedes iniciar otra.') }}>Descartar verificación</Button>}
  </Stack>
}

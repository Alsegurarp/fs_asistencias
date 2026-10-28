import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Stack, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiDownload, ApiError, permissions, type Me } from './api'
import { EntitySelect, ErrorNotice } from './Directory'
import { dateInZone, showTime } from './incidentModel'

export type ExportRecord = { id: string; status: 'queued' | 'ready' | 'expired' | 'failed'; weekStart: string; rowCount: number | null; expiresAt: string | null; fileHash: string | null }
const statuses = { queued: 'Preparando', ready: 'Listo', expired: 'No disponible (usado o vencido)', failed: 'Fallido' }

export function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = filename
  document.body.append(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function Exports({ me }: { me: Me }) {
  const cache = useQueryClient()
  const [week, setWeek] = useState(dateInZone(new Date(Date.now() - 7 * 86_400_000).toISOString(), me.tenant!.timeZone))
  const [site, setSite] = useState('')
  const [key, setKey] = useState(() => crypto.randomUUID())
  const [id, setId] = useState('')
  const request = useMutation({ mutationFn: () => api<ExportRecord>('/exports', 'POST', { weekStart: week, format: 'csv', ...(site ? { siteId: site } : {}) }, key), onSuccess: record => { cache.setQueryData(['export', record.id], record); setId(record.id); setKey(crypto.randomUUID()); download.reset(); manifest.reset() } })
  const detail = useQuery({ queryKey: ['export', id], queryFn: () => api<ExportRecord>(`/exports/${id}`), enabled: !!id, retry: false,
    refetchInterval: query => query.state.error ? false : query.state.data?.status === 'queued' ? 5000 : false })
  const download = useMutation({ mutationFn: () => apiDownload(`/exports/${id}/download`), onSuccess: ({ blob, filename }) => { saveFile(blob, filename); void detail.refetch() }, onError: () => { void detail.refetch() } })
  const manifest = useMutation({ mutationFn: () => apiDownload(`/exports/${id}/manifest`), onSuccess: ({ blob }) => saveFile(blob, `zenit-${id}-manifest.json`) })
  useEffect(() => { if ([request.error, detail.error, download.error, manifest.error].some(error => error instanceof ApiError && error.status === 403)) void cache.invalidateQueries({ queryKey: ['me'] }) }, [request.error, detail.error, download.error, manifest.error, cache])
  if (!permissions(me.roles).exports) return <Alert severity="info">Tu rol no permite exportar.</Alert>
  const busy = request.isPending || download.isPending || manifest.isPending
  function submit(event: FormEvent) { event.preventDefault(); if (!busy) request.mutate() }
  return <Stack spacing={2}>
    <Typography variant="h5">Exportes de cierres semanales</Typography>
    <Alert severity="info">El CSV contiene los cierres vigentes de la semana. Cada archivo se descarga una sola vez y vence a los 15 minutos; para descargarlo de nuevo, solicita otro exporte.</Alert>
    <form onSubmit={submit}><Stack spacing={2}>
      <TextField name="exportWeek" label="Fecha de la semana" type="date" value={week} required disabled={busy} onChange={event => { setWeek(event.target.value); setKey(crypto.randomUUID()) }} slotProps={{ inputLabel: { shrink: true } }} />
      <EntitySelect kind="sites" name="exportSite" label="Sede (opcional)" value={site} disabled={busy} onChange={value => { setSite(value); setKey(crypto.randomUUID()) }} />
      <Button type="submit" variant="contained" disabled={busy}>{request.isPending ? 'Solicitando…' : 'Solicitar CSV'}</Button>
      <ErrorNotice error={request.error} />
    </Stack></form>
    {id && <>
      <Typography>ID del exporte: {id}</Typography>
      <ErrorNotice error={detail.error} />
      {detail.isError && <Alert severity="warning">La consulta automática está pausada.</Alert>}
      <Button disabled={busy || detail.isFetching} onClick={() => void detail.refetch()}>Actualizar estado</Button>
      {detail.data && <>
        <Typography role="status">{statuses[detail.data.status]} · Semana {detail.data.weekStart}{detail.data.rowCount !== null && ` · ${detail.data.rowCount} filas`}</Typography>
        {detail.data.expiresAt && <Typography>Vencimiento: {showTime(detail.data.expiresAt, me.tenant!.timeZone)}</Typography>}
        {detail.data.status === 'queued' && <Typography>Consultando el avance cada 5 segundos…</Typography>}
        {['failed', 'expired'].includes(detail.data.status) && <Alert severity="info">Solicita otro CSV si necesitas un nuevo archivo.</Alert>}
        {detail.data.status === 'ready' && <Button variant="contained" disabled={busy || detail.isError} onClick={() => download.mutate()}>Descargar CSV</Button>}
        {detail.data.fileHash && <><Typography sx={{ overflowWrap: 'anywhere' }}>SHA-256 del archivo: {detail.data.fileHash}</Typography><Button disabled={busy} onClick={() => manifest.mutate()}>Descargar manifiesto</Button></>}
      </>}
      <ErrorNotice error={download.error} /><ErrorNotice error={manifest.error} />
    </>}
  </Stack>
}

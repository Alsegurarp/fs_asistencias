import { useEffect, useState } from 'react'
import { Alert, Button, Checkbox, FormControlLabel, Stack, Table, TableBody, TableCell, TableHead, TableContainer, TableRow, Typography } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, permissions, type Me } from './api'
import { ErrorNotice } from './Directory'

export type ImportResult = { id: string; status: 'ready' | 'applied' | 'failed'; dryRun: boolean; counts: { total: number; accepted: number; rejected: number }; errors: { row: number; externalId: string | null; code: string; message: string }[]; manifestHash: string | null }

export function Imports({ me }: { me: Me }) {
  const cache = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [keys, setKeys] = useState(() => ({ validate: crypto.randomUUID(), apply: crypto.randomUUID() }))
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const upload = useMutation({ mutationFn: (dryRun: boolean) => {
    const body = new FormData(); body.append('file', file!); body.append('dryRun', String(dryRun))
    return api<ImportResult>('/imports/csv', 'POST', body, dryRun ? keys.validate : keys.apply)
  }, onSuccess: async row => {
    if (row.dryRun) { setPreview(row); setConfirmed(false) } else { setResult(row); if (row.status === 'applied') await cache.invalidateQueries({ queryKey: ['employees'] }) }
  }, onError: error => { if (error instanceof ApiError && error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) } })
  useEffect(() => { if (!permissions(me.roles).imports) { setFile(null); setPreview(null); setResult(null) } }, [me.roles])
  if (!permissions(me.roles).imports) return <Alert severity="info">Sólo administración y RH pueden importar empleados.</Alert>
  function selectFile(selected: File | null) {
    upload.reset(); setError(null); setPreview(null); setResult(null); setConfirmed(false); setKeys({ validate: crypto.randomUUID(), apply: crypto.randomUUID() }); setFile(null)
    if (!selected) return
    if (!selected.size || selected.size > 1024 * 1024) { setError(new Error('Selecciona un archivo con contenido de hasta 1 MB.')); return }
    setFile(selected)
  }
  const summary = result || preview
  const canApply = preview?.status === 'ready' && preview.counts.accepted > 0 && confirmed && !result && !upload.isPending
  return <Stack spacing={2}>
    <Typography variant="h5">Importación de empleados</Typography>
    <Alert severity="info">CSV en UTF-8, hasta 1 MB y 5.000 filas. Primero valida; después confirma la aplicación. Los identificadores existentes actualizan nombre, sede y fecha de alta; no se eliminan empleados ni se cambia su estado.</Alert>
    <Button component="a" href="/plantilla-empleados.csv" download>Descargar CSV de ejemplo</Button>
    <Typography>Encabezados: external_id,display_name,employment_start,site_name. Usa fechas AAAA-MM-DD; la sede es su nombre exacto y debe estar activa. Sin sede en el CSV, el empleado queda sin sede, incluso si ya tenía una.</Typography>
    <Button component="label" variant="outlined" disabled={upload.isPending}>Seleccionar CSV<input aria-label="Archivo CSV" type="file" accept=".csv,text/csv" hidden disabled={upload.isPending} onChange={event => { selectFile(event.target.files?.[0] || null); event.target.value = '' }} /></Button>
    {file && <Typography>Archivo: {file.name} · {file.size} bytes</Typography>}
    <ErrorNotice error={error} /><ErrorNotice error={upload.error} />
    {upload.error && <Alert severity="warning">Si se perdió la respuesta, reintenta la misma operación sin cambiar el archivo: se conserva su clave para evitar duplicados.</Alert>}
    <Button variant="contained" disabled={!file || upload.isPending || !!result} onClick={() => upload.mutate(true)}>{upload.isPending ? 'Procesando…' : 'Validar archivo'}</Button>
    {summary && <>
      <Alert severity={summary.status === 'failed' ? 'error' : summary.counts.rejected ? 'warning' : 'success'}>{summary.dryRun ? 'Validación' : 'Aplicación'}: {summary.counts.total} filas, {summary.counts.accepted} aceptadas y {summary.counts.rejected} rechazadas. {summary.status === 'failed' ? 'El archivo no se puede aplicar.' : summary.dryRun ? 'El padrón todavía no cambió.' : 'Las filas aceptadas se aplicaron al padrón.'}</Alert>
      <Typography>ID del resultado: {summary.id}</Typography>
      {summary.manifestHash && <Typography sx={{ overflowWrap: 'anywhere' }}>Huella del manifiesto: {summary.manifestHash}</Typography>}
      {!!summary.errors.length && <TableContainer><Table aria-label="Errores de importación"><TableHead><TableRow><TableCell>Fila</TableCell><TableCell>Identificador</TableCell><TableCell>Error</TableCell></TableRow></TableHead><TableBody>{summary.errors.map((row, index) => <TableRow key={index}><TableCell>{row.row}</TableCell><TableCell>{row.externalId || 'Sin identificador'}</TableCell><TableCell>{row.message} ({row.code})</TableCell></TableRow>)}</TableBody></Table></TableContainer>}
    </>}
    {preview?.status === 'ready' && !result && <>
      <FormControlLabel label={`Confirmo aplicar ${preview.counts.accepted} filas aceptadas y omitir ${preview.counts.rejected} rechazadas; puede actualizar empleados existentes`} control={<Checkbox name="confirmImport" checked={confirmed} disabled={upload.isPending || !preview.counts.accepted} onChange={(_, value) => setConfirmed(value)} />} />
      <Button variant="contained" disabled={!canApply} onClick={() => { if (canApply) upload.mutate(false) }}>Aplicar filas aceptadas</Button>
    </>}
  </Stack>
}

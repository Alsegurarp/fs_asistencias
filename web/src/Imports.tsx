import { type ReactNode, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Button, Stack, Typography, useMediaQuery } from '@mui/material'
import { api, ApiError, type Me, type Page } from './api'
import { todayIn } from './attendanceModel'
import { color, phoneQuery, shadow } from './design'
import { saveFile } from './Exports'
import { Icon } from './Icons'
import { whenText } from './incidentsView'
import {
  dataRows, errorsCsv, errorsFileName, importAction, type ImportResult, importStatus, maxBytes, plural, shortHash, sizeText,
} from './importsModel'
import { PersonnelHeader } from './Personnel'
import { problemText, refreshPeople } from './personnelData'
import type { Screen, Section } from './sections'
import { Badge, Modal, Note, Pager, Pane, SkeletonRows, tableSx, visuallyHidden } from './ui'

export type { ImportResult } from './importsModel'

type Props = { me: Me; context: string; section: Section; screens: Screen[]; screen: Screen }

const pageSize = 25
/** `?importar=archivo` abre el modal desde el primer paso; `?importar=<id>`, una importación del historial. */
const openParam = 'importar'

/**
 * Importaciones (PAD-09): cada archivo del padrón que se subió, quién y
 * cuándo, cuántas filas entraron y su estado. Desde aquí se abre el modal de
 * importar (PAD-04 a 06) y se aplica una revisión pendiente.
 */
export function Imports(props: Props) {
  const { me } = props
  const timeZone = me.tenant!.timeZone
  const today = todayIn(timeZone)
  const phone = useMediaQuery(phoneQuery)
  const [params, setParams] = useSearchParams()
  const opened = params.get(openParam)
  const [cursors, setCursors] = useState([''])
  const cursor = cursors.at(-1)!
  const opener = useRef<HTMLElement | null>(null)
  const list = useQuery({ queryKey: ['imports', 'historial', cursor], retry: false,
    queryFn: () => api<Page<ImportResult>>(`/imports?limit=${pageSize}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`) })
  const rows = list.data?.items || []

  const open = (value: string, element?: HTMLElement | null) => {
    opener.current = element || null
    setParams(current => { const next = new URLSearchParams(current); next.set(openParam, value); return next })
  }
  const close = () => {
    setParams(current => { const next = new URLSearchParams(current); next.delete(openParam); return next }, { replace: true })
    setTimeout(() => opener.current?.focus(), 0)
  }
  const start = (cursors.length - 1) * pageSize
  const pageText = !rows.length ? '' : cursors.length === 1 && !list.data?.nextCursor ? plural(rows.length, 'importación', 'importaciones')
    : `${start + 1}–${start + rows.length}${list.data?.nextCursor ? ' y más' : ''}`
  const pager = <Pager text={pageText} hasPrevious={cursors.length > 1} hasNext={!!list.data?.nextCursor}
    onPrevious={() => setCursors(cursors.slice(0, -1))} onNext={() => setCursors([...cursors, list.data!.nextCursor!])} />
  const importButton = <Button variant="outlined" onClick={event => open('archivo', event.currentTarget)} startIcon={<Icon name="upload" size={18} />} sx={{ minHeight: 40, flex: 'none' }}>Importar CSV</Button>

  const failure = list.isError
    ? <Box sx={{ p: 2 }}><Note tone="error">{problemText(list.error, 'No pudimos cargar las importaciones.')} <Box component="button" type="button" onClick={() => void list.refetch()} sx={linkButton}>Reintentar</Box></Note></Box>
    : null
  const empty = <Stack spacing={1} sx={{ p: 4, alignItems: 'center', textAlign: 'center' }}>
    <Typography sx={{ fontWeight: 600 }}>Todavía no hay importaciones</Typography>
    <Typography sx={{ fontSize: 13, color: color.muted, maxWidth: 440 }}>Sube el padrón en un CSV con la plantilla: primero lo revisamos sin cambiar nada y tú decides si se aplica.</Typography>
  </Stack>

  return <>
    <PersonnelHeader {...props} />
    <Box sx={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 1.5, p: '10px 14px', background: color.white, borderRadius: '14px', boxShadow: shadow.card, fontSize: 13, color: color.muted,
      [`@media ${phoneQuery}`]: { flexDirection: 'column', alignItems: 'stretch' } }}>
      <Box component="span" sx={{ flex: 1 }}>Cada archivo se revisa antes de aplicarse; nada cambia hasta que alguien lo aplica.</Box>
      {importButton}
    </Box>
    {phone ? <PhoneHistory rows={rows} loading={list.isPending} failure={failure} empty={empty} pager={pager} today={today} timeZone={timeZone} onOpen={open} />
      : <Pane titleId="importaciones-tabla" title={list.isPending ? 'Cargando importaciones…' : plural(rows.length, 'importación', 'importaciones') + (list.data?.nextCursor ? ' en esta página' : '')} footer={rows.length ? pager : undefined}>
        {list.isPending && <Typography role="status" sx={visuallyHidden}>Cargando importaciones…</Typography>}
        {failure || (!list.isPending && !rows.length ? empty
          : <Box sx={{ overflowX: 'auto' }}><Box component="table" sx={tableSx}>
            <thead><tr><th scope="col">Archivo</th><th scope="col">Subió</th><th scope="col">Cuándo</th><th scope="col">Filas</th><th scope="col">Listas</th><th scope="col">Con error</th><th scope="col">Estado</th><th scope="col"><Box component="span" sx={visuallyHidden}>Acción</Box></th></tr></thead>
            <tbody>
              {list.isPending ? <SkeletonRows columns={8} rows={4} /> : rows.map(row => {
                const status = importStatus(row)
                const action = importAction(row)
                return <tr key={row.id}>
                  <Box component="td" sx={{ overflowWrap: 'anywhere' }}><strong>{fileLabel(row)}</strong></Box>
                  <td>{row.createdByName || '—'}</td>
                  <td>{row.createdAt ? whenText(row.createdAt, timeZone, today) : '—'}</td>
                  <td>{row.counts.total}</td>
                  <td>{row.counts.accepted}</td>
                  <Box component="td" sx={{ color: row.counts.rejected ? color.error : undefined, fontWeight: row.counts.rejected ? 600 : undefined }}>{row.counts.rejected}</Box>
                  <td><Badge tone={status.tone}>{status.label}</Badge></td>
                  <Box component="td" sx={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {action && <Box component="a" href={`?${openParam}=${row.id}`} aria-label={`${action}: ${fileLabel(row)}`} onClick={(event: React.MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); open(row.id, event.currentTarget) }} sx={linkText}>{action}</Box>}
                  </Box>
                </tr>
              })}
            </tbody>
          </Box></Box>)}
      </Pane>}
    {opened && <ImportModal key={opened} me={me} importId={opened === 'archivo' ? null : opened} onClose={close} />}
  </>
}

const linkText = { color: `${color.link} !important`, fontSize: 13, fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } } as const
const linkButton = { ...linkText, p: 0, border: 0, background: 'none', cursor: 'pointer', font: 'inherit', fontWeight: 600 } as const

function fileLabel(row: Pick<ImportResult, 'fileName'>) { return row.fileName || 'Archivo sin nombre' }

function PhoneHistory({ rows, loading, failure, empty, pager, today, timeZone, onOpen }: {
  rows: ImportResult[]; loading: boolean; failure: ReactNode; empty: ReactNode; pager: ReactNode; today: string; timeZone: string; onOpen: (id: string, element: HTMLElement) => void
}) {
  const card = { background: color.white, borderRadius: '18px', boxShadow: shadow.card } as const
  if (failure) return <Box sx={card}>{failure}</Box>
  if (loading) return <Typography role="status" sx={{ fontSize: 14, color: color.muted, p: 2 }}>Cargando importaciones…</Typography>
  if (!rows.length) return <Box sx={card}>{empty}</Box>
  return <Box component="section" aria-label="Importaciones" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {rows.map(row => {
        const status = importStatus(row)
        const action = importAction(row)
        return <Box component="li" key={row.id} sx={{ ...card, p: '12px 14px', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
            <Box component="strong" sx={{ fontSize: 15, minWidth: 0, overflowWrap: 'anywhere' }}>{fileLabel(row)}</Box>
            <Badge tone={status.tone}>{status.label}</Badge>
          </Stack>
          <Box component="span" sx={{ fontSize: 12, color: color.muted }}>
            {[row.createdByName, row.createdAt && whenText(row.createdAt, timeZone, today), `${row.counts.total} filas`, `${row.counts.accepted} listas`, `${row.counts.rejected} con error`].filter(Boolean).join(' · ')}
          </Box>
          {action && <Box component="a" href={`?${openParam}=${row.id}`} aria-label={`${action}: ${fileLabel(row)}`} onClick={(event: React.MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); onOpen(row.id, event.currentTarget) }}
            sx={{ ...linkText, alignSelf: 'flex-start', minHeight: 32, display: 'inline-flex', alignItems: 'center' }}>{action}</Box>}
        </Box>
      })}
    </Box>
    <Box sx={card}>{pager}</Box>
  </Box>
}

type Picked = { file: File; rows: number | null }
const newKeys = () => ({ review: crypto.randomUUID(), apply: crypto.randomUUID() })

/**
 * Importar el padrón (PAD-04 a 06): subir el archivo, revisarlo sin cambiar
 * nada y aplicar las filas listas. El servidor no guarda el archivo: para
 * aplicar una revisión del historial hay que elegirlo otra vez, y el
 * servidor confirma que es el mismo por su huella.
 */
function ImportModal({ me, importId, onClose }: { me: Me; importId: string | null; onClose: () => void }) {
  const cache = useQueryClient()
  const timeZone = me.tenant!.timeZone
  const existing = useQuery({ queryKey: ['import', importId], enabled: !!importId, retry: false, queryFn: () => api<ImportResult>(`/imports/${importId}`) })
  // `undefined` mientras se muestra la importación del historial; `null` al volver a subir un archivo.
  const [shown, setShown] = useState<ImportResult | null | undefined>(undefined)
  const [picked, setPicked] = useState<Picked | null>(null)
  const [fileError, setFileError] = useState('')
  // Cada archivo lleva sus claves: reintentar tras perder la respuesta no duplica nada.
  const [keys, setKeys] = useState(newKeys)
  const current = shown === undefined ? (existing.data ?? null) : shown

  const send = useMutation({
    mutationFn: ({ dryRun, reviewedImportId }: { dryRun: boolean; reviewedImportId?: string }) => {
      const body = new FormData()
      body.append('file', picked!.file)
      body.append('dryRun', String(dryRun))
      if (reviewedImportId) body.append('reviewedImportId', reviewedImportId)
      return api<ImportResult>('/imports/csv', 'POST', body, dryRun ? keys.review : keys.apply)
    },
    onSuccess: row => {
      setShown(row)
      void cache.invalidateQueries({ queryKey: ['imports'] })
      if (row.status === 'applied') {
        refreshPeople(cache)
        for (const key of ['checkpoints', 'audit-log']) void cache.invalidateQueries({ queryKey: [key] })
      }
    },
    onError: error => { if (error instanceof ApiError && error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) },
  })

  async function pick(file: File | undefined) {
    send.reset(); setFileError(''); setPicked(null); setKeys(newKeys())
    if (!file) return
    if (!file.size || file.size > maxBytes) { setFileError('Elige un archivo con contenido, de hasta 1 MB.'); return }
    const text = typeof file.text === 'function' ? await file.text().catch(() => null) : null
    setPicked({ file, rows: text === null ? null : dataRows(text) })
  }
  function restart() { send.reset(); setShown(null); setPicked(null); setFileError(''); setKeys(newKeys()) }

  const step = !current ? 1 : current.status === 'applied' ? 3 : 2
  const fileName = current?.fileName || picked?.file.name
  // Una revisión sin aplicar del historial se aplica con el mismo archivo, elegido otra vez.
  const pendingReview = current?.status === 'ready' && current.dryRun && !current.appliedByImportId ? current : null
  const needsFile = !!pendingReview && !picked
  const error = fileError ? <Note tone="error">{fileError}</Note>
    : send.error ? <Stack spacing={1}>
      <Note tone="error">{reviewError(send.error)}</Note>
      {!(send.error instanceof ApiError && send.error.status < 500) && <Note tone="warn">Si se perdió la respuesta, vuelve a intentarlo sin cambiar el archivo: no se aplica dos veces.</Note>}
    </Stack> : undefined

  function submit() {
    if (step === 1) { if (picked) send.mutate({ dryRun: true }) } else if (step === 2) { if (pendingReview && picked && pendingReview.counts.accepted > 0) send.mutate({ dryRun: false, reviewedImportId: pendingReview.id }) } else onClose()
  }

  const busy = send.isPending
  const actions = step === 1 ? <>
    <Button variant="outlined" onClick={onClose} disabled={busy}>Cancelar</Button>
    <Button variant="contained" type="submit" disabled={busy || !picked} sx={{ px: 3 }}>{busy ? 'Revisando…' : 'Revisar archivo'}</Button>
  </> : step === 2 ? <>
    <Button variant="outlined" onClick={restart} disabled={busy}>Subir otro archivo</Button>
    {pendingReview && pendingReview.counts.accepted > 0 && <Button variant="contained" type="submit" disabled={busy || needsFile} sx={{ px: 3 }}>{busy ? 'Aplicando…' : `Aplicar ${plural(pendingReview.counts.accepted, 'fila', 'filas')}`}</Button>}
    {(!pendingReview || !pendingReview.counts.accepted) && <Button variant="contained" onClick={onClose}>Cerrar</Button>}
  </> : <>
    {!!current?.errors.length && <Button variant="outlined" startIcon={<Icon name="download" size={18} />} onClick={() => downloadErrors(current)}>Descargar errores</Button>}
    <Button variant="contained" type="submit" sx={{ px: 3 }}>Listo</Button>
  </>

  return <Modal id="importar-titulo" icon="upload" title="Importar el padrón" subtitle={step === 1 ? 'Desde un archivo CSV' : fileName || 'Archivo sin nombre'}
    onClose={onClose} onSubmit={submit} busy={busy} error={error} actions={actions} closable wide>
    <Steps current={step} />
    {importId && existing.isPending && shown === undefined ? <Typography role="status" sx={{ fontSize: 14, color: color.muted }}>Cargando la importación…</Typography>
      : importId && existing.isError && shown === undefined ? <Note tone="error">{problemText(existing.error, 'No encontramos esa importación.')}</Note>
        : step === 1 ? <UploadStep picked={picked} busy={busy} onPick={pick} />
          : step === 2 ? <ReviewStep result={current!} picked={shown === undefined ? picked : null} needsFile={needsFile} busy={busy} onPick={pick} />
            : <AppliedStep result={current!} timeZone={timeZone} />}
  </Modal>
}

function reviewError(error: Error) {
  if (error instanceof ApiError) {
    if (error.code === 'review_mismatch') return 'Ese no es el archivo que se revisó: su contenido cambió. Sube el archivo de nuevo para revisarlo otra vez.'
    if (error.code === 'review_already_applied') return 'Alguien ya aplicó esta revisión. Cierra y revisa el historial.'
    if (error.status === 403) return 'Tu cuenta ya no puede importar el padrón.'
  }
  return problemText(error, 'No pudimos procesar el archivo.')
}

function downloadErrors(result: ImportResult) {
  saveFile(new Blob([errorsCsv(result)], { type: 'text/csv;charset=utf-8' }), errorsFileName(result))
}

function Steps({ current }: { current: number }) {
  const names = ['Subir archivo', 'Revisar', 'Aplicar']
  return <Box component="ol" aria-label="Pasos" sx={{ display: 'flex', alignItems: 'center', gap: 1, listStyle: 'none', m: 0, p: 0, fontSize: 13, fontWeight: 600, color: color.muted, flexWrap: 'wrap' }}>
    {names.map((name, index) => {
      const number = index + 1
      const done = number < current || current === 3
      const active = number === current && current !== 3
      return <Box component="li" key={name} aria-current={active ? 'step' : undefined} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: active || done ? color.ink : color.muted,
        '&:not(:last-of-type)::after': { content: '""', display: 'block', width: 28, height: '1px', background: color.field, ml: 0.5 } }}>
        <Box component="span" aria-hidden="true" sx={{ width: 24, height: 24, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
          background: done ? color.okBg : active ? color.accent : color.lineSoft, color: done ? color.ok : active ? color.white : color.muted }}>{done ? '✓' : number}</Box>
        {name}{done && <Box component="span" sx={visuallyHidden}> (hecho)</Box>}
      </Box>
    })}
  </Box>
}

function FilePicker({ busy, onPick, title, detail }: { busy: boolean; onPick: (file: File | undefined) => void; title: string; detail: ReactNode }) {
  const [over, setOver] = useState(false)
  return <Box component="label" onDragOver={(event: React.DragEvent) => { event.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
    onDrop={(event: React.DragEvent) => { event.preventDefault(); setOver(false); if (!busy) void onPick(event.dataTransfer.files[0]) }}
    sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 0.75, p: '26px 16px', borderRadius: '16px', cursor: busy ? 'default' : 'pointer',
      border: `1.5px dashed ${over ? color.accent : color.field}`, background: over ? color.selected : color.page, color: color.muted, fontSize: 13,
      '&:hover': { borderColor: color.accent }, '&:focus-within': { outline: `2px solid ${color.accent}`, outlineOffset: 2 } }}>
    <Box component="span" aria-hidden="true" sx={{ width: 44, height: 44, borderRadius: '12px', background: color.tile, color: color.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="upload" size={24} /></Box>
    <Box component="strong" sx={{ fontSize: 15, color: color.ink }}>{title}</Box>
    <span>{detail}</span>
    <Box component="input" type="file" accept=".csv,text/csv" aria-label="Archivo CSV" disabled={busy} sx={visuallyHidden}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => { void onPick(event.target.files?.[0]); event.target.value = '' }} />
  </Box>
}

function PickedFile({ picked, busy, onRemove }: { picked: Picked; busy: boolean; onRemove: () => void }) {
  return <Stack direction="row" sx={{ alignItems: 'center', gap: 1, p: '10px 12px', borderRadius: '12px', border: `1px solid ${color.line}`, fontSize: 13, color: color.muted }}>
    <Box sx={{ color: color.accent, display: 'flex' }}><Icon name="list" size={18} /></Box>
    <Box component="span" sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
      <Box component="strong" sx={{ color: color.ink }}>{picked.file.name}</Box>{picked.rows !== null && ` · ${plural(picked.rows, 'fila', 'filas')}`} · {sizeText(picked.file.size)}
    </Box>
    <Box component="button" type="button" disabled={busy} onClick={onRemove} sx={{ ...linkButton, minHeight: 32 }}>Quitar</Box>
  </Stack>
}

function UploadStep({ picked, busy, onPick }: { picked: Picked | null; busy: boolean; onPick: (file: File | undefined) => void }) {
  return <>
    {picked ? <PickedFile picked={picked} busy={busy} onRemove={() => void onPick(undefined)} />
      : <FilePicker busy={busy} onPick={onPick} title="Arrastra tu archivo o elígelo" detail="CSV con la plantilla versión 1: número, nombre, fecha de ingreso y sede" />}
    <Note>
      Primero lo revisamos sin cambiar nada; tú decides si se aplica. <Box component="a" href="/plantilla-empleados.csv" download sx={linkText}>Descargar la plantilla</Box>
      <Box component="span" sx={{ display: 'block', mt: 0.5 }}>Encabezados <code>external_id,display_name,employment_start,site_name</code>; la fecha va como AAAA-MM-DD y la sede con su nombre. Una fila con la sede vacía deja a esa persona sin sede. Hasta 1 MB y 5000 filas.</Box>
    </Note>
  </>
}

function Figures({ items }: { items: { value: number; label: string; tone?: 'error' | 'ok' }[] }) {
  return <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, gap: 1, m: 0, [`@media ${phoneQuery}`]: { gridTemplateColumns: `repeat(${items.length === 3 ? 3 : 2}, minmax(0, 1fr))` } }}>
    {items.map(item => <Box key={item.label} sx={{ display: 'flex', flexDirection: 'column-reverse', p: '10px 12px', borderRadius: '12px', background: item.tone === 'error' ? color.errorBg : item.tone === 'ok' ? color.okBg : color.page }}>
      <Box component="dt" sx={{ fontSize: 12.5, color: item.tone === 'error' ? color.error : color.muted }}>{item.label}</Box>
      <Box component="dd" sx={{ m: 0, fontSize: 22, fontWeight: 700, color: item.tone === 'error' ? color.error : item.tone === 'ok' ? color.ok : color.ink }}>{item.value}</Box>
    </Box>)}
  </Box>
}

const shownErrors = 100

function ErrorTable({ result }: { result: ImportResult }) {
  if (!result.errors.length) return null
  const rows = result.errors.slice(0, shownErrors)
  return <Box sx={{ maxHeight: 260, overflow: 'auto', border: `1px solid ${color.line}`, borderRadius: '12px' }}>
    <Box component="table" aria-label="Filas con error" sx={{ ...tableSx, '& td:last-of-type': { whiteSpace: 'normal', minWidth: 160 } }}>
      <thead><tr><th scope="col">Fila</th><th scope="col">Número</th><th scope="col">Qué pasa</th></tr></thead>
      <tbody>{rows.map(item => <tr key={`${item.row}-${item.code}`}><td>{item.row}</td><td>{item.externalId || '—'}</td><td>{item.message}</td></tr>)}</tbody>
    </Box>
    {result.errors.length > shownErrors && <Typography sx={{ p: '8px 12px', fontSize: 12.5, color: color.muted }}>Y {plural(result.errors.length - shownErrors, 'fila más', 'filas más')}: descarga los errores para verlas todas.</Typography>}
  </Box>
}

/** `picked` es el archivo elegido otra vez para aplicar una revisión del historial. */
function ReviewStep({ result, picked, needsFile, busy, onPick }: { result: ImportResult; picked: Picked | null; needsFile: boolean; busy: boolean; onPick: (file: File | undefined) => void }) {
  if (result.status === 'failed') return <>
    <Note tone="error">El archivo no se puede aplicar: no entró ninguna fila. {result.errors[0]?.message}</Note>
    <Typography sx={{ fontSize: 13, color: color.muted }}>Revisa que sea la plantilla, en UTF-8, y súbelo de nuevo. <Box component="a" href="/plantilla-empleados.csv" download sx={linkText}>Descargar la plantilla</Box></Typography>
  </>
  const { total, accepted, rejected } = result.counts
  const applied = !!result.appliedByImportId
  return <>
    <Figures items={[{ value: total, label: 'filas' }, { value: accepted, label: 'listas para aplicar', tone: 'ok' }, { value: rejected, label: 'con error', tone: rejected ? 'error' : undefined }]} />
    <ErrorTable result={result} />
    {applied ? <Note>Esta revisión ya se aplicó.</Note>
      : !accepted ? <Note tone="warn">Ninguna fila está lista. Corrige el archivo y vuelve a subirlo.</Note>
        : <Note>
          {rejected ? `Las filas con error no se aplican. Corrígelas y vuelve a subir el archivo, o aplica sólo ${accepted === 1 ? 'la fila lista' : `las ${accepted} listas`}.` : 'Nada cambia en el padrón hasta que lo apliques.'}
          {!!result.errors.length && <> <Box component="button" type="button" onClick={() => downloadErrors(result)} sx={linkButton}>Descargar errores</Box></>}
        </Note>}
    {!applied && !!accepted && (needsFile ? <FilePicker busy={busy} onPick={onPick} title={`Elige otra vez ${result.fileName || 'el archivo'}`} detail="No guardamos el archivo: para aplicar esta revisión hay que elegirlo de nuevo, y comprobamos que sea el mismo." />
      : picked && <PickedFile picked={picked} busy={busy} onRemove={() => void onPick(undefined)} />)}
  </>
}

function AppliedStep({ result, timeZone }: { result: ImportResult; timeZone: string }) {
  const { accepted, rejected, created, updated, unchanged } = result.counts
  const today = todayIn(timeZone)
  const detailed = typeof created === 'number' && typeof updated === 'number' && typeof unchanged === 'number'
  return <>
    <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, p: '12px 14px', borderRadius: '14px', background: color.okBg }}>
      <Box aria-hidden="true" sx={{ width: 40, height: 40, flex: 'none', borderRadius: 999, background: color.white, color: color.ok, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={22} /></Box>
      <Box>
        <Typography component="p" role="status" sx={{ fontWeight: 600, color: color.ink }}>{accepted === 1 ? 'Se aplicó 1 fila' : `Se aplicaron ${accepted} filas`}</Typography>
        <Typography sx={{ fontSize: 13, color: color.muted }}>{[result.createdAt && whenText(result.createdAt, timeZone, today), result.createdByName && `por ${result.createdByName}`].filter(Boolean).join(' · ')}</Typography>
      </Box>
    </Stack>
    <Figures items={detailed
      ? [{ value: created, label: created === 1 ? 'alta' : 'altas' }, { value: updated, label: 'con cambios' }, { value: unchanged, label: 'sin cambios' }, { value: rejected, label: 'fuera por error', tone: rejected ? 'error' : undefined }]
      : [{ value: accepted, label: 'aplicadas' }, { value: rejected, label: 'fuera por error', tone: rejected ? 'error' : undefined }]} />
    <ErrorTable result={result} />
    {result.manifestHash && <Typography sx={{ fontSize: 12.5, color: color.muted }}>
      Huella de las filas aplicadas (SHA-256): <Box component="code" title={result.manifestHash} sx={{ fontSize: 12.5, color: color.ink }}>{shortHash(result.manifestHash)}</Box>
      <Box component="span" sx={visuallyHidden}>. Completa: {result.manifestHash}</Box>
    </Typography>}
  </>
}

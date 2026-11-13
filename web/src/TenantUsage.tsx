import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Box, Button, Stack, Typography, useMediaQuery } from '@mui/material'
import { api, type Me, type Page } from './api'
import { color, phoneQuery } from './design'
import { PhoneList } from './Devices'
import { saveFile } from './files'
import { allPages } from './lists'
import { problemText } from './personnelData'
import { PageHeader } from './Shell'
import type { Screen, Section } from './sections'
import { Badge, Note, OutlineButton, Pager, Pane, SearchBox, SkeletonRows, WeekNav, tableSx, visuallyHidden } from './ui'
import { type UsageItem, type UsageSummary, addMonths, capital, consoleZone, count, currentMonth, monthName, usageColumns, usageCsv, validMonth } from './tenantsModel'

type Props = { me: Me; context: string; section: Section; screens: Screen[]; screen: Screen }
const pageSize = 25

/**
 * Uso del mes (CON-04): los conteos de cada empresa para facturar fuera del
 * servicio, con sus totales y su CSV. `?mes=AAAA-MM` elige el mes y `?q=`
 * busca una empresa. Sólo conteos: ningún dato de una persona.
 */
export function TenantUsage({ me, context, section, screens, screen }: Props) {
  const allowed = me.roles.includes('operador_saas')
  const phone = useMediaQuery(phoneQuery)
  const [params, setParams] = useSearchParams()
  const latest = currentMonth(consoleZone)
  const asked = params.get('mes')
  const month = validMonth(asked) && asked <= latest ? asked : latest
  const query = params.get('q') || ''
  const [text, setText] = useState(query)
  const change = (values: Record<string, string | null>) => setParams(current => {
    const next = new URLSearchParams(current)
    for (const [key, value] of Object.entries(values)) if (value) next.set(key, value); else next.delete(key)
    return next
  }, { replace: true })
  useEffect(() => { setText(query) }, [query])
  useEffect(() => {
    const value = text.trim()
    if (value === query) return
    const timer = setTimeout(() => change({ q: value || null }), 300)
    return () => clearTimeout(timer)
  }, [text]) // eslint-disable-line react-hooks/exhaustive-deps

  const scope = `${month}|${query}`
  const [pages, setPages] = useState<{ scope: string; cursors: string[] }>({ scope, cursors: [''] })
  const cursors = pages.scope === scope ? pages.cursors : ['']
  const cursor = cursors.at(-1)!
  const filters = new URLSearchParams({ month })
  if (query) filters.set('q', query)
  const listParams = new URLSearchParams(filters)
  listParams.set('limit', String(pageSize))
  if (cursor) listParams.set('cursor', cursor)
  const list = useQuery({ queryKey: ['tenant-usage', 'page', listParams.toString()], enabled: allowed, retry: false, queryFn: () => api<Page<UsageItem>>(`/tenants/usage?${listParams}`) })
  const totals = useQuery({ queryKey: ['tenant-usage', 'summary', month, query, ''], enabled: allowed, retry: false, queryFn: () => api<UsageSummary>(`/tenants/usage/summary?${filters}`) })
  // El CSV recorre todas las páginas del mes con los mismos filtros de la tabla.
  const exportCsv = useMutation({
    mutationFn: async () => {
      const [items, summary] = await Promise.all([allPages<UsageItem>(`/tenants/usage?${filters}`), api<UsageSummary>(`/tenants/usage/summary?${filters}`)])
      saveFile(new Blob([usageCsv(month, items, summary)], { type: 'text/csv;charset=utf-8' }), `zenit-uso-${month}.csv`)
    },
  })

  if (!allowed) return <>
    <PageHeader context={context} section={section} screens={screens} current={screen} />
    <Note>Sólo quien opera el servicio puede ver el uso de las empresas.</Note>
  </>

  const rows = list.data?.items || []
  const summary = totals.data
  const running = month === latest
  const start = (cursors.length - 1) * pageSize
  const pageText = rows.length ? `${start + 1}–${start + rows.length}${summary ? ` de ${summary.tenants}` : ''}` : ''
  const pager = <Pager text={list.isPending ? '' : pageText} hasPrevious={cursors.length > 1} hasNext={!!list.data?.nextCursor}
    onPrevious={() => setPages({ scope, cursors: cursors.slice(0, -1) })} onNext={() => setPages({ scope, cursors: [...cursors, list.data!.nextCursor!] })} />
  const failure = list.isError ? <Box sx={{ p: 2 }}><Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
    <Note tone="error">{problemText(list.error, 'No pudimos cargar el uso del mes.')}</Note>
    <Button variant="outlined" onClick={() => void list.refetch()}>Reintentar</Button>
  </Stack></Box> : null
  const empty = <Stack spacing={1} sx={{ p: 4, alignItems: 'center', textAlign: 'center' }}>
    <Typography sx={{ fontWeight: 600 }}>{query ? 'Ninguna empresa coincide con la búsqueda' : `Ninguna empresa existía en ${monthName(month, true)}`}</Typography>
  </Stack>
  const company = (item: UsageItem) => <>
    <Box component="strong" sx={{ fontWeight: 600 }}>{item.name}</Box>
    {item.status === 'suspended' && <Box component="span" sx={{ ml: 1 }}><Badge tone="error">Suspendida</Badge></Box>}
  </>
  const clip = { maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' } as const
  const numeric = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } as const

  return <>
    <PageHeader context={context} section={section} screens={screens} current={screen}
      actions={<>
        <WeekNav unit="Mes" label={capital(monthName(month, true))} onPrevious={() => change({ mes: addMonths(month, -1) })} onNext={() => change({ mes: addMonths(month, 1) === latest ? null : addMonths(month, 1) })} nextDisabled={running} />
        <OutlineButton icon="download" onClick={() => exportCsv.mutate()} disabled={exportCsv.isPending || !rows.length}>{exportCsv.isPending ? 'Preparando…' : 'Exportar CSV'}</OutlineButton>
      </>} />
    <Note>El mes se corta con la zona horaria de cada empresa. {running ? `Mientras no termine, los conteos crecen; ${monthName(month)} está en curso.` : summary && summary.complete < summary.tenants ? `${capital(monthName(month))} todavía no termina en todas las zonas.` : `${capital(monthName(month))} ya está completo y no cambia.`}</Note>
    {exportCsv.isError && <Note tone="error">{problemText(exportCsv.error, 'No pudimos preparar el CSV.')}</Note>}
    <Box component="form" aria-label="Filtros" onSubmit={event => { event.preventDefault(); change({ q: text.trim() || null }) }} sx={{ flex: 'none', display: 'flex', minWidth: 0, maxWidth: '100%' }}>
      <SearchBox name="q" label="Buscar empresas" placeholder="Nombre o identificador" value={text} onChange={setText} grow={phone} />
    </Box>
    {phone ? <>
      <PhoneList rows={rows} loading={list.isPending} failure={failure} empty={empty} pager={pager}
        render={item => <>
          <Box sx={{ fontSize: 15, overflowWrap: 'anywhere' }}>{company(item)}</Box>
          <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: '1fr max-content', columnGap: 2, rowGap: 0.25, fontSize: 13 }}>
            {usageColumns.map(column => <Box key={column.key} sx={{ display: 'contents' }}><Box component="dt" sx={{ color: color.muted }}>{column.label}</Box><Box component="dd" sx={{ m: 0, ...numeric }}>{count(item.usage[column.key])}</Box></Box>)}
          </Box>
        </>} />
      {summary && rows.length > 0 && <Box component="section" aria-label="Total del mes" sx={{ background: color.white, borderRadius: '18px', p: '12px 14px' }}>
        <Typography component="h2" sx={{ fontSize: 15, fontWeight: 700, mb: 0.5 }}>Total · {summary.tenants} {summary.tenants === 1 ? 'empresa' : 'empresas'}</Typography>
        <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: '1fr max-content', columnGap: 2, rowGap: 0.25, fontSize: 13 }}>
          {usageColumns.map(column => <Box key={column.key} sx={{ display: 'contents' }}><Box component="dt" sx={{ color: color.muted }}>{column.label}</Box><Box component="dd" sx={{ m: 0, fontWeight: 700, ...numeric }}>{count(summary[column.key])}</Box></Box>)}
        </Box>
      </Box>}
    </>
      : <Pane titleId="uso-tabla" title={list.isPending ? 'Cargando el uso…' : query ? `Resultados de «${query}»` : `Uso de ${monthName(month, true)}`}
        detail={!list.isPending && summary ? `${summary.tenants} ${summary.tenants === 1 ? 'empresa' : 'empresas'}` : undefined} footer={rows.length ? pager : undefined}>
        {list.isPending && <Typography role="status" sx={visuallyHidden}>Cargando el uso…</Typography>}
        {failure || (!list.isPending && !rows.length ? empty
          : <Box component="table" sx={tableSx}>
            <thead><tr><th scope="col">Empresa</th>{usageColumns.map(column => <Box component="th" scope="col" key={column.key} sx={{ textAlign: 'right !important' }}>{column.label}</Box>)}</tr></thead>
            <tbody>
              {list.isPending ? <SkeletonRows columns={6} rows={6} /> : rows.map(item => <tr key={item.id}>
                <Box component="td" sx={clip} title={`${item.name} · ${item.slug}`}>{company(item)}</Box>
                {usageColumns.map(column => <Box component="td" key={column.key} sx={numeric}>{count(item.usage[column.key])}</Box>)}
              </tr>)}
            </tbody>
            {summary && !list.isPending && <tfoot><Box component="tr" sx={{ '& th, & td': { position: 'sticky', bottom: 0, background: `${color.selected} !important`, fontWeight: 700, fontSize: '13px !important', textTransform: 'none !important', letterSpacing: '0 !important', color: `${color.ink} !important`, borderBottom: '0 !important' } }}>
              <th scope="row">Total{summary.tenants > rows.length ? ` de las ${summary.tenants} empresas` : ''}</th>
              {usageColumns.map(column => <Box component="td" key={column.key} sx={numeric}>{count(summary[column.key])}</Box>)}
            </Box></tfoot>}
          </Box>)}
      </Pane>}
    <Typography sx={{ flex: 'none', fontSize: 12.5, color: color.muted }}>Sin datos de personas: sólo conteos. Qué se cobra lo decide el precio, fuera del servicio.</Typography>
  </>
}

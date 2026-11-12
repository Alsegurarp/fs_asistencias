import { type ReactNode, useState } from 'react'
import { createPortal } from 'react-dom'
import { Box, ButtonBase, GlobalStyles, Stack, Typography } from '@mui/material'
import { color, font, gradient, shadow } from './design'
import { Icon } from './Icons'
import { type PaperKey, paperSizes } from './reportsModel'
import { FilterChip, SelectBox, visuallyHidden } from './ui'

/**
 * Hoja de vista previa de un reporte (REP-03, REP-08): el papel a escala con
 * su tamaño y zoom, y la misma hoja en una copia fuera de `#root` que es lo
 * único que se imprime. «Imprimir» y «Descargar PDF» abren el diálogo del
 * navegador, donde se elige la impresora o «Guardar como PDF».
 */
export function ReportSheet({ title, children, paper, onPaper, toolbar }: {
  title: string; children: ReactNode; paper: PaperKey; onPaper: (paper: PaperKey) => void; toolbar?: ReactNode
}) {
  const [zoom, setZoom] = useState(100)
  const size = paperSizes.find(item => item.key === paper)!
  const zoomButton = { width: 32, height: 32, borderRadius: '8px', border: `1px solid ${color.line}`, background: color.white, color: color.link, fontFamily: font, fontSize: 18, '&.Mui-disabled': { color: color.field } } as const
  return <Box component="section" aria-label={`Vista previa: ${title}`} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, background: color.page, borderRadius: '20px', boxShadow: shadow.table, overflow: 'hidden' }}>
    <GlobalStyles styles={{
      '@media screen': { '.zenit-print-root': { display: 'none' } },
      '@media print': {
        '#root': { display: 'none !important' },
        '.zenit-print-root': { display: 'block' },
        body: { background: '#fff' },
      },
      '@page': { size: size.page, margin: '12mm' },
    }} />
    <Stack direction="row" useFlexGap sx={{ flex: 'none', alignItems: 'center', flexWrap: 'wrap', gap: 1, p: '10px 14px', background: color.white, borderBottom: `1px solid ${color.lineSoft}` }}>
      {toolbar}
      <SelectBox name="hoja" label="Hoja" value={paper} onChange={value => onPaper(value as PaperKey)} options={paperSizes.map(item => ({ value: item.key, label: item.label }))} />
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', ml: 'auto' }}>
        <ButtonBase aria-label="Alejar" disabled={zoom <= 50} onClick={() => setZoom(value => value - 10)} sx={zoomButton}>−</ButtonBase>
        <Typography aria-live="polite" sx={{ fontSize: 13, minWidth: 44, textAlign: 'center', color: color.muted }}>{zoom} %</Typography>
        <ButtonBase aria-label="Acercar" disabled={zoom >= 150} onClick={() => setZoom(value => value + 10)} sx={zoomButton}>+</ButtonBase>
      </Stack>
    </Stack>
    <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 2 }}>
      {/* `zoom` cambia también el espacio que ocupa la hoja, a diferencia de `transform`. */}
      <Box sx={{ width: `${size.width}mm`, minHeight: `${size.height}mm`, zoom: zoom / 100, mx: 'auto', boxSizing: 'border-box', p: '12mm',
        background: color.white, boxShadow: '0 2px 10px rgba(18,35,63,0.12)', borderRadius: '4px' }}>
        <Paper>{children}</Paper>
      </Box>
    </Box>
    {createPortal(<Box className="zenit-print-root" aria-hidden="true"><Paper>{children}</Paper></Box>, document.body)}
  </Box>
}

/** Estilos de papel: tipografía, tablas y saltos de página. */
function Paper({ children }: { children: ReactNode }) {
  return <Box sx={{ fontFamily: font, color: '#12233F', fontSize: '9.5pt', lineHeight: 1.4,
    '& h1': { fontSize: '15pt', m: 0, fontWeight: 700 }, '& h2': { fontSize: '11pt', m: '10pt 0 4pt', fontWeight: 700, breakAfter: 'avoid' },
    '& table': { width: '100%', borderCollapse: 'collapse', breakInside: 'auto' }, '& thead': { display: 'table-header-group' }, '& tr': { breakInside: 'avoid' },
    '& th': { textAlign: 'left', fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#5E6E89', borderBottom: '1pt solid #C9D6EC', p: '3pt 5pt', fontWeight: 600 },
    '& td': { borderBottom: '0.5pt solid #E2E8F2', p: '3pt 5pt', fontVariantNumeric: 'tabular-nums' },
    '& .num': { textAlign: 'right' }, '& .muted': { color: '#5E6E89' }, '& .total td': { fontWeight: 700, borderTop: '1pt solid #C9D6EC' } }}>{children}</Box>
}

/** Encabezado de una hoja: empresa, título, periodo y quién lo generó. */
export function SheetHeader({ company, title, lines }: { company: string; title: string; lines: string[] }) {
  return <Box sx={{ borderBottom: '1.5pt solid #1C4A9C', pb: '6pt', mb: '8pt' }}>
    <Box sx={{ fontSize: '8.5pt', color: '#5E6E89', fontWeight: 600 }}>{company}</Box>
    <h1>{title}</h1>
    {lines.map(line => <Box key={line} sx={{ fontSize: '9pt', color: '#4A5A75' }}>{line}</Box>)}
  </Box>
}

/** Cifras grandes de la hoja, como «39 personas incluidas». */
export function SheetFigures({ items }: { items: { value: string; label: string }[] }) {
  return <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '6pt 18pt', mb: '8pt' }}>
    {items.map(item => <Box key={item.label}><Box component="strong" sx={{ fontSize: '13pt', display: 'block' }}>{item.value}</Box><Box component="span" sx={{ fontSize: '8pt', color: '#5E6E89' }}>{item.label}</Box></Box>)}
  </Box>
}

/** «PDF · CSV» como dos opciones de un toque. */
export function FormatSwitch({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: { key: string; label: string }[] }) {
  return <Box role="group" aria-label="Formato" sx={{ display: 'flex', gap: 0.75 }}>
    {options.map(option => <FilterChip key={option.key} pressed={value === option.key} onClick={() => onChange(option.key)}>{option.label}</FilterChip>)}
  </Box>
}

/** Abre el diálogo de impresión; ahí se elige «Guardar como PDF». */
export function printSheet() { window.print() }

/** Los pasos de un asistente de reporte. Sin `onStep`, sólo muestran en cuál va. */
export function Stepper({ steps, step, enabled = false, onStep, phone }: { steps: string[]; step: number; enabled?: boolean; onStep?: (step: number) => void; phone: boolean }) {
  return <Box component="nav" aria-label="Pasos del reporte" sx={{ flex: 'none' }}>
    <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      {steps.map((label, index) => {
        const n = index + 1
        const done = n < step
        const current = n === step
        return <Box component="li" key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ButtonBase component={onStep ? 'button' : 'span'} aria-current={current ? 'step' : undefined} disabled={!onStep || (!current && !done && !enabled)} onClick={() => onStep?.(n)}
            sx={{ display: 'flex', alignItems: 'center', gap: 1, borderRadius: 999, p: '4px 10px 4px 4px', fontFamily: font, '&.Mui-focusVisible': { outline: `2px solid ${color.accent}` } }}>
            <Box aria-hidden="true" sx={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
              color: current || done ? color.white : color.muted, background: current ? gradient.badge : done ? color.ok : color.white, border: current || done ? 0 : `2px solid ${color.field}` }}>{done ? <Icon name="check" size={16} strokeWidth={2.4} /> : n}</Box>
            <Box component="span" sx={{ fontSize: 14, fontWeight: current ? 700 : 600, color: current ? color.ink : done ? color.ok : color.muted, display: phone && !current ? 'none' : undefined }}>
              {label}{done && <Box component="span" sx={visuallyHidden}> (hecho)</Box>}
            </Box>
          </ButtonBase>
          {n < steps.length && <Box aria-hidden="true" sx={{ width: phone ? 16 : 80, height: 2, borderRadius: 2, background: done ? color.ok : color.field }} />}
        </Box>
      })}
    </Box>
  </Box>
}


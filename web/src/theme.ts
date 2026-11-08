import { createTheme } from '@mui/material'
import { color, font, gradient, shadow } from './design'

/**
 * Tema del portal con los valores del lienzo aprobado (design.ts). El primario
 * es el azul de enlaces y botones secundarios; el botón principal lleva el
 * degradado. accessibility.test.ts comprueba el contraste de cada par de texto.
 */
export const theme = createTheme({
  palette: {
    primary: { main: color.link, dark: color.linkHover, light: color.selected, contrastText: color.white },
    secondary: { main: color.deep },
    error: { main: color.error },
    text: { primary: color.ink, secondary: color.muted },
    background: { default: color.page, paper: color.white },
    divider: color.line,
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: font,
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
    h5: { fontWeight: 700, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: { styleOverrides: {
      // Como en el lienzo: el alto mínimo y el ancho incluyen el relleno.
      '*, *::before, *::after': { boxSizing: 'border-box' },
      body: { minWidth: 320 },
      a: { color: color.link },
      'a:hover': { color: color.linkHover },
      '*:focus-visible': { outline: `2px solid ${color.accent}`, outlineOffset: 2 },
    } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 999, minHeight: 42, paddingInline: 16, fontSize: 14,
          variants: [
            { props: { variant: 'contained', color: 'primary' }, style: {
              background: gradient.button, boxShadow: shadow.button,
              '&:hover': { background: gradient.buttonHover, boxShadow: shadow.button },
              '&.Mui-disabled': { background: color.lineSoft, boxShadow: 'none' },
            } },
            { props: { variant: 'outlined' }, style: { borderColor: color.fieldSoft, background: color.white, '&:hover': { borderColor: color.fieldHover, background: color.hover } } },
          ],
        },
      },
    },
    MuiOutlinedInput: { styleOverrides: {
      root: { borderRadius: 12, background: color.white, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: color.accent } },
      notchedOutline: { borderColor: color.fieldSoft },
    } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' }, rounded: { borderRadius: 20 } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 24, boxShadow: shadow.menu } } },
    MuiMenu: { styleOverrides: { paper: { borderRadius: 18, boxShadow: shadow.menu } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 14 } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 999, fontWeight: 600 } } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600, fontSize: 14, minHeight: 44, color: color.muted, '&.Mui-selected': { color: color.deep } } } },
    MuiTabs: { styleOverrides: { indicator: { backgroundColor: color.accent } } },
    MuiTableCell: { styleOverrides: {
      root: { borderBottom: `1px solid ${color.lineSoft}`, fontSize: 13, padding: '9px 12px' },
      head: { fontWeight: 600, color: color.subtle, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', borderBottom: `1px solid ${color.line}`, whiteSpace: 'nowrap', padding: '10px 12px' },
    } },
    MuiTableRow: { styleOverrides: { root: { '.MuiTableBody-root &:hover > td': { background: color.rowHover } } } },
  },
})

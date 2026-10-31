import { createTheme } from '@mui/material'

/**
 * Paleta del portal. El primario lleva texto y botones: conserva contraste AA,
 * que comprueba accessibility.test.ts. El secundario no alcanza 4.5:1 sobre
 * blanco; si se usa, que sea en texto grande o en controles, no en texto normal.
 */
export const theme = createTheme({
  palette: {
    primary: { main: '#176b87' },
    secondary: { main: '#00a6a6' },
    background: { default: '#f4f8fa' },
  },
})

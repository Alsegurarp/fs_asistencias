import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CssBaseline, ThemeProvider } from '@mui/material'
// Inter servida desde el propio portal: la CSP sólo admite fuentes de 'self'.
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import { App } from './App'
import { registerServiceWorker } from './offline'
import { theme } from './theme'

// Sin red las consultas igual se piden: el service worker responde con lo
// último guardado. Lo que escribe no espera a la red: falla y lo dice.
const queryClient = new QueryClient({ defaultOptions: { queries: { networkMode: 'offlineFirst' }, mutations: { networkMode: 'always' } } })
if (import.meta.env.PROD) registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)

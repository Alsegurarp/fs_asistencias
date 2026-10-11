import { Alert, Box, Chip, Container, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'

type SystemStatus = {
  service: string
  status: string
  version: string
}

async function loadStatus(): Promise<SystemStatus> {
  const response = await fetch('/api/v1/system/status')
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json() as Promise<SystemStatus>
}

export function App() {
  const status = useQuery({ queryKey: ['system-status'], queryFn: loadStatus })

  return (
    <Container maxWidth="md">
      <Box component="main" sx={{ py: 10 }}>
        <Stack spacing={3}>
          <Chip label="Fast Solutions · scaffold 0.1.0" color="secondary" sx={{ alignSelf: 'flex-start' }} />
          <Typography variant="h2" sx={{ fontWeight: 800 }}>
            Control de jornada laboral
          </Typography>
          <Typography variant="h5" color="text.secondary">
            Base técnica del MVP para PyMES mexicanas.
          </Typography>
          {status.isPending && <Alert severity="info">Comprobando la API…</Alert>}
          {status.isError && <Alert severity="warning">La API todavía no está disponible.</Alert>}
          {status.data && (
            <Alert severity="success">
              {status.data.service} {status.data.version}: {status.data.status}
            </Alert>
          )}
        </Stack>
      </Box>
    </Container>
  )
}

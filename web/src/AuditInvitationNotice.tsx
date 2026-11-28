import { useState } from 'react'
import { Box, Button, Stack } from '@mui/material'
import { ApiError } from './api'
import { Note } from './ui'

const supportCodes: Record<string, number> = {
  audit_invitation_unavailable: 700,
  rate_limited: 702,
  audit_mail_unavailable: 710,
  email_unavailable: 711,
  not_found: 712,
  validation: 714,
  audit_mail_unconfigured: 715,
  audit_identity_unavailable: 720,
  unauthorized: 721,
  forbidden: 722,
}

export function AuditInvitationNotice({ error }: { error: unknown }) {
  const [copy, setCopy] = useState('')
  const supportCode = error instanceof ApiError && Object.hasOwn(supportCodes, error.code) ? supportCodes[error.code] : 701
  const code = `Error ${supportCode}`
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopy('Código copiado.')
    } catch {
      setCopy(`Comparte «${code}» con soporte.`)
    }
  }
  return <Note tone="error">
    <Stack spacing={0.5}>
      <Box role="alert"><strong>{code}</strong></Box>
      <Button type="button" size="small" color="inherit" onClick={copyCode} sx={{ alignSelf: 'flex-start' }}>Copiar código</Button>
      {copy && <Box role="status">{copy}</Box>}
    </Stack>
  </Note>
}

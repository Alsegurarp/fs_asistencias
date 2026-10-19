param(
    [string]$BaseUrl = 'http://localhost:18080',
    [string]$Serial,
    [string]$TokenPath,
    [switch]$FictitiousData
)
$ErrorActionPreference = 'Stop'
if (-not $FictitiousData) { throw 'Este ensayo crea datos ficticios. Usa -FictitiousData sólo en un ambiente destinado a pruebas.' }
$base = [uri]$BaseUrl.TrimEnd('/')
if (-not $base.IsAbsoluteUri -or -not $base.Host -or $base.UserInfo -or $base.Query -or $base.Fragment -or $base.AbsolutePath -ne '/' -or
    ($base.Scheme -ne 'https' -and -not ($base.Scheme -eq 'http' -and $base.Host -in @('localhost', '127.0.0.1')))) {
    throw 'BaseUrl debe ser HTTPS sin ruta, o HTTP en localhost/127.0.0.1 para ADB reverse.'
}
$root = Split-Path $PSScriptRoot -Parent
Push-Location $root
try {
    if ($TokenPath) { $TokenPath = (Resolve-Path -LiteralPath $TokenPath).Path }
    function Invoke-Adb([string[]]$AdbArguments) {
        $result = @(& adb -s $Serial @AdbArguments 2>&1)
        if ($LASTEXITCODE -ne 0) { throw "ADB falló: $($result -join "`n")" }
        return $result
    }
    function Invoke-Api([string]$Method, [string]$Path, $Body) {
        # Volver a leer permite renovar la sesión sin perder la limpieza del ensayo.
        $accessToken = if ($TokenPath) { (Get-Content -LiteralPath $TokenPath -Raw).Trim() -replace '^Bearer\s+', '' } else { $env:SIM_TOKEN }
        if ($accessToken -notmatch '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$') { throw 'Falta un token JWT válido en TokenPath o SIM_TOKEN.' }
        $headers = @{ Authorization = "Bearer $accessToken" }
        $request = @{ Method = $Method; Uri = "$($base.AbsoluteUri.TrimEnd('/'))/api/v1$Path"; Headers = $headers; TimeoutSec = 30 }
        if ($null -ne $Body) { $request.ContentType = 'application/json'; $request.Body = [Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 8)) }
        Invoke-RestMethod @request
    }
    $devices = @(& adb devices)
    if ($LASTEXITCODE -ne 0) { throw 'ADB no está disponible.' }
    $connected = @($devices | Where-Object { $_ -match '^\S+\s+device$' } | ForEach-Object { ($_ -split '\s+')[0] })
    if (-not $Serial) {
        if ($connected.Count -ne 1) { throw 'Conecta y autoriza un único teléfono, o indica -Serial.' }
        $Serial = $connected[0]
    }
    if ($Serial -notin $connected) { throw 'El dispositivo indicado no está autorizado por ADB.' }
    New-Item -ItemType Directory -Force -Path build | Out-Null
    $run = 'android-' + [guid]::NewGuid().ToString('N')
    $log = "build/$run.log"
    Push-Location android
    try {
        & .\gradlew.bat --no-daemon :app:testDebugUnitTest :app:lintDebug :app:assembleDebug :app:assembleDebugAndroidTest --console=plain *> "../build/$run-build.log"
        if ($LASTEXITCODE -ne 0) { throw "Falló la compilación. Consulta build/$run-build.log" }
    } finally { Pop-Location }
    $me = Invoke-Api GET '/me' $null
    if (-not $me.tenant -or 'admin_empresa' -notin $me.roles) { throw 'La cuenta debe tener rol admin_empresa en una empresa de prueba para crear y desactivar su propia sede de ensayo.' }
    $tokenValue = if ($TokenPath) { (Get-Content -LiteralPath $TokenPath -Raw).Trim() -replace '^Bearer\s+', '' } else { $env:SIM_TOKEN }
    $payload = $tokenValue.Split('.')[1].Replace('-', '+').Replace('_', '/')
    $payload = $payload.PadRight([int]([Math]::Ceiling($payload.Length / 4) * 4), '=')
    $claims = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload)) | ConvertFrom-Json
    if ([long]$claims.exp - [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() -lt 240) {
        throw 'Renueva el token: se requieren al menos cuatro minutos de vigencia para ambos modos y su limpieza. Todavía no se crearon datos de ensayo.'
    }
    $tokenValue = $null
    $payload = $null
    $claims = $null
    $commit = & git rev-parse HEAD
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo identificar el commit.' }
    $dirty = @(& git status --porcelain -- android infra/test-android-backend.ps1)
    @("Commit: $commit", "Fuentes con cambios locales: $($dirty.Count -gt 0)", "Servidor: $base", "ADB: $Serial", "Inicio UTC: $([DateTime]::UtcNow.ToString('o'))") | Set-Content $log
    foreach ($apk in @('android/app/build/outputs/apk/debug/app-debug.apk', 'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk')) {
        Add-Content $log "APK SHA256: $((Get-FileHash -Algorithm SHA256 -LiteralPath $apk).Hash) $apk"
        Invoke-Adb @('install', '-r', $apk) | Add-Content $log
    }
    $phoneBase = $base.AbsoluteUri.TrimEnd('/')
    $reversePort = $null
    $site = $null
    $employees = @()
    $cards = @()
    $labels = @()
    $cleanupErrors = @()
    $failure = $null
    try {
        if ($base.Scheme -eq 'http') {
            # tcp:0 reserva un túnel propio; no reemplaza los túneles de la app.
            $reversePort = @(Invoke-Adb @('reverse', 'tcp:0', "tcp:$($base.Port)"))[-1].ToString().Trim()
            if ($reversePort -notmatch '^\d+$') { throw 'ADB no devolvió el puerto del túnel.' }
            $phoneBase = "http://localhost:$reversePort"
        }
        $site = Invoke-Api POST '/sites' @{ name = $run; timeZone = 'America/Mexico_City'; latitude = 19.4326; longitude = -99.1332; radiusMeters = 100 }
        Add-Content $log "Sede creada: $($site.id)"
        foreach ($mode in @('personal', 'terminal')) {
            $label = "$run-$mode"
            $labels += $label
            $employee = Invoke-Api POST '/employees' @{ externalId = $label; displayName = 'Ensayo Android'; siteId = $site.id; employmentStart = [DateTime]::UtcNow.AddDays(-1).ToString('yyyy-MM-dd') }
            $employees += $employee
            Add-Content $log "Empleado creado: $($employee.id)"
            $tag = [guid]::NewGuid().ToByteArray()
            $tagHex = [Convert]::ToHexString($tag)
            $fingerprint = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($tag)).ToLowerInvariant()
            $card = Invoke-Api POST '/cards' @{ label = "Android $mode"; fingerprint = $fingerprint }
            $cards += $card
            Add-Content $log "Tarjeta creada: $($card.id)"
            $null = Invoke-Api POST "/cards/$($card.id)/assignments" @{ employeeId = $employee.id }
            $body = @{ mode = $mode; label = $label }
            if ($mode -eq 'personal') { $body.employeeId = $employee.id } else { $body.siteId = $site.id }
            $enrollment = Invoke-Api POST '/device-enrollments' $body
            if ($enrollment.code -notmatch '^[A-Z0-9]{5}-[A-Z0-9]{5}$') { throw 'El backend devolvió un formato de código inesperado.' }
            foreach ($phase in @('activate', 'queue', 'sync')) {
                $instrument = @('shell', 'am', 'instrument', '-w', '-r', '-e', 'baseUrl', $phoneBase, '-e', 'mode', $mode, '-e', 'phase', $phase)
                if ($phase -eq 'activate') { $instrument += @('-e', 'code', $enrollment.code) }
                if ($phase -eq 'queue') { $instrument += @('-e', 'tagHex', $tagHex) }
                $instrument += 'mx.fastsolution.zenit.test/mx.fastsolution.zenit.mobile.testing.SmokeInstrumentation'
                $output = Invoke-Adb $instrument
                $output | Add-Content $log
                if (($output -join "`n") -notmatch "(?m)^INSTRUMENTATION_RESULT: stream=OK: BACKEND $mode ${phase}:" -or ($output -join "`n") -notmatch 'INSTRUMENTATION_CODE: -1') {
                    throw "Falló $mode/$phase. Consulta $log"
                }
                Write-Output "OK: backend $mode/$phase."
            }
            $from = [uri]::EscapeDataString([DateTime]::UtcNow.AddMinutes(-10).ToString('o'))
            $to = [uri]::EscapeDataString([DateTime]::UtcNow.AddMinutes(1).ToString('o'))
            $events = Invoke-Api GET "/attendance-events?employeeId=$($employee.id)&from=$from&to=$to&limit=100" $null
            if (@($events.items).Count -ne 2 -or (@($events.items.type | Sort-Object) -join ',') -ne 'clock_in,clock_out') { throw 'El backend debe conservar exactamente dos marcajes, sin duplicados.' }
            Add-Content $log "Eventos ${mode}: 2, sin duplicados."
        }
    } catch { $failure = $_ } finally {
        # Buscar por las etiquetas únicas también recupera una activación cuyo resultado se perdió en ADB.
        try {
            $cursor = ''
            do {
                $page = Invoke-Api GET "/devices?status=active&limit=100$cursor" $null
                foreach ($device in @($page.items | Where-Object { $_.label -in $labels })) {
                    $revoked = Invoke-Api POST "/devices/$($device.id)/revocation" @{ reason = 'Fin del ensayo Android con datos ficticios' }
                    if ($revoked.status -ne 'revoked') { throw 'La revocación no fue confirmada.' }
                    Add-Content $log "Dispositivo revocado: $($device.id)"
                }
                $cursor = if ($page.nextCursor) { '&cursor=' + [uri]::EscapeDataString($page.nextCursor) } else { '' }
            } while ($cursor)
        } catch { $cleanupErrors += "Dispositivos: $($_.Exception.Message)" }
        foreach ($card in $cards) {
            try { $null = Invoke-Api POST "/cards/$($card.id)/revocation" @{ reason = 'revoked'; note = 'Fin del ensayo Android' } }
            catch { $cleanupErrors += "Tarjeta $($card.id): $($_.Exception.Message)" }
        }
        foreach ($employee in $employees) {
            try { $null = Invoke-Api PATCH "/employees/$($employee.id)" @{ status = 'inactive' } }
            catch { $cleanupErrors += "Empleado $($employee.id): $($_.Exception.Message)" }
        }
        if ($site) {
            try { $null = Invoke-Api PATCH "/sites/$($site.id)" @{ status = 'inactive' } }
            catch { $cleanupErrors += "Sede $($site.id): $($_.Exception.Message)" }
        }
        if ($reversePort) {
            try { Invoke-Adb @('reverse', '--remove', "tcp:$reversePort") | Out-Null }
            catch { $cleanupErrors += "Túnel ADB: $($_.Exception.Message)" }
        }
        @("Fin UTC: $([DateTime]::UtcNow.ToString('o'))", "Etiqueta del ensayo: $run", "Sede: $($site.id)") | Add-Content $log
        if ($cleanupErrors.Count) { $cleanupErrors | Add-Content $log; Write-Warning "Limpieza incompleta; revisar $log y las etiquetas $run." }
    }
    if ($failure) { throw $failure }
    if ($cleanupErrors.Count) { throw "El ensayo no se cierra: limpieza incompleta. Consulta $log" }
    Add-Content $log 'OK: BACKEND personal y terminal; limpieza completada. Se conservan históricos y auditoría.'
    Write-Output "OK: recorrido Android contra backend. Evidencia: $log"
} finally { Pop-Location }

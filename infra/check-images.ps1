param([ValidateSet('backend', 'web', 'db', 'keycloak', 'backup')][string[]]$Targets = @('backend', 'web', 'db', 'keycloak', 'backup'))
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$output = Join-Path $root 'build/security'
New-Item -ItemType Directory -Force -Path $output | Out-Null
$previousTarget = $env:SCAN_TARGET
$results = @()
$summaryPath = Join-Path $output 'summary.json'
$previousResults = if (Test-Path -LiteralPath $summaryPath) { @(Get-Content -LiteralPath $summaryPath -Raw | ConvertFrom-Json) } else { @() }
Push-Location $root
try {
    foreach ($target in $Targets) {
        $image = "fastsolution-zenit-$target"
        $archive = Join-Path $output "$target.tar"
        $entry = @{ target = $target; image = $image; scannedAt = [DateTime]::UtcNow.ToString('o') }
        try {
            $entry.imageId = (& docker image inspect --format '{{.Id}}' $image).Trim()
            if ($LASTEXITCODE -ne 0) { throw "No existe la imagen $image" }
            & docker save $image -o $archive
            if ($LASTEXITCODE -ne 0) { throw "No se pudo exportar $image" }
            $env:SCAN_TARGET = $target
            & docker compose --profile tools run --rm sbom *> (Join-Path $output "$target-sbom.log")
            if ($LASTEXITCODE -ne 0) { throw "Falló el inventario de $image" }
            & docker compose --profile tools run --rm vuln-scan *> (Join-Path $output "$target-scan.log")
            $scanExit = $LASTEXITCODE
            if ($scanExit -notin @(0, 2)) { throw "El análisis terminó con código $scanExit; consultar $target-scan.log" }
            $report = Get-Content -LiteralPath (Join-Path $output "$target.vulns.json") -Raw | ConvertFrom-Json
            $entry.findings = @{}
            foreach ($severity in @('Critical', 'High', 'Medium', 'Low', 'Negligible', 'Unknown')) {
                $entry.findings[$severity] = @($report.matches | Where-Object { $_.vulnerability.severity -eq $severity }).Count
            }
            $entry.acceptedFindings = @($report.ignoredMatches | Where-Object { $null -ne $_ }).Count
            $entry.passed = $scanExit -eq 0 -and $entry.findings.Critical -eq 0 -and $entry.findings.High -eq 0
            if (-not $entry.passed) { $entry.error = 'Hay hallazgos graves sin aceptar; consultar el informe.' }
        } catch {
            $entry.passed = $false
            $entry.error = $_.Exception.Message
        } finally {
            # Sólo se elimina el archivo de exportación creado por este ensayo.
            $resolvedArchive = [IO.Path]::GetFullPath($archive)
            if (-not $resolvedArchive.StartsWith([IO.Path]::GetFullPath($output) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Archivo fuera del directorio de análisis' }
            if (Test-Path -LiteralPath $resolvedArchive) { Remove-Item -LiteralPath $resolvedArchive }
            $results += $entry
            Write-Output "$target`: $($entry.passed)"
            if (-not $entry.passed) {
                Write-Output $entry.error
                $scanLog = Join-Path $output "$target-scan.log"
                if (Test-Path -LiteralPath $scanLog) { Get-Content -LiteralPath $scanLog -Tail 60 }
            }
        }
    }
} finally {
    @(@($previousResults | Where-Object { $_.target -notin $Targets }) + $results) | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $summaryPath
    if ($null -eq $previousTarget) { Remove-Item Env:SCAN_TARGET -ErrorAction SilentlyContinue } else { $env:SCAN_TARGET = $previousTarget }
    Pop-Location
}
if (@($results | Where-Object { -not $_.passed }).Count) { throw 'No aprobaron todas las imágenes; revisar build/security/summary.json' }

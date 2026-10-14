# Run once from PowerShell as Administrator, then restart Windows manually.
# Does not restart Windows or modify existing project data.
$ErrorActionPreference = 'Stop'
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Abre PowerShell como administrador y vuelve a ejecutar este archivo.'
}
$dismPath = Join-Path $env:SystemRoot 'System32\dism.exe'
if (-not [Environment]::Is64BitProcess -and [Environment]::Is64BitOperatingSystem) {
    $dismPath = Join-Path $env:SystemRoot 'Sysnative\dism.exe'
}
foreach ($feature in @('Microsoft-Windows-Subsystem-Linux', 'VirtualMachinePlatform')) {
    Write-Host "Habilitando $feature..."
    & $dismPath /Online /Enable-Feature "/FeatureName:$feature" /All /NoRestart
    if ($LASTEXITCODE -notin @(0, 3010)) {
        throw "DISM fallo al habilitar $feature (codigo $LASTEXITCODE). No se completo la configuracion."
    }
}
Write-Host 'Componentes habilitados. Reinicia Windows manualmente, ejecuta wsl --update y abre Docker Desktop.'

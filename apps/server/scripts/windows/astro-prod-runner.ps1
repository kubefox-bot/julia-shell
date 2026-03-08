$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'astro-prod-common.ps1')

$config = Get-AstroProdConfig

if (Test-AstroPortListening -Port $config.Port) {
    Write-Host "Port $($config.Port) is already listening. Nothing to start."
    exit 0
}

if (Test-AstroBuildRequired -Config $config) {
    Write-Host 'Build is missing or stale. Running yarn run build...'
    Invoke-AstroBuild -Config $config
}

Push-Location $config.ProjectRoot
try {
    $env:HOST = '0.0.0.0'
    $env:PORT = [string]$config.Port
    & node $config.EntryPoint
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
} finally {
    Pop-Location
}

param(
  [string]$EnvFile = "$PSScriptRoot/.env",
  [string]$BinaryPath = ""
)

$ErrorActionPreference = "Stop"

function Import-EnvFile {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()

    if ([string]::IsNullOrWhiteSpace($line)) { return }
    if ($line.StartsWith("#")) { return }
    if (-not $line.Contains("=")) { return }

    $parts = $line.Split("=", 2)
    $key = $parts[0].Trim()
    $value = $parts[1].Trim()

    if ((($value.StartsWith('"')) -and ($value.EndsWith('"'))) -or (($value.StartsWith("'")) -and ($value.EndsWith("'")))) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    Set-Item -Path ("Env:" + $key) -Value $value
  }
}

function Resolve-AgentBinary {
  param([string]$ExplicitPath)

  $candidates = @()

  if (-not [string]::IsNullOrWhiteSpace($ExplicitPath)) {
    $candidates += $ExplicitPath
  }

  if (-not [string]::IsNullOrWhiteSpace($env:JULIA_AGENT_BIN)) {
    $candidates += $env:JULIA_AGENT_BIN
  }

  $candidates += @(
    (Join-Path $PSScriptRoot "julia-agent.exe"),
    (Join-Path $PSScriptRoot "target/release/julia-agent.exe"),
    (Join-Path $PSScriptRoot "target/debug/julia-agent.exe")
  )

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }

  return $null
}

Import-EnvFile -Path $EnvFile
$agentBinary = Resolve-AgentBinary -ExplicitPath $BinaryPath

if ($null -ne $agentBinary) {
  Write-Host "[agent] starting binary: $agentBinary"
  & $agentBinary
  exit $LASTEXITCODE
}

$cargo = Get-Command cargo -ErrorAction SilentlyContinue
if ($null -ne $cargo) {
  Write-Host "[agent] binary not found, fallback to cargo run"
  & cargo run --manifest-path (Join-Path $PSScriptRoot "Cargo.toml")
  exit $LASTEXITCODE
}

Write-Error "[agent] error: binary not found and cargo is unavailable"

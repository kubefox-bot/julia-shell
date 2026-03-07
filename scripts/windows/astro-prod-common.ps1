$ErrorActionPreference = 'Stop'

function Get-AstroProdConfig {
    $projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
    $corepackCmd = (Get-Command corepack.cmd -ErrorAction Stop).Source
    $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

    [PSCustomObject]@{
        ProjectRoot = $projectRoot
        ScriptsRoot = $PSScriptRoot
        TaskName = 'YuliaAstroProd'
        Port = 4321
        Url = 'http://julia.love:4321'
        RunnerScript = Join-Path $PSScriptRoot 'astro-prod-runner.ps1'
        CorepackCmd = $corepackCmd
        CurrentUser = $currentUser
        EntryPoint = Join-Path $projectRoot 'dist\server\entry.mjs'
    }
}

function Test-AstroPortListening {
    param([int]$Port)

    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
}

function Get-AstroListenerProcessId {
    param([int]$Port)

    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $connection) {
        return $null
    }

    return $connection.OwningProcess
}

function Stop-AstroListener {
    param($Config)

    $listenerPid = Get-AstroListenerProcessId -Port $Config.Port
    if ($listenerPid) {
        Stop-Process -Id $listenerPid -Force -ErrorAction SilentlyContinue
    }
}

function Get-AstroTask {
    param($Config)

    return Get-ScheduledTask -TaskName $Config.TaskName -ErrorAction SilentlyContinue
}

function Get-AstroStatus {
    param($Config)

    $task = Get-AstroTask -Config $Config
    $taskExists = $null -ne $task
    $taskState = if ($taskExists) { [string]$task.State } else { 'Missing' }
    $portListening = Test-AstroPortListening -Port $Config.Port
    $appStatus = if ($portListening) { 'running' } else { 'stopped' }

    $message = if (-not $taskExists) {
        'Task Scheduler задача не зарегистрирована.'
    } elseif ($portListening) {
        "Production работает на порту $($Config.Port)."
    } elseif ($taskState -eq 'Running') {
        'Задача запущена, но порт пока не слушается.'
    } else {
        'Production сейчас остановлен.'
    }

    [PSCustomObject]@{
        appStatus = $appStatus
        taskExists = $taskExists
        taskState = $taskState
        portListening = $portListening
        url = $Config.Url
        message = $message
    }
}

function Get-LatestInputWriteUtc {
    param($Config)

    $latest = [datetime]::MinValue
    $paths = @(
        (Join-Path $Config.ProjectRoot 'src'),
        (Join-Path $Config.ProjectRoot 'public'),
        (Join-Path $Config.ProjectRoot 'package.json'),
        (Join-Path $Config.ProjectRoot 'astro.config.mjs'),
        (Join-Path $Config.ProjectRoot 'tsconfig.json')
    )

    foreach ($item in $paths) {
        if (-not (Test-Path $item)) {
            continue
        }

        $entry = Get-Item $item
        if ($entry.PSIsContainer) {
            $candidate = Get-ChildItem $item -Recurse -File -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTimeUtc -Descending |
                Select-Object -First 1
            if ($candidate -and $candidate.LastWriteTimeUtc -gt $latest) {
                $latest = $candidate.LastWriteTimeUtc
            }
        } elseif ($entry.LastWriteTimeUtc -gt $latest) {
            $latest = $entry.LastWriteTimeUtc
        }
    }

    return $latest
}

function Test-AstroBuildRequired {
    param($Config)

    if (-not (Test-Path $Config.EntryPoint)) {
        return $true
    }

    $entryTime = (Get-Item $Config.EntryPoint).LastWriteTimeUtc
    $latestInput = Get-LatestInputWriteUtc -Config $Config

    return $latestInput -gt $entryTime
}

function Invoke-AstroBuild {
    param($Config)

    Push-Location $Config.ProjectRoot
    try {
        & $Config.CorepackCmd yarn run build
        if ($LASTEXITCODE -ne 0) {
            throw "yarn run build failed with exit code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
}

function Wait-ForPortState {
    param(
        [int]$Port,
        [bool]$Listening,
        [int]$TimeoutSeconds = 30
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $current = Test-AstroPortListening -Port $Port
        if ($current -eq $Listening) {
            return $true
        }
        Start-Sleep -Milliseconds 500
    }

    return $false
}

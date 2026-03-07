param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('status', 'start', 'stop', 'restart')]
    [string]$Action,
    [switch]$Detached
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'astro-prod-common.ps1')

$config = Get-AstroProdConfig
$task = Get-AstroTask -Config $config

switch ($Action) {
    'status' {
        Get-AstroStatus -Config $config | ConvertTo-Json -Compress
        exit 0
    }
    'start' {
        if (-not $task) {
            throw "Task '$($config.TaskName)' is not registered."
        }
        Start-ScheduledTask -TaskName $config.TaskName
        Start-Sleep -Seconds 1
        Get-AstroStatus -Config $config | ConvertTo-Json -Compress
        exit 0
    }
    'stop' {
        if ($Detached) {
            Start-Sleep -Seconds 2
        }
        if ($task) {
            schtasks.exe /End /TN $config.TaskName | Out-Null
        }
        Stop-AstroListener -Config $config
        Wait-ForPortState -Port $config.Port -Listening $false -TimeoutSeconds 20 | Out-Null
        exit 0
    }
    'restart' {
        if ($Detached) {
            Start-Sleep -Seconds 2
        }
        if ($task) {
            schtasks.exe /End /TN $config.TaskName | Out-Null
        }
        Stop-AstroListener -Config $config
        Wait-ForPortState -Port $config.Port -Listening $false -TimeoutSeconds 30 | Out-Null
        Invoke-AstroBuild -Config $config
        Start-ScheduledTask -TaskName $config.TaskName
        exit 0
    }
}

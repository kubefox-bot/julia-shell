param(
    [string]$Password
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'astro-prod-common.ps1')

$config = Get-AstroProdConfig
$existing = Get-AstroTask -Config $config

$action = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$($config.RunnerScript)`"" `
    -WorkingDirectory $config.ProjectRoot

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $config.CurrentUser
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -StartWhenAvailable

if ($existing) {
    Unregister-ScheduledTask -TaskName $config.TaskName -Confirm:$false
}

if ($Password) {
    Register-ScheduledTask `
        -TaskName $config.TaskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -User $config.CurrentUser `
        -Password $Password `
        -Description 'Auto-start Astro production for Yulia at logon.' | Out-Null
} else {
    $principal = New-ScheduledTaskPrincipal `
        -UserId $config.CurrentUser `
        -LogonType Interactive `
        -RunLevel Limited

    Register-ScheduledTask `
        -TaskName $config.TaskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description 'Auto-start Astro production for Yulia at logon.' | Out-Null
}

Get-AstroStatus -Config $config | ConvertTo-Json -Compress

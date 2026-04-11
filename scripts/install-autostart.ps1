$pythonPath = (Get-Command python).Source
$scriptPath = (Resolve-Path "D:\CODE\ManageBill\scripts\print-server.py").Path
$taskName = "ManageBill-PrintServer"
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
$action = New-ScheduledTaskAction -Execute $pythonPath -Argument $scriptPath
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 0) -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "ManageBill print server" | Out-Null
Write-Host "OK - Registered: $taskName" -ForegroundColor Green
Write-Host "  Python : $pythonPath"
Write-Host "  Script : $scriptPath"
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 2
$state = (Get-ScheduledTask -TaskName $taskName).State
Write-Host "Status: $state" -ForegroundColor Cyan

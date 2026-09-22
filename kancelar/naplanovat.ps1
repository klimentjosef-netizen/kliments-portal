# Naplánuje sběrný mail ve Windows: denně v 8:00, 12:00, 14:00 a 17:00, jen když je Josef přihlášený
# (heslo ke schránce je ve Správci přihlašovacích údajů jeho účtu), bez okna.
# Výstup každého běhu jde do kancelar\logy\sberny-mail.log.
#   .\naplanovat.ps1            zapne / přenastaví
#   .\naplanovat.ps1 -Vypnout   odstraní úlohu
param([switch]$Vypnout, [string]$Od = "2026-09-22", [string[]]$Casy = @("08:00", "12:00", "14:00", "17:00"))

$nazev = "Kliments sberny mail"
if ($Vypnout) { Unregister-ScheduledTask -TaskName $nazev -Confirm:$false; "Úloha odstraněna."; return }

$logy = Join-Path $PSScriptRoot "logy"
New-Item -ItemType Directory -Force $logy | Out-Null

# Spouštěč bez blikajícího okna: wscript -> powershell skrytě
$vbs = Join-Path $PSScriptRoot "sberny-mail-skryte.vbs"
$ps1 = Join-Path $PSScriptRoot "sberny-mail.ps1"
$log = Join-Path $logy "sberny-mail.log"
$q = [char]34
$cmd = "powershell -NoProfile -ExecutionPolicy Bypass -Command $q& '$ps1' --od $Od *>> '$log'$q"
$vbsCmd = $cmd.Replace("$q", "$q$q")
Set-Content -Path $vbs -Encoding ASCII -Value "CreateObject($($q)WScript.Shell$q).Run $q$vbsCmd$q, 0, True"

$akce = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`""
$spoust = $Casy | ForEach-Object { New-ScheduledTaskTrigger -Daily -At $_ }
$nast = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2)
$kdo = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive
Register-ScheduledTask -TaskName $nazev -Action $akce -Trigger $spoust -Settings $nast -Principal $kdo -Force | Out-Null
"Naplánováno: '$nazev' denně v $($Casy -join ', '), e-maily od $Od. Log: $log"

# Naplánuje měsíční připomínky klientům (pripominky.mjs): denně v 8:00, jen když je Josef přihlášený.
# Skript sám hlídá, aby každá připomínka odešla jen jednou za měsíc (nejdřív v daný den).
#   .\naplanovat-pripominky.ps1            zapne / přenastaví
#   .\naplanovat-pripominky.ps1 -Vypnout   odstraní úlohu
param([switch]$Vypnout, [string]$Cas = "08:00")

$nazev = "Kliments pripominky"
if ($Vypnout) { Unregister-ScheduledTask -TaskName $nazev -Confirm:$false; "Úloha odstraněna."; return }

$logy = Join-Path $PSScriptRoot "logy"
New-Item -ItemType Directory -Force $logy | Out-Null
$vbs = Join-Path $PSScriptRoot "pripominky-skryte.vbs"
$log = Join-Path $logy "pripominky.log"
$q = [char]34
$cmd = "cmd /c cd /d $q$PSScriptRoot$q && node pripominky.mjs >> $q$log$q 2>&1"
$vbsCmd = $cmd.Replace("$q", "$q$q")
Set-Content -Path $vbs -Encoding ASCII -Value "CreateObject($($q)WScript.Shell$q).Run $q$vbsCmd$q, 0, True"

$akce = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`""
$spoust = New-ScheduledTaskTrigger -Daily -At $Cas
$nast = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
$kdo = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive
Register-ScheduledTask -TaskName $nazev -Action $akce -Trigger $spoust -Settings $nast -Principal $kdo -Force | Out-Null
"Naplánováno: '$nazev' denně v $Cas. Log: $log"

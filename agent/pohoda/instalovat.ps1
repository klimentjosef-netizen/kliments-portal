# Jednorazova instalace Pohoda agenta do tohoto Windows uctu (bez admin prav).
# Spoustet ze slozky s config.json a token.txt (pri prvni instalaci). Vysledek zapise do instalace.txt.
$ErrorActionPreference = 'Stop'
$zdroj = $PSScriptRoot
$cil = Join-Path $env:LOCALAPPDATA 'kliments-agent'
$vystup = Join-Path $zdroj 'instalace.txt'
"Instalace $(Get-Date)" | Out-File $vystup -Encoding utf8
function Krok($t) { $t; Add-Content $vystup $t -Encoding UTF8 }
trap { Krok "CHYBA: $($_.Exception.Message)"; exit 1 }

New-Item -ItemType Directory -Force $cil | Out-Null
foreach ($f in 'agent.ps1', 'spustit-skryte.vbs', 'config.json') { Copy-Item (Join-Path $zdroj $f) (Join-Path $cil $f) -Force }
Krok "OK  soubory zkopirovany do $cil"

$tokenSoubor = Join-Path $zdroj 'token.txt'
if (Test-Path $tokenSoubor) {
  $t = [IO.File]::ReadAllText($tokenSoubor).Trim()
  [IO.File]::WriteAllText((Join-Path $cil 'token.dat'), (ConvertTo-SecureString $t -AsPlainText -Force | ConvertFrom-SecureString))
  Remove-Item $tokenSoubor -Force
  Krok 'OK  pristupovy token ulozen sifrovane a smazan z instalacni slozky'
} elseif (-not (Test-Path (Join-Path $cil 'token.dat'))) { throw 'chybi token.txt i ulozeny token' } else { Krok 'OK  token uz byl ulozen drive' }

if (-not (Test-Path (Join-Path $cil 'pohoda.cred'))) {
  $c = Get-Credential -Message 'Prihlaseni do Pohody (jmeno a heslo, ktere zadavas pri spusteni Pohody)'
  if (-not $c) { throw 'prihlaseni do Pohody nezadano' }
  [pscustomobject]@{ User = $c.UserName; Pass = ($c.Password | ConvertFrom-SecureString) } | ConvertTo-Json | Set-Content (Join-Path $cil 'pohoda.cred') -Encoding UTF8
  Krok 'OK  prihlaseni do Pohody ulozeno'
} else { Krok 'OK  prihlaseni do Pohody uz je ulozene' }

$vbs = Join-Path $cil 'spustit-skryte.vbs'
$r = schtasks.exe /Create /TN 'Kliments Pohoda agent' /TR "wscript.exe `"$vbs`"" /SC MINUTE /MO 15 /F 2>&1
Krok "PLANOVAC: $($r -join ' ')"

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $cil 'agent.ps1')
$posledni = Get-Content (Join-Path $cil 'agent.log') -Tail 5 -ErrorAction SilentlyContinue
Krok "Prvni beh agenta, konec logu:"; foreach ($l in $posledni) { Krok "   $l" }
Krok 'HOTOVO'

# Kliments Pohoda agent: bere ulohy z fronty v Kliments (pres internet), zapise je do Pohody
# pres Pohoda.exe /XML a vysledek (responsePack) vrati zpet. Bezi z Planovace uloh.
# Soubory v %LOCALAPPDATA%\kliments-agent: config.json, token.dat (DPAPI), pohoda.cred (DPAPI).
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$dir = Join-Path $env:LOCALAPPDATA 'kliments-agent'
$log = Join-Path $dir 'agent.log'
function Zapis($t) { Add-Content -Path $log -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $t" -Encoding UTF8 }
function Odkryj($zasifrovane) { [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR(($zasifrovane | ConvertTo-SecureString))) }

# Jen jeden beh najednou (Planovac spousti kazdych 15 min, velka davka muze trvat dele)
$mutex = New-Object Threading.Mutex($false, 'Local\KlimentsPohodaAgent')
if (-not $mutex.WaitOne(0)) { exit 0 }
try {
  $cfg = Get-Content (Join-Path $dir 'config.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  $token = Odkryj ([IO.File]::ReadAllText((Join-Path $dir 'token.dat')))
  $cred = Get-Content (Join-Path $dir 'pohoda.cred') -Raw -Encoding UTF8 | ConvertFrom-Json
  $hlavicky = @{ apikey = $cfg.anonKey }
  $w1250 = [Text.Encoding]::GetEncoding(1250)
  function Rpc($nazev, $data) {
    $body = [Text.Encoding]::UTF8.GetBytes(($data | ConvertTo-Json -Compress -Depth 5))
    Invoke-RestMethod "$($cfg.url)/rest/v1/rpc/$nazev" -Method Post -Headers $hlavicky -ContentType 'application/json; charset=utf-8' -Body $body
  }

  for ($kolo = 0; $kolo -lt 50; $kolo++) {
    $u = @(Rpc 'kl_agent_dalsi' @{ p_token = $token; p_host = $env:COMPUTERNAME }) | Where-Object { $_.id } | Select-Object -First 1
    if (-not $u) { break }
    Zapis "START $($u.id) | $($u.database) | $($u.description)"
    $beh = Join-Path $dir ('beh_' + (Get-Date -Format 'yyyyMMdd_HHmmss_fff'))
    New-Item -ItemType Directory -Force $beh | Out-Null
    try {
      $vstup = Join-Path $beh 'dataPack.xml'; $odpoved = Join-Path $beh 'responsePack.xml'; $ini = Join-Path $beh 'xml_imp.ini'
      [IO.File]::WriteAllBytes($vstup, [Convert]::FromBase64String($u.xml_b64))
      $dup = if ($u.check_duplicity) { 1 } else { 0 }
      [IO.File]::WriteAllText($ini, "[XML]`r`ninput_xml=$vstup`r`nresponse_xml=$odpoved`r`ndatabase=$($u.database)`r`ncheck_duplicity=$dup`r`nformat_output=1`r`n", $w1250)
      $heslo = Odkryj $cred.Pass
      $p = Start-Process -FilePath $cfg.pohodaExe -ArgumentList @('/XML', "`"$($cred.User)`"", "`"$heslo`"", "`"$ini`"") -WorkingDirectory (Split-Path $cfg.pohodaExe) -PassThru -WindowStyle Hidden
      $heslo = $null
      if (-not $p.WaitForExit([int]$u.timeout_sec * 1000)) { try { $p.Kill() } catch {}; throw "Pohoda neskoncila do $($u.timeout_sec) s" }
      if (-not (Test-Path $odpoved)) { throw "Pohoda nevytvorila odpoved (kod $($p.ExitCode)), zkontroluj databazi $($u.database)" }

      $bajty = [IO.File]::ReadAllBytes($odpoved)
      $x = [xml]$w1250.GetString($bajty)
      $pol = @($x.responsePack.responsePackItem)
      $ok = @($pol | Where-Object { $_.state -eq 'ok' }).Count
      $souhrn = @{ stav = $x.responsePack.state; polozek = $pol.Count; ok = $ok; chyb = $pol.Count - $ok }
      Rpc 'kl_agent_vysledek' @{ p_token = $token; p_job = $u.id; p_ok = $true; p_response_b64 = [Convert]::ToBase64String($bajty); p_summary = $souhrn; p_error = $null } | Out-Null
      Zapis "HOTOVO $($u.id) | polozek $($pol.Count), ok $ok"
      Remove-Item $beh -Recurse -Force -ErrorAction SilentlyContinue
    } catch {
      $zprava = $_.Exception.Message
      Zapis "SELHALO $($u.id) | $zprava"
      try { Rpc 'kl_agent_vysledek' @{ p_token = $token; p_job = $u.id; p_ok = $false; p_response_b64 = $null; p_summary = $null; p_error = $zprava } | Out-Null } catch { Zapis "  vysledek se nepodarilo odeslat: $($_.Exception.Message)" }
    }
  }
} catch {
  Zapis "CHYBA BEHU | $($_.Exception.Message)"
} finally {
  $mutex.ReleaseMutex()
}

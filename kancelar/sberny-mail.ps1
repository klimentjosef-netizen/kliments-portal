# Spouštěč sběrného mailu: vezme heslo k firsen@email.cz ze Správce přihlašovacích
# údajů Windows (položka firsen-imap) a předá ho skriptu jen v proměnné procesu.
#   .\sberny-mail.ps1 --slozka Maliiisa --limit 3
$src = @'
using System; using System.Runtime.InteropServices;
public class KlimentsCred {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct C { public int F; public int T; public string N; public string Cm; public System.Runtime.InteropServices.ComTypes.FILETIME L; public int S; public IntPtr B; public int P; public int AC; public IntPtr A; public string TA; public string U; }
  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] public static extern bool CredRead(string t, int ty, int f, out IntPtr p);
  public static string[] Get(string t) { IntPtr p; if (!CredRead(t, 1, 0, out p)) return null; C x = (C)Marshal.PtrToStructure(p, typeof(C)); return new string[] { x.U, Marshal.PtrToStringUni(x.B, x.S / 2) }; }
}
'@
if (-not ("KlimentsCred" -as [type])) { Add-Type $src }
$c = [KlimentsCred]::Get("firsen-imap")
if (-not $c) { Write-Error "Chybí přihlašovací údaje firsen-imap ve Správci přihlašovacích údajů"; exit 1 }
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$env:IMAP_USER = $c[0]; $env:IMAP_PASS = $c[1]
Push-Location $PSScriptRoot
try { node sberny-mail.mjs @args } finally { Pop-Location; Remove-Item Env:IMAP_PASS }

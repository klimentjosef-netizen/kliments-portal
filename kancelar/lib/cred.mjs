// Čtení přihlašovacích údajů ze Správce přihlašovacích údajů Windows (generic),
// přes PowerShell. Hodnota se nikam nevypisuje.
import { execFileSync } from 'node:child_process'

export function cred(nazev) {
  const ps = `
$src = @"
using System; using System.Runtime.InteropServices;
public class KCred {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct C { public int F; public int T; public string N; public string Cm; public System.Runtime.InteropServices.ComTypes.FILETIME L; public int S; public IntPtr B; public int P; public int AC; public IntPtr A; public string TA; public string U; }
  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] public static extern bool CredRead(string t, int ty, int f, out IntPtr p);
  public static string Get(string t) { IntPtr p; if (!CredRead(t, 1, 0, out p)) return ""; C x = (C)Marshal.PtrToStructure(p, typeof(C)); return x.U + "\\n" + Marshal.PtrToStringUni(x.B, x.S / 2); }
}
"@
Add-Type $src
[Console]::OutputEncoding = [Text.Encoding]::UTF8
[Console]::Out.Write([KCred]::Get("${nazev}"))`
  const out = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8' })
  const i = out.indexOf('\n')
  if (i < 0) throw new Error(`Chybí přihlašovací údaje ${nazev} ve Správci přihlašovacích údajů`)
  return { user: out.slice(0, i), pass: out.slice(i + 1) }
}

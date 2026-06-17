import { readFileSync } from 'node:fs'
import pkg from 'xlsx'
const XLSX = pkg.default || pkg
const BASE = 'C:/Users/klime/OneDrive/Plocha/Projekty/Tech cars - Kliments portal'
function rows(f){const wb=XLSX.read(readFileSync(f),{type:'buffer'});return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''})}
for (const [year,f] of [[2024,'výkaz_2024_01-2024_12.xlsx'],[2025,'vykaz_2025_01-2025_12.xlsx']]) {
  console.log(`\n===== VÝKAZ ${year} (NETTO = ${year}, NETTO_MIN = ${year-1}; v tis. Kč) =====`)
  for (const r of rows(`${BASE}/${year}/${f}`)) {
    const t=String(r.TEXT||'').trim(); if(!t) continue
    const netto=Number(r.NETTO)||0, min=Number(r.NETTO_MIN)||0
    if(netto===0&&min===0) continue
    console.log(`  ř${String(r.RADEK).padStart(3)} ${(r.OZNAC||r.OZNAC2||'').padEnd(4)} ${t.slice(0,42).padEnd(42)} ${String(netto).padStart(8)} | ${String(min).padStart(8)}`)
  }
}

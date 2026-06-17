// Levná inspekce struktury XLSX/XLS: jen list, rozměr, hlavička a pár řádků.
import { readFileSync } from 'node:fs'
import pkg from 'xlsx'
const XLSX = pkg.default || pkg

const files = process.argv.slice(2)
for (const f of files) {
  console.log('\n================================================================')
  console.log('FILE:', f.split(/[\\/]/).slice(-2).join('/'))
  let wb
  try { wb = XLSX.read(readFileSync(f), { type: 'buffer', cellDates: true }) } catch (e) { console.log('  !! nelze otevřít:', e.message); continue }
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    const ref = ws['!ref'] || 'prázdný'
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' })
    console.log(`  ── list "${name}"  rozměr=${ref}  řádků=${rows.length}`)
    const sample = rows.slice(0, 8)
    sample.forEach((r, i) => {
      const cells = r.map((c) => (typeof c === 'number' ? c : String(c).slice(0, 22)))
      console.log(`     [${i}] ${cells.slice(0, 12).join(' | ')}`)
    })
  }
}

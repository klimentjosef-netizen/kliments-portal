// Vyrenderuje bloky reportu TechCars do HTML náhledu (pro vizuální kontrolu).
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))
const supa = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data } = await supa.from('reports').select('data').eq('id', 'cd2556ba-3480-42cb-934b-f98944fdd97b').single()
const d = data.data
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
const czk = (n) => (n == null ? '—' : Math.round(n).toLocaleString('cs-CZ') + ' Kč')

function block(b) {
  switch (b.type) {
    case 'heading': return `<div class="eyebrow">${esc(b.eyebrow || '')}</div><h${b.level} class="h${b.level}">${esc(b.text)}</h${b.level}>${b.sub ? `<p class="sub">${esc(b.sub)}</p>` : ''}`
    case 'kpi-grid': return `<div class="grid g${b.columns || 4}">${b.items.map((i) => `<div class="kpi ${i.intent || ''}"><div class="kl">${esc(i.label)}</div><div class="kv">${esc(i.value)}</div><div class="ks">${esc(i.sub || '')}</div></div>`).join('')}</div>`
    case 'callout': return `<div class="callout ${b.intent || 'info'}"><strong>${esc(b.title || '')}</strong><div>${esc(b.body)}</div></div>`
    case 'yoy-comparison': return `<div class="card"><h3>${esc(b.title || '')}</h3><table><tr><th></th>${b.years.map((y) => `<th>${y}</th>`).join('')}</tr>${b.rows.map((r) => `<tr class="${r.highlight ? 'hl' : ''}"><td>${esc(r.label)}</td>${r.values.map((v) => `<td class="num">${r.format === 'currency' ? czk(v) : v == null ? '—' : v}</td>`).join('')}</tr>`).join('')}</table>${b.note ? `<div class="note">${esc(b.note)}</div>` : ''}</div>`
    case 'table': return `<div class="card"><h3>${esc(b.title || '')}</h3><table><tr>${b.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>${b.footer ? `<div class="note">${esc(b.footer)}</div>` : ''}</div>`
    case 'cashflow-chart': { const max = Math.max(...b.revenue, ...b.costs); return `<div class="card"><h3>${esc(b.title || '')}</h3><div class="chart">${b.months.map((m, i) => `<div class="bargrp"><div class="bars"><div class="bar rev" style="height:${Math.round(b.revenue[i] / max * 100)}px"></div><div class="bar cost" style="height:${Math.round(b.costs[i] / max * 100)}px"></div></div><div class="bl">${esc(m)}</div></div>`).join('')}</div><div class="note">🟦 tržby 🟥 náklady</div></div>` }
    case 'strengths-weaknesses': return `<div class="grid g2"><div class="card sw"><h4>Silné stránky</h4><ul>${b.strengths.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div><div class="card sw weak"><h4>Slabé stránky</h4><ul>${b.weaknesses.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div></div>`
    case 'step-list': return `<div class="card"><h3>${esc(b.title || '')}</h3>${b.items.map((i) => `<div class="step"><span class="num">${esc(i.num || '')}</span><div><strong>${esc(i.title)}</strong><div class="sd">${esc(i.desc || '')}</div></div></div>`).join('')}</div>`
    case 'risk-list': return `<div class="card"><h3>Rizika</h3>${b.items.map((i) => `<div class="risk ${i.level}"><strong>${esc(i.title)}</strong><div class="sd">${esc(i.desc || '')}</div></div>`).join('')}</div>`
    default: return `<div class="card">[blok ${esc(b.type)}]</div>`
  }
}

const ledgerYears = [2024, 2025, 2026].map((y) => {
  const ms = d.ledger.months.filter((m) => m.month.startsWith(String(y)))
  const rev = ms.reduce((s, m) => s + m.items.filter((i) => i.category === 'revenue').reduce((a, i) => a + (i.status === 'paid' ? i.amount_actual : i.amount_expected), 0), 0)
  const cost = ms.reduce((s, m) => s + m.items.filter((i) => i.category === 'cost').reduce((a, i) => a + (i.status === 'paid' ? i.amount_actual : i.amount_expected), 0), 0)
  return `<tr><td>${y} ${y === 2026 ? '(plán)' : ''}</td><td class="num">${czk(rev)}</td><td class="num">${czk(cost)}</td><td class="num">${czk(rev - cost)}</td><td>${ms.length} měs</td></tr>`
}).join('')

const html = `<!doctype html><meta charset="utf8"><style>
body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#faf7f4;color:#2a2420;max-width:1100px;margin:0 auto;padding:30px;font-size:14px}
.eyebrow{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#a78}.sub{color:#777;margin:.2em 0 1em}
h1.h1{font-size:26px;margin:.1em 0}h2.h2{font-size:20px;margin:1.2em 0 .4em;border-top:1px solid #eee;padding-top:.6em}
.grid{display:grid;gap:12px;margin:12px 0}.g4{grid-template-columns:repeat(4,1fr)}.g3{grid-template-columns:repeat(3,1fr)}.g2{grid-template-columns:repeat(2,1fr)}
.kpi{background:#fff;border:1px solid #eee;border-radius:14px;padding:14px}.kpi.critical{border-color:#e0788a;background:#fdf0f2}.kpi.warning{border-color:#e0a868;background:#fdf7ee}.kpi.success{border-color:#7bbf8a;background:#f0f8f2}
.kl{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#888}.kv{font-size:20px;font-weight:300;margin:.2em 0}.ks{font-size:11px;color:#999}
.callout{border-radius:14px;padding:14px 16px;margin:12px 0}.callout.critical{background:#fdf0f2;border:1px solid #e0788a}.callout.warning{background:#fdf7ee;border:1px solid #e0a868}.callout.info{background:#eef4fb;border:1px solid #88aedd}
.card{background:#fff;border:1px solid #eee;border-radius:16px;padding:16px;margin:12px 0}.card h3{margin:.1em 0 .6em;font-size:16px}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:6px 8px;font-size:13px;border-bottom:1px solid #f0eae4}th{font-size:10px;text-transform:uppercase;color:#999}.num{text-align:right;font-variant-numeric:tabular-nums}tr.hl{background:#faf6f0;font-weight:600}
.note{font-size:11px;color:#888;margin-top:.5em}
.chart{display:flex;gap:6px;align-items:flex-end;height:120px;padding-top:10px}.bargrp{flex:1;text-align:center}.bars{display:flex;gap:2px;justify-content:center;align-items:flex-end;height:100px}.bar{width:8px;border-radius:2px}.bar.rev{background:#88aedd}.bar.cost{background:#e0788a}.bl{font-size:8px;color:#aaa;margin-top:3px}
.sw ul{margin:0;padding-left:18px}.sw li{margin:.3em 0}.sw.weak li{color:#b5566a}
.step,.risk{display:flex;gap:10px;padding:8px 0;border-top:1px solid #f3eee8}.step .num{font-weight:600;color:#c97}.sd{font-size:12px;color:#777}
.risk{flex-direction:column;border-left:3px solid #ccc;padding-left:10px;margin:6px 0}.risk.critical{border-color:#e0788a}.risk.medium{border-color:#e0a868}.risk.low{border-color:#bbb}
</style>
<div class="eyebrow">NÁHLED — TechCars CFO report (obsah, ne přesný skin portálu)</div>
${d.blocks.map(block).join('\n')}
<h2 class="h2">Ledger — souhrn po letech (záložka Cashflow)</h2>
<div class="card"><table><tr><th>Rok</th><th>Tržby</th><th>Náklady</th><th>EBITDA</th><th></th></tr>${ledgerYears}</table>
<div class="note">Bank balance: ${czk(d.ledger.bank_balance)} · Pohledávky: ${d.receivables.invoices_issued.length} · Závazky: ${d.receivables.invoices_received.length} · Fixní náklady položek: ${d.fixed_costs.length}</div></div>`

writeFileSync(new URL('../data/techcars/preview.html', import.meta.url), html)
console.log('Náhled:', new URL('../data/techcars/preview.html', import.meta.url).pathname.replace(/^\//, ''))
console.log('Bloků:', d.blocks.length)

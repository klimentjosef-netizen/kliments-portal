'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, BarController, LineController, Tooltip, Legend, Filler,
} from 'chart.js'
import { type Ledger, fmt } from './calcEngine'
import { type WhatIfBase, TECHCARS_BASE } from './calcWhatIfAuto'
import { PeriodBadge } from './period'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, BarController, LineController, Tooltip, Legend, Filler)

export type CfItem = { id: string; date: string; label: string; amount: number }
export type CfSchedule = { start_cash?: number; weekly_op?: number; buffer?: number; items?: CfItem[] }

interface Props {
  ledger: Ledger
  whatifBase?: Partial<WhatIfBase>
  schedule?: CfSchedule
  onScheduleChange: (s: CfSchedule) => void
}

function mondayOf(d: Date) {
  const x = new Date(d); const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x
}

export default function WeeklyCashflowTab({ ledger, whatifBase, schedule, onScheduleChange }: Props) {
  const base: WhatIfBase = { ...TECHCARS_BASE, ...whatifBase }
  const planMonthEbitda = Math.round(((base.annual_revenue + base.other_income) - base.annual_revenue * base.material_pct / 100 - base.fixed_annual) / 12)

  const s: Required<CfSchedule> = {
    start_cash: schedule?.start_cash ?? (ledger.bank_balance || 0),
    weekly_op: schedule?.weekly_op ?? Math.round(planMonthEbitda / 4.345),
    buffer: schedule?.buffer ?? 0,
    items: schedule?.items ?? [],
  }
  const patch = (p: Partial<CfSchedule>) => onScheduleChange({ ...s, ...p })

  const [newDate, setNewDate] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newAmount, setNewAmount] = useState('')

  // 13 týdnů od tohoto pondělí
  const start = mondayOf(new Date())
  const weeks = Array.from({ length: 13 }, (_, i) => {
    const ws = new Date(start); ws.setDate(start.getDate() + i * 7)
    const we = new Date(ws); we.setDate(ws.getDate() + 7)
    return { ws, we }
  })
  const inWeek = (d: string, ws: Date, we: Date) => { const t = new Date(d).getTime(); return t >= ws.getTime() && t < we.getTime() }

  let bal = s.start_cash
  const rows = weeks.map(({ ws, we }) => {
    const wItems = s.items.filter((it) => it.date && inWeek(it.date, ws, we))
    const planned = wItems.reduce((a, it) => a + (it.amount || 0), 0)
    const net = s.weekly_op + planned
    bal += net
    return { ws, we, label: `${ws.getDate()}.${ws.getMonth() + 1}.`, planned, net, bal, items: wItems }
  })
  const firstBreach = rows.find((r) => r.bal < s.buffer)
  const minBal = Math.min(...rows.map((r) => r.bal))

  // graf
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<ChartJS | null>(null)
  useEffect(() => {
    if (!canvasRef.current) return
    chartRef.current?.destroy()
    chartRef.current = new ChartJS(canvasRef.current, {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.label),
        datasets: [
          { type: 'bar', label: 'Čistý tok', data: rows.map((r) => r.net), backgroundColor: rows.map((r) => r.net >= 0 ? '#a8c3a0' : '#e8c5c9'), borderRadius: 4, barPercentage: 0.55, yAxisID: 'y' },
          { type: 'line', label: 'Zůstatek na účtě', data: rows.map((r) => r.bal), borderColor: '#1f1a18', backgroundColor: 'rgba(31,26,24,0.05)', borderWidth: 2, pointRadius: 2, pointBackgroundColor: rows.map((r) => r.bal < s.buffer ? '#a4373a' : '#1f1a18'), tension: 0.3, fill: true, yAxisID: 'y1' },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { font: { size: 11, family: 'Outfit' }, usePointStyle: true, pointStyleWidth: 8, padding: 16 } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.raw).toLocaleString('cs-CZ')} Kč` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10, family: 'Outfit' } } },
          y: { position: 'left', grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10, family: 'Outfit' }, callback: (v) => Number(v).toLocaleString('cs-CZ') } },
          y1: { position: 'right', grid: { display: false }, ticks: { font: { size: 10, family: 'Outfit' }, callback: (v) => Number(v).toLocaleString('cs-CZ') } },
        },
      },
    })
    return () => { chartRef.current?.destroy(); chartRef.current = null }
    // překreslit jen při změně rozvrhu, ne při psaní do formuláře
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.start_cash, s.weekly_op, s.buffer, JSON.stringify(s.items)])

  function addItem() {
    const amt = parseFloat(newAmount)
    if (!newDate || !newLabel.trim() || !amt) return
    patch({ items: [...s.items, { id: `cf-${Date.now()}`, date: newDate, label: newLabel.trim(), amount: Math.round(amt) }] })
    setNewDate(''); setNewLabel(''); setNewAmount('')
  }
  function removeItem(id: string) { patch({ items: s.items.filter((it) => it.id !== id) }) }

  const card = 'bg-white rounded-[20px] p-6 border border-black/[0.06]'
  const inputCls = 'bg-sand-pale rounded-lg px-3 py-2 text-[0.85rem] text-ink outline-none focus:ring-1 focus:ring-rose'

  return (
    <div className="space-y-6">
      <div className="bg-ink rounded-[20px] p-6 text-sand">
        <div className="mb-2"><PeriodBadge kind="forecast" text="Výhled · 13 týdnů dopředu" /></div>
        <h3 className="font-serif text-xl font-light mb-1">Týdenní cashflow</h3>
        <p className="text-[0.82rem] text-white/55 leading-relaxed">
          Kolik budeš mít na účtě každý týden. Nastav startovní hotovost a týdenní provozní odhad,
          přidej plánované platby (DPH, mzdy, splátky, velké výdaje, keš) a graf ukáže, kde se to láme.
        </p>
      </div>

      {firstBreach ? (
        <div className="bg-rose/10 border border-rose/20 rounded-2xl px-5 py-3 text-[0.82rem] text-rose-deep">
          ⚠ Hotovost spadne pod rezervu v týdnu <strong>{firstBreach.label}</strong> na {fmt(Math.round(firstBreach.bal))}. Posuň plánované výdaje nebo zajisti příjem dřív.
        </div>
      ) : (
        <div className="bg-green/10 border border-green/20 rounded-2xl px-5 py-3 text-[0.82rem] text-green">
          ✓ Hotovost po celých 13 týdnů zůstává nad rezervou. Nejníže {fmt(Math.round(minBal))}.
        </div>
      )}

      {/* Nastavení */}
      <div className={card}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {([['Startovní hotovost (Kč)', s.start_cash, (v: number) => patch({ start_cash: v })],
            ['Týdenní provozní odhad (Kč)', s.weekly_op, (v: number) => patch({ weekly_op: v })],
            ['Minimální rezerva (Kč)', s.buffer, (v: number) => patch({ buffer: v })]] as [string, number, (v: number) => void][]).map(([label, v, set]) => (
            <label key={label} className="block">
              <span className="text-[0.62rem] tracking-[0.1em] uppercase text-mid block mb-1">{label}</span>
              <input type="number" value={v} onChange={(e) => set(parseFloat(e.target.value) || 0)} className={`${inputCls} w-full`} />
            </label>
          ))}
        </div>
        <p className="text-[0.68rem] text-mid mt-3">Týdenní provozní odhad je rozpočítaný plán ({fmt(planMonthEbitda)}/měsíc). Až dorazí saldokonta z Premieru, nahradíme ho reálným časováním pohledávek a závazků.</p>
      </div>

      {/* Graf */}
      <div className={card}>
        <h4 className="font-serif text-base text-ink mb-4">Peníze na účtě · 13 týdnů</h4>
        <div className="h-64"><canvas ref={canvasRef} /></div>
      </div>

      {/* Plánované platby */}
      <div className={card}>
        <h4 className="font-serif text-base text-ink mb-4">Plánované platby a příjmy</h4>
        <div className="flex flex-wrap gap-2 items-end mb-4">
          <label className="flex-1 min-w-[130px]"><span className="text-[0.6rem] tracking-[0.1em] uppercase text-mid block mb-1">Datum</span>
            <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className={`${inputCls} w-full`} /></label>
          <label className="flex-[2] min-w-[160px]"><span className="text-[0.6rem] tracking-[0.1em] uppercase text-mid block mb-1">Popis</span>
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="DPH / mzdy / splátka / velká objednávka…" className={`${inputCls} w-full`} /></label>
          <label className="flex-1 min-w-[120px]"><span className="text-[0.6rem] tracking-[0.1em] uppercase text-mid block mb-1">Částka (+/−)</span>
            <input type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="−45000" className={`${inputCls} w-full`} /></label>
          <button onClick={addItem} className="bg-rose text-white rounded-full px-4 py-2 text-[0.8rem] font-medium hover:bg-rose-deep transition-colors">Přidat</button>
        </div>
        {s.items.length === 0 ? (
          <p className="text-[0.78rem] text-mid">Zatím žádné plánované platby. Přidej třeba splatnost DPH (25.), mzdy, nájem, splátku úvěru nebo velkou objednávku zboží.</p>
        ) : (
          <div className="space-y-1.5">
            {[...s.items].sort((a, b) => a.date.localeCompare(b.date)).map((it) => (
              <div key={it.id} className="flex items-center justify-between text-[0.82rem] border-t border-black/[0.04] py-1.5">
                <span className="text-mid w-20">{new Date(it.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })}</span>
                <span className="flex-1 text-ink px-2">{it.label}</span>
                <span className={`w-28 text-right font-medium ${it.amount >= 0 ? 'text-green' : 'text-rose-deep'}`}>{it.amount >= 0 ? '+' : ''}{fmt(it.amount)}</span>
                <button onClick={() => removeItem(it.id)} className="text-mid hover:text-rose-deep ml-3 text-sm" aria-label="Smazat">×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabulka týdnů */}
      <div className={`${card} overflow-x-auto`}>
        <h4 className="font-serif text-base text-ink mb-4">Týden po týdnu</h4>
        <table className="w-full text-[0.8rem]">
          <thead>
            <tr className="text-[0.6rem] tracking-[0.1em] uppercase text-mid">
              <th className="text-left pb-2 font-medium">Týden od</th>
              <th className="text-right pb-2 font-medium">Provoz</th>
              <th className="text-right pb-2 font-medium">Plánované</th>
              <th className="text-right pb-2 font-medium">Čistý tok</th>
              <th className="text-right pb-2 font-medium">Zůstatek</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={`border-t border-black/[0.04] ${r.bal < s.buffer ? 'bg-rose/[0.04]' : ''}`}>
                <td className="py-1.5 text-ink">{r.label}</td>
                <td className="py-1.5 text-right text-mid">{fmt(Math.round(s.weekly_op))}</td>
                <td className={`py-1.5 text-right ${r.planned === 0 ? 'text-mid/40' : r.planned > 0 ? 'text-green' : 'text-rose-deep'}`}>{r.planned ? fmt(Math.round(r.planned)) : '·'}</td>
                <td className={`py-1.5 text-right ${r.net >= 0 ? 'text-green' : 'text-rose-deep'}`}>{fmt(Math.round(r.net))}</td>
                <td className={`py-1.5 text-right font-semibold ${r.bal < s.buffer ? 'text-rose-deep' : 'text-ink'}`}>{fmt(Math.round(r.bal))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { fmt } from './calcEngine'
import {
  type WhatIfBase, type WhatIfLevers, ZERO_LEVERS,
  calcWhatIfAuto, breakEvenRevenue, TECHCARS_BASE,
} from './calcWhatIfAuto'
import { PeriodBadge } from './period'

interface WhatIfTabProps {
  base?: Partial<WhatIfBase>
  onBaseChange: (base: WhatIfBase) => void
  eshop?: boolean
}

const PRESETS_AUTO: { label: string; levers: WhatIfLevers }[] = [
  { label: 'Bod zvratu (díly +4 p.b.)', levers: { ...ZERO_LEVERS, material_pp: 4 } },
  { label: 'Pokles tržeb −10 %', levers: { ...ZERO_LEVERS, revenue_pct: -10 } },
  { label: 'Růst +10 % + díly +2 p.b.', levers: { ...ZERO_LEVERS, revenue_pct: 10, material_pp: 2 } },
  { label: 'Úspora fixních −200k', levers: { ...ZERO_LEVERS, fixed_delta: -200000 } },
]
const PRESETS_ESHOP: { label: string; levers: WhatIfLevers }[] = [
  { label: 'Marketing −250k', levers: { ...ZERO_LEVERS, fixed_delta: -250000 } },
  { label: 'Pokles tržeb −10 %', levers: { ...ZERO_LEVERS, revenue_pct: -10 } },
  { label: 'Marže zboží +4 p.b.', levers: { ...ZERO_LEVERS, material_pp: 4 } },
  { label: 'Marketing −150k + tržby +10 %', levers: { ...ZERO_LEVERS, fixed_delta: -150000, revenue_pct: 10 } },
]

export default function WhatIfTab({ base, onBaseChange, eshop }: WhatIfTabProps) {
  const b: WhatIfBase = { ...TECHCARS_BASE, ...base }
  const [levers, setLevers] = useState<WhatIfLevers>(ZERO_LEVERS)
  const PRESETS = eshop ? PRESETS_ESHOP : PRESETS_AUTO

  const now = calcWhatIfAuto(b, ZERO_LEVERS)
  const sc = calcWhatIfAuto(b, levers)
  const beRev = breakEvenRevenue(b, levers)
  const ebitDelta = sc.ebit - now.ebit
  const hasChange = JSON.stringify(levers) !== JSON.stringify(ZERO_LEVERS)

  function setLever<K extends keyof WhatIfLevers>(k: K, v: number) {
    setLevers((l) => ({ ...l, [k]: v }))
  }
  function setBase<K extends keyof WhatIfBase>(k: K, v: number) {
    onBaseChange({ ...b, [k]: isNaN(v) ? 0 : v })
  }

  const card = 'bg-white rounded-[20px] p-6 border border-black/[0.06]'
  const numCls = 'w-full bg-transparent border-b border-black/10 py-1.5 text-sm outline-none focus:border-rose text-right transition-colors'
  const sign = (n: number) => (n >= 0 ? '+' : '')

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="bg-ink rounded-[20px] p-6 text-sand">
        <div className="mb-2"><PeriodBadge kind="forecast" text="Výhled · simulace, ne data" /></div>
        <h3 className="font-serif text-xl font-light mb-1">Co kdyby… 🔮</h3>
        <p className="text-[0.82rem] text-white/55 leading-relaxed">
          Posouvej páky a hned uvidíš, co to udělá s ročním ziskem a cashem. Vychází to z informativních
          čísel za uzavřené roky 2024/2025 · slouží k modelování, ne jako účetní výkaz.
        </p>
      </div>

      {/* Moje čísla · editovatelná báze */}
      <div className={card}>
        <h3 className="font-serif text-base text-ink mb-1">Moje čísla (základ scénáře)</h3>
        <p className="text-[0.75rem] text-mid mb-4">Tady si uprav výchozí hodnoty, ať scénáře sedí na tvoji firmu. Ukládá se automaticky.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
          {[
            { k: 'annual_revenue' as const, label: 'Roční tržby (Kč)' },
            { k: 'material_pct' as const, label: eshop ? 'Náklad na zboží (% tržeb)' : 'Materiál / díly (% tržeb)' },
            { k: 'fixed_annual' as const, label: eshop ? 'Fixní náklady ročně · vč. marketingu (Kč)' : 'Fixní náklady ročně (Kč)' },
            ...(eshop ? [] : [{ k: 'labor_share_pct' as const, label: 'Z toho práce (% tržeb)' }]),
            { k: 'other_income' as const, label: 'Ostatní výnosy ročně (Kč)' },
            { k: 'depreciation_annual' as const, label: 'Odpisy ročně (Kč)' },
          ].map((f) => (
            <label key={f.k} className="block">
              <span className="text-[0.62rem] tracking-[0.08em] uppercase text-mid block mb-1">{f.label}</span>
              <input type="number" className={numCls} value={Math.round(b[f.k])}
                onChange={(e) => setBase(f.k, parseFloat(e.target.value))} />
            </label>
          ))}
        </div>
      </div>

      {/* Páky */}
      <div className={card}>
        <h3 className="font-serif text-base text-ink mb-4">Páky · co když změním…</h3>
        <div className="space-y-5">
          <Slider label={eshop ? 'Marže zboží' : 'Marže na dílech'} hint={eshop ? 'lepší nákup / ceny' : 'lepší nákup / přirážka'} value={levers.material_pp}
            min={-10} max={15} step={0.5} unit=" p.b." color="#7bbf8a" onChange={(v) => setLever('material_pp', v)} />
          <Slider label="Tržby" hint={eshop ? 'víc/míň objednávek' : 'víc/míň zakázek'} value={levers.revenue_pct}
            min={-30} max={30} step={1} unit=" %" color="#88aedd" onChange={(v) => setLever('revenue_pct', v)} />
          {!eshop && (
            <Slider label="Hodinová sazba práce" hint="zdražení práce" value={levers.hourly_pct}
              min={-20} max={30} step={1} unit=" %" color="#c99" onChange={(v) => setLever('hourly_pct', v)} />
          )}
          <Slider label={eshop ? 'Marketing a fixní náklady' : 'Fixní náklady'} hint={eshop ? 'reklama, mzdy, nájem (Kč/rok)' : 'mzdy, nájem, režie (Kč/rok)'} value={levers.fixed_delta}
            min={-1000000} max={1000000} step={25000} unit=" Kč" color="#e0a868" onChange={(v) => setLever('fixed_delta', v)} />
        </div>
        <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-black/[0.06]">
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => setLevers(p.levers)}
              className="text-[0.72rem] px-3 py-1.5 rounded-full border border-black/10 text-mid hover:border-rose hover:text-rose transition-colors">
              {p.label}
            </button>
          ))}
          {hasChange && (
            <button onClick={() => setLevers(ZERO_LEVERS)}
              className="text-[0.72rem] px-3 py-1.5 rounded-full bg-sand-pale text-ink hover:bg-sand transition-colors">
              ↺ Vynulovat
            </button>
          )}
        </div>
      </div>

      {/* Výsledek */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Result label="Provozní výsledek / rok" now={now.ebit} scenario={sc.ebit} />
        <Result label="EBITDA / rok" now={now.ebitda} scenario={sc.ebitda} />
        <div className={`${card} ${ebitDelta >= 0 ? 'bg-green/[0.06]' : 'bg-rose/[0.06]'}`}>
          <div className="text-[0.62rem] tracking-[0.08em] uppercase text-mid mb-1">Rozdíl vs dnes</div>
          <div className={`font-serif text-2xl font-light ${ebitDelta >= 0 ? 'text-green' : 'text-rose-deep'}`}>
            {sign(ebitDelta)}{fmt(Math.round(ebitDelta))}
          </div>
          <div className="text-[0.72rem] text-mid mt-1">{sign(ebitDelta)}{fmt(Math.round(ebitDelta / 12))} / měsíc</div>
        </div>
        <div className={card}>
          <div className="text-[0.62rem] tracking-[0.08em] uppercase text-mid mb-1">Bod zvratu (tržby)</div>
          <div className="font-serif text-2xl font-light text-ink">{isFinite(beRev) ? fmt(Math.round(beRev)) : '·'}</div>
          <div className="text-[0.72rem] text-mid mt-1">
            {isFinite(beRev) ? (sc.revenue >= beRev ? '✓ nad bodem zvratu' : `chybí ${fmt(Math.round(beRev - sc.revenue))} tržeb`) : ''}
          </div>
        </div>
      </div>

      <p className="text-[0.72rem] text-mid px-1">
        {eshop
          ? 'Pozn.: model je zjednodušený · náklad na zboží škáluje s tržbami, marketing a fixní náklady jsou v „Marketing a fixní náklady“. Slouží k orientaci, ne jako účetní projekce.'
          : 'Pozn.: model je zjednodušený (materiál škáluje s tržbami, zvýšení hodinové sazby zvedá jen práci). Slouží k orientaci a rozhodování, ne jako přesná účetní projekce.'}
      </p>
    </div>
  )
}

function Slider({ label, hint, value, min, max, step, unit, color, onChange }: {
  label: string; hint: string; value: number; min: number; max: number; step: number; unit: string; color: string; onChange: (v: number) => void
}) {
  const disp = unit === ' Kč' ? fmt(value) : value.toLocaleString('cs-CZ')
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-sm text-ink font-medium">{label} <span className="text-[0.7rem] text-mid font-normal">· {hint}</span></span>
        <span className="text-sm font-semibold" style={{ color }}>{value > 0 ? '+' : ''}{disp}{unit === ' Kč' ? '' : unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full" style={{ accentColor: color }} />
    </div>
  )
}

function Result({ label, now, scenario }: { label: string; now: number; scenario: number }) {
  return (
    <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
      <div className="text-[0.62rem] tracking-[0.08em] uppercase text-mid mb-1">{label}</div>
      <div className={`font-serif text-2xl font-light ${scenario >= 0 ? 'text-green' : 'text-rose-deep'}`}>{fmt(Math.round(scenario))}</div>
      <div className="text-[0.72rem] text-mid mt-1">dnes: {fmt(Math.round(now))}</div>
    </div>
  )
}

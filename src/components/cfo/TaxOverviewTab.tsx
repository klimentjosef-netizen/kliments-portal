'use client'

import { type Ledger, fmt } from './calcEngine'
import { type WhatIfBase, TECHCARS_BASE } from './calcWhatIfAuto'
import { ledgerByYear } from './cfoInsights'
import { PeriodBadge } from './period'

interface Props {
  ledger: Ledger
  whatifBase?: Partial<WhatIfBase>
  eshop?: boolean
}

const DPPO = 0.21 // sazba daně z příjmu právnických osob
const DPH = 0.21  // základní sazba DPH

export default function TaxOverviewTab({ ledger, whatifBase, eshop }: Props) {
  const base: WhatIfBase = { ...TECHCARS_BASE, ...whatifBase }
  const years = ledgerByYear({ ledger })
  const cy = new Date().getFullYear()

  // Dopředu · odhad měsíčního odvodu DPH ≈ (tržby − materiál/vstupy) × sazba
  const mRevenue = base.annual_revenue / 12
  const mMaterial = base.annual_revenue * base.material_pct / 100 / 12
  const dphMonthly = Math.max(0, (mRevenue - mMaterial) * DPH)

  // Odhad roční daně z příjmu z modelu (EBIT po odpisech)
  const ebitYear = (base.annual_revenue + base.other_income) - base.annual_revenue * base.material_pct / 100 - base.fixed_annual
  const dppoYear = Math.max(0, ebitYear) * DPPO

  const card = 'bg-white rounded-[20px] p-6 border border-black/[0.06]'

  const levers = [
    { t: 'Kapitalizace půjčky společníka', d: 'Vlož půjčku do vlastního kapitálu · řeší předlužení (záporný VK) a zjednoduší daňový obraz. Úroky z půjčky mají limity daňové uznatelnosti.' },
    eshop
      ? { t: 'Ocenění a odpis zásob', d: 'Neprodejné nebo zastaralé zboží lze odepsat / vytvořit opravnou položku · sníží základ daně a uvolní sklad. Hlídat ocenění zásob ke konci roku.' }
      : { t: 'Načasování investic a odpisy', d: 'Větší nákup techniky před koncem roku sníží základ daně přes odpisy. Zvaž jednorázový vs rozložený odpis podle toho, kdy potřebuješ snížit zisk.' },
    { t: 'Osobní vs provozní náklady', d: 'Jen provozní náklady jsou daňově uznatelné. Štítek „osobní" v Doplnit data drží tuhle hranici čistou · neriskuj dodanění neuznatelných výdajů (auto, strava).' },
    eshop
      ? { t: 'DPH · nadměrný odpočet a OSS', d: 'Import a marketing v reverse-charge často znamenají nadměrný odpočet DPH (vratky od FÚ). Hlídat měsíční odpočet a režim OSS, pokud prodáváš do EU.' }
      : { t: 'Rezervy a opravy', d: 'Zákonná rezerva na opravy majetku rozloží náklad a sníží základ v ziskových letech.' },
    { t: 'Uplatnění ztráty', d: 'Daňovou ztrátu z minulých let lze odečíst od základu v dalších až 5 letech · v roce, kdy se firma dostane do zisku, sníží daň.' },
  ]

  return (
    <div className="space-y-6">
      <div className="bg-ink rounded-[20px] p-6 text-sand">
        <div className="mb-2"><PeriodBadge kind="forecast" text="Odhady z modelu · ne daňové přiznání" /></div>
        <h3 className="font-serif text-xl font-light mb-1">Daně · zpětně i dopředu</h3>
        <p className="text-[0.82rem] text-white/55 leading-relaxed">
          Kolik jsi odvedl a kolik tě čeká · plus páky, jak daň legálně optimalizovat. Čísla jsou orientační
          odhady z modelu; přesné částky dá účetní z přiznání. DPH máš měsíční, splatnost vždy 25.
        </p>
      </div>

      {/* Dopředu */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={card}>
          <div className="text-[0.6rem] tracking-[0.08em] uppercase text-mid mb-1">DPH · odhad měsíčně</div>
          <div className="font-serif text-2xl font-light text-ink">{fmt(Math.round(dphMonthly))}</div>
          <div className="text-[0.68rem] text-mid mt-1">splatnost 25. následujícího měsíce</div>
        </div>
        <div className={card}>
          <div className="text-[0.6rem] tracking-[0.08em] uppercase text-mid mb-1">DPH · odhad ročně</div>
          <div className="font-serif text-2xl font-light text-ink">{fmt(Math.round(dphMonthly * 12))}</div>
          <div className="text-[0.68rem] text-mid mt-1">12× měsíční odvod</div>
        </div>
        <div className={card}>
          <div className="text-[0.6rem] tracking-[0.08em] uppercase text-mid mb-1">Daň z příjmu · odhad {cy}</div>
          <div className={`font-serif text-2xl font-light ${dppoYear > 0 ? 'text-ink' : 'text-green'}`}>{fmt(Math.round(dppoYear))}</div>
          <div className="text-[0.68rem] text-mid mt-1">{dppoYear > 0 ? `${Math.round(DPPO * 100)} % ze zisku` : 'ztráta · daň 0, lze přenést'}</div>
        </div>
      </div>

      {/* Zpětně */}
      <div className={`${card} overflow-x-auto`}>
        <h4 className="font-serif text-base text-ink mb-1">Zpětně · daňová zátěž po letech</h4>
        <p className="text-[0.72rem] text-mid mb-4">Odhad daně z příjmu z provozního výsledku. DPH a odvody doplníme z evidence účetní.</p>
        {years.length === 0 ? (
          <p className="text-[0.8rem] text-mid">Zatím žádná uzavřená data.</p>
        ) : (
          <table className="w-full text-[0.82rem]">
            <thead>
              <tr className="text-[0.6rem] tracking-[0.1em] uppercase text-mid">
                <th className="text-left pb-2 font-medium">Rok</th>
                <th className="text-right pb-2 font-medium">Tržby</th>
                <th className="text-right pb-2 font-medium">Provozní zisk</th>
                <th className="text-right pb-2 font-medium">Odhad daně z příjmu</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => {
                const dan = Math.max(0, y.zisk) * DPPO
                return (
                  <tr key={y.year} className="border-t border-black/[0.04]">
                    <td className="py-2 text-ink font-medium">{y.year}</td>
                    <td className="py-2 text-right text-mid">{fmt(Math.round(y.trzby))}</td>
                    <td className={`py-2 text-right ${y.zisk >= 0 ? 'text-green' : 'text-rose-deep'}`}>{fmt(Math.round(y.zisk))}</td>
                    <td className="py-2 text-right text-ink">{dan > 0 ? fmt(Math.round(dan)) : '0 · ztráta'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Páky */}
      <div className={card}>
        <h4 className="font-serif text-base text-ink mb-4">Optimalizační páky</h4>
        <div className="space-y-3">
          {levers.map((l, i) => (
            <div key={i} className="border-t border-black/[0.04] pt-3 first:border-0 first:pt-0">
              <div className="text-[0.86rem] font-medium text-ink mb-0.5">{l.t}</div>
              <div className="text-[0.78rem] text-mid leading-relaxed">{l.d}</div>
            </div>
          ))}
        </div>
        <p className="text-[0.7rem] text-mid mt-4">Konkrétní dopady probereme nad reálnými čísly · tohle jsou směry, ne daňové poradenství.</p>
      </div>
    </div>
  )
}

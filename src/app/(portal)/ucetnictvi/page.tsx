'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'

// Živý přehled účetnictví klienta · počítá databázová funkce kl_prehled
// (předběžně z vytěžených dokladů a banky, bez účetních úprav a odpisů).

type Prehled = {
  klient: { nazev: string; ico: string; platce_dph: boolean; perioda_dph: string | null; forma: string | null }
  rok: number
  aktualnost: { posledni_doklad: string | null; posledni_pohyb_banky: string | null; ceka_na_zpracovani: number; bez_kurzu: number }
  banka: { prijmy: number; vydaje: number; pohybu: number }
  saldo: {
    vydane_otevrene_pocet: number; vydane_otevrene: number; vydane_po_splatnosti: number
    prijate_otevrene_pocet: number; prijate_otevrene: number; prijate_po_splatnosti: number; neovereno: number
  }
  dph:
    | { platce: true; perioda_nastavena: boolean; obdobi_od: string; obdobi_do: string; podat_do: string; na_vystupu: number; na_vstupu: number; vysledek: number; dokladu: number }
    | { platce: false; obrat_12m: number; limit: number; limit_okamzity: number; od: string }
  dan: { vynosy: number; naklady: number; mzdy: number; zaklad: number; sazba: number | null; odhad_dane: number }
  chybi: { pocet: number; castka: number; podle_protistrany: { protistrana: string; pocet: number; castka: number }[] }
}

type Klient = { id: string; name: string; ico: string }
type Nalez = {
  id: string; kind: string; counterparty_name: string | null; doc_number: string | null
  issue_date: string | null; amount_total: number | null; currency: string; description: string | null
  storage_path: string | null; file_name: string | null
}

const kc = (n: number | null | undefined) =>
  n == null ? '·' : `${Math.round(n).toLocaleString('cs-CZ')} Kč`
const den = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }) : 'zatím nic'
const DRUH: Record<string, string> = {
  received_invoice: 'Přijatá faktura', issued_invoice: 'Vydaná faktura', credit_note: 'Dobropis',
  receipt: 'Účtenka', advance: 'Záloha', bank_statement: 'Výpis', payment_report: 'Vyúčtování brány',
  contract: 'Smlouva', payroll: 'Mzdy', tax: 'Daně', other: 'Ostatní', unknown: 'Nezařazeno',
}

function Dlazdice({ nadpis, children, tone = 'white' }: { nadpis: string; children: React.ReactNode; tone?: 'white' | 'ink' }) {
  return (
    <div className={`${tone === 'ink' ? 'bg-ink text-sand' : 'bg-white'} rounded-2xl p-5 border border-black/[0.06]`}>
      <div className={`text-[0.68rem] tracking-[0.1em] uppercase mb-3 ${tone === 'ink' ? 'text-white/40' : 'text-mid/70'}`}>{nadpis}</div>
      {children}
    </div>
  )
}

function Radek({ label, value, strong, warn }: { label: string; value: string; strong?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-[0.8rem] text-mid/80">{label}</span>
      <span className={`tabular-nums ${strong ? 'font-serif text-xl text-ink' : 'text-[0.85rem]'} ${warn ? 'text-rose-deep' : ''}`}>{value}</span>
    </div>
  )
}

function Hledani({ clientId }: { clientId: string }) {
  const [q, setQ] = useState('')
  const [vysledky, setVysledky] = useState<Nalez[] | null>(null)
  const [hledam, setHledam] = useState(false)

  async function hledej(e: React.FormEvent) {
    e.preventDefault()
    const slova = q.trim().split(/\s+/).filter((s) => s.length > 2)
    if (!slova.length) return
    setHledam(true)
    const supabase = createClient()
    // Nejdřív shoda v protistraně, čísle dokladu a názvu souboru, potom v popisu
    const hledat = (pole: string[]) => {
      let dotaz = supabase.from('documents')
        .select('id, kind, counterparty_name, doc_number, issue_date, amount_total, currency, description, storage_path, file_name')
        .eq('client_id', clientId).neq('status', 'duplicate')
      for (const s of slova) {
        const v = s.replace(/[%,()]/g, '')
        dotaz = dotaz.or(pole.map((p) => `${p}.ilike.%${v}%`).join(','))
      }
      return dotaz.order('issue_date', { ascending: false, nullsFirst: false }).limit(20)
    }
    const [presne, popis] = await Promise.all([
      hledat(['counterparty_name', 'doc_number', 'file_name']),
      hledat(['description', 'counterparty_name', 'doc_number', 'file_name']),
    ])
    const vse = [...((presne.data as Nalez[]) ?? []), ...((popis.data as Nalez[]) ?? [])]
    setVysledky(vse.filter((d, i) => vse.findIndex((x) => x.id === d.id) === i).slice(0, 20))
    setHledam(false)
  }

  async function stahni(cesta: string) {
    const { data } = await createClient().storage.from('documents').createSignedUrl(cesta, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-black/[0.06] mb-5">
      <form onSubmit={hledej} className="flex gap-2">
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Najít doklad: třeba lednice, Zásilkovna nebo číslo faktury"
          className="flex-1 bg-sand/60 rounded-xl px-4 py-3 text-[0.9rem] outline-none focus:ring-2 focus:ring-rose/40"
        />
        <button className="bg-ink text-sand rounded-xl px-5 text-[0.8rem] tracking-wide disabled:opacity-50" disabled={hledam}>
          {hledam ? 'Hledám' : 'Hledat'}
        </button>
      </form>
      {vysledky && (
        <div className="mt-4 divide-y divide-black/[0.06]">
          {vysledky.length === 0 && <p className="text-[0.82rem] text-mid/70 py-2">Nic jsme nenašli.</p>}
          {vysledky.map((d) => (
            <div key={d.id} className="py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[0.85rem] text-ink truncate">
                  {d.counterparty_name ?? 'bez protistrany'} · {d.doc_number ?? d.file_name ?? ''}
                </div>
                <div className="text-[0.74rem] text-mid/70 truncate">
                  {DRUH[d.kind] ?? d.kind} · {den(d.issue_date)} · {d.description ?? ''}
                </div>
              </div>
              <div className="text-[0.85rem] tabular-nums whitespace-nowrap">
                {d.amount_total != null ? `${d.amount_total.toLocaleString('cs-CZ')} ${d.currency}` : ''}
              </div>
              {d.storage_path ? (
                <button onClick={() => stahni(d.storage_path!)} className="text-[0.75rem] text-rose hover:text-rose-deep whitespace-nowrap">Stáhnout</button>
              ) : (
                <span className="text-[0.72rem] text-mid/50 whitespace-nowrap">bez souboru</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type Mesic = {
  mesic: string; na_vystupu: number; na_vstupu: number; vysledek: number; dokladu: number
  zaplaceno: number; datum_platby: string | null; rozdil: number; splatnost: string
  stav: 'prazdny' | 'sedi' | 'ceka' | 'nezaplaceno' | 'nesedi'
}

const STAV: Record<Mesic['stav'], { text: string; barva: string }> = {
  prazdny: { text: 'bez dokladů', barva: 'text-mid/40' },
  sedi: { text: 'odvedeno', barva: 'text-green' },
  ceka: { text: 'čeká na odvod', barva: 'text-mid/70' },
  nezaplaceno: { text: 'neodvedeno', barva: 'text-rose-deep' },
  nesedi: { text: 'nesedí', barva: 'text-amber' },
}

// DPH po měsících: co za měsíc vyšlo z dokladů a co se odvedlo z účtu
function DphMesice({ clientId, rok }: { clientId: string; rok: number }) {
  const [radky, setRadky] = useState<Mesic[] | null>(null)

  useEffect(() => {
    let platne = true
    createClient().rpc('kl_dph_mesice', { p_client: clientId, p_rok: rok })
      .then(({ data }) => { if (platne) setRadky((data as Mesic[]) ?? []) })
    return () => { platne = false }
  }, [clientId, rok])

  const vyplnene = (radky ?? []).filter((m) => m.stav !== 'prazdny')
  if (!vyplnene.length) return null

  return (
    <Dlazdice nadpis={`DPH po měsících · ${rok}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-[0.8rem]">
          <thead>
            <tr className="text-left text-mid/60 border-b border-black/[0.06]">
              <th className="py-2 pr-4 font-normal">Měsíc</th>
              <th className="py-2 pr-4 font-normal text-right">Na výstupu</th>
              <th className="py-2 pr-4 font-normal text-right">Na vstupu</th>
              <th className="py-2 pr-4 font-normal text-right">Vyšlo</th>
              <th className="py-2 pr-4 font-normal text-right">Odvedeno</th>
              <th className="py-2 font-normal">Stav</th>
            </tr>
          </thead>
          <tbody>
            {vyplnene.map((m) => (
              <tr key={m.mesic} className="border-b border-black/[0.04]">
                <td className="py-2 pr-4 whitespace-nowrap">
                  {new Date(m.mesic).toLocaleDateString('cs-CZ', { month: 'long' })}
                  <span className="text-mid/50"> · {m.dokladu} dokladů</span>
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">{kc(m.na_vystupu)}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{kc(m.na_vstupu)}</td>
                <td className="py-2 pr-4 text-right tabular-nums font-medium">{kc(m.vysledek)}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{m.zaplaceno ? kc(m.zaplaceno) : '·'}</td>
                <td className={`py-2 whitespace-nowrap ${STAV[m.stav].barva}`}>
                  {STAV[m.stav].text}
                  {m.stav === 'nesedi' && <span className="text-mid/50"> o {kc(Math.abs(m.rozdil))}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[0.72rem] text-mid/60 mt-3">
        Předpis je z dokladů podle data plnění, odvod z plateb na účet finančního úřadu s předčíslím 705.
        Samovyměření u zahraničních služeb zatím není započítané.
      </p>
    </Dlazdice>
  )
}

type Chybi = {
  bank_transaction_id: string; booked_on: string; amount: number
  counterparty_name: string | null; counterparty_account: string | null; message: string | null
}

// Celý seznam plateb bez dokladu (pohled v_missing_documents, RLS klienta)
function SeznamChybi({ clientId, pocet }: { clientId: string; pocet: number }) {
  const [otevreno, setOtevreno] = useState(false)
  const [radky, setRadky] = useState<Chybi[] | null>(null)

  async function otevri() {
    setOtevreno(!otevreno)
    if (radky) return
    const { data } = await createClient().from('v_missing_documents')
      .select('bank_transaction_id, booked_on, amount, counterparty_name, counterparty_account, message')
      .eq('client_id', clientId).order('booked_on', { ascending: false }).limit(1000)
    setRadky((data as Chybi[]) ?? [])
  }

  const popis = (r: Chybi) => {
    const zprava = (r.message ?? '').replace(/^Nákup:\s*/, '').split(',')[0].replace(/\+/g, ' ').replace(/\s{2,}/g, ' ').trim()
    const jmeno = (r.counterparty_name ?? '').replace(/\s{2,}/g, ' ').trim()
    if (!jmeno) return zprava || r.counterparty_account || 'bez popisu'
    return !zprava || zprava.toLowerCase().startsWith(jmeno.toLowerCase()) ? jmeno : `${jmeno} · ${zprava}`
  }

  return (
    <div className="mt-4">
      <button onClick={otevri} className="text-[0.8rem] text-rose hover:text-rose-deep">
        {otevreno ? 'Skrýt seznam' : `Zobrazit všech ${pocet} plateb`}
      </button>
      {otevreno && (
        <div className="mt-3 overflow-x-auto">
          {!radky ? <p className="text-[0.8rem] text-mid/60">Načítám</p> : (
            <table className="w-full text-[0.8rem]">
              <thead>
                <tr className="text-left text-mid/60 border-b border-black/[0.06]">
                  <th className="py-2 pr-4 font-normal">Datum</th>
                  <th className="py-2 pr-4 font-normal">Komu / za co</th>
                  <th className="py-2 text-right font-normal">Částka</th>
                </tr>
              </thead>
              <tbody>
                {radky.map((r) => (
                  <tr key={r.bank_transaction_id} className="border-b border-black/[0.04]">
                    <td className="py-2 pr-4 whitespace-nowrap tabular-nums">{den(r.booked_on)}</td>
                    <td className="py-2 pr-4">{popis(r)}</td>
                    <td className="py-2 text-right whitespace-nowrap tabular-nums">{kc(-r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function Obsah() {
  const params = useSearchParams()
  const router = useRouter()
  const [klienti, setKlienti] = useState<Klient[]>([])
  const [clientId, setClientId] = useState<string | null>(params.get('klient'))
  const [data, setData] = useState<Prehled | null>(null)
  const [stav, setStav] = useState<'nacitam' | 'hotovo' | 'nic'>('nacitam')

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: k } = await supabase.from('clients').select('id, name, ico').eq('active', true).order('name')
      const seznam = (k as Klient[]) ?? []
      setKlienti(seznam)
      if (!seznam.length) setStav('nic')
      else if (!clientId || !seznam.some((x) => x.id === clientId)) setClientId(seznam[0].id)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const nacti = useCallback(async (id: string) => {
    setStav('nacitam')
    const { data: p } = await createClient().rpc('kl_prehled', { p_client: id })
    setData(p as Prehled)
    setStav('hotovo')
  }, [])

  useEffect(() => { if (clientId) nacti(clientId) }, [clientId, nacti])

  function zmenKlienta(id: string) {
    setClientId(id)
    router.replace(`/ucetnictvi?klient=${id}`)
  }

  if (stav === 'nic') {
    return <p className="text-mid text-sm">Účetnictví u nás zatím nevedete.</p>
  }
  if (!data || stav === 'nacitam') {
    return <div className="animate-pulse space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-32 bg-white rounded-2xl" />)}</div>
  }

  const { aktualnost: a, dph, dan, saldo, banka, chybi } = data
  const podilLimitu = !dph.platce ? Math.min(100, Math.round((dph.obrat_12m / dph.limit) * 100)) : 0

  return (
    <>
      {/* Hlavička: čí data a k jakému dni platí */}
      <div className="bg-ink rounded-[20px] p-6 mb-5 flex flex-col md:flex-row md:items-end gap-4 justify-between">
        <div>
          {klienti.length > 1 ? (
            <select
              value={clientId ?? ''} onChange={(e) => zmenKlienta(e.target.value)}
              className="bg-transparent font-serif text-2xl text-sand font-light outline-none cursor-pointer -ml-1"
            >
              {klienti.map((k) => <option key={k.id} value={k.id} className="text-ink">{k.name}</option>)}
            </select>
          ) : (
            <h2 className="font-serif text-2xl text-sand font-light">{data.klient.nazev}</h2>
          )}
          <p className="text-[0.75rem] text-white/40 mt-1">
            IČO {data.klient.ico} · {data.klient.platce_dph ? 'plátce DPH' : 'neplátce DPH'}
          </p>
        </div>
        <div className="text-[0.78rem] text-white/60 md:text-right leading-relaxed">
          <div>Poslední doklad: <span className="text-sand">{den(a.posledni_doklad)}</span></div>
          <div>Banka zpracována k: <span className="text-sand">{den(a.posledni_pohyb_banky)}</span></div>
          {a.ceka_na_zpracovani > 0 && <div className="text-rose-pale">{a.ceka_na_zpracovani} dokladů čeká na zpracování</div>}
        </div>
      </div>

      {clientId && <Hledani clientId={clientId} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Dlazdice nadpis={`Peníze · ${data.rok}`}>
          <Radek label="Přišlo na účet" value={kc(banka.prijmy)} />
          <Radek label="Odešlo z účtu" value={kc(banka.vydaje)} />
          <div className="h-px bg-black/[0.06] my-2" />
          <Radek label={`Vydané bez spárované platby (${saldo.vydane_otevrene_pocet})`} value={kc(saldo.vydane_otevrene)} />
          <Radek label="z toho po splatnosti" value={kc(saldo.vydane_po_splatnosti)} warn={saldo.vydane_po_splatnosti > 0} />
          <Radek label={`Přijaté neuhrazené (${saldo.prijate_otevrene_pocet})`} value={kc(saldo.prijate_otevrene)} />
          <Radek label="z toho po splatnosti" value={kc(saldo.prijate_po_splatnosti)} warn={saldo.prijate_po_splatnosti > 0} />
        </Dlazdice>

        <Dlazdice nadpis="DPH">
          {dph.platce ? (
            <>
              <div className="text-[0.75rem] text-mid/70 mb-2">
                Období {den(dph.obdobi_od)} až {den(dph.obdobi_do)} · podat do {den(dph.podat_do)}
              </div>
              <Radek label="Na výstupu (z vydaných)" value={kc(dph.na_vystupu)} />
              <Radek label="Na vstupu (z přijatých)" value={kc(dph.na_vstupu)} />
              <div className="h-px bg-black/[0.06] my-2" />
              <Radek label={dph.vysledek >= 0 ? 'Zatím k odvodu' : 'Zatím nadměrný odpočet'} value={kc(Math.abs(dph.vysledek))} strong />
              {!dph.perioda_nastavena && <p className="text-[0.72rem] text-amber mt-2">Perioda DPH není nastavena, počítáme měsíčně.</p>}
            </>
          ) : (
            <>
              <Radek label="Obrat za posledních 12 měsíců" value={kc(dph.obrat_12m)} strong />
              <div className="h-2 bg-sand rounded-full mt-3 overflow-hidden">
                <div className={`h-full ${podilLimitu >= 80 ? 'bg-rose-deep' : 'bg-green'}`} style={{ width: `${podilLimitu}%` }} />
              </div>
              <p className="text-[0.75rem] text-mid/70 mt-2">
                {podilLimitu} % limitu {kc(dph.limit)} pro povinnou registraci k DPH.
              </p>
            </>
          )}
        </Dlazdice>

        <Dlazdice nadpis={`Daň z příjmu ${data.rok}`}>
          <Radek label="Výnosy" value={kc(dan.vynosy)} />
          <Radek label="Náklady z dokladů" value={kc(dan.naklady)} />
          {dan.mzdy > 0 && <Radek label="Mzdy a odvody" value={kc(dan.mzdy)} />}
          <div className="h-px bg-black/[0.06] my-2" />
          <Radek label={dan.zaklad >= 0 ? 'Základ daně zatím' : 'Ztráta zatím'} value={kc(dan.zaklad)} strong />
          {dan.sazba != null && dan.odhad_dane > 0 && <Radek label={`Odhad daně ${Math.round(dan.sazba * 100)} %`} value={kc(dan.odhad_dane)} />}
          <p className="text-[0.72rem] text-mid/60 mt-2">Předběžně z dokladů, bez účetních úprav a odpisů.</p>
        </Dlazdice>
      </div>

      {dph.platce && clientId && (
        <div className="mb-4">
          <DphMesice key={clientId} clientId={clientId} rok={data.rok} />
        </div>
      )}

      <Dlazdice nadpis="Co chybí">
        {chybi.pocet === 0 ? (
          <p className="text-[0.85rem] text-green">Ke všem platbám máme doklad.</p>
        ) : (
          <>
            <p className="text-[0.85rem] text-ink mb-3">
              <span className="font-serif text-xl">{chybi.pocet}</span> plateb bez dokladu za <span className="font-serif text-xl">{kc(chybi.castka)}</span>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              {chybi.podle_protistrany.map((p) => (
                <Radek key={p.protistrana} label={`${p.protistrana} (${p.pocet}×)`} value={kc(p.castka)} />
              ))}
            </div>
            {clientId && <SeznamChybi key={clientId} clientId={clientId} pocet={chybi.pocet} />}
          </>
        )}
      </Dlazdice>

      {(saldo.neovereno > 0 || a.bez_kurzu > 0) && (
        <p className="text-[0.72rem] text-mid/60 mt-4">
          {saldo.neovereno > 0 && `${saldo.neovereno} dokladů zatím bez přečtené částky, do salda nezapočteny. `}
          {a.bez_kurzu > 0 && `${a.bez_kurzu} dokladů v cizí měně čeká na kurz ČNB.`}
        </p>
      )}
    </>
  )
}

export default function UcetnictviPage() {
  return (
    <>
      <Topbar title="Účetnictví" />
      <div className="p-4 lg:p-9">
        <Suspense fallback={null}>
          <Obsah />
        </Suspense>
      </div>
    </>
  )
}

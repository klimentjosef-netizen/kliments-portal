// Ceníky za vedení účetnictví podle smluv (clients.pricing).
// Počet "účetních podkladů" = zápisy v účetním deníku za kalendářní měsíc
// (přijatá i vydaná faktura, bankovní transakce, pokladní i interní doklad,
// mzdový podklad). Faktura se vystavuje 10. dne následujícího měsíce.
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  fs.readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const [k, ...v] = l.split('='); return [k, v.join('=').replace(/^"|"$/g, '')] }),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// Smlouva firsen (Media Level, BOZA REKO, Weekendovka): pásma podle počtu podkladů
const PASMA_FIRSEN = {
  model: 'pasma', zaklad_nazev: 'Měsíční paušál podle počtu účetních podkladů',
  pasma: [
    { do: 50, cena: 3000 }, { do: 100, cena: 4000 }, { do: 200, cena: 6000 },
    { do: 350, cena: 8500 }, { do: 500, cena: 11000 }, { do: 700, cena: 14000 },
    { do: 1000, cena: 18000 },
  ],
  nad_limit: { od: 1001, cena: null, poznamka: 'nad 1 000 podkladů dohodou' },
  priplatky: { hpp: 350, dpp: 200, pomocne_prace_h: 800, poradenstvi_h: 2500 },
  splatnost_dni: 7, fakturovat_den: 10, ceny_bez_dph: true,
  zdroj: 'Smlouva o vedení účetnictví firsen',
}

// Smlouva Maliiisa: pásma podle počtu pohybů na účtu 221 v účetním SW
const PASMA_MALIIISA = {
  model: 'pasma', zaklad_nazev: 'Měsíční paušál podle počtu bankovních pohybů',
  pasma: [{ do: 150, cena: 3000 }, { do: 300, cena: 5000 }, { do: 600, cena: 7500 }, { do: 1000, cena: 10000 }],
  nad_limit: { od: 1001, cena: null, poznamka: 'nad 1 000 pohybů dohodou' },
  priplatky: { hpp: 350, dpp: 200, pomocne_prace_h: 800, poradenstvi_h: 2500 },
  splatnost_dni: 7, fakturovat_den: 10, ceny_bez_dph: true,
  zdroj: 'Smlouva o vedení účetnictví Maliiisa',
}

// Podmínky spolupráce MB&AL: pevný paušál
const PAUSAL_MBAL = {
  model: 'pausal', zaklad: 2500, zaklad_nazev: 'Měsíční vedení účetnictví',
  priplatek_dph: 2500,
  rocni: { zaverka_od: 4000, dppo_od: 2000 },
  priplatky: { hpp: 350, dpp: 200, registrace_zamestnavatele: 1500, vicepract_h: 1500 },
  splatnost_dni: 14, fakturovat_den: 10, ceny_bez_dph: true,
  zdroj: 'Podmínky spolupráce Kliments 16. 9. 2026',
}

const CENIKY = {
  '24007986': PASMA_FIRSEN,   // MEDIA LEVEL
  '24052477': PASMA_FIRSEN,   // BOZA REKO
  '24072800': PASMA_FIRSEN,   // Weekendovka
  '24051705': PASMA_MALIIISA, // Maliiisa
  '17347670': PAUSAL_MBAL,    // MB&AL
}

// Weekendovka zatím v evidenci není
const { error: we } = await db.from('clients').upsert({
  ico: '24072800', name: 'Weekendovka s.r.o.', legal_form: 's.r.o.',
  address: 'U Sportoviště 1165/8, Poruba, 70800 Ostrava', vat_payer: false, mail_folder: 'Weekendovka',
}, { onConflict: 'ico', defaultToNull: false })
if (we) throw we

for (const [ico, pricing] of Object.entries(CENIKY)) {
  const { error } = await db.from('clients').update({ pricing }).eq('ico', ico)
  if (error) throw error
}
const { data } = await db.from('clients').select('name, ico, pricing').not('pricing', 'is', null).order('name')
for (const k of data) console.log(`${k.name}: ${k.pricing.model === 'pausal' ? `${k.pricing.zaklad} Kč paušál` : `pásma ${k.pricing.pasma[0].cena}–${k.pricing.pasma.at(-1).cena} Kč`}`)

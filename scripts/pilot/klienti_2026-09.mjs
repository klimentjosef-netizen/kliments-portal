// Aktivní klienti vybraní 2026-09-22 (údaje ověřené v ARES téhož dne).
// Opakovatelné: upsert podle IČO. Plátcovství DPH podle registru DPH v ARES,
// perioda DPH není v ARES → vyplní se ručně.
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  fs.readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const [k, ...v] = l.split('='); return [k, v.join('=').replace(/^"|"$/g, '')] }),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const K = [
  // ico,       název,                          forma,    sídlo,                                                     DIČ,           plátce, složka v mailu
  ['07858680', 'GERYLA, s.r.o.',                 's.r.o.', 'Zbraslavská 12/11, Malá Chuchle, 15900 Praha 5',           'CZ07858680', true,  'Geryla'],
  ['09244476', 'Salibandy, s.r.o.',              's.r.o.', 'Okrajní 156, 73924 Krmelín',                               'CZ09244476', true,  'Salibandy'],
  ['24007986', 'MEDIA LEVEL s.r.o.',             's.r.o.', 'Nádražní 869/55, Moravská Ostrava, 70200 Ostrava',         'CZ24007986', true,  'Media Level'],
  ['24051705', 'Maliiisa s.r.o.',                's.r.o.', 'U Sportoviště 1165/8, Poruba, 70800 Ostrava',              null,         false, 'Maliiisa'],
  ['13963376', 'Salibandy Club Ostrava, z.s.',   'z.s.',   'Dlouhá 3403/2b, Moravská Ostrava, 70200 Ostrava',          null,         false, 'Salibandy Club'],
  ['21209545', 'Runwago a.s.',                   'a.s.',   'Václavské náměstí 832/19, Nové Město, 11000 Praha 1',      'CZ21209545', true,  'Runwago'],
  ['09637109', 'Krel Central a.s.',              'a.s.',   'Václavské náměstí 832/19, Nové Město, 11000 Praha 1',      'CZ09637109', true,  'Krel Central'],
  ['24052477', 'BOZA REKO s.r.o.',               's.r.o.', 'Zajcevova 465/2, Zábřeh, 70030 Ostrava',                   'CZ24052477', true,  null],
  ['10901779', 'HROM Instal s.r.o.',             's.r.o.', 'Haškova 668/3, Ráj, 73401 Karviná',                        'CZ10901779', true,  null],
  ['09448331', 'FOREMVA REALITY a.s.',           'a.s.',   'Na Pankráci 332/14, Nusle, 14000 Praha 4',                 null,         false, null],
  ['09049592', 'Foremva Constructions s.r.o.',   's.r.o.', 'Na Pankráci 332/14, Nusle, 14000 Praha 4',                 null,         false, null],
  ['17347670', 'MB&AL, s.r.o.',                  's.r.o.', 'Čujkovova 1714/21, Zábřeh, 70030 Ostrava',                 null,         false, null],
]

const rows = K.map(([ico, name, legal_form, address, dic, vat_payer, mail_folder]) =>
  ({ ico, name, legal_form, address, dic, vat_payer, mail_folder }))
const { data, error } = await db.from('clients').upsert(rows, { onConflict: 'ico', defaultToNull: false }).select('name, mail_folder')
if (error) throw error
console.log(`klientů: ${data.length}`)

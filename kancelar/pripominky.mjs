// Měsíční připomínky klientům (podklady ke mzdám). Odesílá se z firsen@email.cz přes SMTP Seznamu.
// Každá připomínka odejde jednou za kalendářní měsíc, nejdřív v den `den` (stav v logy/pripominky-stav.json),
// takže když je 1. v měsíci počítač vypnutý, odejde při nejbližším spuštění.
//   node pripominky.mjs              odešle, co je na řadě
//   node pripominky.mjs --nasucho    jen vypíše, co by odešlo
//   node pripominky.mjs --test       pošle všechny připomínky na kliment.josef@email.cz (stav nemění)
import fs from 'node:fs'
import nodemailer from 'nodemailer'
import { cred } from './lib/cred.mjs'

const MESICE = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec']
const PODPIS = `--
Ing. Josef Kliment
jednatel

firsen s.r.o.
Nuselská 497/67
140 00 Praha
IČO: 05190592

+420 774775814
firsen@email.cz
www.firsen.cz
`

// Připomínky: zatím jen Maliiisa (pokyn 4. 10. 2026)
const PRIPOMINKY = [
  {
    id: 'maliiisa-mzdy',
    den: 1,
    komu: 'zajac@maliiisa.cz',
    predmet: (m) => `Maliiisa · podklady ke mzdám za ${m.mm}/${m.rok}`,
    text: (m) => `Ahoj, začal ${m.novy} a potřebuji podklady ke mzdám za ${m.nazev} ${m.rok}:

- počet hodin, které Lucie Komárková v ${m.nazev6} odpracovala,
- případné náhrady pro Lucii (cestovné apod.) s doklady,
- jakékoli změny, například nového zaměstnance, ukončení dohody nebo jinou odměnu u Petra.

Díky

${PODPIS}`,
  },
]

const args = process.argv.slice(2)
const NASUCHO = args.includes('--nasucho')
const TEST = args.includes('--test')
const STAV = new URL('./logy/pripominky-stav.json', import.meta.url)
const stav = fs.existsSync(STAV) ? JSON.parse(fs.readFileSync(STAV, 'utf8')) : {}

const dnes = new Date()
const klic = `${dnes.getFullYear()}-${String(dnes.getMonth() + 1).padStart(2, '0')}`
const min = new Date(dnes.getFullYear(), dnes.getMonth() - 1, 1)   // podklady za předchozí měsíc
const MESICE6 = ['lednu', 'únoru', 'březnu', 'dubnu', 'květnu', 'červnu', 'červenci', 'srpnu', 'září', 'říjnu', 'listopadu', 'prosinci']
const m = {
  mm: String(min.getMonth() + 1).padStart(2, '0'), rok: min.getFullYear(),
  nazev: MESICE[min.getMonth()], nazev6: MESICE6[min.getMonth()],
  novy: MESICE[dnes.getMonth()],
}

const k_odeslani = PRIPOMINKY.filter((p) => TEST || (dnes.getDate() >= p.den && stav[p.id] !== klic))
if (!k_odeslani.length) { console.log(`${dnes.toISOString()} nic k odeslání`); process.exit(0) }

const { user, pass } = NASUCHO ? {} : cred('firsen-imap')
const smtp = NASUCHO ? null : nodemailer.createTransport({ host: 'smtp.seznam.cz', port: 465, secure: true, auth: { user, pass } })
for (const p of k_odeslani) {
  const komu = TEST ? 'kliment.josef@email.cz' : p.komu
  const mail = { from: '"Firsen - účetní kancelář" <firsen@email.cz>', to: komu, subject: p.predmet(m), text: p.text(m) }
  if (NASUCHO) { console.log(`--- ${p.id} -> ${komu}\nPředmět: ${mail.subject}\n\n${mail.text}`); continue }
  const info = await smtp.sendMail(mail)
  console.log(`${dnes.toISOString()} ${p.id} -> ${komu}: ${info.response}`)
  if (!TEST) { stav[p.id] = klic; fs.writeFileSync(STAV, JSON.stringify(stav, null, 2)) }
}

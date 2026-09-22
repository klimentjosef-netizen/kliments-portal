// Sběrný mail Kliments
//
// Projde složky klientů ve firsen@email.cz, každý nový e-mail nechá rozpoznat
// (co to je, komu patří, co udělat), přílohy uloží jako doklady do Supabase
// a e-mail označí jako přečtený.
//
//   node sberny-mail.mjs --slozka Maliiisa     jen jedna složka
//   node sberny-mail.mjs                        všechny složky klientů
//   --limit N    nejvýš N e-mailů na složku     --nasucho  nic neukládá ani neoznačuje
//   --od YYYY-MM-DD  jen e-maily přijaté od data  --bez-upozorneni  neposílat souhrn
//
// Přihlášení ke schránce: IMAP_USER / IMAP_PASS (spouštěč sberny-mail.ps1 je
// vezme ze Správce přihlašovacích údajů Windows, položka firsen-imap).
import './lib/env.mjs'
import crypto from 'node:crypto'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { createClient } from '@supabase/supabase-js'
import { need } from './lib/env.mjs'
import { rozpoznej } from './lib/rozpoznani.mjs'
import { posliUpozorneni } from './upozorneni.mjs'
import { prepocitejKurzy } from './kurzy.mjs'

const args = process.argv.slice(2)
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const NASUCHO = args.includes('--nasucho')
const LIMIT = Number(arg('--limit') ?? Infinity)
const JEN_SLOZKA = arg('--slozka')
const OD = arg('--od') // YYYY-MM-DD: jen e-maily přijaté od tohoto dne (automat: od spuštění provozu)
const MAILBOX = need('IMAP_USER')
const SOUBEZNE = Number(arg('--soubezne') ?? 6) // kolik e-mailů rozpoznávat najednou

const db = createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

// Přílohy, které nejsou doklady: podpisy, loga, pozvánky do kalendáře
function jeDoklad(a) {
  if (/\.(ics|vcf|p7s|asc)$/i.test(a.filename || '')) return false
  if (/^image\//.test(a.contentType)) {
    if (a.related || a.contentDisposition === 'inline') return false
    if (a.size < 30_000) return false
  }
  return a.size > 0
}

const TEXTOVE = /^(text\/|application\/(xml|json|x-isdoc))|\.(isdoc|xml|csv|txt)$/i
const MAX_TEXT = 400_000 // větší textové přílohy (exporty e-shopu) se modelu neposílají celé

function slug(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_').slice(0, 120)
}

async function nactiKlienty() {
  const { data, error } = await db.from('clients').select('id, name, ico, mail_folder').eq('active', true)
  if (error) throw error
  return data
}

async function uzZpracovano(folder, uidvalidity, uid) {
  const { data } = await db.from('mail_messages').select('id')
    .eq('mailbox', MAILBOX).eq('folder', folder).eq('uidvalidity', uidvalidity).eq('uid', uid).maybeSingle()
  return !!data
}

async function ulozSoubor(klientId, datum, sha, priloha) {
  const mesic = (datum ?? new Date()).toISOString().slice(0, 7)
  const cesta = `${klientId ? `klienti/${klientId}` : 'nezarazene'}/${mesic}/${sha.slice(0, 10)}-${slug(priloha.filename || 'priloha')}`
  const { error } = await db.storage.from('documents').upload(cesta, priloha.content, { contentType: priloha.contentType, upsert: true })
  if (error) throw new Error(`úložiště: ${error.message}`)
  return cesta
}

const datum = (s) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null)

async function zpracujMail(imap, folder, uidvalidity, msg, klienti, klientSlozky) {
  const mail = await simpleParser(msg.source)
  const prilohy = mail.attachments.filter(jeDoklad).map((a) => ({
    filename: a.filename || 'priloha',
    contentType: a.contentType,
    size: a.size,
    content: a.content,
    sha: crypto.createHash('sha256').update(a.content).digest('hex'),
    text: TEXTOVE.test(a.contentType) || TEXTOVE.test(a.filename || '')
      ? (a.size <= MAX_TEXT ? a.content.toString('utf8') : null) : null,
  }))
  const info = { folder, from: mail.from?.text ?? '', subject: mail.subject ?? '', date: mail.date, text: (mail.text ?? '').slice(0, 20_000) }

  const ai = await rozpoznej(info, prilohy, klienti)

  // Komu mail patří: složka má přednost, jinak IČO od modelu (musí být v seznamu)
  let klient = klientSlozky.get(folder) ?? null
  let assignedBy = klient ? 'folder' : null
  if (!klient && ai.klient_ico) {
    klient = klienti.find((k) => k.ico === ai.klient_ico) ?? null
    if (klient) assignedBy = 'ico'
  }

  const zaznam = {
    mailbox: MAILBOX, folder, uidvalidity, uid: msg.uid,
    message_id: mail.messageId ?? null, from_addr: info.from, subject: info.subject,
    received_at: mail.date?.toISOString() ?? null,
    client_id: klient?.id ?? null, assigned_by: assignedBy,
    category: ai.kategorie, summary: ai.shrnuti, action_needed: ai.akce,
    attachments: prilohy.length, documents: 0,
    status: klient ? 'processed' : (ai.kategorie === 'marketing' ? 'ignored' : 'needs_review'),
    ai: { ...ai, prilohy: prilohy.map((p) => ({ filename: p.filename, sha: p.sha, size: p.size })) },
  }
  const vysledek = { zaznam, dokladu: 0, doplneno: 0, duplicit: 0, cizich: 0, cizi: [], jinam: [], varovani: [] }
  if (NASUCHO) return vysledek

  const { data: mm, error: me } = await db.from('mail_messages').insert(zaznam).select('id').single()
  if (me) throw new Error(`mail_messages: ${me.message}`)

  for (const d of ai.doklady) {
    const p = prilohy[d.priloha - 1]
    if (!p) { vysledek.varovani.push(`model odkázal na neexistující přílohu ${d.priloha}`); continue }

    // Komu doklad patří: podle IČO na dokladu (složky míchají sesterské firmy,
    // např. Geryla + ovasys). Doklad bez IČO zůstává firmě e-mailu.
    let vlastnik = klient
    const ica = [d.odberatel_ico, d.dodavatel_ico].filter(Boolean).map((x) => x.replace(/\s/g, ''))
    if (ica.length && d.ucetni_doklad && !(klient && ica.includes(klient.ico))) {
      vlastnik = klienti.find((k) => ica.includes(k.ico)) ?? null
      if (!vlastnik) {
        vysledek.cizich++
        vysledek.cizi.push(`${p.filename} (odběratel IČO ${d.odberatel_ico ?? '?'})`)
        continue
      }
      if (klient && vlastnik.id !== klient.id) vysledek.jinam.push(`${p.filename} → ${vlastnik.name}`)
    }
    if (!vlastnik) {
      // bez klienta jen uschovat soubor, přiřadí se ručně
      await ulozSoubor(null, mail.date, p.sha, p)
      continue
    }
    const { data: dup } = await db.from('documents').select('id').eq('client_id', vlastnik.id).eq('file_sha256', p.sha).maybeSingle()
    if (dup) { vysledek.duplicit++; continue }

    const cesta = await ulozSoubor(vlastnik.id, mail.date, p.sha, p)
    const radek = {
      client_id: vlastnik.id, kind: d.druh, source: 'email', status: 'extracted',
      storage_path: cesta, file_name: p.filename, mime_type: p.contentType, file_sha256: p.sha,
      email_message_id: mail.messageId ?? null, email_from: info.from, mail_message_id: mm.id,
      received_at: mail.date?.toISOString() ?? new Date().toISOString(),
      counterparty_name: d.protistrana, counterparty_ico: d.protistrana_ico, counterparty_dic: d.protistrana_dic,
      customer_ico: d.odberatel_ico, doc_number: d.cislo_dokladu, var_symbol: d.variabilni_symbol,
      order_number: d.cislo_objednavky, issue_date: datum(d.datum_vystaveni), taxable_date: datum(d.duzp),
      due_date: datum(d.datum_splatnosti), currency: d.mena || 'CZK', amount_total: d.castka_celkem,
      amount_vat: d.castka_dph, description: d.popis, note: d.poznamka,
      extracted: d, extraction_method: 'ai',
    }

    // Doklad už evidovaný bez souboru (import) → doplnit, nevytvářet nový
    const { data: cekajici } = await db.from('documents').select('id, amount_total')
      .eq('client_id', vlastnik.id).eq('file_name', p.filename).is('storage_path', null).limit(1).maybeSingle()
    if (cekajici) {
      const { source, status, ...doplnek } = radek
      const { error } = await db.from('documents').update({ ...doplnek, status: 'reviewed', updated_at: new Date().toISOString() }).eq('id', cekajici.id)
      if (error) throw new Error(`documents update: ${error.message}`)
      vysledek.doplneno++
    } else {
      const { error } = await db.from('documents').insert(radek)
      // stejný soubor mohl právě uložit souběžně zpracovávaný e-mail
      if (error?.code === '23505') { vysledek.duplicit++; continue }
      if (error) throw new Error(`documents insert: ${error.message}`)
      vysledek.dokladu++
    }
  }
  await db.from('mail_messages').update({
    documents: vysledek.dokladu + vysledek.doplneno,
    ai: { ...zaznam.ai, varovani: vysledek.varovani, cizi: vysledek.cizi, jinam: vysledek.jinam },
  }).eq('id', mm.id)
  if (klient) await imap.messageFlagsAdd({ uid: msg.uid }, ['\\Seen'], { uid: true })
  return vysledek
}

async function main() {
  const klienti = await nactiKlienty()
  const klientSlozky = new Map(klienti.filter((k) => k.mail_folder).map((k) => [k.mail_folder, k]))
  const slozky = JEN_SLOZKA ? [JEN_SLOZKA] : [...klientSlozky.keys()]

  const imap = new ImapFlow({
    host: 'imap.seznam.cz', port: 993, secure: true, logger: false,
    auth: { user: MAILBOX, pass: need('IMAP_PASS') },
  })
  await imap.connect()
  const souhrn = []
  try {
    for (const folder of slozky) {
      const lock = await imap.getMailboxLock(folder, { readOnly: NASUCHO })
      try {
        const uidvalidity = Number(imap.mailbox.uidValidity)
        const uids = (await imap.search(OD ? { since: new Date(`${OD}T00:00:00`) } : { all: true }, { uid: true })) || []
        const nove = []
        for (const uid of uids) {
          if (nove.length >= LIMIT) break
          if (!(await uzZpracovano(folder, uidvalidity, uid))) nove.push(uid)
        }
        // Stažení postupně (jedno IMAP spojení), rozpoznání souběžně po SOUBEZNE
        const zpracuj = async (uid) => {
          const msg = await imap.fetchOne(String(uid), { source: true }, { uid: true })
          try {
            const v = await zpracujMail(imap, folder, uidvalidity, msg, klienti, klientSlozky)
            souhrn.push(v)
            const z = v.zaznam
            console.log(`[${folder}] ${z.subject}\n   → ${z.summary}${z.action_needed ? `\n   ÚKOL: ${z.action_needed}` : ''}\n   doklady nové ${v.dokladu}, doplněné ${v.doplneno}, duplicity ${v.duplicit}${v.cizich ? `, cizí ${v.cizich}: ${v.cizi.join('; ')}` : ''}${v.jinam.length ? `
   JINÉ FIRMĚ: ${v.jinam.join('; ')}` : ''}${v.varovani.length ? `\n   POZOR: ${v.varovani.join('; ')}` : ''}`)
          } catch (e) {
            console.error(`[${folder}] UID ${uid}: CHYBA ${e.message}`)
            if (!NASUCHO) {
              await db.from('mail_messages').insert({ mailbox: MAILBOX, folder, uidvalidity, uid, status: 'error', error: e.message })
            }
          }
        }
        const fronta = [...nove]
        await Promise.all(Array.from({ length: Math.min(SOUBEZNE, fronta.length) }, async () => {
          while (fronta.length) await zpracuj(fronta.shift())
        }))
      } finally {
        lock.release()
      }
    }
  } finally {
    await imap.logout()
  }
  const sum = (k) => souhrn.reduce((s, v) => s + v[k], 0)
  console.log(`\nHotovo: e-mailů ${souhrn.length}, nových dokladů ${sum('dokladu')}, doplněných ${sum('doplneno')}, duplicit ${sum('duplicit')}`)
  if (!NASUCHO) await prepocitejKurzy()
  if (!NASUCHO && !args.includes('--bez-upozorneni')) {
    const n = await posliUpozorneni()
    console.log(n ? `Odesláno upozornění: ${n}.` : 'Nic, co by potřebovalo rozhodnutí.')
  }
}

main().catch((e) => { console.error(e); process.exit(1) })

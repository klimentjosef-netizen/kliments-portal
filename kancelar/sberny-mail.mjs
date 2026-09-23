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
import { synchronizujIdoklad } from './idoklad.mjs'
import { sparuj } from './parovani.mjs'

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

// Jak se dodavatelé klienta účtovali minule (podklad pro návrh předkontace)
const pametCache = new Map()
async function pametDodavatelu(klientId) {
  if (!klientId) return []
  if (!pametCache.has(klientId)) {
    const { data } = await db.from('v_supplier_memory')
      .select('counterparty_ico, counterparty_name, ucet, cleneni_dph, rezim_dph, dokladu')
      .eq('client_id', klientId).order('dokladu', { ascending: false }).limit(60)
    pametCache.set(klientId, data ?? [])
  }
  return pametCache.get(klientId)
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

  const pamet = await pametDodavatelu(klientSlozky.get(folder)?.id ?? null)
  const ai = await rozpoznej(info, prilohy, klienti, pamet)

  // Komu mail patří: složka má přednost, jinak IČO od modelu (musí být v seznamu)
  let klient = klientSlozky.get(folder) ?? null
  let assignedBy = klient ? 'folder' : null
  if (!klient && ai.klient_ico) {
    klient = klienti.find((k) => k.ico === ai.klient_ico.replace(/\D/g, '').padStart(8, '0')) ?? null
    if (klient) assignedBy = 'ico'
  }

  const zaznam = {
    mailbox: MAILBOX, folder, uidvalidity, uid: msg.uid,
    message_id: mail.messageId ?? null, from_addr: info.from, subject: info.subject,
    received_at: mail.date?.toISOString() ?? null,
    client_id: klient?.id ?? null, assigned_by: assignedBy,
    category: ai.kategorie, summary: ai.shrnuti, action_needed: ai.akce,
    attachments: prilohy.length, documents: 0,
    // Notifikace z datové schránky firmy, která není klientem, se jen založí (bez upozornění)
    status: klient ? 'processed'
      : (ai.kategorie === 'marketing' || (/datov[aá] zpr[aá]va/i.test(info.subject) && !prilohy.length) ? 'ignored' : 'needs_review'),
    ai: { ...ai, prilohy: prilohy.map((p) => ({ filename: p.filename, sha: p.sha, size: p.size })) },
  }
  const vysledek = { zaznam, dokladu: 0, doplneno: 0, duplicit: 0, cizich: 0, cizi: [], jinam: [], varovani: [], presunuto: null }
  if (NASUCHO) return vysledek

  const { data: mm, error: me } = await db.from('mail_messages').insert(zaznam).select('id').single()
  if (me) throw new Error(`mail_messages: ${me.message}`)

  for (const d of ai.doklady) {
    const p = prilohy[d.priloha - 1]
    if (!p) { vysledek.varovani.push(`model odkázal na neexistující přílohu ${d.priloha}`); continue }

    // Komu doklad patří: podle IČO na dokladu (složky míchají sesterské firmy,
    // např. Geryla + ovasys). Doklad bez IČO zůstává firmě e-mailu.
    // Přeřazuje se jen doklad, který má IČO odběratele (účtenka bez odběratele zůstává).
    let vlastnik = klient
    // IČO vždy jako 8 číslic (model někdy vynechá úvodní nulu: 7858680 → 07858680)
    const ico8 = (x) => (x && /\d/.test(x) ? x.replace(/\D/g, '').padStart(8, '0') : null)
    d.odberatel_ico = ico8(d.odberatel_ico); d.dodavatel_ico = ico8(d.dodavatel_ico); d.protistrana_ico = ico8(d.protistrana_ico)
    const ica = [d.odberatel_ico, d.dodavatel_ico].filter(Boolean)
    if (d.odberatel_ico && d.ucetni_doklad && !(klient && ica.includes(klient.ico))) {
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
      vat_breakdown: d.sazby_dph?.length ? d.sazby_dph : null,
      vat_regime: d.rezim_dph && d.rezim_dph !== 'neuvedeno' ? d.rezim_dph : null,
      items: d.polozky?.length ? d.polozky : null,
      suggested_account: d.navrh_uctu || null,
      suggested_vat_class: d.navrh_cleneni_dph || null,
      supplier_bank_account: d.ucet_dodavatele || null,
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
  // Úklid schránky: reklama do koše, doklad zařazené firmy z doručené pošty do její
  // složky, ostatní zůstane na místě. Zpracovaný mail je vždy přečtený.
  await imap.messageFlagsAdd({ uid: msg.uid }, ['\\Seen'], { uid: true })
  const cil = ai.kategorie === 'marketing' ? 'trash' : (folder === 'INBOX' ? klient?.mail_folder ?? null : null)
  if (cil) {
    try {
      await imap.messageMove({ uid: msg.uid }, cil, { uid: true })
      vysledek.presunuto = cil
    } catch (e) {
      vysledek.varovani.push(`přesun do ${cil} se nepovedl: ${e.message}`)
    }
  }
  return vysledek
}

async function main() {
  const klienti = await nactiKlienty()
  const klientSlozky = new Map(klienti.filter((k) => k.mail_folder).map((k) => [k.mail_folder, k]))
  // Kromě složek firem i doručená pošta: maily se zařadí podle IČO na dokladu
  const slozky = JEN_SLOZKA ? [JEN_SLOZKA] : [...klientSlozky.keys(), 'INBOX']

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
            console.log(`[${folder}] ${z.subject}\n   → ${z.summary}${z.action_needed ? `\n   ÚKOL: ${z.action_needed}` : ''}\n   doklady nové ${v.dokladu}, doplněné ${v.doplneno}, duplicity ${v.duplicit}${v.presunuto ? `, přesunuto do ${v.presunuto}` : ''}${v.cizich ? `, cizí ${v.cizich}: ${v.cizi.join('; ')}` : ''}${v.jinam.length ? `
   JINÉ FIRMĚ: ${v.jinam.join('; ')}` : ''}${v.varovani.length ? `\n   POZOR: ${v.varovani.join('; ')}` : ''}`)
          } catch (e) {
            console.error(`[${folder}] UID ${uid}: CHYBA ${e.message}`)
            // Chyby Claude API (kredit, limity, výpadek) nezapisovat: e-mail se zkusí znovu příště
            if (!NASUCHO && !e.status) {
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
  if (!NASUCHO) {
    await prepocitejKurzy()
    // Vydané faktury z iDokladu (kde má klient klíče) a párování plateb u všech klientů
    for (const k of klienti) {
      try {
        const s = await synchronizujIdoklad({ ico: k.ico })
        console.log(`iDoklad ${k.name}: faktur ${s.faktur}, dobropisů ${s.dobropisu}`)
      } catch (e) {
        if (!/Chybí přihlašovací údaje/.test(e.message)) console.error(`iDoklad ${k.name}: ${e.message}`)
      }
      const p = await sparuj({ ico: k.ico })
      if (p.nove) console.log(`Párování ${k.name}: nově ${p.nove} (jistě ${p.jiste}, k potvrzení ${p.navrhy})`)
    }
  }
  if (!NASUCHO && !args.includes('--bez-upozorneni')) {
    const n = await posliUpozorneni()
    console.log(n ? `Odesláno upozornění: ${n}.` : 'Nic, co by potřebovalo rozhodnutí.')
  }
}

main().catch((e) => { console.error(e); process.exit(1) })

// Upozornění ze sběrného mailu: jen na to, co není běžná faktura, účtenka nebo
// výpis a potřebuje Josefovo rozhodnutí (smlouva, úřad, dotaz klienta, nezařazený
// e-mail, nesrovnalost, chyba). Každá věc = samostatný e-mail s popisem a otázkou.
// Běžné doklady se zpracují potichu. Odesílá se přes SMTP Seznamu z firsen@email.cz.
//
//   node upozorneni.mjs            pošle, co ještě nebylo oznámeno
//   node upozorneni.mjs --nahled   jen vypíše, nic neodešle ani neoznačí
import './lib/env.mjs'
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'
import { need } from './lib/env.mjs'

const KOMU = process.env.UPOZORNENI_KOMU || 'kliment.josef@email.cz'
const NAHLED = process.argv.includes('--nahled')
const BEZNE_DRUHY = new Set(['received_invoice', 'issued_invoice', 'credit_note', 'receipt', 'advance', 'bank_statement', 'payment_report'])

const db = createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const kdy = (s) => (s ? new Date(s).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')
const kratce = (n) => (n ?? 'nezařazeno').replace(/,? (s\.r\.o\.|a\.s\.|z\.s\.)$/i, '')

// Proč tahle věc potřebuje Josefa (prázdné pole = běžný doklad, bez upozornění)
export function duvody(m) {
  if (m.status === 'ignored') return []
  const d = []
  if (m.status === 'error') d.push(`Chyba zpracování: ${m.error}`)
  if (!m.client_id && m.status !== 'error') d.push('Nepodařilo se určit, ke které firmě patří')
  const ai = m.ai ?? {}
  if (ai.potrebuje_pokyn) d.push('Není to běžný doklad')
  const jine = (ai.doklady ?? []).filter((x) => !BEZNE_DRUHY.has(x.druh))
  if (jine.length && !ai.potrebuje_pokyn) d.push(`Příloha není běžný doklad (${jine.map((x) => x.druh).join(', ')})`)
  for (const v of ai.varovani ?? []) d.push(v)
  return d
}

function zprava(m, proc) {
  const ai = m.ai ?? {}
  const firma = m.clients?.name ?? 'NEZAŘAZENO'
  const otazka = ai.otazka || m.action_needed || 'Co s tím mám udělat?'
  const prilohy = ai.prilohy ?? []
  const predmet = `Kliments · ${kratce(m.clients?.name)} · ${otazka.length > 70 ? `${otazka.slice(0, 67)}...` : otazka}`
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;background:#f6f7f9;padding:16px">
  <table role="presentation" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px">
    <tr><td style="padding:16px;border-bottom:2px solid #0f3d5e">
      <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.03em">Kliments. · sběrný mail · ${esc(firma)}</div>
      <div style="font-size:18px;font-weight:700;color:#0f3d5e;margin-top:4px">${esc(otazka)}</div>
    </td></tr>
    <tr><td style="padding:16px;font-size:14px;color:#374151;line-height:1.5">
      <p style="margin:0 0 10px">${esc(m.summary ?? '')}</p>
      <table role="presentation" style="font-size:13px;color:#4b5563">
        <tr><td style="padding:2px 12px 2px 0;color:#9ca3af">Od</td><td>${esc(m.from_addr)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#9ca3af">Předmět</td><td>${esc(m.subject || '(bez předmětu)')}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#9ca3af">Přišlo</td><td>${kdy(m.received_at)} · složka ${esc(m.folder)}</td></tr>
        ${prilohy.length ? `<tr><td style="padding:2px 12px 2px 0;color:#9ca3af;vertical-align:top">Přílohy</td><td>${prilohy.map((p) => esc(p.filename)).join('<br>')}</td></tr>` : ''}
      </table>
      ${proc.map((p) => `<div style="font-size:13px;color:#b54708;margin-top:8px">${esc(p)}</div>`).join('')}
      ${m.action_needed && m.action_needed !== otazka ? `<p style="margin:12px 0 0;font-size:13px"><b>Návrh:</b> ${esc(m.action_needed)}</p>` : ''}
    </td></tr>
  </table></div>`
  const text = `${otazka}\n\n${m.summary ?? ''}\n\nOd: ${m.from_addr}\nPředmět: ${m.subject}\nFirma: ${firma}\n${proc.join('\n')}`
  return { predmet, html, text }
}

export async function posliUpozorneni({ pass } = {}) {
  const { data: nove, error } = await db.from('mail_messages')
    .select('id, folder, from_addr, subject, received_at, summary, action_needed, status, error, attachments, documents, client_id, ai, clients(name)')
    .is('notified_at', null).order('received_at', { ascending: true })
  if (error) throw error

  const k_oznameni = nove.map((m) => ({ m, proc: duvody(m) })).filter((x) => x.proc.length)
  if (NAHLED) {
    for (const { m, proc } of k_oznameni) console.log(`${zprava(m, proc).predmet}\n  ${proc.join(' | ')}\n`)
    console.log(`K oznámení ${k_oznameni.length} z ${nove.length} nových.`)
    return k_oznameni.length
  }

  const smtp = k_oznameni.length && nodemailer.createTransport({
    host: 'smtp.seznam.cz', port: 465, secure: true,
    auth: { user: need('IMAP_USER'), pass: pass ?? need('IMAP_PASS') },
  })
  for (const { m, proc } of k_oznameni) {
    const z = zprava(m, proc)
    await smtp.sendMail({ from: `Kliments sběrný mail <${need('IMAP_USER')}>`, to: KOMU, subject: z.predmet, html: z.html, text: z.text })
  }
  if (nove.length) await db.from('mail_messages').update({ notified_at: new Date().toISOString() }).in('id', nove.map((m) => m.id))
  return k_oznameni.length
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  posliUpozorneni().then((n) => console.log(n ? `Odesláno upozornění: ${n}.` : 'Nic, co by potřebovalo rozhodnutí.'))
    .catch((e) => { console.error(e); process.exit(1) })
}

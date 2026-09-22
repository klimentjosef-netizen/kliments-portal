// Upozornění na nové e-maily ve sběrné schránce: jeden souhrnný e-mail na
// kliment.josef@email.cz se vším, co od posledního upozornění přišlo.
// Odesílá se přes SMTP Seznamu ze schránky firsen@email.cz.
//
//   node upozorneni.mjs            pošle, co ještě nebylo oznámeno
//   node upozorneni.mjs --nahled   jen vypíše, nic neodešle ani neoznačí
import './lib/env.mjs'
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'
import { need } from './lib/env.mjs'

const KOMU = process.env.UPOZORNENI_KOMU || 'kliment.josef@email.cz'
const NAHLED = process.argv.includes('--nahled')

const db = createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const kdy = (s) => (s ? new Date(s).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')

function karta(m) {
  const firma = m.clients?.name ?? 'NEZAŘAZENO'
  const barva = m.status === 'error' ? '#b42318' : m.client_id ? '#0f3d5e' : '#b54708'
  const varovani = m.ai?.varovani ?? []
  return `
  <tr><td style="padding:14px 16px;border-bottom:1px solid #e5e7eb">
    <div style="font-size:12px;color:${barva};font-weight:600;letter-spacing:.02em;text-transform:uppercase">${esc(firma)} · ${esc(m.folder)} · ${kdy(m.received_at)}</div>
    <div style="font-size:15px;font-weight:600;color:#111827;margin:4px 0">${esc(m.subject || '(bez předmětu)')}</div>
    <div style="font-size:14px;color:#374151">${esc(m.status === 'error' ? `Chyba zpracování: ${m.error}` : m.summary)}</div>
    ${m.action_needed ? `<div style="font-size:14px;color:#111827;margin-top:6px"><b>Úkol:</b> ${esc(m.action_needed)}</div>` : ''}
    ${varovani.map((v) => `<div style="font-size:13px;color:#b54708;margin-top:4px">Pozor: ${esc(v)}</div>`).join('')}
    ${m.attachments ? `<div style="font-size:12px;color:#6b7280;margin-top:6px">Příloh ${m.attachments}, do evidence ${m.documents}</div>` : ''}
    ${!m.client_id && m.status !== 'error' ? `<div style="font-size:13px;color:#b54708;margin-top:4px">Nepodařilo se určit firmu, přiřaď ručně.</div>` : ''}
  </td></tr>`
}

export async function posliUpozorneni({ pass } = {}) {
  const { data: nove, error } = await db.from('mail_messages')
    .select('id, folder, subject, received_at, summary, action_needed, status, error, attachments, documents, client_id, ai, clients(name)')
    .is('notified_at', null).order('received_at', { ascending: true })
  if (error) throw error
  const oznamit = nove.filter((m) => m.status !== 'ignored')
  if (!oznamit.length) {
    if (nove.length && !NAHLED) await db.from('mail_messages').update({ notified_at: new Date().toISOString() }).in('id', nove.map((m) => m.id))
    return 0
  }

  const poFirmach = {}
  for (const m of oznamit) { const f = m.clients?.name ?? 'nezařazeno'; poFirmach[f] = (poFirmach[f] || 0) + 1 }
  const ukolu = oznamit.filter((m) => m.action_needed).length
  const predmet = `Kliments · ${oznamit.length} ${oznamit.length === 1 ? 'nový e-mail' : oznamit.length < 5 ? 'nové e-maily' : 'nových e-mailů'}` +
    ` (${Object.entries(poFirmach).map(([f, n]) => `${f.replace(/,? (s\.r\.o\.|a\.s\.|z\.s\.)$/i, '')} ${n}`).join(', ')})`

  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;background:#f6f7f9;padding:16px">
  <table role="presentation" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px">
    <tr><td style="padding:16px;border-bottom:2px solid #0f3d5e">
      <div style="font-size:18px;font-weight:700;color:#0f3d5e">Kliments. · sběrný mail</div>
      <div style="font-size:13px;color:#6b7280">${oznamit.length} nových e-mailů, z toho ${ukolu} s úkolem</div>
    </td></tr>
    ${oznamit.map(karta).join('')}
  </table></div>`
  const text = oznamit.map((m) => `${m.clients?.name ?? 'NEZAŘAZENO'} | ${m.subject}\n${m.summary ?? m.error ?? ''}${m.action_needed ? `\nÚkol: ${m.action_needed}` : ''}`).join('\n\n')

  if (NAHLED) { console.log(predmet + '\n\n' + text); return oznamit.length }

  const smtp = nodemailer.createTransport({
    host: 'smtp.seznam.cz', port: 465, secure: true,
    auth: { user: need('IMAP_USER'), pass: pass ?? need('IMAP_PASS') },
  })
  await smtp.sendMail({ from: `Kliments sběrný mail <${need('IMAP_USER')}>`, to: KOMU, subject: predmet, html, text })
  await db.from('mail_messages').update({ notified_at: new Date().toISOString() }).in('id', nove.map((m) => m.id))
  return oznamit.length
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  posliUpozorneni().then((n) => console.log(n ? `Upozornění odesláno (${n} e-mailů).` : 'Nic nového k oznámení.'))
    .catch((e) => { console.error(e); process.exit(1) })
}

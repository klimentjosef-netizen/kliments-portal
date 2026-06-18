// Debug: přihlásí klienta TechCars a zachytí client-side chyby na portálu.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
const require = createRequire(import.meta.url)
const ssrUtils = require('@supabase/ssr/dist/main/utils.js')

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SRK = env.SUPABASE_SERVICE_ROLE_KEY
const ref = SUPA_URL.split('//')[1].split('.')[0]
const storageKey = `sb-${ref}-auth-token`
const SITE = 'https://kliments-portal.vercel.app'
const CLIENT_EMAIL = 'autoservis@techcars.cz'

const admin = createClient(SUPA_URL, SRK, { auth: { persistSession: false } })
const { data: link, error: e1 } = await admin.auth.admin.generateLink({ type: 'magiclink', email: CLIENT_EMAIL })
if (e1) { console.error('generateLink:', e1.message); process.exit(1) }
const anon = createClient(SUPA_URL, ANON, { auth: { persistSession: false } })
const { data: ses, error: e2 } = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token })
if (e2) { console.error('verifyOtp:', e2.message); process.exit(1) }

const value = JSON.stringify(ses.session)
const encoded = 'base64-' + ssrUtils.stringToBase64URL(value)
const chunks = ssrUtils.createChunks(storageKey, encoded)
const cookies = chunks.map((c) => ({ name: c.name, value: c.value, domain: 'kliments-portal.vercel.app', path: '/', httpOnly: false, secure: true, sameSite: 'Lax' }))

const browser = await chromium.launch()
const ctx = await browser.newContext()
await ctx.addCookies(cookies)
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.stack || e.message)))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })

for (const path of ['/portal/dashboard', '/portal/cfo', '/portal/cfo?tab=cashflow', '/portal/cfo?tab=taxes']) {
  errs.length = 0
  try {
    await page.goto(`${SITE}${path}`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2500)
  } catch (e) { errs.push('NAV: ' + e.message.split('\n')[0]) }
  const hasAppError = await page.locator('text=Application error').count().catch(() => 0)
  console.log(`\n=== ${path} === (Application error visible: ${hasAppError ? 'YES' : 'no'})`)
  if (errs.length) errs.slice(0, 6).forEach((x) => console.log(x.slice(0, 600)))
  else console.log('  (žádné chyby zachyceny)')
}
await browser.close()

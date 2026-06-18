// Nasnímá ŽIVÝ produkční portál jako klient TechCars (neintruzivně, jen čtení).
// Mintne klientskou session přes magic link a vloží ji do prohlížeče jako cookie
// ve formátu @supabase/ssr (base64- + base64url(JSON), chunkováno).
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

// 1) mint session
const admin = createClient(SUPA_URL, SRK, { auth: { persistSession: false } })
const { data: link, error: e1 } = await admin.auth.admin.generateLink({ type: 'magiclink', email: CLIENT_EMAIL })
if (e1) { console.error('generateLink:', e1.message); process.exit(1) }
const anon = createClient(SUPA_URL, ANON, { auth: { persistSession: false } })
const { data: ses, error: e2 } = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token })
if (e2) { console.error('verifyOtp:', e2.message); process.exit(1) }
console.log('Session OK:', ses.user.email)

// 2) cookie ve formátu @supabase/ssr
const value = JSON.stringify(ses.session)
const encoded = 'base64-' + ssrUtils.stringToBase64URL(value)
const chunks = ssrUtils.createChunks(storageKey, encoded)
const cookies = chunks.map((c) => ({ name: c.name, value: c.value, domain: 'kliments-portal.vercel.app', path: '/', httpOnly: false, secure: true, sameSite: 'Lax' }))
console.log('Cookies:', cookies.map((c) => c.name).join(', '))

// 3) Playwright
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1400 }, deviceScaleFactor: 1.5 })
await ctx.addCookies(cookies)
const page = await ctx.newPage()
await page.goto(`${SITE}/portal/cfo`, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
console.log('URL po načtení:', page.url())
await page.screenshot({ path: 'data/techcars/live-prehled.png', fullPage: true })

// klik na záložky a snímky
for (const [label, file] of [['Hospodaření', 'live-hospodareni'], ['Peníze', 'live-penize'], ['Co kdyby', 'live-cokdyby']]) {
  try {
    await page.getByText(label, { exact: true }).first().click({ timeout: 4000 })
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `data/techcars/${file}.png`, fullPage: true })
    console.log('  snímek:', label)
  } catch (e) { console.log('  nelze kliknout:', label, e.message.split('\n')[0]) }
}
await browser.close()
console.log('Hotovo.')

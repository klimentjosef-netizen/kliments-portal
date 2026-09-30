import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import crypto from 'node:crypto'

const db = new PGlite()
let fail = 0
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++ }
const throws = async (sql, m) => { try { await db.query(sql); ok(false, m) } catch (e) { ok(true, m + ' → ' + e.message.split('\n')[0]) } }

await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated;
  CREATE TABLE public.clients (id uuid PRIMARY KEY, name text, ico text);
`)
await db.exec(fs.readFileSync(new URL('../migrations/0020_pohoda_fronta.sql', import.meta.url), 'utf8'))
ok(true, 'migrace proběhla')

const TOKEN = 'tajny-token-agenta'
const hash = crypto.createHash('sha256').update(TOKEN).digest('hex')
await db.exec(`
  INSERT INTO pohoda_agents (id, name, token_hash) VALUES ('a0000000-0000-0000-0000-000000000001', 'iPodnik', '${hash}');
  INSERT INTO pohoda_jobs (id, ico, database, xml_b64, created_at) VALUES
    ('b0000000-0000-0000-0000-000000000001', '24051705', 'StwPh_24051705_2025', 'eA==', now() - interval '2 min'),
    ('b0000000-0000-0000-0000-000000000002', '09244476', 'StwPh_09244476_2025', 'eQ==', now() - interval '1 min');
`)

await throws(`SELECT * FROM kl_agent_dalsi('spatny', 'x')`, 'neplatný token odmítnut')
const a = await db.query(`SELECT * FROM kl_agent_dalsi($1, 'TSS0959')`, [TOKEN])
ok(a.rows.length === 1 && a.rows[0].ico === '24051705', 'agent dostal nejstarší úlohu')
const b = await db.query(`SELECT * FROM kl_agent_dalsi($1, 'TSS0959')`, [TOKEN])
ok(b.rows.length === 1 && b.rows[0].ico === '09244476', 'druhé volání dá další úlohu, ne tutéž')
const c = await db.query(`SELECT * FROM kl_agent_dalsi($1, 'TSS0959')`, [TOKEN])
ok(c.rows.length === 0, 'prázdná fronta nevrací nic')

await db.query(`SELECT kl_agent_vysledek($1, 'b0000000-0000-0000-0000-000000000001', true, 'cg==', '{"ok":1}', null)`, [TOKEN])
const s = await db.query(`SELECT status, response_b64, finished_at IS NOT NULL AS hotovo FROM pohoda_jobs WHERE id = 'b0000000-0000-0000-0000-000000000001'`)
ok(s.rows[0].status === 'done' && s.rows[0].response_b64 === 'cg==' && s.rows[0].hotovo, 'výsledek uložen')
await throws(`SELECT kl_agent_vysledek('${TOKEN}', 'b0000000-0000-0000-0000-000000000001', true, null, null, null)`, 'hotovou úlohu nejde uzavřít podruhé')

await db.exec(`UPDATE pohoda_jobs SET started_at = now() - interval '3 hours' WHERE id = 'b0000000-0000-0000-0000-000000000002'`)
const d = await db.query(`SELECT * FROM kl_agent_dalsi($1, 'TSS0959')`, [TOKEN])
ok(d.rows.length === 1 && d.rows[0].ico === '09244476', 'zaseknutá úloha se vrátí do fronty')

const ag = await db.query(`SELECT last_host, last_seen_at IS NOT NULL AS videno FROM pohoda_agents`)
ok(ag.rows[0].last_host === 'TSS0959' && ag.rows[0].videno, 'agent se hlásí (poslední kontakt a počítač)')

console.log(fail ? `\nSELHALO: ${fail}` : '\nVŠE PROŠLO')
await db.close()
process.exitCode = fail ? 1 : 0

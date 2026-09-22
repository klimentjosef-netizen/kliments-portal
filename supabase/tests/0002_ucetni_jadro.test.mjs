import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'

const MIG = new URL('../migrations/0002_ucetni_jadro.sql', import.meta.url)
const db = new PGlite()
let fail = 0
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++ }
const throws = async (sql, m) => { try { await db.exec(sql); ok(false, m) } catch (e) { ok(true, m + ' → ' + e.message.split('\n')[0]) } }

// Supabase prostředí (stub)
await db.exec(`
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
  CREATE ROLE authenticated;
  CREATE TABLE public.profiles (id uuid PRIMARY KEY, email text, name text, role text DEFAULT 'client', service text, active boolean DEFAULT true, created_at timestamp DEFAULT now());
`)
await db.exec(fs.readFileSync(MIG, 'utf8'))
await db.exec(`GRANT USAGE ON SCHEMA public, auth TO authenticated; GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;`)
ok(true, 'migrace proběhla')

const ADMIN = '00000000-0000-0000-0000-00000000000a'
const PETR = '00000000-0000-0000-0000-00000000000b'
const CIZI = '00000000-0000-0000-0000-00000000000c'
await db.exec(`
  INSERT INTO profiles (id, role) VALUES ('${ADMIN}','admin'), ('${PETR}','client'), ('${CIZI}','client');
  INSERT INTO clients (id, name, ico) VALUES ('10000000-0000-0000-0000-000000000001','Maliiisa s.r.o.','24051705'), ('10000000-0000-0000-0000-000000000002','Jiná s.r.o.','11111111');
  INSERT INTO client_users VALUES ('10000000-0000-0000-0000-000000000001','${PETR}','owner'), ('10000000-0000-0000-0000-000000000002','${CIZI}','owner');
  INSERT INTO bank_accounts (id, client_id, number) VALUES ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','6893596004/5500');
  INSERT INTO documents (id, client_id, kind, source, file_sha256, counterparty_name, var_symbol, amount_total, due_date)
    VALUES ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','received_invoice','email','abc','Silvie Buganská','2026053',4240,'2026-07-30'),
           ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','received_invoice','email','def','PPL CZ','3260720658',4467.60,'2026-08-10');
  INSERT INTO bank_transactions (id, client_id, account_id, booked_on, amount, var_symbol, dedup_key, counterparty_name)
    VALUES ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','2026-07-29',-4240,'2026053','t1','Silvie Buganská'),
           ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','2026-07-29',-4000,null,'t2','Meta');
  INSERT INTO payment_matches (client_id, bank_transaction_id, document_id, amount, method)
    VALUES ('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',4240,'var_symbol');
`)

// Pravidla
await throws(`INSERT INTO documents (client_id, source, file_sha256) VALUES ('10000000-0000-0000-0000-000000000001','upload','abc')`, 'stejný soubor dvakrát odmítnut')
await throws(`INSERT INTO journal_entries (client_id, series, entry_date, status) VALUES ('10000000-0000-0000-0000-000000000001','BV','2026-07-29','posted')`, 'zaúčtování bez dokladu odmítnuto')
await db.exec(`INSERT INTO journal_entries (client_id, series, entry_date, status) VALUES ('10000000-0000-0000-0000-000000000001','BV','2026-07-29','draft')`)
ok(true, 'rozpracovaný zápis bez dokladu povolen')
await throws(`INSERT INTO bank_transactions (client_id, account_id, booked_on, amount, dedup_key) VALUES ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','2026-07-29',-1,'t1')`, 'stejný bankovní pohyb dvakrát odmítnut')

// Pohledy
const bal = (await db.query(`SELECT counterparty_name, state, open_amount::float FROM v_document_balance ORDER BY counterparty_name`)).rows
ok(bal[0].state === 'overdue' && bal[0].open_amount === 4467.6, 'PPL neuhrazená po splatnosti ' + JSON.stringify(bal[0]))
ok(bal[1].state === 'paid' && bal[1].open_amount === 0, 'Buganská uhrazená')
const miss = (await db.query(`SELECT counterparty_name FROM v_missing_documents`)).rows
ok(miss.length === 1 && miss[0].counterparty_name === 'Meta', 'chybí doklad jen k Meta')

// RLS jako přihlášený uživatel
const as = async (uid, sql) => {
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.sub','${uid}',false);`)
  try { return (await db.query(sql)).rows } finally { await db.exec(`RESET ROLE`) }
}
ok((await as(PETR, `SELECT id FROM documents`)).length === 2, 'Petr vidí své 2 doklady')
ok((await as(CIZI, `SELECT id FROM documents`)).length === 0, 'cizí klient nevidí doklady Maliisy')
ok((await as(CIZI, `SELECT * FROM v_missing_documents`)).length === 0, 'cizí klient nevidí chybějící podklady Maliisy')
ok((await as(PETR, `SELECT * FROM v_missing_documents`)).length === 1, 'Petr vidí svůj chybějící podklad')
ok((await as(ADMIN, `SELECT id FROM documents`)).length === 2, 'admin vidí vše')
await as(PETR, `INSERT INTO documents (client_id, source, status, uploaded_by, file_name) VALUES ('10000000-0000-0000-0000-000000000001','upload','new','${PETR}','lednice.pdf')`)
ok(true, 'Petr nahrál doklad v portálu')
try { await as(PETR, `INSERT INTO documents (client_id, source, status, uploaded_by) VALUES ('10000000-0000-0000-0000-000000000002','upload','new','${PETR}')`); ok(false, 'Petr nesmí nahrát cizí firmě') } catch { ok(true, 'Petr nesmí nahrát cizí firmě') }
try { await as(PETR, `INSERT INTO documents (client_id, source, status, uploaded_by) VALUES ('10000000-0000-0000-0000-000000000001','upload','posted','${PETR}')`); ok(false, 'klient nesmí vložit zaúčtovaný doklad') } catch { ok(true, 'klient nesmí vložit zaúčtovaný doklad') }
const upd = await as(PETR, `UPDATE documents SET amount_total = 1 RETURNING id`)
ok(upd.length === 0, 'klient nemůže měnit doklady')
try { await as(PETR, `INSERT INTO journal_lines (entry_id, client_id, line_no, account_debit, account_credit, amount) SELECT id, client_id, 1, '518', '221', 1 FROM journal_entries LIMIT 1`); ok(false, 'klient nesmí účtovat') } catch { ok(true, 'klient nesmí účtovat') }

console.log(fail ? `\n${fail} CHYB` : '\nVŠE PROŠLO')
process.exit(fail ? 1 : 0)

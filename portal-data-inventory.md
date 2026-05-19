# Portal Data & Process Inventory

> Cíl: Inventář datových entit a procesů v portále **Kliments**, jako podklad pro plánování AI-augmented CFO vrstvy (Fáze 1 = AI generátor měsíčního komentáře).
>
> Stav k: 2026-05-19. Repo: [github.com/klimentjosef-netizen/kliments-portal](https://github.com/klimentjosef-netizen/kliments-portal).
>
> Metoda: Statická analýza zdrojového kódu. **V repu nejsou SQL migrace** — schéma je rekonstruováno z `.from('...')` volání a TypeScript typů.

---

## Sekce 1: Supabase tabulky — kompletní výpis

V kódu jsou referencovány **4 tabulky** a **1 Storage bucket**. Žádný `supabase/migrations/` adresář, žádný `.sql` soubor v repu. Schéma se musí udržovat v Supabase Studio nebo externím nástroji.

### `profiles`

| Sloupec | Typ | Nullable | Poznámka |
|---|---|---|---|
| `id` | uuid | NE | PK, FK na `auth.users.id` |
| `email` | text | NE | Login email |
| `name` | text | ANO | Jméno klienta / firmy |
| `role` | text | NE | `admin` \| `client` |
| `service` | text | ANO | Comma-separated služby (`CFO na volné noze, Valuace, …`) |
| `active` | boolean | NE | Default `true`, admin může vypnout |

- **RLS — select:** Volá se všude (sidebar, AppShell, všechny stránky). Klient čte vlastní řádek; admin čte všechny.
- **RLS — update:** [admin/page.tsx:44,57](src/app/(portal)/admin/page.tsx#L44) (toggle `active`, edit `service`)
- **RLS — delete:** [api/delete-client/route.ts:45](src/app/api/delete-client/route.ts#L45)
- **Trigger:** Auto-insert profilu při vytvoření `auth.users` (definováno v Supabase, ne v repu)
- **Komentář:** Master tabulka uživatelů. Spojuje Supabase Auth s aplikační rolí.

### `reports`

| Sloupec | Typ | Nullable | Poznámka |
|---|---|---|---|
| `id` | uuid | NE | PK |
| `client_id` | uuid | NE | FK → `profiles.id` |
| `type` | text | NE | `diagnoza` \| `cfo` \| `valuace` \| `investor` \| `mentoring` |
| `title` | text | NE | Lidský název reportu |
| `data` | jsonb | NE | **Veškerá obsahová data** (viz níže) |
| `created_at` | timestamptz | NE | Auto `now()` |

- **RLS — select:** Klient čte své vlastní (`client_id = auth.uid()`); admin čte všechny
- **RLS — insert:** [api/onboarding-create-report/route.ts:97](src/app/api/onboarding-create-report/route.ts#L97), [admin/reports/page.tsx:49](src/app/(portal)/admin/reports/page.tsx#L49)
- **RLS — update:** Auto-save (debounce 800 ms) v každé stránce reportu — [cfo/page.tsx:171](src/app/(portal)/cfo/page.tsx#L171), [diagnoza/page.tsx:69](src/app/(portal)/diagnoza/page.tsx#L69), [valuace/page.tsx:53](src/app/(portal)/valuace/page.tsx#L53), [investor/page.tsx:54](src/app/(portal)/investor/page.tsx#L54), [mentoring/page.tsx:54](src/app/(portal)/mentoring/page.tsx#L54)
- **RLS — delete:** [api/delete-client/route.ts:38](src/app/api/delete-client/route.ts#L38) (cascade), [admin/reports/page.tsx:65](src/app/(portal)/admin/reports/page.tsx#L65)
- **Komentář:** **Hlavní obsahová tabulka.** Jeden řádek = jedna obrazovka klienta. Veškerý obsah (KPI, ledger, faktury, kalendář, plán, rizika) je v JSONB `data`.

**Struktura `data` podle `type`** (definice v [src/lib/types.ts](src/lib/types.ts) + [src/components/cfo/calcEngine.ts](src/components/cfo/calcEngine.ts)):

- **`type='cfo'`:** `title`, `subtitle`, `status`, `tiers[]` (cenové úrovně), `extras[]` (jednorázové příjmy), `fixed_costs[]`, `variable_cost_pct`, `budget` (CAPEX), `ramp_months`, `projection_months`, `business_start_month`, `business_profile`, `vat`, `taxes`, `receivables` (`invoices_issued[]` + `invoices_received[]`), `ledger` (`bank_balance` + `months[]` s `items[]`), `risks[]`, `steps[]`, `questions[]`, `summary`, volitelné `blocks[]`
- **`type='diagnoza'`:** `title`, `subtitle`, `status`, `metrics[]`, `strengths[]`, `weaknesses[]`, `cashflow_months[]`, `steps[]`, volitelné `blocks[]`
- **`type='valuace'`:** `result`, `methods[]`, `revenue_years[]`, `steps[]`, volitelné `blocks[]`
- **`type='investor'`:** `title`, `subtitle`, `badge`, `checklist[]`, `metrics[]`, `mrr_projection[]`, `mrr_target`, volitelné `blocks[]`
- **`type='mentoring'`:** `sessions[]` (`{ num, topic, date, notes, tasks, client_notes }`)

### `messages`

| Sloupec | Typ | Nullable | Poznámka |
|---|---|---|---|
| `id` | uuid | NE | PK |
| `sender_id` | uuid | NE | FK → `profiles.id` |
| `receiver_id` | uuid | NE | FK → `profiles.id` |
| `content` | text | NE | Text zprávy (Markdown ne, plain) |
| `read` | boolean | NE | Default `false` |
| `created_at` | timestamptz | NE | Auto `now()` |

- **RLS — select:** [zpravy/page.tsx:29](src/app/(portal)/zpravy/page.tsx#L29) — filtr `or('sender_id.eq.X,receiver_id.eq.X')`. [AppShell.tsx:36](src/components/AppShell.tsx#L36) — count unread pro badge.
- **RLS — insert:** [zpravy/page.tsx:73](src/app/(portal)/zpravy/page.tsx#L73). Triggeruje volání `/api/notify` pro mail.
- **RLS — update:** [zpravy/page.tsx:35](src/app/(portal)/zpravy/page.tsx#L35) (mark as read)
- **Realtime:** Supabase channel `messages` na `INSERT` event, client-side filtrace dle aktuálních dvou ID
- **Komentář:** Chat klient ↔ admin. Aktuálně 1:1 (admin vidí jen vlákno s jedním klientem v dané URL).

### `notifications` (rozbitá / chybí)

- Endpoint [api/notify/route.ts:32](src/app/api/notify/route.ts#L32) píše do tabulky `notifications` s předpokládanými sloupci: `recipient_id`, `type` (`new_message` \| `new_report` \| `report_updated`), `title`, `body`, `email`, `read`, `created_at`.
- **Stav:** Pokud tabulka neexistuje, kód jen logguje a vrátí 200 (defensive). Tabulku nikde v UI nečteme. Žádné maily se reálně neposílají — chybí Supabase Database Webhook nebo Edge Function s napojením na Resend/SendGrid.
- **Komentář:** Stub. Aktuálně **mrtvý kód**.

### `documents` (Storage bucket, ne SQL tabulka)

- Path pattern: `{user_id}/{folder_slug}/{filename}`
- Default složky (vytváří se lazy přes `.emptyFolderPlaceholder` upload): `ucetni-podklady`, `faktury`, `smlouvy`, `danove-priznani`, `ostatni`
- Operace v [dokumenty/page.tsx](src/app/(portal)/dokumenty/page.tsx): list (73, 87, 93), upload (119), download (128), delete (141), nová složka (149)
- **Komentář:** Souborové úložiště. Vše per-user, žádná sdílená složka mezi klientem a adminem.

---

## Sekce 2: UI obrazovky — co je za stránky

> `basePath: /portal` ([next.config.mjs:3](next.config.mjs#L3)) — všechny URL začínají `/portal/...`. Route groups `(portal)` jsou jen file-system organizace, neovlivňují URL.

### Admin obrazovky

| URL | Soubor | Popis | Hlavní komponenty |
|---|---|---|---|
| `/portal/admin` | [admin/page.tsx](src/app/(portal)/admin/page.tsx) | Seznam klientů (jméno, mail, služby, active toggle, delete). Tlačítko "+ Přidat klienta" otevírá `OnboardingWizard`. Multi-select služeb per klient inline. | `OnboardingWizard`, inline form |
| `/portal/admin/reports` | [admin/reports/page.tsx](src/app/(portal)/admin/reports/page.tsx) (580 lines) | CRUD reportů. Vybereš klienta + typ (diagnoza/cfo/valuace/investor/mentoring), pak edituješ 3 způsoby: typový form, blocks (JSON array), raw JSON editor. | `DiagnozaForm`, `CfoForm`, `ValuaceForm`, `InvestorForm`, `MentoringForm`, JSON editor |

### Klient obrazovky (admin vidí přes `?client=<id>`)

| URL | Soubor | Pro koho | Popis | Hlavní komponenty |
|---|---|---|---|---|
| `/portal/login` | [login/page.tsx](src/app/login/page.tsx) | Veřejné | Sign-in form (email, heslo, link na reset). Redirect na `/portal/dashboard` po úspěchu. | — |
| `/portal/reset-password` | [reset-password/page.tsx](src/app/reset-password/page.tsx) | Veřejné | Nové heslo + potvrzení (z reset linku) | — |
| `/portal/dashboard` | [dashboard/page.tsx](src/app/(portal)/dashboard/page.tsx) | Klient + admin | Vstupní stránka. KPI z CFO reportu (tržby, EBITDA, break-even, CAPEX ROI), risk list. Welcome banner. Admin používá `AdminClientPicker` pokud chybí `?client=`. | `StatCard`, `AdminClientPicker`, `EmptyState` |
| `/portal/cfo` | [cfo/page.tsx](src/app/(portal)/cfo/page.tsx) (525 lines) | Klient se službou „CFO na volné noze" + admin | **Hlavní operativní dashboard.** 12 tabů: Přehled, Měsíční plán, Cenotvorba, Cashflow, Pohledávky a závazky, DPH (skryto pokud neplátce), Daně & Odvody, Náklady, Rozpočet, Rizika & Plán, Dotazy, Import dat. Auto-save 800 ms debounce. Export Excel + PDF. | `DashboardTab`, `MonthlyPlanTab`, `PricingTab`, `CashflowTab`, `ReceivablesTab`, `VatTab`, `TaxesTab`, `CostsTab`, `BudgetTab`, `RisksTab`, `QuestionsTab`, `ImportTab`, `SaveToast` |
| `/portal/diagnoza` | [diagnoza/page.tsx](src/app/(portal)/diagnoza/page.tsx) | Klient se službou „Finanční diagnóza" + admin | Snapshot auditu firmy. Metrics, SWOT, 6M cashflow trend, action steps (toggle done + edit notes). Fallback `BlockRenderer` pokud `data.blocks`. | `BlockRenderer`, vlastní layout |
| `/portal/valuace` | [valuace/page.tsx](src/app/(portal)/valuace/page.tsx) | Klient se službou „Prodej za maximum" + admin | Valuace firmy. Result + 3 metody (DCF / srovnávací / multiple), revenue trend chart, akční plán. | `BlockRenderer`, vlastní layout |
| `/portal/investor` | [investor/page.tsx](src/app/(portal)/investor/page.tsx) | Klient se službou „Příprava na investora" + admin | Investor readiness checklist, 4 KPI cards (editable inline), 12M MRR projekce. | `BlockRenderer`, vlastní layout |
| `/portal/mentoring` | [mentoring/page.tsx](src/app/(portal)/mentoring/page.tsx) | Klient se službou „Mentoring" + admin | Mentoring sessions. Per session: téma, datum, poznámky od Josefa, task checklist, client_notes. | Vlastní layout |
| `/portal/dokumenty` | [dokumenty/page.tsx](src/app/(portal)/dokumenty/page.tsx) | Všichni autentizovaní | File browser. Vlevo seznam složek (5 default + custom). Vpravo soubory (ikona, velikost, datum, Download/Delete). Multi-upload, nová složka. Diacritics-strip v názvu souboru. | Vlastní layout |
| `/portal/zpravy` | [zpravy/page.tsx](src/app/(portal)/zpravy/page.tsx) | Všichni autentizovaní | Chat. Realtime přes Supabase channel. Klient píše adminovi (lookup `role='admin'`). Mark-as-read na otevření. **Známý problém:** admin vidí jen jedno vlákno, nemá UI pro výběr klienta. | Vlastní layout |

### Layout & wrappery

- **`(portal)/layout.tsx`** — Auth gate. Pokud uživatel není přihlášen → redirect `/login`. Render `AppShell`.
- **`AppShell.tsx`** ([src/components/AppShell.tsx](src/components/AppShell.tsx)) — Sidebar + topbar + main slot. Realtime unread badge na "Zprávy". Filtruje sidebar dle `profile.service`.
- **`Sidebar.tsx`** — Statická nav.
- **`Topbar.tsx`** — Jméno klienta, export tlačítka, log-out.
- **`middleware.ts`** ([src/middleware.ts](src/middleware.ts)) — Refresh session cookie, ochrana neveřejných rout.

---

## Sekce 3: Mapování UI → Supabase tabulky

| Obrazovka | Čte z | Píše do | API |
|---|---|---|---|
| `/portal/login` | `auth.users` (Supabase Auth) | session cookie | — |
| `/portal/reset-password` | `auth.users` | `auth.users` (update password) | — |
| `/portal/dashboard` | `profiles`, `reports` (cfo) | — | — |
| `/portal/cfo` | `profiles`, `reports` (cfo) | `reports.data` (debounce 800 ms) | — (přímo Supabase client) |
| `/portal/diagnoza` | `profiles`, `reports` (diagnoza) | `reports.data` (steps.done, steps.notes) | — |
| `/portal/valuace` | `profiles`, `reports` (valuace) | `reports.data` (steps) | — |
| `/portal/investor` | `profiles`, `reports` (investor) | `reports.data` (checklist, metrics) | — |
| `/portal/mentoring` | `profiles`, `reports` (mentoring) | `reports.data` (sessions[i].tasks, sessions[i].client_notes) | — |
| `/portal/dokumenty` | Storage bucket `documents` (list) | Storage bucket `documents` (upload/delete) | — |
| `/portal/zpravy` | `messages`, `profiles` | `messages` (insert), `messages` (update read) | `POST /portal/api/notify` |
| `/portal/admin` | `profiles` | `profiles` (active, service), `reports` (cascade delete) | `POST /portal/api/create-client`, `POST /portal/api/delete-client`, `POST /portal/api/onboarding-create-report` |
| `/portal/admin/reports` | `profiles`, `reports` (all) | `reports` (insert, update, delete) | — |

**API endpointy** (`src/app/api/`):

| Endpoint | Metoda | Auth | Vstup | Co dělá | Externí služby |
|---|---|---|---|---|---|
| `/portal/api/create-client` | POST | Admin (service-role key) | `{ email, name, password, service }` | Vytvoří `auth.users` přes `admin.createUser()` + insert do `profiles` | Supabase Auth Admin API |
| `/portal/api/delete-client` | POST | Admin | `{ clientId }` | Cascade delete: `reports` + `profiles` + `auth.users` | Supabase Auth Admin API |
| `/portal/api/notify` | POST | **Žádný gate (díra)** | `{ type, recipientId, title, body }` | Insert do `notifications` (pokud existuje), jinak no-op | — (čeká na webhook na Resend, neexistuje) |
| `/portal/api/onboarding-create-report` | POST | Admin | `{ clientId, onboarding }` | Vytvoří `reports` row typu `cfo` s defaulty z wizardu | — |

**Co tady NIKDE není volané:** Anthropic API, Resend, OpenAI, Stripe, žádné externí účetní API (Pohoda, ABRA). Žádný cron, žádné scheduled tasks.

---

## Sekce 4: Datové entity, které CHYBÍ

| # | Entita | V Supabase? | V UI? | Kde se používá | Co chybí |
|---|---|---|---|---|---|
| a | **Bankovní výpisy (raw transakce)** | Část | Část | `ImportTab.tsx` parsuje CSV → `ledger.months[].items[]` | Žádná samostatná tabulka `transactions`. Manuální CSV upload, žádné napojení na bankovní API (PSD2, ČSOB API). Žádný protiúčet, žádné kategorie z banky. Po importu se data sloučí do JSONB v `reports.data.ledger` — nelze dotazovat napříč klienty / měsíci. |
| b | **Faktury vydané (detail)** | Část | Ano | `ReceivablesTab.tsx` + `Invoice` typ v `calcEngine.ts` | Existuje pole `invoices_issued[]` v reports.data.receivables. **Bez položek faktury** — jen `amount`, `description` jako jeden string. Není linkováno na customer master (jen `client_name` text). Žádná QR/IBAN, žádný PDF render. |
| c | **Faktury přijaté (detail)** | Část | Ano | `Bill` typ v `calcEngine.ts` | Stejné jako (b). `invoices_received[]` v reports.data.receivables. Bez položek, bez DPH per řádek, bez splatnostních variací (zálohové, splátky). |
| d | **Pokladna (hotovostní pohyby)** | Ne | Ne | — | Není entita ani UI. Klient si vede mimo. |
| e | **Pohledávky po splatnosti** | Část | Ano | `calcAging()` v `calcEngine.ts:818` | Spočítáno on-demand z `invoices_issued[]`. **Žádný historický snapshot** — když faktura dnes po splatnosti, zítra ji nezaplatí, pozítří ji někdo smaže, nepoznáme to. |
| f | **Závazky po splatnosti** | Část | Ano | `calcAging()` | Stejné jako (e). |
| g | **Tarify a marže** | Část | Ano | `tiers[]`, `extras[]` v reports.data | Tarify jen tržbová strana (jméno + cena + Qty). **Žádné COGS per tarif**, žádné variabilní náklady per produkt → **marže per produkt se nepočítá**. Variabilní náklady jsou jen globální `variable_cost_pct`. |
| h | **Zaměstnanci a mzdy** | Ne | Ne | — | Žádná entita. Mzdy se pohřbívají do `fixed_costs[]` jako jediný řádek "Mzdy". Žádné per-osoba, žádné nábory/odchody, žádné hodinové vs paušál. Sociální + zdravotní jen jako jednolité částky. |
| i | **Smlouvy (metadata)** | Ne | Ne | — | `documents` bucket umožňuje upload PDF smluv, ale **žádná metadata** (strana, plnění, automatická obnova, výpověď, hodnota). |
| j | **Investice / CAPEX plán** | Ano | Ano | `budget.capex_items[]` v reports.data | Existuje pole jméno + amount + month. **Bez životnosti, odpisů, zůstatkové hodnoty, kategorie majetku.** ROI je textové, není počítaný. |
| k | **Strategické cíle** | **Ne** | Wizard se ptá, ale **zahazuje to** | Onboarding step 3 nabízí 6 cílů (Lepší cashflow, Marže, Růst, Exit, Investor, Cleanup) | **Nikde se neukládají.** Žádné porovnání plánu vs realitu na úrovni cíle. |
| l | **Sezónnost / business rytmus** | Ne | Ne | — | Nepoznáme, že klient má sezónu prosinec-leden. Cashflow ramp-up je generický (`ramp_months: 17`), bez sezónního koeficientu. |
| m | **Standardní kategorie nákladů** | **Ne (volný text)** | Ano | `fixed_costs[]` v reports.data | Nikde **chart of accounts**. Klient si píše názvy nákladů libovolně ("Nájem", "Najem kanceláře", "Pronájem prostor" = 3 různé řádky). Žádná standardní taxonomie (15-20 kategorií), žádné nákladová střediska. |

**Další chybějící entity** mimo seznam (a–m):

- **Customer / Supplier master** — Faktura má jen `client_name` text. Žádný customer ID, žádná historie pohledávek per zákazník.
- **Purchase orders / commitments** — Nesleduje se. Otevřené závazky před fakturou nejsou v systému.
- **Audit trail** — Žádná historie změn reportu. Supabase má systémový log, ale není exponovaný.
- **Stock / sklady** — Vůbec.
- **Notification log (real)** — Tabulka `notifications` defakto neexistuje (viz Sekce 1).
- **Plán vs skutečnost na úrovni KPI** — Měsíční plán (`MonthlyPlanTab`) řeší jen ledger items, ne strategické KPI (EBITDA target, cashflow target, atd.).

---

## Sekce 5: Onboarding workflow — co se DNES děje

Wizard: [src/components/admin/OnboardingWizard.tsx](src/components/admin/OnboardingWizard.tsx) (modal, 4 kroky).

### Krok 1: Základní informace (řádky 224–238)

Admin zadává:
- `name` (název firmy / jméno klienta) — required
- `email` — required (slouží jako login)
- `password` ≥6 znaků — required
- `phone` — optional, **NIKDE se neukládá**

### Krok 2: Profil firmy (řádky 241–300)

Admin zadává:
- `ico` (IČO) — optional
- `entity_type`: s.r.o. / OSVČ / a.s. / jiný (dropdown)
- `vat_payer`: ano / ne (toggle)
- `industry`: 13 možností (Výroba, Stavebnictví, Auto-servis, E-shop, Gastronomie, IT, Marketing, Zdravotnictví, Vzdělávání, Zemědělství, Doprava, Služby B2B, Jiné) — required
- `employees`: 1–5, 6–15, 16–50, 50+ (dropdown)
- `annual_revenue`: do 5 mil, 5–30, 30–100, 100–500, 500+ (dropdown)

### Krok 3: Služby a cíle (řádky 306–357)

Admin vybírá:
- `services[]` — multi-select 6 možností (CFO na volné noze, Valuace, Firemní audit, Startup kit, Příprava na investora, Mentoring) — required ≥1
- `goals[]` — multi-select 6 možností (Lepší cashflow, Marže, Růst, Exit, Investor, Cleanup) — **NEUKLÁDÁ SE**

### Krok 4: První čísla (řádky 360–412)

Admin zadává:
- `tiers[]` — řádky: jméno + cena + počet (`quantity`). Cena + jméno jdou do CFO reportu, **quantity se zahazuje**.
- `fixed_costs[]` — řádky: jméno + amount. Jdou přímo do CFO reportu.

**Žádná validace v kroku 4** — lze dokončit prázdné.

### Co se vytvoří v Supabase při dokončení wizardu

1. `POST /api/create-client`:
   - `auth.users` insert (přes admin API)
   - `profiles` insert: `{ id, email, name, role: 'client', service: data.services.join(', '), active: true }`
2. **Pokud** služby obsahují "CFO na volné noze":
   - `POST /api/onboarding-create-report`
   - `reports` insert: `{ type: 'cfo', client_id, title, data: {...} }`
   - Mapování ve [onboarding-create-report/route.ts:60+](src/app/api/onboarding-create-report/route.ts):
     - `business_profile`: entity_type, vat_payer, ico
     - `tiers`: jméno + cena (bez quantity)
     - `fixed_costs`: 1:1
     - `ramp_months`: hardcoded 17
     - 2 defaultní `steps[]`: "Doplnit reálná čísla minulého měsíce" (7 dní), "Doladit dashboard" (14 dní)
     - Prázdný `ledger.months[]`, prázdné `receivables.invoices_issued[]` a `receivables.invoices_received[]`
     - VAT a tax defaults dle entity_type + vat_payer

### Co se NEVYTVÁŘÍ (musí admin doplnit ručně)

- **Reálná historická čísla** — ledger zatím prázdný, klient musí naimportovat CSV bankovní výpis (`/portal/cfo` → tab Import).
- **Skutečné faktury** — pohledávky a závazky prázdné, klient musí naimportovat invoices.csv.
- **Plány měsíční (Měsíční plán tab)** — vygenerují se až při ručním ramp-up nebo importu.
- **VAT historie a DPH přiznání** — prázdné.
- **Daň z příjmů kalendář** — generuje se z entity_type + vat_payer, ale konkrétní zálohy nezná.
- **Reporty jiných typů** (`diagnoza`, `valuace`, `investor`, `mentoring`) — wizard je nikdy nezakládá, i když klient má danou službu. Admin musí jít do `/admin/reports` a založit ručně.
- **Cíle** — nikdy nikam.
- **Telefon** — odhazuje se.

### Kolik kroků by mělo být ideálně

Aby nový klient měl za **půl dne funkční portál**, chybějí 2 dodatečné kroky / featury:

5. **Import historických dat** — Wizard by měl ihned po vytvoření klienta nabídnout upload CSV bankovních výpisů za posledních 12 měsíců + invoices CSV. Dnes admin musí jít zvlášť do `/portal/cfo?client=X` → Import tab.
6. **Auto-generace ostatních reportů** — Pokud klient má službu „Valuace", „Diagnóza", atd., automaticky založit prázdný report daného typu. Dnes admin po wizardu sahá ručně do `/admin/reports`.

Plus **fixy** stávajících kroků:
- Ukládat `phone` (nejspíš do `profiles` jako sloupec)
- Ukládat `goals[]` (do `reports.data.goals` nebo do nového sloupce `profiles.goals` JSONB)
- Mít step **„0. Existující data od klienta"** — checklist (mám výpisy / mám faktury / mám účetnictví / nemám nic), který by ovlivnil výchozí stav.

---

## Sekce 6: Import dat — co umí portál načíst

Vše v [src/components/cfo/ImportTab.tsx](src/components/cfo/ImportTab.tsx) (515 řádků). Žádný jiný importer v repu.

### 1) Bankovní výpis CSV

- **Lokace v kódu:** [ImportTab.tsx:17-128](src/components/cfo/ImportTab.tsx#L17), `parseCsv()` na řádku 19, `parseCzNumber()` na řádku 54
- **Formát:** CSV s hlavičkami `date,description,amount,category`
  - `date`: YYYY-MM-DD
  - `description`: text (popis transakce)
  - `amount`: Czech format (`1 234,56` nebo `1234.56`)
  - `category`: `revenue` | `cost` | `tax` | `vat` | `capex` | `social` | `health` | `other`
  - Delimitery: `,` i `;`. Quoted fields OK.
- **Co dělá s daty:** Parsuje do `LedgerItem[]`, mergne do `reports.data.ledger.months[].items[]`, status `paid`, source `manual`.
- **Validace:** Datum musí být YYYY-MM-DD, amount musí parsovat. Chyby per řádek se zobrazí, neimportované řádky se přeskočí.
- **Status:** **Produkční.** Použito i v `MonthlyPlanTab`.

### 2) Faktury CSV (vydané + přijaté)

- **Lokace:** [ImportTab.tsx:130-185](src/components/cfo/ImportTab.tsx#L130), `parseInvoiceRows()`
- **Formát:** CSV s sloupci `type, number, client_or_supplier, description, amount_net, vat_rate, issued/received date, due date, paid_date, status`
  - `type`: `issued` | `received`
  - `status`: `draft` | `sent` | `paid` | `overdue` | `received` | `approved`
  - Flexibilní column matching (case-insensitive: `'type'`, `'number'`, `'client|supplier'`, `'descr'`, `'net|amount'`, …)
- **Co dělá s daty:** Parsuje do `Invoice[]` nebo `Bill[]`, syncne přes `syncInvoicesToLedger()` do `receivables.invoices_issued[]` / `invoices_received[]` + ledger.
- **Validace:** Number + strana required, amount musí parsovat, datum YYYY-MM-DD. Status se odvozuje z `paid_date`, pokud chybí.
- **Status:** **Produkční.**

### Co portál NEUMÍ načíst

- **Pohoda XML export** — žádná podpora
- **Money S3 export** — žádná
- **FlexiBee / ABRA** — žádná
- **PDF výpis (Sparkasse, banky)** — žádná, jen CSV
- **PDF faktury (OCR)** — žádná
- **Bank API (PSD2, Tatra Banka, ČSOB, KB)** — žádná, jen manuální CSV
- **XLSX / Excel přímo** — ne, jen CSV

> Na marketing webu se říká „Importuji z Pohody, Money S3, FlexiBee" — **to jako funkce v portále neexistuje.** Josef to nejspíš dělá ručně (export z účetka → CSV transformace → upload).

---

## Sekce 7: Hluché místo — kde data NESPRAVUJE portál

Kritická místa, kde CFO klient (a Josef sám) musí pracovat mimo portál:

1. **Mzdy a personalistika** — Žádná evidence zaměstnanců. Mzdy jsou v `fixed_costs[]` jako jediný řádek bez detailu. **Josef vede mzdy v Excelu nebo dělá Firsen mimo portál.**
2. **DPH přiznání** — Portál ukáže výši DPH k zaplacení v daňovém kalendáři, ale **nepřipraví podklad pro přiznání**. Josef generuje formulář mimo (Pohoda, MOJEDANE.cz).
3. **Daň z příjmů — formulář** — Stejné. Portál drží termíny, ne výpočet a podání.
4. **Pohledávky po splatnosti — historický trend** — Spočítá se `calcAging()` aktuální stav, **žádný snapshot v čase**. Když chce klient vidět "kolik měl po splatnosti v lednu", musí Josef ručně.
5. **Likvidita rolling 13 weeks (DPP/DPO/DSO)** — Portál má cashflow na **6 měsíců** v MonthlyPlanTab a 24 měsíců projekci, ale **klasický 13-week cash forecast** v podobě, jak ho dělají CFOs, neexistuje. Žádné DSO/DPO automaticky.
6. **Marže per produkt** — Tarify mají cenu, ne COGS. Marže per tier se nepočítá. Josef má marže pravděpodobně v Excelu.
7. **Working capital** — Není KPI v UI. Spočítatelné z dostupných dat, ale nikde se nezobrazuje.
8. **EBITDA bridge (proč EBITDA klesla / vzrostla)** — Nikde. Portál ukáže aktuální EBITDA, ne komentář "+200 tis. tržby, −150 tis. materiál, atd."
9. **Návratnost CAPEX** — Pole `roi_months` v `Budget.capex_items[]` je **textové input**, nepočítá se z dat. Josef si návratnost spočítá v Excelu nebo z hlavy.
10. **Customer / supplier analytics** — Top 5 zákazníků, koncentrace pohledávek, doba splatnosti per zákazník — **vůbec**. Faktury mají jen `client_name` text.
11. **Sezónnost / YoY srovnání** — Portál má `projection_months: 24`, ale **nezpracovává YoY** v UI. Je to slibováno na marketing webu ("year selector, YoY srovnání"), ale `YoyComparisonBlock` v block library existuje jen jako dekorativní komponenta — nečte z reálných dat.
12. **Bankovní zůstatek per účet** — `Ledger.bank_balance` je jedno číslo, **žádné per-IBAN**. Klient s 3 účty (BU, devizový, spořicí) je v háji.
13. **Smlouvy a obnovy** — Žádná evidence smluv (dodavatel, klient). Termíny obnovy nikde nesvítí.
14. **Compliance kalendář** — Daňový kalendář ano, ale **GDPR audit, ISO certifikáty, kontrola FÚ** — nikde.
15. **Měsíční komentář / narrative** — `summary` pole v CFO reportu **se nikde v UI nezobrazuje**. Josef píše komentář v emailu nebo v Word dokumentu.
16. **Reporting pro banku / investora** — Žádný „export pro banku" template (balance sheet + výsledovka + cashflow v jejich formátu). PDF export je generický.
17. **Plán vs skutečnost na KPI úrovni** — Měsíční plán řeší jen položky ledger, ne strategický KPI plán (cíl EBITDA 12 %, cíl tržby 6 mil. atd.).
18. **Notifikace na nadcházející termíny** — Daňový kalendář to ukáže v UI, ale **žádný email/SMS** v X dní před splatností. Tabulka `notifications` mrtvá (viz Sekce 1).

---

## Sekce 8: Co bude potřebovat AI vrstva

Předpoklad: za 1–2 měsíce AI generátor měsíčního komentáře (Fáze 1).

Kontextový builder pro AI musí sestavit balíček:

| # | Data | V Supabase? | Jak vytáhnout |
|---|---|---|---|
| 1 | **Business profile** | Ano | `reports.data.business_profile` z `type='cfo'` reportu |
| 2 | **Ledger za uplynulý měsíc + 11 předchozích** | Ano | `reports.data.ledger.months[]` filtr na rozsah |
| 3 | **Cashflow projekce 12 měsíců dopředu** | Ano (spočítá se ze stejných dat) | `forecastCashflow()` v `calcEngine.ts` |
| 4 | **Faktury po splatnosti (aging)** | Ano | `calcAging(reports.data.receivables.invoices_issued)` + `invoices_received` |
| 5 | **Tarify a marže** | **Část** | `tiers[]` má cenu; **COGS chybí** → buď doplnit jako `tiers[i].cogs`, nebo počítat z `variable_cost_pct` |
| 6 | **Akční plán + admin poznámky** | Ano | `reports.data.steps[]` + `reports.data.risks[]` (pole `step.notes`, `risk.action`) |
| 7 | **Posledních 2–3 měsíčních komentářů** | **Ne** | `reports.data.summary` je jedno pole, **přepisuje se**. Potřebuje novou strukturu: `reports.data.monthly_commentary[] = [{ month, generated_at, body, author: 'ai' \| 'human' }]` |
| 8 | **Cíle klienta** | **Ne** | Wizard se ptá, zahazuje. Potřebuje sloupec / pole `profiles.goals` nebo `reports.data.goals`. |
| 9 | **Plán měsíční (očekávané položky)** | Ano | `reports.data.ledger.months[i].items[]` se `status='planned'` nebo `expected` |
| 10 | **Skutečnost vs plán per měsíc** | Ano (počítá se) | `calcMonthlyVariance()` v `calcEngine.ts` |
| 11 | **Daňový + DPH kalendář pro nadcházející kvartál** | Ano | `reports.data.vat` + `reports.data.taxes` + Czech tax engine v `calcEngine.ts` |
| 12 | **Předchozí chat zprávy** (kontext rozhovorů s Josefem) | Ano | `messages` filtr `sender_id` IN (klient, admin) za posledních N dní |
| 13 | **Top rizika** | Ano | `reports.data.risks[]` setříděno dle `severity` |
| 14 | **Historický bankovní zůstatek** | **Část** | `ledger.bank_balance` je aktuální. **Snapshot per měsíc chybí** → potřebuje `bank_balance_history[]` v `data.ledger`. |
| 15 | **Sezónní data (YoY)** | Pokud > 12 měsíců ledger | Stejné `ledger.months[]`, agregace YoY |
| 16 | **Industry benchmark** | **Ne** | Žádná data o průměrech v dané `industry` (Auto-servis, Gastronomie). **Potřebuje externí dataset** (ČSÚ, RZA průmyslové statistiky) nebo manuálně udržovaný heuristics. |

**Co je potřeba dopracovat před AI fází:**

1. **Migrace schématu Supabase** — Přidat:
   - `profiles.phone` (text)
   - `profiles.goals` (jsonb) nebo `reports.data.goals` (jsonb pole)
   - `reports.data.monthly_commentary[]` — nová struktura pro historii komentářů
   - `reports.data.ledger.bank_balance_history[]` — snapshots
   - `tiers[].cogs` — COGS per tarif
   - `tiers[].variable_cost_pct` — variabilní % per tarif (override globálního)
2. **Vytvořit/opravit `notifications`** — Tabulka + funkční Resend integrace
3. **Zafixovat onboarding** — Ukládat goals, telefon, automaticky vytvářet ostatní typy reportů
4. **AI context builder** — Server-side funkce `buildMonthlyContext(clientId, month)` která zagreguje #1–16 do jednoho JSON balíčku
5. **AI endpoint** — `POST /portal/api/generate-monthly-commentary` → Anthropic Claude API → uloží do `reports.data.monthly_commentary[]`
6. **UI pro review komentáře** — Admin musí mít „Review AI komentář" tlačítko před tím, než klient uvidí. Ideálně nový tab v `/portal/cfo` → „Komentář měsíce".

---

## Shrnutí pro Josefa

### Co portál dnes umí

Portál je **funkční MVP**, který drží 5 typů reportů per klient v JSONB jednoho velkého reportu. Nejhustší obrazovka je `/portal/cfo` (12 tabů — 525 řádků kódu) — drží ceník, náklady, cashflow, DPH/daňový kalendář, faktury, pohledávky, plán měsíce, rizika, dotazy. **Importér CSV bankovních výpisů a faktur funguje produkčně** — to je největší skrytá hodnota portálu. Auto-save 800 ms u všech tabů. Chat s admin v realtime. Cluster funkcí na úrovni Pohody/Money to ale není — chybí celá vrstva personalistiky, smluv, customer master, audit trail.

### 3 největší díry, které blokují aby z portálu byl CFO nástroj

1. **Schéma DB neexistuje v repu** — Nemáš jistotu, co je v Supabase reálně. Žádné migrace v `supabase/migrations/`, žádný `db schema dump`. Když ti spadne projekt nebo budeš měnit účet, **schéma znovu nepostavíš.** Riziko ztráty struktury.
2. **Notifikace + auto-trigger akcí jsou mrtvé** — Tabulka `notifications` nejspíš neexistuje, endpoint je defensive stub, žádný Resend, žádný cron. Klient nedostane „za 3 dny DPH 50 000 Kč" mail, „faktura 14 dní po splatnosti" mail. **Portál je čistě pull, ne push.**
3. **Žádný customer/supplier master + žádný chart of accounts** — Faktury jsou volný text (`client_name: 'Hlavni s.r.o.'` vs `'Hlavní s.r.o'` = dvě věci). Náklady jsou volný text. **Nelze dotazovat napříč klienty, dělat top-5 odběratelů, srovnávat náklady v čase.** Pro AI komentář a benchmark je to fatální.

### Co by Josef měl udělat jako první

V tomto pořadí:

1. **Vytáhnout aktuální schéma Supabase do repa** (1 den) — `supabase db dump --schema public > supabase/schema.sql`, přidat sem migrace na nové sloupce co plánujete přidávat. Bez toho je všechno ostatní křehké.
2. **Opravit `notifications` + nasadit Resend** (1–2 dny) — Vytvořit tabulku, definovat Supabase Database Webhook, vyrobit edge function nebo route handler, který přečte řádek a pošle mail. Tabulka existuje → maily fungují.
3. **Implementovat sloupce/struktury, které potřebuje AI fáze** (2–3 dny):
   - `profiles.goals jsonb`
   - `profiles.phone text`
   - `reports.data.monthly_commentary[]`
   - `reports.data.ledger.bank_balance_history[]`
4. **Postavit AI context builder + endpoint** (3–5 dní) — `buildMonthlyContext(clientId, month)` + `POST /api/generate-monthly-commentary`. Volá Anthropic Claude (model `claude-opus-4-7` nebo `claude-sonnet-4-6`), system prompt = Josefův styl + struktura.
5. **UI review pro admin** (1 den) — Nový tab nebo modal v `/portal/cfo`, kde admin schválí AI komentář před publikací klientovi.

### Realistický odhad času na vyplnění děr

- **Fáze 0 (infrastruktura: schéma, notifikace):** 3–4 dny
- **Fáze 1 (AI měsíční komentář, jak jsme se bavili):** 7–10 dní
- **Fáze 2 (chybějící entity: zaměstnanci, customer master, smlouvy):** 3–4 týdny (každá entita = schéma + UI + import)
- **Fáze 3 (industry benchmarks + sezónnost):** 1–2 týdny + sběr externích dat

Celkem cca **2,5 měsíce solidní práce** od dnešního stavu, aby z portálu byl skutečný „AI-augmented CFO" — ne marketingová formulace, ale funkční nástroj, který sám hlídá deadliny, sám generuje komentáře, sám identifikuje anomálie a Josef má v týdnu **30 % více kapacity**, protože nemusí ručně sledovat aging faktur a sám psát měsíční report.

Pokud Fáze 0 + 1 stihnu do 3 týdnů, **každý další měsíc šetří Josefovi 4–6 hodin per klient.** Při 8 aktivních CFO klientech = 32–48 hodin měsíčně = **2 pracovní týdny ročně zpátky**.

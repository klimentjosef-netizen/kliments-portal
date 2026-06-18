# Inventář klientského portálu Kliments

> Deliverable pro třetí stranu — stav k 19. 5. 2026.
> Repo: `github.com/klimentjosef-netizen/kliments-portal`
> Hosting: Vercel · doména `app.kliments.cz`, base path `/portal/*`.
> Stack: Next.js 14 (App Router, RSC + Client Components) + Supabase (Auth, Postgres, Storage, Realtime) + Tailwind + Chart.js + html2canvas/jsPDF/xlsx.

Cílem dokumentu je dát čtenáři, který portál nikdy neviděl, kompletní obraz toho, co aplikace umí, jak je strukturovaná a kde v repu jednotlivé části žijí.

---

## Část 1: Inventář stránek

Aplikace má dvě skupiny route:

- **Public** (`src/app/login`, `src/app/reset-password`) — bez auth.
- **Portal** (`src/app/(portal)/...`) — vše uvnitř route group `(portal)`, sdílí společný `AppShell` (sidebar + topbar) přes `src/app/(portal)/layout.tsx`.

Před každou portal route projde request přes `src/middleware.ts` → `src/lib/supabase/middleware.ts` (`updateSession`). Tento middleware:

- nepřihlášeného přesměruje na `/login` (kromě `/login` a `/reset-password`),
- přihlášeného na `/login` přesměruje na `/dashboard`,
- pro cesty `/admin*` ověří `profiles.role === 'admin'`, jinak redirect na `/dashboard`.

Druhou vrstvu route-ochrany dělá client-side `AppShell` (`src/components/AppShell.tsx`) — pro `role === 'client'` načte povolené routy z `getRoutesForService(profile.service)` a nepovolené nahradí `/dashboard`.

Šipka `/` (`src/app/page.tsx`) je server-side redirect na `/dashboard`.

### 1.1 Login — `/portal/login`

- **Název v UI:** „Kliments · Klientský portál · Finanční řízení"
- **K čemu slouží:** Přihlášení e-mailem a heslem; sekundárně odeslání odkazu pro reset hesla.
- **Co klient vidí:** Karta s logem, dvě pole (e-mail, heslo), tlačítko „Přihlásit se", odkaz „Zapomenuté heslo?". Po kliknutí se přepne do reset-režimu (pole e-mail + tlačítko „Odeslat odkaz"). Po odeslání se ukáže potvrzovací obrazovka.
- **Akce:** `supabase.auth.signInWithPassword({ email, password })` → router push `/dashboard`. Reset: `supabase.auth.resetPasswordForEmail(email, { redirectTo: '/portal/reset-password' })`.
- **Data:** Supabase Auth.
- **Soubory:** `src/app/login/page.tsx`.

### 1.2 Reset password — `/portal/reset-password`

- **Název v UI:** „Nastavení nového hesla"
- **K čemu slouží:** Dokončení flow resetu hesla po kliknutí na odkaz z e-mailu.
- **Co klient vidí:** Dvě pole (nové heslo + potvrzení), validace ≥ 6 znaků a shody. Po uložení potvrzení a po 2 s redirect na `/dashboard`.
- **Akce:** `supabase.auth.updateUser({ password })`.
- **Data:** Supabase Auth.
- **Soubory:** `src/app/reset-password/page.tsx`.

### 1.3 Dashboard — `/portal/dashboard`

- **Název v UI:** „Dashboard" (uvítací karta „Dobrý den, {jméno}")
- **K čemu slouží:** Rozcestník po přihlášení. Shrnuje stav nejdůležitějšího reportu (CFO) — měsíční tržby, EBITDA, break-even, návratnost CAPEX. Připomíná rizika.
- **Co klient vidí:**
  - Welcome banner (jméno, aktivní služba, tlačítko „Napsat Josefovi →" do `/zpravy`).
  - 4× `StatCard`: Měsíční tržby, EBITDA, Break-even (počet členů), Návratnost CAPEX.
  - Sekce „Aktuální rizika" — barevné karty (critical/medium/low) z `data.risks` CFO reportu.
  - Pokud klient ještě nemá CFO report → `EmptyState` s personalizovaným textem podle služby.
- **Co klient může dělat:** Klik na „Napsat Josefovi" → chat. Kromě toho je dashboard read-only.
- **Data:**
  - `profiles` (jméno, služba) — Supabase select.
  - `reports` (type=`cfo`, nejnovější) — sloupce `data.tiers`, `data.extras`, `data.fixed_costs`, `data.budget` apod. Hodnoty se počítají v reálném čase přes `calcRevenue / calcOpex / calcBreakeven / calcCapexRoi` z `src/components/cfo/calcEngine.ts`. Pokud nejsou tiery, fallback na legacy string fieldy (`d.revenue`, `d.ebitda`…).
- **Soubory:** `src/app/(portal)/dashboard/page.tsx`, `src/components/StatCard.tsx`, `src/components/EmptyState.tsx`.

### 1.4 Finanční diagnóza — `/portal/diagnoza`

- **Název v UI:** „Finanční diagnóza"
- **K čemu slouží:** One-shot audit firmy — metriky, SWOT, cashflow trend, akční plán s deadliny.
- **Co klient vidí:**
  - Tmavý header s názvem, podtitulkem a status badge.
  - Pokud `data.blocks` existuje, použije se `BlockRenderer` namísto default UI (viz Block library níže).
  - Default UI: až 4 metriky (`d.metrics`), pruhový graf cashflow 6 měsíců, dvě SWOT karty (silné × slabé), grid karet „Akční plán".
- **Co klient může dělat:** Označovat kroky jako hotové (toggle), psát si do nich vlastní poznámky (auto-save 800 ms debounce). Vše ostatní je read-only.
- **Data:** `reports` type=`diagnoza`. Struktury: `metrics`, `strengths`, `weaknesses`, `cashflow_months`, `steps` (s `done` a `notes`), `blocks` (volitelně).
- **Admin pohled:** Bez `?client=<id>` admin uvidí `AdminClientPicker`; s parametrem se načte report cíleného klienta.
- **Soubory:** `src/app/(portal)/diagnoza/page.tsx`, `src/components/blocks/BlockRenderer.tsx`, `src/components/AdminClientPicker.tsx`, `src/components/SaveToast.tsx`.

### 1.5 CFO na volné noze — `/portal/cfo`

Hlavní operativní obrazovka portálu. 12 tabů, perzistuje se přes URL query `?tab=…`.

- **Název v UI:** „CFO na volné noze" (pro admina „CFO · {jméno klienta}").
- **K čemu slouží:** Smart-vCFO panel — plánování, controlling, daňový kalendář, cashflow projekce, what-if simulace, P&L podle ledger items.
- **Co klient/admin uvidí v hlavičce:**
  - Tmavý banner s titulem + status badge (Aktivní / Pozastaveno / Ukončeno).
  - Tlačítka **Export Excel** (`xlsx` přes `lib/excelExport.ts`, 4–5 listů: Souhrn, Ledger, Faktury vydané, Faktury přijaté, YoY) a **Export PDF** (`html2canvas` + `jspdf` přes `lib/pdfExport.ts`).
  - „Business profile bar" — selecty pro `entity_type` (s.r.o./OSVČ/a.s.), `vat_payer`, `vat_transition_date`, `founding_date`. Tyto hodnoty řídí daňový kalendář a viditelnost tabu DPH.
  - **Year selector** (zobrazí se jen když ledger má data z ≥2 let).
  - Pokud existuje `data.blocks`, vykreslí se NAD klasickým CFO UI (block-based custom dashboard).
- **Soubory page-level:** `src/app/(portal)/cfo/page.tsx` (cca 525 řádků), `src/components/cfo/CfoTabs.tsx`, `src/components/cfo/calcEngine.ts` (1 512 řádků pure-function kalkulátor + typy).
- **Auto-save:** všechny změny v tabech volají `updateData(key, value)` → debounce 800 ms → `supabase.from('reports').update({ data })`. Toast „Ukládám…" → „✓ Uloženo HH:MM" z `SaveToast`.

#### 1.5.1 Tab: Přehled (`dashboard`) — `DashboardTab.tsx` (324 řádků)

- KPI souhrn: Cash position (6 měsíců dopředu), break-even progres, měsíční EBITDA, počet členů.
- Toggle „Jednoduché / Detailní" mění `profile.complexity` (vliv na to, kolik nápověd se ukáže v jiných tabech).
- **Doporučení** (z `calcRecommendations`) — priorita urgent/important/tip, klikem se proklikne do relevantního tabu.
- **Timeline** nejbližších plateb a deadline-ů (z `getUpcomingTimeline`).
- Aktualní měsíc — confirmed vs. expected income/expense.
- `ActualVsPlanChart` (Chart.js) — posledních 6 měsíců, expected vs. actual.
- What-if simulace: input „jednorázová investice/výdaj" → přepočet cash positionu.

#### 1.5.2 Tab: Měsíční plán (`monthly`) — `MonthlyPlanTab.tsx` (545 řádků)

- Selector měsíce (předchozí/aktuální/další).
- Příjmy a výdaje rozdělené do dvou sekcí, plus karta s daňovými deadliny daného měsíce (`monthDeadlines`).
- Položky (`LedgerItem`) jsou buď automaticky vygenerované (z tarifů, fixních nákladů, taxes, vat) nebo manuální. Klient u každé položky:
  - **Confirm** (částka byla zaplacena),
  - **Skip** (přeskočit, neproběhne),
  - Edit description, částku actual, vat sazbu.
- Možnost **Lock month** — po uzamčení se item-y nepřegenerují (jinak `generateExpectedItems` při každém načtení obohatí).
- Header KPI: confirmed income, confirmed expense, net.

#### 1.5.3 Tab: Cenotvorba (`pricing`) — `PricingTab.tsx`

- Editace **tarifů** (`tiers[]`): název, cena, kapacita, aktuální členové, badge, features.
- Editace **doplňkových příjmů** (`extras[]`): název, množství, cena/ks, jednotka.
- KPI ve čtyřech kartách: měsíční příjem, break-even %, EBITDA margin, ROI CAPEX.
- Add/remove tarif (limit 1–8).

#### 1.5.4 Tab: Cashflow (`cashflow`) — `CashflowTab.tsx` (279 řádků)

- KPI strip (příjem, EBITDA, break-even, ROI).
- **Cashflow projekce** N měsíců dopředu (default 24) — `calcHybridCashflow`: kombinuje skutečná data z ledger s plánem podle ramp-up křivky.
- Cashflow chart (Chart.js, plnohodnotný bar+line).
- Doughnut chart revenue mixu.
- **Scenarios** (`calcScenarios`) — 5/10/15/20/30/40/50 členů, dopad na EBITDA a break-even.
- **What-if** lokálně: +N členů, ±Y Kč/ks, jednorázový náklad.
- Settings: ramp-up měsíců, projekce měsíců, business start month.

#### 1.5.5 Tab: Pohledávky a závazky (`receivables`) — `ReceivablesTab.tsx`

- Toggle „Vydané faktury / Přijaté faktury".
- Faktury vydané (`Invoice`): číslo, klient, popis, částka, DPH, splatnost, status (draft/sent/paid/overdue). Aging — kolik je 0–30, 31–60, 60+ dní po splatnosti.
- Faktury přijaté (`Bill`): obdobně, status (received/approved/paid/overdue).
- Add/remove řádky, klikací status.
- Tyto faktury se ve `syncInvoicesToLedger` synchronizují do ledger items (aby je viděl Monthly plan).

#### 1.5.6 Tab: DPH (`vat`) — `VatTab.tsx`

- Tab je skrytý pokud `!profile.vat_payer && !profile.vat_transition_date`.
- KPI: output DPH, input DPH (vč. CAPEX), liability za poslední období.
- **Sazby** (`vat.rates[]`) — service description, sazba (21/15/12/0), poznámka.
- **Období DPH** (`vat.periods[]`) — label (Q1 2026 atd.), output/input/liability, paid checkbox, due_date. Editovatelné.
- Výpočet `calcVatFromLedger(ledger)` — DPH se počítá z `vat_amount` na položkách ledger, ne ze cashflow.

#### 1.5.7 Tab: Daně & Odvody (`taxes`) — `TaxesTab.tsx`

- KPI: měsíční náklad na daně + odvody, roční odhad.
- Tři sekce: **Daň z příjmů** (sazba %, roční odhad, zálohy), **Sociální** (měsíčně + roční zálohy), **Zdravotní** (totéž).
- Každá záloha: období, částka, splatnost, paid toggle, status badge (zelená/oranžová/červená podle dní do splatnosti).
- **Other taxes** (`taxes.other_taxes[]`) — silniční, srážková, etc. (volitelně).
- Zdroj kalendáře: `getCzechTaxCalendar(profile, taxes, vat, ledger)` v `calcEngine.ts`.

#### 1.5.8 Tab: Náklady (`costs`) — `CostsTab.tsx`

- Editovatelný seznam **fixních nákladů** (`fixed_costs[]`: name, amount).
- Pole **variabilní náklady % z tržeb** (default 5 %).
- Součet fixních nákladů zobrazený jako sumary.

#### 1.5.9 Tab: Rozpočet (`budget`) — `BudgetTab.tsx`

- Tři KPI: total rozpočet, CAPEX, provozní rezerva.
- **CAPEX items** (`capex_items[]`): name, planned, spent, progress bar. Add/remove.
- **Runway**: kolik měsíců rezerva vydrží při aktuální měsíční ztrátě (pokud EBITDA < 0).
- Reserve drawn input.

#### 1.5.10 Tab: Rizika & Plán (`risks`) — `RisksTab.tsx`

- Seznam **rizik** (`risks[]`: level, title, desc) — selector level (critical/medium/low).
- Seznam **kroků** (`steps[]`: num, deadline, title, desc, done) — checkbox done, editable polí.
- Add/remove položky.

#### 1.5.11 Tab: Dotazy (`questions`) — `QuestionsTab.tsx`

- Asynchronní Q&A mezi klientem a Josefem.
- Input pro novou otázku, dvě sekce: **Open** a **Resolved**. Toggle status. Možnost odpovědi (`answer` text).

#### 1.5.12 Tab: Import dat (`import`) — `ImportTab.tsx` (515 řádků)

- Vlastní jednoduchý CSV parser (`parseCsv`) + parser českých čísel („1 234,56 Kč" → 1234.56).
- Import **bankovních výpisů** → `LedgerItem`s do měsíců.
- Import **faktur vydaných / přijatých** → `receivables.invoices_issued/received`.
- Po importu kategorizace, status-set, sync do ledger.

---

### 1.6 Prodej za maximum — `/portal/valuace`

- **Název v UI:** „Prodej za maximum"
- **K čemu slouží:** Odhad hodnoty firmy 3 metodami + akční plán před prodejem.
- **Co klient vidí:**
  - Tmavý banner s hlavní hodnotou (`result.value`) a 3 dílčími položkami.
  - 3 karty „Metody ocenění" (`methods[]`: name, value, weight %), barevný progress.
  - Sloupcový graf „Vývoj tržeb" (`revenue_years[]`).
  - „Akční plán před prodejem" (`steps[]`) — interaktivní toggle done a notes.
- **Akce:** Označit krok hotový/nehotový, psát poznámky, auto-save.
- **Data:** `reports` type=`valuace`. `result`, `methods`, `revenue_years`, `steps`.
- **Admin:** Klasický `AdminClientPicker` flow.
- **Soubory:** `src/app/(portal)/valuace/page.tsx`.

### 1.7 Příprava na investora — `/portal/investor`

- **Název v UI:** „Příprava na investora"
- **K čemu slouží:** Investor-readiness checklist + klíčové metriky + 12-měsíční MRR projekce.
- **Co klient vidí:**
  - Růžový gradient banner s nadpisem + badge (např. „Seed Round").
  - „Připravenost" — progress bar s % splnění checklistu.
  - Levý sloupec: checklist (toggle done — zelený check, červené ✗).
  - Pravý sloupec: 4 KPI karty s **editovatelnou hodnotou** (in-place input).
  - Pruhový graf 12-měsíční MRR projekce (`mrr_projection[]` v %, `mrr_target`).
- **Akce:** Toggle položek, edit metric hodnot, auto-save.
- **Data:** `reports` type=`investor`. `checklist`, `metrics`, `mrr_projection`, `mrr_target`, `badge`.
- **Soubory:** `src/app/(portal)/investor/page.tsx`.

### 1.8 Mentoring — `/portal/mentoring`

- **Název v UI:** „Mentoring"
- **K čemu slouží:** Zápisky a úkoly z mentoringových sezení.
- **Co klient vidí:** Pro každé sezení (`sessions[]`) karta — číslo, téma, datum, poznámky z konzultace (od Josefa), seznam úkolů (checkboxy), pole pro vlastní poznámky klienta.
- **Akce:** Toggle task done, psát do `client_notes`, auto-save.
- **Data:** `reports` type=`mentoring`. `sessions[]: { num, topic, date, notes, tasks, client_notes }`.
- **Soubory:** `src/app/(portal)/mentoring/page.tsx`.

### 1.9 Dokumenty — `/portal/dokumenty`

- **Název v UI:** „Dokumenty"
- **K čemu slouží:** File storage per klient — účetní podklady, faktury, smlouvy, daňové přiznání, ostatní, plus vlastní složky.
- **Co klient vidí:**
  - Header s počtem souborů a složek.
  - Levý sloupec — seznam složek (default 5 + custom). Tlačítko „+ Nová" pro vytvoření.
  - Pravý sloupec — soubory v aktivní složce. Ikona podle přípony (PDF / Excel / Word / obrázek / generic). Velikost, datum, tlačítka Stáhnout/Smazat.
- **Akce:** Upload (multi-file), download, delete file, create folder. Names sanitizují diacritics.
- **Data:** Supabase Storage bucket `documents`, prefix `{user.id}/{folder_slug}/{filename}`. Default sluhy: `ucetni-podklady`, `faktury`, `smlouvy`, `danove-priznani`, `ostatni`. Vlastní složky se zakládají přes `.emptyFolderPlaceholder` upload.
- **Soubory:** `src/app/(portal)/dokumenty/page.tsx`.

### 1.10 Zprávy — `/portal/zpravy`

- **Název v UI:** „Zprávy" (chat s Josefem Klimentem)
- **K čemu slouží:** Realtime chat 1-on-1 mezi klientem a adminem.
- **Co klient vidí:**
  - Hlavička s avatarem „JK" — Josef Kliment, podtitulek „Vaše finanční řízení".
  - Scrollovací view zpráv (vlastní zprávy vpravo růžové, příchozí vlevo béžové). Timestamp HH:MM.
  - Input + odeslat tlačítko.
- **Realtime:** Supabase realtime channel `messages` na `INSERT` v tabulce `messages`, filtrované podle `sender_id` nebo `receiver_id` rovno `user.id`.
- **Po načtení:** všechny zprávy s `receiver_id = user.id` se nastaví `read = true`.
- **Notifikace:** Při odeslání klient zavolá `POST /portal/api/notify` s typem `new_message`, který uloží do `notifications` tabulky.
- **Logika:** Klient vždy posílá adminovi (najde `profiles where role='admin' limit 1`). Admin musí v portálu vybírat příjemce (POZOR: tato část v současné implementaci není v UI explicitní — `sendMessage` posílá vždy na `adminId`, takže když je odesílatel admin, zprávu odešle sám sobě; viz známé issues níže).
- **Soubory:** `src/app/(portal)/zpravy/page.tsx`, badge unread v `AppShell.tsx`.

### 1.11 Admin — `/portal/admin` (klienti)

- **Název v UI:** „Klienti" / „Správa klientů"
- **K čemu slouží:** Hlavní admin obrazovka — seznam všech klientů, přidání nového, on/off, přiřazení služeb, smazání.
- **Co admin vidí:**
  - Tlačítko „+ Přidat klienta" → otevře `OnboardingWizard` (modal, 4 kroky).
  - Tabulka klientů (filtrovaná `role === 'client'`): jméno, e-mail, služby (chipy — multi-select), status (Aktivní/Neaktivní), Smazat.
  - Klik na řádek → redirect na `/cfo?client={id}` (zobrazí CFO toho klienta).
- **Akce:**
  - Toggle service chipu — update `profiles.service` (čárkou oddělené názvy).
  - Toggle status — update `profiles.active`.
  - Smazat klienta — confirm dialog, pak `POST /portal/api/delete-client` (smaže reporty + profile + auth user).
  - Onboarding wizard kroky:
    1. Základní info (jméno, e-mail, telefon, heslo ≥ 6 znaků).
    2. Profil firmy (IČO, právní forma, plátce DPH, obor, počet zaměstnanců, roční obrat).
    3. Služby + cíle (multi-select).
    4. První čísla (zdroje tržeb, fixní náklady).
    Po dokončení: `POST /portal/api/create-client` + (pokud zvolil CFO) `POST /portal/api/onboarding-create-report`.
- **Data:** `profiles` (read/update/delete). Server-side ochrana přes middleware (`profiles.role`).
- **Soubory:** `src/app/(portal)/admin/page.tsx`, `src/components/admin/OnboardingWizard.tsx`.

### 1.12 Admin Reports — `/portal/admin/reports`

- **Název v UI:** „Správa reportů" / „Reporty klientů"
- **K čemu slouží:** CRUD nad `reports` — admin tu vytvoří nebo upraví report konkrétnímu klientovi.
- **Co admin vidí:**
  - Tlačítko „+ Nový report".
  - Editor v inline panelu: výběr klienta + typ reportu (diagnoza / cfo / valuace / investor / mentoring).
  - Tři režimy editace:
    - **Formulář** — typ-specifický formulář (`DiagnozaForm`, `CfoForm`, `ValuaceForm`, `InvestorForm`, `MentoringForm`). CFO formulář je nejsložitější (tiery, extras, fixed costs, budget, risks, steps, questions, vše inline).
    - **Bloky (vlastní layout)** — JSON pole `Block[]` (viz Block library v Části 4).
    - **Celý JSON** — raw editor pro `reports.data`.
  - Tabulka existujících reportů: klient, typ (badge), název, datum, akce Upravit/Smazat.
- **Akce:** Save (insert nebo update), Delete (confirm).
- **Soubory:** `src/app/(portal)/admin/reports/page.tsx` (cca 580 řádků s embedded form komponentami).

### 1.13 Custom view / Block-based dashboardy

Není to samostatná route. Block library funguje na principu „pokud `reports.data.blocks` existuje, vykreslí se přes `BlockRenderer`". Aktuálně se to aplikuje v:

- `/portal/diagnoza` — `customBlocks` nahradí default UI.
- `/portal/cfo` — block-based dashboard se vyrenderuje NAD klasickým CFO UI (operativní tab-y zůstávají dostupné pod ním).

Detaily v Části 4 a v `src/components/blocks/README.md`.

---

## Část 2: API endpointy

Všechny endpointy žijí v `src/app/api/*/route.ts` a běží jako Next.js Route Handlers (Edge/Node). `basePath` znamená, že z frontendu se volají jako `/portal/api/<name>`.

### 2.1 `POST /portal/api/create-client`

- **Soubor:** `src/app/api/create-client/route.ts`
- **Co dělá:** Vytvoří v Supabase Auth nového uživatele (`email_confirm: true`, tedy bez verifikačního e-mailu) a v tabulce `profiles` updatne řádek, který automaticky vznikne přes Supabase trigger (`role='client'`, `service`, `active=true`).
- **Auth gate:** Vyžaduje session přihlášeného admina. Pokud `profile.role !== 'admin'` → 403.
- **Vstup (JSON):** `{ email, name, password, service }`.
- **Výstup:** `{ success: true, userId }` nebo `{ error }` (400 missing fields / 401 unauthorized / 403 forbidden / 400 z auth).
- **Použití:** OnboardingWizard krok 4 (submit).
- **Důležité:** Vyžaduje env var `SUPABASE_SERVICE_ROLE_KEY` (service role klíč Supabase) — používá se pro `auth.admin.createUser`.

### 2.2 `POST /portal/api/delete-client`

- **Soubor:** `src/app/api/delete-client/route.ts`
- **Co dělá:** Třístupňová destruktivní operace — 1) smaže všechny `reports` daného `client_id`, 2) smaže řádek z `profiles`, 3) smaže auth usera.
- **Auth gate:** Admin (server-side check).
- **Bezpečnost:** Nelze smazat řádek s `role='admin'` (404/400).
- **Vstup:** `{ clientId }`.
- **Výstup:** `{ ok: true }` nebo `{ error }` (různé fáze, podrobné chybové hlášky).
- **Použití:** Admin tabulka klientů, tlačítko „Smazat" (s confirm dialogem).
- **Env:** `SUPABASE_SERVICE_ROLE_KEY`.

### 2.3 `POST /portal/api/notify`

- **Soubor:** `src/app/api/notify/route.ts`
- **Co dělá:** Uloží řádek do tabulky `notifications` (typ, recipient_id, title, body, email, read=false). Pokud tabulka neexistuje, jen zaloguje a vrátí success — viz Část 5 (rozpracované).
- **Auth gate:** Žádný — endpoint nemá explicit auth check. (Service-role klient by měl mít omezené použití přes RLS, ale tabulka `notifications` aktuálně nemá enforced ACL.)
- **Vstup:** `{ type: 'new_report' | 'new_message' | 'report_updated', recipientId, title, body }`.
- **Výstup:** `{ success: true }` nebo `{ error }`.
- **Použití:** Volá se ze `/zpravy` po odeslání zprávy. Předpoklad je, že Supabase Database Webhook nebo Edge Function pak z `notifications` pošle e-mail — to ale není v repu implementované (viz rozpracované).
- **Env:** `SUPABASE_SERVICE_ROLE_KEY`.

### 2.4 `POST /portal/api/onboarding-create-report`

- **Soubor:** `src/app/api/onboarding-create-report/route.ts`
- **Co dělá:** Z onboarding dat (vyplněný wizard) namapuje strukturu CFO reportu a uloží do `reports` (type=`cfo`). Vytvoří default tiery, fixed_costs, business_profile, dva default steps (do 7 a 14 dní), prázdný ledger.
- **Auth gate:** Admin.
- **Vstup:** `{ clientId, onboarding: OnboardingData }` (data z wizardu).
- **Výstup:** `{ ok: true }` nebo `{ error }`.
- **Použití:** OnboardingWizard po `create-client`, pokud klient bere službu „CFO na volné noze".
- **Env:** `SUPABASE_SERVICE_ROLE_KEY`.

Žádné jiné endpointy nejsou — vše ostatní (CRUD reports, CRUD messages, CRUD profiles, upload souborů) jde z client komponent přímo přes `supabase-js`. RLS na Supabase straně musí to oprávnit.

---

## Část 3: Datový model

### 3.1 `profiles`

| Sloupec | Typ | Poznámka |
|---|---|---|
| `id` | uuid (FK auth.users) | primary key |
| `email` | text | |
| `name` | text | jméno/název firmy |
| `role` | text | hodnoty: `admin`, `client` |
| `service` | text \| null | čárkou oddělený seznam služeb („CFO na volné noze, Mentoring"); řídí navigaci |
| `active` | boolean | klient může být dočasně deaktivován |

- Profile row se zakládá automaticky Supabase triggerem na `auth.users` (viz komentář v `create-client/route.ts`: „trigger already creates it").
- Service hodnoty (definované v `src/lib/services.ts` v `SERVICE_ROUTES`):
  - „CFO na volné noze"
  - „Finanční diagnóza"
  - „Prodej za maximum"
  - „Příprava na investora"
  - „Mentoring"
  - „Rozjeď to správně"
  - „Firemní audit"
  - „Startup kit"

### 3.2 `reports`

| Sloupec | Typ | Poznámka |
|---|---|---|
| `id` | uuid | PK |
| `client_id` | uuid (FK profiles.id) | klient, ke kterému report patří |
| `type` | text | `diagnoza` \| `cfo` \| `valuace` \| `investor` \| `mentoring` |
| `title` | text | název reportu |
| `data` | jsonb | hlavní obsah (struktura závisí na `type`) |
| `created_at` | timestamptz | default `now()` |

- Selektor v každé page komponentě: `from('reports').eq('client_id', uid).eq('type', X).order('created_at', desc).limit(1).single()`. Tj. portál pracuje s **posledním** reportem každého typu.
- Struktura `data`:
  - **diagnoza:** `title`, `subtitle`, `status`, `metrics[]`, `strengths[]`, `weaknesses[]`, `cashflow_months[]`, `steps[]`, volitelně `blocks[]`.
  - **cfo:** velký objekt — `title`, `subtitle`, `status`, `tiers[]`, `extras[]`, `fixed_costs[]`, `variable_cost_pct`, `budget`, `ramp_months`, `projection_months`, `business_start_month`, `business_profile`, `vat`, `taxes`, `receivables`, `ledger`, `risks[]`, `steps[]`, `questions[]`, `summary`, volitelně `blocks[]`. Typy v `src/lib/types.ts` (`CfoReportData`) a v `src/components/cfo/calcEngine.ts` (`Tier`, `Extra`, `Budget`, `Ledger`, `VatData`, `TaxData`, `ReceivablesData`, `BusinessProfile`…).
  - **valuace:** `result`, `methods[]`, `revenue_years[]`, `steps[]`, volitelně `blocks[]`.
  - **investor:** `title`, `subtitle`, `badge`, `checklist[]`, `metrics[]`, `mrr_projection[]`, `mrr_target`, volitelně `blocks[]`.
  - **mentoring:** `sessions[]: { num, topic, date, notes, tasks, client_notes }`.

### 3.3 `messages`

| Sloupec | Typ | Poznámka |
|---|---|---|
| `id` | uuid | PK |
| `sender_id` | uuid (FK profiles.id) | |
| `receiver_id` | uuid (FK profiles.id) | |
| `content` | text | |
| `read` | boolean | po načtení receiverem se nastaví na true |
| `created_at` | timestamptz | |

- Realtime channel: `INSERT` v `messages`. Filtruje se client-side podle `sender_id === userId || receiver_id === userId`.
- Unread badge v sidebaru/topbaru: `count('messages').eq('receiver_id', uid).eq('read', false)`.

### 3.4 `notifications`

| Sloupec | Typ | Poznámka |
|---|---|---|
| `id` | uuid | PK (předpoklad) |
| `recipient_id` | uuid | |
| `type` | text | `new_message`, `new_report`, `report_updated` |
| `title` | text | |
| `body` | text | |
| `email` | text | snapshot recipient e-mailu |
| `read` | boolean | |
| `created_at` | timestamptz | |

- **Stav:** Endpoint `/api/notify` do tabulky zapisuje, ale komentář v kódu („If notifications table doesn't exist yet, just log") naznačuje, že tabulka **nemusí být na produkci vytvořená**. Žádný UI ji nečte — slouží jako trigger source pro Supabase Database Webhooks → e-maily. Stav podle aktuálních souborů: **rozpracované, nedotažené** (viz Část 5).

### 3.5 Supabase Storage

- **Bucket:** `documents`.
- **Struktura:** `{user_id}/{folder_slug}/{filename}`. Default složky: `ucetni-podklady`, `faktury`, `smlouvy`, `danove-priznani`, `ostatni`. Custom složky se zakládají uploadem `.emptyFolderPlaceholder`.
- **Filename sanitizace:** strip diacritics + nahradit znaky mimo `[a-zA-Z0-9._-]` podtržítkem.
- **Předpokládaná RLS:** každý user vidí jen `documents/{vlastní user_id}/*`. Není přímo v repu, ale logika `list(uid)` ve fronted očekává, že Supabase odfiltruje cizí.

---

## Část 4: Funkce napříč portálem

### 4.1 Onboarding nového klienta

Flow:

1. **Admin** klikne v `/portal/admin` na „+ Přidat klienta" → otevře se `OnboardingWizard` (`src/components/admin/OnboardingWizard.tsx`).
2. **Wizard** ve 4 krocích sebere: kontaktní data + heslo (≥ 6 znaků), business profil (IČO, právní forma, plátce DPH, obor, počet zaměstnanců, obrat), služby + cíle, první čísla (tiery a fixní náklady).
3. **Submit** zavolá `POST /portal/api/create-client` → Supabase Auth + profile update. Heslo se klientovi neposílá e-mailem, admin ho musí předat osobně/manuálně.
4. **Pokud** klient bere „CFO na volné noze", wizard navíc zavolá `POST /portal/api/onboarding-create-report` → vytvoří CFO report s default steps („Doplnit reálná čísla minulého měsíce" do 7 dní, „Doladit dashboard s Josefem" do 14 dní).
5. **První přihlášení klienta:** na `/portal/login` zadá e-mail + heslo. Middleware ho po loginu pošle na `/dashboard`. AppShell načte profile → zobrazí jen routy povolené pro jeho služby.
6. **Pokud klient nemá report** v dané sekci, vidí `EmptyState` s textem podle své služby (5 variant — pro „CFO na volné noze" třeba „Váš finanční model se připravuje").
7. **Pokud admin přijde na klientský dashboard bez `?client=`**, vidí `AdminClientPicker` — grid karet klientů s danou službou. Klik → `?client=<id>` v URL → admin pohled klientova dashboardu (s banner „Prohlížíte dashboard klienta X").

### 4.2 Chat / Zprávy

- **Realtime:** Supabase Realtime channel na `INSERT` v `messages` (`AppShell.tsx` pro badge, `zpravy/page.tsx` pro chat samotný).
- **Badge:** Sidebar (desktop) a topbar hamburger (mobile) ukazuje count nepřečtených (`9+` při > 9).
- **Notifikace:** Při odeslání zprávy se navíc volá `/api/notify`, který uloží do `notifications` (e-maily nejsou napojené — vyžadovalo by Supabase Edge Function nebo Database Webhook → Resend/SMTP).
- **Historie:** Načte se `from('messages').or('sender_id.eq.X,receiver_id.eq.X').order(asc)`. Po načtení mark-as-read pro `receiver_id = X && read = false`.
- **Kdo komu může psát:** Klient → vždy adminovi (UI najde `where role='admin' limit 1`). Admin → posílá zprávy stejnou cestou; viz POZNÁMKA v 1.10 — pokud je odesílatel admin, receiver je opět admin (sám sobě). Tj. v současnosti není v UI cesta, jak admin pošle konkrétnímu klientovi (musel by si pravděpodobně otevřít `?client=…` v chat URL — to ale není implementované).

### 4.3 Role a oprávnění

- **Role:** dvě hodnoty v `profiles.role` — `admin`, `client`.
- **Server-side ochrana:** `src/middleware.ts` → `src/lib/supabase/middleware.ts.updateSession`:
  - Nepřihlášený → redirect `/login` (kromě `/login`, `/reset-password`).
  - Přihlášený na `/login` → `/dashboard`.
  - Cesta `/admin*` vyžaduje `role === 'admin'`, jinak `/dashboard`.
- **Server-side ochrana API:** Každý mutační endpoint (`create-client`, `delete-client`, `onboarding-create-report`) si v handleru znovu načte profile a ověří `role === 'admin'`. `/api/notify` tuto kontrolu **nemá**.
- **Client-side route filter:** `AppShell` načte `getRoutesForService(profile.service)` a pokud `pathname` mezi povolenými není, redirectne na `/dashboard`. Pro admina je filtr vynechán.
- **Sidebar visibility:** `Sidebar.tsx` filtruje `NAV_ITEMS` podle stejné funkce; admin sekce (Klienti, Reporty) se zobrazuje jen pro `role === 'admin'`.
- **Service-based filtering** (`src/lib/services.ts` — `SERVICE_ROUTES`): mapuje název služby na seznam povolených routes. Klient s „Finanční diagnóza" vidí: dashboard, diagnoza, dokumenty, zprávy. Klient s „CFO na volné noze" vidí: dashboard, cfo, dokumenty, zprávy. Multi-service: čárkou oddělené → union routes.

### 4.4 Klientský portál — multitenance

- **Datové oddělení:** Reporty mají sloupec `client_id`, Storage soubory prefix `{user.id}/...`, Messages dvojici `sender_id` + `receiver_id`. Implicitní separace — předpokládá se vrstva RLS na Supabase, kterou repo nedefinuje.
- **Admin pohled „jako klient":** Query parametr `?client=<uuid>`. Page komponenty (CFO, Diagnoza, Valuace, Investor, Mentoring) detekují `clientParam` ze `useSearchParams()`. Pokud admin nemá parametr, vidí `AdminClientPicker` (grid klientů s danou službou, klik → `?client=<id>`).
- **Banner v admin view:** Růžový pruh „Prohlížíte dashboard klienta X" + odkaz zpět na admin (vidět hlavně v CFO).
- **Editace v admin view:** Admin v admin pohledu může editovat data klienta stejně, jako by to dělal sám klient (auto-save jde proti `report.id`, ne `auth.uid`). Toto je explicitní design.

### 4.5 Block library system

Modulární stavebnice reportů — místo pevně daného layoutu reportu typu X se obsah uloží jako pole `Block[]` v `reports.data.blocks`. Renderer (`src/components/blocks/BlockRenderer.tsx`) vykreslí 12-sloupcový grid; každý block má volitelný `span: 1|2|3|4|6|8|12`.

**Aktuálně podporované typy bloků** (viz `src/components/blocks/types.ts`):

- `heading` — H1/H2/H3 s `eyebrow` a `sub`.
- `text` — odstavec (`variant: normal|muted|lead`).
- `kpi` — jedna KPI karta (`label`, `value`, `sub`, `trend`, `intent`).
- `kpi-grid` — mřížka KPI karet (2/3/4 sloupce).
- `progress` — progress bar s `value/max`.
- `risk-list` — seznam rizik (`critical|medium|low`).
- `step-list` — akční kroky (`layout: timeline | cards`).
- `table` — `headers[]` + `rows[][]` + volitelný `footer`.
- `strengths-weaknesses` — dvouspolková SWOT.
- `cashflow-chart` — pruhový graf cashflow (`months[]`, `revenue[]`, `costs[]`).
- `callout` — info/warning/critical box.
- `yoy-comparison` — YoY tabulka (více let).
- `data-completeness` — vizuální matrice „co je nahráno" (complete/partial/missing).

Renderer používá TypeScript exhaustive check (`_exhaustive: never`) — přidat blok = TS chyba dokud není zaregistrovaný. Detailní dokumentace v `src/components/blocks/README.md`.

Admin v `/portal/admin/reports` má v editoru reportu třetí režim „Bloky (vlastní layout)" — pole `Block[]` se ukládá do `reports.data.blocks` a page komponenty (`diagnoza`, `cfo`) ho přebírají.

---

## Část 5: Stav — hotové vs. rozpracované

### 5.1 Hotové funkce

- **Autentizace:** login, reset hesla, server-side ochrana všech routes.
- **Role management:** admin × client včetně service-based route filtru a admin pohledu „as client".
- **Onboarding flow:** 4-krokový wizard, automatické vytvoření CFO reportu.
- **CRUD klientů:** přidat, deaktivovat, přiřadit služby, smazat (kompletní cascade).
- **CRUD reportů:** formulářový režim per-typ + bloky + raw JSON; auto-save 800ms debounce s toastem.
- **Dashboard:** smart KPI z `calcEngine`, fallback na legacy stringy, risk list.
- **Finanční diagnóza:** metrics + SWOT + cashflow trend + interaktivní akční plán.
- **CFO 12 tabů:** všechny implementované, včetně import CSV, daňového kalendáře (`getCzechTaxCalendar`), what-if simulace, scenarios, hybrid cashflow projekce, doporučení (`calcRecommendations`).
- **Export:** CFO PDF (html2canvas + jsPDF) a Excel (xlsx, 4–5 listů).
- **Block library:** 13 typů bloků, exhaustive renderer, dokumentace.
- **Storage / Dokumenty:** upload, download, delete, vlastní složky.
- **Chat:** realtime, badge unread, mark-as-read.
- **Mentoring, Investor, Valuace stránky:** všechny interaktivní (toggly, edity, auto-save).

### 5.2 Rozpracované / placeholdery

- **E-mailové notifikace:** Endpoint `/api/notify` uloží do `notifications` (a komentář v kódu naznačuje, že tabulka nemusí být na produkci) a očekává „Supabase Database Webhook / Edge Function" pro skutečné odeslání e-mailu. Žádný kód pro odesílání e-mailů v repu není (žádné `RESEND_API_KEY`, žádný transport). **Stav: stubbed.**
- **Tabulka `notifications`:** Nejsou v repu žádné SQL migrace ani schema definice. Endpoint je defensivní — pokud tabulka chybí, vrátí success. Pravděpodobně se zatím nevytvořila.
- **Admin → klient chat:** UI `zpravy/page.tsx` posílá vždy adminovi (`receiverId = adminId`). Pro admina to znamená, že posílá sám sobě. Není rozcestník „vyber klienta a piš mu". **Stav: potřebuje doplnit UI.**
- **Notifikace push:** Žádný service worker, žádné Web Push. Badge v sidebaru je realtime, ale mimo otevřený tab se nic neděje.
- **Custom view route:** V zadání zmíněna „Custom view (pokud existuje)" — v repu **neexistuje** žádná samostatná route. Custom rendering je řešen přes `data.blocks` v existujících routes (diagnoza, cfo).
- **Topbar duplikace v mobilu:** AppShell renderuje vlastní mobile hamburger topbar, ale komponenta `Topbar` se vykresluje uvnitř každé page (na mobilu jsou viditelné fakticky oba). Není to bug, jen návrh — `Topbar` je decorative, hamburger ne.
- **Empty catch blocky:** `src/lib/supabase/server.ts:19` — `try { cookieStore.set(...) } catch {}` (legitimní, ignoruje failure při Server Component contextu). V `admin/reports/page.tsx` na řádcích 310, 320, 531, 534, 537, 553, 556, 573 — JSON.parse v onChange handlerech swallowne chybu, takže pokud admin napíše neplatný JSON, **input zmrzne** (state se neaktualizuje, žádná chybová hláška). Není to crash, ale špatná UX. **Stav: drobný UX defekt.**
- **Žádné TODO/FIXME** v kódu nejsou (grep prázdný), což znamená spíš, že se značky nepoužívají, ne že je vše hotové.
- **Žádné testy:** repo nemá test runner, žádné `.test.*` ani `__tests__/`. CalcEngine (1 500 řádků čisté matematiky) jako kandidát na unit testy — ale není pokryt.
- **Žádný linter strict mode na buildu:** `npm run lint` (next lint), žádné GitHub Actions / CI v repu.

### 5.3 Env vars

Z auditu kódu:

- `NEXT_PUBLIC_SUPABASE_URL` — používá se client/server/middleware/API.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — client/server/middleware.
- `SUPABASE_SERVICE_ROLE_KEY` — všechny 4 API endpointy.

Pro plnou funkčnost notifikací by ještě bylo potřeba něco jako `RESEND_API_KEY` / SMTP — v kódu **není**.

### 5.4 Známé bugy / opravené

Reference na předchozí audit:

- `CashflowChartBlock` — fixed height crash → **opraveno**.
- `StepListBlock` timeline mobile crash → **opraveno**.
- `TableBlock` chybělo a11y → **opraveno**.
- CFO `calcEngine.ts` crash na neúplných receivables (`invoices_issued` undefined) → **opraveno** (v `cfo/page.tsx` se data parsují přes `Array.isArray` guard).

Další pozorování při tomto auditu:

- **Chat admin → klient routing** (viz 5.2) — UI bug.
- **Admin/reports JSON inputs** — silent fail při neplatném JSONu (řádky 310, 320, 531, 534, 537, 553, 556, 573 v `admin/reports/page.tsx`).
- **`notify` endpoint bez auth gate** — kdokoliv s běžící session může vytvořit `notifications` řádek pro libovolného recipienta. Není to katastrofa (data nejsou citlivá), ale je to malá díra.
- **Mobile topbar duplicate** — drobná UX odchylka, ne bug.
- **Heslo se klientovi neposílá** — wizard vyžaduje, aby admin heslo předal mimo systém. Žádný welcome e-mail s pozvánkou.

---

## Část 6: Závěrečné poznámky

### 6.1 Stack a infra

- **Framework:** Next.js 14.2.35 (App Router), React 18, TypeScript 5.
- **Backend:** Supabase (Auth + Postgres + Realtime + Storage). Klient přes `@supabase/ssr` 0.9 a `@supabase/supabase-js` 2.100.
- **Styling:** Tailwind 3.4 (vlastní paleta `ink`, `rose`, `sand`, `mid`, `green`, `amber` — viz `tailwind.config.ts`).
- **Charts:** Chart.js 4.5 + react-chartjs-2.
- **Export:** xlsx 0.18, jspdf 4.2, html2canvas 1.4.
- **Build/Deploy:** Vercel. `basePath: '/portal'` v `next.config.mjs` znamená, že všechny URL mají prefix `/portal/...`. Host `app.kliments.cz` musí rewriteovat root → `/portal/`.

### 6.2 Repo struktura (klíčové)

```
src/
├─ app/
│  ├─ layout.tsx                Root HTML + metadata Kliments
│  ├─ page.tsx                  redirect /dashboard
│  ├─ login/page.tsx
│  ├─ reset-password/page.tsx
│  ├─ (portal)/
│  │  ├─ layout.tsx             AppShell wrapper
│  │  ├─ dashboard/page.tsx
│  │  ├─ diagnoza/page.tsx
│  │  ├─ cfo/page.tsx           (525 řádků, 12 tabů)
│  │  ├─ valuace/page.tsx
│  │  ├─ investor/page.tsx
│  │  ├─ mentoring/page.tsx
│  │  ├─ dokumenty/page.tsx
│  │  ├─ zpravy/page.tsx
│  │  └─ admin/
│  │     ├─ page.tsx            klienti
│  │     └─ reports/page.tsx    CRUD reportů
│  └─ api/
│     ├─ create-client/route.ts
│     ├─ delete-client/route.ts
│     ├─ notify/route.ts
│     └─ onboarding-create-report/route.ts
├─ components/
│  ├─ AppShell.tsx              sidebar + main, realtime badge
│  ├─ Sidebar.tsx
│  ├─ Topbar.tsx
│  ├─ StatCard.tsx
│  ├─ EmptyState.tsx
│  ├─ SaveToast.tsx
│  ├─ AdminClientPicker.tsx
│  ├─ admin/OnboardingWizard.tsx
│  ├─ cfo/                      DashboardTab, MonthlyPlanTab, PricingTab,
│  │                            CashflowTab, BudgetTab, CostsTab, VatTab,
│  │                            TaxesTab, ReceivablesTab, RisksTab,
│  │                            QuestionsTab, ImportTab, CfoTabs,
│  │                            CashflowChart, DoughnutChart, PnlTable,
│  │                            ActualVsPlanChart, ProgressBar,
│  │                            calcEngine.ts (1 512 řádků pure functions)
│  └─ blocks/                   13 block komponent + BlockRenderer + README
├─ lib/
│  ├─ supabase/                 client, server, middleware
│  ├─ services.ts               service → routes mapping
│  ├─ types.ts                  Profile, Report, Message, CfoReportData
│  ├─ useAdminClient.ts         (custom hook — ne v use všech stránkách)
│  ├─ excelExport.ts            CFO XLSX export
│  └─ pdfExport.ts              CFO PDF export
└─ middleware.ts                Supabase session + admin gate
```

### 6.3 Související dokumenty (mimo kód)

- `docs/README.md` — přehled právních šablon a onboarding workflow.
- `docs/smlouva-portal.md` — hlavní smlouva s klientem.
- `docs/smlouva-priloha-1-specifikace-cfo.md` — Specifikace služby „CFO na volné noze" (Příloha 1).
- `docs/nda.md` — NDA + GDPR doložka (Příloha 2).
- `docs/email-techcars-data-request.md` — checklist podkladů.
- `seed-alphaatelier-cfo.json` (v rootu) — pravděpodobně seed data pro testovacího klienta „Alpha Atelier".

### 6.4 Pro třetí stranu — kde začít

1. **Spustit lokálně:** `npm install && npm run dev` na portu 3000. Vyžaduje `.env.local` s `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
2. **Pochopit data flow:** přečíst `src/lib/types.ts`, pak `src/middleware.ts` + `src/lib/supabase/middleware.ts`, pak jeden libovolný `(portal)/*/page.tsx` (doporučuju `diagnoza/page.tsx` — krátký, ukazuje admin-view pattern, auto-save i blocks fallback).
3. **CFO kalkulace:** `src/components/cfo/calcEngine.ts` — pure functions, čisté i bez UI. Nejlépe začít typy nahoře, pak funkce `calcRevenue` → `calcOpex` → `calcHybridCashflow`.
4. **Block library:** `src/components/blocks/README.md` + `src/components/blocks/types.ts`.

### 6.5 Závěr

Portál je funkční MVP/early product. Hlavní operativní obrazovka (CFO) je překvapivě bohatá — má reálný daňový kalendář, hybrid ledger model (expected vs. actual), Czech VAT logiku, ramp-up křivku, what-if simulace a export do Excel/PDF. Slabší místa jsou v e-mailových notifikacích (stubbed), admin→klient chat routing a JSON-input UX v admin reports. Žádná z těchto věcí není blokující pro produkční provoz, ale jsou to první kandidáti na další iteraci.


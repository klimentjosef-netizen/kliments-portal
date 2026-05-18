# Mail: Žádost o podklady — TechCars Servis s.r.o.

**Pro:** TechCars Servis s.r.o. (`autoservis@techcars.cz`)
**Předmět:** Podklady pro finanční řízení 2024 až 2026 — portál Kliments

---

Dobrý den,

abychom mohli postavit kompletní finanční přehled v klientském portálu (https://app.kliments.cz/portal), potřebuji od Vás následující podklady ve **třech časových rozsazích**:

1. **Rok 2024** — pro meziroční srovnání (YoY), ať vidíme trend
2. **Rok 2025** — pro roční závěrku (RZA) a komplexní bilanci
3. **Rok 2026 leden až duben** — aktuální stav, ať dashboard ukazuje realitu, ne odhady

Většinu má Vaše účetní — stačí jí přeposlat tento seznam.

## Co potřebuji

### 1. Účetní výkazy
- [ ] Výsledovka (P&L) za **2024** kompletně
- [ ] Výsledovka (P&L) za **2025** kompletně
- [ ] Výsledovka (P&L) za **2026 leden až duben** (4 měsíce YTD)
- [ ] Rozvaha k **31.12.2024**
- [ ] Rozvaha k **31.12.2025**
- [ ] Rozvaha k **30.04.2026** (aktuální stav)
- [ ] Příloha k účetní závěrce 2025
- [ ] Daňové přiznání právnické osoby za 2024 + 2025

**Formát:** PDF (originály) + Excel/CSV pokud možno

### 2. Transakční data (z účetního SW — Pohoda / Money / Stormware)
- [ ] Hlavní kniha (general ledger) za **2024**
- [ ] Hlavní kniha za **2025**
- [ ] Hlavní kniha za **2026 leden až duben**
- [ ] Saldokonto pohledávek k 31.12.2025 a 30.04.2026
- [ ] Saldokonto závazků k 31.12.2025 a 30.04.2026
- [ ] Pokladní deník za 2024, 2025, 2026 YTD
- [ ] Mzdové podklady — roční rekapitulace 2024 a 2025

**Formát:** CSV nebo Excel (z Pohody přes „Export"; podobně u jiných SW). Klíčové sloupce: datum, popis, částka, kategorie/účet. Pokud má export jiné názvy hlaviček, vyřeším.

### 3. Bankovní výpisy
- [ ] Všechny bankovní účty firmy
- [ ] Rok **2024** kompletně
- [ ] Rok **2025** kompletně
- [ ] **2026 leden až duben** (kompletní měsíce)

**Formát:** CSV / XML / OFX (export z internet bankingu — všechny banky to umí). Většina bank umožňuje stáhnout celý rok jedním klikem.

### 4. DPH
- [ ] Měsíční přiznání DPH za **2024** (12 ks)
- [ ] Měsíční přiznání DPH za **2025** (12 ks)
- [ ] Měsíční přiznání DPH za **2026 leden až duben** (4 ks)
- [ ] Kontrolní hlášení (stejně za všechna období)
- [ ] Souhrnná hlášení, pokud aplikovatelné

**Formát:** PDF nebo XML

### 5. Smlouvy s finančními dopady (jednorázově, aktuální stav)
- [ ] Leasingové smlouvy zvedáků / diagnostiky (se zůstatky k 30.04.2026)
- [ ] Případné úvěry (zůstatky, splátkové kalendáře)
- [ ] Nájemní smlouva na servis
- [ ] Pojistné smlouvy (provoz + odpovědnost + majetek)
- [ ] Rámcové smlouvy s firemními klienty, pokud existují

**Formát:** PDF

### 6. Operativní data (od Vás, ne od účetní)
Stačí orientačně, ne hodinu přesné. Cílem je kalibrovat dashboard na realitu.

- [ ] **Počet vozů opravených za rok** — 2024, 2025, 2026 YTD (po měsících pokud možno)
- [ ] **Rozdělení po kategoriích:** mechanika / prohlídky / pneu / STK
- [ ] **Hodinová sazba** — letošní a loňská (pokud se měnila)
- [ ] **Celkový počet odpracovaných hodin** mechaniků za rok
- [ ] **Sezónní rozdělení tržeb pneuservisu** (březen + říjen vs zbytek)
- [ ] **Skutečná průměrná marže na náhradních dílech** (procento)
- [ ] **Plánované investice 2026 a 2027** (zvedák, diagnostika, jiné CAPEX)

**Formát:** obyčejný mail nebo tabulka — opravdu stačí orientačně

---

## Kam to nahrát

Pošlete prosím všechno na **josef@kliments.cz** v jednom mailu (případně přes WeTransfer, pokud bude objem velký — třeba 200+ MB). Pojďme rovnou počítat s velkým objemem dat, není to problém.

Po obdržení Vám potvrdím a začnu data nahrávat do portálu. Pracuji s novým CSV importem, takže banky a faktury jdou hromadně přes pár kliků (ne ručně přepisováním). Do týdne po obdržení podkladů budete mít:

- **2024 baseline** — pro porovnání s 2025 a 2026
- **2025 kompletní rok** — RZA, daňové přiznání, DPH, mzdy, vše propojené
- **2026 YTD dashboard** — aktuální stav firmy, cashflow, marže, rizika
- **YoY srovnání** — co se zlepšilo, co se zhoršilo (jakmile dokončím tuto funkci)

## Termín

Optimálně do **31. května 2026**, abychom měli klidný měsíc na zpracování před dalším čtvrtletím (pneuservis sezóna končí, je to nejlepší čas).

## Otázky

Pokud cokoliv chybí, nebo si nejste jistý, co Vaše účetní umí exportovat — zavolejte, vyřešíme to do 5 minut.

S pozdravem
Josef Kliment
+420 ...
josef@kliments.cz
https://app.kliments.cz/portal

---

**Pozn. pro mě (Josef):**
- Bank statements: CSV import přes záložku „Import dat" v CFO sekci. Funguje napříč roky (date pole v CSV určuje měsíc).
- Hlavní kniha: stejně CSV import (možná je potřeba sloučit do jednoho CSV se sloupci `date,description,amount,category`).
- PDF výkazy: do `/dokumenty` → složka „Účetní závěrka".
- Smlouvy: `/dokumenty` → složka „Smlouvy".
- Operativní data: doplnit do `tiers` a `extras` v CFO admin formě, případně do `data.blocks` pro 2026 dashboard.
- YoY srovnání: na TODO (zatím chybí UI; data v ledgeru ale půjdou kdykoli zpětně agregovat po roce).

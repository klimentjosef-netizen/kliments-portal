# Dokumenty / Šablony

Šablony právních a komunikačních dokumentů pro provoz portálu Kliments.

## Soubory

### Smlouvy a NDA
- **[smlouva-portal.md](smlouva-portal.md)** — Smlouva o poskytování služeb finančního řízení a přístupu do klientského portálu. Hlavní smlouva mezi Josefem Klimentem a klientem.
- **[smlouva-priloha-1-specifikace-cfo.md](smlouva-priloha-1-specifikace-cfo.md)** — **Příloha č. 1**: Specifikace rozsahu služby „CFO na volné noze". Detailní popis co služba zahrnuje, co nezahrnuje, KPI, komunikační kanály, podklady, odměna, specifika pro auto-servis.
- **[nda.md](nda.md)** — Smlouva o mlčenlivosti (NDA). **Příloha č. 2** hlavní smlouvy. Definuje, jak Josef smí (a nesmí) nakládat s daty klienta. Zahrnuje GDPR zpracovatelskou doložku.

### Klientská komunikace
- **[email-techcars-data-request.md](email-techcars-data-request.md)** — Strukturovaný checklist podkladů pro TechCars Servis (2024 + 2025 + 2026 YTD). Pošli klientovi po podpisu smluv.

## Workflow při onboardingu nového klienta

1. **Vytvořit klientský účet** v adminu portálu (`/portal/admin`) — to už umí UI.
2. **Vytisknout 2× kompletní balíček smluv:**
   - Smlouva o portálu (`smlouva-portal.md`)
   - Příloha č. 1 — Specifikace CFO služby (`smlouva-priloha-1-specifikace-cfo.md`)
   - Příloha č. 2 — NDA (`nda.md`)
   Doplnit konkrétní údaje (IČO, sídlo, odměna, KPI, datum). Podepsat na obou stranách.
3. **Zaslat klientovi přihlašovací údaje** s odkazem na `/portal/login`.
4. **Poslat mail s žádostí o podklady** (`email-techcars-data-request.md`).
5. **Po obdržení dat:** naimportovat přes záložku "Import dat" v CFO (`/portal/cfo`). PDF výkazy a smlouvy nahrát do sekce `/portal/dokumenty`.

## Důležité upozornění

Šablony **smlouva-portal.md** a **nda.md** jsou **pracovní výchozí podklady**, ne hotové právní dokumenty. **Před prvním použitím s reálným klientem je nezbytné nechat zkontrolovat advokátem** — Josef Kliment není advokát, šablony reflektují běžnou praxi pro B2B poradenství v ČR, ale konkrétní situace klienta může vyžadovat úpravy:

- **Sankce a limity odpovědnosti** mohou kolidovat s konkrétními riziky.
- **GDPR doložka** v NDA může vyžadovat upřesnění podle typu zpracovávaných osobních údajů.
- **Smluvní pokuta** musí být přiměřená — 100 000 Kč funguje obvykle u mid-size B2B, u rozsáhlejších kontraktů může být potřeba více.
- **Rozhodčí doložka** je možnost — šablony zatím odkazují na obecné soudy.

# Kliments. Klientský portál — vizuální průvodce pro copywritera

Tento dokument popisuje, co reálně uvidíte v portálu po přihlášení. Účel: dát copywriterovi konkrétní obraz každé obrazovky, aby mohl psát web kliments.cz bez nutnosti se do portálu dívat. Neřeší se tu, co je pod kapotou — jen co klient vidí, čte a maká.

**Vizuální základ napříč celým portálem:**
- Hlavní barva pozadí: **béžová písková** (sand) — působí jako "studio papír", ne jako sterilní bílá appka.
- Akcentní barva: **růžová terakotová** (rose) na CTA tlačítkách, badgech a aktivních prvcích. Méně cukrová než klasická tech růžová, blíž k zemité růžové z keramiky.
- Tmavé karty: **téměř černá** (ink) — používají se na hlavičky stránek a důležité přehledy. Vždy mají decentní růžový "blob" v rohu a obří kurzivní písmeno "K" jako vodoznak.
- Typografie: **serif (patkové) písmo** pro nadpisy a hlavní čísla (působí jako finanční report), bezpatkový pro UI texty.
- Tvar: **velmi zaoblené rohy** (20-28px) — působí měkce, ne agresivně-tech.
- Celkový dojem: spíš **butikový poradce / advokátní kancelář** než SaaS pro IT lidi. Žádné gradienty se zlatem, žádné neony, žádné stock 3D obrázky.

---

================================================================
OBRAZOVKA: Přihlášení
URL: /portal/login
SOUBOR: src/app/login/page.tsx
URČENO PRO: oba (klient i admin)
================================================================

PRVNÍ DOJEM (3 vteřiny):
Pískové pozadí, uprostřed jediná bílá karta se zakulacenými rohy a velmi jemným stínem. V pozadí dva rozmazané kruhové "blob" gradienty — růžový vpravo nahoře, béžový vlevo dole. Pocit: butikové studio, ne tech aplikace.

HLAVIČKA / TOP SEKCE:
V levém horním rohu karty logo `Kliments` patkovým písmem v tmavé barvě, hned za ním růžová tečka (skoro o třetinu větší než písmo). Pod logem decentní šedý mikrocopy: „Klientský portál · Finanční řízení".

HLAVNÍ OBSAH:
- Label tenkým rozprostřeným capslockem: „E-MAIL", pod ním podtržené pole bez rámečku (placeholder „jan@firma.cz").
- Label „HESLO", podtržené pole s placeholderem „••••••••".
- Vpravo pod heslem mini-link: „Zapomenuté heslo?" (šedý, při hoveru zrůžoví).
- Celokarteční růžové oblé tlačítko (pill button): „PŘIHLÁSIT SE →".
- Při chybě se nad tlačítkem zobrazí červený text: „Nesprávný email nebo heslo".

Reset-mód (po kliknutí na "Zapomenuté heslo?"):
- Subtitul se přepne na „Obnovení hesla".
- Pole jen pro e-mail.
- Tlačítko: „ODESLAT ODKAZ →".
- Po odeslání: obří emoji ✉️, nadpis „E-mail odeslán" a věta „Zkontrolujte svou schránku a klikněte na odkaz pro nastavení nového hesla."

INTERAKCE A AKCE:
Klikací: log-in, "Zapomenuté heslo?", "← Zpět na přihlášení". Pole se podtrhávají růžově při focusu. Hover na tlačítku ztmaví o jeden odstín (rose → rose-deep).

PRÁZDNÝ STAV:
Není relevantní — formulář je vždy stejný.

MOBIL:
Karta vyplní téměř celou šířku, rozložení zůstává vertikální. Žádné rozdělení na sloupce.

CO JE NA TOM SILNÉHO:
Krásný, čistý, neagresivní formulář. Působí jako přihlášení do privátní klubové aplikace, ne do SaaS. **Vhodný screenshot pro web** — funguje jako "ukázka, jak vypadá první kontakt s portálem".

---

================================================================
OBRAZOVKA: Nastavení nového hesla
URL: /portal/reset-password
SOUBOR: src/app/reset-password/page.tsx
URČENO PRO: oba
================================================================

PRVNÍ DOJEM:
Vizuálně identické s loginem (stejné pozadí, stejná karta, stejné logo). Klient přijde z e-mailového odkazu, takže pochází z mailu.

HLAVNÍ OBSAH:
Subtitul „Nastavení nového hesla". Dvě podtržená pole: „NOVÉ HESLO" a „POTVRDIT HESLO" (obě min. 6 znaků). Tlačítko: „NASTAVIT HESLO →".

Validační hlášky inline: „Heslo musí mít alespoň 6 znaků" / „Hesla se neshodují" / „Nepodařilo se změnit heslo. Zkuste to znovu."

Po úspěchu: zelená fajfka, nadpis „Heslo změněno", podtitul „Přesměrováváme vás do portálu..." (auto-redirect po 2 sekundách).

CO JE NA TOM SILNÉHO:
Konzistentní s loginem, ne nudný. Nic víc.

---

================================================================
OBRAZOVKA: Dashboard (hlavní rozcestník)
URL: /portal/dashboard
SOUBOR: src/app/(portal)/dashboard/page.tsx
URČENO PRO: klient (admin vidí svůj vlastní)
================================================================

PRVNÍ DOJEM:
Po levém boku tmavá svislá navigace, zbytek je béžový. Nahoře dominuje **tmavá uvítací karta** přes celou šířku s patkovým nadpisem „Dobrý den, [Jméno]" a růžovým tlačítkem „NAPSAT JOSEFOVI →" napravo. Pod ní řada bílých KPI karet. Působí teple a osobně, ne korporátně.

HLAVIČKA / TOP SEKCE:
Hned pod horním topbarem (logo + menu) je velká **tmavá karta s patkovým „Dobrý den, [Jméno]"** v krémové barvě. Pod jménem malý šedý text „Aktivní služba: [název služby z profilu]". V pravém rohu světle růžový kruhový blob a růžové oblé tlačítko „NAPSAT JOSEFOVI →".

HLAVNÍ OBSAH (zleva doprava, shora dolů):
**Čtyři KPI karty** v mřížce 2×2 (mobil) / 4×1 (desktop), bílé pozadí, jemný rámeček:
1. „Měsíční tržby" — velké patkové číslo (např. „565K"), pod ním „z 35 členů" (vypočteno z tarifů), trendová věta „+8K doplňkové" se zelenou šipkou nahoru.
2. „EBITDA" — patkové číslo, podtitul „24 % marže", trend „Ziskový" (zeleně) nebo „Ztrátový" (růžově).
3. „Break-even" — kolik členů je potřeba, podtitul „členů potřeba (ø 3 200 Kč)", trend „Dosaženo (35/30)".
4. „Návratnost CAPEX" — počet měsíců, podtitul „z 1,2M Kč investice", trend „Do 2 let".

Pokud klient nemá ještě report → místo karet velký **prázdný stav s emoji a CTA „Napsat Josefovi →"** (viz EmptyState).

Pod KPI kartami sekce **„Aktuální rizika"** — pokud admin přidal rizika, vidí klient barevné karty:
- Červené pozadí pro „KRITICKÉ" (růžový badge vlevo, tučný titulek, popis šedě).
- Žluté pozadí pro „STŘEDNÍ".
- Zelené pozadí pro „NÍZKÉ".
- Konkrétní příklad z dat: „KRITICKÉ — Pomalý náběr členů — Méně než 20 členů v M6 ohrozí cash runway. Mitigace: pre-launch validace, Partner VIP..."

INTERAKCE A AKCE:
- CTA „NAPSAT JOSEFOVI →" — vede do chatu.
- KPI karty nejsou klikatelné, jen informativní (jsou to read-only zrcadlo CFO dat).
- Trendová věta má šipku ↑ (zelená) nebo ↓ (růžová) podle směru.

DATA Z DEMO ÚČTU (Alpha Atelier — fitness klub):
- Tržby: ~135 760 Kč/měs (z 35 členů: 20× Standard á 2 490, 10× Premium á 3 900, 3× VIP á 6 990, 2× Partner VIP á 10 000) + doplňky (blokové pronájmy 4 000 Kč, jednorázové vstupy 4 160 Kč).
- EBITDA: cca +85 000 Kč/měs po odečtení 48 000 Kč fixních + variabilních.
- Break-even: cca 13 členů (při průměrné ceně ~3 880 Kč).
- CAPEX: 1 200 000 Kč investice, návratnost cca 14 měsíců.

DATA Z DEMO ÚČTU (TechCars Servis — auto-servis):
Dashboard se neukáže — TechCars má v reportu **vlastní blokový layout**, který se zobrazí v CFO sekci, ne v hlavním Dashboardu. (Hlavní Dashboard čte jen základní KPI, custom bloky jsou jen v `/cfo`.)

PRÁZDNÝ STAV:
Pokud klient nemá CFO report: EmptyState komponenta s emoji odpovídajícím službě, titulek „Váš finanční model se připravuje" + popis a růžové CTA „NAPSAT JOSEFOVI →".

MOBIL:
KPI karty se přerovnají na mřížku 2 sloupce. Uvítací karta se skládá vertikálně — tlačítko se posune pod jméno.

CO JE NA TOM SILNÉHO:
**Velmi vhodný pro hlavní screenshot na webu.** Tmavá uvítací karta s „Dobrý den, [Jméno]" a osobním pozváním ke konverzaci je nejteplejší prvek celého portálu. Vypadá to jako privátní bankovní výpis, ne jako tabulkový dashboard.

---

================================================================
OBRAZOVKA: Finanční diagnóza
URL: /portal/diagnoza
SOUBOR: src/app/(portal)/diagnoza/page.tsx
URČENO PRO: klient (jedna z konkrétních služeb)
================================================================

PRVNÍ DOJEM:
Tmavá hlavička s patkovým nadpisem reportu („Finanční diagnóza" nebo custom titulek) a růžovým status badgem („Hotovo ✓"). Pod ní 4 metriky v patkové sazbě, pak SWOT (zelená/růžová), pak akční plán v kartách. Vypadá to jako reálná konzultantská zpráva, ne dashboard.

HLAVIČKA / TOP SEKCE:
Tmavá karta přes celou šířku, vpravo dole gigantické patkové **„K"** (vodoznak v opacitě 4 %). Vlevo dva řádky: patkový nadpis (custom titulek z dat) a tenký šedý podtitul. V pravém rohu pill badge: „HOTOVO ✓" (růžový).

HLAVNÍ OBSAH:
**Mřížka 4 metrik** (mobil 2, desktop 4):
- Tenký uppercase label nahoře (např. „CELKOVÝ OBRAT").
- Patkové růžové číslo (např. „1,2 M Kč" nebo „18 %"). Pokud má metrika příznak „critical", číslo je v sytě tmavší růžové („rose-deep") a sub-text je tučnější.
- Sub-text dole („vs. minulý rok").

**Cashflow graf:** „Cashflow: posledních 6 měsíců" — jednoduché růžové sloupce, nad nimi částky, pod nimi názvy měsíců. Záporné měsíce mají sloupce v bledší růžové.

**SWOT** ve dvou sloupcích:
- Zelená karta vlevo: „✓ SILNÉ STRÁNKY" + bullet seznam.
- Růžová karta vpravo: „✗ SLABÉ STRÁNKY" + bullet seznam.

**Akční plán:** Řada karet 3×n, každá karta obsahuje:
- Velké patkové bledě růžové číslo (např. „01", „02").
- Tenký růžový uppercase deadline (např. „DO 5. DUBNA").
- Tučný název kroku.
- Šedý popis 1-2 věty.
- Pole na poznámku klienta („Vaše poznámka...").
- Pravý horní badge: „Označit" / „Hotovo" (klikatelný — po kliku se karta zešedne a text přeškrtne).

INTERAKCE A AKCE:
- Klient si může **odškrtávat kroky** jako hotové (badge se přepne na zelený „Hotovo").
- Klient může **psát poznámky** přímo do karty kroku (auto-save přes SaveToast).
- Editace probíhá real-time, žádné "uložit" tlačítko.

DATA Z DEMO ÚČTU:
**Seed pro diagnózu jako samostatný report neexistuje** v repu. Diagnóza se obvykle naplní ručně adminem v `/admin/reports`. Pokud chybí, klient vidí EmptyState s emoji 🔍 a textem „Diagnóza se připravuje. Josef analyzuje vaše finanční data."

PRÁZDNÝ STAV:
EmptyState (popsáno níže) s ikonou 🔍 a CTA „Napsat Josefovi →".

MOBIL:
SWOT se přerovná pod sebe. Akční kroky 1 sloupec.

CO JE NA TOM SILNÉHO:
**Velmi působivé pro screenshot** — vypadá to jako profesionální PDF report, ale je živé a klient v něm reaguje. Velká patková čísla u metrik a krásně řazené barevné SWOT karty. Akční plán s odškrtáváním a poznámkami je „aha-moment".

---

================================================================
OBRAZOVKA: CFO panel — hlavní layout + tab navigace
URL: /portal/cfo
SOUBOR: src/app/(portal)/cfo/page.tsx
URČENO PRO: klient (kdo má CFO službu) + admin (přes ?client=)
================================================================

PRVNÍ DOJEM:
Bohatá obrazovka — nahoře tmavá karta s názvem reportu a třemi tlačítky vpravo („EXPORT EXCEL", „EXPORT PDF" a zelený badge „AKTIVNÍ ●"). Pod ní bílá lišta s nastavením profilu firmy (právní forma, plátce DPH, datum založení). Pod ní pruhové tab-menu se 12 záložkami. Pod tabem se nachází obsah dané sekce. Pro klienta TechCars (s custom bloky) se nahoře nad tím vším objevuje **dlouhá vlastní stránka s heading, KPI gridem, callouty, tabulkami atd.**

HLAVIČKA / TOP SEKCE:
- **Admin banner** (jen pokud admin prohlíží přes `?client=jmeno`): růžová pruhová karta „Prohlížíte dashboard klienta **[jméno]**", vpravo link „← Zpět na klienty".
- **Year selector** (jen pokud má klient data z více let): pill tlačítka „Vše", „2024", „2025"... s počtem transakcí.
- **Custom blocks** (jen pro klienty s admin-definovaným layoutem, např. TechCars): obří patkové heading, KPI grid, callouty, tabulky.
- **Hlavní header karta:** tmavá s patkovým nadpisem reportu vlevo (např. „CFO na volné noze") + subtitulem, vpravo trojice tlačítek: světlá pill „EXPORT EXCEL", tmavší pill „EXPORT PDF", barevný status badge („AKTIVNÍ ●" zelený / „POZASTAVENO ●" žlutý / „UKONČENO" šedý).

**Business profile bar** (bílá lišta pod hlavičkou):
- „FORMA" — dropdown: s.r.o. / OSVČ / a.s.
- „PLÁTCE DPH" — pill toggle: Ano (zelený) / Ne.
- Pokud „Ne": přidá se pole „PŘECHOD NA DPH" s month-pickerem.
- „ZALOŽENÍ" — month-picker.

**CfoTabs:** Tmavě béžová pill-lišta s 12 záložkami v jedné řadě (na mobilu se posouvají):
Přehled · Měsíční plán · Cenotvorba · Cashflow · Pohledávky a závazky · DPH · Daně & Odvody · Náklady · Rozpočet · Rizika & Plán · Dotazy · Import dat.
Aktivní tab je v bílém okrouhlém boxíku se stínem, neaktivní jsou jen šedý text. (Pokud klient není plátce DPH, tab DPH se skryje.)

HLAVNÍ OBSAH:
Závisí na aktivním tabu — viz sekce B níže (taby 11-22).

INTERAKCE A AKCE:
- Přepínání tabů — URL se ukládá v query parametru (`?tab=cashflow`), takže klient si může uložit záložku.
- Export Excel: stáhne `.xlsx` se všemi listy (ledger, faktury, tarify, náklady).
- Export PDF: vygeneruje statický PDF z aktuálního tabu.

DATA Z DEMO ÚČTU (Alpha Atelier):
- Název: „CFO na volné noze", subtitle: „Alpha Atelier. Private Fitness Club".
- Status: aktivní (zelený badge).
- 4 tarify, 2 doplňkové příjmy, 5 fixních nákladů (28K nájem + 8K energie + 5K administrativa + 2K pojištění + 5K marketing = **48K Kč/měs fixních**).
- Budget: 1 400 000 Kč celkem (1,2M CAPEX + 200K rezerva).

DATA Z DEMO ÚČTU (TechCars Servis):
- Měsíční tržba: 564 000 Kč.
- EBITDA marže: 7,3 % (41 000 Kč čistý zisk).
- Likvidní rezerva: 0,7 měs. (kritické pod 1 měsíc).
- Vytížení mechaniků: 72 %.
- Skladba tržeb po kategoriích: Mechanické opravy 285K, Servisní prohlídky 114K, Náhradní díly 68K, Pneuservis 49K, STK 34K, Diagnostika 13K.

PRÁZDNÝ STAV:
EmptyState bez specifikace (obecný „Zatím žádná data" — pokud klient nemá žádný CFO report).

MOBIL:
Taby se horizontálně skrolují. Export tlačítka v hlavičce se zalamují pod sebe. Business profile bar přejde na vertikální.

CO JE NA TOM SILNÉHO:
**Toto je hlavní pracovní obrazovka portálu a "trumf" demo prezentace.** 12 tabů krytých jednou navigací, hluboká funkčnost, ale vizuálně neutopená v datech. Year selector je elegantní detail. Custom blokový layout pro TechCars vypadá jako personalizovaný report přímo od konzultanta.

---

================================================================
OBRAZOVKA: Valuace (Prodej za maximum)
URL: /portal/valuace
SOUBOR: src/app/(portal)/valuace/page.tsx
URČENO PRO: klient
================================================================

PRVNÍ DOJEM:
Nahoře tmavý baner s **třemi velkými metrikami v 3 sloupcích** (zaměřeno na "kolik tahle firma stojí"). Pod ním tři karty oceňovacích metod s mini progress-barem pro váhu. Pod nimi cashflow graf vlevo a interaktivní akční plán vpravo. Velmi působivé pro někoho, kdo přemýšlí o prodeji firmy.

HLAVIČKA / TOP SEKCE:
Tmavá karta přes celou šířku, vpravo dole je obří vodoznak — **hlavní hodnota firmy** (např. „1,2 M Kč" jako 120pt patkový text v opacitě 4 %). Vlevo 3 sloupce s metrikami:
- „CÍLOVÁ HODNOTA" — bledě růžová patková (např. „1,2 M Kč"), pod tím malý šedý text.
- „SROVNATELNÝ MULTIPLIKÁTOR".
- „DOPORUČENÝ TIMING PRODEJE".

HLAVNÍ OBSAH:
**3 karty oceňovacích metod** v 3 sloupcích:
- Tučný název metody (např. „DCF" / „Násobky EBITDA" / „Likvidační hodnota").
- Patková růžová hodnota.
- Šedý text „Váha XX %".
- Růžový progress-bar pod tím (vyplněný podle váhy).

**Graf vývoje tržeb** vlevo („Vývoj tržeb") — vertikální růžové sloupce s částkami nahoře a labely roků dole.

**Akční plán před prodejem** vpravo — seznam kroků v kartách:
- Velké patkové číslo („01", „02"...).
- Růžový tenký deadline.
- Tučný název („Vyčistit účetnictví").
- Šedý popis.
- Pole na klientskou poznámku.
- Vpravo nahoře badge „Hotovo" / „✓" — klikatelný.

INTERAKCE A AKCE:
- Klient odškrtává kroky.
- Klient píše poznámky (auto-save).

DATA Z DEMO ÚČTU:
**Seed pro valuaci v repu neexistuje.** Pokud klient nemá report, vidí EmptyState s emoji ⭐ a textem „Valuace se připravuje. Josef vypočítává hodnotu vašeho podnikání pomocí tří oceňovacích metod."

PRÁZDNÝ STAV:
EmptyState ⭐.

MOBIL:
3 sloupce v hlavičce se přerovnají pod sebe. Karty metod a akční plán: 1 sloupec.

CO JE NA TOM SILNÉHO:
**Vizuálně nejdramatičtější obrazovka portálu.** Velký vodoznak s hodnotou firmy v rohu tmavé karty působí jako exkluzivní privátní výpis. Vhodný screenshot pro stránku služby „Prodej firmy za maximum".

---

================================================================
OBRAZOVKA: Příprava na investora
URL: /portal/investor
SOUBOR: src/app/(portal)/investor/page.tsx
URČENO PRO: klient (startup / scaleup)
================================================================

PRVNÍ DOJEM:
**Zcela jiný vizuál** než ostatní stránky — hlavička není tmavá, ale **růžovo-béžový gradient** (linear-gradient z růžové do béžové), patkový bílý nadpis a bílý badge „Seed Round". Vlevo dole velký bílý kruh. Působí to jako pitch deck cover.

HLAVIČKA / TOP SEKCE:
Gradientový baner: patkový bílý nadpis (custom titulek) + bílý transparentní subtitul. Vpravo pill badge „SEED ROUND" / „SÉRIE A" (z dat).

HLAVNÍ OBSAH:
**Karta „Připravenost"** — patkový nadpis + procento („XX %"), pod tím tenký progress-bar (růžový, zelený při 100 %), pod ním text „X z Y splněno".

**Checklist připravenosti** vlevo:
- Vertikální seznam položek na béžovém pozadí.
- Před každou položkou kruh: zelená fajfka (hotovo) nebo růžový křížek (chybí).
- Text položky je tučně růžový, pokud nehotovo. Pokud hotovo, ztmavne.
- Klient kliká na řádek a stav se přepne.

**Klíčové metriky** vpravo (mřížka 2×2):
- Béžové dlaždice.
- Šedý uppercase label.
- Patková růžová hodnota — **editovatelná** (klient v ní píše přímo).
- Pod tím trend („+12 % MoM") — zelený nebo červený.

**MRR projekce: 12 měsíců** — řada růžových sloupců (poslední je výrazně tmavší — cíl). Nad grafem subtitul „Cíl: 50K Kč" (z dat).

INTERAKCE A AKCE:
- Klient odškrtává checklist (toggle stavu).
- Klient edituje hodnoty metrik (inline).
- Vše se auto-ukládá.

DATA Z DEMO ÚČTU:
**Seed pro Investor neexistuje.** Klient vidí EmptyState s emoji 📋 a textem „Investor readiness se připravuje. Josef připravuje checklist připravenosti a MRR projekce pro investory."

PRÁZDNÝ STAV:
EmptyState 📋.

MOBIL:
Checklist a metriky se přerovnávají pod sebe.

CO JE NA TOM SILNÉHO:
Růžovo-béžový gradient odlišuje tuto obrazovku od zbytku portálu — vypadá to jako "startup tracker", ne korporátní CFO panel. Ale **nedoporučuji jako hlavní screenshot na webu** kvůli prázdnému seedu.

---

================================================================
OBRAZOVKA: Mentoring
URL: /portal/mentoring
SOUBOR: src/app/(portal)/mentoring/page.tsx
URČENO PRO: klient (mentoring program)
================================================================

PRVNÍ DOJEM:
Vertikální seznam **karet jednotlivých mentorských sezení** pod sebou. Každá karta obsahuje velké patkové číslo sezení, název tématu, datum, poznámky Josefa a interaktivní úkoly. Působí to jako deník konzultací.

HLAVIČKA / TOP SEKCE:
Žádná velká hlavička — rovnou seznam sezení.

HLAVNÍ OBSAH:
Pro každé sezení **bílá karta**:
- Vlevo nahoře velké patkové bledě růžové číslo („01", „02"...).
- Vedle: tučný nadpis tématu („Strategický plán Q2 2026") + šedé datum.
- Pod tím **šedá béžová oblast** s poznámkami z konzultace (čitelný odstavec, ne bulletpointy).
- **Seznam úkolů** s checkboxy: prázdný čtvereček vs. zelený čtvereček, text s line-through po odškrtnutí.
- Pole „Vaše poznámky k sezení..." — textarea, kde klient může psát.

INTERAKCE A AKCE:
- Odškrtávání úkolů.
- Psaní vlastních poznámek.

DATA Z DEMO ÚČTU:
**Seed neexistuje.** Klient vidí EmptyState s emoji 👤 a textem „Váš mentoring začíná. Po prvním sezení tu najdete záznamy, poznámky a úkoly z mentoringu."

PRÁZDNÝ STAV:
EmptyState 👤.

MOBIL:
Karty pod sebou (už jsou).

CO JE NA TOM SILNÉHO:
Vypadá to jako reálný osobní záznamník z mentoringu, ne sterilní task tracker. **Ale pro screenshot na webu spíš slabší** — bez reálných dat působí nedoplněně.

---

================================================================
OBRAZOVKA: Dokumenty
URL: /portal/dokumenty
SOUBOR: src/app/(portal)/dokumenty/page.tsx
URČENO PRO: klient (admin také)
================================================================

PRVNÍ DOJEM:
Klasický **file manager s levým sidebarem se složkami a pravým hlavním panelem se soubory**. Tmavá hlavička nahoře s ikonou 📁 jako vodoznakem. Působí to organizovaně, ale není to "wow".

HLAVIČKA / TOP SEKCE:
Tmavá karta: patkový „Dokumenty", podtitul „X souborů v Y složkách" (např. „12 souborů v 5 složkách"). Vpravo dole obří 📁 jako vodoznak v opacitě 4 %.

HLAVNÍ OBSAH (dvousloupcový layout):
**Vlevo: panel složek** (bílá karta 250px):
- Uppercase mini-nadpis „SLOŽKY" a vpravo link „+ Nová".
- Seznam složek: 📁 Účetní podklady / Faktury / Smlouvy / Daňové přiznání / Ostatní (případně custom).
- Aktivní složka je v jemně růžovém pozadí, růžový text.
- Vpravo u každé počet souborů.

**Vpravo: panel souborů**:
- Patkový nadpis aktivní složky.
- Vpravo růžové pill tlačítko „+ NAHRÁT SOUBOR".
- Seznam souborů:
  - Vlevo malá růžová ikona dle typu (📄 PDF / 📊 Excel/CSV / 📝 Word / 🖼️ obrázek / 📎 jiné).
  - Tučný název souboru.
  - Pod ním malý šedý text: velikost + datum nahrání (např. „1,2 MB · 15.04.2026 10:30").
  - Vpravo dva malé linky: „Stáhnout" (růžový) a „Smazat" (šedý).

PRÁZDNÝ STAV složky:
Centered: 📂 emoji, „Složka je prázdná", „Nahrajte první soubor tlačítkem výše".

INTERAKCE A AKCE:
- Drag-and-drop není (jen file picker).
- Vytvoření custom složky: napsat název → „Vytvořit".
- Mazání: confirm „Smazat tento soubor?".

DATA Z DEMO ÚČTU:
Závisí na konkrétním klientovi — soubory jsou samostatně per klient. Seed pro dokumenty není.

MOBIL:
Sidebar a panel se zarovnávají pod sebe.

CO JE NA TOM SILNÉHO:
Funkční, čistý, ale **z designového pohledu nejméně vzrušující obrazovka.** Pro web spíš slovy popsat než screenshotovat.

---

================================================================
OBRAZOVKA: Zprávy / Chat
URL: /portal/zpravy
SOUBOR: src/app/(portal)/zpravy/page.tsx
URČENO PRO: klient ↔ admin (Josef)
================================================================

PRVNÍ DOJEM:
Klasický **chat interface s rohovou avatarkou Josefa nahoře**. Pravé bubliny růžové (klient), levé béžové (Josef). Velmi přátelské, jako WhatsApp s privátním poradcem.

HLAVIČKA / TOP SEKCE:
Bílá karta přes celou šířku:
- Vlevo kruhová avatara „JK" v růžové barvě s bílým textem.
- Hned vedle dva řádky: tučný „Josef Kliment" + šedý „Váš finanční poradce".

HLAVNÍ OBSAH:
Velký bílý chat-kontejner s scrollem:
- Bubliny zprávy s asymetrickými rounded rohy.
- Klientské zprávy vpravo, růžové pozadí, bílý text. Pravý horní roh ostřejší, ostatní zaoblené.
- Josefovy zprávy vlevo, béžové pozadí, tmavý text. Levý horní roh ostřejší.
- Pod každou zprávou drobný šedý čas (např. „14:32").

**Prázdný stav:** „Zatím žádné zprávy. Napište první." (uprostřed, šedě).

**Input dole:**
- Béžové pole na celou šířku „Napište zprávu...".
- Vpravo růžové kulaté tlačítko se šipkou „→" (kruh, 36×36px).
- Enter = odeslat.

INTERAKCE A AKCE:
- Realtime — když Josef odpovídá, zpráva se objeví okamžitě.
- Po odeslání → fetch na `/portal/api/notify` (push notifikace recipientovi).
- Po načtení stránky se všechny nepřečtené zprávy označí jako přečtené.

DATA Z DEMO ÚČTU:
Per klient, žádný seed.

MOBIL:
Chat zabírá celou výšku obrazovky, input lepí na spodek.

CO JE NA TOM SILNÉHO:
**Velmi dobrý prvek pro web** — "máte přímý chat se svým CFO". Vypadá to osobně, ne ticket-systémově. Asymetrické rounded rohy jsou pěkný detail.

---

================================================================
CFO TABY (sekce v rámci /portal/cfo)
================================================================

Všech 12 tabů se nachází uvnitř hlavní CFO obrazovky. Klient se mezi nimi přepíná pill-lištou (CfoTabs).

---

OBRAZOVKA: Tab „Přehled" (DashboardTab)
SOUBOR: src/components/cfo/DashboardTab.tsx
URČENO PRO: klient
================================================================

PRVNÍ DOJEM:
Nahoře vpravo malý **toggle** „Jednoduché / Detailní" (pro klienty, kteří chtějí jen 3 KPI vs. plný report). Pod ním **velká tmavá karta s dnešním datem a 4 klíčovými metrikami**. Pod ní seznam doporučení (color-coded), pak časová osa nadcházejících termínů, pak **„Co kdyby" kalkulačka**.

HLAVIČKA / TOP SEKCE:
- Toggle „Jednoduché" / „Detailní" — tmavé pill přepínače.
- Tmavá karta s datem ve dnešní formě „19. května 2026" (uppercase, mini písmo) a mřížkou 4 metrik:
  - „NA ÚČTU" (nebo „STAV ÚČTU" v Detailní) — patkové bledě béžové číslo.
  - „TENTO MĚSÍC" / „CF TENTO MĚSÍC" — patkové, zelené (+) nebo růžové (−).
  - „CO ZBUDE" / „EBITDA/MĚSÍC".
  - „DALŠÍ PLATBA" — částka + věta „dnes!" / „zítra" / „za 5 dní".

HLAVNÍ OBSAH:
**Doporučení** — color-coded karty:
- Červené (urgent): „DŮLEŽITÉ" badge.
- Žluté (important): „DOPORUČENÍ" badge.
- Zelené (tip): „TIP" badge.
- Každá karta má vlevo barevný badge, vprostřed nadpis + detail, vpravo dopad (např. „+50K Kč"). Klikem se klient přesune do relevantního tabu.

**Blížící se termíny** — seznam s datumy, popisem a částkou:
- Datum (vlevo): „19.5." + „dnes" / „za 3d".
- Popis (uprostřed).
- Částka (vpravo, zelená pro +, růžová pro −).
- Pokud termín → badge „TERMÍN" (žlutý).

**„Můžu si dovolit...?" kalkulačka** — bílé pole, klient zadá částku v Kč:
- Po zadání se objeví 4 dlaždice: „Na účtu potom" / „Měsíční zisk" / „Runway" / „Výsledek" (Můžete / Riziko).

**KPI karty (jen Detailní)** — Break-even / Měsíční příjem / Měsíční náklady / Projekce 3 měs.

**Graf Plán vs Realizace** — bar chart s posledními 6 měsíci, dva pruhy vedle sebe (očekávané vs. skutečné).

**Tabulka Projekce cash pozice** (jen Detailní) — 6 řádků měsíců s počátečním zůstatkem, příjmy, výdaji, koncovým zůstatkem.

DATA Z DEMO ÚČTU (Alpha Atelier):
- Dnešní datum.
- Bank balance: editovatelný (klient zadá ručně).
- EBITDA/měs: cca +85 000 Kč.
- Recommendations a timeline se generují automaticky podle dat.

CO JE NA TOM SILNÉHO:
**Velmi silný „Důležité/Doporučení/Tip" pásek s doporučeními** — vypadá to jako AI poradce, který klientovi řekne, co dělat. „Můžu si dovolit...?" kalkulačka je vstřícný copywriter-friendly mikro-feature. **Vhodný pro screenshot** pokud máte naplněná data.

---

OBRAZOVKA: Tab „Měsíční plán" (MonthlyPlanTab) — pozn.: nově obsahuje Plán vs Actual reconciliation panel
SOUBOR: src/components/cfo/MonthlyPlanTab.tsx
URČENO PRO: klient
================================================================

PRVNÍ DOJEM:
Pracovní obrazovka, kde klient měsíc po měsíci odškrtává reálné transakce vs. plán. **Konkrétní, taktická.** Nahoře 4 mini-KPI (stav účtu, příjmy, výdaje, bilance). Pak month-picker, pak panel „Plán vs realizace". Pak dvě sekce: zelená pro příjmy, růžová pro výdaje.

HLAVIČKA / TOP SEKCE:
**Mřížka 4 mini-KPI:**
- „NA ÚČTU" — editovatelné číslo.
- „PŘIJDE" / „OČEKÁVANÉ PŘÍJMY" — zelená částka.
- „ODEJDE" / „OČEKÁVANÉ VÝDAJE" — růžová částka.
- „BILANCE" — zelená/růžová podle znaménka.

**Month picker:** „← Předchozí | Květen 2026 | Další →". Pokud měsíc uzavřen, pod ním uppercase zelený „UZAVŘENO".

HLAVNÍ OBSAH:
**Panel „Plán vs realizace"** (3 sloupce):
- „PŘÍJMY" — Plán: 120 000 Kč / Realizace: 95 000 Kč / Odchylka: ↓ 20,8 % (růžově).
- „VÝDAJE" — Plán / Realizace / Odchylka (zeleně, pokud nižší než plán).
- „ČISTÁ BILANCE" — Plán / Realizace / Odchylka.
- Nahoře pruh „XX % uzavřeno · 8 z 12 položek · 2 přeskočeno".

**Termíny tento měsíc** (žlutý panel, pokud existují):
- Datum + label + částka.
- Urgentní: růžové pozadí, badge „BRZY".

**Sekce „Příjmy"** (bílá karta, zelená tečka u nadpisu):
- Tučný titulek „Příjmy" + napravo celková zelená suma.
- Tlačítko „+ Příjem" (přidat manuální položku).
- Seznam řádků: checkbox + popis + částka. Klikem se položka potvrdí jako „paid". Když je paid, řádek se zezelená.
- Skipped položky šedé s přeškrtnutým textem.

**Sekce „Výdaje"** — stejný formát, růžová tečka, růžové sumy.

**Tmavá karta dole:** Příjmy / Výdaje / Bilance + tlačítko „UZAVŘÍT MĚSÍC" (zelené) / „ODEMKNOUT MĚSÍC" (žluté).

INTERAKCE A AKCE:
- Klik na řádek → potvrdí jako zaplacený.
- Klik na potvrzený → rozbalí editaci skutečné částky + možnost „Zrušit" / „Přeskočit".
- „+ Příjem" / „+ Výdaj" — přidá prázdný řádek.

DATA Z DEMO ÚČTU:
Auto-generuje očekávané položky z tarifů + nákladů + DPH + daní pro aktuální + 5 měsíců dopředu. Klient pak odškrtává reálné transakce.

CO JE NA TOM SILNÉHO:
**Nový panel „Plán vs realizace" je trumf** — vidíte přesně procento splnění plánu a odchylky. Akce „klik = potvrdit" je rychlá a uspokojivá. **Vhodný pro screenshot** jako "operativní úroveň" portálu.

---

OBRAZOVKA: Tab „Cenotvorba" (PricingTab)
SOUBOR: src/components/cfo/PricingTab.tsx
URČENO PRO: klient
================================================================

PRVNÍ DOJEM:
**Karty produktů / tarifů** vedle sebe — vypadají skoro jako veřejný ceník. Klient v nich edituje ceny, kapacitu a features. Pod tím doplňkové příjmy a auto-generovaná P&L tabulka.

HLAVIČKA:
**Mřížka 4 KPI:**
- „MĚSÍČNÍ PŘÍJEM" — patkový růžový.
- „EBITDA / MĚSÍC" — zelený / růžový.
- „BREAK-EVEN" — počet členů.
- „NÁVRATNOST CAPEX" — měsíce.

HLAVNÍ OBSAH:
**Karty tarifů** (až 4 v řadě):
- Pokud tarif má badge (např. „DOPORUČENÝ"), v levém horním rohu malý růžový pill.
- Editovatelný název tarifu (patkový).
- Trojice polí: „CENA (Kč/měsíc)" / „POČET ČLENŮ" / „KAPACITA (max)".
- Pravostranná suma „XX 000 Kč/měs" (růžová).
- Seznam features — každá s růžovým ◆ a editovatelným textem, vpravo ✕ na smazání.
- Link „+ služba".
- Pod tím pole na badge.

**Doplňkové příjmy** — pruhový seznam: název / počet / Kč/ks / jednotka. „+ Přidat".

**Auto P&L tabulka:**
- Sekce „PŘÍJMY" — řádky tarifů (např. „Standard (20 × 2 490 Kč) — 49 800 Kč"), pak doplňkové, pak součet.
- Sekce „NÁKLADY" — fixní položky + variabilní (5 % z obratu).
- Patkový řádek „EBITDA" zelený nebo růžový.

DATA Z DEMO ÚČTU (Alpha Atelier):
4 tarify: Standard (20 členů × 2 490), Premium (10 × 3 900, badge „Doporučený"), VIP (3 × 6 990), Partner VIP (2 × 10 000, badge „Firemní").
- Features konkrétní: „Přístup: 6:00-22:00", „Slot: 1h15 denně", „Rezervace: 2 týdny dopředu" atd.
Doplňkové: Blokové pronájmy (8 × 500/hod), Jednorázové vstupy (16 × 260).

CO JE NA TOM SILNÉHO:
**Karta tarifu vypadá jako veřejný pricing widget**, ale klient v ní edituje reálná čísla. Pro screenshot na web vhodné — ukazuje, že portál není jen tabulka, ale **business model canvas**.

---

OBRAZOVKA: Tab „Cashflow" (CashflowTab)
SOUBOR: src/components/cfo/CashflowTab.tsx
URČENO PRO: klient
================================================================

PRVNÍ DOJEM:
Hodně grafů a tabulek. Nahoře 4 KPI, pak progress-bar obsazenosti vůči break-even, pak nastavení projekce (ramp + měsíce), pak **velký cashflow graf**, pak **What-if simulátor se 4 slidery**, pak scénářová tabulka a doughnut, pak měsíční tabulka projekce.

HLAVIČKA:
4 KPI karty (stejné jako v Pricing tabu).

HLAVNÍ OBSAH:
**Obsazenost vůči break-even** — bílá karta: patkové „35 / 30 členů" + růžový progress-bar + „XX % break-even".

**Nastavení projekce** — pole: Zahájení podnikání (month picker), Ramp-up měsíce, Projekce měsíce.

**Cashflow graf 24 měsíců** — velký sloupcový graf očekávaného cashflow.

**„Co když...?" simulátor** s 4 slidery:
- „PŘIDAT ČLENA" (zelený slider, 0-30).
- „ZTRATIT ČLENA" (růžový slider).
- „ZMĚNA CEN (%)" (−20 až +20).
- „SNÍŽENÍ NÁKLADŮ (Kč)" — slider 0 až 50 % fixních nákladů.

Po nastavení čehokoli se zobrazí 4 dlaždice: „Aktuální EBITDA" / „Nová EBITDA" / „Rozdíl" (zelený/růžový box) / „Break-even".

**Scénáře (jen Detailní)** — tabulka s řádky „5 členů", „10 členů"... „50 členů" a EBITDA pro každý. Aktuální stav je zvýrazněný béžovou linií „> 35 členů".

**Doughnut chart „Složení příjmů"** — kolik z čeho.

**Měsíční projekce** — tabulka Měsíc / Příjmy / Náklady / EBITDA / Kumulativní. Reálné měsíce jsou zelené, projektované neutrální.

DATA Z DEMO ÚČTU:
Pro Alpha Atelier: rampMonths 17, projectionMonths 24, break-even cca 13 členů.

CO JE NA TOM SILNÉHO:
**„Co když...?" simulátor je copywriterský klenot** — vizuálně i konceptuálně. Klient pohne sliderem a okamžitě vidí dopad. Vhodný pro screenshot a textovou narrative na webu („pohnete posuvníkem a uvidíte, kolik víc vyděláte, když získáte 5 nových klientů").

---

OBRAZOVKA: Tab „Pohledávky a závazky" (ReceivablesTab)
SOUBOR: src/components/cfo/ReceivablesTab.tsx
URČENO PRO: klient
================================================================

PRVNÍ DOJEM:
**Aging report jako horizontální barevný pruh** v 5 segmentech (Aktuální / 1-30 / 31-60 / 61-90 / 90+) — dominantní vizuální prvek. Pod ním přepínač „Vydané / Přijaté" a tabulky faktur.

HLAVIČKA:
4 KPI: „POHLEDÁVKY" / „ZÁVAZKY" / „PO SPLATNOSTI" (růžový!) / „ČISTÁ POZICE".

HLAVNÍ OBSAH:
**Aging bar** — 5 barevných segmentů s šířkou podle objemu:
- Aktuální (zelený) / 1-30 dnů (žlutý) / 31-60 (oranžový) / 61-90 (růžový) / 90+ dnů (sytě tmavě růžový).
- Pod tím malé labely s částkami.
- Prázdný stav: „Žádné pohledávky".

**Přepínač:** pill „Vydané faktury (X)" / „Přijaté faktury (Y)".

**Tabulka faktur** — řádky s poli:
- Číslo (např. „FV-001") + Klient + Popis + Základ + DPH (dropdown 0/12/21 %) + Total + Status dropdown.
- Status pill s barvou: „Koncept" (šedý) / „Odesláno" (žlutý) / „Zaplaceno" (zelený) / „Po splatnosti" (růžový).
- Pod hlavními poli: datum vystavení + datum splatnosti.

DATA Z DEMO ÚČTU:
Pro TechCars: FV-001 AB Rent (zaplaceno), FV-002 Petr Novák (odesláno), DOD-001 Auto Kelly (přijatá, zaplaceno).

CO JE NA TOM SILNÉHO:
**Aging bar je nejlepší vizualizace pohledávek** ze všech tabů — barevný horizontální stripe je instantně srozumitelný. Vhodný screenshot pro detail služby.

---

OBRAZOVKA: Tab „DPH" (VatTab)
SOUBOR: src/components/cfo/VatTab.tsx
URČENO PRO: klient (jen plátci DPH)
================================================================

PRVNÍ DOJEM:
Sterilnější tab — nahoře 4 KPI s DPH čísly, pod tím tabulky sazeb a období. Pro neznalce DPH náročné, ale pro účetní jasné.

HLAVIČKA:
4 KPI:
- „DPH NA VÝSTUPU" (růžový).
- „DPH NA VSTUPU" (zelený).
- „K ODVODU" / „NADMĚRNÝ ODPOČET" (růžový/zelený podle bilance), pod tím „zaplatíte FÚ" / „FÚ vám vrátí".
- „DPH Z CAPEX" — pro velké investice se zobrazí možný odpočet z CAPEX-VAT 21 %.

HLAVNÍ OBSAH:
**Sazby DPH** — tabulka služba / sazba (0/12/21) / poznámka.

**Přepínač:** Měsíční / Kvartální vykazování.

**Období** — tabulka s sloupci: období (např. „Q1 2026") / Výstup / Vstup / Odvod nebo Odpočet / Splatnost / Zaplaceno toggle.

DATA Z DEMO ÚČTU:
Vypočítané z faktur (Pricing tab + faktury) auto-výpočtem.

CO JE NA TOM SILNÉHO:
Tabulka period s barevným stavem (zaplaceno = zelený, nezaplaceno = růžový) je pěkná, ale **pro screenshot na web nevhodná** — moc technické.

---

OBRAZOVKA: Tab „Daně & Odvody" (TaxesTab)
SOUBOR: src/components/cfo/TaxesTab.tsx
URČENO PRO: klient
================================================================

PRVNÍ DOJEM:
**Žlutý panel „Automatický český daňový kalendář"** nahoře — okamžitě upoutá pozornost. Pod ním KPI a platební kalendář se zaškrtávacími kruhy.

HLAVIČKA:
**Žlutý kalendář** s nadcházejícími daňovými termíny v ČR (automaticky generované):
- Každý řádek: datum + label (např. „Daň z příjmů — záloha Q2") + částka.
- Urgentní (brzy splatné): růžové pozadí + „BRZY" badge.

**4 KPI:**
- „MĚSÍČNÍ ZATÍŽENÍ" — daně + odvody dohromady.
- „ROČNÍ ODHAD".
- „DAŇ Z PŘÍJMŮ" — sazba % + typ entity (s.r.o. / OSVČ).
- „NEZAPLACENO" — kolik plateb je dluh.

HLAVNÍ OBSAH:
**Platební kalendář** — seznam plateb s checkbox-kruhem:
- Když zaplaceno: zelený kruh s ✓, text přeškrtnutý, na šedém pozadí.
- Když brzy (< 14 dní): žlutý rámeček.
- Když po splatnosti: růžový rámeček.

**Tři detailní karty** vedle sebe:
- „Daň z příjmů" — roční odhad + zálohy.
- „Sociální pojištění" — měsíční záloha + zálohy.
- „Zdravotní pojištění" — měsíční záloha + zálohy.

CO JE NA TOM SILNÉHO:
**Automatický český daňový kalendář je killer feature pro malé firmy** — nemusí si vzpomenout, kdy je co splatné. Tento prvek jednoznačně **použít v copy na webu** („portál vám sám hlídá české daňové termíny").

---

OBRAZOVKA: Tab „Náklady" (CostsTab)
SOUBOR: src/components/cfo/CostsTab.tsx
URČENO PRO: klient
================================================================

PRVNÍ DOJEM:
**Jednoduchá obrazovka** — seznam fixních nákladů s editovatelnými řádky, pod tím slider pro variabilní náklady v %, dole tmavá info-karta.

HLAVIČKA:
Žádná velká hlavička.

HLAVNÍ OBSAH:
**Fixní měsíční náklady** — seznam: název nákladu + Kč/měs + ✕. Tlačítko „+ Přidat náklad". Dole celkem („Celkem fixní OPEX: 48 000 Kč").

**Variabilní náklady** — růžový slider 0-30 % + číselné pole vedle. Popis: „Procento z celkových příjmů (pokrývá pohyblivé náklady jako provize, spotřební materiál, apod.)".

**Tmavá info-karta:** „Jak to funguje" + odstavec „Fixní náklady se platí každý měsíc bez ohledu na příjmy. Variabilní náklady rostou s obratem, typicky 3-8 % pro služby, 15-30 % pro prodejce zboží. Všechny výpočty (P&L, break-even, cashflow projekce) se automaticky přepočítají při jakékoli změně." (Vodoznak: obří patkové „%" v rohu.)

DATA Z DEMO ÚČTU (Alpha Atelier):
Nájem 28 000 / Energie a voda 8 000 / Administrativa a účetnictví 5 000 / Pojištění 2 000 / Marketing 5 000 = 48 000 Kč.

CO JE NA TOM SILNÉHO:
Tmavá info-karta s "Jak to funguje" + obří patkové „%" je hezký detail. Ale jako celek **střední screenshot** — funkční, ne fotogenický.

---

OBRAZOVKA: Tab „Rozpočet" (BudgetTab)
SOUBOR: src/components/cfo/BudgetTab.tsx
URČENO PRO: klient
================================================================

PRVNÍ DOJEM:
**Tmavá karta s 4 velkými rozpočtovými čísly** nahoře, pod tím dvě karty: CAPEX tracker a Provozní rezerva.

HLAVIČKA / TOP SEKCE:
**Tmavá karta „Celkový rozpočet"** s 4 editovatelnými poli:
- „CELKOVÝ ROZPOČET" — patkové bledě béžové.
- „CAPEX ROZPOČET".
- „PROVOZNÍ REZERVA".
- „ZBÝVÁ" — vypočítaný zůstatek (zelený / bledě růžový).
Vpravo dole obří patkové „K" vodoznak.

HLAVNÍ OBSAH:
**CAPEX tracker** (bílá karta vlevo):
- Patkový titulek „CAPEX · investice".
- Progress-bar „čerpáno z plánu".
- Tabulka položek: název / plán / čerpáno / ✕.
- Suma plánovaných pod tabulkou s indikací „Plánované výdaje přesahují rozpočet o X" (žlutý warning) nebo „V plánu chybí Y do rozpočtu".

**Provozní rezerva** (bílá karta vpravo):
- Progress-bar čerpání.
- Pole „Čerpáno z rezervy (Kč)".
- „Zbývající rezerva" (zelená / růžová).
- „Aktuální měsíční ztráta" (jen pokud ztrátový).
- „Runway" — kolik měsíců přežije při aktuální ztrátě (zelená > 3 měs / růžová < 3 měs).

DATA Z DEMO ÚČTU (Alpha Atelier):
- Total 1 400 000 Kč.
- CAPEX 1 200 000: Stavební úpravy (plán 350K, čerpáno 280K), Sprchy + šatny (200K/150K), Vybavení (250K/180K), Smart-entry (60K/45K), Design/branding (40K/25K) → čerpáno 680K z 900K plánovaných.
- Rezerva 200 000 (zatím nečerpáno).

CO JE NA TOM SILNÉHO:
**Runway výpočet je psychologicky silný** — klient vidí, kolik měsíců přežije při ztrátě. Vhodný akademický screenshot pro stránku „CFO na volné noze".

---

OBRAZOVKA: Tab „Rizika & Plán" (RisksTab)
SOUBOR: src/components/cfo/RisksTab.tsx
URČENO PRO: klient (taktická obrazovka)
================================================================

PRVNÍ DOJEM:
**Dvě karty pod sebou:** seznam rizik (color-coded) a akční plán v kartách 3×n.

HLAVNÍ OBSAH:
**Rizika** — bílá karta:
- Tlačítko „+ Přidat riziko".
- Každé riziko jako řádek na barevném pozadí (růžové, žluté, zelené podle úrovně):
  - Dropdown stupně („Kritické / Střední / Nízké").
  - Editovatelný „Název rizika".
  - Editovatelný „Popis a dopad".
  - ✕ na smazání.
- Prázdný stav: „Žádná rizika. Přidejte první riziko tlačítkem výše."

**Akční plán** — karty 3 sloupce:
- Patkové bledě růžové číslo („01"-„99").
- Tenký růžový uppercase „Termín (např. Do 15. dubna)".
- Tučný název kroku.
- Šedý popis.
- Pravý horní badge „Označit" / „Hotovo".

DATA Z DEMO ÚČTU (Alpha Atelier):
4 rizika: „Pomalý náběr členů" (kritické), „Zvýšení nájmu" (střední), „Příjem provozovatele od M1" (střední), „Konkurence velkých řetězců" (nízké).
6 kroků (01-06): Ověřit živnostenský list (hotovo), Aktualizovat OR, Registrace k DPH, Podpis nájemní smlouvy, Oslovit 5-8 firem, Zahájit renovaci.

CO JE NA TOM SILNÉHO:
**Akční plán v patkových kartách s deadlines vypadá jako konzultantský plán** — vhodný pro stránku služby.

---

OBRAZOVKA: Tab „Dotazy" (QuestionsTab)
SOUBOR: src/components/cfo/QuestionsTab.tsx
URČENO PRO: klient
================================================================

PRVNÍ DOJEM:
Quick Q&A interface. Klient může nahodit otázku, Josef ji zodpoví v inline editaci, klient ji označí jako vyřešenou.

HLAVNÍ OBSAH:
**Nový dotaz** — pole + tlačítko „Odeslat" (růžové).

**Otevřené dotazy** (růžový panel) — počet v růžovém pillu vedle nadpisu:
- Růžová ● tečka.
- Otázka (editovatelná).
- Odpověď (editovatelná, klient může editovat sám).
- „Vyřešit" zelený mini-button + ✕.

**Vyřešené** (zelený panel) — počet v zeleném pillu:
- Zelená ✓ tečka.
- Otázka + odpověď.
- „Znovu otevřít".

DATA Z DEMO ÚČTU (Alpha Atelier):
5 dotazů: „Povolení 24/7 provozu" (otevřený, s částečnou odpovědí), „Hlukové limity" (vyřešený), „Nájemní smlouva povoluje fitness?" (vyřešený, potvrzeno), „DPH na nájem a platební brány" (otevřený, s navrhovaným řešením), „Nutriční poradce, partnerství" (otevřený).

CO JE NA TOM SILNÉHO:
**Lightweight Q&A — vypadá to jako "FAQ s vaším poradcem"**. Růžová/zelená dělba na otevřené/vyřešené je čistá. Pro screenshot ne tak dramatické, ale **textově silný feature pro web** („portál si pamatuje vaše dotazy a odpovědi navždy").

---

OBRAZOVKA: Tab „Import dat" (ImportTab)
SOUBOR: src/components/cfo/ImportTab.tsx
URČENO PRO: klient (technický)
================================================================

PRVNÍ DOJEM:
**Dvoupanelový import** — bankovní výpis a faktury. Každý panel má tlačítko na šablonu, file picker, preview tabulku s ✓/⚠ statusem.

HLAVIČKA:
Bílá intro karta: „Hromadný import dat. Nahrajte bankovní výpisy nebo faktury v CSV formátu. Systém soubor projde, ukáže náhled a po potvrzení zapíše data do ledgeru / pohledávek. Ručně přepisování stovek řádků není potřeba."

HLAVNÍ OBSAH:
**1. Bankovní výpis → Cashflow ledger:**
- Titulek + technický popis sloupců CSV (v `<code>` formátu).
- Růžové tlačítko „Stáhnout šablonu".
- Růžové tlačítko „Vybrat CSV soubor" (skrytý input).
- Po nahrání: počet platných / s chybou.
- Preview tabulka (až 100 řádků): Datum / Popis / Částka (zelená pro +, růžová pro −) / Kategorie / Status (✓ nebo ⚠ s chybou).
- Tlačítka „Importovat X řádků" + „Zrušit".

**2. Faktury (vydané + přijaté) → Pohledávky** — stejný formát.

**Tipy pro export z účetních SW:**
- Béžová karta s nadpisem „💡 Tipy pro export z účetních SW".
- Bullety:
  - „**Pohoda:** Účetnictví → Sestavy → Hlavní kniha → Export do CSV (Excel)"
  - „**Money S3:** Účetnictví → Účetní deník → tlačítko „Export" → vyberte CSV"
  - „**Banka (ČSOB, KB, Air Bank, mBank):** Internet banking → Historie → Export → CSV"
  - „Pokud má soubor jiné názvy sloupců, otevřete ho v Excelu a přejmenujte hlavičku podle šablony."

CO JE NA TOM SILNÉHO:
**Tipy pro Pohodu / Money S3 / banky** jsou kouzelný detail — vypadá to, že portál opravdu rozumí českému trhu. Pro web vhodné popsat slovně („import výpisů z ČSOB, KB, Air Bank, Pohoda nebo Money S3 jedním kliknutím").

---

================================================================
ADMIN OBRAZOVKY
================================================================

OBRAZOVKA: Admin → Klienti
URL: /portal/admin
SOUBOR: src/app/(portal)/admin/page.tsx
URČENO PRO: admin
================================================================

Tabulka klientů s sloupci: Klient / E-mail / Služba (pill toggles pro 7 služeb) / Status (Aktivní/Neaktivní pill) / Smazat. Vpravo nahoře růžové tlačítko „+ PŘIDAT KLIENTA" otevře 4-krokový OnboardingWizard. Klik na řádek otevře `/cfo?client=ID` (CFO dashboard daného klienta). Pill na službu je klikatelný — toggluje přiřazení. Mazání klienta vyvolá confirm dialog se seznamem co se smaže („účet, profil v databázi, všechny reporty"). Solidní, čistá admin tabulka — nic extra.

---

OBRAZOVKA: Admin → Reporty
URL: /portal/admin/reports
SOUBOR: src/app/(portal)/admin/reports/page.tsx
URČENO PRO: admin
================================================================

Tabulka existujících reportů + tlačítko „+ NOVÝ REPORT". Editor reportu má **3 módy přepínané pill-buttons**: Formulář / Bloky (vlastní layout) / Celý JSON.
- **Formulář** — strukturované sekce s editovatelnými poli (tarify, fixed_costs, rizika, kroky, dotazy) — pro CFO velmi rozsáhlý formulář, pro ostatní typy reportů menší JSON pole.
- **Bloky** — textarea s JSON polem bloků pro vlastní dashboardový layout. Pod tím rozbalovací „Ukázka" s konkrétním JSON příkladem (heading + kpi-grid + risk-list).
- **Celý JSON** — surová textarea s celým JSONem reportu.

Růžové tlačítko „Uložit report". Mazání má confirm dialog. **Technicky náročné — primárně pro Josefa.**

---

OBRAZOVKA: Onboarding wizard (4-krokový modal)
SOUBOR: src/components/admin/OnboardingWizard.tsx
URČENO PRO: admin
================================================================

**Velký modal** přes celou obrazovku s tmavým pozadím (blur backdrop). Bílá karta uprostřed (max 720px). Nahoře růžový mini-titulek „Onboarding klienta · krok X ze 4" + patkový nadpis kroku. Pod tím progress dots (4 pruhy, aktivní jsou tučnější růžové).

**Krok 1 — Základní informace:**
- „Název firmy *" — placeholder „TechCars Servis s.r.o.", hint „Tak jak ho zobrazujeme v portálu".
- „E-mail klienta *" — hint „Bude se s ním přihlašovat".
- „Telefon" — hint „Volitelně, pro urgentní záležitosti".
- „Heslo pro první přihlášení *" — hint „Min. 6 znaků. Klient si pak změní v portálu."

**Krok 2 — Profil firmy:**
- „IČO".
- „Právní forma" — pill přepínače: s.r.o. / OSVČ / a.s. / jiný.
- „Plátce DPH?" — Ano / Ne.
- „Obor *" — dropdown 13 oborů (Výroba a strojírenství, Stavebnictví, Auto-servis/autopůjčovna, E-shop a obchod, Gastronomie, IT a software, atd.).
- „Velikost firmy" — 1-5 / 6-15 / 16-50 / 50+.
- „Roční obrat" — do 5 mil / 5-30 / 30-100 / 100-500 / 500+ mil.

**Krok 3 — Služby a cíle:**
- „Které služby klient bere? *" — pill multi-select 6 služeb.
- „Hlavní cíle klienta" — 6 velkých klikacích karet:
  - „Lepší přehled o cashflow / Vědět, kolik mám peněz a kam tečou"
  - „Zvýšit marže / Identifikovat ztrátové produkty / klienty"
  - „Strategicky růst / Rozhodovat se podle dat, ne podle pocitu"
  - „Připravit firmu na prodej / V horizontu 1-5 let"
  - „Přibrat investora / Připravit finanční podklady"
  - „Vyčistit účetnictví a procesy / Mít data v pořádku pro rozhodování"

**Krok 4 — První čísla:**
Uvozující věta: „První čísla, ať dashboard nestartuje na nule. Nemusí být přesná, naladíme po prvním měsíci. Můžete přeskočit a doplnit později."
- „Hlavní zdroje tržeb" — řádky: název (např. „Mechanické opravy") / Cena Kč / ks/měs.
- „Měsíční fixní náklady" — řádky: název (např. „Nájem") / Kč/měs.

Spodní lišta: „← Zpět" / „Pokračovat →" / „Vytvořit klienta ✓" (růžové, na posledním kroku).

CO JE NA TOM SILNÉHO:
**Wizard vypadá jako Stripe/Notion onboarding** — profesionální, ne korporátní. **Velmi vhodný pro krátkou animaci na webu** („3 minuty a klient je v portálu"). Texty cílů jsou skoro hotová web copy (zvážit přepoužití).

---

================================================================
GLOBÁLNÍ PRVKY (popsány jen jednou)
================================================================

PRVEK: Sidebar (levé navigační menu)
SOUBOR: src/components/Sidebar.tsx
================================================================

**Tmavá svislá lišta 240px vlevo, sticky** (zůstává na obrazovce při scrollu). Obsah shora dolů:
- Logo „Kliments." (patkové, krémové, růžová tečka).
- Avatara klienta (růžový kruh s iniciálou) + jméno + role („Klient" / „Admin").
- Mini-nadpis „PŘEHLED".
- Navigační linky s emoji ikonami: 📊 Dashboard · 🔍 Finanční diagnóza · 📈 CFO na volné noze · ⭐ Prodej za maximum · 📋 Příprava na investora · 👤 Mentoring · 📁 Dokumenty · 💬 Zprávy.
- Klient vidí jen položky odpovídající jeho přiřazeným službám (filtrováno).
- Aktivní položka má růžový levý pruh + krémový text + růžové průsvitné pozadí.
- U Zpráv pokud jsou nepřečtené, **růžový kulatý badge s číslem** (9+ pokud více).
- Pro admina navíc sekce „ADMIN" s 👥 Klienti · 📝 Reporty.
- Dole pillová „AKTIVNÍ SLUŽBA" karta s názvem služby + odkaz „Odhlásit se" (tenký, šedý).

---

PRVEK: Topbar + hamburger (mobil)
SOUBOR: src/components/AppShell.tsx (mobile topbar), src/components/Topbar.tsx (desktop topbar)
================================================================

**Desktop Topbar** (76px výška, sticky):
- Béžové pozadí s blur efektem.
- Logo „Kliments." vlevo s odkazem na kliments.cz (hover snižuje opacity).
- Vertikální oddělovač + uppercase tenký název aktivní stránky (např. „DASHBOARD").
- Vpravo linky „SLUŽBY" / „KONTAKT" (vedou na web), pak růžový tučný „PORTÁL" označující že jsem v portálu.

**Mobilní topbar:**
- Hamburger menu vlevo (SVG ☰).
- U hamburgeru malý růžový badge s počtem nepřečtených zpráv.
- Logo „Kliments." vpravo od hamburgeru.

Sidebar se na mobilu skrývá a vysune se přes celé okno po kliknutí na ☰. Klik mimo (na backdrop) ho zase zavře.

---

PRVEK: Unread message badge
SOUBOR: V Sidebar.tsx (na položce Zprávy) + AppShell.tsx (na hamburgeru)
================================================================

Růžový kulatý badge (20×20px) s bílým číslem. Pokud > 9: „9+". **Realtime** — okamžitě se zvýší při nové zprávě (přes Supabase realtime channel). Po otevření `/zpravy` se vynuluje.

---

PRVEK: Auto-save toast
SOUBOR: src/components/SaveToast.tsx
================================================================

**Plovoucí notifikace vpravo nahoře** (top: 16px, right: 16px). Tři stavy:
- „Ukládám..." — tmavá karta s bledším textem.
- „✓ Uloženo 14:32" — **zelená** karta. Auto-zmizí po 2,5 vteřinách.
- „Chyba ukládání" — sytě růžová karta.

Vyvolá se kdykoli klient cokoli změní (debounce 800ms). **Velmi efektní mikrointerakce** — klient vidí, že vše se ukládá automaticky bez „Uložit" tlačítka.

---

PRVEK: AdminClientPicker
SOUBOR: src/components/AdminClientPicker.tsx
================================================================

**Co admin vidí, když otevře jakýkoli klientský report bez `?client=` parametru.** Tmavá hlavička s názvem služby + „Vyberte klienta pro zobrazení dashboardu". Pod tím **mřížka karet aktivních klientů** s touto službou:
- Bílá karta, klikatelná.
- Vlevo růžový kruh s iniciálou.
- Tučné jméno + šedý e-mail.
- Vpravo šedá šipka „→" (zrůžoví při hoveru).
- Klik → přesměrování s `?client=ID`.

Prázdný stav: „Žádní klienti s touto službou." + link „Přiřadit službu klientovi →".

---

PRVEK: EmptyState
SOUBOR: src/components/EmptyState.tsx
================================================================

**Centrovaný prázdný stav s velkým emoji + patkový titulek + popis + růžové CTA „NAPSAT JOSEFOVI →"**. Varianty podle služby:
- CFO: 📈 „Váš finanční model se připravuje" / „Brzy tu budete moci upravovat tarify, náklady a sledovat cashflow projekce."
- Diagnóza: 🔍 „Diagnóza se připravuje" / „Josef analyzuje vaše finanční data. Report s metrikami a SWOT analýzou bude brzy připraven."
- Valuace: ⭐ „Valuace se připravuje" / „Josef vypočítává hodnotu vašeho podnikání pomocí tří oceňovacích metod."
- Investor: 📋 „Investor readiness se připravuje" / „Josef připravuje checklist připravenosti a MRR projekce pro investory."
- Mentoring: 👤 „Váš mentoring začíná" / „Po prvním sezení tu najdete záznamy, poznámky a úkoly z mentoringu."
- Default: 📋 „Zatím žádná data" / „Josef připravuje váš první report. Brzy tu bude."

CTA vždy vede na chat. **Tyto texty jsou skoro hotová web copy** — Josefův osobní brand jako jediného konzultanta.

---

================================================================
WOW MOMENTY (vhodné na hlavní screenshot kliments.cz)
================================================================

1. **CFO panel s custom blokovým layoutem pro TechCars Servis** (`/portal/cfo`, klient s vlastními bloky) — patkový obří heading „Finanční řízení servisu", barevné KPI s konkrétními čísly („564 000 Kč měsíční tržba", „7,3 % EBITDA marže", „0,7 měs. likvidní rezerva ⚠"), žlutý callout „Sezónní cash gap se blíží", tabulka skladby tržeb po kategoriích, SWOT, akční plán. **Vypadá to jako personalizovaný report od konzultanta, ne jako SaaS dashboard.** Jednoznačně nejsilnější demo screenshot.

2. **Dashboard úvodní stránka s tmavou kartou „Dobrý den, [Jméno]"** + růžovým CTA „NAPSAT JOSEFOVI →" + 4 patkové KPI karty pod tím. Vyzařuje teplo a osobní přístup. Vhodné jako "první kontakt" obrázek.

3. **Cashflow tab s „Co když...?" simulátorem** (`/portal/cfo?tab=cashflow`) — 4 slidery (přidat člena, ztratit, změna cen, snížení nákladů) + okamžitý dopad na EBITDA. **Vizuálně i konceptuálně interaktivní** — ideální pro animovaný GIF na webu.

4. **Valuace s gigantickým vodoznakem hodnoty firmy** (např. „1,2 M Kč" jako 120pt patkový text v rohu tmavé karty) — působí jako exkluzivní privátní oceňovací zpráva. Vhodné pro stránku služby „Prodej za maximum".

5. **Onboarding wizard, krok 3 „Hlavní cíle klienta"** — 6 velkých klikacích karet s lidsky napsanými cíli („Vědět, kolik mám peněz a kam tečou"). **Profesionální onboarding zážitek**, vhodný pro krátkou animaci ukazující "3 minuty a klient je uvnitř".

---

================================================================
SLABÁ MÍSTA Z UX POHLEDU (na webu se jim vyhnout nebo popsat slovně)
================================================================

- **Investor stránka, Mentoring stránka, Valuace stránka, Finanční diagnóza** — všechny mají **prázdné seed účty**. Pokud nemáte naplněná data konkrétního testovacího klienta, vidíte EmptyState. Pro screenshot je potřeba předem připravit data (může to být jen pro účely fotek na webu).

- **Tab DPH (VatTab)** — vysoce technický, tabulkový. Pro neúčetní vypadá sterilně. Na webu popsat slovy („automatický výpočet DPH ze všech faktur, kvartální i měsíční přehled"), ne screenshotem.

- **Tab Náklady (CostsTab)** — funkční, ale designově nepříliš ambiciózní. Jen seznam položek + slider. Vynechat ze screenshotů.

- **Tab Import dat** — technický, textově silný (Pohoda, Money S3, ČSOB...), ale vizuálně nudný. Na webu popsat slovem ("import z bank a účetních systémů jedním kliknutím"), ne screenshotem.

- **Admin sekce** (Klienti, Reporty, Onboarding) jsou jen pro admina. Pro klientský web vůbec nepoužívat — ale Onboarding wizard se dá v rámci „nahlédnutí do procesu" zobrazit jako důkaz, že nový klient je rychle zprovozněný.

- **Dokumenty** — funkční file manager, ale designově nezapamatovatelný. Pro web jen zmínit textem („sdílené úložiště pro účetní podklady, smlouvy a daňová přiznání").

- **Mentoring** — bez seedu vypadá prázdně. I s daty je to seznam karet pod sebou, vizuálně méně bohaté než Diagnóza nebo CFO. Možná jen jeden screenshot s ukázkou jednoho sezení.

- **CFO bez data (prázdný stav)** — pokud klient nemá vyplněné tarify a náklady, dashboard ukazuje samé „···" — nevhodné pro screenshot. Vždy použít účet s naplněnými daty (Alpha Atelier nebo TechCars).

---

================================================================
KOPIROVATELNÉ MIKROCOPY (přímé citace z UI vhodné do webu)
================================================================

1. „Klientský portál · Finanční řízení" (login subtitul)
2. „Dobrý den, [Jméno]" / „Vítejte v portálu" (osobní oslovení v Dashboardu)
3. „Napsat Josefovi →" (hlavní CTA napříč portálem; opakující se osobní touch)
4. „Brzy tu budete moci upravovat tarify, náklady a sledovat cashflow projekce." (EmptyState pro CFO)
5. „Josef analyzuje vaše finanční data. Report s metrikami a SWOT analýzou bude brzy připraven." (EmptyState pro Diagnózu)
6. „Můžu si dovolit...?" (název What-if kalkulačky v Dashboardu — jednoduchý mód)
7. „Co když...?" (název simulátoru v Cashflow tabu — perfektní headline pro web)
8. „Fixní náklady se platí každý měsíc bez ohledu na příjmy. Variabilní náklady rostou s obratem, typicky 3-8 % pro služby, 15-30 % pro prodejce zboží. Všechny výpočty se automaticky přepočítají při jakékoli změně." (CostsTab info-karta — vzdělávací mikrocopy)
9. „První čísla, ať dashboard nestartuje na nule. Nemusí být přesná, naladíme po prvním měsíci." (Onboarding krok 4 — vstřícný tón)
10. „Vědět, kolik mám peněz a kam tečou" (Onboarding cíl „Lepší přehled o cashflow")
11. „Rozhodovat se podle dat, ne podle pocitu" (Onboarding cíl „Strategicky růst" — velmi prodejní)
12. „Mít data v pořádku pro rozhodování" (Onboarding cíl „Vyčistit účetnictví")
13. „Hromadný import dat. Nahrajte bankovní výpisy nebo faktury v CSV formátu. Ručně přepisování stovek řádků není potřeba." (ImportTab intro)
14. „Automaticky český daňový kalendář" (TaxesTab — killer feature description)
15. „Pohoda · Money S3 · ČSOB · KB · Air Bank · mBank" (ImportTab tipy — důvěryhodnost pro český trh)
16. „✓ Uloženo 14:32" (SaveToast — autosave proof point)
17. „Váš finanční poradce" (chat header pod jménem Josef Kliment)
18. „Zatím žádné zprávy. Napište první." (chat prázdný stav)
19. „Označit / Hotovo" (toggle na akčních krocích — taktilní mikrocopy)
20. „Plán vs realizace" + „XX % uzavřeno · X z Y položek" (MonthlyPlanTab reconciliation badge — silný pro „operativní controlling")

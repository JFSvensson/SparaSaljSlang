# Fortsatt utvecklingsplan

## Klart
- Signerade SQLite-sessioner, lösenordshashning, CSRF-skydd och säkerhetsheaders.
- Validering, felkontrakt, rate limiting och filnamnsnormalisering.
- SQLite-hälsokontroll, strukturerad loggning och kontrollerad avstängning.
- Docker- och Compose-underlag för VPS samt GitHub Actions CI.
- Enhetstester och isolerade HTTP-flödestester för inloggning, CSRF, uppladdning, röstning och borttagning, inklusive filstorlek och rate limiting.
- Uppladdningsflöde med lokal bildförhandsvisning, klientvalidering av typ och storlek samt drag-and-drop.
- Dokumenterad, avbrottssäker backup-rutin för Docker-volymerna.
- Guardat återställningsskript och dokumenterad återställningsövning för Docker-volymerna.
- Docker Compose-smoketest: Linux-imagen byggs med native SQLite-stöd, containern blir frisk och `/api/health` bekräftar SQLite.
- Verifierad backup- och återställningsövning: ett tillfälligt testobjekt i upload-volymen togs bort efter återställning och appen blev frisk igen.
- Begränsad Docker-loggning med tre roterade 10 MB-filer och dokumenterad loggövervakning.
- Beslutsöversikt med antal föremål och röster samt aktuella ensamma ledare för Spara, Sälj och Släng.
- Klientsidiga namn- och datumfilter som samverkar med listans röstsortering och tydliga tomlägen.
- Massradering via API och listvy med val av flera kort, tydlig bekräftelsemodal och robust resultatåterkoppling.
- Inbjudningskodsskyddade väljarkonton med en röst per konto och föremål.
- Konfigurerbart krav på antal röstande; enhälliga Sälj-röster och Sälj direkt skapar sparade annonsutkast.
- Formulär för att komplettera annonsutkast med beskrivning, pris och avsedd marknadsplats; publicering sker manuellt.
- Administratörssida för att lista och återkalla väljarkonton samt rotera inbjudningskoden eller stänga av registrering.
- Annonsutkast med skick, tydlig fullständighetsstatus och kopiering av annonstext.
- Administratören kan öppna om en avslutad omröstning utan enhälligt Sälj; tidigare rundors röster bevaras men räknas separat.

## Färdplan

### Etapp 1 – Säker pilot med riktiga väljare
**Mål:** Bekräfta att inbjudningar, röstregeln och utkasten fungerar för den tänkta gruppen innan externa marknadsplatskonton kopplas in.
- **Förbered:** gör en färsk backup och välj en avgränsad pilotmiljö. Använd inte riktiga Blocket-/Tradera-inloggningar i appen; marknadsplatskoppling finns inte.
- Bjud in ett litet antal deltagare med personliga väljarkonton och dela den engångsvisade inbjudningskoden via en separat säker kanal.
- Prova separata föremål för enhälligt Sälj, blandade röster som når tröskeln, Spara/Släng och Sälj direkt. Bekräfta att en väljare inte kan rösta två gånger i samma runda.
- Öppna en avslutad omröstning med blandade röster igen; kontrollera att den nya rundan börjar utan tidigare röstetal och att deltagarna kan rösta på nytt.
- Prova återkallelse och kodrotation med en avgränsad testanvändare; kontrollera att en återkallad aktiv session blockeras.
- Komplettera ett annonsutkast, kontrollera att ett ofullständigt utkast inte kan kopieras och kopiera en färdig annonstext för manuell granskning. Publicera inte testannonser automatiskt.
- Samla in deltagarnas begriplighets- och användbarhetsfeedback, åtgärda blockerande problem och gör en ny backup efter piloten.
**Klart när:** En pilotgrupp kan registrera sig, rösta en gång per föremål, förstå beslutet och färdigställa ett utkast utan administratörsingrepp.

### Etapp 2 – Verifiera marknadsplatsmöjligheter
**Mål:** Välja integrationsväg utifrån vad Blocket och Tradera faktiskt stöder för denna typ av konto.
- **Kontrollerat 2026-09-30 – Blocket:** Det officiella [Pro Import API](https://api.blocket.se/pro-import-api/docs/client-documentation) skapar och hanterar annonser asynkront. Dokumentationen säger att API:t ska användas för att hantera annonser på Blocket/Bytbil, inte för att driva webbplatser eller liknande; dealer-/dealer-group-terminologin gäller även andra slags företagskunder. Det finns ingen separat testmiljö. Dolda annonser (`visible: false`) går till Blocket Admin/API utan att publiceras eller debiteras, och `/validate` kan validera data utan att spara. Behörighet och lämplig användning för appens faktiska konto måste bekräftas med Blocket innan integration.
- **Kontrollerat 2026-09-30 – Tradera:** Officiella [Developer Program-dokumentationen](https://api.tradera.com/documentation) beskriver REST API v4. API-åtkomst kräver app-id/app-nyckel och användarautentisering för handlingar på ett säljkonto. `autoCommit: false` kan användas för att validera en listning utan att publicera den; publicering sker i ett separat commit-steg. Den aktuella v4-dokumentationen anger inget sandbox-miljöflöde, så detta är inte likvärdigt med ett isolerat testkonto. Bekräfta utvecklarregistrering, autentisering/behörighet för det avsedda kontot, eventuella villkor och testförfarandet i portalen innan integration påbörjas.
- Fråga tjänstens support om API-åtkomst kräver partnergodkännande eller särskild kontotyp.
- Jämför officiell direktpublicering med fortsatt manuell publicering från färdiga utkast.
- Undvik skärmskrapning eller automatiserad webbläsarinloggning om tjänsten inte erbjuder och tillåter ett stabilt gränssnitt.
**Beslutspunkt:** Tradera är fortsatt den rimligaste kandidaten för ett avgränsat proof-of-concept, men det finns inget dokumenterat v4-sandboxflöde; börja därför endast efter att utvecklarapp, autentisering och säkert testförfarande har bekräftats. Blocket kräver först ett tydligt svar från support om behörighet och användning för det avsedda kontot. Fortsätt annars med manuella utkast.

### Etapp 3 – Produktionssättning och datahållbarhet
**Mål:** Köra pilotversionen på en skyddad miljö med verifierad återställning.
- Distribuera på VPS med riktig domän, HTTPS och unika produktionshemligheter; håll registrering avstängd tills inbjudningskoden är utdelad säkert.
- Genomför backup och återställning med nya användarkonton, röster, utkast och uppladdade bilder.
- Automatisera offsite-kopiering och larma på misslyckad backup eller ohälsosam app.
- Lägg till CSV-export av föremål, röstetal och beslut om det behövs för uppföljning eller portabilitet.
**Klart när:** En återställningsövning på separat miljö lyckas och driftstatus/backuper går att kontrollera.

### Etapp 4 – En officiell integration i taget
**Mål:** Skapa och följa upp annonser på den första tjänst som godkänns i etapp 2.
- Börja med kontokoppling via tjänstens godkända autentiseringsflöde; lagra aldrig användarens marknadsplatslösenord.
- Implementera en separat adapter med validering, tydliga fel och skydd mot dubbla annonser vid återförsök.
- Låt användaren granska annonsen och bekräfta publicering; automatpublicering kräver ett separat produktbeslut.
- Visa publiceringsstatus och länk till annonsen, och hantera utgångna behörigheter utan att förlora utkast.
- Utvärdera pilot och supportbehov innan nästa marknadsplats kopplas in.

## Rekommenderad ordning
1. Kör en liten pilot med riktiga väljare; validera att utkastets skick, fullständighetsstatus och kopiering fungerar i vardagen.
2. Bekräfta Tradera developer access och fråga Blocket support om behörighet för privatpersoner innan integration.
3. Säkra produktionsdrift och verifierade offsite-backuper.
4. Bygg en godkänd marknadsplatsintegration först efter beslutspunkten ovan.

## Principer
- Behåll Express, SQLite och statisk vanilla-frontend tills produktens komplexitet motiverar en större förändring.
- Håll affärslogik testbar genom beroendeinjektion och smala moduler.
- Prioritera säkerhet, datahållbarhet och tydliga fel framför nya UI-funktioner.
- Bygg en liten, verifierbar förbättring i taget och kör relevanta tester efter varje ändring.

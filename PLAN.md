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
- Prova med ett litet antal användare och verkliga föremål.
- Verifiera scenarierna: enhälligt Sälj, blandade röster, tröskel uppnådd utan Sälj, återanvänd röst och Sälj direkt.
- Verifiera återkallelse och kodrotation med pilotgruppen, inklusive säker delning av den engångsvisade koden.
- Verifiera med pilotgruppen att administratörens möjlighet att öppna en avslutad omröstning igen fungerar begripligt och säkert.
- Prova det förbättrade annonsutkastet med pilotgruppen, inklusive kontroll att ofullständiga uppgifter stoppar kopiering.
**Klart när:** En pilotgrupp kan registrera sig, rösta en gång per föremål, förstå beslutet och färdigställa ett utkast utan administratörsingrepp.

### Etapp 2 – Verifiera marknadsplatsmöjligheter
**Mål:** Välja integrationsväg utifrån vad Blocket och Tradera faktiskt stöder för denna typ av konto.
- **Förstudie 2026-09-30:** Blockets officiella [Pro Import API](https://api.blocket.se/pro-import-api/docs/client-documentation) hanterar annonser via API, men kräver en JWT-token från Blockets kundsupport med dealer- eller dealer-group-scope. Processen är asynkron och testannonser kan skapas med `visible: false`; dokumentationen anger inget separat testmiljö. Bekräfta med Blocket om en privatperson och vanliga annonser kan få lämplig åtkomst innan detta blir en integrationskandidat.
- **Förstudie 2026-09-30:** Tradera har officiellt [Developer Program](https://api.tradera.com/documentation) och [REST API v4](https://api.tradera.com/v4/swagger/index.html), inklusive flöden för att skapa listningar. Dokumentationen anger app-nycklar och användarautentisering; publicering kräver separat bekräftelse av användaren. `autoCommit: false` verkar kunna validera/skapa ett opublicerat utkast som sedan behöver explicit commit. Bekräfta utvecklarregistrering, behörighet för vanliga säljkonton, kostnader och detta testflöde direkt i portalen innan integration påbörjas.
- Fråga tjänstens support om API-åtkomst kräver partnergodkännande eller särskild kontotyp.
- Jämför officiell direktpublicering med fortsatt manuell publicering från färdiga utkast.
- Undvik skärmskrapning eller automatiserad webbläsarinloggning om tjänsten inte erbjuder och tillåter ett stabilt gränssnitt.
**Beslutspunkt:** Tradera ser ut som bästa kandidat för ett avgränsat tekniskt proof-of-concept, men gå vidare först när en utvecklarapp och testbehörighet bekräftats. Blocket kräver först ett tydligt svar från support om konto- och annonsbehörighet för den här appens användning. Annars fortsätt med manuella utkast.

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

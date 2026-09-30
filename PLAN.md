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

## Nästa steg
1. Undersök officiella integrationsmöjligheter för Blocket och Tradera innan kontokoppling eller automatisk publicering.
2. Lägg till CSV-export av föremål, röstetal och aktuellt beslut.
3. Distribuera på VPS och verifiera Caddy/TLS med den riktiga domänen och produktionshemligheter.
4. Automatisera regelbunden offsite-kopiering av backup-arkiv.

## Principer
- Behåll Express, SQLite och statisk vanilla-frontend tills produktens komplexitet motiverar en större förändring.
- Håll affärslogik testbar genom beroendeinjektion och smala moduler.
- Prioritera säkerhet, datahållbarhet och tydliga fel framför nya UI-funktioner.
- Bygg en liten, verifierbar förbättring i taget och kör relevanta tester efter varje ändring.

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

## Nästa steg
1. Distribuera på VPS och verifiera Caddy/TLS med den riktiga domänen och produktionshemligheter.
2. Fastställ rutin för loggövervakning och regelbunden offsite-kopiering av backup-arkiv.

## Principer
- Behåll Express, SQLite och statisk vanilla-frontend tills produktens komplexitet motiverar en större förändring.
- Håll affärslogik testbar genom beroendeinjektion och smala moduler.
- Prioritera säkerhet, datahållbarhet och tydliga fel framför nya UI-funktioner.
- Bygg en liten, verifierbar förbättring i taget och kör relevanta tester efter varje ändring.

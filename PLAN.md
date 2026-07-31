# Fortsatt utvecklingsplan

## Klart
- Signerade SQLite-sessioner, lösenordshashning, CSRF-skydd och säkerhetsheaders.
- Validering, felkontrakt, rate limiting och filnamnsnormalisering.
- SQLite-hälsokontroll, strukturerad loggning och kontrollerad avstängning.
- Docker- och Compose-underlag för VPS samt GitHub Actions CI.
- Enhetstester och isolerade HTTP-flödestester för inloggning, CSRF, uppladdning, röstning och borttagning, inklusive filstorlek och rate limiting.
- Uppladdningsflöde med lokal bildförhandsvisning, klientvalidering av typ och storlek samt drag-and-drop.
- Dokumenterad, avbrottssäker backup-rutin för Docker-volymerna.

## Nästa steg
1. Verifiera Docker Compose på en Docker-värd och dokumentera reverse-proxy-konfiguration för HTTPS.
2. Genomför en återställningsövning på en separat Docker-värd och fastställ rutin för loggövervakning.

## Principer
- Behåll Express, SQLite och statisk vanilla-frontend tills produktens komplexitet motiverar en större förändring.
- Håll affärslogik testbar genom beroendeinjektion och smala moduler.
- Prioritera säkerhet, datahållbarhet och tydliga fel framför nya UI-funktioner.
- Bygg en liten, verifierbar förbättring i taget och kör relevanta tester efter varje ändring.

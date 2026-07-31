# Fortsatt utvecklingsplan

## Klart
- Signerade SQLite-sessioner, lösenordshashning, CSRF-skydd och säkerhetsheaders.
- Validering, felkontrakt, rate limiting och filnamnsnormalisering.
- SQLite-hälsokontroll, strukturerad loggning och kontrollerad avstängning.
- Docker- och Compose-underlag för VPS samt GitHub Actions CI.
- Enhetstester och ett isolerat HTTP-flödestest för inloggning, CSRF och utloggning.

## Nästa steg
1. Slutför HTTP-tester för uppladdning, röstning, borttagning och negativa fall.
2. Förbättra uppladdningen med bildförhandsvisning, klientvalidering av storlek och drag-and-drop.
3. Verifiera Docker Compose på en Docker-värd och dokumentera reverse-proxy-konfiguration för HTTPS.
4. Lägg till små driftsförbättringar vid behov: backup-rutin, återställningsövning och loggövervakning.

## Principer
- Behåll Express, SQLite och statisk vanilla-frontend tills produktens komplexitet motiverar en större förändring.
- Håll affärslogik testbar genom beroendeinjektion och smala moduler.
- Prioritera säkerhet, datahållbarhet och tydliga fel framför nya UI-funktioner.
- Bygg en liten, verifierbar förbättring i taget och kör relevanta tester efter varje ändring.

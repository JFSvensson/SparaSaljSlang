# SparaSaljSlang
Enkel webbapp för att bestämma om ett föremål ska sparas, säljas eller slängas.

## Funktioner
- Bedöm föremål genom att välja mellan Spara, Sälj eller Släng
- Ladda upp bilder av föremål
- Visa alla uppladdade föremål med sammanställda röster
- Ta bort föremål och deras uppladdade bilder
- Enkel inloggning med signerade, SQLite-lagrade sessioner
- CSRF-skydd för inloggning, utloggning, uppladdning, röstning och borttagning
- Säkerhetsheaders och content security policy via Helmet

## Teknisk stack
- Node.js + Express
- TypeScript
- better-sqlite3 för lagring
- Multer för filuppladdningar
- express-session, csrf-sync och Helmet för sessions- och webbsäkerhet

## Installation
1. Installera beroenden:
   ```bash
   npm install
   ```
2. Ställ in miljövariabler för inloggning:
   ```bash
   export LOGIN_USERNAME="din-anvandare"
   export LOGIN_PASSWORD="ditt-losenord"
   ```
3. Starta appen:
   ```bash
   npm run dev
   ```

För att köra den byggda produktionsversionen:
```bash
npm run build
npm start
```

I produktion måste även `SESSION_SECRET` vara satt. Skapa ett långt slumpvärde, till exempel med:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

För produktion, skapa först en lösenordshash:
```bash
npm run hash-password -- "ditt-losenord"
```

Sätt sedan `NODE_ENV=production` och konfigurera `LOGIN_USERNAME`, `LOGIN_PASSWORD_HASH` och `SESSION_SECRET`. Appen vägrar att starta i produktion om någon av dem saknas. `LOGIN_PASSWORD` används endast som lokal utvecklingsfallback och ska inte sättas i produktion.

## Användning
- Öppna appen i webbläsaren på http://localhost:3000
- Logga in med användarnamn och lösenord som ställts in via miljövariabler
- Använd startsidan för att bedöma föremål
- Använd sidan "Alla föremål" för att se och ta bort tidigare uppladdade objekt

## Utveckling
- Bygg projektet med:
  ```bash
  npm run build
  ```
- Kör tester med:
  ```bash
  npm test
  ```

## Struktur
- src/server.ts – server- och autentiseringssetup
- src/routes/items.ts – API-rutter för föremål
- src/services/itemService.ts – affärslogik för föremål
- src/auth.ts – autentiseringshjälp
- src/config.ts – gemensam konfiguration
- src/sessionStore.ts – SQLite-lagring för inloggningssessioner
- public/ – statiska sidor och frontend-skript


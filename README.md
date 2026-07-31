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

## VPS med Docker
1. Installera Docker Engine med Docker Compose på VPS:en.
2. Skapa den faktiska konfigurationsfilen från mallen:
   ```bash
   cp .env.example .env
   ```
3. Ersätt alla platshållarvärden i `.env`. Skapa `LOGIN_PASSWORD_HASH` med `npm run hash-password -- "ditt-losenord"` och skapa `SESSION_SECRET` med kommandot ovan.
4. Bygg och starta appen:
   ```bash
   docker compose up --build -d
   ```
5. Kontrollera status och loggar:
   ```bash
   docker compose ps
   docker compose logs -f app
   curl http://127.0.0.1:3000/api/health
   ```

Compose exponerar appen endast på VPS:ens `127.0.0.1`. Placera en HTTPS-reverse-proxy, till exempel Caddy eller Nginx, framför den. Reverse-proxyn ska terminera TLS och vidarebefordra `X-Forwarded-Proto`; appen kräver HTTPS för sessionskakan när `NODE_ENV=production`.

Exempel för Caddy på VPS:en, där `example.com` ersätts med den riktiga domänen:
```caddyfile
example.com {
   reverse_proxy 127.0.0.1:3000
}
```

Caddy skaffar och förnyar TLS-certifikat automatiskt när domänens DNS pekar på VPS:en och portarna 80 och 443 är öppna. Caddy sätter även nödvändiga vidarebefordrade headers för Express automatiskt.

### Exempel: första deploy på Ubuntu/Debian
Exemplet nedan använder domänen `app.example.com`. Byt den mot den riktiga domänen och skapa en DNS-post av typen `A` som pekar på VPS:ens publika IPv4-adress innan Caddy startas.

Installera Docker, Compose, Git och Caddy på VPS:en:
```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2 git caddy
sudo usermod -aG docker "$USER"
```

Logga in igen så att den nya Docker-gruppen används, klona sedan appen och skapa den privata miljöfilen:
```bash
sudo install -d -m 0750 -o "$USER" -g "$USER" /opt/sparasaljslang
git clone https://github.com/JFSvensson/SparaSaljSlang.git /opt/sparasaljslang
cd /opt/sparasaljslang
cp .env.example .env
chmod 600 .env
nano .env
```

`.env` ska innehålla riktiga värden för `LOGIN_USERNAME`, `LOGIN_PASSWORD_HASH` och `SESSION_SECRET`; lämna inte platshållarvärden från `.env.example`. Bygg och starta därefter appen:
```bash
docker compose up --build -d
docker compose ps
curl http://127.0.0.1:3000/api/health
```

Konfigurera Caddy med den riktiga domänen:
```bash
sudo tee /etc/caddy/Caddyfile >/dev/null <<'EOF'
app.example.com {
   reverse_proxy 127.0.0.1:3000
}
EOF
sudo systemctl reload caddy
```

Öppna enbart SSH, HTTP och HTTPS i VPS:ens brandvägg. Port `3000` ska inte öppnas externt eftersom Compose binder den till `127.0.0.1`.
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Verifiera efter DNS-propagering att TLS och sessionskakor fungerar via den publika domänen:
```bash
curl --fail --show-error https://app.example.com/api/health
```

Vid senare uppdateringar:
```bash
cd /opt/sparasaljslang
git pull --ff-only
docker compose up --build -d
docker image prune -f
```

### Backup
SQLite-databasen och uppladdade bilder ligger i Compose-volymerna `sparasaljslang_app-data` respektive `sparasaljslang_app-uploads`. Kör backupskriptet från projektets rot på VPS:en:
```bash
chmod +x scripts/backup.sh
./scripts/backup.sh
```

Skriptet stoppar appen, skapar en tidsstämplad katalog under `backups/`, arkiverar båda volymerna och startar sedan appen igen, även om backupen avbryts eller misslyckas. Du kan välja en egen målkatalog genom att skicka den som första argument:
```bash
./scripts/backup.sh /var/backups/sparasaljslang/2026-07-31
```

Förvara backupkatalogen på en annan maskin eller lagringstjänst efter att arkiven har skapats. Testa återställning på en separat Docker-värd innan den behövs i produktion.

### Exempel: daglig offsite-backup med rclone
`rclone` kan kopiera backupkatalogen till exempelvis Backblaze B2, S3, OneDrive eller en annan SFTP-server. Installera och konfigurera först en egen fjärrlagring; detta behöver göras interaktivt på VPS:en:
```bash
sudo apt install -y rclone
rclone config
rclone lsd remote:
```

Följande `cron`-rad skapar en backup varje natt kl. 03:15 och kopierar den till en rclone-remote som heter `remote`. Ersätt `remote:sparasaljslang` med den konfigurerade lagringsplatsen:
```cron
15 3 * * * cd /opt/sparasaljslang && ./scripts/backup.sh /var/backups/sparasaljslang/$(date +\%F) && rclone copy /var/backups/sparasaljslang/$(date +\%F) remote:sparasaljslang/$(date +\%F) --checksum >> /var/log/sparasaljslang-backup.log 2>&1
```

Lägg in raden med `crontab -e` för den användare som kör Docker. Använd `rclone copy`, inte `rclone sync`, så att ett felaktigt lokalt kommando inte kan radera äldre offsite-backuper. Kontrollera regelbundet `/var/log/sparasaljslang-backup.log` och återställ minst en backup till en separat Docker-värd.

### Återställningsövning
Kör återställningen först på en separat Docker-värd med samma projektfiler och en giltig `.env`. Skapa tomma volymer genom att starta appen en gång, kopiera backupkatalogen till värden och kör sedan:
```bash
chmod +x scripts/restore.sh
CONFIRM_RESTORE=sparasaljslang ./scripts/restore.sh /sökväg/till/backupkatalog
```

Skriptet kontrollerar att båda arkiven finns, stoppar appen, ersätter innehållet i de beständiga volymerna och startar appen igen. Bekräftelsevariabeln krävs eftersom återställningen ersätter befintlig databas och uppladdade bilder. Verifiera sedan med:
```bash
docker compose ps
curl http://127.0.0.1:3000/api/health
```

Logga in och kontrollera minst ett återställt föremål och dess bild innan proceduren används mot produktion.

## Driftkontroll
Använd `GET /api/health` för en enkel driftkontroll. Ett lyckat svar är:
```json
{ "status": "ok", "database": "ok" }
```

Endpointen returnerar `503` om SQLite inte kan svara på en kontrollfråga.

Appen hanterar `SIGTERM` och `SIGINT` genom att sluta ta emot nya HTTP-anslutningar och stänga SQLite-databasen innan processen avslutas. Det gör omstarter via Docker, systemd eller en VPS mer förutsägbara.

API-förfrågningar och serverhändelser loggas som JSON till standardutdata. Förfrågningsloggar innehåller endast metod, sökväg, status och svarstid; lösenord, cookies, frågesträngar och bilduppgifter loggas inte.

### Loggövervakning
Compose använder Docker-drivrutinen `local` och behåller högst tre loggfiler på 10 MB vardera. Följ senaste loggarna på VPS:en med:
```bash
docker compose logs --tail 100 -f app
```

Undersök händelser med `"level":"error"` eller `"event":"request_failed"` och kontrollera samtidigt containerstatus och hälsa:
```bash
docker compose ps
curl http://127.0.0.1:3000/api/health
```

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
- GitHub Actions-workflowen `CI` kör `npm ci`, bygg och tester automatiskt vid push till `main` och för varje pull request.

## Struktur
- src/server.ts – server- och autentiseringssetup
- src/routes/items.ts – API-rutter för föremål
- src/services/itemService.ts – affärslogik för föremål
- src/auth.ts – autentiseringshjälp
- src/config.ts – gemensam konfiguration
- src/sessionStore.ts – SQLite-lagring för inloggningssessioner
- public/ – statiska sidor och frontend-skript


import express from 'express';
import path from 'path';
import session from 'express-session';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import itemsRouter from './routes/items';
import { config, validateConfig } from './config';
import { authenticateUser, createPasswordHash, verifyPassword } from './auth';
import { closeDatabase, isDatabaseAvailable, votersDb } from './db';
import { isValidPassword, isValidUsername } from './validation';
import { toPublicError } from './errors';
import { SqliteSessionStore } from './sessionStore';
import { csrfSynchronisedProtection, generateToken } from './csrf';
import { closeResources } from './shutdown';
import { createLogger } from './logger';
import { timingSafeEqual } from 'crypto';

validateConfig();
const app = express();
const PORT = config.port;
const sessionCookieName = 'sparasaljslang.sid';
const logger = createLogger();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      upgradeInsecureRequests: config.isProduction ? [] : null,
    },
  },
}));
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  const startedAt = Date.now();
  res.on('finish', () => {
    logger.info('http_request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: Date.now() - startedAt,
    });
  });
  return next();
});
if (config.isProduction) {
  app.set('trust proxy', 1);
}
app.use(session({
  name: sessionCookieName,
  store: new SqliteSessionStore(),
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    maxAge: config.sessionMaxAgeMs,
  },
}));

function isAuthenticated(req: express.Request): boolean {
  return req.session.isAuthenticated === true && typeof req.session.voterId === 'string';
}

// Rate limiting for API routes (protects file-system access)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

app.use((req, res, next) => {
  const pathname = req.path;
  const isStaticAsset = /\.(css|js|png|jpe?g|gif|svg|ico|webp|map)$/i.test(pathname);
  const isAllowedPath =
    pathname === '/login' ||
    pathname === '/login.html' ||
    pathname === '/register' ||
    pathname === '/register.html' ||
    pathname === '/api/login' ||
    pathname === '/api/register' ||
    pathname === '/api/auth-options' ||
    pathname === '/api/logout' ||
    pathname === '/api/csrf-token' ||
    pathname === '/api/health' ||
    pathname.startsWith('/uploads/');

  if (isAllowedPath || isStaticAsset || pathname === '/favicon.ico') {
    return next();
  }

  if (isAuthenticated(req)) {
    return next();
  }

  if (pathname.startsWith('/api/')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  if (req.accepts('html')) {
    return res.redirect('/login.html');
  }

  return res.status(401).json({ error: 'Authentication required.' });
});

app.get('/login', (_req, res) => {
  res.redirect('/login.html');
});

app.get('/api/csrf-token', (req, res) => {
  res.json({ token: generateToken(req) });
});

app.get('/api/auth-options', (_req, res) => {
  res.json({ registration_enabled: Boolean(config.registrationInviteCode) });
});

app.use(csrfSynchronisedProtection);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'För många inloggningsförsök. Försök igen senare.' },
});

app.post('/api/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  const voter = username ? votersDb.getByUsername(username) : undefined;
  const authenticated = voter
    ? await verifyPassword(password ?? '', voter.password_hash)
    : await authenticateUser(username, password);

  if (!authenticated) {
    return res.status(401).json({ error: 'Fel användarnamn eller lösenord.' });
  }

  req.session.regenerate((error) => {
    if (error) {
      return res.status(500).json({ error: 'Could not create session.' });
    }

    req.session.voterId = voter?.id ?? `admin:${config.loginUsername.toLocaleLowerCase('en-US')}`;
    req.session.isAdministrator = !voter;
    req.session.isAuthenticated = true;
    return req.session.save((saveError) => {
      if (saveError) {
        return res.status(500).json({ error: 'Could not save session.' });
      }
      return res.json({ ok: true });
    });
  });
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'För många registreringsförsök. Försök igen senare.' },
});

app.post('/api/register', registrationLimiter, async (req, res) => {
  const { username, password, inviteCode } = req.body as {
    username?: unknown;
    password?: unknown;
    inviteCode?: unknown;
  };
  if (!config.registrationInviteCode) {
    return res.status(503).json({ error: 'Registrering är inte aktiverad.' });
  }
  if (
    typeof inviteCode !== 'string'
    || !constantTimeStringEqual(inviteCode, config.registrationInviteCode)
  ) {
    return res.status(403).json({ error: 'Ogiltig inbjudningskod.' });
  }
  if (!isValidUsername(username)) {
    return res.status(400).json({ error: 'Användarnamnet ska vara 3–32 tecken: bokstäver, siffror, _ eller -.' });
  }
  if (!isValidPassword(password)) {
    return res.status(400).json({ error: 'Lösenordet ska vara 12–128 tecken.' });
  }
  if (username.toLocaleLowerCase('en-US') === config.loginUsername.toLocaleLowerCase('en-US')) {
    return res.status(409).json({ error: 'Användarnamnet är redan upptaget.' });
  }
  if (votersDb.getByUsername(username)) {
    return res.status(409).json({ error: 'Användarnamnet är redan upptaget.' });
  }

  const voter = votersDb.create(username, createPasswordHash(password));
  req.session.regenerate((error) => {
    if (error) {
      return res.status(500).json({ error: 'Could not create session.' });
    }
    req.session.voterId = voter.id;
    req.session.isAdministrator = false;
    req.session.isAuthenticated = true;
    return req.session.save((saveError) => {
      if (saveError) {
        return res.status(500).json({ error: 'Could not save session.' });
      }
      return res.status(201).json({ ok: true });
    });
  });
});

app.get('/api/session', (req, res) => {
  res.json({ is_administrator: req.session.isAdministrator === true });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ error: 'Could not end session.' });
    }
    res.clearCookie(sessionCookieName, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProduction,
      path: '/',
    });
    return res.json({ ok: true });
  });
});

app.get('/api/health', (_req, res) => {
  if (!isDatabaseAvailable()) {
    return res.status(503).json({ status: 'unavailable', database: 'unavailable' });
  }

  return res.json({ status: 'ok', database: 'ok' });
});

// Serve uploaded images
app.use('/uploads', express.static(config.uploadsDir));

// Serve static frontend files
app.use(express.static(config.publicDir));

// API routes
app.use('/api/items', apiLimiter, itemsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const publicError = toPublicError(err);
  if (publicError.status >= 500) {
    logger.error('request_failed', {
      status: publicError.status,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
  res.status(publicError.status).json(publicError.body);
});

function constantTimeStringEqual(first: string, second: string): boolean {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);
  return firstBuffer.length === secondBuffer.length && timingSafeEqual(firstBuffer, secondBuffer);
}

const server = app.listen(PORT, () => {
  logger.info('server_started', { port: PORT });
});

let shutdownStarted = false;

function shutdown(signal: NodeJS.Signals): void {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;
  logger.info('shutdown_started', { signal });

  const shutdownTimeout = setTimeout(() => {
    logger.error('shutdown_timed_out');
    process.exit(1);
  }, 10_000);
  shutdownTimeout.unref();

  void closeResources(server, closeDatabase)
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      logger.error('shutdown_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      process.exit(1);
    });
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

export default app;

import express from 'express';
import path from 'path';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import itemsRouter from './routes/items';
import { config, validateConfig } from './config';
import { authenticateUser } from './auth';
import { toPublicError } from './errors';
import { SqliteSessionStore } from './sessionStore';

validateConfig();
const app = express();
const PORT = config.port;
const sessionCookieName = 'sparasaljslang.sid';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
  return req.session.isAuthenticated === true;
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
    pathname === '/api/login' ||
    pathname === '/api/logout' ||
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

app.post('/api/login', (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!authenticateUser(username, password)) {
    return res.status(401).json({ error: 'Fel användarnamn eller lösenord.' });
  }

  req.session.regenerate((error) => {
    if (error) {
      return res.status(500).json({ error: 'Could not create session.' });
    }

    req.session.isAuthenticated = true;
    return req.session.save((saveError) => {
      if (saveError) {
        return res.status(500).json({ error: 'Could not save session.' });
      }
      return res.json({ ok: true });
    });
  });
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
  res.json({ status: 'ok' });
});

// Serve uploaded images
app.use('/uploads', express.static(config.uploadsDir));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api/items', apiLimiter, itemsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const publicError = toPublicError(err);
  res.status(publicError.status).json(publicError.body);
});

app.listen(PORT, () => {
  console.log(`SparaSäljSlang running at http://localhost:${PORT}`);
});

export default app;

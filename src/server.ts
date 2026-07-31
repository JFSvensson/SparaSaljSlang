import express from 'express';
import path from 'path';
import rateLimit from 'express-rate-limit';
import itemsRouter from './routes/items';
import { config } from './config';
import { authenticateUser } from './auth';

const app = express();
const PORT = config.port;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function isAuthenticated(req: express.Request): boolean {
  const cookieValue = req.headers.cookie
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('auth_session='))
    ?.split('=')
    .slice(1)
    .join('=');

  return cookieValue === 'true';
}

// Rate limiting for API routes (protects file-system access)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Upload limit reached, please try again later.' },
});

app.use((req, res, next) => {
  const pathname = req.path;
  const isStaticAsset = /\.(css|js|png|jpe?g|gif|svg|ico|webp|map)$/i.test(pathname);
  const isAllowedPath =
    pathname === '/login' ||
    pathname === '/login.html' ||
    pathname === '/api/login' ||
    pathname === '/api/logout' ||
    pathname.startsWith('/uploads/');

  if (isAllowedPath || isStaticAsset || pathname === '/favicon.ico') {
    return next();
  }

  if (isAuthenticated(req)) {
    return next();
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

  if (authenticateUser(username, password)) {
    res.cookie('auth_session', 'true', {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 8 * 1000,
      path: '/',
    });
    return res.json({ ok: true });
  }

  return res.status(401).json({ error: 'Fel användarnamn eller lösenord.' });
});

app.post('/api/logout', (_req, res) => {
  res.clearCookie('auth_session', { path: '/' });
  return res.json({ ok: true });
});

// Serve uploaded images
app.use('/uploads', express.static(config.uploadsDir));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api/items', apiLimiter, itemsRouter);

// Stricter rate limit on upload endpoint
app.use('/api/items', uploadLimiter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`SparaSäljSlang running at http://localhost:${PORT}`);
});

export default app;

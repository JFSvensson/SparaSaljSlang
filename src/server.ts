import express from 'express';
import path from 'path';
import rateLimit from 'express-rate-limit';
import itemsRouter from './routes/items';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api/items', apiLimiter, itemsRouter);

// Stricter rate limit on upload endpoint
app.use('/api/items', uploadLimiter);

app.listen(PORT, () => {
  console.log(`SparaSäljSlang running at http://localhost:${PORT}`);
});

export default app;

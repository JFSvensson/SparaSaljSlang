import { Router, Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { itemsDb, choicesDb } from '../db';

const router = Router();

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename(_req, file, cb) {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, png, gif, webp)'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// GET /api/items — list all items with choice counts
router.get('/', (_req: Request, res: Response) => {
  const items = itemsDb.getAll();
  res.json(items);
});

// GET /api/items/:id — get a single item
router.get('/:id', (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const item = itemsDb.getById(id);
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }
  const counts = choicesDb.getCounts(id);
  res.json({ ...item, ...counts });
});

// POST /api/items — upload a new item
router.post(
  '/',
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('image')(req, res, (err: unknown) => {
      if (err) {
        const message =
          err instanceof Error ? err.message : 'Upload failed';
        res.status(400).json({ error: message });
        return;
      }
      next();
    });
  },
  (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided' });
      return;
    }
    const item = itemsDb.create(req.file.filename, req.file.originalname);
    res.status(201).json(item);
  }
);

// DELETE /api/items/:id — delete an item
router.delete('/:id', (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const item = itemsDb.getById(id);
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }
  const filePath = path.join(UPLOADS_DIR, item.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  itemsDb.delete(id);
  res.json({ message: 'Item deleted' });
});

// GET /api/items/:id/choices — get choices for an item
router.get('/:id/choices', (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const item = itemsDb.getById(id);
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }
  const choices = choicesDb.getByItemId(id);
  const counts = choicesDb.getCounts(id);
  res.json({ choices, counts });
});

// POST /api/items/:id/choices — submit a choice for an item
router.post('/:id/choices', (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const item = itemsDb.getById(id);
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }
  const { choice } = req.body as { choice: string };
  if (!choice || !['save', 'sell', 'throw'].includes(choice)) {
    res.status(400).json({ error: 'Choice must be one of: save, sell, throw' });
    return;
  }
  const saved = choicesDb.create(id, choice as 'save' | 'sell' | 'throw');
  const counts = choicesDb.getCounts(id);
  res.status(201).json({ choice: saved, counts });
});

export default router;

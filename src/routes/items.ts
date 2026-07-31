import { Router, Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import fs from 'fs';
import path from 'path';
import { ItemService } from '../services/itemService';
import { config } from '../config';
import { isAllowedChoice, isAllowedImageMimeType, parsePositiveInt } from '../validation';
import { HttpError } from '../errors';

const router = Router();
const itemService = new ItemService();

if (!fs.existsSync(config.uploadsDir)) {
  fs.mkdirSync(config.uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, config.uploadsDir);
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
  if (isAllowedImageMimeType(file.mimetype)) {
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
  const items = itemService.listItems();
  res.json(items);
});

// GET /api/items/:id — get a single item
router.get('/:id', (req: Request, res: Response) => {
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parsePositiveInt(idParam);
  if (id === null) {
    throw new HttpError(400, 'Invalid id');
  }
  const item = itemService.getItem(id);
  if (!item) {
    throw new HttpError(404, 'Item not found');
  }
  res.json(item);
});

// POST /api/items — upload a new item
router.post(
  '/',
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('image')(req, res, (err: unknown) => {
      if (err) {
        next(new HttpError(400, err instanceof Error ? err.message : 'Upload failed'));
        return;
      }
      next();
    });
  },
  (req: Request, res: Response) => {
    if (!req.file) {
      throw new HttpError(400, 'No image file provided');
    }
    const item = itemService.createItem(req.file.filename, req.file.originalname);
    res.status(201).json(item);
  }
);

// DELETE /api/items/:id — delete an item
router.delete('/:id', (req: Request, res: Response) => {
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parsePositiveInt(idParam);
  if (id === null) {
    throw new HttpError(400, 'Invalid id');
  }

  try {
    itemService.deleteItem(id);
    res.json({ message: 'Item deleted' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Item not found';
    throw new HttpError(404, message);
  }
});

// GET /api/items/:id/choices — get choices for an item
router.get('/:id/choices', (req: Request, res: Response) => {
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parsePositiveInt(idParam);
  if (id === null) {
    throw new HttpError(400, 'Invalid id');
  }
  const result = itemService.getChoices(id);
  if (!result) {
    throw new HttpError(404, 'Item not found');
  }
  res.json(result);
});

// POST /api/items/:id/choices — submit a choice for an item
router.post('/:id/choices', (req: Request, res: Response) => {
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parsePositiveInt(idParam);
  if (id === null) {
    throw new HttpError(400, 'Invalid id');
  }
  const { choice } = req.body as { choice: string };
  if (!isAllowedChoice(choice)) {
    throw new HttpError(400, 'Choice must be one of: save, sell, throw');
  }
  const result = itemService.submitChoice(id, choice as 'save' | 'sell' | 'throw');
  if (!result) {
    throw new HttpError(404, 'Item not found');
  }
  res.status(201).json({ choice: result.choice, counts: result.counts });
});

export default router;

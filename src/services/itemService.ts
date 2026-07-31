import fs from 'fs';
import path from 'path';
import { itemsDb, choicesDb } from '../db';
import { config } from '../config';

export interface ItemSummary {
  id: number;
  filename: string;
  original_name: string;
  created_at: string;
  save_count: number;
  sell_count: number;
  throw_count: number;
}

export class ItemService {
  constructor(private readonly uploadsDir: string = config.uploadsDir) {}

  listItems(): ItemSummary[] {
    return itemsDb.getAll();
  }

  getItem(id: number) {
    const item = itemsDb.getById(id);
    if (!item) {
      return null;
    }

    const counts = choicesDb.getCounts(id);
    return { ...item, ...counts };
  }

  createItem(filename: string, originalName: string) {
    return itemsDb.create(filename, originalName);
  }

  deleteItem(id: number): void {
    const item = itemsDb.getById(id);
    if (!item) {
      throw new Error('Item not found');
    }

    const filePath = path.join(this.uploadsDir, item.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    itemsDb.delete(id);
  }

  getChoices(id: number) {
    const item = itemsDb.getById(id);
    if (!item) {
      return null;
    }

    return {
      choices: choicesDb.getByItemId(id),
      counts: choicesDb.getCounts(id),
    };
  }

  submitChoice(id: number, choice: 'save' | 'sell' | 'throw') {
    const item = itemsDb.getById(id);
    if (!item) {
      return null;
    }

    const saved = choicesDb.create(id, choice);
    const counts = choicesDb.getCounts(id);
    return { choice: saved, counts };
  }
}

import fs from 'fs';
import path from 'path';
import { Choice, Item, ItemWithChoices, itemsDb, choicesDb } from '../db';
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

export interface ItemRepository {
  create(filename: string, originalName: string): Item;
  getAll(): ItemWithChoices[];
  getById(id: number): Item | undefined;
  delete(id: number): void;
}

export interface ChoiceRepository {
  create(itemId: number, choice: 'save' | 'sell' | 'throw'): Choice;
  getByItemId(itemId: number): Choice[];
  getCounts(itemId: number): { save: number; sell: number; throw: number };
}

export interface FileSystem {
  existsSync(path: string): boolean;
  unlinkSync(path: string): void;
}

export class ItemService {
  constructor(
    private readonly uploadsDir: string = config.uploadsDir,
    private readonly itemRepository: ItemRepository = itemsDb,
    private readonly choiceRepository: ChoiceRepository = choicesDb,
    private readonly fileSystem: FileSystem = fs
  ) {}

  listItems(): ItemSummary[] {
    return this.itemRepository.getAll();
  }

  getItem(id: number) {
    const item = this.itemRepository.getById(id);
    if (!item) {
      return null;
    }

    const counts = this.choiceRepository.getCounts(id);
    return { ...item, ...counts };
  }

  createItem(filename: string, originalName: string) {
    return this.itemRepository.create(filename, originalName);
  }

  deleteItem(id: number): void {
    const item = this.itemRepository.getById(id);
    if (!item) {
      throw new Error('Item not found');
    }

    const filePath = path.join(this.uploadsDir, item.filename);
    if (this.fileSystem.existsSync(filePath)) {
      this.fileSystem.unlinkSync(filePath);
    }

    this.itemRepository.delete(id);
  }

  getChoices(id: number) {
    const item = this.itemRepository.getById(id);
    if (!item) {
      return null;
    }

    return {
      choices: this.choiceRepository.getByItemId(id),
      counts: this.choiceRepository.getCounts(id),
    };
  }

  submitChoice(id: number, choice: 'save' | 'sell' | 'throw') {
    const item = this.itemRepository.getById(id);
    if (!item) {
      return null;
    }

    const saved = this.choiceRepository.create(id, choice);
    const counts = this.choiceRepository.getCounts(id);
    return { choice: saved, counts };
  }
}

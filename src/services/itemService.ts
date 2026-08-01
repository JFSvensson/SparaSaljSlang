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

export interface DecisionSummary {
  total_items: number;
  total_votes: number;
  save_items: number;
  sell_items: number;
  throw_items: number;
  tied_items: number;
  undecided_items: number;
}

export interface BulkDeleteResult {
  deleted_ids: number[];
  missing_ids: number[];
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

  getDecisionSummary(): DecisionSummary {
    return this.listItems().reduce<DecisionSummary>((summary, item) => {
      const voteTotal = item.save_count + item.sell_count + item.throw_count;
      summary.total_items += 1;
      summary.total_votes += voteTotal;

      if (voteTotal === 0) {
        summary.undecided_items += 1;
        return summary;
      }

      const highestCount = Math.max(item.save_count, item.sell_count, item.throw_count);
      const leaderCount = [item.save_count, item.sell_count, item.throw_count]
        .filter((count) => count === highestCount)
        .length;

      if (leaderCount > 1) {
        summary.tied_items += 1;
      } else if (item.save_count === highestCount) {
        summary.save_items += 1;
      } else if (item.sell_count === highestCount) {
        summary.sell_items += 1;
      } else {
        summary.throw_items += 1;
      }

      return summary;
    }, {
      total_items: 0,
      total_votes: 0,
      save_items: 0,
      sell_items: 0,
      throw_items: 0,
      tied_items: 0,
      undecided_items: 0,
    });
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

  deleteItems(ids: number[]): BulkDeleteResult {
    const deletedIds: number[] = [];
    const missingIds: number[] = [];

    ids.forEach((id) => {
      const item = this.itemRepository.getById(id);
      if (!item) {
        missingIds.push(id);
        return;
      }

      const filePath = path.join(this.uploadsDir, item.filename);
      if (this.fileSystem.existsSync(filePath)) {
        this.fileSystem.unlinkSync(filePath);
      }

      this.itemRepository.delete(id);
      deletedIds.push(id);
    });

    return {
      deleted_ids: deletedIds,
      missing_ids: missingIds,
    };
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

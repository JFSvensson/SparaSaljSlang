import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { Choice, Item } from '../src/db';
import { ChoiceRepository, FileSystem, ItemRepository, ItemService } from '../src/services/itemService';

const item: Item = {
  id: 1,
  filename: 'stored-image.png',
  original_name: 'display-image.png',
  created_at: '2026-07-31 12:00:00',
};

function createItemRepository(currentItem: Item | undefined = item): ItemRepository {
  return {
    create(filename, originalName) {
      return { ...item, filename, original_name: originalName };
    },
    getAll() {
      return currentItem ? [{ ...currentItem, save_count: 0, sell_count: 0, throw_count: 0 }] : [];
    },
    getById(id) {
      return currentItem?.id === id ? currentItem : undefined;
    },
    delete() {},
  };
}

function createChoiceRepository(counts = { save: 0, sell: 0, throw: 0 }): ChoiceRepository {
  return {
    create(itemId, choice) {
      return { id: 1, item_id: itemId, choice, created_at: '2026-07-31 12:00:00' } as Choice;
    },
    getByItemId() {
      return [];
    },
    getCounts() {
      return counts;
    },
  };
}

test('ItemService creates items through its repository', () => {
  const service = new ItemService('/uploads', createItemRepository(), createChoiceRepository(), noFiles());

  assert.deepEqual(service.createItem('server.png', 'clean-name.png'), {
    ...item,
    filename: 'server.png',
    original_name: 'clean-name.png',
  });
});

test('ItemService saves a choice and returns updated counts', () => {
  const service = new ItemService(
    '/uploads',
    createItemRepository(),
    createChoiceRepository({ save: 1, sell: 0, throw: 0 }),
    noFiles()
  );

  assert.deepEqual(service.submitChoice(1, 'save')?.counts, { save: 1, sell: 0, throw: 0 });
  assert.equal(service.submitChoice(99, 'save'), null);
});

test('ItemService deletes the matching image file before deleting its record', () => {
  const events: string[] = [];
  const itemRepository = createItemRepository();
  itemRepository.delete = () => events.push('delete-record');
  const fileSystem: FileSystem = {
    existsSync: () => true,
    unlinkSync: (filePath) => events.push(`delete-file:${filePath}`),
  };
  const service = new ItemService('/uploads', itemRepository, createChoiceRepository(), fileSystem);

  service.deleteItem(1);

  assert.deepEqual(events, [`delete-file:${path.join('/uploads', 'stored-image.png')}`, 'delete-record']);
  assert.throws(() => service.deleteItem(99), /Item not found/);
});

test('ItemService summarizes items, votes, and current leading decisions', () => {
  const itemRepository = createItemRepository();
  itemRepository.getAll = () => [
    { ...item, id: 1, save_count: 3, sell_count: 1, throw_count: 0 },
    { ...item, id: 2, save_count: 1, sell_count: 4, throw_count: 1 },
    { ...item, id: 3, save_count: 1, sell_count: 1, throw_count: 1 },
    { ...item, id: 4, save_count: 0, sell_count: 0, throw_count: 0 },
    { ...item, id: 5, save_count: 0, sell_count: 0, throw_count: 2 },
  ];
  const service = new ItemService('/uploads', itemRepository, createChoiceRepository(), noFiles());

  assert.deepEqual(service.getDecisionSummary(), {
    total_items: 5,
    total_votes: 15,
    save_items: 1,
    sell_items: 1,
    throw_items: 1,
    tied_items: 1,
    undecided_items: 1,
  });
});

function noFiles(): FileSystem {
  return {
    existsSync: () => false,
    unlinkSync() {},
  };
}
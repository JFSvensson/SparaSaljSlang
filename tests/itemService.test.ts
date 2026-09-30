import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { Choice, Item, ListingDraft } from '../src/db';
import {
  ChoiceRepository,
  FileSystem,
  ItemRepository,
  ItemService,
  ListingDraftRepository,
} from '../src/services/itemService';

const item: Item = {
  id: 1,
  filename: 'stored-image.png',
  original_name: 'display-image.png',
  created_at: '2026-07-31 12:00:00',
  required_votes: 2,
  sell_direct: 0,
  voting_round: 1,
};

function createItemRepository(currentItem: Item | undefined = item): ItemRepository {
  let activeItem = currentItem;
  return {
    create(filename, originalName) {
      return { ...item, filename, original_name: originalName };
    },
    getAll() {
      return activeItem ? [{
        ...activeItem,
        save_count: 0,
        sell_count: 0,
        throw_count: 0,
        voter_count: 0,
        sell_voter_count: 0,
      }] : [];
    },
    getById(id) {
      return activeItem?.id === id ? activeItem : undefined;
    },
    delete() {},
    startNewVotingRound(id) {
      if (activeItem?.id === id) {
        activeItem = { ...activeItem, voting_round: activeItem.voting_round + 1 };
      }
    },
  };
}

function createChoiceRepository(counts = { save: 0, sell: 0, throw: 0 }): ChoiceRepository {
  return {
    create(itemId, choice, voterId, votingRound) {
      return {
        id: 1,
        item_id: itemId,
        choice,
        voter_id: voterId,
        voting_round: votingRound,
        created_at: '2026-07-31 12:00:00',
      };
    },
    getByItemId() {
      return [];
    },
    getCounts() {
      return counts;
    },
    getVoterStats() {
      return { voter_count: 0, sell_voter_count: 0 };
    },
    getChoiceByVoter() {
      return undefined;
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

test('ItemService creates a draft only after the required distinct voters unanimously choose sell', () => {
  const votes: Choice[] = [];
  const choiceRepository: ChoiceRepository = {
    ...createChoiceRepository(),
    create(itemId, choice, voterId, votingRound) {
      const saved = {
        id: votes.length + 1,
        item_id: itemId,
        choice,
        voter_id: voterId,
        voting_round: votingRound,
        created_at: '2026-07-31 12:00:00',
      };
      votes.push(saved);
      return saved;
    },
    getCounts(_itemId, votingRound) {
      return {
        save: votes.filter((vote) => vote.voting_round === votingRound && vote.choice === 'save').length,
        sell: votes.filter((vote) => vote.voting_round === votingRound && vote.choice === 'sell').length,
        throw: votes.filter((vote) => vote.voting_round === votingRound && vote.choice === 'throw').length,
      };
    },
    getVoterStats(_itemId, votingRound) {
      return {
        voter_count: votes.filter((vote) => vote.voting_round === votingRound).length,
        sell_voter_count: votes.filter((vote) => vote.voting_round === votingRound && vote.choice === 'sell').length,
      };
    },
    getChoiceByVoter(itemId, voterId, votingRound) {
      return votes.find((vote) => (
        vote.item_id === itemId
        && vote.voter_id === voterId
        && vote.voting_round === votingRound
      ));
    },
  };
  const listingDraft: ListingDraft = {
    id: 1,
    item_id: 1,
    title: 'display-image',
    description: '',
    price: null,
    condition: '',
    marketplace: 'other',
    marketplace_name: '',
    created_at: '2026-07-31 12:00:00',
    filename: 'stored-image.png',
    original_name: 'display-image.png',
    is_complete: false,
  };
  let draftsCreated = 0;
  const listingDraftRepository: ListingDraftRepository = {
    ensureForItem() {
      draftsCreated += 1;
      return listingDraft;
    },
  };
  const service = new ItemService(
    '/uploads',
    createItemRepository(),
    choiceRepository,
    noFiles(),
    listingDraftRepository
  );

  const firstVote = service.submitChoice(1, 'sell', 'voter-1');
  assert.equal(firstVote?.status, 'submitted');
  assert.equal(firstVote?.status === 'submitted' && firstVote.sell_ready, false);
  assert.equal(draftsCreated, 0);

  const secondVote = service.submitChoice(1, 'sell', 'voter-2');
  assert.equal(secondVote?.status, 'submitted');
  assert.equal(secondVote?.status === 'submitted' ? secondVote.sell_ready : undefined, true);
  assert.deepEqual(secondVote?.status === 'submitted' ? secondVote.listing_draft : undefined, listingDraft);
  assert.equal(draftsCreated, 1);
  assert.equal(service.submitChoice(1, 'sell', 'voter-1')?.status, 'already-voted');
  assert.equal(service.submitChoice(1, 'sell', 'voter-3')?.status, 'voting-closed');
});

test('ItemService resets only a completed non-unanimous vote and retains previous rounds', () => {
  let activeItem = { ...item, voting_round: 1 };
  const itemRepository = createItemRepository(activeItem);
  itemRepository.getById = (id) => id === activeItem.id ? activeItem : undefined;
  itemRepository.startNewVotingRound = (id) => {
    if (id === activeItem.id) {
      activeItem = { ...activeItem, voting_round: activeItem.voting_round + 1 };
    }
  };
  const votes: Choice[] = [
    {
      id: 1,
      item_id: 1,
      choice: 'sell',
      voter_id: 'voter-1',
      voting_round: 1,
      created_at: '2026-07-31 12:00:00',
    },
    {
      id: 2,
      item_id: 1,
      choice: 'save',
      voter_id: 'voter-2',
      voting_round: 1,
      created_at: '2026-07-31 12:01:00',
    },
  ];
  const choiceRepository: ChoiceRepository = {
    create(itemId, choice, voterId, votingRound) {
      const saved = {
        id: votes.length + 1,
        item_id: itemId,
        choice,
        voter_id: voterId,
        voting_round: votingRound,
        created_at: '2026-07-31 12:02:00',
      };
      votes.push(saved);
      return saved;
    },
    getByItemId(itemId, votingRound) {
      return votes.filter((vote) => vote.item_id === itemId && vote.voting_round === votingRound);
    },
    getCounts(itemId, votingRound) {
      const roundVotes = this.getByItemId(itemId, votingRound);
      return {
        save: roundVotes.filter((vote) => vote.choice === 'save').length,
        sell: roundVotes.filter((vote) => vote.choice === 'sell').length,
        throw: roundVotes.filter((vote) => vote.choice === 'throw').length,
      };
    },
    getVoterStats(itemId, votingRound) {
      const roundVotes = this.getByItemId(itemId, votingRound);
      return {
        voter_count: roundVotes.length,
        sell_voter_count: roundVotes.filter((vote) => vote.choice === 'sell').length,
      };
    },
    getChoiceByVoter(itemId, voterId, votingRound) {
      return votes.find((vote) => (
        vote.item_id === itemId
        && vote.voter_id === voterId
        && vote.voting_round === votingRound
      ));
    },
  };
  const service = new ItemService(
    '/uploads',
    itemRepository,
    choiceRepository,
    noFiles(),
    { ensureForItem: () => undefined }
  );

  assert.equal(service.getItem(1)?.save, 1);
  const resetResult = service.resetVoting(1);
  assert.equal(resetResult?.reset, true);
  assert.equal(resetResult?.item?.voting_round, 2);
  assert.equal(resetResult?.item?.save, 0);
  assert.equal(votes.length, 2);

  const firstNewRoundVote = service.submitChoice(1, 'sell', 'voter-1');
  assert.equal(firstNewRoundVote?.status, 'submitted');
  assert.equal(firstNewRoundVote?.status === 'submitted' ? firstNewRoundVote.voter_count : undefined, 1);
  assert.equal(votes.length, 3);
});

test('ItemService saves a choice and returns updated counts', () => {
  const service = new ItemService(
    '/uploads',
    createItemRepository(),
    createChoiceRepository({ save: 1, sell: 0, throw: 0 }),
    noFiles()
  );

  assert.deepEqual(service.submitChoice(1, 'save', 'voter-1')?.counts, { save: 1, sell: 0, throw: 0 });
  assert.equal(service.submitChoice(99, 'save', 'voter-1'), null);
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
    { ...item, id: 1, save_count: 3, sell_count: 1, throw_count: 0, voter_count: 4, sell_voter_count: 1 },
    { ...item, id: 2, save_count: 1, sell_count: 4, throw_count: 1, voter_count: 6, sell_voter_count: 4 },
    { ...item, id: 3, save_count: 1, sell_count: 1, throw_count: 1, voter_count: 3, sell_voter_count: 1 },
    { ...item, id: 4, save_count: 0, sell_count: 0, throw_count: 0, voter_count: 0, sell_voter_count: 0 },
    { ...item, id: 5, save_count: 0, sell_count: 0, throw_count: 2, voter_count: 2, sell_voter_count: 0 },
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

test('ItemService bulk-deletes existing items and reports missing IDs', () => {
  const events: string[] = [];
  const itemsById = new Map<number, Item>([
    [1, { ...item, id: 1, filename: 'first.png' }],
    [2, { ...item, id: 2, filename: 'second.png' }],
  ]);
  const itemRepository: ItemRepository = {
    ...createItemRepository(),
    getById(id) {
      return itemsById.get(id);
    },
    delete(id) {
      itemsById.delete(id);
      events.push(`delete-record:${id}`);
    },
  };
  const fileSystem: FileSystem = {
    existsSync: () => true,
    unlinkSync(filePath) {
      events.push(`delete-file:${filePath}`);
    },
  };
  const service = new ItemService('/uploads', itemRepository, createChoiceRepository(), fileSystem);

  const result = service.deleteItems([2, 3, 1]);

  assert.deepEqual(result, {
    deleted_ids: [2, 1],
    missing_ids: [3],
  });
  assert.deepEqual(events, [
    `delete-file:${path.join('/uploads', 'second.png')}`,
    'delete-record:2',
    `delete-file:${path.join('/uploads', 'first.png')}`,
    'delete-record:1',
  ]);
});

function noFiles(): FileSystem {
  return {
    existsSync: () => false,
    unlinkSync() {},
  };
}
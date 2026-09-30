import fs from 'fs';
import path from 'path';
import {
  Choice,
  Item,
  ItemWithChoices,
  ListingDraft,
  itemsDb,
  choicesDb,
  listingDraftsDb,
} from '../db';
import { config } from '../config';

export interface ItemSummary {
  id: number;
  filename: string;
  original_name: string;
  created_at: string;
  save_count: number;
  sell_count: number;
  throw_count: number;
  required_votes: number;
  sell_direct: number;
  voter_count: number;
  sell_voter_count: number;
  sell_ready: boolean;
  voting_round: number;
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
  create(filename: string, originalName: string, requiredVotes: number): Item;
  getAll(): ItemWithChoices[];
  getById(id: number): Item | undefined;
  delete(id: number): void;
  startNewVotingRound(id: number): void;
}

export interface ChoiceRepository {
  create(itemId: number, choice: 'save' | 'sell' | 'throw', voterId: string, votingRound: number): Choice;
  getByItemId(itemId: number, votingRound: number): Choice[];
  getCounts(itemId: number, votingRound: number): { save: number; sell: number; throw: number };
  getVoterStats(itemId: number, votingRound: number): { voter_count: number; sell_voter_count: number };
  getChoiceByVoter(itemId: number, voterId: string, votingRound: number): Choice | undefined;
}

export interface ListingDraftRepository {
  ensureForItem(itemId: number, directSale?: boolean): ListingDraft | undefined;
}

export type ChoiceSubmissionResult =
  | {
    status: 'already-voted';
    choice: Choice;
    counts: { save: number; sell: number; throw: number };
    voter_count: number;
    sell_voter_count: number;
    required_votes: number;
  }
  | {
    status: 'voting-closed';
    counts: { save: number; sell: number; throw: number };
  }
  | {
    status: 'submitted';
    choice: Choice;
    counts: { save: number; sell: number; throw: number };
    voter_count: number;
    sell_voter_count: number;
    required_votes: number;
    sell_ready: boolean;
    listing_draft?: ListingDraft;
  };

export interface FileSystem {
  existsSync(path: string): boolean;
  unlinkSync(path: string): void;
}

export class ItemService {
  constructor(
    private readonly uploadsDir: string = config.uploadsDir,
    private readonly itemRepository: ItemRepository = itemsDb,
    private readonly choiceRepository: ChoiceRepository = choicesDb,
    private readonly fileSystem: FileSystem = fs,
    private readonly listingDraftRepository: ListingDraftRepository = listingDraftsDb
  ) {}

  listItems(): ItemSummary[] {
    return this.itemRepository.getAll().map((item) => ({
      ...item,
      sell_ready: item.sell_direct === 1
        || (item.voter_count >= item.required_votes && item.sell_voter_count === item.required_votes),
    }));
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

  getItem(id: number, voterId?: string) {
    const item = this.itemRepository.getById(id);
    if (!item) {
      return null;
    }

    const counts = this.choiceRepository.getCounts(id, item.voting_round);
    const voterStats = this.choiceRepository.getVoterStats(id, item.voting_round);
    return {
      ...item,
      ...counts,
      ...voterStats,
      my_choice: voterId
        ? this.choiceRepository.getChoiceByVoter(id, voterId, item.voting_round)?.choice ?? null
        : null,
      voting_round: item.voting_round,
      sell_ready: item.sell_direct === 1
        || (voterStats.voter_count >= item.required_votes && voterStats.sell_voter_count === item.required_votes),
    };
  }

  createItem(filename: string, originalName: string, requiredVotes = 2) {
    return this.itemRepository.create(filename, originalName, requiredVotes);
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
      choices: this.choiceRepository.getByItemId(id, item.voting_round)
        .map(({ voter_id: _voterId, ...choice }) => choice),
      counts: this.choiceRepository.getCounts(id, item.voting_round),
    };
  }

  submitChoice(id: number, choice: 'save' | 'sell' | 'throw', voterId: string): ChoiceSubmissionResult | null {
    const item = this.itemRepository.getById(id);
    if (!item) {
      return null;
    }

    const voterStats = this.choiceRepository.getVoterStats(id, item.voting_round);
    const existingChoice = this.choiceRepository.getChoiceByVoter(id, voterId, item.voting_round);
    if (existingChoice) {
      return {
        status: 'already-voted',
        choice: existingChoice,
        counts: this.choiceRepository.getCounts(id, item.voting_round),
        ...voterStats,
        required_votes: item.required_votes,
      };
    }
    if (item.sell_direct === 1 || voterStats.voter_count >= item.required_votes) {
      return {
        status: 'voting-closed',
        counts: this.choiceRepository.getCounts(id, item.voting_round),
      };
    }

    const saved = this.choiceRepository.create(id, choice, voterId, item.voting_round);
    const counts = this.choiceRepository.getCounts(id, item.voting_round);
    const updatedStats = this.choiceRepository.getVoterStats(id, item.voting_round);
    return {
      status: 'submitted',
      choice: saved,
      counts,
      ...updatedStats,
      required_votes: item.required_votes,
      sell_ready: updatedStats.voter_count >= item.required_votes
        && updatedStats.sell_voter_count === item.required_votes,
      listing_draft: updatedStats.voter_count >= item.required_votes
        && updatedStats.sell_voter_count === item.required_votes
        ? this.listingDraftRepository.ensureForItem(id)
        : undefined,
    };
  }

  sellDirect(id: number) {
    const item = this.itemRepository.getById(id);
    if (!item) {
      return null;
    }
    const listingDraft = this.listingDraftRepository.ensureForItem(id, true);
    if (!listingDraft) {
      return null;
    }
    return { item: this.getItem(id), listing_draft: listingDraft };
  }

  resetVoting(id: number) {
    const item = this.itemRepository.getById(id);
    if (!item) {
      return null;
    }
    const voterStats = this.choiceRepository.getVoterStats(id, item.voting_round);
    const sellReady = voterStats.voter_count >= item.required_votes
      && voterStats.sell_voter_count === item.required_votes;
    if (item.sell_direct === 1 || voterStats.voter_count < item.required_votes || sellReady) {
      return { reset: false as const, item: this.getItem(id) };
    }
    this.itemRepository.startNewVotingRound(id);
    return { reset: true as const, item: this.getItem(id) };
  }
}

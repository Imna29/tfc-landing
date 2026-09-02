/**
 * The Entry history a fan reads on their profile: everything they have ever
 * committed, and how each part of it went.
 *
 * The other end of `shared/entries.ts`. That module is what a fan may build
 * and what it would return; this is the same Entries read back afterwards,
 * with each Prediction graded against how its Bout actually ended. It is kept
 * apart because almost nothing is shared between the two questions: nothing
 * here is refused, nothing here is priced, and none of it moves a Coin.
 *
 * **Nothing in this file is stored.** What a chain came to, what it returned
 * and whether each Prediction landed are worked out from the Predictions and
 * the Results every time they are shown — which is ADR-0013's rule about the
 * combined Multiplier applied to a whole page, and ADR-0003's about a Balance.
 * A history that quoted a Reward written down beside the Entry would be a
 * second answer to a question settlement has already answered, and the day the
 * two differed nothing could say which was right.
 *
 * So the arithmetic here is the arithmetic settlement pays on, reached through
 * the same functions: `entryAsItStands` and `gradePrediction` in
 * `shared/results.ts`, the first of which the listing beside the card prices
 * its own Entries with. What this module adds is only the reading — the
 * grouping, the filter, and the sentence beside the Coins.
 */
import { coinsLabel } from "./coins";
import {
  ENTRY_STATUS_LABELS,
  isEntryStatus,
  type DraftPrediction,
  type EntryStatus,
  type PotentialReward,
} from "./entries";
import {
  boutEndingLabel,
  endingNote,
  entryAsItStands,
  gradePrediction,
  type BoutEnding,
  type PredictionGrade,
} from "./results";

/**
 * One Prediction of an Entry, as the history reads it back.
 *
 * A {@link DraftPrediction} — the one answer, what it was priced at, and the
 * names the Bout was fought under — plus the two things only hindsight adds:
 * which card it was on, and how that Bout ended.
 *
 * The Event is on the Prediction rather than on the Entry because an Entry is
 * not tied to one card. Nothing stops a Chained Entry answering Bouts on two
 * Events of the same Season, and a history that named one card per Entry would
 * be quietly wrong about those.
 */
export interface HistoricPrediction extends DraftPrediction {
  /** The Event its Bout is on, which is what tells two cards apart. */
  eventTitle: string;
  /** How its Bout ended, or null while that Bout has not settled. */
  ending: BoutEnding | null;
}

/**
 * One Entry a fan has submitted, as their history lists it.
 *
 * Carries no combined Multiplier and no Reward, for the reason the `entries`
 * table carries neither and {@link readEntry} below works both out: they are
 * the product of what is on the Predictions.
 */
export interface HistoricEntry {
  id: string;
  status: EntryStatus;
  amount: number;
  submittedAt: string;
  /** The Season it was committed in, which is what the history groups by. */
  season: { id: string; name: string };
  predictions: HistoricPrediction[];
}

/** A Season a fan has committed at least one Entry in. */
export interface PlayedSeason {
  id: string;
  name: string;
}

/**
 * Which of a fan's Entries they are looking at.
 *
 * Null is every one of them on both fields, which is where the page starts:
 * "every Entry the fan has submitted is listed" is what the profile is for,
 * and {@link bySeason} is what stops the old ones drowning the current ones.
 * Narrowing is the fan's move, not the page's opening position — and a status
 * filter that searched only one Season would answer "find my wins" with some
 * of them.
 */
export interface HistoryFilter {
  /** The Season to list, or null for every Season. */
  seasonId: string | null;
  /** The status to list, or null for every status. */
  status: EntryStatus | null;
}

/**
 * Reads the filter out of a query string, against the Seasons this fan has
 * actually played.
 *
 * Said once for both sides, like every other parse in this directory: the
 * profile puts these two values in the URL and the route reads them back out,
 * and two readings of the same query string would be a page whose controls
 * disagreed with the listing under them.
 *
 * **The Seasons are passed in so that a Season id never reaches Postgres as a
 * cast.** A filter can only name a Season this fan holds an Entry in, so a
 * string somebody typed into a URL is answered with the whole history rather
 * than with the 500 an invalid `uuid` raises halfway down a query. It answers
 * the same for a real Season the fan never played, which is the honest reading
 * of both: there is nothing of theirs in it.
 *
 * Nothing here is ever refused. A filter is a way of looking at a page, and a
 * fan who typed a status that is not one is asking to see their history —
 * answering them an error rather than all of it would be a page refusing to
 * render over a word in a URL.
 */
export function historyFilter(
  asked: { season?: unknown; status?: unknown },
  played: readonly PlayedSeason[],
): HistoryFilter {
  return {
    seasonId: played.find((season) => season.id === asked.season)?.id ?? null,
    status: isEntryStatus(asked.status) ? asked.status : null,
  };
}

/** Whether the Coins beside an Entry are a promise, a payment, or neither. */
export type RewardState = "potential" | "paid" | "returned" | "none";

/** What became of the Coins an Entry committed, and how a fan is told. */
export interface EntryReward {
  state: RewardState;
  /** The sentence beside the Entry, which is where the number is. */
  note: string;
}

/**
 * What an Entry has returned, or stands to.
 *
 * The four states are the four different things the Coins beside an Entry can
 * mean, and telling them apart is the whole of what "potential or actual
 * Reward" asks for. A Won Entry's Reward has been paid; an Open one's has not
 * and may never be; a Cancelled or Refunded Entry returned its Amount rather
 * than any Reward at all, and the two say so differently because they are
 * different decisions — the fan's and the game's.
 *
 * A Lost Entry returned nothing, and its sentence is the one that has to work
 * hardest. The combined Multiplier is still on the screen beside it, worked
 * out the same way as every other Entry's, and on a dead chain that number is
 * a counterfactual — what it was going for, priced against what happened. So
 * the sentence names it as one. A bare "No Reward" under a Multiplier reads as
 * Coins the game decided not to hand over.
 */
export function rewardOf(
  entry: { status: EntryStatus; amount: number },
  returns: PotentialReward,
): EntryReward {
  if (entry.status === "won") {
    return { state: "paid", note: HISTORY_MESSAGES.paid(returns.reward) };
  }

  if (entry.status === "lost") {
    return { state: "none", note: HISTORY_MESSAGES.lost(returns.reward) };
  }

  if (entry.status === "cancelled") {
    return { state: "returned", note: HISTORY_MESSAGES.cancelled(entry.amount) };
  }

  if (entry.status === "refunded") {
    return { state: "returned", note: HISTORY_MESSAGES.refunded(entry.amount) };
  }

  return { state: "potential", note: HISTORY_MESSAGES.potential(returns.reward) };
}

/** One Prediction of an Entry, read against how its Bout ended. */
export interface ReadPrediction {
  prediction: HistoricPrediction;
  /** Won, Lost, No Result, or still open. */
  grade: PredictionGrade;
  /** What this answer ends up paying, now its Bout is decided. */
  multiplier: number;
  /** How its Bout ended, as a sentence, or null while it has not. */
  ending: string | null;
  /** What that did to these answers, where it needs saying (ADR-0005). */
  note: string | null;
}

/** An Entry as the history shows it: what it came to, and how each part went. */
export interface ReadEntry {
  entry: HistoricEntry;
  predictions: ReadPrediction[];
  /** The combined Multiplier after the cap, and the Coins at it. */
  returns: PotentialReward;
  /** What became of the Coins it committed. */
  reward: EntryReward;
}

/**
 * One Entry, read against everything its Bouts have settled to.
 *
 * **Every Prediction is graded, whatever the Entry did.** A chain that is
 * already Lost still says which of its answers landed and which are still to
 * be fought — that is #14's "remaining Predictions are still graded for
 * display", and it is the difference between a fan reading how close they were
 * and a fan reading a page that appears to have stopped working.
 *
 * The Coins come from `entryAsItStands` in `shared/results.ts`, which is the
 * same four lines the listing beside the card prices its Entries with: each
 * answer repriced against how its Bout ended, so a No Result contributes ×1.0
 * and a disqualification pays its winner alone (ADR-0005). What is added here
 * is the grade beside each answer, the sentence for how its Bout went, and
 * {@link rewardOf}'s reading of what the Coins at the bottom mean.
 */
export function readEntry(entry: HistoricEntry): ReadEntry {
  const { multipliers, returns } = entryAsItStands(entry);

  return {
    entry,
    predictions: entry.predictions.map((prediction, at) => ({
      prediction,
      grade: gradePrediction(prediction, prediction.ending),
      multiplier: multipliers[at]!,
      ending: prediction.ending ? boutEndingLabel(prediction.ending, prediction.corners) : null,
      note: endingNote(prediction, prediction.ending),
    })),
    returns,
    reward: rewardOf(entry, returns),
  };
}

/** Every Entry a fan committed in one Season, read. */
export interface SeasonHistory {
  season: PlayedSeason;
  entries: ReadEntry[];
}

/**
 * The Entries grouped by the Season they were committed in.
 *
 * `CONTEXT.md`: Entry history is kept forever and grouped by Season, because a
 * Balance means nothing without the competition it was held in. This is also
 * what lets the page open on the whole history without the old Entries
 * drowning the current ones — they are under a heading of their own, below.
 *
 * The order is whatever order the Entries arrive in — newest first — and
 * `seasons_one_open` means only one Season is ever taking Entries, so grouping
 * them in arrival order puts the newest Season at the top without this having
 * to know anything about dates.
 */
export function bySeason(entries: readonly HistoricEntry[]): SeasonHistory[] {
  const seasons = new Map<string, SeasonHistory>();

  for (const entry of entries) {
    const group = seasons.get(entry.season.id) ?? { season: entry.season, entries: [] };

    seasons.set(entry.season.id, group);
    group.entries.push(readEntry(entry));
  }

  return [...seasons.values()];
}

/** The whole of a fan's history, as their profile asks for it. */
export interface FanHistory {
  /** Every Season this fan has committed an Entry in, newest first. */
  seasons: PlayedSeason[];
  /** What they are looking at, as the route read it back. */
  filter: HistoryFilter;
  /** The Entries it matched, newest first. */
  entries: HistoricEntry[];
}

/** Everything a fan's Entry history says to them. */
export const HISTORY_MESSAGES = {
  potential: (coins: number) => `Returns ${coinsLabel(coins)} if every Prediction in it lands.`,
  paid: (coins: number) => `${coinsLabel(coins)} returned as a Reward.`,
  lost: (coins: number) =>
    `No Reward. This Entry was going for ${coinsLabel(coins)} and a Prediction ` +
    "in it did not land; its Amount left your Balance when you committed it.",
  cancelled: (coins: number) =>
    `${coinsLabel(coins)} returned in full. You took this Entry back while ` +
    "every Bout in it was still open.",
  refunded: (coins: number) =>
    `${coinsLabel(coins)} returned in full. No Bout in this Entry produced a ` +
    "result to grade, so there was nothing for it to be right or wrong about.",
  noneYet:
    "You have not committed an Entry yet. Pick a winner on the card, commit " +
    "your Coins, and everything you predict is kept here — through this " +
    "Season and every one after it.",
  noneMatching: (status: EntryStatus) =>
    `No ${ENTRY_STATUS_LABELS[status]} Entries here. Try another status, or ` + "another Season.",
  noneThisSeason:
    "No Entries in this Season. Every Season you have played is in the list " +
    "above, and nothing is ever removed from it.",
  noneAtAll:
    "None of your Entries match that. Every Entry you have ever committed is " +
    "still here — widen the filter to find it.",
  everySeason: "Every Season",
  everyStatus: "Every status",
  kept:
    "Every Entry you have ever committed, newest first, grouped by the Season " +
    "you committed it in. Nothing here is ever removed — narrow it by Season " +
    "or by status to find one.",
} as const;

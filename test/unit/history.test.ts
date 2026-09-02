import { describe, expect, it } from "vitest";
import { coinsLabel } from "../../shared/coins";
import { COMBINED_MULTIPLIER_CAP, ENTRY_STATUSES, ENTRY_STATUS_LABELS } from "../../shared/entries";
import {
  HISTORY_MESSAGES,
  bySeason,
  historyFilter,
  readEntry,
  rewardOf,
  type HistoricEntry,
  type HistoricPrediction,
} from "../../shared/history";

/**
 * The Entry history a fan reads on their profile.
 *
 * Everything here is worked out from rows the database already holds rather
 * than read back from anything written beside them: what a chain came to, what
 * it returned, and how each Prediction in it went. That is ADR-0013's rule
 * about the combined Multiplier applied to a whole page — a history that
 * quoted a stored Reward would be a second answer to a question settlement has
 * already answered, and the day they differ nothing could say which was right.
 *
 * The case worth reading first is the Lost chain with Bouts still to come. Its
 * Entry is over, and every Prediction in it still says where it stands: the
 * ones already fought graded, the ones still to come open. A fan who can see
 * they were one Bout away is reading the most engaging thing on the page, and
 * hiding it is what makes a dead chain look like a broken one.
 */

/** A fan's answer on one Bout, as their history reads it back. */
function prediction(overrides: Partial<HistoricPrediction> = {}): HistoricPrediction {
  return {
    boutId: "bout-1",
    cardOrder: 1,
    eventTitle: "TFC 12",
    corners: { red: "Giorgi Tsiklauri", blue: "Levan Beridze" },
    question: "winner",
    corner: "red",
    method: null,
    round: null,
    multiplier: 2,
    ending: null,
    ...overrides,
  };
}

/** One Entry in the history, with only what a case is about spelled out. */
function entry(overrides: Partial<HistoricEntry> = {}): HistoricEntry {
  return {
    id: "entry-1",
    status: "open",
    amount: 20,
    submittedAt: "2026-09-01T10:00:00.000Z",
    season: { id: "season-2", name: "Season 2" },
    predictions: [prediction()],
    ...overrides,
  };
}

const PLAYED = [
  { id: "season-2", name: "Season 2" },
  { id: "season-1", name: "Season 1" },
];

describe("which Entries a fan is looking at", () => {
  it("opens on the whole history", () => {
    // Which is what the profile is for. Narrowing is the fan's move, not the
    // page's opening position: a status filter over one Season would answer
    // "find my wins" with some of them.
    expect(historyFilter({}, PLAYED)).toEqual({ seasonId: null, status: null });
  });

  it("shows the Season a fan asked for", () => {
    expect(historyFilter({ season: "season-1" }, PLAYED).seasonId).toBe("season-1");
  });

  it("shows the whole history for a Season the fan has never played", () => {
    // Also what an id that is not one at all comes to, which is the point: a
    // Season this fan holds no Entry in and a string somebody typed into a URL
    // are the same answer, and neither reaches Postgres as a cast.
    expect(historyFilter({ season: "season-9" }, PLAYED).seasonId).toBeNull();
    expect(historyFilter({ season: "not-an-id" }, PLAYED).seasonId).toBeNull();
    expect(historyFilter({ season: 12 }, PLAYED).seasonId).toBeNull();
    expect(historyFilter({ season: "season-1" }, []).seasonId).toBeNull();
  });

  it("filters by status", () => {
    expect(historyFilter({ status: "won" }, PLAYED).status).toBe("won");
    expect(historyFilter({ status: "cancelled" }, PLAYED).status).toBe("cancelled");
  });

  it("shows every status where none was asked for, or the ask was not one", () => {
    expect(historyFilter({}, PLAYED).status).toBeNull();
    expect(historyFilter({ status: "winning" }, PLAYED).status).toBeNull();
    expect(historyFilter({ status: ["won"] }, PLAYED).status).toBeNull();
  });
});

describe("the Coins beside an Entry", () => {
  const returns = { multiplier: 4, capped: false, reward: 80 };

  it("is what an Open Entry stands to return", () => {
    expect(rewardOf(entry({ status: "open" }), returns)).toEqual({
      state: "potential",
      note: HISTORY_MESSAGES.potential(80),
    });
  });

  it("is what a Won Entry returned", () => {
    expect(rewardOf(entry({ status: "won" }), returns)).toEqual({
      state: "paid",
      note: HISTORY_MESSAGES.paid(80),
    });
  });

  it("names the Coins a Lost Entry was going for, and that it returned none", () => {
    // The combined Multiplier is on the screen beside this, and on a dead
    // chain it is a counterfactual. A bare "No Reward" underneath it would
    // read as Coins the game decided not to hand over.
    const lost = rewardOf(entry({ status: "lost", amount: 20 }), returns);

    expect(lost).toEqual({ state: "none", note: HISTORY_MESSAGES.lost(80) });
    expect(lost.note).toContain(coinsLabel(80));
    expect(lost.note).toContain("No Reward");
  });

  it("is the Amount in full for an Entry the fan took back", () => {
    expect(rewardOf(entry({ status: "cancelled", amount: 20 }), returns)).toEqual({
      state: "returned",
      note: HISTORY_MESSAGES.cancelled(20),
    });
  });

  it("is the Amount in full for an Entry that had nothing gradable in it", () => {
    // The same Coins as a cancellation and a different sentence, because they
    // are different things: one is the fan's decision, one is the game's.
    const refunded = rewardOf(entry({ status: "refunded", amount: 20 }), returns);

    expect(refunded).toEqual({ state: "returned", note: HISTORY_MESSAGES.refunded(20) });
    expect(refunded.note).not.toBe(HISTORY_MESSAGES.cancelled(20));
  });

  it("says the Coins the way a fan reads them", () => {
    expect(HISTORY_MESSAGES.potential(80)).toContain(coinsLabel(80));
    expect(HISTORY_MESSAGES.paid(1)).toContain(coinsLabel(1));
  });
});

describe("reading one Entry back", () => {
  it("says of each Prediction whether it landed", () => {
    const read = readEntry(
      entry({
        status: "lost",
        predictions: [
          prediction({
            boutId: "bout-1",
            corner: "red",
            ending: { result: { winner: "red", method: "decision", round: null } },
          }),
          prediction({
            boutId: "bout-2",
            corner: "red",
            ending: { result: { winner: "blue", method: "decision", round: null } },
          }),
          prediction({ boutId: "bout-3", ending: { noResult: "withdrawal" } }),
          prediction({ boutId: "bout-4", ending: null }),
        ],
      }),
    );

    expect(read.predictions.map((one) => one.grade)).toEqual([
      "correct",
      "wrong",
      "no result",
      "unresolved",
    ]);
  });

  it("grades the Bouts still to come in a chain that is already Lost", () => {
    // The whole of #14's "remaining Predictions are still graded for display".
    // The Entry is over and the fan can see how close they were, which is the
    // difference between a dead chain and a broken one.
    const read = readEntry(
      entry({
        status: "lost",
        predictions: [
          prediction({
            boutId: "bout-1",
            corner: "blue",
            ending: { result: { winner: "red", method: "decision", round: null } },
          }),
          prediction({
            boutId: "bout-2",
            corner: "red",
            ending: { result: { winner: "red", method: "decision", round: null } },
          }),
        ],
      }),
    );

    expect(read.predictions.map((one) => one.grade)).toEqual(["wrong", "correct"]);
  });

  it("says how each Bout ended, in the same words the card does", () => {
    const read = readEntry(
      entry({
        predictions: [
          prediction({
            ending: { result: { winner: "red", method: "ko_tko", round: 2 } },
          }),
          prediction({ boutId: "bout-2", ending: { noResult: "draw" } }),
          prediction({ boutId: "bout-3", ending: null }),
        ],
      }),
    );

    expect(read.predictions.map((one) => one.ending)).toEqual([
      "Giorgi Tsiklauri by KO/TKO in round 2",
      "No Result — Draw",
      null,
    ]);
  });

  it("reprices an answer its Bout decided nothing about", () => {
    const read = readEntry(
      entry({
        amount: 10,
        predictions: [
          prediction({ boutId: "bout-1", multiplier: 2, ending: { noResult: "cancelled" } }),
          prediction({
            boutId: "bout-2",
            multiplier: 3,
            ending: { result: { winner: "red", method: "decision", round: null } },
          }),
        ],
      }),
    );

    // ADR-0005: the cancelled Bout contributes ×1.0 rather than the ×2 it was
    // priced at, and the chain plays on at what is left of it.
    expect(read.predictions.map((one) => one.multiplier)).toEqual([1, 3]);
    expect(read.returns).toEqual({ multiplier: 3, capped: false, reward: 30 });
    expect(read.predictions[0]?.note).toContain("Bout cancelled");
  });

  it("says what a chain returns at the ×100 cap, and that the cap decided it", () => {
    const read = readEntry(
      entry({
        amount: 5,
        predictions: Array.from({ length: 8 }, (_, at) =>
          prediction({ boutId: `bout-${at}`, multiplier: 4 }),
        ),
      }),
    );

    expect(read.returns).toEqual({
      multiplier: COMBINED_MULTIPLIER_CAP,
      capped: true,
      reward: 5 * COMBINED_MULTIPLIER_CAP,
    });
  });

  it("carries the Entry it was read from, so nothing has to be paired up again", () => {
    const one = entry();

    expect(readEntry(one).entry).toBe(one);
  });
});

describe("the history grouped by Season", () => {
  it("keeps the Seasons in the order their Entries arrive in", () => {
    const grouped = bySeason([
      entry({ id: "a", season: { id: "season-2", name: "Season 2" } }),
      entry({ id: "b", season: { id: "season-2", name: "Season 2" } }),
      entry({ id: "c", season: { id: "season-1", name: "Season 1" } }),
    ]);

    expect(grouped.map((group) => group.season.name)).toEqual(["Season 2", "Season 1"]);
    expect(grouped.map((group) => group.entries.map((one) => one.entry.id))).toEqual([
      ["a", "b"],
      ["c"],
    ]);
  });

  it("reads every Entry it groups", () => {
    const [group] = bySeason([entry({ status: "won" })]);

    expect(group?.entries[0]?.reward.state).toBe("paid");
  });

  it("keeps the old Seasons out of the current one rather than off the page", () => {
    // What lets the profile open on the whole history: nothing is hidden, and
    // this Season is still the first thing a fan reads.
    const grouped = bySeason([
      entry({ id: "a", season: { id: "season-2", name: "Season 2" } }),
      entry({ id: "b", season: { id: "season-1", name: "Season 1" } }),
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped[0]?.season.name).toBe("Season 2");
  });

  it("groups nothing into nothing", () => {
    expect(bySeason([])).toEqual([]);
  });
});

describe("what the history tells a fan", () => {
  it("has a sentence for a fan who has never committed an Entry", () => {
    expect(HISTORY_MESSAGES.noneYet).toContain("Entry");
  });

  it("names the status a filter found nothing under", () => {
    // Otherwise a fan reading "nothing here" cannot tell an empty history from
    // a filter they forgot they had set.
    for (const status of ENTRY_STATUSES) {
      expect(HISTORY_MESSAGES.noneMatching(status)).toContain(ENTRY_STATUS_LABELS[status]);
    }
  });
});

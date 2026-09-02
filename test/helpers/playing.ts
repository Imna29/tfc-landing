import { $fetch } from "@nuxt/test-utils/e2e";
import { eq } from "drizzle-orm";
import type { CommittedEntries } from "../../shared/entries";
import type { FanHistory } from "../../shared/history";
import type {
  ClosedSeason,
  FanStanding,
  FinalStandings,
  Leaderboard,
} from "../../shared/standings";
import type { Corner } from "../../shared/events";
import type { Method, Question } from "../../shared/pricing";
import type { Correction, NoResultReason, RecordedMethod, Settlement } from "../../shared/results";
import { coinTransactions, entries } from "../../server/db/schema";
import { postJson, signUp } from "./accounts";
import {
  cardBout,
  cardInTheGame,
  correctResult,
  enterResult,
  lockBout,
  type CardInTheGame,
} from "./cards";
import { testDatabase } from "./database";
import { confirmEmail, fanId } from "./users";

/**
 * Playing the game from a test: a fan with Coins, a card to predict on, an
 * Entry submitted, and the Bouts settled underneath it.
 *
 * `test/helpers/cards.ts` arranges the card an admin prepares; this is what a
 * fan then does with it, and what an admin does back. Both settlement
 * (`test/server/settlement.test.ts`) and correction
 * (`test/server/corrections.test.ts`) need every one of these, and a second
 * copy of "submit an Entry the way the panel does" is a second thing to keep
 * true of the routes.
 *
 * Everything here goes over HTTP, because that is the seam these suites test
 * at. The two exceptions read Postgres directly and say why where they are:
 * a status and a ledger are what the routes are trusted to have *written*, and
 * a test that read them back through the same routes would be quoting the
 * answer it is checking.
 */

/** A fan who can play: a Season's Coins, and a confirmed address. */
export async function fanWithCoins() {
  const signedUp = await signUp();

  await confirmEmail(signedUp.details.email);

  return { ...signedUp, id: await fanId(signedUp.details.email) };
}

/** A card two hours out, which is a card every Bout on is still open. */
export function upcomingCard(
  bouts: number,
  options: Omit<Parameters<typeof cardInTheGame>[0], "scheduledStart" | "bouts"> = {},
): Promise<CardInTheGame> {
  return cardInTheGame({
    scheduledStart: new Date(Date.now() + 120 * 60_000),
    bouts: Array.from({ length: bouts }, (_, place) =>
      cardBout({ cardOrder: place + 1, mainEvent: place === bouts - 1 }),
    ),
    ...options,
  });
}

/**
 * One Prediction as a case gives it: the Bout, the Question, and the answer.
 *
 * Nothing is defaulted and nothing is implied. A Prediction is one answer to
 * one Question (ADR-0014), so a case that means "red wins Bout 1" says that
 * and a case that means anything else says that instead — there is no shape
 * here that quietly becomes a winner pick because a field was left off.
 */
export interface Answered {
  boutId: string;
  question: Question;
  corner?: Corner;
  method?: Method;
  round?: number;
}

/**
 * The winner Prediction a case commits: this corner, on this Bout.
 *
 * The answer nearly every case in these suites is about — a settlement, a
 * correction, a refund and a leaderboard are none of them about *which*
 * Question was answered. A case that is about one of the others says so by
 * naming it, through {@link methodOn} or by writing the answer out.
 */
export function winnerOn(boutId: string, corner: Corner): Answered {
  return { boutId, question: "winner", corner };
}

/**
 * The method Prediction a case commits: this way of ending, on this Bout.
 *
 * Names no winner, and is graded against the recorded method whoever won —
 * except on a disqualification, where it is a No Result (ADR-0005).
 */
export function methodOn(boutId: string, method: Method): Answered {
  return { boutId, question: "method", method };
}

/** Submits an Entry the way the panel on the card does. */
export async function submit(fan: { cookie: string }, amount: number, predictions: Answered[]) {
  const response = await postJson(
    "/api/predictions/entries",
    {
      amount,
      predictions: predictions.map((one) => ({
        corner: null,
        method: null,
        round: null,
        ...one,
      })),
    },
    fan.cookie,
  );

  if (response.status !== 201) {
    throw new Error(`The Entry was not accepted: ${await response.text()}`);
  }

  return (await response.json()) as { entry: { id: string }; balance: number };
}

/** How a Bout ended, as a case says it: everything optional, nothing implied. */
export interface EnteredResult {
  winner?: Corner;
  method?: RecordedMethod;
  round?: number | null;
}

/** Locks a Bout and enters its result, which is how a card is settled. */
export async function settle(
  card: CardInTheGame,
  place: number,
  result: EnteredResult,
): Promise<{ settlement: Settlement }> {
  const bout = card.bouts[place]!;

  await lockBout(bout.id, card.admin.cookie);

  const entered = await enterResult(
    bout.id,
    { winner: "red", method: "decision", round: null, ...result },
    card.admin.cookie,
  );

  if (!entered.ok) throw new Error(`The result was not entered: ${await entered.text()}`);

  return (await entered.json()) as { settlement: Settlement };
}

/**
 * Locks a Bout and records that it produced nothing gradable.
 *
 * The other half of {@link settle}, and deliberately a second helper rather
 * than another shape {@link settle} can take: an admin entering a No Result
 * sends no winner and no method at all, and a helper that merged one in
 * would be testing a request the admin area never makes.
 */
export async function settleAsNoResult(
  card: CardInTheGame,
  place: number,
  reason: NoResultReason = "draw",
): Promise<{ settlement: Settlement }> {
  const bout = card.bouts[place]!;

  await lockBout(bout.id, card.admin.cookie);

  const entered = await enterResult(bout.id, { noResult: reason }, card.admin.cookie);

  if (!entered.ok) throw new Error(`The No Result was not entered: ${await entered.text()}`);

  return (await entered.json()) as { settlement: Settlement };
}

/** Corrects the result already entered on a settled Bout, as an admin does. */
export async function correct(
  card: CardInTheGame,
  place: number,
  result: EnteredResult,
): Promise<{ correction: Correction }> {
  const corrected = await correctResult(
    card.bouts[place]!.id,
    { winner: "red", method: "decision", round: null, ...result },
    card.admin.cookie,
  );

  if (!corrected.ok) throw new Error(`The result was not corrected: ${await corrected.text()}`);

  return (await corrected.json()) as { correction: Correction };
}

/** Corrects a Bout to the No Result it turned out to have produced. */
export async function correctToNoResult(
  card: CardInTheGame,
  place: number,
  reason: NoResultReason = "draw",
): Promise<{ correction: Correction }> {
  const corrected = await correctResult(
    card.bouts[place]!.id,
    { noResult: reason },
    card.admin.cookie,
  );

  if (!corrected.ok) throw new Error(`The result was not corrected: ${await corrected.text()}`);

  return (await corrected.json()) as { correction: Correction };
}

/** The Entries a fan is holding, as their own listing shows them back. */
export function listingFor(cookie: string): Promise<CommittedEntries> {
  return $fetch<CommittedEntries>("/api/predictions/entries", { headers: { cookie } });
}

/** Where an Entry stands, read back from the row settlement wrote. */
export async function statusOf(entryId: string): Promise<string> {
  const [entry] = await testDatabase()
    .select({ status: entries.status })
    .from(entries)
    .where(eq(entries.id, entryId));

  return entry?.status ?? "no such Entry";
}

/**
 * Every Coin Transaction written about a fan, oldest first.
 *
 * Coins leaving before Coins arriving where two rows share a moment, which is
 * every row one correction writes: `created_at` defaults to `now()`, and
 * Postgres reads that as the moment the transaction began, so a reversal and
 * the re-graded Reward that replaces it are written at the same instant. They
 * are also always a negative row and a positive one, so ordering by the amount
 * puts what was taken back before what was given — which is the order they
 * read in, and an order that does not depend on which row Postgres happened to
 * return first.
 */
export function ledgerFor(userId: string) {
  return testDatabase()
    .select()
    .from(coinTransactions)
    .where(eq(coinTransactions.userId, userId))
    .orderBy(coinTransactions.createdAt, coinTransactions.amount);
}

/**
 * The Entry history this fan reads on their profile.
 *
 * The filter goes on the query string because that is where the page puts it:
 * a fan changing it navigates, so a test that passed it any other way would be
 * testing a request the profile never makes.
 */
export function historyFor(
  cookie: string,
  filter: { season?: string; status?: string } = {},
): Promise<FanHistory> {
  return $fetch<FanHistory>("/api/predictions/history", {
    headers: { cookie },
    query: filter,
  });
}

/** Takes an Entry back, the way the button on the listing does. */
export function cancel(entryId: string, cookie?: string): Promise<Response> {
  return postJson(`/api/predictions/entries/${entryId}/cancel`, {}, cookie);
}

/** Where this fan stands in the Season being played. */
export function standingFor(cookie: string): Promise<FanStanding> {
  return $fetch<FanStanding>("/api/coins/standing", { headers: { cookie } });
}

/**
 * The Season's leaderboard, as whoever holds this cookie reads it.
 *
 * No cookie is a visitor with no account, which is a case the page has to
 * answer rather than refuse: the top ten is public, and only the row pinned
 * under it belongs to anybody.
 */
export function leaderboardFor(cookie?: string): Promise<Leaderboard> {
  return $fetch<Leaderboard>("/api/leaderboard", {
    headers: cookie === undefined ? {} : { cookie },
  });
}

/**
 * What a Season finished as, as whoever holds this cookie reads it.
 *
 * No cookie is a visitor with no account, for the reason
 * {@link leaderboardFor} takes none: what a Season finished as is public, and
 * only the row pinned under the top ten belongs to anybody.
 */
export function finalStandingsFor(seasonId: string, cookie?: string): Promise<FinalStandings> {
  return $fetch<FinalStandings>(`/api/standings/${seasonId}`, {
    headers: cookie === undefined ? {} : { cookie },
  });
}

/** Every Season that has ended, as the leaderboard lists them. */
export function endedSeasons(): Promise<{ seasons: ClosedSeason[] }> {
  return $fetch<{ seasons: ClosedSeason[] }>("/api/standings");
}

/** What the site header would show this fan. */
export function balance(cookie: string): Promise<{ balance: number | null }> {
  return $fetch<{ balance: number | null }>("/api/coins/balance", { headers: { cookie } });
}

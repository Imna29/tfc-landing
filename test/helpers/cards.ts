import { $fetch } from "@nuxt/test-utils/e2e";
import { eq } from "drizzle-orm";
import { inject } from "vitest";
import type { Corner } from "../../shared/events";
import type { Question } from "../../shared/pricing";
import type { NoResultReason, RecordedMethod } from "../../shared/results";
import { bouts, outcomes, seasons } from "../../server/db/schema";
import type { Card, CardBout, CardCorner } from "../../server/utils/cardImport";
import { importCard, type Imported } from "../../server/utils/events";
import type { BoutToPrice, CardToPrice } from "../../server/utils/pricing";
import { postJson, signUpAdmin } from "./accounts";
import { testDatabase } from "./database";
import { fanId } from "./users";

/**
 * Arranging an imported fight card, the way the admin route does it.
 *
 * The route itself cannot be driven from a test: it reads the card out of the
 * real Prismic, and a test that stood a repository up to import from would be
 * a test about Prismic. So these call `importCard` directly — the second half
 * of the import, and the half that decides what the game runs on — with the
 * card `readCard` would have handed it. `test/unit/card-import.test.ts` covers
 * the first half.
 */

/**
 * The application's own connection, pointed at the throwaway test database.
 *
 * `importCard` reaches for `useDatabase()`, which reads `DATABASE_URL` from the
 * environment the way it does in production. The Nitro server under test is a
 * separate process handed its own copy by `setupTestServer`; this is the one
 * this process needs.
 *
 * Set rather than defaulted, deliberately. Building the Nuxt app loads the
 * repo's `.env` into this process, so `DATABASE_URL` is already the
 * developer's own database by the time a test runs — and a helper that
 * honoured it would import fight cards into it.
 */
function useTestEnvironment(): void {
  process.env.DATABASE_URL = inject("databaseUrl");
}

/** One corner of a Bout: a fighter with a document behind them. */
export function corner(name: string, overrides: Partial<CardCorner> = {}): CardCorner {
  const uid = name.toLowerCase().replaceAll(" ", "-");

  return {
    name,
    fighterId: `fighter-${uid}`,
    fighterUid: uid,
    imageUrl: `https://images.prismic.io/tfc/${uid}.png`,
    record: "12-3-0",
    ...overrides,
  };
}

/** A Bout as `readCard` would have read one out of Prismic. */
export function cardBout(overrides: Partial<CardBout> = {}): CardBout {
  return {
    cardOrder: 1,
    red: corner("Giorgi Tsiklauri"),
    blue: corner("Levan Beridze"),
    division: "Lightweight",
    scheduledRounds: 3,
    mainEvent: false,
    titleFight: false,
    ...overrides,
  };
}

/** A card as `readCard` would have read one out of Prismic. */
export function card(overrides: Partial<Card> = {}): Card {
  return {
    prismicId: "event-tfc-12",
    title: "TFC 12",
    scheduledStart: new Date("2026-09-12T19:00:00Z"),
    venue: "Tbilisi Sports Palace",
    posterUrl: "https://images.prismic.io/tfc/tfc-12.png",
    bouts: [cardBout()],
    ...overrides,
  };
}

/** The Season being played, which a card is imported into. */
export async function openedSeasonId(): Promise<string> {
  const [season] = await testDatabase()
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.status, "open"))
    .limit(1);

  if (!season) throw new Error("No Season is open to import a card into.");

  return season.id;
}

/** Imports a card into the Season being played, as that admin. */
export async function importTestCard(
  importedBy: string,
  overrides: Partial<Card> = {},
): Promise<Imported> {
  useTestEnvironment();

  return importCard(card(overrides), { seasonId: await openedSeasonId(), importedBy });
}

/** Every Bout of the imported card, in card order. */
export function importedBouts(eventId: string) {
  return testDatabase()
    .select()
    .from(bouts)
    .where(eq(bouts.eventId, eventId))
    .orderBy(bouts.cardOrder);
}

/** Every Outcome on a Bout, grouped by the Question it answers. */
export function boutOutcomes(boutId: string) {
  return testDatabase()
    .select()
    .from(outcomes)
    .where(eq(outcomes.boutId, boutId))
    .orderBy(outcomes.question, outcomes.corner, outcomes.method, outcomes.round);
}

/**
 * Arranging a card fans can actually play on, the way an admin prepares one:
 * a Season open, the card imported, every Outcome priced, every Bout opened.
 *
 * Over HTTP from the pricing step onwards, because those routes exist and are
 * the seam this suite tests at. Import is the one step that cannot be driven
 * that way — its route reads the real Prismic — so it goes through
 * {@link importTestCard} above.
 */

/** The admin who prepares a card, and the session they do it in. */
export interface CardAdmin {
  id: string;
  cookie: string;
  email: string;
}

/** A signed-in admin with a Season open, ready to import a card into. */
export async function adminWithASeason(name = "Season 1"): Promise<CardAdmin> {
  const signedUp = await signUpAdmin();
  const opened = await postJson("/api/admin/seasons", { name }, signedUp.cookie);

  if (!opened.ok) throw new Error(`Opening ${name} was refused: ${await opened.text()}`);

  return {
    id: await fanId(signedUp.details.email),
    cookie: signedUp.cookie,
    email: signedUp.details.email,
  };
}

/** What each answer on a Bout pays, unless a test says otherwise. */
export const TEST_MULTIPLIERS: Record<Question, number> = { winner: 2, method: 2.5, round: 3 };

/** Prices every Outcome on a Bout, by the Question it answers. */
export async function priceBout(
  bout: BoutToPrice,
  cookie: string,
  multipliers: Record<Question, number> = TEST_MULTIPLIERS,
): Promise<void> {
  const priced = await postJson(
    `/api/admin/bouts/${bout.id}/multipliers`,
    {
      multipliers: Object.fromEntries(
        bout.outcomes.map((outcome) => [outcome.id, multipliers[outcome.question]]),
      ),
    },
    cookie,
  );

  if (!priced.ok) throw new Error(`Pricing Bout ${bout.cardOrder} failed: ${await priced.text()}`);
}

/** Opens a Bout for predictions, as the button in the admin area does. */
export async function openBout(boutId: string, cookie: string): Promise<void> {
  const opened = await postJson(`/api/admin/bouts/${boutId}/open`, {}, cookie);

  if (!opened.ok) throw new Error(`Opening a Bout failed: ${await opened.text()}`);
}

/** Locks a Bout, as the button in the admin area does. */
export async function lockBout(boutId: string, cookie: string): Promise<void> {
  const locked = await postJson(`/api/admin/bouts/${boutId}/lock`, {}, cookie);

  if (!locked.ok) throw new Error(`Locking a Bout failed: ${await locked.text()}`);
}

/**
 * Enters how a Bout ended, the way the form in the admin area does: the Result
 * it produced, or the No Result it produced instead (ADR-0005).
 *
 * Every field optional and nothing defaulted, so that a case can send exactly
 * what it means to — including the combinations the route refuses.
 *
 * Hands the raw response back rather than throwing, because half the cases
 * that use it are about a result being refused.
 */
export function enterResult(
  boutId: string,
  ending: {
    winner?: Corner | null;
    method?: RecordedMethod | null;
    round?: number | null;
    noResult?: NoResultReason | null;
  },
  cookie: string,
): Promise<Response> {
  return postJson(`/api/admin/bouts/${boutId}/result`, ending, cookie);
}

/** The card an admin is pricing, as the admin area reads it. */
export function cardToPrice(eventId: string, cookie: string): Promise<CardToPrice> {
  return $fetch<CardToPrice>(`/api/admin/events/${eventId}`, { headers: { cookie } });
}

/** A card in the game, with what a test needs to predict on it. */
export interface CardInTheGame {
  admin: CardAdmin;
  eventId: string;
  /** Every Bout in card order, with the Outcome ids and Multipliers on it. */
  bouts: BoutToPrice[];
}

/**
 * A card imported, priced and open for predictions.
 *
 * `open: false` stops after pricing, which is the state a Bout nobody has
 * opened is in — the one a fan is refused a Prediction on.
 */
export async function cardInTheGame(
  options: {
    admin?: CardAdmin;
    /** Relative to now, so that "the upcoming Event" stays this one. */
    scheduledStart?: Date;
    bouts?: CardBout[];
    multipliers?: Record<Question, number>;
    open?: boolean;
  } = {},
): Promise<CardInTheGame> {
  const admin = options.admin ?? (await adminWithASeason());

  const imported = await importTestCard(admin.id, {
    ...(options.scheduledStart ? { scheduledStart: options.scheduledStart } : {}),
    ...(options.bouts ? { bouts: options.bouts } : {}),
  });

  const priced = await cardToPrice(imported.id, admin.cookie);

  for (const bout of priced.bouts) {
    await priceBout(bout, admin.cookie, options.multipliers);

    if (options.open !== false) await openBout(bout.id, admin.cookie);
  }

  return {
    admin,
    eventId: imported.id,
    bouts: (await cardToPrice(imported.id, admin.cookie)).bouts,
  };
}

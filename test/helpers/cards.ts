import { eq } from "drizzle-orm";
import { inject } from "vitest";
import { bouts, outcomes, seasons } from "../../server/db/schema";
import type { Card, CardBout, CardCorner } from "../../server/utils/cardImport";
import { importCard, type Imported } from "../../server/utils/events";
import { testDatabase } from "./database";

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

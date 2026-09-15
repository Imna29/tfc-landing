import type { ImportedEvent } from "../../utils/events";

/**
 * The cards an admin can import, and what has been imported already.
 *
 * Both sides in one answer, because the question the admin area asks is not
 * "what is in Prismic" or "what is in the game" but "what is the difference" —
 * a card the content team has published and nobody has pulled through is the
 * thing this page exists to make visible.
 */
export interface ListedCard {
  prismicId: string;
  /** Whatever has been authored so far, which may be nothing yet. */
  title: string | null;
  scheduledStart: string | null;
  venue: string | null;
  /** How many Bouts the card has where it is authored. */
  bouts: number;
  /** What the game holds for it, or `null` for a card nobody has imported. */
  imported: ImportedEvent | null;
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  // The Locks that have fallen due, applied before the counts are read. This
  // listing is where an admin decides whether a card can still be re-imported
  // and how far through it is, and both answers are about where its Bouts are.
  await applyAutomaticLocks();

  const season = await currentSeason();
  const imported = await importedEvents();
  const cards = await listCards();

  const importedByPrismicId = new Map(imported.map((card) => [card.prismicId, card]));

  const listed: ListedCard[] = cards.map((card) => ({
    ...card,
    imported: importedByPrismicId.get(card.prismicId) ?? null,
  }));

  // A card that has been imported and has since disappeared from Prismic is
  // listed too, from the Postgres side. It is still a card fans are predicting
  // on, and a listing that dropped it would say the game holds nothing when it
  // holds a live Event.
  const stillInPrismic = new Set(cards.map((card) => card.prismicId));

  const goneFromPrismic: ListedCard[] = imported
    .filter((card) => !stillInPrismic.has(card.prismicId))
    .map((card) => ({
      prismicId: card.prismicId,
      title: card.title,
      scheduledStart: card.scheduledStart.toISOString(),
      venue: card.venue,
      bouts: card.bouts,
      imported: card,
    }));

  return {
    season: season ? { name: season.name } : null,
    cards: [...listed, ...goneFromPrismic],
  };
});

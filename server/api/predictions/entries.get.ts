/**
 * The Entries a fan is holding on the Season being played.
 *
 * What it is for is the sentence beside each one: an Entry can be cancelled
 * only while every Bout in it is still open, and a fan should read the reason
 * it cannot be before they press anything rather than after. So every Bout
 * comes back with its status and its own Lock moment, and the page decides
 * with the same `cancellationOf` the cancel route decides with.
 *
 * The Locks that have fallen due are applied first, like everywhere else that
 * cares where a Bout is (ADR-0006, ADR-0009): this is one more request that
 * can be the one to notice a card has started.
 *
 * Answers an empty listing rather than a 404 when no Season is being played. A
 * fan between Seasons holds no Entries to cancel, which is not a mistake
 * anybody made.
 *
 * This is not the Entry history. That is `/api/predictions/history`, which the
 * profile reads: it goes back through every Season and grades each Prediction
 * of a chain. This is the Entries a fan can still do something about, beside
 * the card they were committed on.
 */
export default defineEventHandler(async (event) => {
  const fan = await requireFan(event);

  // One moment for the whole request, so that the Locks written below and the
  // Bouts read afterwards are the same card at the same instant.
  const now = new Date();

  await applyAutomaticLocks(now);

  const season = await currentSeason();

  return {
    // The server's clock, for the reason `CardPredictions` carries one: the
    // page counts a Lock down from the moment the server answered, so the
    // first thing the browser draws agrees with the HTML it is hydrating.
    answeredAt: now.toISOString(),
    entries: season
      ? await committedEntries(
          { seasonId: season.id, fanId: fan.id },
          { now, sweepAfter: sweepWindow() },
        )
      : [],
  };
});

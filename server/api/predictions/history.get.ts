import { historyFilter, type FanHistory } from "#shared/history";

/**
 * The Entry history a fan reads on their own profile.
 *
 * Every Entry they have ever committed, back through every Season, each
 * Prediction carrying the answer they gave and how that Bout actually ended —
 * which is what lets the page say of each part of a chain whether it landed.
 *
 * **There is no fan to ask about.** The history answered is the history of
 * whoever is signed in, and there is deliberately no parameter that could name
 * anybody else: a fan cannot read another fan's Entries because there is
 * nothing to send that would ask for them. Signed out is a 401 carrying a
 * sentence rather than an empty listing, because a visitor with no account has
 * no history rather than an empty one.
 *
 * This is not the listing beside the card. That one is
 * `/api/predictions/entries`: the Entries a fan is holding this Season, with
 * where each Bout stands, because it is the page that offers to cancel one.
 * Nothing here can be cancelled, so nothing here reads a Lock.
 *
 * The filter comes off the query string so that it survives a reload and the
 * browser's back button, and it is read by the same `historyFilter` the page
 * builds the URL with. It is answered back on `filter` rather than assumed,
 * because two of the three Season answers are decided here — see that
 * function — and a page whose controls guessed at them would show a Season
 * heading over another Season's Entries.
 *
 * Never edge-cached: `/api/**` is exempt (ADR-0008), and this is as personal
 * as an answer in this application gets.
 */
export default defineEventHandler(async (event): Promise<FanHistory> => {
  const fan = await requireFan(event);

  // Read first because the filter is decided against them: which Season a fan
  // who asked for none is shown, and which Season ids are ones they could be
  // shown at all.
  const seasons = await seasonsPlayed(fan.id);
  const filter = historyFilter(getQuery(event), seasons);

  return { seasons, filter, entries: await entryHistory(fan.id, filter) };
});

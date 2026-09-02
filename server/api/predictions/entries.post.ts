import { ENTRY_MESSAGES, parseEntry } from "#shared/entries";

/**
 * Submitting an Entry: the moment a fan's opinion about a card becomes Coins
 * out of their Balance.
 *
 * Every rule in the product meets here, and each of them is asked three times
 * on purpose. The page asks while the fan is still choosing, so a second
 * answer on a Bout replaces the first rather than being refused here. This
 * asks again of what actually arrived, because the page is not what the server
 * is holding. And Postgres asks a third time about the ones worth it — one
 * answer per Prediction, one Prediction per Bout, one to ten of them, an open
 * Bout, Coins the fan holds — because a rule that lives only in a handler is
 * one refactor away from disappearing, and because two requests in the same
 * moment can both be told they are fine.
 *
 * The order of the refusals is the order a fan meets them: who they are, then
 * whether the game is open to them, then what they sent, then what the card
 * says about it, and only then the Coins. Each is a sentence they can act on.
 */
export default defineEventHandler(async (event) => {
  const fan = await currentFan(event);

  // `requireFan` would answer this, and answers it for every other route. Here
  // the sentence is this one's own: a visitor refused at this point has just
  // built an Entry, and is owed better than being told to sign in to "take
  // part".
  if (!fan) throw refuse(401, ENTRY_MESSAGES.signIn);

  // The published contest rules promise this one (ADR-0007): a confirmed
  // address before a first Entry. It is also the whole of "one account per
  // person" — a speed bump rather than a guarantee, and the only one there is.
  if (!fan.emailVerified) throw refuse(403, ENTRY_MESSAGES.emailUnverified);

  const season = await currentSeason();

  if (!season) throw refuse(409, ENTRY_MESSAGES.noSeasonOpen);

  const { entry, problem } = parseEntry(await readBody(event));

  if (problem !== undefined) throw refuse(422, problem);

  // One moment for the whole request, so that a Bout locking while this runs
  // cannot be open for the first Prediction of an Entry and locked for the
  // fourth.
  const now = new Date();

  // The Locks that have fallen due, written before anything is priced against
  // them. It is what makes the refusal below one Postgres would give too: the
  // Bout is `locked` in the row by the time the Prediction is written, and
  // `predictions_are_made_on_open_bouts` refuses it whatever this route
  // believed a moment earlier.
  await applyAutomaticLocks(now);

  const priced = await priceAnswers(entry.predictions, {
    seasonId: season.id,
    now,
    sweepAfter: sweepWindow(),
  });

  if (priced.refusal) throw refuse(priced.refusal.status, priced.refusal.problem);

  const submitted = await submitEntry({
    fanId: fan.id,
    seasonId: season.id,
    amount: entry.amount,
    predictions: priced.predictions,
  });

  if (submitted.refusal) throw refuse(submitted.refusal.status, submitted.refusal.problem);

  setResponseStatus(event, 201);

  // The Balance comes back with the Entry rather than being asked for again:
  // it moved because of this request, and a header that had to go and look
  // would show the old number for as long as that took.
  return { entry: submitted.entry, balance: submitted.balance };
});

function refuse(statusCode: number, message: string) {
  return createError({ statusCode, statusMessage: "The Entry was not accepted", message });
}

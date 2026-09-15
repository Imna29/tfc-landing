/**
 * The fight card a fan is shown, signed in or not.
 *
 * Deliberately asks for no session. A visitor should be able to see the game
 * before deciding whether to join it, and nothing here is about them: it is
 * the same card, with the same Multipliers, for everybody who asks. What is
 * about them — their Balance, the Entry they are building — is asked for
 * separately, by `/api/coins/balance` and `predictions/entries.post.ts`.
 *
 * The Locks that have fallen due are applied before the card is read, so that
 * a fan is shown a Bout's real state and the log says when it actually closed.
 * Nothing schedules that sweep (ADR-0009 leaves no cron beside the function),
 * so the requests that care about a Bout's state are what run it — and this is
 * the one a card that nobody at TFC is looking at still gets.
 *
 * Answers a card of null rather than a 404 when there is none. A fan who
 * arrives between cards has not made a mistake, and the page says so in
 * `PREDICTION_MESSAGES.noCard`.
 */
export default defineEventHandler(async () => {
  // One moment for the whole request: the Locks are applied as at the instant
  // the card is read, so a Bout cannot fall due between the two.
  const now = new Date();

  await applyAutomaticLocks(now);

  return (await upcomingCard(now)) ?? { card: null, predictions: null };
});

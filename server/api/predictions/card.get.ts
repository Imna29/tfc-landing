/**
 * The fight card a fan is shown, signed in or not.
 *
 * Deliberately asks for no session. A visitor should be able to see the game
 * before deciding whether to join it, and nothing here is about them: it is
 * the same card, with the same Multipliers, for everybody who asks. What is
 * about them — their Balance, the Entry they are building — is asked for
 * separately, by `/api/coins/balance` and `predictions/entries.post.ts`.
 *
 * Answers a card of null rather than a 404 when there is none. A fan who
 * arrives between cards has not made a mistake, and the page says so in
 * `PREDICTION_MESSAGES.noCard`.
 */
export default defineEventHandler(async () => {
  return (await upcomingCard()) ?? { card: null, predictions: null };
});

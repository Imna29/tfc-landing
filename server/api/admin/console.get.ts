/**
 * The card an admin is running right now, for the live lock console.
 *
 * One card, chosen by the server rather than named in the URL: the console is
 * the screen used cageside, one-handed, between fights, and a card an admin has
 * to go and find first is a card they are finding while the next Bout is
 * walking out. There is one card being fought at a time (#20).
 *
 * The Locks that have fallen due are applied before it is read, the way every
 * admin route applies them. It matters most here: an admin looking at this
 * screen is the person about to press the button, and a Bout listed open that
 * the clock closed an hour ago is the one they would go and lock by hand —
 * putting their name against the card's own work.
 *
 * Answers a card of null rather than a 404 when nothing is being fought. An
 * admin who opens the console on a Tuesday has not made a mistake, and
 * `CONSOLE_MESSAGES.noCard` says so.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  // One moment for the whole request, so the Locks are applied as at the
  // instant the card is read and a Bout cannot fall due between the two.
  const now = new Date();

  await applyAutomaticLocks(now);

  return { card: await lockConsole({ now, sweepAfter: sweepWindow() }) };
});

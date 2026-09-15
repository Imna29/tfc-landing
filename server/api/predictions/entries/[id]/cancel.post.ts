import { CANCELLATION_MESSAGES } from "#shared/entries";

/**
 * Cancelling an Entry: a fan changing their mind, usually because the card
 * changed after they submitted.
 *
 * A route of its own rather than a `DELETE` on the Entry, because nothing is
 * deleted. A cancelled Entry stays in the fan's listing with its status and
 * its Coins back in the Balance — what happened is recorded rather than
 * unwritten, the way the ledger records it (ADR-0003).
 *
 * The Locks that have fallen due are applied before anything is asked, which
 * is what makes the refusal below one Postgres would give too: a Bout whose
 * moment has passed is `locked` in the row by the time the cancellation is
 * judged, and `entries_are_cancelled_while_every_bout_is_open` refuses it
 * whatever this route believed a moment earlier.
 *
 * No Season is looked up. An Entry belongs to the Season it was submitted in
 * and the refund moves that Season's Balance, so the row is asked rather than
 * the calendar.
 */
export default defineEventHandler(async (event) => {
  const fan = await requireFan(event);

  // One moment for the whole request: a Bout cannot be open when the Locks are
  // applied and locked when the Entry is judged against them.
  const now = new Date();

  await applyAutomaticLocks(now);

  const cancelled = await cancelEntry(
    { entryId: getRouterParam(event, "id") ?? "", fanId: fan.id },
    { now, sweepAfter: sweepWindow() },
  );

  if (cancelled.refusal) {
    throw createError({
      statusCode: cancelled.refusal.status,
      statusMessage: "The Entry was not cancelled",
      message: cancelled.refusal.problem,
    });
  }

  // The Balance comes back with the Entry rather than being asked for again:
  // it moved because of this request, and a header that had to go and look
  // would show the old number for as long as that took.
  return {
    entry: cancelled.entry,
    balance: cancelled.balance,
    message: CANCELLATION_MESSAGES.cancelled(cancelled.entry.amount),
  };
});

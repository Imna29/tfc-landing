import { LOCK_MESSAGES } from "#shared/locks";
import { PRICING_MESSAGES } from "#shared/pricing";

/**
 * Locks a Bout: the moment it stops taking Predictions.
 *
 * One Bout at a time and named by its id, which is both of the things ADR-0006
 * asks an admin to be able to do. Advancing the lock as a card progresses is
 * locking the next Bout on it; closing one early — a fighter withdrew, a
 * lineup changed an hour out — is locking that Bout and leaving the rest of
 * the card alone. There is deliberately no "lock everything up to here": it
 * would make the early close the dangerous button, and the backstops behind
 * this route already catch the Bout an admin walked past.
 *
 * Naming the Bout is also what makes the console safe to use cageside (#20): a
 * double-tap posts the same id twice, and the second press is told the Bout
 * has locked rather than locking the next fight on the card.
 *
 * The Locks that have fallen due are applied first, so that an admin pressing
 * this on a Bout the clock has already closed is told so, and the log keeps
 * the moment it actually closed at rather than gaining their name against it.
 *
 * There is no route the other way. ADR-0006 makes a Lock final, and
 * `a_locked_bout_is_never_reopened` holds it in Postgres — a Bout reopened
 * after being fought is a Bout somebody can commit Coins to knowing the
 * result.
 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event);

  await applyAutomaticLocks();

  const id = getRouterParam(event, "id");
  const bout = looksLikeId(id) ? await boutToPrice(id) : null;

  if (!bout) throw refuse(404, PRICING_MESSAGES.boutNotFound);
  if (bout.status === "locked") throw refuse(409, LOCK_MESSAGES.alreadyLocked);
  if (bout.status !== "open") throw refuse(409, LOCK_MESSAGES.notOpen);

  // Another admin, or the sweep, locked it between the question above and this
  // write. `lockBout` answers false rather than raising, because the Bout is
  // in exactly the state this request wanted it in.
  const locked = await lockBout(useDatabase(), {
    boutId: bout.id,
    kind: "manual",
    by: admin.id,
  });

  if (!locked) throw refuse(409, LOCK_MESSAGES.alreadyLocked);

  const closed = await boutToPrice(bout.id);

  // A re-import cannot have taken it: a Bout that is not closed is not
  // replaceable (ADR-0001). Answered as a missing Bout anyway rather than as a
  // success with nothing in it, the way opening one does.
  if (!closed) throw refuse(409, PRICING_MESSAGES.boutNotFound);

  return { bout: closed };
});

function refuse(statusCode: number, message: string) {
  return createError({ statusCode, statusMessage: "The Bout was not locked", message });
}

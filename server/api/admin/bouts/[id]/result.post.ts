import { PRICING_MESSAGES } from "#shared/pricing";
import { RESULT_MESSAGES, parseEnding } from "#shared/results";

/**
 * Entering how a Bout ended: the moment Coins move.
 *
 * The highest-consequence button in the product. Everything behind it happens
 * in one transaction — the Bout locks if it is still open, the Result is
 * written, the Bout settles, every Entry riding on it is graded and the
 * Rewards are paid — so that there is no state in which some of that happened
 * and the rest did not. `settleBout` in `server/utils/results.ts` is where that
 * is argued; this is the half that decides what an admin is told.
 *
 * The refusals are in the order an admin meets them: whether the Bout is one,
 * whether it is at a point where a result means anything, and only then whether
 * the result is one this Bout could have produced. Each is asked again
 * underneath — by the `bout_results` primary key, by the trigger that refuses a
 * Result on a Bout nobody opened, and by the key holding its round to one the
 * Bout offered — because two admins at cageside can press this in the same
 * second.
 *
 * A Bout that produced nothing gradable comes through here too, as a No Result
 * naming which of ADR-0005's four it was. It settles by exactly the same path
 * and for the same reason: every Prediction on it contributes ×1.0 rather than
 * losing, and an Entry left with nothing else to decide has its Amount
 * returned in full — which is Coins moving, so it belongs in the one
 * transaction with the rest of it.
 *
 * A Bout still open is settled rather than refused, and locked on the way
 * through. That is #12's last criterion and it lands here: an admin who reaches
 * the result before they reach the Lock has still stopped the Bout taking
 * Predictions, and the log records it as a `result` Lock against their name.
 *
 * There is no route the other way, and no second press. Correcting a result
 * that was entered wrong reverses what it settled and grades again (#16),
 * which is ADR-0003's whole shape: the mistake and its correction both stay
 * visible.
 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event);

  // The Locks that have fallen due, written before the Bout is read, so that an
  // admin entering a result on a Bout the sweep has already closed sees the
  // moment it actually closed rather than gaining their name against it.
  await applyAutomaticLocks();

  const id = getRouterParam(event, "id");
  const bout = looksLikeId(id) ? await boutToPrice(id) : null;

  if (!bout) throw refuse(404, PRICING_MESSAGES.boutNotFound);
  if (bout.status === "settled") throw refuse(409, RESULT_MESSAGES.alreadySettled);
  // A Bout nobody opened took no Predictions, so there is nothing for a result
  // to decide — and settling it would close the door on ever opening it. That
  // holds for a No Result too, cancellation included: a Bout that never opened
  // is taken off the card by re-importing it (ADR-0001), which is the door
  // this refusal is keeping open rather than the one it is shutting.
  if (bout.status === "closed") throw refuse(409, RESULT_MESSAGES.boutNotOpened);

  const { ending, problem } = parseEnding(await readBody(event), bout);

  if (problem !== undefined) throw refuse(422, problem);

  const settled = await settleBout(bout, ending, admin.id);

  if (settled.refusal) throw refuse(settled.refusal.status, settled.refusal.problem);

  const graded = await boutToPrice(bout.id);

  // A re-import cannot have taken it: a Bout that is not closed is not
  // replaceable (ADR-0001). Answered as a missing Bout anyway rather than as a
  // success with nothing in it, the way locking one does.
  if (!graded) throw refuse(409, PRICING_MESSAGES.boutNotFound);

  return { bout: graded, settlement: settled.settlement };
});

function refuse(statusCode: number, message: string) {
  return createError({ statusCode, statusMessage: "The result was not entered", message });
}

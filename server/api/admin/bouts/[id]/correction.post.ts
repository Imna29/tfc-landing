import { PRICING_MESSAGES } from "#shared/pricing";
import { RESULT_MESSAGES, parseEnding } from "#shared/results";

/**
 * Correcting a result that was entered wrong, once Entries have already
 * settled against it.
 *
 * A route of its own rather than a second press of the one next door, and that
 * is the point of it. Entering a result is a statement about a fight nobody
 * has been paid on yet; this takes Coins back off fans who have already been
 * told they won, on a Bout the game is finished with — so it is a different
 * request, with a different sentence in front of it and a different thing to
 * be sure of before pressing.
 *
 * Everything behind it is one transaction (`correctResult` in
 * `server/utils/corrections.ts`): the Result the Bout used to be recorded as
 * is written to the audit log, the row is updated to the corrected one, every
 * Coin Transaction that is no longer right is reversed, and every Entry on the
 * Bout is graded again. There is no state in which some of that happened and
 * the rest did not — a correction that reversed the Rewards and did not re-pay
 * them would be worse than the mistake it was fixing.
 *
 * The refusals are the two an admin can actually meet: a Bout that has nothing
 * entered about it yet, which is the result form's job rather than this one's,
 * and a result that could not be what happened. Both are asked again inside
 * the transaction, under the row lock, because two admins can press this in
 * the same second.
 *
 * The Bout is not re-opened, re-locked, or unsettled by any of it. It stopped
 * taking Predictions when it stopped taking Predictions (ADR-0006), and
 * `a_locked_bout_is_never_reopened` refuses every move off `settled` in any
 * case: what was wrong is the record of the fight, not the fact that it is
 * over.
 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event);

  const id = getRouterParam(event, "id");
  const bout = looksLikeId(id) ? await boutToPrice(id) : null;

  if (!bout) throw refuse(404, PRICING_MESSAGES.boutNotFound);

  // Deliberately no `applyAutomaticLocks` first, unlike the routes beside this
  // one. Every Lock a sweep could apply fell due long before a Bout reached
  // `settled`, and this route cannot lock anything: it is the one admin action
  // that happens after the card is over.
  if (bout.status !== "settled") throw refuse(409, RESULT_MESSAGES.notSettled);

  const { ending, problem } = parseEnding(await readBody(event), bout);

  if (problem !== undefined) throw refuse(422, problem);

  const corrected = await correctResult(bout, ending, admin.id);

  if (corrected.refusal) throw refuse(corrected.refusal.status, corrected.refusal.problem);

  const graded = await boutToPrice(bout.id);

  // A re-import cannot have taken it: a Bout that is not closed is not
  // replaceable (ADR-0001). Answered as a missing Bout anyway rather than as a
  // success with nothing in it, the way entering a result does.
  if (!graded) throw refuse(409, PRICING_MESSAGES.boutNotFound);

  return { bout: graded, correction: corrected.correction };
});

function refuse(statusCode: number, message: string) {
  return createError({ statusCode, statusMessage: "The result was not corrected", message });
}

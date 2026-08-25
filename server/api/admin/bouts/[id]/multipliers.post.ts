import { parseMultipliers, PRICING_MESSAGES } from "#shared/pricing";

/**
 * Prices a Bout: the Multipliers an admin set on its Outcomes, and the record
 * that they were set rather than seeded.
 *
 * ADR-0002 makes this the whole pricing model — there is no pool to correct a
 * number nobody looked at, and a mispriced Outcome is exploitable until
 * somebody notices. What bounds the damage is the ×100 combined cap and the
 * ten-Prediction limit; what prevents it is this being done at all, before the
 * Bout opens.
 *
 * A save is refused whole: one Multiplier that is not a price refuses all of
 * them, before anything is written. A Bout priced in part reads as priced, and
 * would then be a Bout somebody opens.
 *
 * Repricing an open Bout is deliberately allowed: a Prediction carries a copy
 * of the Multiplier it was submitted at (ADR-0002), so correcting a number
 * changes what the next Entry is offered and never an Entry that exists.
 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event);

  const id = getRouterParam(event, "id");
  const bout = looksLikeId(id) ? await boutToPrice(id) : null;

  if (!bout) throw refuse(404, PRICING_MESSAGES.boutNotFound);

  const { multipliers, problem } = parseMultipliers((await readBody(event))?.multipliers);

  if (problem !== undefined) throw refuse(422, problem);

  // Asked here so that an admin is told what was wrong with the save. The
  // statement refuses an Outcome on another Bout regardless of this.
  const onThisBout = new Set(bout.outcomes.map((outcome) => outcome.id));

  if (multipliers.some(({ outcomeId }) => !onThisBout.has(outcomeId))) {
    throw refuse(422, PRICING_MESSAGES.notThisBout);
  }

  const priced = await priceOutcomes(bout.id, multipliers, admin.id);
  const repriced = await boutToPrice(bout.id);

  // A re-import replaced the card while this was in flight. It deletes the
  // Bout, and every Outcome on it goes with it, so what did not match here is
  // not a Bout priced in part — it is a Bout that no longer exists. Nothing is
  // wrong with what the admin typed; it belongs to a different Bout now.
  if (!repriced || priced < multipliers.length) throw refuse(409, PRICING_MESSAGES.boutNotFound);

  return { bout: repriced };
});

function refuse(statusCode: number, message: string) {
  return createError({ statusCode, statusMessage: "The Bout was not priced", message });
}

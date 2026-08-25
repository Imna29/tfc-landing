import { PRICING_MESSAGES } from "#shared/pricing";

/**
 * Opens a Bout for predictions: the moment fans can commit Coins against it.
 *
 * One Bout at a time rather than a whole card, because that is how a card is
 * priced and how it is locked again during the event (ADR-0006) — and because
 * a card is rarely ready all at once, a late replacement on one Bout leaving
 * the rest of it perfectly openable.
 *
 * It is also the door ADR-0001 shuts: from here the card can no longer be
 * re-imported, because fans hold Coins against these rows.
 *
 * Both refusals are asked about before the write, so that an admin is told
 * which one it was. The one that matters is asked twice — Postgres refuses to
 * open a Bout with an unpriced Outcome whatever this route believed a moment
 * earlier.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const id = getRouterParam(event, "id");
  const bout = looksLikeId(id) ? await boutToPrice(id) : null;

  if (!bout) throw refuse(404, PRICING_MESSAGES.boutNotFound);
  if (bout.status !== "closed") throw refuse(409, PRICING_MESSAGES.alreadyOpen);
  if (!bout.priced) throw refuse(409, PRICING_MESSAGES.unpriced);

  try {
    // Another admin opened it between the question above and this write.
    if (!(await openBout(bout.id))) throw refuse(409, PRICING_MESSAGES.alreadyOpen);
  } catch (error) {
    // An Outcome was still unpriced, or a re-import took the Outcomes away.
    if (refusedByConstraint(error, BOUTS_ARE_OPENED_ONLY_WHEN_PRICED)) {
      throw refuse(409, PRICING_MESSAGES.unpriced);
    }

    throw error;
  }

  const opened = await boutToPrice(bout.id);

  if (!opened) throw refuse(409, PRICING_MESSAGES.boutNotFound);

  return { bout: opened };
});

function refuse(statusCode: number, message: string) {
  return createError({ statusCode, statusMessage: "The Bout was not opened", message });
}

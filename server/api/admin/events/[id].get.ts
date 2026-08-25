import { PRICING_MESSAGES } from "#shared/pricing";

/**
 * One imported card, with every Question its Bouts ask and what each answer
 * currently pays.
 *
 * Read from Postgres alone, never from Prismic. This is the card the game runs
 * on (ADR-0001): the Bout ids here are what a Prediction will point at, and
 * the Multipliers are what a fan will be shown before they commit.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const id = getRouterParam(event, "id");
  const card = looksLikeId(id) ? await cardToPrice(id) : null;

  if (!card) {
    throw createError({
      statusCode: 404,
      statusMessage: "That card is not in the game",
      message: PRICING_MESSAGES.cardNotImported,
    });
  }

  return card;
});

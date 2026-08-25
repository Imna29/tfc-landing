import { EVENT_MESSAGES } from "#shared/events";

/**
 * Imports a card out of Prismic and into Postgres, or says why it cannot be.
 *
 * This is the moment ADR-0001 turns on. Before it, a card is content: an
 * editor can rewrite a Bout, drop a fighter, move the date, and nothing is at
 * risk. After it, the Bouts in Postgres are what the game runs on, and once
 * one of them is open, this route refuses to touch the card at all.
 *
 * Every refusal is asked about before anything is written, so that an admin is
 * told which one it was and what to go and fix — a card missing a division on
 * its third Bout is a five-second edit in Prismic, if somebody says so. The
 * one that matters is asked twice: the database refuses to replace an opened
 * Bout whatever this route believed a moment earlier.
 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event);

  const prismicId = (await readBody(event))?.prismicId;

  if (typeof prismicId !== "string" || prismicId.trim() === "") {
    throw refuse(422, EVENT_MESSAGES.cardNotChosen);
  }

  const season = await currentSeason();

  if (!season) throw refuse(409, EVENT_MESSAGES.noSeasonOpen);

  // Asked before Prismic is, because it is the refusal that cannot be worked
  // around: telling an admin to go and fix a division on a card that can no
  // longer be re-imported at all would send them to edit a document for
  // nothing.
  const already = await importedCard(prismicId);

  if (already && already.openedBouts > 0) throw refuse(409, EVENT_MESSAGES.alreadyOpened);

  const fetched = await fetchCard(prismicId);

  if (!fetched) throw refuse(404, EVENT_MESSAGES.notInPrismic);

  const { card, problem } = readCard(fetched.event, fetched.referenced);

  if (problem !== undefined) throw refuse(422, problem);

  try {
    const imported = await importCard(card, { seasonId: season.id, importedBy: admin.id });

    setResponseStatus(event, 201);

    return { event: imported, season: { name: season.name } };
  } catch (error) {
    // A Bout was opened between the question above and this transaction, or
    // by another admin while it ran.
    if (refusedByConstraint(error, BOUTS_ARE_REPLACED_ONLY_WHILE_CLOSED)) {
      throw refuse(409, EVENT_MESSAGES.alreadyOpened);
    }

    throw error;
  }
});

function refuse(statusCode: number, message: string) {
  return createError({ statusCode, statusMessage: "The card was not imported", message });
}

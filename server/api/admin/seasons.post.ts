import { SEASON_MESSAGES, parseSeasonName } from "#shared/seasons";

/**
 * Opens a Season: the one action in this application that brings Coins into
 * existence, and the only one.
 *
 * There is no companion route that adds Coins to a fan, and none is coming.
 * Everything after this moves Coins that already exist — a commitment out of a
 * Balance, a Reward back into it — so the whole economy of a Season is decided
 * here, once, by the number of fans multiplied by their starting Balance. That
 * is what the Season rules' "no mid-Season top-ups" means in code: not a check
 * somewhere, but the absence of anywhere to write.
 *
 * Both refusals are asked about before the transaction opens, so that an admin
 * is told which one it was. The database refuses both anyway — see
 * {@link openSeason}.
 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event);

  const parsed = parseSeasonName((await readBody(event))?.name);

  if (parsed.problem !== undefined) throw refuse(422, parsed.problem);
  if (await currentSeason()) throw refuse(409, SEASON_MESSAGES.alreadyOpen);
  if (await seasonNameTaken(parsed.name)) throw refuse(409, SEASON_MESSAGES.nameTaken);

  try {
    const { season, fansGranted } = await openSeason({
      name: parsed.name,
      openedBy: admin.id,
    });

    setResponseStatus(event, 201);

    return { season, fansGranted };
  } catch (error) {
    // Two admins in the same second: both were told nothing was open, and
    // Postgres decided between them.
    if (refusedByConstraint(error, "seasons_one_open"))
      throw refuse(409, SEASON_MESSAGES.alreadyOpen);
    if (refusedByConstraint(error, "seasons_name_unique"))
      throw refuse(409, SEASON_MESSAGES.nameTaken);

    throw error;
  }
});

function refuse(statusCode: number, message: string) {
  return createError({ statusCode, statusMessage: "The Season was not opened", message });
}

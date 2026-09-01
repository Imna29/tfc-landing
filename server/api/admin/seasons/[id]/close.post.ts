import { CLOSE_MESSAGES } from "#shared/seasons";

/**
 * Closes a Season: the moment its standings stop being a scoreboard and become
 * a record.
 *
 * The other half of `POST /api/admin/seasons`, and the higher-consequence half.
 * Opening a Season decides its economy; this decides what it finished as, and
 * that answer is what TFC awards Prizes from (ADR-0007). It cannot be pressed
 * twice and there is no route back — `a_closed_season_is_never_reopened`
 * refuses even a hand-typed `update`, for the reason ADR-0006 makes a Lock
 * final.
 *
 * The refusal an admin will actually meet is the third one, and it is the
 * reason this route exists rather than a `status` field on the one above: a
 * Season with a Bout still open or still waiting on a result would freeze
 * Balances that are about to move, so the refusal names every Bout that is
 * outstanding and which card it is on. That question is asked once, inside
 * {@link closeSeason}'s transaction, and the same read both decides and writes
 * the sentence — so what an admin is told is what was true at the moment the
 * close was refused.
 *
 * Nothing here resets a Balance. A Season closing leaves every fan holding what
 * they finished on, in a Season nobody is playing; opening the next one is what
 * puts them all back on a hundred Coins, and it is deliberately a second
 * decision an admin makes.
 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event);

  // The Locks that have fallen due, written before any Bout is read, the way
  // every other admin route that cares where a Bout is does it (`CONTEXT.md`
  // on the sweep). It changes no answer — an open Bout and a locked one both
  // refuse a close — but it changes the refusal: a Bout the card closed on its
  // own hours ago is named as locked rather than as still taking Predictions,
  // which is the difference between an admin going to enter a result and an
  // admin going to look for a Bout nobody can predict on any more.
  await applyAutomaticLocks();

  const id = getRouterParam(event, "id");
  const season = looksLikeId(id) ? await seasonById(id) : null;

  if (!season) throw refuse(404, CLOSE_MESSAGES.notFound);
  if (season.status !== "open") throw refuse(409, CLOSE_MESSAGES.notOpen);

  const closed = await closeSeason({ seasonId: season.id, closedBy: admin.id });

  if (closed.refusal) throw refuse(closed.refusal.status, closed.refusal.problem);

  return { season: closed.season, fansRanked: closed.fansRanked };
});

function refuse(statusCode: number, message: string) {
  return createError({ statusCode, statusMessage: "The Season was not closed", message });
}

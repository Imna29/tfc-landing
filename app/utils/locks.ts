import { LOCK_KIND_LABELS, type BoutLock } from "#shared/locks";

/**
 * How a Bout came to be locked, in one line: what did it, when, and — where
 * somebody's action did it — who.
 *
 * The Lock audit log as an admin reads it, and written once because two screens
 * show it for the same reason: a fan is unhappy about one fight, and somebody
 * has to be able to say what closed it and when. `/admin/events/[id]` shows it
 * down the card after the event; the live lock console shows it while the card
 * is still being fought.
 *
 * The moment is the one the Bout stopped taking Predictions at, which is the
 * only moment a fan asking about it cares about. A Lock the clock performed
 * names nobody — putting the admin who happened to be signed in against the
 * card's own work would make the log answer a question nobody asked.
 *
 * Takes a Bout's Lock as it arrives, null and all, so neither page has to ask
 * whether there is one before asking what it says.
 */
export function lockLine(lock: BoutLock | null): string | null {
  if (!lock) return null;

  return [LOCK_KIND_LABELS[lock.kind], inTbilisi(lock.at), lock.by].filter(Boolean).join(" · ");
}

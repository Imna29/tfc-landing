/**
 * The live lock console: one fight card as an admin runs it, cageside, on a
 * phone, while it is being fought.
 *
 * ADR-0006 keeps later Bouts open while earlier ones are fought, and pays for
 * it with an admin advancing the Lock down the card by hand — someone standing
 * in a dark arena, watching the fights, holding a phone in one hand. Every
 * other admin screen is a form they sit down in front of before a card
 * (ADR-0011); this is the one they use during it, and the only one that gets a
 * design pass.
 *
 * So what the console holds is deliberately thin: which fights, in what order,
 * where each has got to, and which one to close next. What a Bout pays, who
 * priced it and what it settled as are questions for a desk, and every one of
 * them on this screen is a line an admin has to read past to find the button.
 *
 * Shared for the same reason `shared/locks.ts` is: the server decides what the
 * console shows and the page says it in these words, and
 * `test/unit/vocabulary.test.ts` holds all of it to `CONTEXT.md` at once.
 */
import type { BoutStatus } from "./events";
import type { BoutLock, CardLockKind } from "./locks";
import { boutState } from "./predictions";

/** One Bout of the card being fought, as the console lists it. */
export interface ConsoleBout {
  id: string;
  cardOrder: number;
  /** The name each corner is fought under, which is how it is called out. */
  redName: string;
  blueName: string;
  mainEvent: boolean;
  status: BoutStatus;
  /**
   * How it came to be locked, or null while it has not.
   *
   * The audit log, on the screen where the locking happens: an admin who
   * looked away for two fights reads which Bouts closed behind them and what
   * closed each — their own press, the card starting, or the backstop.
   */
  lock: BoutLock | null;
  /**
   * The moment this Bout locks by itself if nobody locks it first.
   *
   * Every Bout has one, unlike the card a fan reads: `locksAt` in
   * `shared/predictions.ts` deliberately counts a fan down only to the Lock the
   * card performs at its scheduled start, because the sweep behind every other
   * Bout is hours out and will almost never be the moment. An admin is the
   * person that is not true for. The sweep is the deadline they are working
   * against, and a console that hid it would hide the one number that says how
   * long they have.
   */
  locksAt: string;
  /**
   * What that Lock will be recorded as when it falls due: the card starting, or
   * the backstop behind it.
   *
   * The other half of {@link locksAt}, kept as a second field rather than the
   * `AutomaticLock` the server works both out from, so that a Bout listed here
   * is a shape `boutState` can read on its own.
   *
   * It is what lets the console say *why* a Bout has just locked in the seconds
   * before anything has written the Lock down. The backstops fall due while
   * nobody is looking and the row arrives with the next read, and first bell is
   * exactly when an admin is watching this screen — a Bout that says it has
   * locked and will not say why is the question this console exists to answer.
   */
  locksAs: CardLockKind;
}

/** The card being fought, as the console reads it. */
export interface LockConsole {
  eventId: string;
  title: string;
  venue: string;
  scheduledStart: string;
  /**
   * The moment every Bout still open locks regardless.
   *
   * Sent rather than worked out here, because how long the window is is
   * configuration the server reads (`sweepWindow` in `server/utils/locks.ts`)
   * and a page that computed it from a default of its own would count an admin
   * down to the wrong moment on the card TFC shortened it for.
   */
  sweepAt: string;
  /**
   * The server's clock when it answered, which the countdown starts from.
   *
   * For the reason `CardPredictions.answeredAt` carries one: a clock started in
   * the browser renders one number on the server and another a moment later in
   * the hydrating page.
   */
  answeredAt: string;
  /** Every Bout on the card, in the order they are fought. */
  bouts: ConsoleBout[];
}

/**
 * The Bout an admin locks next, or null when there is none to lock.
 *
 * The open Bout fought first, which is what "advance the Lock" means: Bouts
 * lock in card order as the card progresses (ADR-0006), so at any moment there
 * is exactly one Bout an admin could sensibly be about to close. Saying so here
 * is what makes the console a single button rather than a list of them —
 * "unambiguous" is the acceptance criterion, and ambiguity in a dark arena is
 * an admin locking the wrong fight.
 *
 * A Bout nobody has opened is passed over rather than offered: locking one is
 * refused, because a Bout that never took Predictions has nothing to stop
 * taking. So is a Bout whose own automatic moment has already passed — the row
 * saying so is written by the next request to arrive, and until then the column
 * still says open. Offering that one would be offering a press about to be
 * refused, on the one screen where a wasted press costs the fight the admin was
 * actually trying to close.
 */
export function nextToLock(bouts: readonly ConsoleBout[], now: number): ConsoleBout | null {
  const open = bouts.filter((bout) => boutState(bout, now) === "open");

  return open.reduce<ConsoleBout | null>(
    (next, bout) => (next === null || bout.cardOrder < next.cardOrder ? bout : next),
    null,
  );
}

/**
 * Whether the card has started, which is what decides how many presses a Lock
 * takes.
 *
 * The console is the screen of an evening in progress: the card is being
 * fought, the next Bout is walking out, and closing it is one press because
 * that is what the screen is for. Before the scheduled start it is the same
 * screen with the same control on it and a completely different meaning —
 * locking a Bout then closes a fight days out from being fought, and a Lock is
 * never taken back.
 *
 * So the control is armed by the card rather than by an admin remembering which
 * of the two they are looking at. An early Lock is still theirs to make
 * cageside — a card running ahead of schedule is exactly the case ADR-0006
 * gives them the override for — it just costs a second press.
 *
 * The scheduled start rather than a window before it, because that moment is
 * already the one the card turns on: it is when the Bout fought first locks by
 * itself.
 */
export function hasStarted(card: { scheduledStart: string }, now: number): boolean {
  return Date.parse(card.scheduledStart) <= now;
}

/**
 * What the console says to the admin running a card from it.
 *
 * Written without apostrophes, deliberately, for the reason
 * `LOCK_KIND_LABELS` gives: these are rendered into a page as text, where Vue
 * escapes one to `&#39;` — invisible to a reader and highly visible to the test
 * that checks the right sentence is on the screen.
 */
export const CONSOLE_MESSAGES = {
  /**
   * The one control, named by the Bout it closes.
   *
   * The place rather than the two fighters, because the place is what the
   * button *does* — locking is per Bout and Bouts lock in card order — and the
   * names are underneath it as the check that it is the right fight.
   */
  lock: (cardOrder: number) => `Lock Bout ${cardOrder}`,
  /** The same control on a card that has not started, which asks twice. */
  lockEarly: (cardOrder: number) => `Lock Bout ${cardOrder} early`,
  confirmEarly: (cardOrder: number) => `Press again to lock Bout ${cardOrder}`,
  early:
    "This card has not started. Locking a Bout now closes it before it is " +
    "fought, and a Lock is never taken back — so it takes two presses.",
  locking: "Locking…",
  locked: (cardOrder: number) => `Bout ${cardOrder} has locked`,
  /** After a press the card refused, which is a press that found it moved. */
  moved: "The card moved. Read it before pressing again",
  sweep: "Everything still open locks by itself in",
  noCard:
    "No card is being fought. This screen is for the evening of an Event: the " +
    "card appears here from the moment it is imported, and leaves once the " +
    "backstop behind it has closed every Bout on it.",
  everythingLocked:
    "Every Bout on this card has locked. Nothing on it takes Predictions any " +
    "more, and a Lock is never taken back.",
  nothingOpen:
    "No Bout on this card is open for predictions, so there is nothing to " +
    "lock. Bouts are priced and opened from the card itself, at a desk, before " +
    "the evening starts.",
} as const;

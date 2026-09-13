import { readAnswer, type OutcomeAnswer } from "#shared/pricing";

/**
 * What a fan has answered on the card, by the Bout it answers.
 *
 * The card tells a visitor with no account to sign in *before* they answer a
 * Bout (`shared/signIn.ts`), and promises in so many words that the answers they
 * have already given are still there when they come back. This is what makes
 * that sentence true. It is the only reason the answers live anywhere but in the
 * page: a promise the product makes in a paragraph a fan reads has to be kept by
 * something, and before this it was kept by nothing.
 *
 * Two layers, because the answers have to survive two different things.
 * {@link Picks.picks} is `useState`, which carries them across a client-side
 * navigation — the card to the sign-in form and back, which is the trip the
 * prompt actually sends a fan on. `sessionStorage` underneath it carries them
 * across a *reload* of either page: the fan who refreshes the form, the one
 * whose chunk failed to load, the one who came back tomorrow to a restored tab.
 * Neither covers the other, and the promise is unconditional.
 *
 * Deliberately `sessionStorage` rather than `localStorage`. Answers are worth
 * keeping for as long as a fan is sitting with the card open; a card they
 * half-answered a fortnight ago is a card that has been fought, and restoring it
 * would be showing them Bouts with results. The Event ends the Season's
 * relevance long before the tab does — and a card that has moved on drops the
 * answers it no longer offers anyway (`draft` in
 * `app/pages/predictions/index.vue`), so what survives is only ever answers the
 * game is still taking.
 *
 * Three verbs beyond the state, shaped after {@link useBalance} for the same
 * reason: this outlives every page that touches it, so the moments it changes
 * have to say so. {@link Picks.keep} is "make sure we have them and go on
 * writing them", for the page the card is on; {@link Picks.answer} and
 * {@link Picks.clear} are the card being played; {@link Picks.forget} is "these
 * are not this person's answers", for a fan signing out on a browser somebody
 * else is about to use.
 */
export function useCardPicks() {
  const picks = useState<Record<string, OutcomeAnswer>>("card-picks", () => ({}));

  /** Takes the answer the card just gave, or drops the Bout from the Entry. */
  function answer(boutId: string, pick: OutcomeAnswer | null) {
    const answered = { ...picks.value };

    if (pick === null) {
      delete answered[boutId];
    } else {
      answered[boutId] = pick;
    }

    picks.value = answered;
  }

  /** Takes every answer back, for a fan starting the card again. */
  function clear() {
    picks.value = {};
  }

  /**
   * Restores what a reload would otherwise have lost, and keeps writing them.
   *
   * After mount, never during server rendering: `sessionStorage` is the
   * browser's, and reading it while rendering is both impossible and the wrong
   * question — the server has no idea what this fan has answered, which is why
   * the HTML it sends is always a card with nothing on it.
   *
   * Memory wins where both have something. A fan arriving from the sign-in form
   * held their answers the whole way in `useState`, and that is the more recent
   * of the two by definition; the stored copy is only ever the fallback for an
   * app instance that started from nothing.
   */
  function keep() {
    onMounted(() => {
      if (Object.keys(picks.value).length === 0) {
        const kept = read();

        if (kept !== null) picks.value = kept;
      }

      // Every change, because every change is one the fan made: `answer`
      // replaces the whole record rather than mutating it, so a shallow watch
      // sees all of them.
      watch(picks, write);
    });
  }

  /** Forgets them, for a fan who has just signed out. */
  function forget() {
    picks.value = {};

    if (import.meta.client) write({});
  }

  return { picks, answer, clear, keep, forget };
}

/**
 * Where the answers are kept, named for the game rather than for the page.
 *
 * `sessionStorage` is one namespace for the whole origin, and TFC's marketing
 * site shares that origin.
 */
const KEPT_UNDER = "tfc-card-picks";

/** The answers this tab was holding, or null if it was holding none it can use. */
function read(): Record<string, OutcomeAnswer> | null {
  try {
    const kept = sessionStorage.getItem(KEPT_UNDER);

    if (kept === null) return null;

    const parsed: unknown = JSON.parse(kept);

    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;

    const answers = Object.entries(parsed).flatMap(([boutId, stored]) => {
      const answer = readAnswer(stored);

      return answer === null ? [] : ([[boutId, answer]] as const);
    });

    return answers.length === 0 ? null : Object.fromEntries(answers);
  } catch {
    // A browser that refuses storage, and a stored value that is not JSON, are
    // the same thing to a fan: a card with nothing answered on it, which is
    // where they would have been anyway.
    return null;
  }
}

/** Files them where a reload of this tab will find them again. */
function write(answered: Record<string, OutcomeAnswer>) {
  try {
    sessionStorage.setItem(KEPT_UNDER, JSON.stringify(answered));
  } catch {
    // Private browsing, or a quota. Nothing is owed to the fan here: the
    // answers are still in front of them, and all that is lost is surviving a
    // reload they may never do.
  }
}

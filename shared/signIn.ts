/**
 * What the game says to somebody answering the card without an account.
 *
 * The card is open to a visitor on purpose. Reading it, weighing up what each
 * answer pays and answering a Bout all need no account, because a card that
 * did nothing until a fan had one is a worse way into the game than one they
 * can play with straight away — `app/components/FightCardBout.vue` carries that
 * decision where it is applied.
 *
 * What the game got wrong was *when* it said the rest. The requirement arrived
 * as a red line under the Submit button, after a fan had answered nine Bouts
 * and decided what to commit: at that moment it is a refusal, and the work
 * leading up to it was wasted. Said before they start, the same fact is an
 * instruction worth following. So the sentences below are written twice — once
 * for a visitor who has not answered anything yet, and once for one who has
 * anyway — and `app/components/SignInToPlay.vue` shows whichever applies from
 * the top of the card.
 *
 * A module of its own rather than a corner of `shared/entries.ts`, which is the
 * rules of an Entry: this is about the account behind it, and it is read by the
 * card, the Bout and the panel alike. Shared so that
 * `test/unit/vocabulary.test.ts` holds it to `CONTEXT.md` like any other copy.
 */
import { coinsLabel, STARTING_BALANCE } from "./coins";

/**
 * Where a visitor is, which is the only thing that changes what to say.
 *
 * Two states rather than a boolean, because the two sentences are doing
 * different jobs: `reading` is advice, given while taking it is still free, and
 * `answered` is a visitor who has something to lose and needs to know they will
 * not lose it.
 *
 * `answered` rather than the "answering" it reads more naturally as, because
 * `app/components/FightCardBout.vue` already has an `answering` that means
 * something else — whether a Bout *may* be answered — and one word for two facts
 * in one feature is how the wrong one gets read.
 */
export type VisitorStanding = "reading" | "answered";

/** The prompt a visitor is shown, or nothing at all for a signed-in fan. */
export interface SignInPrompt {
  standing: VisitorStanding;
  /** The line it leads with, short enough to be read at a glance. */
  headline: string;
  /** What needs the account, and what happens to the answers meanwhile. */
  detail: string;
}

/**
 * The two things the game has to say, and the three short labels around them.
 *
 * Both sentences name what a visitor may do *without* an account as well as
 * what they may not. A prompt that only said "sign in" would read as a card
 * that cannot be looked at, which is the opposite of the decision above.
 */
export const SIGN_IN_MESSAGES = {
  /**
   * Said before a visitor has answered anything — the whole point of it.
   *
   * Close kin to `ENTRY_MESSAGES.signIn` in `shared/entries.ts` and deliberately
   * not the same sentence. That one is the refusal the API answers a Prediction
   * with when no session arrived: a statement of a rule, to somebody who has
   * already run into it. This is the instruction, to somebody who still has time
   * to take it — so it leads with what a visitor may do rather than with what
   * they may not.
   */
  reading: {
    headline: "Sign in before you answer a Bout",
    detail:
      "The card asks nothing of a visitor: reading it and answering it need no " +
      "account at all. Committing Coins to an Entry is the part that does — so " +
      "signing in now means what you build is one press from committed.",
  },
  /** Said to the visitor who answered first and asked afterwards. */
  answered: {
    headline: "Sign in to commit what you have answered",
    detail: (answered: number) =>
      `${answered} ${answered === 1 ? "Bout is" : "Bouts are"} answered, and ` +
      "they stay on the card while you sign in. Committing Coins to an Entry " +
      "is the one part of TFC Predictions that needs an account, and playing " +
      `is free — every fan starts a Season on ${coinsLabel(STARTING_BALANCE)}.`,
  },
  /**
   * The one line the Bout a visitor just answered carries.
   *
   * It is here because this is where they are looking. The prompt at the top of
   * the card is off screen by the third Bout, and a fan working down a
   * ten-Bout card would answer all of it before reading a word of it.
   */
  onTheBout: "Answered. Committing Coins to it needs an account.",
  /**
   * What the panel's own action says while there is no account behind it.
   *
   * The button used to say "Submit Entry" and then refuse. It now says this and
   * goes to the form, because a control that cannot do what it is labelled is
   * the thing being fixed.
   */
  action: "Sign in to commit",
  /**
   * What the form says to somebody the card sent to it.
   *
   * The card promises the answers survive the trip, and a fan who arrives at a
   * bare email box has lost the thread of why they are there. Said on both
   * forms, because either one gets a fan back to the card with an account.
   */
  backToTheCard:
    "You will be taken straight back to the card, with every answer you had " +
    "already given still on it.",
  /** The two ways to get an account, wherever both are offered. */
  signIn: "Sign in",
  createAccount: "Create an account",
} as const;

/**
 * What to say to whoever is holding the card, or null if they are signed in.
 *
 * Takes the count of answers rather than the answers themselves, so that the
 * number it names is the number the panel shows — the page hands it the priced
 * draft, which is what the Entry actually holds once answers the card no longer
 * offers have been dropped.
 */
export function signInPrompt(signedIn: boolean, answered: number): SignInPrompt | null {
  if (signedIn) return null;

  if (answered < 1) {
    return { standing: "reading", ...SIGN_IN_MESSAGES.reading };
  }

  return {
    standing: "answered",
    headline: SIGN_IN_MESSAGES.answered.headline,
    detail: SIGN_IN_MESSAGES.answered.detail(answered),
  };
}

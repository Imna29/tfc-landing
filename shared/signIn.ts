/**
 * What the game says to somebody answering the card without an account.
 *
 * The card is open to a visitor on purpose. Reading it, weighing up what each
 * answer pays and answering a Bout all need no account, because a card that
 * did nothing until a fan had one is a worse way into the game than one they
 * can play with straight away — `app/components/FightCardBout.vue` carries that
 * decision where it is applied.
 *
 * What the game got wrong was *when* it said the rest. The requirement used to
 * arrive as a red line under the Submit button, after a fan had answered nine
 * Bouts and decided what to commit: at that moment it is a refusal, and the
 * work leading up to it was wasted. So the sentences below are said where the
 * fact is about something in front of the fan — on the Bout they just answered,
 * and on the panel's own button, which goes to the form rather than refusing.
 * None of them is a notice above the card: a standing paragraph a fan has to
 * read past to reach the thing they came for was the other way of getting this
 * wrong.
 *
 * A module of its own rather than a corner of `shared/entries.ts`, which is the
 * rules of an Entry: this is about the account behind it, and it is read by the
 * card, the Bout and the panel alike. Shared so that
 * `test/unit/vocabulary.test.ts` holds it to `CONTEXT.md` like any other copy.
 */

/**
 * The few things the game has to say, and the short labels around them.
 *
 * Each of them names what a visitor may do *without* an account as well as what
 * they may not. Copy that only said "sign in" would read as a card that cannot
 * be looked at, which is the opposite of the decision above.
 */
export const SIGN_IN_MESSAGES = {
  /**
   * The one line the Bout a visitor just answered carries.
   *
   * It is here because this is where they are looking, and because the answer
   * they just gave is the thing the account is about. A fan working down a
   * ten-Bout card meets it on the first Bout they press, which is earlier than
   * anything at the top of the card would still be on screen for.
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

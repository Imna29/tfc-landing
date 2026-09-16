/**
 * What PlayTFC tells a fan the first time they reach it: that the game is free,
 * that Coins are worth nothing outside it, and what that makes it in law.
 *
 * Legal copy, in both languages it was written in, and published as written.
 * Edit it only with new wording from whoever supplied it — and when it changes,
 * move {@link DISCLAIMER_EDITION} on, or every fan who dismissed the old
 * wording is never shown the new one.
 *
 * It says the one word `CONTEXT.md` bans outright, in the one sentence that
 * says the game is not it. `test/helpers/vocabulary.ts` lets that sentence
 * through and nothing else, so the phrase stays on one line below.
 *
 * `PLAY_FINE_PRINT` in `app/utils/navigation.ts` is the short form at the foot
 * of every page. This is the full statement, shown once.
 */
export interface DisclaimerLanguage {
  /** The `lang` attribute, so a screen reader reads the Georgian as Georgian. */
  lang: "en" | "ka";
  /** The language's name in that language. */
  label: string;
  paragraphs: readonly string[];
}

export const PLAY_DISCLAIMER: readonly DisclaimerLanguage[] = [
  {
    lang: "en",
    label: "English",
    paragraphs: [
      "PlayTFC is a completely free entertainment prediction platform. No real money is " +
        "involved, and taking part requires no financial outlay of any kind.",
      "TFC Coins are internal virtual units of the platform only. They hold no material " +
        "value — they cannot be bought, sold, transferred, cashed out, or exchanged for real " +
        "money, goods, or prizes.",
      "Because participation is free and virtual winnings carry no financial value, PlayTFC " +
        "does not constitute betting or gambling and does not require a gaming business " +
        "permit (licence).",
    ],
  },
  {
    lang: "ka",
    label: "ქართული",
    paragraphs: [
      "PlayTFC სრულიად უფასო, გასართობი საპროგნოზო პლატფორმაა, სადაც რეალური ფული არ " +
        "მონაწილეობს და თამაშში ჩართულობა არანაირ ფინანსურ დანახარჯს არ მოითხოვს.",
      "TFC მონეტები მხოლოდ პლატფორმის შიდა, ვირტუალური ერთეულებია. მათ არ გააჩნიათ " +
        "მატერიალური ღირებულება — მათი შეძენა, გაყიდვა, გადარიცხვა, განაღდება ან რეალურ " +
        "ფულზე, საქონელსა თუ პრიზებზე გადაცვლა შეუძლებელია.",
      "ვინაიდან მონაწილეობა უფასოა და ვირტუალურ მოგებას არ გააჩნია ფინანსური ღირებულება, " +
        "PlayTFC არ წარმოადგენს ტოტალიზატორს ან აზარტულ თამაშს და არ საჭიროებს სათამაშო " +
        "ბიზნესის ნებართვას (ლიცენზიას).",
    ],
  },
];

/**
 * Which wording a fan has dismissed. Change it whenever {@link PLAY_DISCLAIMER}
 * changes, and everyone is shown the new wording once.
 */
export const DISCLAIMER_EDITION = "2026-09";

/**
 * Where the browser keeps that a fan has dismissed it, named for the game
 * rather than the page: `localStorage` is one namespace for the whole origin,
 * and the marketing site shares that origin.
 *
 * `localStorage` rather than `sessionStorage`, unlike the card's answers in
 * `useCardPicks`: this is meant to be shown once, not once per tab.
 */
const SEEN_UNDER = "tfc-play-disclaimer";

type Remembering = Pick<Storage, "getItem" | "setItem">;

/**
 * Whether this browser has dismissed this edition of the disclaimer.
 *
 * Takes the storage as a function because reading `localStorage` can throw
 * before any method is called — a browser blocking site data throws on the
 * property itself. A browser that will not say counts as one that has not
 * seen it, since showing it again costs a click and not showing it is the
 * failure this exists to prevent.
 */
export function disclaimerSeen(storage: () => Remembering = () => localStorage): boolean {
  try {
    return storage().getItem(SEEN_UNDER) === DISCLAIMER_EDITION;
  } catch {
    return false;
  }
}

/** Records that this browser has dismissed this edition, if it will let us. */
export function rememberDisclaimerSeen(storage: () => Remembering = () => localStorage) {
  try {
    storage().setItem(SEEN_UNDER, DISCLAIMER_EDITION);
  } catch {
    // Private browsing or a full quota. The fan has still read it; the only
    // cost is seeing it again on a later visit.
  }
}

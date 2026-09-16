/**
 * Where the marketing site ends and TFC Predictions begins.
 *
 * The site is two sites sharing a domain. One is what TFC is — the events, the
 * fighters, the media — and it is anonymous HTML anybody may be served from
 * the edge. The other is the game: a card to answer, Coins to commit, a board
 * to climb, and an account behind all three. They read differently, they are
 * navigated differently, and only one of them ever asks who is looking.
 *
 * Keeping them apart is a decision about what the marketing site is for. A
 * header carrying Predictions and Leaderboard beside Events and Fighters
 * offers a visitor six things at once and says nothing about which of them is
 * the game; one button that visibly is the game says it in one word. So the
 * game appears on the marketing site exactly once, as {@link PLAY_TFC}, and
 * everything the game needs in a header lives in the game's own — see
 * `app/layouts/play.vue`.
 *
 * This is the one file that knows which paths are which, and
 * `app/middleware/play-section.global.ts` is what makes it structural rather
 * than a convention: a page inside the section gets the game's chrome from the
 * list below rather than from a line somebody remembered to write in it.
 * `test/unit/navigation.test.ts` holds the two navigations apart.
 */
export interface NavLink {
  to: string;
  label: string;
}

/**
 * Every path the game is played on.
 *
 * Prefixes, matched a segment at a time: `/standings/a-season` is inside the
 * section and `/predictions-explained` — a marketing page somebody may well
 * write — is not.
 *
 * Not the same list as the edge-cache exemptions in `route-rules.ts`, and
 * deliberately so. That list is about what may be stored; this one is about
 * what the page looks like, and neither answer follows from the other.
 *
 * The two lists happen to agree on every page today — since ADR-0018 removed
 * `/prizes` and `/contest-rules`, nothing in the section is edge-cached — but
 * the exemption list also carries `/api`, `/admin` and `/slice-simulator`,
 * which are not pages a fan plays on and must never appear here. A page that
 * is identical for every reader and about nothing but the game is a page this
 * list should still carry and that one should not, which is the shape the two
 * had before and will have again the moment such a page is written.
 */
export const PLAY_SECTION = [
  "/predictions",
  "/leaderboard",
  "/standings",
  "/profile",
  "/account",
] as const;

/** Whether a path is part of the game rather than of the marketing site. */
export function inPlaySection(path: string): boolean {
  return PLAY_SECTION.some((section) => path === section || path.startsWith(`${section}/`));
}

/**
 * The card itself, named once because everything that links to it links here.
 *
 * PlayTFC lands here, the game's own navigation opens here, the leaderboard
 * sends a fan back here, and the sign-in prompt a visitor is shown on it asks to
 * be returned here once they have an account. Five spellings of one path is four
 * chances to get it wrong.
 *
 * {@link PLAY_SECTION} keeps its own literal deliberately, and is the one place
 * that should. This is an address to navigate to; that is a prefix every path
 * underneath it is matched against, and they are only the same string by
 * coincidence — `/predictions/something` is in the section and is not the card.
 */
export const THE_CARD = "/predictions";

/**
 * Everything a fan has committed, named once for the same reason the card is.
 *
 * Under the card's own path rather than beside it, because that is what it is
 * about: `/predictions` is the card being offered and this is what this fan has
 * made of it. It also means the page inherits `/predictions`' exemption from
 * the edge cache in `route-rules.ts` — which matters more here than there, as
 * this page is nothing *but* one fan's own answers, and a stored copy would be
 * served to whoever asked next (ADR-0008).
 *
 * The profile used to carry this listing and now links to it. One page owns a
 * fan's Entries, so two of them cannot come to show it differently.
 */
export const MY_PREDICTIONS = "/predictions/mine";

/**
 * The one way in.
 *
 * It lands on the card rather than on a landing page about the card: a fan who
 * presses PlayTFC came to answer Bouts, and a page explaining that they could
 * is a step between them and the thing.
 */
export const PLAY_TFC: NavLink = { to: THE_CARD, label: "PlayTFC" };

/** The marketing site's own sections, in the header and in the mobile menu. */
export const MARKETING_NAV: readonly NavLink[] = [
  { to: "/events", label: "Events" },
  { to: "/fighters", label: "Fighters" },
  { to: "/media", label: "Media" },
  { to: "/about", label: "About Us" },
];

/**
 * The game's own navigation: the card, what this fan has committed to it, and
 * the board it is climbed on.
 *
 * Three things a fan comes here to do, and no fourth. ADR-0018 retired the
 * prizes and contest rules pages and this is deliberately not padded back out
 * to where it was: the Season's deadline and the Seasons that have ended are
 * both on the leaderboard, which is where somebody asking either question is
 * already going.
 *
 * The card is first and is where the button lands, so the section opens on the
 * thing it is for. My Predictions sits behind it for the same reason — a fan
 * who has never committed an Entry has nothing to read there, and the way to
 * get something on it is the page in front of it.
 */
export const PLAY_NAV: readonly NavLink[] = [
  { to: THE_CARD, label: "The Card" },
  { to: MY_PREDICTIONS, label: "My Predictions" },
  { to: "/leaderboard", label: "Leaderboard" },
];

/**
 * What the game says about itself at the foot of every page it is played on.
 *
 * Chrome rather than content, which is why it is here beside the navigation
 * and not in Prismic: a free-to-play game has to say it is one wherever it is
 * played, and a page that reached production with the line unwritten would be
 * a prediction game that looks like something else.
 *
 * It used to be the short version of a published term on a rules page a nav
 * item away, and ADR-0018 removed that page — so this line carries the claim on
 * every page, and says what Coins are instead of what they are not worth
 * relative to something TFC no longer awards. The full legal statement, in
 * English and Georgian, is `PLAY_DISCLAIMER` in `app/utils/disclaimer.ts`,
 * shown once on a fan's first visit to the section.
 */
export const PLAY_FINE_PRINT =
  "TFC Predictions is free to play. Coins are worth nothing outside the game: they have no " +
  "real-money value and cannot be bought, transferred or redeemed.";

/**
 * The query parameter a page puts its own path in to be returned to.
 *
 * One name, used by the page that writes the link and the form that reads it,
 * because the two agreeing is the whole of the mechanism.
 */
export const RETURN_QUERY = "next";

/**
 * Where a fan lands after signing in when nothing asked for them back.
 *
 * Their own account, which is what signing in used to do unconditionally and is
 * still the right answer for a fan who went to the form under their own steam.
 */
export const SIGNED_IN_LANDING = "/profile";

/**
 * Where signing in should land, given what the page asked for.
 *
 * The card asks a visitor to sign in **before** they answer a Bout, and that is
 * only advice worth taking if signing in brings them back to the card. So a
 * page may name where it wants the fan returned — and the moment a path arrives
 * in a URL it is somewhere anybody can write, so what comes back from here is
 * an allow-list rather than a sanitised version of what arrived.
 *
 * Inside the game and outside `/account`. The first is narrow because nothing
 * on the marketing site ever asks a fan to sign in, so nothing there has a
 * reason to be returned to; the second is because the account pages are where
 * the fan already is, and returning them there is a loop. Anything else — an
 * absolute URL, a protocol-relative one, a backslash a browser may read as the
 * other slash, a path carrying a query of its own, a second spelling of a real
 * path (ADR-0012) — is the profile.
 */
export function returnTo(asked: unknown): string {
  if (typeof asked !== "string" || !asked.startsWith("/") || asked.startsWith("//")) {
    return SIGNED_IN_LANDING;
  }

  // `inPlaySection` refuses all three of these already, by matching a path a
  // segment at a time. They are named anyway: this is the guard somebody will
  // read when they widen that matcher, and what it must keep refusing is worth
  // saying here rather than inferring from somewhere else.
  if (asked.includes("\\") || asked.includes("://") || asked.includes("?")) {
    return SIGNED_IN_LANDING;
  }

  if (!inPlaySection(asked) || inAccountSection(asked)) return SIGNED_IN_LANDING;

  return asked;
}

/** Whether a path is one of the forms an account is created or entered on. */
function inAccountSection(path: string): boolean {
  return path === "/account" || path.startsWith("/account/");
}

/**
 * The way to an account from a page that wants the fan back afterwards.
 *
 * Written here rather than at each link so that {@link RETURN_QUERY} has one
 * speller, and so that a link this builds is one {@link returnTo} accepts —
 * `test/unit/navigation.test.ts` holds the two halves to each other.
 */
export function accountPath(page: "sign-in" | "sign-up", returningTo: string): string {
  return `/account/${page}?${RETURN_QUERY}=${encodeURIComponent(returningTo)}`;
}

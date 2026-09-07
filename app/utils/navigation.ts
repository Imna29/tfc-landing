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
 * The one way in.
 *
 * It lands on the card rather than on a landing page about the card: a fan who
 * presses PlayTFC came to answer Bouts, and a page explaining that they could
 * is a step between them and the thing.
 */
export const PLAY_TFC: NavLink = { to: "/predictions", label: "PlayTFC" };

/** The marketing site's own sections, in the header and in the mobile menu. */
export const MARKETING_NAV: readonly NavLink[] = [
  { to: "/events", label: "Events" },
  { to: "/fighters", label: "Fighters" },
  { to: "/media", label: "Media" },
  { to: "/about", label: "About Us" },
];

/**
 * The game's own navigation: the card, and the board it is climbed on.
 *
 * Two items since ADR-0018 retired the prizes and contest rules pages, and it
 * is deliberately not padded back to four. What a fan can do here is answer
 * the card and see where that leaves them; the Season's deadline and the
 * Seasons that have ended are both on the leaderboard, which is where somebody
 * asking either question is already going.
 *
 * The card is first and is where the button lands, so the section opens on the
 * thing it is for.
 */
export const PLAY_NAV: readonly NavLink[] = [
  { to: "/predictions", label: "The Card" },
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
 * **This is now the only place the app says it at all.** It used to be the
 * short version of a published term on a rules page a nav item away, and
 * ADR-0018 removed that page — so the line that survived it carries the whole
 * claim rather than a summary of one, and says what Coins are instead of what
 * they are not worth relative to something TFC no longer awards.
 */
export const PLAY_FINE_PRINT =
  "TFC Predictions is free to play. Coins are worth nothing outside the game: they have no " +
  "real-money value and cannot be bought, transferred or redeemed.";

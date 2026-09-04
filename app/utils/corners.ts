import type { Corner } from "#shared/events";

/**
 * The colour a corner is read by, said once.
 *
 * Red and blue are how a fan tells the two sides of a Bout apart at a glance —
 * on the fighter, on the answer they gave, and on the Prediction in the panel
 * afterwards — so the three of them have to be the same red and the same blue.
 * They were the same pair of Tailwind classes written out in three components,
 * which is two places for one of them to drift.
 *
 * Classes rather than colours, because that is what the components need and
 * because the values behind them belong to the theme in `app/assets/main.css`.
 * Which edge a border is on stays with whoever draws it: the corner's own is
 * the outside edge of its half of the card, and that is a fact about the
 * layout rather than about the corner.
 */
export interface CornerColour {
  /** For a rule drawn along the corner's edge. */
  border: string;
  /** For a mark filled in the corner's colour. */
  fill: string;
  /** For the wash behind the answer this fan has given. */
  tint: string;
}

export const CORNER_COLOURS = {
  red: {
    border: "border-primary-container",
    fill: "bg-primary-container",
    tint: "bg-primary-container/15",
  },
  blue: { border: "border-tertiary", fill: "bg-tertiary", tint: "bg-tertiary/15" },
} as const satisfies Record<Corner, CornerColour>;

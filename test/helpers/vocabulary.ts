import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The sportsbook vocabulary `CONTEXT.md` bans, verbatim.
 *
 * Keep this list and the "no sportsbook vocabulary" section of `CONTEXT.md` in
 * step: the glossary is the rule, this is only the enforcement of it.
 */
export const BANNED_TERMS = [
  "bet",
  "wager",
  "slip",
  "stake",
  "odds",
  "parlay",
  "accumulator",
  "bookmaker",
  "payout",
  "void",
  "punter",
  "bankroll",
] as const;

export interface BannedTermMatch {
  /** The term as `CONTEXT.md` bans it. */
  term: string;
  /** The text that actually matched, e.g. `"Betting"`. */
  match: string;
  /** 1-based, so it can be pasted after a `file:` and clicked. */
  line: number;
}

/**
 * A banned term, plus the shapes it turns up in: plurals, past tense, and the
 * doubled final consonant English adds before a suffix ("bet" → "betting").
 *
 * Word boundaries on both ends are what keep "alphabet", "mistake" and "avoid"
 * out of the results — a substring match would make this guard unusable.
 *
 * There is deliberately no "-er": the doubled stem plus that suffix spells
 * ordinary words ("better", "slipper"), and the agent nouns worth banning
 * — punter, bookmaker — are on the list in their own right.
 */
function inflectionPattern(term: string): RegExp {
  const lastLetter = term.slice(-1);
  const stems = [term, `${term}${lastLetter}`];

  // "stake" → "staking", "staked".
  if (term.endsWith("e")) {
    stems.push(term.slice(0, -1));
  }

  return new RegExp(`\\b(?:${stems.join("|")})(?:s|es|ed|ing)?\\b`, "gi");
}

const PATTERNS = BANNED_TERMS.map((term) => ({ term, regex: inflectionPattern(term) }));

/**
 * Every banned term in a piece of text, in reading order.
 *
 * A speed bump rather than a proof: it catches the word a writer reached for
 * out of habit, not a paraphrase that means the same thing. Reviewing copy
 * against `CONTEXT.md` is still a human job.
 */
export function findBannedTerms(text: string): BannedTermMatch[] {
  const found: BannedTermMatch[] = [];

  text.split("\n").forEach((lineText, index) => {
    const onThisLine: Array<{ at: number; found: BannedTermMatch }> = [];

    for (const { term, regex } of PATTERNS) {
      for (const match of lineText.matchAll(regex)) {
        onThisLine.push({
          at: match.index ?? 0,
          found: { term, match: match[0], line: index + 1 },
        });
      }
    }

    onThisLine.sort((a, b) => a.at - b.at);
    found.push(...onThisLine.map((hit) => hit.found));
  });

  return found;
}

export interface ContentSurfaceFile {
  /** Repo-relative, so a failure message points somewhere openable. */
  path: string;
  text: string;
}

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

/**
 * Everything that carries words a fan can read: components and pages, the
 * Prismic models whose labels and placeholders the content team writes
 * against, and the app-layer utils that hold copy of their own — the fallback
 * eligibility rules among them.
 *
 * `.ts` files elsewhere are deliberately out of scope. `void` is both banned
 * vocabulary and a TypeScript keyword, and a guard that fires on
 * `Promise<void>` is a guard people switch off. The corollary for `app/utils`,
 * which is in scope: a module that needs the keyword does not belong there.
 */
export function contentSurfaceFiles(): ContentSurfaceFile[] {
  const paths = [
    ...walk(join(REPO_ROOT, "app"), (name) => name.endsWith(".vue") || name === "model.json"),
    ...walk(join(REPO_ROOT, "app", "utils"), (name) => name.endsWith(".ts")),
    ...walk(join(REPO_ROOT, "customtypes"), (name) => name === "index.json"),
  ];

  return paths.sort().map((path) => ({
    path: relative(REPO_ROOT, path),
    text: readFileSync(path, "utf8"),
  }));
}

function walk(directory: string, keep: (fileName: string) => boolean): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return walk(path, keep);
    }

    return keep(entry.name) ? [path] : [];
  });
}

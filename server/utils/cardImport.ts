/**
 * Reading a fight card out of Prismic: what an `event` document says, turned
 * into the Event and Bouts that will be written to Postgres — or the reason an
 * admin is told it cannot be.
 *
 * Deliberately pure, and deliberately knows nothing about Postgres or about
 * how the document was fetched. ADR-0001 makes this the seam that matters: a
 * Bout copied into Postgres is what settlement reads months later, and Prismic
 * has no constraints of its own to stop an editor publishing a Bout with no
 * rounds or two Bouts both numbered 3. Everything this refuses is refused
 * while the fix is still an edit in a CMS rather than a correction to a
 * Balance.
 *
 * The types below are the shape of the fields this reads and no more of them.
 * They are written out rather than taken from `prismicio-types.d.ts` because
 * that file augments `@prismicio/client` for the app, and server code is
 * checked against a tsconfig that does not include it — and because a reader
 * of untrusted content should say exactly what it needs.
 */
import { EVENT_MESSAGES, SCHEDULED_ROUNDS } from "#shared/events";

/** A link to another document, as the Document API answers with one. */
export interface PrismicLink {
  link_type?: string;
  id?: string;
  isBroken?: boolean;
}

/** One row of an `event` document's `bouts` group. */
export interface PrismicBout {
  card_order: number | null;
  red_corner: PrismicLink | null;
  red_corner_name: string | null;
  blue_corner: PrismicLink | null;
  blue_corner_name: string | null;
  division: PrismicLink | null;
  scheduled_rounds: number | null;
  main_event: boolean;
  title_fight: boolean;
}

/** An `event` document, as far as the import is concerned. */
export interface PrismicEvent {
  id: string;
  data: {
    title: string | null;
    scheduled_start: string | null;
    venue: string | null;
    poster?: { url?: string | null } | null;
    /** Absent rather than empty on a document authored before the group was. */
    bouts?: PrismicBout[] | null;
  };
}

/**
 * A document a Bout points at: a `fighter` for a corner, a `division` for the
 * weight class.
 *
 * One shape for both, because the import wants the same thing from each — the
 * name it is published under, and for a fighter the image, the record and the
 * uid their profile page is reached by.
 */
export interface PrismicReference {
  id: string;
  uid?: string | null;
  data: {
    name?: string | null;
    image?: { url?: string | null } | null;
    record?: string | null;
  };
}

/**
 * One corner of a Bout, as Postgres will hold it.
 *
 * `name` is always there; the rest is only there when the corner is a fighter
 * with a document. A late replacement booked 48 hours out has a name and
 * nothing else, and a card that could not carry them would cost predictions on
 * a fight that is actually happening.
 *
 * Everything but `fighterId` is what a card shows of a corner — see
 * `FightCardCorner` in `shared/fightCard.ts`, which is that same corner once
 * it has been read back out for a page to render.
 */
export interface CardCorner {
  name: string;
  /** The Prismic document id, so a re-import can recognise the same fighter. */
  fighterId: string | null;
  /** What `/fighters/:uid` is reached by, for the profile link on the card. */
  fighterUid: string | null;
  imageUrl: string | null;
  /**
   * Their record, as the `fighter` document states it.
   *
   * Copied at import for the same reason the image is: the card a fan reads
   * renders from one query rather than from Postgres and a CMS together. Null
   * for a fallback name, and for a fighter whose document nobody has filled it
   * in on — a gap on the card, not a card that cannot be imported.
   */
  record: string | null;
}

/** One Bout of a card, ready to be written. */
export interface CardBout {
  cardOrder: number;
  red: CardCorner;
  blue: CardCorner;
  division: string;
  scheduledRounds: number;
  mainEvent: boolean;
  titleFight: boolean;
}

/** An Event and its Bouts, ready to be written. */
export interface Card {
  prismicId: string;
  title: string;
  scheduledStart: Date;
  venue: string;
  posterUrl: string | null;
  bouts: CardBout[];
}

/** A card ready to be imported, or the reason it is not. */
export type ReadCard = { card: Card; problem?: undefined } | { card?: undefined; problem: string };

/**
 * Reads an `event` document and the documents it references into the card that
 * will be written to Postgres.
 *
 * `referenced` is every `fighter` and `division` document the card points at,
 * already fetched. Resolving them is a query, and a pure function cannot make
 * one — see `server/utils/prismic.ts`, which does.
 */
export function readCard(event: PrismicEvent, referenced: readonly PrismicReference[]): ReadCard {
  const documents = new Map(referenced.map((document) => [document.id, document]));

  const title = written(event.data.title);
  const venue = written(event.data.venue);
  const scheduledStart = event.data.scheduled_start;

  if (!title) return { problem: EVENT_MESSAGES.titleMissing };
  if (!scheduledStart) return { problem: EVENT_MESSAGES.startMissing };
  if (!venue) return { problem: EVENT_MESSAGES.venueMissing };

  const rows = event.data.bouts ?? [];

  if (rows.length === 0) return { problem: EVENT_MESSAGES.boutsMissing };

  const bouts: CardBout[] = [];
  const places = new Set<number>();

  for (const [index, row] of rows.entries()) {
    const bout = readBout(row, index + 1, documents);

    if (bout.problem !== undefined) return { problem: bout.problem };
    if (places.has(bout.bout.cardOrder)) {
      return { problem: EVENT_MESSAGES.cardOrderRepeated(bout.bout.cardOrder) };
    }

    places.add(bout.bout.cardOrder);
    bouts.push(bout.bout);
  }

  if (bouts.filter((bout) => bout.mainEvent).length > 1) {
    return { problem: EVENT_MESSAGES.mainEventRepeated };
  }

  // The order the Bouts are fought, which is rarely the order they were
  // authored in: a card is written main event first and fought the other way
  // round.
  bouts.sort((one, another) => one.cardOrder - another.cardOrder);

  return {
    card: {
      prismicId: event.id,
      title,
      scheduledStart: new Date(scheduledStart),
      venue,
      posterUrl: event.data.poster?.url ?? null,
      bouts,
    },
  };
}

type ReadBout = { bout: CardBout; problem?: undefined } | { bout?: undefined; problem: string };

function readBout(
  row: PrismicBout,
  position: number,
  documents: Map<string, PrismicReference>,
): ReadBout {
  const cardOrder = row.card_order;

  if (cardOrder === null || !Number.isInteger(cardOrder) || cardOrder < 1) {
    return { problem: EVENT_MESSAGES.cardOrderUnreadable(position) };
  }

  const red = readCorner(row.red_corner, row.red_corner_name, position, "red", documents);
  const blue = readCorner(row.blue_corner, row.blue_corner_name, position, "blue", documents);

  if (red.problem !== undefined) return { problem: red.problem };
  if (blue.problem !== undefined) return { problem: blue.problem };

  if (red.corner.fighterId !== null && red.corner.fighterId === blue.corner.fighterId) {
    return { problem: EVENT_MESSAGES.sameFighter(position) };
  }

  const division = written(documents.get(linkedId(row.division) ?? "")?.data.name);

  if (!division) return { problem: EVENT_MESSAGES.divisionMissing(position) };

  const scheduledRounds = row.scheduled_rounds;

  if (
    scheduledRounds === null ||
    !Number.isInteger(scheduledRounds) ||
    scheduledRounds < SCHEDULED_ROUNDS.minimum ||
    scheduledRounds > SCHEDULED_ROUNDS.maximum
  ) {
    return { problem: EVENT_MESSAGES.roundsUnreadable(position) };
  }

  return {
    bout: {
      cardOrder,
      red: red.corner,
      blue: blue.corner,
      division,
      scheduledRounds,
      mainEvent: row.main_event,
      titleFight: row.title_fight,
    },
  };
}

type ReadCorner =
  | { corner: CardCorner; problem?: undefined }
  | { corner?: undefined; problem: string };

function readCorner(
  link: PrismicLink | null,
  fallbackName: string | null,
  position: number,
  corner: "red" | "blue",
  documents: Map<string, PrismicReference>,
): ReadCorner {
  const fighterId = linkedId(link);
  const fighter = fighterId === null ? undefined : documents.get(fighterId);

  const published = written(fighter?.data.name);

  if (fighter && published) {
    return {
      corner: {
        name: published,
        fighterId: fighter.id,
        fighterUid: fighter.uid ?? null,
        imageUrl: fighter.data.image?.url ?? null,
        record: written(fighter.data.record),
      },
    };
  }

  const typed = written(fallbackName);

  if (typed) {
    return {
      corner: { name: typed, fighterId: null, fighterUid: null, imageUrl: null, record: null },
    };
  }

  // A fighter document with no name in it. Refused here, naming the document
  // to go and fix, rather than written as an empty name for
  // `bouts_corners_are_named` to refuse with no sign of which row it was.
  if (fighter) return { problem: EVENT_MESSAGES.fighterUnnamed(position, corner) };

  // A link with nothing behind it: the editor picked a fighter and the
  // document went back to a draft, or was deleted. Named apart from an empty
  // corner because the fix is a different one.
  if (fighterId !== null) return { problem: EVENT_MESSAGES.cornerUnpublished(position, corner) };

  return { problem: EVENT_MESSAGES.cornerUnnamed(position, corner) };
}

/** The document a link points at, or `null` when the editor left it empty. */
function linkedId(link: PrismicLink | null): string | null {
  if (!link || link.link_type !== "Document" || !link.id) return null;

  return link.id;
}

/** Text an editor actually typed, or `null` for a field they left blank. */
function written(text: string | null | undefined): string | null {
  const trimmed = text?.trim();

  return trimmed ? trimmed : null;
}

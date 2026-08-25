/**
 * Prismic, from the server: the only place this application asks the content
 * API anything without a browser involved.
 *
 * The marketing site fetches Prismic from the page, through `@nuxtjs/prismic`.
 * The import cannot: it runs behind an admin session, writes to Postgres, and
 * has to fetch the `fighter` and `division` documents a card points at before
 * it can decide whether the card is importable at all. So it gets a client of
 * its own, built from the same `prismic.config.json` the module reads.
 *
 * The routes in that config are deliberately not passed on. They are sent to
 * Prismic as a query parameter and validated against the types it knows about,
 * and one entry naming a type it does not recognise fails the whole request
 * (see the Content model section of README.md). Nothing here needs a
 * `document.url`, so nothing here risks that.
 */
import { NotFoundError, createClient, type Client, type PrismicDocument } from "@prismicio/client";
import prismicConfig from "../../prismic.config.json";
import type { PrismicEvent, PrismicReference } from "./cardImport";

/**
 * How long to wait for Prismic before giving up.
 *
 * The same reasoning as the mailer's: a serverless function held open waiting
 * on somebody else's outage is worse than an admin being told to try again.
 */
const PRISMIC_TIMEOUT_MS = 10_000;

let client: Client | undefined;

/**
 * The application's Prismic client, created once per process and reused.
 *
 * `PRISMIC_API_URL` points this somewhere other than the repository named in
 * `prismic.config.json` — a second repository to develop against, or a
 * stand-in for one. Nothing in production sets it: without it the client is
 * built from the repository name, which resolves to the CDN endpoint.
 */
export function usePrismic(): Client {
  client ??= createClient(process.env.PRISMIC_API_URL || prismicConfig.repositoryName, { fetch });

  return client;
}

/**
 * A document as this module reads it.
 *
 * The Document API answers with JSON, so typing it is a claim rather than a
 * check — `getByID` hands back `Record<string, any>` and would let any claim
 * through. It is written as a conversion in one place so that the claim is
 * made once, beside the request that produced it, and `readCard` is what
 * actually checks: it treats every field as something an editor may have left
 * blank, and refuses the card rather than trusting its shape.
 */
function asEvent(document: PrismicDocument & { id: string }): PrismicEvent {
  return document as unknown as PrismicEvent;
}

/** The same claim about a `fighter` or `division` document. */
function asReference(document: PrismicDocument & { id: string }): PrismicReference {
  return document as unknown as PrismicReference;
}

/** Gives up on Prismic rather than holding a request open indefinitely. */
function withTimeout() {
  return { fetchOptions: { signal: AbortSignal.timeout(PRISMIC_TIMEOUT_MS) } };
}

/** A card in Prismic, as the admin area lists one before importing it. */
export interface CardSummary {
  prismicId: string;
  /** Whatever the editor has typed so far, which may be nothing yet. */
  title: string | null;
  scheduledStart: string | null;
  venue: string | null;
  /** How many Bouts are on it in Prismic, imported or not. */
  bouts: number;
}

/**
 * Every `event` document, the card scheduled furthest ahead first — so the
 * cards still to come sit above the ones already fought, the way
 * `/admin/seasons` lists the newest Season first.
 *
 * Half-written cards are listed rather than hidden. An admin looking for the
 * card they were told was ready needs to see it and be told what is missing —
 * a listing that silently dropped it would look like the content team had not
 * started.
 */
export async function listCards(): Promise<CardSummary[]> {
  const documents = await usePrismic().getAllByType("event", {
    orderings: [{ field: "my.event.scheduled_start", direction: "desc" }],
    ...withTimeout(),
  });

  return documents.map((document) => {
    const event = asEvent(document);

    return {
      prismicId: event.id,
      title: event.data.title,
      scheduledStart: event.data.scheduled_start,
      venue: event.data.venue,
      bouts: event.data.bouts?.length ?? 0,
    };
  });
}

/** An `event` document and every document its Bouts point at. */
export interface FetchedCard {
  event: PrismicEvent;
  referenced: PrismicReference[];
}

/**
 * One card and everything needed to read it: the `event` document, plus the
 * `fighter` and `division` documents its Bouts link to.
 *
 * Two queries rather than one. Prismic can return chosen fields of a linked
 * document inline, but then the model would have to name every field the
 * import happens to want, and adding one later would mean a model change
 * pushed before the code that reads it could ship. Fetching the documents
 * themselves costs one more request on an admin action nobody performs twice a
 * minute, and gives the same answer for a fighter's image as their profile
 * page gets.
 *
 * A document that has gone back to a draft is simply not returned, which is
 * how a corner pointing at an unpublished fighter is recognised — see
 * `readCard` in `server/utils/cardImport.ts`.
 *
 * Answers `null` for a card that is not in Prismic, which is what an admin
 * following a link to a document somebody has since deleted deserves to be
 * told.
 */
export async function fetchCard(prismicId: string): Promise<FetchedCard | null> {
  const prismic = usePrismic();

  let event: PrismicEvent;

  try {
    event = asEvent(await prismic.getByID(prismicId, withTimeout()));
  } catch (error) {
    if (error instanceof NotFoundError) return null;

    throw error;
  }

  const referencedIds = [
    ...new Set(
      (event.data.bouts ?? [])
        .flatMap((bout) => [bout.red_corner, bout.blue_corner, bout.division])
        .flatMap((link) => (link?.link_type === "Document" && link.id ? [link.id] : [])),
    ),
  ];

  const referenced =
    referencedIds.length === 0
      ? []
      : (await prismic.getAllByIDs(referencedIds, withTimeout())).map(asReference);

  return { event, referenced };
}

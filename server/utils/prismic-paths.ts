/**
 * Every path on this site whose HTML is built from Prismic content.
 *
 * The webhook that purges the edge cache (`server/api/prismic/revalidate.post.ts`)
 * needs paths, and Prismic will not give it any: a publish reports which
 * *documents* changed, by id, and says nothing about which pages render them.
 * There is no cheap way back. Most types here are not rendered on a page of
 * their own at all — `footer` is on every page through the layout, `fighter`
 * appears in the `FightersSection` and `FeaturedFighters` slices as well as at
 * `/fighters/:uid`, `media` and `media_type` in `MediaArchive` — so the blast
 * radius of one publish is, in practice, the whole site.
 *
 * So this module answers the question that can be answered exactly: what is
 * every path Prismic content is served at? The webhook purges all of them on
 * every publish. That is more requests per publish than purging one page would
 * be, and it is the version that cannot quietly miss a page — which is the
 * failure the webhook exists to stop.
 */

/** The fields of a Prismic document this module reads. */
export interface DocumentRef {
  type: string;
  uid?: string | null;
}

/**
 * Pages that exist whatever is in Prismic, and still render Prismic content.
 *
 * These are Nuxt pages rather than documents, so no query returns them. Every
 * one of them renders the `footer` singleton through the default layout, which
 * is on its own enough reason to purge them all on any publish; most render
 * more than that.
 *
 * `/home-page` is the same document as `/`, reachable at a second URL because
 * `app/pages/home-page.vue` exists alongside `app/pages/index.vue`. It is
 * listed because it is a route the site answers, not because it should be.
 */
export const FIXED_PATHS = [
  "/",
  "/home-page",
  "/contact",
  "/privacy-policy",
  "/terms-of-service",
] as const;

/**
 * Singletons, and the one path each is rendered at.
 *
 * Mirrors `prismic.config.json` plus the Nuxt pages that query a singleton
 * directly. Keep them in step: a type missing here is a page that goes stale
 * for the ten minutes ISR allows, with nothing to notice it by.
 */
const SINGLETON_PATHS: Record<string, string> = {
  home_page: "/",
  privacy_policy: "/privacy-policy",
  terms_of_service: "/terms-of-service",
};

/**
 * Repeatable types, and the prefix their `uid` hangs off.
 *
 * `page` is the catch-all at `/:uid` from `prismic.config.json`; `fighter` is
 * `app/pages/fighters/[id].vue`, which passes the route param to `getByUID`.
 */
const COLLECTION_PREFIXES: Record<string, string> = {
  page: "",
  fighter: "/fighters",
};

/** The types the webhook has to enumerate to know every path. */
export const COLLECTION_TYPES = Object.keys(COLLECTION_PREFIXES);

/**
 * The path a document is served at, or `null` if it has no page of its own.
 *
 * `null` is not "nothing to do" — a `footer` or a `media_type` has no path and
 * still changes what other pages render. It only means this document adds no
 * path to the set.
 */
export function pathForDocument(document: DocumentRef): string | null {
  const singleton = SINGLETON_PATHS[document.type];
  if (singleton !== undefined) {
    return singleton;
  }

  const prefix = COLLECTION_PREFIXES[document.type];
  if (prefix === undefined || !document.uid) {
    return null;
  }

  return `${prefix}/${document.uid}`;
}

/**
 * Every path to purge, given every document that has a page of its own.
 *
 * Deduplicated and stable: two documents can resolve to the same path (the same
 * `uid` in two languages), and the caller sends one request per entry.
 */
export function pathsToRevalidate(documents: Iterable<DocumentRef>): string[] {
  const paths = new Set<string>(FIXED_PATHS);

  for (const document of documents) {
    const path = pathForDocument(document);
    if (path !== null) {
      paths.add(path);
    }
  }

  return [...paths];
}

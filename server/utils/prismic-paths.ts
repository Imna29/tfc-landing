/**
 * Every path the site serves from Prismic.
 *
 * A publish reports document ids, not URLs, and most types are rendered
 * somewhere other than a page of their own (the footer on every page, fighters
 * in three slices), so the webhook purges all of these rather than guessing
 * which ones changed.
 */

export interface DocumentRef {
  type: string;
  uid?: string | null;
}

/** Nuxt pages, so no query returns them. All render the Prismic footer. */
export const FIXED_PATHS = [
  "/",
  "/home-page",
  "/contact",
  "/privacy-policy",
  "/terms-of-service",
] as const;

const SINGLETON_PATHS: Record<string, string> = {
  home_page: "/",
  privacy_policy: "/privacy-policy",
  terms_of_service: "/terms-of-service",
};

/** `page` is the catch-all in prismic.config.json; `fighter` is a Nuxt route. */
const COLLECTION_PREFIXES: Record<string, string> = {
  page: "",
  fighter: "/fighters",
};

/** The types the webhook queries to find every path. */
export const COLLECTION_TYPES = Object.keys(COLLECTION_PREFIXES);

/** `null` for types with no page of their own — they still change other pages. */
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

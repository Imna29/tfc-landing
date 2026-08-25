/**
 * Which paths belong to the admin area, and which spellings of them this app
 * will actually serve.
 *
 * Deliberately a prefix rather than a list of routes: `server/middleware/admin.ts`
 * refuses everything under here before any handler runs, so an admin route
 * added by a later ticket is locked the moment it exists and cannot be
 * forgotten. The cost is that an unrecognised path *fails open*, which is why
 * this is the one piece of the guard with unit tests of its own
 * (`test/unit/admin-area.test.ts`).
 *
 * Kept free of `h3` and of everything it drags in, so those tests can run in
 * the fast project without booting a server.
 */
export const ADMIN_PREFIXES = ["/admin", "/api/admin"] as const;

/** Whether `path` is inside the admin area, and so needs an admin. */
export function isAdminPath(path: string): boolean {
  const asked = normalize(path);

  return ADMIN_PREFIXES.some((prefix) => asked === prefix || asked.startsWith(`${prefix}/`));
}

/**
 * Whether `path` is spelled the way `route-rules.ts` spells it — the only
 * spelling anything in the admin area is served under.
 *
 * Vue Router matches case-insensitively and Nitro's route rules do not, so
 * `/ADMIN` renders the admin page while missing the rule that exempts `/admin`
 * from the edge cache. It falls through to the marketing catch-all instead,
 * and one admin's page is stored and served to whoever asks next — the
 * silent, error-free leak ADR-0008 exists to prevent.
 *
 * An escaped spelling is not that hole: Nitro unescapes before anything routes
 * on the path, so `/%61dmin` reaches the rules and the guard alike as
 * `/admin`. This refuses it anyway, because which spellings survive to here is
 * a property of the platform rather than a promise it makes.
 *
 * So the answer to a second spelling is that there is nothing there: it is
 * refused before the role is even looked at, which also means it answers the
 * same way for an admin as for anyone else. Only the exempted spelling is ever
 * served, so only an uncacheable path can ever return an admin's page.
 *
 * A trailing slash is allowed because the route rules already cover it. What
 * this does rule out is an admin URL that needs escaping to be written down:
 * a later ticket's `/admin/events/[uid]` has to take a uid that survives being
 * spelled literally, which every Prismic uid and every uuid does.
 */
export function isCanonicalSpelling(path: string): boolean {
  return withoutTrailingSlash(withoutQuery(path)) === normalize(path);
}

/**
 * A request path reduced to what the routers will actually match it against:
 * lower-cased, unescaped, and without a query string or trailing separator.
 *
 * Both normalisations only ever widen what counts as an admin path, which is
 * the safe direction — a path that is guarded but does not exist answers 403
 * or 404 rather than being served with no role check at all.
 */
function normalize(path: string): string {
  return withoutTrailingSlash(decode(withoutQuery(path)).toLowerCase());
}

function withoutQuery(path: string): string {
  return path.split(/[?#]/, 1)[0] ?? "";
}

/** `/admin/` is `/admin`. `/` is left alone: it is the whole path. */
function withoutTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function decode(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    // A malformed escape sequence. Nothing can be read out of it, and the
    // answer to not knowing what a path says is not to wave it through.
    return path;
  }
}

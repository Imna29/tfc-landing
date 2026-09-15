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
 *
 * It recognises spellings the app does not serve — `/ADMIN`, `/%61dmin` —
 * because guarding a path that turns out not to exist costs a 404 nobody is
 * harmed by, while failing to guard one costs everything. Which spellings
 * reach a page at all is settled globally, by ADR-0012.
 */
export const ADMIN_PREFIXES = ["/admin", "/api/admin"] as const;

/** Whether `path` is inside the admin area, and so needs an admin. */
export function isAdminPath(path: string): boolean {
  const asked = normalize(path);

  return ADMIN_PREFIXES.some((prefix) => asked === prefix || asked.startsWith(`${prefix}/`));
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

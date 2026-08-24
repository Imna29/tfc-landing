/**
 * Which paths belong to the admin area.
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
 * These prefixes are also written down in `route-rules.ts`, which exempts them
 * from the edge cache (ADR-0008). The two lists have to agree: a `/admin` page
 * that was cached would be one admin's page served to whoever asked next.
 */
const ADMIN_PREFIXES = ["/admin", "/api/admin"] as const;

/** Whether `path` is inside the admin area, and so needs an admin. */
export function isAdminPath(path: string): boolean {
  const asked = normalize(path);

  return ADMIN_PREFIXES.some((prefix) => asked === prefix || asked.startsWith(`${prefix}/`));
}

/**
 * A request path reduced to what the routers will actually match it against.
 *
 * Lower-cased because Vue Router matches case-insensitively by default, so
 * `/ADMIN` renders the admin page; decoded because `%61dmin` is another way to
 * spell the same request. Both normalisations only ever widen what counts as
 * an admin path, and a path that is guarded but does not exist is a 403 where
 * a 404 would have done — a wrong answer nobody is harmed by.
 */
function normalize(path: string): string {
  const withoutQuery = path.split(/[?#]/, 1)[0] ?? "";
  const decoded = decode(withoutQuery).toLowerCase();

  // `/admin/` is `/admin`. `/` is left alone: it is the whole path, not a
  // trailing separator.
  return decoded.length > 1 && decoded.endsWith("/") ? decoded.slice(0, -1) : decoded;
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

import { describe, expect, it } from "vitest";
import { isAdminPath } from "../../server/utils/adminArea";

/**
 * The URL space `server/middleware/admin.ts` refuses to serve to anyone but an
 * admin.
 *
 * This is the half of the guard worth testing in isolation, because it is the
 * half that fails open: a path the middleware does not recognise is a path
 * served without a role check, and nothing anywhere else would notice.
 */
describe("the admin area", () => {
  it.each([
    "/admin",
    "/admin/",
    "/admin/events",
    "/admin/events/tfc-12",
    "/api/admin",
    "/api/admin/me",
    "/api/admin/bouts/tfc-12/lock",
  ])("%s is inside it", (path) => {
    expect(isAdminPath(path)).toBe(true);
  });

  it.each([
    "/",
    "/profile",
    "/account/sign-in",
    "/api/accounts/me",
    "/api/health",
    // A prefix match on the string alone would take these too, and answer 401
    // where the page a fan asked for is nobody's business but the router's.
    "/administrators",
    "/admin-guide",
    "/api/administration",
  ])("%s is outside it", (path) => {
    expect(isAdminPath(path)).toBe(false);
  });

  it("looks past a query string", () => {
    expect(isAdminPath("/admin/events?season=2")).toBe(true);
    expect(isAdminPath("/administrators?admin=1")).toBe(false);
  });

  it("takes a path however it is spelled or escaped", () => {
    // Vue Router matches case-insensitively, so `/ADMIN` renders the admin
    // page. A guard that only knew the lower-case spelling would wave it past.
    expect(isAdminPath("/ADMIN")).toBe(true);
    expect(isAdminPath("/Admin/Events")).toBe(true);
    expect(isAdminPath("/%61dmin")).toBe(true);
  });

  it("guards a path it cannot make sense of rather than serving it", () => {
    // A half-written escape sequence: `decodeURIComponent` throws on it, and
    // the answer to not knowing what a path says is not to let it through.
    expect(isAdminPath("/admin/%E0%A4%A")).toBe(true);
  });
});

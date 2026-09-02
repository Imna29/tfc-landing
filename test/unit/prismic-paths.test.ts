import { describe, expect, it } from "vitest";
import {
  COLLECTION_TYPES,
  FIXED_PATHS,
  pathForDocument,
  pathsToRevalidate,
} from "../../server/utils/prismic-paths";

describe("the path a document is served at", () => {
  it.each([
    ["home_page", "/"],
    ["privacy_policy", "/privacy-policy"],
    ["terms_of_service", "/terms-of-service"],
  ])("puts the %s singleton at %s", (type, path) => {
    expect(pathForDocument({ type })).toBe(path);
  });

  it("puts a page at the catch-all route from prismic.config.json", () => {
    expect(pathForDocument({ type: "page", uid: "about" })).toBe("/about");
  });

  it("puts a fighter under /fighters, where app/pages/fighters/[id].vue reads it", () => {
    expect(pathForDocument({ type: "fighter", uid: "giorgi" })).toBe("/fighters/giorgi");
  });

  // Rendered inside other pages, so no path of their own.
  it.each(["footer", "media", "media_type", "cta", "picture", "discipline", "division"])(
    "gives %s no path of its own",
    (type) => {
      expect(pathForDocument({ type, uid: "anything" })).toBeNull();
    },
  );

  it("gives a repeatable document with no uid no path, rather than a broken one", () => {
    expect(pathForDocument({ type: "page", uid: null })).toBeNull();
    expect(pathForDocument({ type: "fighter" })).toBeNull();
  });
});

describe("the set of paths a publish purges", () => {
  it("always covers the pages that are not documents", () => {
    expect(pathsToRevalidate([])).toEqual([...FIXED_PATHS]);
  });

  it("covers every document that has a page", () => {
    const paths = pathsToRevalidate([
      { type: "page", uid: "about" },
      { type: "fighter", uid: "giorgi" },
    ]);

    expect(paths).toContain("/about");
    expect(paths).toContain("/fighters/giorgi");
  });

  // The same page in two languages is two documents claiming one path.
  it("lists a path once when two documents resolve to it", () => {
    const paths = pathsToRevalidate([
      { type: "page", uid: "about" },
      { type: "page", uid: "about" },
      { type: "home_page" },
    ]);

    expect(paths).toEqual([...new Set(paths)]);
    expect(paths.filter((path) => path === "/")).toHaveLength(1);
  });

  it("keeps the fixed paths even when a document lands on one of them", () => {
    expect(pathsToRevalidate([{ type: "home_page" }])).toEqual([...FIXED_PATHS]);
  });
});

// A type that resolves to a path and is not queried is a page nothing purges.
describe("the types the webhook queries", () => {
  it.each(["page", "fighter"])("includes %s, which has a path per document", (type) => {
    expect(COLLECTION_TYPES).toContain(type);
  });

  it("does not include singletons, whose paths are already fixed", () => {
    expect(COLLECTION_TYPES).not.toContain("home_page");
    expect(COLLECTION_TYPES).not.toContain("privacy_policy");
  });

  it("resolves a path for every type it queries", () => {
    for (const type of COLLECTION_TYPES) {
      expect(pathForDocument({ type, uid: "a-uid" })).not.toBeNull();
    }
  });
});

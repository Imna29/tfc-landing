/**
 * The signed-in fan's Balance, for the site header.
 *
 * **Asked for in the browser and never during server rendering**, which is not
 * how the rest of this app reads a session. The header is part of every
 * marketing page, and those are edge-cached: a Balance rendered into one would
 * be stored and served to whoever asked next (ADR-0008). So the page ships
 * without it and the browser fills it in — the one arrangement that is safe on
 * a cached page and a server-rendered one alike, without the header having to
 * know which it is on.
 *
 * The value is shared state rather than a ref inside the header, because the
 * header outlives every page: it is mounted once and never again, so signing
 * in, signing out and submitting an Entry are the moments that have to say the
 * answer has changed.
 *
 * Hence three verbs rather than one. {@link Balance.load} is "make sure we
 * know", for a component appearing and wanting something to render;
 * {@link Balance.refresh} is "it has changed, ask again", for the handful of
 * places that change it; {@link Balance.forget} is "there is no fan now".
 */
export function useBalance() {
  const balance = useState<number | null>("balance", () => null);
  // Told apart from `balance` being null, which is also what a signed-out
  // visitor and a Season that has not opened look like: without this, every
  // one of those would ask again on every mount.
  const asked = useState<boolean>("balance-asked", () => false);

  /** Asks what the fan holds now. Silent when nobody is signed in. */
  async function refresh() {
    asked.value = true;

    try {
      const { balance: held } = await $fetch("/api/coins/balance");

      balance.value = held;
    } catch {
      // A signed-out visitor is answered 401, which is not a failure — it is
      // the answer. Anything else leaves the header saying nothing, which is
      // what it said a moment ago.
      balance.value = null;
    }
  }

  /**
   * Asks, unless something already has on this page.
   *
   * The header renders the Balance twice — once for a wide window and once
   * inside the menu a narrow one opens — and the second of those appearing is
   * not news about the fan's Coins.
   */
  async function load() {
    if (!asked.value) await refresh();
  }

  /** Forgets it, for a fan who has just signed out. */
  function forget() {
    balance.value = null;
    asked.value = true;
  }

  return { balance, load, refresh, forget };
}

import { inPlaySection } from "~/utils/navigation";

/**
 * Gives every page of the game the game's chrome.
 *
 * The alternative is a line of `definePageMeta` in each of eight pages, and
 * the failure mode of that is a ninth page added later without it: a card, a
 * board or an account rendered inside the marketing header, which reads as the
 * page having lost its navigation rather than as a mistake anybody made.
 * `PLAY_SECTION` is the one list that decides, and it is the same list
 * `test/unit/navigation.test.ts` holds the marketing navigation away from.
 *
 * A page can still say otherwise. `definePageMeta({ layout: … })` is read
 * before middleware runs and is left alone here, so a page inside the section
 * that needs different chrome asks for it in the ordinary way.
 */
export default defineNuxtRouteMiddleware((to) => {
  if (to.meta.layout === undefined && inPlaySection(to.path)) {
    setPageLayout("play");
  }
});

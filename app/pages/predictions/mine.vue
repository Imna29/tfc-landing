<script setup lang="ts">
import type { FanHistory } from "#shared/history";
import { SIGN_IN_MESSAGES } from "#shared/signIn";
import { accountPath, MY_PREDICTIONS, THE_CARD } from "~/utils/navigation";

/**
 * My Predictions: everything this fan has committed, and how it is going.
 *
 * The second item in the game's own navigation, and the page a fan opens while
 * a card is being fought. It answers one request — `/api/predictions/history`,
 * every Entry they have ever committed — and `EntryHistory` lays it out in the
 * two halves a fan actually came for: what is still riding above the line, and
 * the record kept forever below it.
 *
 * It used to be a section of the profile. It is here because it is part of the
 * game rather than part of the account: a fan checking whether their chain
 * survived Bout 3 is doing the same thing they were doing on the card a moment
 * ago, and the profile is where the username and the sign-out button are. The
 * profile links here rather than drawing it again, so one page owns a fan's
 * Entries and two of them cannot come to show it differently.
 *
 * **The filter lives in the URL.** A fan who reloads, or presses back, is
 * looking at the same page they left, and the server renders the filtered
 * history rather than sending all of it for the browser to hide most of. That
 * matters more every Season: history is kept forever.
 *
 * A visitor is shown the way to an account rather than an empty page, and both
 * ways back here — `returnTo` accepts this path because it is inside the
 * section, so signing in lands on the page they were asking for rather than on
 * a profile they did not ask about.
 *
 * Never edge-cached and server-rendered per request. It is nothing but one
 * fan's own answers, which is as personal as this application gets, and it
 * inherits `/predictions`' exemption in `route-rules.ts` by sitting under it
 * (ADR-0008). `/predictions/MINE` is a 404 rather than a second spelling that
 * could miss that rule (ADR-0012).
 */
const route = useRoute();
const { data: fan } = await useFan();

/**
 * Through `useRequestFetch` for the reason `useFan` uses it: this runs during
 * server rendering too, and a plain `$fetch` there carries no cookie — the
 * route would answer 401 and the page would fail to render for exactly the
 * fans it is for.
 */
const request = useRequestFetch();

/** What the fan is asking to see, as the two controls put it in the URL. */
const asked = computed(() => ({
  season: typeof route.query.season === "string" ? route.query.season : undefined,
  status: typeof route.query.status === "string" ? route.query.status : undefined,
}));

const { data: history } = await useAsyncData<FanHistory | null>(
  "entry-history",
  async () =>
    fan.value
      ? await request<FanHistory>("/api/predictions/history", { query: asked.value })
      : null,
  { watch: [fan, asked] },
);

/**
 * Moves the filter, which is a navigation.
 *
 * The rest of the query string is kept rather than replaced, so that filtering
 * a history never silently drops something else a page was carrying.
 */
function ask(filter: { season: string; status: string }) {
  return navigateTo({
    query: {
      ...route.query,
      // Dropped rather than sent empty, so that the whole history — which is
      // where the page starts — is the plain URL a fan arrives at rather than
      // one spelling "every" out in two parameters.
      season: filter.season === "" ? undefined : filter.season,
      status: filter.status === "" ? undefined : filter.status,
    },
  });
}

useSeoMeta({
  title: "My Predictions",
  description:
    "Every Entry you have committed in TFC Predictions: what you are still " +
    "riding on, and everything that is done with.",
  robots: "noindex",
});
</script>

<template>
  <PageHeading text="My Predictions" />

  <section class="px-6 md:px-20 pb-24">
    <div class="max-w-3xl mx-auto">
      <EntryHistory v-if="fan && history" :history="history" @ask="ask" />

      <template v-else-if="!fan">
        <p class="text-on-surface/80 leading-relaxed">
          Sign in to read the Entries you have committed. Everything you predict is kept here —
          through this Season and every one after it.
        </p>

        <div class="mt-8 flex flex-wrap gap-4">
          <NuxtLink
            :to="accountPath('sign-in', MY_PREDICTIONS)"
            class="bg-primary-container text-white font-headline font-black uppercase tracking-widest px-8 py-4"
          >
            {{ SIGN_IN_MESSAGES.signIn }}
          </NuxtLink>
          <NuxtLink
            :to="accountPath('sign-up', MY_PREDICTIONS)"
            class="border border-outline-variant/40 font-headline font-black uppercase tracking-widest px-8 py-4"
          >
            {{ SIGN_IN_MESSAGES.createAccount }}
          </NuxtLink>
        </div>
      </template>
    </div>
  </section>

  <PageCrossLink
    :to="THE_CARD"
    heading="The next card is where the next one starts"
    label="Answer the card"
  />
</template>

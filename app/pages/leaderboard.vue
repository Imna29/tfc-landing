<script setup lang="ts">
import {
  LEADERBOARD_MESSAGES,
  PAST_SEASONS_MESSAGES,
  type ClosedSeason,
  type Leaderboard,
} from "#shared/standings";

/**
 * The public scoreboard: the top ten of the Season, and where the fan reading
 * it stands.
 *
 * Visible signed out, so a visitor can size up the competition before joining
 * it, and personalised anyway: signing in adds one row, the fan's own,
 * wherever in the Season it is. That is what makes a public page
 * uncacheable — ADR-0008 names this page in as many words — and
 * `route-rules.ts` exempts it and server-renders it per request.
 *
 * One request rather than two. The Rank on the profile is `/api/coins/standing`
 * and this is `/api/leaderboard`, and they are the same ordering of the same
 * materialised Balance (`server/utils/standings.ts`) asked at two shapes: one
 * fan's own place there, a page of places here.
 *
 * `useFan` is asked because an empty `you` is four different things — a
 * visitor, a fan in the top ten, a fan the Season has granted nothing, and a
 * Season nobody is playing — and only the session tells the first from the
 * rest. The board is asked again when it changes, because signing in is what
 * puts a row of their own on the page.
 *
 * **Seasons that have ended are listed under it.** This is the page a fan
 * comes to for standings, so it is where the ones that are frozen have to be
 * reachable from — and it matters most in exactly the state where the table
 * above is empty: between Seasons, when the leaderboard says there is nothing
 * to rank and the last Season's final standings are what somebody actually
 * came for. `/standings/<id>` is that page (`CONTEXT.md` keeps the two words
 * apart: the leaderboard is the Season being played).
 */
const request = useRequestFetch();
const { data: fan } = await useFan();

const { data: leaderboard } = await useAsyncData<Leaderboard>(
  "season-leaderboard",
  // Through `useRequestFetch` for the reason `useFan` uses it: this runs
  // during server rendering too, and a plain `$fetch` there carries no cookie
  // — the page would render without the one row it was not cached for.
  () => request<Leaderboard>("/api/leaderboard"),
  { watch: [fan] },
);

// A second request rather than a field on the first: the list is the same for
// everybody and the board is not, and folding an anonymous list into a
// personalised answer would make every leaderboard request pay for it.
const { data: ended } = await useAsyncData<{ seasons: ClosedSeason[] }>("ended-seasons", () =>
  request<{ seasons: ClosedSeason[] }>("/api/standings"),
);

useSeoMeta({
  title: "Leaderboard",
  description:
    "The top ten fans of the TFC Predictions Season, by the Coins they hold, and where you stand among them.",
});
</script>

<template>
  <PageHeading text="Leaderboard" />

  <section class="px-6 md:px-20 pb-24">
    <div class="max-w-3xl mx-auto">
      <SeasonStandings
        v-if="leaderboard"
        :standings="leaderboard"
        :signed-in="!!fan"
        :words="LEADERBOARD_MESSAGES"
      />

      <section class="mt-16 border-t border-outline-variant/20 pt-10">
        <h2 class="font-headline text-2xl font-black italic uppercase">
          {{ PAST_SEASONS_MESSAGES.heading }}
        </h2>

        <p class="mt-2 max-w-2xl text-sm text-on-surface/70 leading-relaxed">
          {{ PAST_SEASONS_MESSAGES.what }}
        </p>

        <ul v-if="ended && ended.seasons.length > 0" class="mt-6 grid gap-3">
          <li v-for="season in ended.seasons" :key="season.id">
            <NuxtLink
              :to="`/standings/${season.id}`"
              class="flex items-baseline justify-between gap-4 border-b border-outline-variant/15 pb-3 hover:text-primary-container"
            >
              <span class="font-bold">{{ season.name }}</span>
              <span class="text-sm text-on-surface/60">Ended {{ inTbilisi(season.closedAt) }}</span>
            </NuxtLink>
          </li>
        </ul>

        <p v-else class="mt-6 max-w-xl text-sm text-on-surface/70 leading-relaxed">
          {{ PAST_SEASONS_MESSAGES.none }}
        </p>
      </section>
    </div>
  </section>

  <PageCrossLink to="/predictions" heading="Climb it from the card" label="Make a Prediction" />
</template>

<script setup lang="ts">
import type { Leaderboard } from "#shared/standings";

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
      <SeasonLeaderboard v-if="leaderboard" :leaderboard="leaderboard" :signed-in="!!fan" />
    </div>
  </section>

  <PageCrossLink to="/predictions" heading="Climb it from the card" label="Make a Prediction" />
</template>

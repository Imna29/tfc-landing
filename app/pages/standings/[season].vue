<script setup lang="ts">
import {
  FINAL_STANDINGS_MESSAGES,
  PAST_SEASONS_MESSAGES,
  type FinalStandings,
} from "#shared/standings";

/**
 * What one Season finished as: the top of its final standings, and where the
 * fan reading them came.
 *
 * The leaderboard for a Season that is over, and deliberately its own page
 * rather than the leaderboard with an id on it. `CONTEXT.md` keeps the two
 * apart — the leaderboard is the Season being played, a Season that has ended
 * has final standings — and the difference is real: these rows were frozen
 * when the Season closed and nothing since has moved them, which is what makes
 * them the record TFC awards Prizes from (ADR-0007).
 *
 * The table is `SeasonStandings`, the same component the leaderboard uses, and
 * everything that differs is the vocabulary handed to it: nothing here fills
 * up, nobody climbs it, and a fan who is not in it will not be.
 *
 * Public and personalised at once, exactly like the leaderboard: a visitor
 * reads the top ten, and signing in adds one row — theirs, however far down it
 * they finished. `route-rules.ts` exempts `/standings` for it (ADR-0008), and
 * the row is server-rendered because that exemption is what pays for it.
 *
 * A Season still being played has no page here and answers 404, which is the
 * `notFound` sentence rather than a blank table: "final" is what it does not
 * have yet.
 */
const request = useRequestFetch();
const route = useRoute();
const { data: fan } = await useFan();

const { data: standings, error } = await useAsyncData<FinalStandings>(
  // Keyed by the Season, so that following two of these in one session is two
  // answers rather than the first one shown twice.
  () => `final-standings-${route.params.season}`,
  // Through `useRequestFetch` for the reason the leaderboard uses it: this runs
  // during server rendering too, and a plain `$fetch` there carries no cookie
  // — the page would render without the one row it was not cached for.
  () => request<FinalStandings>(`/api/standings/${route.params.season}`),
  { watch: [fan] },
);

// A Season that never closed, or an id nothing is called. Answered as the 404
// it is rather than as an empty set of standings, which would read as a Season
// nobody played.
if (!standings.value) {
  throw createError({
    statusCode: 404,
    statusMessage: PAST_SEASONS_MESSAGES.notFound,
    message: PAST_SEASONS_MESSAGES.notFound,
    data: error.value,
    fatal: true,
  });
}

useSeoMeta({
  title: () => `${standings.value?.season.name} final standings`,
  description: () =>
    `How ${standings.value?.season.name} of TFC Predictions finished: the fans holding the most Coins when it closed.`,
});
</script>

<template>
  <PageHeading text="Final standings" />

  <section class="px-6 md:px-20 pb-24">
    <div class="max-w-3xl mx-auto">
      <SeasonStandings
        v-if="standings"
        :standings="standings"
        :signed-in="!!fan"
        :words="FINAL_STANDINGS_MESSAGES"
      />

      <p v-if="standings" class="mt-8 text-sm text-on-surface/60">
        Closed {{ inTbilisi(standings.season.closedAt) }}.
      </p>
    </div>
  </section>

  <PageCrossLink to="/leaderboard" heading="The Season being played" label="See the leaderboard" />
</template>

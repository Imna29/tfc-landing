<script setup lang="ts">
import { STARTING_BALANCE, coinsLabel } from "#shared/coins";
import { SEASON_NAME_LENGTH } from "#shared/seasons";

/**
 * Opening a Season, and the record of the ones that have been.
 *
 * Deliberately plain, like the rest of the admin area (ADR-0011): a form, a
 * table, and the sentence the server answered with. Nothing here decides who
 * may open a Season — `server/middleware/admin.ts` refused everyone else
 * before this page was rendered at all.
 *
 * Closing a Season and freezing its final standings arrive with #19. Until
 * then a Season opens and stays open, which is why there is exactly one row
 * here that says "Open".
 */
useSeoMeta({
  title: "Seasons",
  description: "Opening a Season of TFC Predictions.",
  robots: "noindex",
});

const request = useRequestFetch();

const { data, error, refresh } = await useAsyncData("admin-seasons", () =>
  request("/api/admin/seasons"),
);

// On a client-side navigation nothing has asked the server anything, so an
// empty answer here is a fan who guessed the URL rather than an admin with no
// Seasons — unless the server answered something else entirely, which is why
// this is not simply a refusal. Same reasoning as `app/pages/admin/index.vue`.
if (!data.value) throw noAnswerFrom(error.value);

const seasons = computed(() => data.value?.seasons ?? []);
const anyOpen = computed(() => seasons.value.some((season) => season.status === "open"));

const name = ref("");
const problem = ref("");
const opened = ref("");
const opening = ref(false);

async function openSeason() {
  opening.value = true;
  problem.value = "";
  opened.value = "";

  try {
    const { season, fansGranted } = await $fetch("/api/admin/seasons", {
      method: "POST",
      body: { name: name.value },
    });

    opened.value =
      `${season.name} is open. ${fansGranted} ` +
      `${fansGranted === 1 ? "fan starts" : "fans start"} on ${coinsLabel(STARTING_BALANCE)}.`;
    name.value = "";

    await refresh();
  } catch (error) {
    problem.value = problemFrom(error);
  } finally {
    opening.value = false;
  }
}
</script>

<template>
  <PageHeading text="Seasons" />

  <section class="px-6 md:px-20 pb-24">
    <div class="max-w-3xl mx-auto">
      <p class="text-on-surface/80 leading-relaxed">
        Opening a Season gives every fan who has an account
        {{ coinsLabel(STARTING_BALANCE) }}, and every fan who joins afterwards the same. It is the
        only thing in TFC Predictions that creates Coins: there is no way to add any to a fan while
        a Season is being played, by design.
      </p>

      <form class="mt-10 grid gap-6 max-w-xl" novalidate @submit.prevent="openSeason">
        <AccountField
          v-model="name"
          name="season-name"
          label="Season name"
          type="text"
          autocomplete="off"
          :hint="`${SEASON_NAME_LENGTH.minimum} to ${SEASON_NAME_LENGTH.maximum} characters. Fans see it on the leaderboard.`"
          :problem="problem"
        />

        <div>
          <button
            type="submit"
            :disabled="opening || anyOpen"
            class="bg-primary-container text-white font-headline font-black uppercase tracking-widest px-8 py-4 disabled:opacity-60"
          >
            {{ opening ? "Opening…" : "Open the Season" }}
          </button>

          <p v-if="anyOpen" class="mt-3 text-sm text-on-surface/70">
            A Season is open already. Closing one arrives with #19.
          </p>
        </div>

        <p v-if="opened" class="text-sm text-on-surface/80" role="status">{{ opened }}</p>
      </form>

      <h2 class="font-headline text-2xl font-black italic uppercase mt-16">Every Season</h2>

      <table v-if="seasons.length > 0" class="mt-6 w-full text-left text-sm">
        <thead class="font-headline text-xs font-black uppercase tracking-widest">
          <tr class="border-b border-outline-variant/30">
            <th scope="col" class="py-3 pr-4">Season</th>
            <th scope="col" class="py-3 pr-4">State</th>
            <th scope="col" class="py-3 pr-4">Opened</th>
            <th scope="col" class="py-3 pr-4">Closed</th>
            <th scope="col" class="py-3">Fans started</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="season in seasons" :key="season.id" class="border-b border-outline-variant/15">
            <td class="py-3 pr-4 font-bold">{{ season.name }}</td>
            <td class="py-3 pr-4">{{ season.status === "open" ? "Open" : "Closed" }}</td>
            <td class="py-3 pr-4">{{ inTbilisi(season.openedAt) }}</td>
            <td class="py-3 pr-4">{{ inTbilisi(season.closedAt) }}</td>
            <td class="py-3">{{ season.fansGranted }}</td>
          </tr>
        </tbody>
      </table>

      <p v-else class="mt-6 text-on-surface/70">
        None yet. Nobody holds any Coins until the first one opens.
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { STARTING_BALANCE, coinsLabel } from "#shared/coins";
import { CLOSE_MESSAGES, SEASON_NAME_LENGTH } from "#shared/seasons";

/**
 * Running a Season: opening one, closing it, and the record of the ones that
 * have been.
 *
 * Deliberately plain, like the rest of the admin area (ADR-0011): a form, a
 * table, and the sentence the server answered with. Nothing here decides who
 * may open or close a Season — `server/middleware/admin.ts` refused everyone
 * else before this page was rendered at all.
 *
 * **Closing is the one button on this page that cannot be taken back**, so it
 * says so beside itself and asks first. What it does — freeze what every fan
 * finished on, as the record Prizes are decided from — is argued in
 * `server/api/admin/seasons/[id]/close.post.ts`; what an admin needs from this
 * page is to know it is final before they press it, and to be told which Bouts
 * are outstanding when it refuses.
 */
useSeoMeta({
  title: "Seasons",
  description: "Opening and closing a Season of TFC Predictions.",
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

/** What closing said, and which Season is being closed while it runs. */
const refusedClose = ref("");
const closed = ref("");
const closing = ref("");

/**
 * Closes a Season, having asked first.
 *
 * The confirmation is not ceremony. Every other button in the admin area
 * either does something reversible or refuses on its own; this one freezes a
 * record the whole contest is decided on, and `a_closed_season_is_never_reopened`
 * means an accidental press cannot be undone anywhere — not by a route, and
 * not by hand in SQL.
 */
async function closeSeason(season: { id: string; name: string }) {
  if (!confirm(`Close ${season.name}? ${CLOSE_MESSAGES.what}`)) return;

  closing.value = season.id;
  refusedClose.value = "";
  closed.value = "";

  try {
    const { season: it, fansRanked } = await $fetch(`/api/admin/seasons/${season.id}/close`, {
      method: "POST",
    });

    closed.value = CLOSE_MESSAGES.closed(it.name, fansRanked);

    await refresh();
  } catch (error) {
    refusedClose.value = problemFrom(error);
  } finally {
    closing.value = "";
  }
}

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
            A Season is open already. Close it below before opening the next one.
          </p>
        </div>

        <p v-if="opened" class="text-sm text-on-surface/80" role="status">{{ opened }}</p>
      </form>

      <h2 class="font-headline text-2xl font-black italic uppercase mt-16">Every Season</h2>

      <p class="mt-2 text-sm text-on-surface/70 leading-relaxed">{{ CLOSE_MESSAGES.what }}</p>

      <p v-if="closed" class="mt-4 text-sm text-on-surface/80" role="status">{{ closed }}</p>
      <p v-if="refusedClose" class="mt-4 text-sm text-error" role="alert">{{ refusedClose }}</p>

      <table v-if="seasons.length > 0" class="mt-6 w-full text-left text-sm">
        <thead class="font-headline text-xs font-black uppercase tracking-widest">
          <tr class="border-b border-outline-variant/30">
            <th scope="col" class="py-3 pr-4">Season</th>
            <th scope="col" class="py-3 pr-4">State</th>
            <th scope="col" class="py-3 pr-4">Opened</th>
            <th scope="col" class="py-3 pr-4">Closed</th>
            <th scope="col" class="py-3 pr-4">Fans started</th>
            <th scope="col" class="py-3"><span class="sr-only">Close</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="season in seasons" :key="season.id" class="border-b border-outline-variant/15">
            <td class="py-3 pr-4 font-bold">{{ season.name }}</td>
            <td class="py-3 pr-4">{{ season.status === "open" ? "Open" : "Closed" }}</td>
            <td class="py-3 pr-4">{{ inTbilisi(season.openedAt) }}</td>
            <td class="py-3 pr-4">{{ inTbilisi(season.closedAt) }}</td>
            <td class="py-3 pr-4">{{ season.fansGranted }}</td>
            <td class="py-3">
              <button
                v-if="season.status === 'open'"
                type="button"
                :disabled="closing === season.id"
                class="bg-primary-container text-white font-headline text-xs font-black uppercase tracking-widest px-4 py-2 disabled:opacity-60"
                @click="closeSeason(season)"
              >
                {{ closing === season.id ? "Closing…" : "Close the Season" }}
              </button>

              <NuxtLink
                v-else
                :to="`/standings/${season.id}`"
                class="text-sm underline underline-offset-4"
              >
                Final standings
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>

      <p v-else class="mt-6 text-on-surface/70">
        None yet. Nobody holds any Coins until the first one opens.
      </p>
    </div>
  </section>
</template>

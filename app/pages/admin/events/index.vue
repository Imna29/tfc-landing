<script setup lang="ts">
/**
 * Importing a fight card out of Prismic and into the game.
 *
 * Deliberately plain, like the rest of the admin area (ADR-0011): the cards
 * Prismic holds, what has been pulled through, and a button. Nothing here
 * decides who may import — `server/middleware/admin.ts` refused everyone else
 * before this page was rendered at all.
 *
 * What the page has to make obvious is the one-way door in ADR-0001. A card
 * can be re-imported freely while every Bout on it is closed, and not at all
 * once one has been opened — whether it is still open or has since locked,
 * because fans hold Coins against those rows either way. So each card says
 * which side of that line it is on rather than only whether it is in.
 *
 * The second thing it has to make obvious is what is left to do to a card that
 * is in: how many of its Bouts nobody has priced, how many are open, and how
 * many have locked. A card is priced Bout by Bout on `/admin/events/[id]`, and
 * this is where an admin sees at a glance which card still needs sitting down
 * with and how far through the fought ones are.
 */
useSeoMeta({
  title: "Events",
  description: "Importing a fight card into TFC Predictions.",
  robots: "noindex",
});

const request = useRequestFetch();

const { data, error, refresh } = await useAsyncData("admin-events", () =>
  request("/api/admin/events"),
);

// On a client-side navigation nothing has asked the server anything, so an
// empty answer here is a fan who guessed the URL rather than an admin with no
// cards — unless the server answered something else entirely, which is why
// this is not simply a refusal. Same reasoning as `app/pages/admin/index.vue`.
if (!data.value) throw noAnswerFrom(error.value);

const cards = computed(() => data.value?.cards ?? []);
const season = computed(() => data.value?.season ?? null);

const importing = ref("");
const problem = ref("");
const done = ref("");

async function importCard(prismicId: string) {
  importing.value = prismicId;
  problem.value = "";
  done.value = "";

  try {
    const { event, season: into } = await $fetch("/api/admin/events", {
      method: "POST",
      body: { prismicId },
    });

    done.value =
      `${event.title} is in ${into.name}: ${event.bouts} ` +
      `${event.bouts === 1 ? "Bout" : "Bouts"}, ` +
      `${event.replaced ? "replacing what was imported before." : "imported for the first time."}`;

    await refresh();
  } catch (error) {
    problem.value = problemFrom(error);
  } finally {
    importing.value = "";
  }
}
</script>

<template>
  <PageHeading text="Events" />

  <section class="px-6 md:px-20 pb-24">
    <div class="max-w-5xl mx-auto">
      <p class="text-on-surface/80 leading-relaxed">
        A card is authored in Prismic and copied into the game here. From then on the copy is what
        the game runs on: editing the document afterwards changes the marketing site, never a Bout a
        fan has predicted on. Re-importing pulls a lineup change through, and is refused once any
        Bout on the card has been opened.
      </p>

      <p v-if="!season" class="mt-6 text-on-surface/80">
        No Season is open, so there is nowhere to import a card into.
        <NuxtLink to="/admin/seasons" class="underline">Open one first.</NuxtLink>
      </p>
      <p v-else class="mt-6 text-sm text-on-surface/70">Importing into {{ season.name }}.</p>

      <p v-if="done" class="mt-6 text-sm text-on-surface/80" role="status">{{ done }}</p>
      <p v-if="problem" class="mt-6 text-sm text-error" role="alert">{{ problem }}</p>

      <table v-if="cards.length > 0" class="mt-10 w-full text-left text-sm">
        <thead class="font-headline text-xs font-black uppercase tracking-widest">
          <tr class="border-b border-outline-variant/30">
            <th scope="col" class="py-3 pr-4">Card</th>
            <th scope="col" class="py-3 pr-4">Scheduled</th>
            <th scope="col" class="py-3 pr-4">Venue</th>
            <th scope="col" class="py-3 pr-4">Bouts</th>
            <th scope="col" class="py-3 pr-4">In the game</th>
            <th scope="col" class="py-3 pr-4">Left to do</th>
            <th scope="col" class="py-3" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="card in cards"
            :key="card.prismicId"
            class="border-b border-outline-variant/15 align-top"
          >
            <td class="py-3 pr-4 font-bold">{{ card.title ?? "Untitled" }}</td>
            <td class="py-3 pr-4">{{ inTbilisi(card.scheduledStart) }}</td>
            <td class="py-3 pr-4">{{ card.venue ?? "—" }}</td>
            <td class="py-3 pr-4">{{ card.bouts }}</td>
            <td class="py-3 pr-4">
              <template v-if="card.imported">
                {{ card.imported.bouts }} in {{ card.imported.seasonName }}, imported
                {{ inTbilisi(card.imported.importedAt) }}.
              </template>
              <template v-else>Not imported.</template>
            </td>
            <td class="py-3 pr-4">
              <template v-if="card.imported">
                <NuxtLink :to="`/admin/events/${card.imported.id}`" class="underline">
                  {{
                    card.imported.unpriced === 0
                      ? "Every Bout priced"
                      : `${card.imported.unpriced} of ${card.imported.bouts} still to price`
                  }}
                </NuxtLink>
                <span class="block text-on-surface/70">
                  {{ card.imported.open }} of {{ card.imported.bouts }} open for predictions,
                  {{ card.imported.locked }} locked.
                </span>
              </template>
              <template v-else>—</template>
            </td>
            <td class="py-3">
              <button
                type="button"
                :disabled="
                  !season || (card.imported?.started ?? 0) > 0 || importing === card.prismicId
                "
                class="bg-primary-container text-white font-headline text-xs font-black uppercase tracking-widest px-4 py-3 disabled:opacity-60"
                @click="importCard(card.prismicId)"
              >
                {{
                  importing === card.prismicId
                    ? "Importing…"
                    : card.imported
                      ? "Re-import"
                      : "Import"
                }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <p v-else class="mt-10 text-on-surface/70">
        Prismic holds no cards yet. The content team authors an Event there, with a Bout for each
        fight, and it appears here to be imported.
      </p>
    </div>
  </section>
</template>

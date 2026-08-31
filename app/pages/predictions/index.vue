<script setup lang="ts">
import { priceOf, type BoutPick, type DraftPrediction } from "#shared/entries";
import { PREDICTION_MESSAGES } from "#shared/predictions";

/**
 * The card, and the Entry a fan builds on it.
 *
 * Two halves that meet here and nowhere else. `FightCard` renders the lineup
 * and what the game holds against it; `EntryBuilder` holds the Amount, the
 * combined Multiplier and the button. Between them is this page, which owns
 * the one piece of state they share — what the fan has answered, by Bout —
 * because the card is where answers are given and the panel is where they are
 * committed.
 *
 * The Entry is priced here from the card in front of the fan, by the same
 * function the server prices it with when it arrives (`priceOf`). So the
 * Reward on the panel is the Reward the game promises, and the two cannot come
 * to disagree — which is the whole point of ADR-0002's fixed Multipliers.
 *
 * Never edge-cached, for both of ADR-0008's reasons: it reads a session, and a
 * card ten minutes stale is a Bout shown open that locked eight minutes ago.
 * See `route-rules.ts`.
 */
const { data } = await useAsyncData("upcoming-card", () => $fetch("/api/predictions/card"));
const { data: fan } = await useFan();

const card = computed(() => data.value?.card ?? null);
const predictions = computed(() => data.value?.predictions ?? null);

/**
 * What the fan has answered, by the Bout it answers.
 *
 * Keyed by Bout id rather than by place on the card, because that is what an
 * Entry is submitted against — and a Bout keeps its id when a card is
 * re-imported into a different order.
 */
const picks = ref<Record<string, BoutPick>>({});

/** Takes the answer the card just gave, or drops the Bout from the Entry. */
function answer(boutId: string, pick: BoutPick | null) {
  const answered = { ...picks.value };

  if (pick === null) {
    delete answered[boutId];
  } else {
    answered[boutId] = pick;
  }

  picks.value = answered;
}

/** Every Bout the game is holding something against, by its id. */
const bouts = computed(() =>
  (card.value?.bouts ?? []).flatMap((bout) => {
    const held = predictions.value?.bouts[bout.cardOrder];

    if (!held) return [];

    return [
      {
        id: held.boutId,
        cardOrder: bout.cardOrder,
        corners: { red: bout.red.name, blue: bout.blue.name },
        outcomes: held.outcomes,
      },
    ];
  }),
);

/**
 * The Entry as it stands: every answer, priced from what the card is offering,
 * in the order the Bouts are fought.
 *
 * An answer the card no longer offers is dropped rather than shown at some
 * other Multiplier — it can only happen to a page left open across a
 * re-import, and the server refuses the Entry either way.
 */
const draft = computed<DraftPrediction[]>(() =>
  bouts.value.flatMap((bout) => {
    const pick = picks.value[bout.id];
    const price = pick && priceOf(pick, bout.outcomes);

    if (!pick || !price) return [];

    return [
      { ...pick, ...price, boutId: bout.id, cardOrder: bout.cardOrder, corners: bout.corners },
    ];
  }),
);

useSeoMeta({
  title: () => card.value?.title ?? "TFC Predictions",
  description: () =>
    card.value
      ? `Every Bout on ${card.value.title}, and what each answer pays in TFC Predictions.`
      : "The upcoming TFC card, and what each answer pays in TFC Predictions.",
});
</script>

<template>
  <PageHeading :text="card?.title ?? 'TFC Predictions'" />

  <section class="px-6 md:px-20 pb-24">
    <div class="max-w-[1440px] mx-auto">
      <template v-if="card">
        <p class="text-sm font-bold uppercase tracking-widest text-on-surface/70">
          <time :datetime="card.scheduledStart">{{ inTbilisi(card.scheduledStart) }}</time> ·
          {{ card.venue }}
        </p>

        <p class="mt-4 max-w-3xl text-on-surface/80 leading-relaxed">
          Pick a winner for any Bout, and deepen the pick with a method and a round for a bigger
          Multiplier. Chain Predictions across Bouts into one Entry, commit your Coins, and a Bout
          stops taking Predictions the moment it locks.
        </p>

        <div class="mt-10 grid items-start gap-10 lg:grid-cols-[1fr_360px]">
          <FightCard :card="card" :predictions="predictions" :picks="picks" @pick="answer" />

          <EntryBuilder
            :predictions="draft"
            :fan="fan ?? null"
            class="lg:sticky lg:top-28"
            @remove="answer($event, null)"
            @submitted="picks = {}"
          />
        </div>
      </template>

      <p v-else class="text-on-surface/70 max-w-2xl leading-relaxed">
        {{ PREDICTION_MESSAGES.noCard }}
      </p>
    </div>
  </section>
</template>

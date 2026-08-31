<script setup lang="ts">
import { PREDICTION_MESSAGES } from "#shared/predictions";

/**
 * The card, as a fan reads it before any Coins are involved.
 *
 * The read-only half of the game: every Bout in card order, both fighters with
 * their photos and records, the weight class, the rounds, what each answer
 * pays, and how long is left on the Bout that locks by itself. Picking answers
 * and committing Coins to them is #11 — a fan has to be able to form an
 * opinion about a card before they can have one.
 *
 * Never edge-cached, and not because it is personalised — it is the same page
 * for everybody. A card that is ten minutes stale is a Bout shown open that
 * locked eight minutes ago. See ADR-0008 and `route-rules.ts`.
 */
const { data } = await useAsyncData("upcoming-card", () => $fetch("/api/predictions/card"));

const card = computed(() => data.value?.card ?? null);
const predictions = computed(() => data.value?.predictions ?? null);

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
          Multiplier. Every number below is what that answer pays, and a Bout stops taking
          Predictions the moment it locks.
        </p>

        <FightCard :card="card" :predictions="predictions" class="mt-10" />
      </template>

      <p v-else class="text-on-surface/70 max-w-2xl leading-relaxed">
        {{ PREDICTION_MESSAGES.noCard }}
      </p>
    </div>
  </section>
</template>

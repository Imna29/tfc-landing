<script setup lang="ts">
import type { EntryProgress } from "#shared/entries";
import type { FightCard } from "#shared/fightCard";
import { PREDICTION_MESSAGES } from "#shared/predictions";

/**
 * The card a fan has arrived to play, across the top of the page: which Event
 * it is, when and where it is fought, how long there is left, and how far
 * through it they are.
 *
 * The two numbers on the right are the whole reason this is a strip rather
 * than a heading. A card is a long page and a fan scrolls away from the top of
 * it, so the two things that change while they read — the clock running down
 * to the first Lock, and the Bouts they have answered — are the two things
 * stated before the card starts. Everything else here is a fact about the
 * Event and does not move.
 *
 * The countdown is to the card's scheduled start, which is the moment the Bout
 * fought first locks by itself (ADR-0006). The rest of the card is locked by
 * an admin as it progresses, so once that moment passes there is no single
 * moment left to count down to and the strip says what is happening instead.
 */
const props = defineProps<{
  card: FightCard;
  /** The clock to read the Lock against — `useNow`, held by the page. */
  now: number;
  /** How much of what is open has been answered. */
  progress: EntryProgress;
}>();

const countdown = computed(() => {
  const remaining = remainingUntil(props.card.scheduledStart, props.now);

  return remaining && remainingLabel(remaining);
});
</script>

<template>
  <header class="border-b border-outline-variant/15 bg-surface-container-lowest">
    <div
      class="max-w-[1440px] mx-auto px-6 md:px-20 py-8 md:py-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
    >
      <div class="min-w-0">
        <p class="font-headline text-xs font-black uppercase tracking-[0.2em] text-primary">
          TFC Predictions
        </p>

        <h1
          class="mt-2 font-headline text-4xl md:text-6xl font-black italic uppercase tracking-tighter leading-none"
        >
          {{ card.title }}
        </h1>

        <p
          class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-bold uppercase tracking-widest text-on-surface/60"
        >
          <time :datetime="card.scheduledStart" class="text-on-surface">
            {{ inTbilisi(card.scheduledStart) }}
          </time>
          <span>{{ card.venue }}</span>
          <span>{{ card.bouts.length }} {{ card.bouts.length === 1 ? "Bout" : "Bouts" }}</span>
        </p>
      </div>

      <div class="shrink-0 lg:text-right">
        <p v-if="countdown" class="font-headline text-3xl md:text-4xl font-black tabular-nums">
          {{ countdown }}
        </p>
        <p v-if="countdown" class="mt-1 text-xs uppercase tracking-widest text-on-surface/50">
          until the first Bout locks
        </p>
        <p v-else class="max-w-xs text-sm text-on-surface/60 leading-relaxed">
          {{ PREDICTION_MESSAGES.cardUnderway }}
        </p>
      </div>
    </div>

    <div class="max-w-[1440px] mx-auto px-6 md:px-20 pb-6 flex items-center gap-4">
      <p class="text-xs font-bold uppercase tracking-widest text-on-surface/60 whitespace-nowrap">
        {{ progress.label }}
      </p>
      <!--
        Decoration, and marked as such: the sentence beside it says the same
        thing in words, and a progressbar labelled with that sentence would be
        a screen reader reading it twice.
      -->
      <div
        v-if="progress.offered > 0"
        class="h-[3px] flex-1 overflow-hidden bg-outline-variant/20"
        aria-hidden="true"
      >
        <div class="h-full bg-coin transition-all" :style="{ width: `${progress.percent}%` }" />
      </div>
    </div>
  </header>
</template>

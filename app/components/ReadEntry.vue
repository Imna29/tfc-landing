<script setup lang="ts">
import { coinsLabel } from "#shared/coins";
import { ENTRY_STATUS_LABELS } from "#shared/entries";
// Aliased because `ReadEntry` is also this component, the way `FanStanding` is
// both a shape and the thing that renders one. See `app/pages/profile.vue`.
import type { ReadEntry as Reading, RewardState } from "#shared/history";
import { multiplierLabel } from "#shared/predictions";
import { outcomeLabel } from "#shared/pricing";
import { PREDICTION_GRADE_LABELS } from "#shared/results";

/**
 * One Entry a fan has committed, read back against everything its Bouts have
 * settled to.
 *
 * Named after the shape it draws, which `shared/history.ts` calls a
 * {@link Reading}: the Entry, each of its Predictions graded, the combined
 * Multiplier the chain came to, and what became of the Coins it committed.
 * Nothing is decided here — every number and every sentence arrives worked out,
 * because a component that priced an Entry would be a second opinion about what
 * settlement already paid on it (ADR-0020).
 *
 * It is a component rather than a loop body because My Predictions draws it
 * twice on one page — once for what a fan is still riding on and once for the
 * record underneath — and those two lists have to be the same Entry drawn the
 * same way. `EntryHistory` is what arranges them.
 *
 * **Every Prediction says where it stands, whatever the Entry did.** A chain
 * that is already Lost still shows the Bouts it has left and how the ones
 * already fought went, which is #14's promise kept where a fan can see it: "I
 * was one Bout away" is the most engaging sentence on this page, and an Entry
 * that collapsed to a single word would throw it away. It is also why the grade
 * beside each answer is a different word from the Entry's status where it can
 * be — "Still open" under a Lost Entry is exactly the state that would otherwise
 * look like the game having lost track.
 *
 * **A Prediction whose answer stopped counting says so, and says why.** A
 * Multiplier that quietly dropped to ×1.0 with no sentence beside it reads as
 * the game having taken something away rather than as ADR-0005 protecting the
 * fan from it. The sentence is `endingNote`'s, reached before this is drawn.
 *
 * Renders the `li` itself, so that both listings on the page are ordered lists
 * of Entries rather than lists of wrappers around them.
 */
defineProps<{ read: Reading }>();

/** How the Coins beside an Entry are coloured: paid, promised, or gone. */
const REWARD_TONE = {
  paid: "text-primary",
  returned: "text-on-surface",
  potential: "text-on-surface",
  none: "text-on-surface/60",
} as const satisfies Record<RewardState, string>;
</script>

<template>
  <li class="border border-outline-variant/20 bg-surface-container-low p-6">
    <div class="flex flex-wrap items-baseline justify-between gap-3">
      <p class="text-xs font-bold uppercase tracking-widest text-on-surface/60">
        {{ ENTRY_STATUS_LABELS[read.entry.status] }} ·
        <time :datetime="read.entry.submittedAt">{{ inTbilisi(read.entry.submittedAt) }}</time>
      </p>

      <p class="text-sm font-bold tabular-nums">
        {{ coinsLabel(read.entry.amount) }} at {{ multiplierLabel(read.returns.multiplier) }}
      </p>
    </div>

    <ol class="mt-4 flex flex-col gap-3">
      <li
        v-for="{ prediction, grade, multiplier, ending, note } in read.predictions"
        :key="prediction.boutId"
      >
        <div class="flex items-baseline justify-between gap-3 text-sm">
          <span>
            <span class="text-xs font-bold uppercase tracking-widest text-on-surface/60">
              {{ prediction.eventTitle }} · Bout {{ prediction.cardOrder }}
            </span>
            — {{ outcomeLabel(prediction, prediction.corners) }}
          </span>
          <span class="shrink-0 font-bold tabular-nums">{{ multiplierLabel(multiplier) }}</span>
        </div>

        <p class="mt-1 flex flex-wrap items-baseline gap-2 text-xs">
          <span
            class="font-headline font-black uppercase tracking-widest"
            :class="grade === 'correct' ? 'text-primary' : 'text-on-surface/60'"
          >
            {{ PREDICTION_GRADE_LABELS[grade] }}
          </span>
          <span v-if="ending" class="text-on-surface/70">{{ ending }}</span>
        </p>

        <p v-if="note" class="mt-1 text-xs text-on-surface/70 leading-relaxed">{{ note }}</p>
      </li>
    </ol>

    <p class="mt-4 text-sm leading-relaxed" :class="REWARD_TONE[read.reward.state]">
      {{ read.reward.note }}
    </p>
  </li>
</template>

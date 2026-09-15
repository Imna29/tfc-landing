<script setup lang="ts">
import { coinsLabel } from "#shared/coins";
import { ENTRY_STATUS_LABELS, type EntryStatus } from "#shared/entries";
// Aliased because `ReadEntry` is also this component, the way `FanStanding` is
// both a shape and the thing that renders one. See `app/pages/profile.vue`.
import type { ReadEntry as Reading, RewardState } from "#shared/history";
import { multiplierLabel } from "#shared/predictions";
import { outcomeLabel } from "#shared/pricing";
import { PREDICTION_GRADE_LABELS, type PredictionGrade } from "#shared/results";

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

/**
 * How an Entry's own verdict is drawn: the rail down its edge, the band across
 * its head, and the figures on it.
 *
 * TFC's red is the site's whole voice — the hero rule, the filled buttons, the
 * red block the newsletter sits in — and an Entry that won is the loudest thing
 * a fan has on this page, so it gets the same treatment: the band goes solid
 * red and everything on it inverts. An Entry still riding is marked but not
 * shouted, and one that is over and did not pay is drawn in outline, so the
 * red on the page always means something happened.
 */
const STATUS_TONE = {
  open: {
    rail: "border-l-primary-container",
    band: "bg-primary-container/15",
    chip: "bg-primary-container text-white",
    when: "text-on-surface/50",
    coins: "text-on-surface/70",
    at: "text-on-surface/30",
    figure: "text-primary",
  },
  won: {
    rail: "border-l-primary-container",
    band: "bg-primary-container",
    chip: "bg-white text-primary-container",
    when: "text-white/70",
    coins: "text-white/80",
    at: "text-white/50",
    figure: "text-white",
  },
  lost: {
    rail: "border-l-outline-variant/40",
    band: "bg-surface-container-high",
    chip: "border border-outline-variant/50 text-on-surface/60",
    when: "text-on-surface/50",
    coins: "text-on-surface/60",
    at: "text-on-surface/30",
    figure: "text-on-surface/55",
  },
  cancelled: {
    rail: "border-l-outline-variant/40",
    band: "bg-surface-container-high",
    chip: "border border-outline-variant/50 text-on-surface/60",
    when: "text-on-surface/50",
    coins: "text-on-surface/60",
    at: "text-on-surface/30",
    figure: "text-on-surface/55",
  },
  refunded: {
    rail: "border-l-outline-variant/40",
    band: "bg-surface-container-high",
    chip: "border border-outline-variant/50 text-on-surface/60",
    when: "text-on-surface/50",
    coins: "text-on-surface/60",
    at: "text-on-surface/30",
    figure: "text-on-surface/55",
  },
} as const satisfies Record<
  EntryStatus,
  {
    rail: string;
    band: string;
    chip: string;
    when: string;
    coins: string;
    at: string;
    figure: string;
  }
>;

/**
 * How one Prediction's grade is drawn beside the answer it graded.
 *
 * Three weights of the same red rather than four unrelated colours: filled is
 * a Bout that landed, outlined is one still to be fought, and everything that
 * is over and did not land drops out to the page's own outline.
 */
const GRADE_TONE = {
  correct: "bg-primary-container text-white",
  unresolved: "border border-primary-container/60 text-primary",
  wrong: "border border-outline-variant/50 text-on-surface/50",
  "no result": "border border-outline-variant/50 text-on-surface/60",
} as const satisfies Record<PredictionGrade, string>;

/**
 * How the Coins beside an Entry are drawn: paid, promised, or gone.
 *
 * A Reward is the sentence the whole card was built to arrive at, so it is set
 * on a red rule thick enough to be read as an announcement rather than as the
 * last line of a list.
 */
const REWARD_TONE = {
  paid: "border-t-2 border-primary-container bg-primary-container/15 text-primary font-bold",
  potential: "border-t border-primary-container/40 bg-surface-container-high/40 text-on-surface",
  returned: "border-t border-outline-variant/20 text-on-surface/80",
  none: "border-t border-outline-variant/20 text-on-surface/60",
} as const satisfies Record<RewardState, string>;
</script>

<template>
  <!--
    Three bands rather than one padded box: what the Entry came to, the chain it
    was made of, and what became of the Coins. The same anatomy a Bout on the
    card is drawn in, so that the two things a fan reads Predictions off look
    like they came from the same game.
  -->
  <li
    class="border border-l-4 border-outline-variant/30 bg-surface-container-low"
    :class="STATUS_TONE[read.entry.status].rail"
  >
    <div
      class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4"
      :class="STATUS_TONE[read.entry.status].band"
    >
      <p class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          class="px-2.5 py-1 font-headline text-xs font-black uppercase tracking-widest"
          :class="STATUS_TONE[read.entry.status].chip"
        >
          {{ ENTRY_STATUS_LABELS[read.entry.status] }}
        </span>

        <time
          class="text-xs font-bold uppercase tracking-widest"
          :class="STATUS_TONE[read.entry.status].when"
          :datetime="read.entry.submittedAt"
        >
          {{ inTbilisi(read.entry.submittedAt) }}
        </time>
      </p>

      <!--
        The Amount and what it is riding at, as one figure. The Multiplier is
        the number a fan opens this page for, so it is the one set in the
        headline face at the size the rest of the site sets its numbers.
      -->
      <p class="flex items-baseline gap-2 tabular-nums">
        <span
          class="font-headline text-xs font-black uppercase tracking-widest"
          :class="STATUS_TONE[read.entry.status].coins"
        >
          {{ coinsLabel(read.entry.amount) }}
        </span>
        <span
          class="text-[11px] font-bold uppercase tracking-widest"
          :class="STATUS_TONE[read.entry.status].at"
        >
          at
        </span>
        <span
          class="font-headline text-3xl font-black italic tracking-tighter leading-none"
          :class="STATUS_TONE[read.entry.status].figure"
        >
          {{ multiplierLabel(read.returns.multiplier) }}
        </span>
      </p>
    </div>

    <ol class="flex flex-col">
      <li
        v-for="({ prediction, grade, multiplier, ending, note }, leg) in read.predictions"
        :key="prediction.boutId"
        class="flex gap-4 border-b border-outline-variant/15 px-5 py-4 last:border-b-0"
      >
        <!-- Where in the chain this one is, which is what makes a chain read
             as a chain rather than as four sentences in a row. -->
        <span
          class="w-5 shrink-0 font-headline text-xl font-black italic leading-none tabular-nums text-on-surface/20"
        >
          {{ leg + 1 }}
        </span>

        <div class="min-w-0 flex-1">
          <div class="flex items-baseline justify-between gap-3">
            <span class="text-xs font-bold uppercase tracking-widest text-on-surface/50">
              {{ prediction.eventTitle }} · Bout {{ prediction.cardOrder }}
            </span>
            <span class="shrink-0 font-headline text-sm font-black tabular-nums">
              {{ multiplierLabel(multiplier) }}
            </span>
          </div>

          <p class="mt-1 text-base leading-snug">
            {{ outcomeLabel(prediction, prediction.corners) }}
          </p>

          <p class="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span
              class="px-2 py-0.5 font-headline font-black uppercase tracking-widest"
              :class="GRADE_TONE[grade]"
            >
              {{ PREDICTION_GRADE_LABELS[grade] }}
            </span>
            <span v-if="ending" class="text-on-surface/60">{{ ending }}</span>
          </p>

          <p v-if="note" class="mt-2 text-xs text-on-surface/70 leading-relaxed">{{ note }}</p>
        </div>
      </li>
    </ol>

    <!-- No band at all where the Coins have nothing to say: an Entry the fan
         took back is its own explanation. -->
    <p
      v-if="read.reward.note"
      class="px-5 py-4 text-sm leading-relaxed"
      :class="REWARD_TONE[read.reward.state]"
    >
      {{ read.reward.note }}
    </p>
  </li>
</template>

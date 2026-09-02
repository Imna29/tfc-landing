<script setup lang="ts">
import { isAnswered, pickAnswered } from "#shared/entries";
import { boutHeadline, roundsLabel, type FightCardBout } from "#shared/fightCard";
import {
  boutState,
  BOUT_STATE_LABELS,
  multiplierLabel,
  PREDICTION_MESSAGES,
  type BoutPredictions,
} from "#shared/predictions";
import { outcomeLabel, QUESTIONS, QUESTION_LABELS, type OutcomeAnswer } from "#shared/pricing";

/**
 * One Bout on a card: the two fighters, the weight class, how many rounds —
 * and, only when it is given any, what the game holds against it.
 *
 * `predictions` is the whole of TFC Predictions as far as this component is
 * concerned, and it is optional. Left off, this renders a fight: two names,
 * two records, a division and a number of rounds, which is what a Bout is
 * anywhere it is shown. See `shared/fightCard.ts`.
 *
 * `picking` is the layer above that, and optional in the same way: with it,
 * every answer on an open Bout is a button and the Prediction the fan is
 * building comes back through `update:pick`. Without it, the answers are
 * numbers to read.
 */
const props = defineProps<{
  bout: FightCardBout;
  predictions?: BoutPredictions | null;
  /**
   * The clock to read a Lock against — `useNow`, which the card holds one of.
   *
   * Required even though only the game half reads it, because a clock of this
   * component's own is exactly what {@link useNow} exists to prevent: one
   * started in the browser would disagree with the HTML it was hydrating.
   */
  now: number;
  /**
   * Whether this card is one an Entry is being built on.
   *
   * The third layer, and optional like the second: a lineup, then what the
   * game holds against it, then somewhere for a fan to answer. Left off, every
   * answer renders as what it pays and nothing more — which is the card on a
   * marketing page, and the card of an Event that has been and gone.
   */
  picking?: boolean;
  /** The one answer the fan has given on this Bout, or null for none. */
  pick?: OutcomeAnswer | null;
}>();

const emit = defineEmits<{ "update:pick": [OutcomeAnswer | null] }>();

const state = computed(() => (props.predictions ? boutState(props.predictions, props.now) : null));

/**
 * Answers one of this Bout's Questions, and hands the Prediction upwards.
 *
 * A second answer replaces the first and the same answer twice takes it back,
 * which is `pickAnswered`'s doing: an Entry holds one Prediction per Bout
 * (ADR-0014), so there is one answer here at a time.
 */
function answer(outcome: OutcomeAnswer) {
  emit("update:pick", pickAnswered(props.pick ?? null, outcome));
}

/** How long until this Bout locks, while there is a Lock to count down to. */
const countdown = computed(() => {
  const locksAt = props.predictions?.locksAt;

  if (!locksAt || state.value !== "open") return null;

  const remaining = remainingUntil(locksAt, props.now);

  return remaining && remainingLabel(remaining);
});

/**
 * What to say about the Lock when there is no countdown to show instead.
 *
 * There is deliberately nothing here for an open Bout that locks by itself:
 * that one always has a countdown, because {@link boutState} only calls it
 * open while its Lock is still ahead.
 */
const lockNote = computed(() => {
  if (state.value === "settled") return PREDICTION_MESSAGES.settled;
  if (state.value === "locked") return PREDICTION_MESSAGES.locked;
  if (state.value === "open" && !props.predictions?.locksAt) {
    return PREDICTION_MESSAGES.locksWhenReached;
  }

  return null;
});

/**
 * Whether a fan can answer this Bout right now.
 *
 * Picking is offered to a signed-out visitor as well: they can build an Entry
 * and are asked to sign in when they submit it, which is a better path into
 * the game than a card that does nothing until they have an account.
 */
const answering = computed(() => props.picking === true && state.value === "open");

/** The two names this Bout is fought under, which names a winner Outcome. */
const corners = computed(() => ({ red: props.bout.red.name, blue: props.bout.blue.name }));

/**
 * The Questions this Bout is asking, each with the answers to it and what
 * they pay.
 *
 * All three of them, in the order `QUESTIONS` asks them, each answered on its
 * own terms (ADR-0014) and each answer naming the fighter it is about
 * (ADR-0015) — two winner answers, six method answers, and two for each round
 * the Bout is scheduled for.
 *
 * The one thing dropped is a Question with no Outcomes on it, which is every
 * Question on a Bout nobody has opened: nothing on it is priced yet. There is
 * no list of its own here to drop anything else, because a Bout with one
 * unpriced Outcome cannot be opened — so every Question a fan is shown is one
 * an admin went through, and the same `QUESTIONS` they went through it in.
 *
 * Which Questions may be *committed* is not decided here or anywhere in the
 * app: the server prices whatever answer the Bout is offering, and the Outcome
 * rows are what say that.
 */
const questions = computed(() => {
  const offered = props.predictions?.outcomes ?? [];

  return QUESTIONS.map((question) => ({
    question,
    label: QUESTION_LABELS[question],
    outcomes: offered.filter((outcome) => outcome.question === question),
  })).filter((asked) => asked.outcomes.length > 0);
});
</script>

<template>
  <article
    class="border border-outline-variant/20 bg-surface-container-low p-6 md:p-8"
    :class="{ 'opacity-70': state === 'locked' }"
  >
    <header class="flex flex-wrap items-baseline justify-between gap-3">
      <p class="font-headline text-xs font-black uppercase tracking-widest text-primary">
        Bout {{ bout.cardOrder }}
        <template v-if="bout.mainEvent"> · Main event</template>
        <template v-if="bout.titleFight"> · Title fight</template>
      </p>
      <p class="text-xs font-bold uppercase tracking-widest text-on-surface/60">
        {{ bout.division }} · {{ roundsLabel(bout.scheduledRounds) }}
      </p>
    </header>

    <h3 class="sr-only">{{ boutHeadline(bout) }}</h3>

    <div class="mt-6 grid grid-cols-[1fr_auto_1fr] items-start gap-4">
      <FightCardCorner :corner="bout.red" side="red" />
      <p class="font-headline text-2xl font-black italic uppercase text-on-surface/40 self-center">
        vs
      </p>
      <FightCardCorner :corner="bout.blue" side="blue" />
    </div>

    <!--
      Everything below here is the game. A card shown anywhere else is given no
      `predictions` and stops at the fight above.
    -->
    <div v-if="predictions && state" class="mt-8 border-t border-outline-variant/15 pt-6">
      <div class="flex flex-wrap items-baseline justify-between gap-3">
        <p
          class="font-headline text-xs font-black uppercase tracking-widest"
          :class="state === 'open' ? 'text-primary' : 'text-on-surface/50'"
        >
          {{ BOUT_STATE_LABELS[state] }}
        </p>

        <p v-if="countdown" class="text-sm font-bold tabular-nums">
          Locks in
          <time :datetime="predictions.locksAt ?? undefined">{{ countdown }}</time>
        </p>
        <p v-else-if="lockNote" class="text-xs text-on-surface/60">{{ lockNote }}</p>
      </div>

      <!--
        As many columns as there are Questions on the card, which is three on
        an open Bout and none on one nobody has opened. Laid out from what is
        actually asked rather than from a number written here, which is what
        kept the Bout filled while the three arrived one at a time.
      -->
      <div
        v-if="questions.length > 0"
        class="mt-6 grid gap-6 md:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]"
      >
        <div v-for="asked in questions" :key="asked.question">
          <h4 class="font-headline text-xs font-black uppercase tracking-widest text-on-surface/60">
            {{ asked.label }}
          </h4>

          <ul class="mt-3 flex flex-col gap-2">
            <li v-for="outcome in asked.outcomes" :key="outcome.id">
              <button
                v-if="answering"
                type="button"
                :aria-pressed="isAnswered(pick ?? null, outcome)"
                class="flex w-full items-baseline justify-between gap-3 border px-3 py-2 text-left text-sm transition-colors"
                :class="
                  isAnswered(pick ?? null, outcome)
                    ? 'border-primary bg-primary-container/20'
                    : 'border-outline-variant/20 hover:border-primary/60'
                "
                @click="answer(outcome)"
              >
                <span>{{ outcomeLabel(outcome, corners) }}</span>
                <span class="font-bold tabular-nums">{{
                  multiplierLabel(outcome.multiplier)
                }}</span>
              </button>

              <span
                v-else
                class="flex items-baseline justify-between gap-3 border-b border-outline-variant/10 pb-2 text-sm"
              >
                <span>{{ outcomeLabel(outcome, corners) }}</span>
                <span class="font-bold tabular-nums">{{
                  multiplierLabel(outcome.multiplier)
                }}</span>
              </span>
            </li>
          </ul>
        </div>
      </div>

      <p v-if="questions.length === 0" class="mt-4 text-sm text-on-surface/60">
        {{ PREDICTION_MESSAGES.notOpenYet }}
      </p>
    </div>
  </article>
</template>

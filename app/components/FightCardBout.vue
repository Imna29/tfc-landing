<script setup lang="ts">
import { isAnswered, pickAnswered } from "#shared/entries";
import {
  boutHeadline,
  DISCIPLINE_LABELS,
  fighterProfile,
  roundsLabel,
  type FightCardBout,
} from "#shared/fightCard";
import {
  boutState,
  BOUT_STATE_LABELS,
  multiplierLabel,
  PREDICTION_MESSAGES,
  type BoutPredictions,
  type OfferedOutcome,
} from "#shared/predictions";
import { CORNERS, outcomeLabel, QUESTION_LABELS, type OutcomeAnswer } from "#shared/pricing";
import { CORNER_COLOURS } from "~/utils/corners";

/**
 * One Bout on a card: the two fighters facing each other, and — only when it
 * is given any — what the game holds against them.
 *
 * Laid out as the fight is announced: red on the left, blue on the right,
 * each fighter facing in from their own edge with what they pay to win beside
 * them. A fan reads a card by scanning the two names, so the winner answer is
 * the fighter rather than a row underneath one, and the method answers sit
 * below each of them in that fighter's own column. Every answer still names
 * the fighter it is about (ADR-0015) — the layout is what makes that legible,
 * not a substitute for it.
 *
 * `predictions` is the whole of TFC Predictions as far as this component is
 * concerned, and it is optional. Left off, this renders a fight: two names,
 * two records, a discipline, a division and a number of rounds, which is what
 * a Bout is anywhere it is shown. See `shared/fightCard.ts`.
 *
 * `picking` is the layer above that, and optional in the same way: with it,
 * every answer on an open Bout is a button and the Prediction the fan is
 * building comes back through `update:pick`. Without it, the answers are
 * numbers to read and each fighter is a way through to their own page.
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
 * The two sides of the Bout, each with everything its column renders.
 *
 * Built as one list in corner order rather than as two blocks of markup, so
 * red comes before blue everywhere at once: in the face-off, in the method
 * answers below it, and in the HTML a screen reader walks. That is the order
 * every Outcome is seeded, priced and offered in (`defaultOutcomes`), and a
 * card that read blue-first in one place and red-first in another would be a
 * fan comparing two numbers that are not where they think they are.
 *
 * **What each side offers is read off the Outcomes, never assumed.** A Bout
 * nobody has opened carries none, and a Cage Grappling Bout carries no method
 * answers because its discipline is not asked that Question (ADR-0017) —
 * neither needs a case here, because both are the same empty list.
 *
 * The two Questions are named here rather than walked over, because this
 * component draws them differently on purpose: the winner answers are the two
 * fighters facing each other, and the method answers are chips underneath
 * each. A third Question would want its own place on the Bout, not a column
 * this loop happened to produce.
 */
const sides = computed(() =>
  CORNERS.map((corner) => {
    const offered = props.predictions?.outcomes ?? [];
    const fighter = props.bout[corner];
    const profile = fighterProfile(fighter);
    const winner = offered.find(
      (outcome) => outcome.question === "winner" && outcome.corner === corner,
    );

    /** Whether this fighter is a winner answer to press rather than a name. */
    const pressable = answering.value && winner !== undefined;

    return {
      corner,
      fighter,
      profile,
      winner,
      methods: offered.filter(
        (outcome) => outcome.question === "method" && outcome.corner === corner,
      ),
      pressable,
      wrapper: wrapperFor(pressable, winner, profile),
    };
  }),
);

/** Whether this Bout is asking the method Question of anybody. */
const asksMethod = computed(() => sides.value.some((side) => side.methods.length > 0));

/** Whether the game has anything at all to offer on this Bout yet. */
const asksAnything = computed(() => (props.predictions?.outcomes.length ?? 0) > 0);

/**
 * `NuxtLink`, resolved once here rather than inside the render.
 *
 * A component the template does not name has to be looked up by name, and the
 * lookup belongs in setup — which is also the only place a computed can safely
 * reach it from.
 */
const nuxtLink = resolveComponent("NuxtLink");

/** Whether an answer is the one this fan has given on this Bout. */
function chosen(outcome: OutcomeAnswer): boolean {
  return isAnswered(props.pick ?? null, outcome);
}

/**
 * What wraps a fighter: the winner answer, their profile, or nothing.
 *
 * One element with three jobs rather than three copies of the same fighter.
 * On a card being played it is the button that answers the winner Question; on
 * a lineup, or on a Bout that has locked, it is the way through to what that
 * fighter has done; and on a late replacement with no document behind them it
 * is neither (ADR-0001).
 *
 * The button carries `aria-pressed` and the other two carry nothing, which is
 * how a Bout nobody has opened, and a Bout that has locked, are a card with
 * nothing on it to press.
 */
function wrapperFor(
  pressable: boolean,
  winner: OfferedOutcome | undefined,
  profile: string | null,
) {
  if (pressable && winner) {
    return {
      is: "button",
      attrs: {
        type: "button",
        "aria-pressed": chosen(winner),
        onClick: () => answer(winner),
      },
    };
  }

  if (profile) return { is: nuxtLink, attrs: { to: profile } };

  return { is: "div", attrs: {} };
}
</script>

<template>
  <article
    class="border bg-surface-container-low"
    :class="[
      // Answered Bouts stand out of a long card, so a fan scrolling back knows
      // which of them they have already had a view on.
      pick ? 'border-outline-variant/50' : 'border-outline-variant/20',
      state === 'locked' ? 'opacity-70' : '',
    ]"
  >
    <header
      class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-outline-variant/15 px-4 py-3 text-xs"
    >
      <span class="font-headline text-sm font-black tabular-nums text-on-surface/40">
        <span class="sr-only">Bout </span>{{ String(bout.cardOrder).padStart(2, "0") }}
      </span>

      <span
        v-if="bout.mainEvent"
        class="border border-primary-container px-2 py-0.5 font-bold uppercase tracking-widest text-primary"
      >
        Main event
      </span>
      <span
        v-if="bout.titleFight"
        class="border border-outline-variant/40 px-2 py-0.5 font-bold uppercase tracking-widest"
      >
        Title fight
      </span>

      <span
        class="border border-outline-variant/40 px-2 py-0.5 font-bold uppercase tracking-widest"
      >
        {{ DISCIPLINE_LABELS[bout.discipline] }}
      </span>

      <span class="font-bold uppercase tracking-widest text-on-surface/70">
        {{ bout.division }}
      </span>
      <span class="uppercase tracking-widest text-on-surface/50">
        {{ roundsLabel(bout.scheduledRounds) }}
      </span>

      <!--
        Everything from here down is the game. A card shown anywhere else is
        given no `predictions` and stops at the fight.
      -->
      <span v-if="predictions && state" class="ml-auto flex items-center gap-3">
        <span v-if="countdown" class="font-bold tabular-nums">
          Locks in
          <time :datetime="predictions.locksAt ?? undefined">{{ countdown }}</time>
        </span>
        <span
          class="font-headline font-black uppercase tracking-widest"
          :class="state === 'open' ? 'text-primary' : 'text-on-surface/50'"
        >
          {{ BOUT_STATE_LABELS[state] }}
        </span>
      </span>
    </header>

    <h3 class="sr-only">{{ boutHeadline(bout) }}</h3>

    <div class="relative grid grid-cols-1 md:grid-cols-2">
      <span
        class="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 border border-outline-variant/30 bg-surface-container-low px-2 py-1 font-headline text-xs font-black italic uppercase text-on-surface/50 md:block"
        aria-hidden="true"
      >
        vs
      </span>

      <div
        v-for="side in sides"
        :key="side.corner"
        class="min-w-0"
        :class="
          side.corner === 'blue'
            ? 'border-t border-outline-variant/15 md:border-t-0 md:border-l'
            : ''
        "
      >
        <component
          :is="side.wrapper.is"
          v-bind="side.wrapper.attrs"
          class="flex w-full min-w-0 items-center gap-3 p-4 text-left transition-colors md:p-5"
          :class="[
            // The corner's rule is drawn on the outside edge of its own half.
            side.corner === 'red' ? 'border-l-4' : 'border-r-4 flex-row-reverse',
            CORNER_COLOURS[side.corner].border,
            side.winner && chosen(side.winner)
              ? CORNER_COLOURS[side.corner].tint
              : 'hover:bg-surface-container',
          ]"
        >
          <FightCardCorner
            :corner="side.fighter"
            :side="side.corner"
            :mirrored="side.corner === 'blue'"
          />

          <span
            v-if="side.winner"
            class="shrink-0 font-headline text-xl font-black tabular-nums md:text-2xl"
            :class="chosen(side.winner) ? 'text-coin' : 'text-on-surface/80'"
          >
            <span class="sr-only">{{ QUESTION_LABELS.winner }},</span>
            {{ multiplierLabel(side.winner.multiplier) }}
          </span>
        </component>

        <p
          v-if="side.pressable && side.profile"
          class="px-4 pb-4 md:px-5"
          :class="side.corner === 'blue' ? 'text-right' : ''"
        >
          <NuxtLink
            :to="side.profile"
            class="text-xs font-bold uppercase tracking-widest text-on-surface/50 hover:text-primary transition-colors"
          >
            {{ side.fighter.name }}'s profile
          </NuxtLink>
        </p>
      </div>
    </div>

    <div v-if="asksMethod" class="border-t border-outline-variant/15 bg-surface-container-lowest">
      <p class="px-4 pt-3 text-xs font-bold uppercase tracking-widest text-on-surface/50">
        {{ QUESTION_LABELS.method }} — answered on its own terms, at its own Multiplier
      </p>

      <div class="grid grid-cols-1 md:grid-cols-2">
        <div
          v-for="side in sides"
          :key="side.corner"
          class="flex flex-wrap gap-2 p-4"
          :class="
            side.corner === 'blue' ? 'md:justify-end md:border-l md:border-outline-variant/15' : ''
          "
        >
          <template v-for="outcome in side.methods" :key="outcome.id">
            <button
              v-if="answering"
              type="button"
              :aria-pressed="chosen(outcome)"
              class="flex items-baseline gap-2 border px-3 py-2 text-left text-sm transition-colors"
              :class="
                chosen(outcome)
                  ? 'border-coin bg-coin/10'
                  : 'border-outline-variant/25 hover:border-primary/60'
              "
              @click="answer(outcome)"
            >
              <span>{{ outcomeLabel(outcome, corners) }}</span>
              <span class="font-bold tabular-nums" :class="chosen(outcome) ? 'text-coin' : ''">
                {{ multiplierLabel(outcome.multiplier) }}
              </span>
            </button>

            <span
              v-else
              class="flex items-baseline gap-2 border border-outline-variant/15 px-3 py-2 text-sm"
            >
              <span>{{ outcomeLabel(outcome, corners) }}</span>
              <span class="font-bold tabular-nums">{{ multiplierLabel(outcome.multiplier) }}</span>
            </span>
          </template>
        </div>
      </div>
    </div>

    <p
      v-if="predictions && state && !asksAnything"
      class="border-t border-outline-variant/15 px-4 py-3 text-sm text-on-surface/60"
    >
      {{ PREDICTION_MESSAGES.notOpenYet }}
    </p>

    <p
      v-else-if="lockNote"
      class="border-t border-outline-variant/15 px-4 py-3 text-sm text-on-surface/60"
    >
      {{ lockNote }}
    </p>
  </article>
</template>

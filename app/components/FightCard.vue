<script setup lang="ts">
import { inCardOrder, type FightCard } from "#shared/fightCard";
import type { CardPredictions } from "#shared/predictions";
import type { OutcomeAnswer } from "#shared/pricing";

/**
 * A fight card: an Event, and every Bout on it in the order they are fought.
 *
 * Three props, and only the first is required. `card` is a lineup and nothing
 * more, so this renders wherever one is worth showing — a marketing page, an
 * archive, a card read straight out of Prismic. `predictions` is what TFC
 * Predictions adds to that lineup, and given nothing, nothing about the game
 * appears. `picks` is the Entry being built on it, and given nothing, the
 * answers are numbers to read rather than things to press. See
 * `shared/fightCard.ts`, `shared/predictions.ts` and `shared/entries.ts`,
 * which are three modules for the same three reasons.
 */
const props = defineProps<{
  card: FightCard;
  predictions?: CardPredictions | null;
  /** The one answer the fan has given on each Bout, by the Bout it answers. */
  picks?: Record<string, OutcomeAnswer>;
}>();

const emit = defineEmits<{ pick: [boutId: string, pick: OutcomeAnswer | null] }>();

/**
 * One clock for the card rather than one per Bout: ten Bouts counting down
 * separately would be ten timers disagreeing with each other by a fraction of
 * a second, and a card whose Locks passed in a different order each time.
 */
const now = useNow(props.predictions?.answeredAt);

/**
 * Every Bout in card order, beside what the game holds against it.
 *
 * The Bout's id lives on the game half rather than on the lineup, so a Bout on
 * a card being shown without the game has nothing to answer against — which is
 * exactly right, and is why picking is only ever offered where there is one.
 */
const shown = computed(() =>
  inCardOrder(props.card.bouts).map((bout) => {
    const predictions = props.predictions?.bouts[bout.cardOrder] ?? null;

    return { bout, predictions, boutId: predictions?.boutId ?? null };
  }),
);
</script>

<template>
  <ol class="flex flex-col gap-6">
    <li v-for="{ bout, predictions: held, boutId } in shown" :key="bout.cardOrder">
      <FightCardBout
        :bout="bout"
        :predictions="held"
        :now="now"
        :picking="picks !== undefined && boutId !== null"
        :pick="boutId === null ? null : (picks?.[boutId] ?? null)"
        @update:pick="boutId && emit('pick', boutId, $event)"
      />
    </li>
  </ol>
</template>

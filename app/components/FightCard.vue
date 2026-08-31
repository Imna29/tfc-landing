<script setup lang="ts">
import { inCardOrder, type FightCard } from "#shared/fightCard";
import type { CardPredictions } from "#shared/predictions";

/**
 * A fight card: an Event, and every Bout on it in the order they are fought.
 *
 * Two props, and the second is optional. `card` is a lineup and nothing more,
 * so this renders wherever one is worth showing — a marketing page, an
 * archive, a card read straight out of Prismic. `predictions` is what TFC
 * Predictions adds to that lineup, and given nothing, nothing about the game
 * appears. See `shared/fightCard.ts` and `shared/predictions.ts`, which are
 * apart for the same reason.
 */
const props = defineProps<{
  card: FightCard;
  predictions?: CardPredictions | null;
}>();

/**
 * One clock for the card rather than one per Bout: ten Bouts counting down
 * separately would be ten timers disagreeing with each other by a fraction of
 * a second, and a card whose Locks passed in a different order each time.
 */
const now = useNow(props.predictions?.answeredAt);

const bouts = computed(() => inCardOrder(props.card.bouts));
</script>

<template>
  <ol class="flex flex-col gap-6">
    <li v-for="bout in bouts" :key="bout.cardOrder">
      <FightCardBout
        :bout="bout"
        :predictions="predictions?.bouts[bout.cardOrder] ?? null"
        :now="now"
      />
    </li>
  </ol>
</template>

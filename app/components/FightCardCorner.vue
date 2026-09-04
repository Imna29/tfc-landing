<script setup lang="ts">
import type { Corner } from "#shared/events";
import type { FightCardCorner } from "#shared/fightCard";
import { CORNER_COLOURS } from "~/utils/corners";

/**
 * One side of a Bout: who is fighting, and what they have done.
 *
 * Presentation and nothing else — no link, no button, no Multiplier. What
 * pressing a fighter does depends on whether the card is being played on, and
 * only `FightCardBout` knows that: on a lineup the fighter is a way through to
 * their profile, and on a card an Entry is being built on the whole side is the
 * winner answer. Wrapping is therefore the Bout's job, and this renders the
 * same inside either wrapper.
 *
 * A corner with only a name renders as a name. That is a late replacement
 * booked days before a card, who has no `fighter` document yet (ADR-0001) —
 * there is no photo to show and no record to state, and inventing either would
 * be worse than the gap.
 */
const props = defineProps<{
  corner: FightCardCorner;
  side: Corner;
  /** Whether the fighter faces in from the outside edge, as the blue side does. */
  mirrored?: boolean;
}>();

/** What the flash of colour means, for anybody who cannot see it. */
const sideLabel = computed(() => (props.side === "red" ? "Red corner" : "Blue corner"));
</script>

<template>
  <span class="flex w-full min-w-0 items-center gap-4" :class="{ 'flex-row-reverse': mirrored }">
    <span
      class="block w-16 h-16 md:w-20 md:h-20 shrink-0 overflow-hidden bg-surface-container-highest border-b-4"
      :class="CORNER_COLOURS[side].border"
    >
      <img
        v-if="corner.imageUrl"
        :src="corner.imageUrl"
        :alt="corner.name"
        loading="lazy"
        decoding="async"
        class="w-full h-full object-cover"
      />
      <span v-else class="flex w-full h-full items-center justify-center" aria-hidden="true">
        <Icon name="material-symbols:person" class="text-2xl text-on-surface/30" />
      </span>
    </span>

    <span class="min-w-0 flex-1" :class="mirrored ? 'text-right' : 'text-left'">
      <span class="sr-only">{{ sideLabel }}</span>
      <span
        class="block font-headline text-lg md:text-2xl font-black italic uppercase leading-tight break-words"
      >
        {{ corner.name }}
      </span>
      <span
        v-if="corner.record"
        class="mt-1 block text-xs font-bold uppercase tracking-widest text-on-surface/60"
      >
        {{ corner.record }}
      </span>
      <span v-else class="mt-1 block text-xs uppercase tracking-widest text-on-surface/40">
        Record not published
      </span>
    </span>
  </span>
</template>

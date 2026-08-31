<script setup lang="ts">
import type { Corner } from "#shared/events";
import { fighterProfile, type FightCardCorner } from "#shared/fightCard";

/**
 * One side of a Bout: who is fighting, what they have done, and the way
 * through to the rest of it.
 *
 * A corner with only a name renders as a name. That is a late replacement
 * booked days before a card, who has no `fighter` document yet (ADR-0001) —
 * there is no photo to show, no record to state and no profile page to link
 * to, and inventing any of the three would be worse than the gap.
 */
const props = defineProps<{ corner: FightCardCorner; side: Corner }>();

const profile = computed(() => fighterProfile(props.corner));

/** What the flash of colour means, for anybody who cannot see it. */
const sideLabel = computed(() => (props.side === "red" ? "Red corner" : "Blue corner"));
</script>

<template>
  <div class="flex flex-col items-center text-center gap-3">
    <div
      class="w-24 h-24 md:w-32 md:h-32 overflow-hidden bg-surface-container-highest border-b-4"
      :class="side === 'red' ? 'border-primary-container' : 'border-tertiary'"
    >
      <img
        v-if="corner.imageUrl"
        :src="corner.imageUrl"
        :alt="corner.name"
        loading="lazy"
        decoding="async"
        class="w-full h-full object-cover"
      />
      <div v-else class="w-full h-full flex items-center justify-center" :aria-hidden="true">
        <Icon name="material-symbols:person" class="text-3xl text-on-surface/30" />
      </div>
    </div>

    <p class="sr-only">{{ sideLabel }}</p>

    <p class="font-headline text-lg md:text-xl font-black italic uppercase leading-tight">
      <NuxtLink v-if="profile" :to="profile" class="hover:text-primary transition-colors">
        {{ corner.name }}
      </NuxtLink>
      <span v-else>{{ corner.name }}</span>
    </p>

    <p v-if="corner.record" class="text-xs font-bold uppercase tracking-widest text-on-surface/60">
      {{ corner.record }}
    </p>
    <p v-else class="text-xs uppercase tracking-widest text-on-surface/40">Record not published</p>
  </div>
</template>

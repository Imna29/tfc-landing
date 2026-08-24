<script setup lang="ts">
import type { TimestampField } from "@prismicio/client";
import { formatSeasonDeadline } from "~/utils/seasonDeadline";

const props = defineProps<{
  seasonName?: string | null;
  endsAt?: TimestampField | null;
  note?: string | null;
}>();

/**
 * What the deadline means, until someone writes a better line for it. The
 * numbers are the Season rules from `CONTEXT.md`, not a promotion.
 */
const DEFAULT_NOTE =
  "Every Entry has to be in before then. Coins do not carry over — each Season starts everyone " +
  "on the same 100.";

/**
 * Nothing at all rather than a half-answer: a fan who is told a Season exists
 * but not when it ends is worse off than one who was told neither.
 */
const deadline = computed(() => formatSeasonDeadline(props.endsAt));
</script>

<template>
  <section v-if="deadline" class="px-6 md:px-20 py-16 bg-surface-container-low">
    <div class="max-w-[1440px] mx-auto flex flex-col gap-4">
      <p class="text-xs font-bold uppercase tracking-widest text-primary">
        {{ seasonName || "This Season" }} closes
      </p>
      <p class="font-headline text-3xl md:text-5xl font-black italic uppercase tracking-tighter">
        <time :datetime="deadline.iso">{{ deadline.display }}</time>
      </p>
      <p class="text-on-surface/70 max-w-2xl leading-relaxed">
        {{ note || DEFAULT_NOTE }}
      </p>
    </div>
  </section>
</template>

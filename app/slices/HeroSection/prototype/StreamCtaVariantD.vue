<script setup lang="ts">
// PROTOTYPE — Variant D "Stream panel".
// Stops treating the stream as the second of two buttons. Buy Tickets stands
// alone; the stream becomes its own panel underneath — a big play target, where
// it is watched, and the code with a copy button — so the promo is part of the
// pitch rather than a footnote.
import { PROMO_CODE, streamHost, useCopyPromo, type HeroCta } from "./promo";

const props = defineProps<{ primary?: HeroCta; stream?: HeroCta; isMounted: boolean }>();
const host = computed(() => streamHost(props.stream));
const { copied, copy } = useCopyPromo();
</script>

<template>
  <div class="flex flex-col gap-5 max-w-2xl">
    <PrismicLink
      v-if="primary"
      :field="primary.link"
      class="sm:self-start bg-primary-container text-white px-10 py-5 font-black uppercase text-lg flex items-center justify-center gap-3 group mma-fade-up"
      :class="{ 'mma-active': isMounted }"
      :style="{ transitionDelay: '0.55s' }"
    >
      {{ primary.label }}
      <Icon
        v-if="primary.icon"
        :name="primary.icon"
        class="group-hover:translate-x-1 transition-transform"
      />
    </PrismicLink>

    <div
      v-if="stream"
      class="relative flex flex-col sm:flex-row sm:items-center gap-4 bg-surface-container-lowest/80 backdrop-blur-md border-l-4 border-primary-container p-4 pr-5 group/panel hover:bg-surface-container-low/90 transition-colors mma-fade-up"
      :class="{ 'mma-active': isMounted }"
      :style="{ transitionDelay: '0.63s' }"
    >
      <!-- the whole panel is the link; the copy button sits above it -->
      <PrismicLink
        :field="stream.link"
        class="absolute inset-0 z-0"
        :aria-label="stream.label ?? ''"
      />

      <div class="pointer-events-none relative z-10 flex items-center gap-4 flex-1 min-w-0">
        <span
          class="grid place-items-center size-16 shrink-0 rounded-full bg-primary-container text-white mma-play-pulse group-hover/panel:scale-110 transition-transform"
        >
          <Icon name="material-symbols:play-arrow-rounded" class="text-4xl" />
        </span>
        <span class="min-w-0">
          <span
            class="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary"
          >
            <span class="size-2 rounded-full bg-primary-container animate-pulse" />
            Can't make it to the hall?
          </span>
          <span
            class="block font-headline italic font-black uppercase text-2xl text-white leading-tight"
          >
            {{ stream.label }}<template v-if="host"> on {{ host }}</template>
          </span>
          <span class="block text-sm text-on-surface-variant">
            Use promo code <strong class="text-white tracking-widest">{{ PROMO_CODE }}</strong> at
            checkout for a discount.
          </span>
        </span>
      </div>

      <button
        type="button"
        class="relative z-10 shrink-0 border-2 border-dashed border-coin text-coin px-4 py-2 font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-coin hover:text-background transition-colors"
        @click="copy"
      >
        <Icon :name="copied ? 'material-symbols:check' : 'material-symbols:content-copy'" />
        {{ copied ? "Copied" : PROMO_CODE }}
      </button>
    </div>
  </div>
</template>

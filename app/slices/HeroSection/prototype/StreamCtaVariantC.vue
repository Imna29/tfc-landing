<script setup lang="ts">
// PROTOTYPE — Variant C "Sticker".
// Same two-button row, but the stream button gets a sweeping sheen and a promo
// sticker hanging off its corner — the overhang trick PlayTfcButton uses to
// break a row of rectangles. The sticker borrows the hero badge's red skewed
// tag so it reads as the site's own, not a coupon pasted on.
import { PROMO_CODE, type HeroCta } from "./promo";

defineProps<{ primary?: HeroCta; stream?: HeroCta; isMounted: boolean }>();
</script>

<template>
  <div class="flex flex-col sm:flex-row gap-4">
    <PrismicLink
      v-if="primary"
      :field="primary.link"
      class="bg-primary-container text-white px-10 py-5 font-black uppercase text-lg flex items-center justify-center gap-3 group mma-fade-up"
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

    <PrismicLink
      v-if="stream"
      :field="stream.link"
      class="sheen relative isolate bg-background/40 border-2 border-white text-white px-10 py-5 font-black uppercase text-lg flex items-center justify-center gap-3 group backdrop-blur-sm hover:bg-white hover:text-background transition-colors mma-fade-up"
      :class="{ 'mma-active': isMounted }"
      :style="{ transitionDelay: '0.63s' }"
    >
      {{ stream.label }}
      <Icon
        v-if="stream.icon"
        :name="stream.icon"
        class="text-2xl group-hover:text-primary-container mma-play-pulse"
      />
      <span
        class="absolute -top-4 -right-2 sm:-top-5 sm:-right-5 skew-x-[-12deg] rotate-[-4deg] bg-primary-container text-white px-3 py-1 text-sm font-black uppercase tracking-tight whitespace-nowrap shadow-[3px_3px_0_0_#000] group-hover:scale-110 transition-transform"
      >
        <span class="block skew-x-[12deg]">
          Promo code: <span class="tracking-wider">{{ PROMO_CODE }}</span>
        </span>
      </span>
    </PrismicLink>
  </div>
</template>

<style scoped>
/* A diagonal highlight that crosses the button every few seconds. */
.sheen {
  overflow: visible;
}
.sheen::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  background: linear-gradient(
    110deg,
    transparent 35%,
    rgba(255, 255, 255, 0.28) 50%,
    transparent 65%
  );
  background-size: 250% 100%;
  animation: sheen 3.2s ease-in-out infinite;
}
@keyframes sheen {
  0% {
    background-position: 130% 0;
  }
  60%,
  100% {
    background-position: -130% 0;
  }
}
</style>

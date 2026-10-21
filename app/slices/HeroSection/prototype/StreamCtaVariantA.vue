<script setup lang="ts">
// PROTOTYPE — Variant A "Inverted + coupon strip".
// Stream button flips to solid white with a live dot so it stops reading as a
// ghost button; the promo sits in its own dashed coupon strip under the row.
import { PROMO_CODE, useCopyPromo, type HeroCta } from "./promo";

defineProps<{ primary?: HeroCta; stream?: HeroCta; isMounted: boolean }>();
const { copied, copy } = useCopyPromo();
</script>

<template>
  <div>
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
        class="relative bg-white text-background px-10 py-5 font-black uppercase text-lg flex items-center justify-center gap-3 group shadow-[0_0_0_0_rgba(255,255,255,0.0)] hover:shadow-[0_0_32px_4px_rgba(255,255,255,0.35)] hover:-translate-y-0.5 transition-all mma-fade-up"
        :class="{ 'mma-active': isMounted }"
        :style="{ transitionDelay: '0.63s' }"
      >
        <span class="relative flex size-3">
          <span
            class="absolute inline-flex h-full w-full rounded-full bg-primary-container opacity-75 animate-ping"
          />
          <span class="relative inline-flex size-3 rounded-full bg-primary-container" />
        </span>
        {{ stream.label }}
        <Icon
          v-if="stream.icon"
          :name="stream.icon"
          class="text-primary-container text-2xl group-hover:scale-125 transition-transform"
        />
      </PrismicLink>
    </div>

    <div
      v-if="stream"
      class="mt-5 inline-flex flex-wrap items-center gap-x-4 gap-y-2 border-2 border-dashed border-white/30 bg-background/60 backdrop-blur-sm px-5 py-3 mma-fade-up"
      :class="{ 'mma-active': isMounted }"
      :style="{ transitionDelay: '0.71s' }"
    >
      <Icon name="material-symbols:sell" class="text-coin text-xl shrink-0" />
      <span class="text-on-surface-variant">
        Watching online? Use promo code
        <strong class="font-black text-white tracking-widest">{{ PROMO_CODE }}</strong>
        at checkout for a discount.
      </span>
      <button
        type="button"
        class="ml-auto text-sm font-bold uppercase tracking-wider text-coin hover:text-white flex items-center gap-1 transition-colors"
        @click="copy"
      >
        <Icon :name="copied ? 'material-symbols:check' : 'material-symbols:content-copy'" />
        {{ copied ? "Copied" : "Copy code" }}
      </button>
    </div>
  </div>
</template>

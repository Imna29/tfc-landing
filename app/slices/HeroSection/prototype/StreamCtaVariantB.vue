<script setup lang="ts">
// PROTOTYPE — Variant B "Ticket stub".
// The stream button and the promo are one object: a pay-per-view ticket with a
// perforated tear-off stub carrying the code. The stub is its own button
// (copies the code) sitting beside the link, not inside it.
import { PROMO_CODE, useCopyPromo, type HeroCta } from "./promo";

defineProps<{ primary?: HeroCta; stream?: HeroCta; isMounted: boolean }>();
const { copied, copy } = useCopyPromo();
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

    <div
      v-if="stream"
      class="flex items-stretch mma-fade-up drop-shadow-[0_8px_24px_rgba(217,31,38,0.35)]"
      :class="{ 'mma-active': isMounted }"
      :style="{ transitionDelay: '0.63s' }"
    >
      <PrismicLink
        :field="stream.link"
        class="flex-1 whitespace-nowrap bg-surface-container-highest border-2 border-r-0 border-primary-container text-white px-5 sm:px-8 py-5 font-black uppercase text-lg flex items-center justify-center gap-3 group hover:bg-primary-container transition-colors"
      >
        <Icon
          v-if="stream.icon"
          :name="stream.icon"
          class="text-2xl text-primary-container group-hover:text-white transition-colors"
        />
        {{ stream.label }}
      </PrismicLink>

      <button
        type="button"
        class="relative bg-coin text-background px-5 flex flex-col items-center justify-center leading-none border-l-[3px] border-dashed border-background hover:brightness-110 transition"
        :aria-label="`Copy promo code ${PROMO_CODE}`"
        @click="copy"
      >
        <!-- the notches a torn ticket has top and bottom -->
        <span
          class="absolute -left-[9px] -top-[9px] size-4 rounded-full bg-background"
          aria-hidden="true"
        />
        <span
          class="absolute -left-[9px] -bottom-[9px] size-4 rounded-full bg-background"
          aria-hidden="true"
        />
        <span class="text-[10px] font-bold uppercase tracking-widest">
          {{ copied ? "Copied!" : "Promo code" }}
        </span>
        <span class="font-headline italic font-black text-2xl tracking-wider">{{
          PROMO_CODE
        }}</span>
        <span class="text-[10px] font-bold uppercase tracking-wider opacity-70">
          {{ copied ? "Paste at checkout" : "Tap to copy" }}
        </span>
      </button>
    </div>
  </div>
</template>

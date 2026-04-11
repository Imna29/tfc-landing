<script setup lang="ts">
import { isFilled } from "@prismicio/client";
import type { Content } from "@prismicio/client";

defineProps(
  getSliceComponentProps<Content.AboutUsCtaSlice>(["slice", "index", "slices", "context"]),
);
</script>

<template>
  <section
    class="py-40 px-8 text-center bg-surface-container-lowest relative overflow-hidden"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <div class="absolute inset-0 opacity-10 pointer-events-none">
      <div class="grid grid-cols-6 gap-2 rotate-12 scale-150">
        <div class="h-20 bg-primary-container" />
        <div class="h-20" />
        <div class="h-20 bg-primary-container" />
        <div class="h-20" />
        <div class="h-20 bg-primary-container" />
        <div class="h-20" />
      </div>
    </div>

    <div class="relative z-10 max-w-4xl mx-auto">
      <h2
        class="font-headline text-6xl md:text-8xl font-black italic uppercase tracking-tighter mb-10 leading-none"
      >
        {{ slice.primary.title }}<br>
        <span class="text-primary-container">{{ slice.primary.title_highlight }}</span>
      </h2>
      <p class="text-xl text-secondary mb-12 uppercase tracking-widest">
        {{ slice.primary.subtitle }}
      </p>
      <div class="flex flex-col md:flex-row items-center justify-center gap-6">
        <PrismicLink
          v-for="(cta, index) in slice.primary.cta"
          v-show="isFilled.link(cta)"
          :key="index"
          :field="cta"
          :class="[
            'w-full md:w-auto px-12 py-5 font-headline font-black italic uppercase tracking-tighter text-xl transition-all text-center',
            cta.variant === 'Primary'
              ? 'bg-primary-container text-white hover:scale-105'
              : 'border-2 border-outline text-white hover:bg-white hover:text-black'
          ]"
        >
          {{ cta.text || 'Learn more' }}
        </PrismicLink>
      </div>
    </div>
  </section>
</template>

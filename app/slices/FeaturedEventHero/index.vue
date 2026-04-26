<script setup lang="ts">
import { isFilled } from "@prismicio/client";
import { asDate } from "@prismicio/client";
import type { Content } from "@prismicio/client";
import { ref, onMounted } from "vue";

const props = defineProps(
  getSliceComponentProps<Content.FeaturedEventHeroSlice>(["slice", "index", "slices", "context"]),
);

const isMounted = ref(false);
onMounted(() => {
  requestAnimationFrame(() => {
    isMounted.value = true;
  });
});
</script>

<template>
  <section
    class="relative h-[870px] w-full overflow-hidden bg-surface-container-lowest"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <div class="absolute inset-0 z-0">
      <img
        v-if="isFilled.image(slice.primary.image)"
        :alt="slice.primary.title || 'Event'"
        loading="lazy"
        decoding="async"
        fetchpriority="low"
        class="w-full h-full object-cover opacity-60 grayscale hover:grayscale-0 transition-all duration-700 mma-ken-burns"
        :src="slice.primary.image.url"
      >
      <div
        class="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent"
      />
      <div
        class="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent"
      />
    </div>

    <div class="relative z-10 h-full flex flex-col justify-end px-12 pb-24 max-w-7xl mx-auto">
      <div
        class="mb-4 flex items-center gap-4 mma-fade-left"
        :class="{ 'mma-active': isMounted }"
        :style="{ transitionDelay: '0.1s' }"
      >
        <span class="bg-primary-container text-white px-3 py-1 font-headline font-black italic text-sm tracking-widest">
          {{ slice.primary.badge }}
        </span>
        <div class="h-[2px] w-24 bg-primary" />
      </div>
      <h1 class="font-headline text-7xl md:text-9xl font-black italic uppercase tracking-tighter leading-[0.85] mb-6">
        <span class="block mma-fade-up" :class="{ 'mma-active': isMounted }" :style="{ transitionDelay: '0.2s' }">{{ slice.primary.title }}:</span>
        <span class="block mma-fade-up text-primary" :class="{ 'mma-active': isMounted }" :style="{ transitionDelay: '0.3s' }">{{ slice.primary.subtitle }}</span>
      </h1>
      <div
        class="flex flex-wrap items-center gap-12 mt-4 mma-fade-up"
        :class="{ 'mma-active': isMounted }"
        :style="{ transitionDelay: '0.4s' }"
      >
        <div v-if="slice.primary.date || slice.primary.tba">
          <p class="text-secondary uppercase text-xs tracking-[0.2em] mb-1">DATE & TIME</p>
          <p v-if="slice.primary.tba" class="font-headline font-bold text-2xl uppercase">TBA</p>
          <p v-else class="font-headline font-bold text-2xl uppercase">{{ asDate(slice.primary.date)?.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase() }} / {{ asDate(slice.primary.date)?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) }}</p>
        </div>
        <div v-if="slice.primary.location">
          <p class="text-secondary uppercase text-xs tracking-[0.2em] mb-1">LOCATION</p>
          <p class="font-headline font-bold text-2xl uppercase">{{ slice.primary.location }}</p>
        </div>
        <div class="flex gap-4">
          <PrismicLink
            v-for="(button, index) in slice.primary.cta"
            :key="index"
            :field="button.link"
            :class="[
              'px-10 py-4 font-headline font-black italic text-xl uppercase tracking-tighter transition-all mma-scale-in',
              { 'mma-active': isMounted },
              button.link.variant === 'Primary'
                ? 'bg-primary-container text-white hover:scale-105'
                : 'border border-white/20 hover:bg-white/10'
            ]"
            :style="{ transitionDelay: `${0.5 + index * 0.08}s` }"
          >
            {{ button.label }}
          </PrismicLink>
        </div>
      </div>
    </div>
  </section>
</template>

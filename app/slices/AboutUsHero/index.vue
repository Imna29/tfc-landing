<script setup lang="ts">
import { isFilled } from "@prismicio/client";
import type { Content } from "@prismicio/client";

defineProps(
  getSliceComponentProps<Content.AboutUsHeroSlice>(["slice", "index", "slices", "context"]),
);
</script>

<template>
  <section
    class="relative h-[819px] flex items-end overflow-hidden"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <div class="absolute inset-0 z-0">
      <img
        v-if="isFilled.image(slice.primary.image)"
        :alt="slice.primary.image.alt || 'Tbilisi Arena'"
        loading="eager"
        decoding="async"
        fetchpriority="high"
        class="w-full h-full object-cover hero-image"
        :src="slice.primary.image.url"
      >
      <div class="absolute inset-0 hero-gradient" />
    </div>

    <div class="relative z-10 px-8 pb-16 max-w-7xl mx-auto w-full">
      <h1
        class="font-headline text-7xl md:text-9xl font-black italic uppercase leading-none tracking-tighter text-white"
      >
        {{ slice.primary.title }}<br>
        OF <span class="text-primary-container">{{ slice.primary.title_highlight }}</span>
      </h1>
      <div class="mt-8 flex items-center space-x-4">
        <div class="h-1 w-24 bg-primary-container" />
        <p class="font-headline text-xl uppercase tracking-widest italic text-secondary">
          {{ slice.primary.subtitle }}
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero-gradient {
  background: linear-gradient(to bottom, rgba(19, 19, 19, 0) 0%, rgba(19, 19, 19, 1) 100%);
}

.hero-image {
  filter: grayscale(100%);
}
</style>

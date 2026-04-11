<script setup lang="ts">
import { isFilled } from "@prismicio/client";
import type { Content } from "@prismicio/client";

defineProps(
  getSliceComponentProps<Content.CultureCommunitySlice>(["slice", "index", "slices", "context"]),
);
</script>

<template>
  <section
    class="py-32 px-8 overflow-hidden"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
      <div class="w-full md:w-1/2 order-2 md:order-1">
        <div class="grid grid-cols-2 gap-4">
          <img
            v-if="isFilled.image(slice.primary.image_1)"
            :alt="slice.primary.image_1.alt || 'Community image 1'"
            loading="lazy"
            decoding="async"
            fetchpriority="low"
            class="w-full h-64 object-cover grayscale"
            :src="slice.primary.image_1.url"
          >
          <img
            v-if="isFilled.image(slice.primary.image_2)"
            :alt="slice.primary.image_2.alt || 'Community image 2'"
            loading="lazy"
            decoding="async"
            fetchpriority="low"
            class="w-full h-80 object-cover grayscale translate-y-8"
            :src="slice.primary.image_2.url"
          >
        </div>
      </div>

      <div class="w-full md:w-1/2 order-1 md:order-2 space-y-8">
        <h2 class="font-headline text-5xl font-black italic uppercase tracking-tighter">
          {{ slice.primary.title }}
        </h2>
        <div class="w-20 h-2 bg-primary-container" />
        <p class="text-lg text-on-surface/80 leading-relaxed italic">
          {{ slice.primary.text }}
        </p>
        <button
          class="flex items-center space-x-4 text-primary font-headline font-black italic uppercase group"
          type="button"
        >
          <span>Read our Community Impact Report</span>
          <Icon
            name="material-symbols:arrow-right-alt"
            class="group-hover:translate-x-2 transition-transform"
          />
        </button>
      </div>
    </div>
  </section>
</template>

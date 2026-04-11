<script setup lang="ts">
import { isFilled } from "@prismicio/client";
import type { Content } from "@prismicio/client";

const props = defineProps(
  getSliceComponentProps<Content.ImageGallerySlice>(["slice", "index", "slices", "context"]),
);

const titleText = computed(() => props.slice.primary.title || "THE");
const titleHighlightText = computed(() => props.slice.primary.title_highlight || "LENS");
const ctaLabel = computed(() => props.slice.primary.view_all_button_label || "VIEW FULL PHOTO ARCHIVE");

const galleryImages = computed(() =>
  props.slice.primary.images
    .map((item, index) => ({
      id: `${props.slice.id}-${index}`,
      image: item.image,
    }))
    .filter((item) => isFilled.image(item.image)),
);
</script>

<template>
  <section
    class="py-24 px-8 bg-surface relative overflow-hidden"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <div
      class="absolute -top-20 -right-20 text-[20rem] font-black italic text-white/[0.02] font-headline select-none pointer-events-none"
    >
      TFC
    </div>

    <div class="max-w-7xl mx-auto flex flex-col items-center mb-16 text-center">
      <h2
        class="font-headline font-black italic text-6xl uppercase tracking-tighter text-white mb-4"
      >
        {{ titleText }} <span class="text-primary">{{ titleHighlightText }}</span>
      </h2>
      <div class="w-20 h-1 bg-primary mb-8" />
    </div>

    <div v-if="galleryImages.length > 0" class="max-w-[1400px] mx-auto grid grid-cols-2 md:grid-cols-3 gap-1">
      <div
        v-for="photo in galleryImages"
        :key="photo.id"
        class="aspect-[4/5] overflow-hidden grayscale hover:grayscale-0 transition-all duration-500"
      >
        <img
          :alt="photo.image.alt || 'Gallery image'"
          loading="lazy"
          decoding="async"
          fetchpriority="low"
          class="w-full h-full object-cover"
          :src="photo.image.url"
        >
      </div>
    </div>

    <div v-else class="max-w-7xl mx-auto py-16 text-center text-on-surface-variant">
      No gallery images configured.
    </div>

    <div class="mt-12 text-center">
      <button
        class="font-headline font-black italic uppercase tracking-widest text-primary border-2 border-primary px-12 py-4 hover:bg-primary hover:text-white transition-all scale-95 hover:scale-100"
        type="button"
      >
        {{ ctaLabel }}
      </button>
    </div>
  </section>
</template>

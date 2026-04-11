<script setup lang="ts">
import { isFilled } from "@prismicio/client";
import type { Content } from "@prismicio/client";
import { computed } from "vue";

const props = defineProps(
  getSliceComponentProps<Content.OurStorySlice>(["slice", "index", "slices", "context"]),
);

const bodyParagraphs = computed(() => {
  return (props.slice.primary.body ?? []).flatMap((block) => {
    if (block.type !== "paragraph") {
      return [block];
    }

    const splitParagraphs = block.text
      .split(/\n+/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    if (splitParagraphs.length <= 1 || (block.spans ?? []).length > 0) {
      return [block];
    }

    return splitParagraphs.map((paragraph) => ({
      ...block,
      text: paragraph,
      spans: [],
    }));
  });
});
</script>

<template>
  <section
    class="py-32 px-8 bg-surface-dim"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <div class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
      <div class="space-y-8">
        <h2 class="font-headline text-5xl font-black italic uppercase tracking-tighter">
          {{ slice.primary.title }}
        </h2>
        <div class="story-rich-text text-on-surface/80 leading-relaxed text-lg">
          <div
            v-for="(paragraph, index) in bodyParagraphs"
            :key="`paragraph-${index}`"
            :class="{ 'mt-6': index > 0 }"
          >
            <PrismicRichText :field="[paragraph]" />
          </div>
        </div>
        <div class="flex items-center space-x-12 pt-8">
          <div v-for="(stat, index) in slice.primary.stats" :key="index">
            <span class="block text-4xl font-headline font-black italic text-primary-container">
              {{ stat.value }}
            </span>
            <span class="text-xs uppercase tracking-widest text-secondary">{{ stat.label }}</span>
          </div>
        </div>
      </div>

      <div class="relative">
        <div class="absolute -top-4 -left-4 w-full h-full border-2 border-primary-container/20" />
        <img
          v-if="isFilled.image(slice.primary.image)"
          :alt="slice.primary.image.alt || 'Our Story'"
          loading="lazy"
          decoding="async"
          fetchpriority="low"
          class="relative z-10 w-full grayscale contrast-125"
          :src="slice.primary.image.url"
        >
      </div>
    </div>
  </section>
</template>

<style scoped>
.story-rich-text :deep(p) {
  white-space: pre-line;
}
</style>

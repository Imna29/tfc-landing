<script setup lang="ts">
import { isFilled } from "@prismicio/client";
import type { Content } from "@prismicio/client";
import { computed, ref, onMounted, onUnmounted, nextTick } from "vue";

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

const sectionRef = ref<HTMLElement | null>(null);
const isHeaderInView = ref(false);
const paragraphStates = ref<Record<number, boolean>>({});
const statStates = ref<Record<number, boolean>>({});
const isImageInView = ref(false);

let headerObserver: IntersectionObserver | null = null;
let paragraphObserver: IntersectionObserver | null = null;
let statObserver: IntersectionObserver | null = null;
let imageObserver: IntersectionObserver | null = null;

onMounted(async () => {
  await nextTick();
  if (!sectionRef.value) return;

  const header = sectionRef.value.querySelector("[data-story-header]");
  if (header) {
    headerObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            isHeaderInView.value = true;
            headerObserver?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    headerObserver.observe(header);
  }

  const paragraphs = sectionRef.value.querySelectorAll<HTMLElement>("[data-story-paragraph]");
  paragraphs.forEach((p, index) => {
    const rect = p.getBoundingClientRect();
    const isAboveFold = rect.top < window.innerHeight && rect.bottom > 0;
    if (isAboveFold) {
      setTimeout(() => {
        paragraphStates.value[index] = true;
      }, index * 80);
    }
  });

  paragraphObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          const idx = Number(el.dataset.storyParagraph);
          const index = Array.from(paragraphs).indexOf(el);
          if (!Number.isNaN(idx)) {
            setTimeout(() => {
              paragraphStates.value[idx] = true;
            }, index * 80);
          }
          paragraphObserver?.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }
  );

  paragraphs.forEach((p) => {
    const idx = Number(p.dataset.storyParagraph);
    if (Number.isNaN(idx) || !paragraphStates.value[idx]) {
      paragraphObserver?.observe(p);
    }
  });

  const stats = sectionRef.value.querySelectorAll<HTMLElement>("[data-story-stat]");
  stats.forEach((stat, index) => {
    const rect = stat.getBoundingClientRect();
    const isAboveFold = rect.top < window.innerHeight && rect.bottom > 0;
    if (isAboveFold) {
      setTimeout(() => {
        statStates.value[index] = true;
      }, index * 100);
    }
  });

  statObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          const idx = Number(el.dataset.storyStat);
          const index = Array.from(stats).indexOf(el);
          if (!Number.isNaN(idx)) {
            setTimeout(() => {
              statStates.value[idx] = true;
            }, index * 100);
          }
          statObserver?.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }
  );

  stats.forEach((stat) => {
    const idx = Number(stat.dataset.storyStat);
    if (Number.isNaN(idx) || !statStates.value[idx]) {
      statObserver?.observe(stat);
    }
  });

  const image = sectionRef.value.querySelector("[data-story-image]");
  if (image) {
    imageObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            isImageInView.value = true;
            imageObserver?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    imageObserver.observe(image);
  }
});

onUnmounted(() => {
  headerObserver?.disconnect();
  paragraphObserver?.disconnect();
  statObserver?.disconnect();
  imageObserver?.disconnect();
});
</script>

<template>
  <section
    ref="sectionRef"
    class="py-32 px-8 bg-surface-dim"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <div class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
      <div class="space-y-8">
        <h2
          data-story-header
          class="font-headline text-5xl font-black italic uppercase tracking-tighter mma-fade-up"
          :class="{ 'mma-active': isHeaderInView }"
        >
          {{ slice.primary.title }}
        </h2>
        <div class="story-rich-text text-on-surface/80 leading-relaxed text-lg">
          <div
            v-for="(paragraph, index) in bodyParagraphs"
            :key="`paragraph-${index}`"
            :data-story-paragraph="index"
            class="mma-fade-up"
            :class="{ 'mt-6': index > 0, 'mma-active': paragraphStates[index] }"
            :style="{ transitionDelay: `${index * 80}ms` }"
          >
            <PrismicRichText :field="[paragraph]" />
          </div>
        </div>
        <div class="flex items-center space-x-12 pt-8">
          <div
            v-for="(stat, index) in slice.primary.stats"
            :key="index"
            :data-story-stat="index"
            class="mma-scale-in"
            :class="{ 'mma-active': statStates[index] }"
            :style="{ transitionDelay: `${index * 100}ms` }"
          >
            <span class="block text-4xl font-headline font-black italic text-primary-container">
              {{ stat.value }}
            </span>
            <span class="text-xs uppercase tracking-widest text-secondary">{{ stat.label }}</span>
          </div>
        </div>
      </div>

      <div data-story-image class="relative mma-fade-right" :class="{ 'mma-active': isImageInView }">
        <div class="absolute -top-4 -left-4 w-full h-full border-2 border-primary-container/20" />
        <img
          v-if="isFilled.image(slice.primary.image)"
          :alt="slice.primary.image.alt || 'Our Story'"
          loading="lazy"
          decoding="async"
          fetchpriority="low"
          class="relative z-10 w-full grayscale-0"
          :src="slice.primary.image.url"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.story-rich-text :deep(p) {
  white-space: pre-line;
}
</style>

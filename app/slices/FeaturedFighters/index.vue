<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from "vue";
import { isFilled } from "@prismicio/client";
import type { Content } from "@prismicio/client";

defineProps(
  getSliceComponentProps<Content.FeaturedFightersSlice>(["slice", "index", "slices", "context"]),
);

const sectionRef = ref<HTMLElement | null>(null);
const inViewMap = ref<Record<number, boolean>>({});
const isMobileViewport = ref(false);

let mobileViewportQuery: MediaQueryList | null = null;
let observer: IntersectionObserver | null = null;

const initializeMobileObserver = () => {
  const shouldObserve = mobileViewportQuery?.matches ?? false;
  isMobileViewport.value = shouldObserve;

  observer?.disconnect();
  observer = null;
  inViewMap.value = {};

  if (!shouldObserve) {
    return;
  }

  const fighterCards = sectionRef.value?.querySelectorAll<HTMLElement>("[data-fighter-index]");
  if (!fighterCards?.length) {
    return;
  }

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const index = Number((entry.target as HTMLElement).dataset.fighterIndex);
        if (Number.isNaN(index)) {
          return;
        }

        inViewMap.value[index] = entry.isIntersecting;
      });
    },
    {
      threshold: 0.45,
    },
  );

  fighterCards.forEach((card) => observer?.observe(card));
};

const handleViewportChange = () => {
  initializeMobileObserver();
};

onMounted(async () => {
  mobileViewportQuery = window.matchMedia("(max-width: 767px)");
  mobileViewportQuery.addEventListener("change", handleViewportChange);

  await nextTick();
  initializeMobileObserver();
});

onUnmounted(() => {
  mobileViewportQuery?.removeEventListener("change", handleViewportChange);
  observer?.disconnect();
});
</script>

<template>
  <section
    ref="sectionRef"
    class="py-24 px-6 md:px-20 container mx-auto"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <div class="flex justify-between items-end mb-16">
      <div>
        <p class="text-primary font-black uppercase tracking-widest mb-2">{{ slice.primary.subtitle }}</p>
        <h2 class="font-headline text-6xl font-black italic uppercase tracking-tighter">{{ slice.primary.title }}</h2>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-10">
      <article
        v-for="(fighter, index) in slice.primary.fighters"
        :key="index"
        class="group relative bg-surface-container-low overflow-hidden"
        :class="{ 'mt-8 md:mt-0': index === 0 || index === 2 }"
        :data-fighter-index="index"
      >
        <div class="aspect-[3/4] overflow-hidden clip-slanted">
          <img
            v-if="isFilled.image(fighter.fighter_image)"
            :alt="fighter.name || 'Fighter'"
            loading="lazy"
            decoding="async"
            fetchpriority="low"
            :class="[
              'w-full h-full object-cover transition-all duration-500',
              isMobileViewport && inViewMap[index]
                ? 'grayscale-0 scale-100'
                : 'grayscale group-hover:grayscale-0 scale-105 group-hover:scale-100',
            ]"
            :src="fighter.fighter_image.url"
          >
        </div>
        <div class="p-8">
          <div class="flex justify-between items-start mb-6">
            <div>
              <h3 class="font-headline text-3xl font-black italic uppercase leading-none">{{ fighter.name }}</h3>
              <p v-if="fighter.nickname" class="text-primary font-bold uppercase text-xs mt-1">'{{ fighter.nickname }}'</p>
            </div>
            <div class="text-right">
              <p class="text-2xl font-black italic">{{ fighter.record }}</p>
              <p class="text-[10px] uppercase font-bold text-on-surface-variant">Record</p>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div class="text-center bg-background py-2">
              <p class="text-xs uppercase font-bold text-on-surface-variant">Nationality</p>
              <p class="font-black text-lg">{{ fighter.nationality }}</p>
            </div>
            <div class="text-center bg-background py-2">
              <p class="text-xs uppercase font-bold text-on-surface-variant">Height</p>
              <p class="font-black text-lg">{{ fighter.height }}</p>
            </div>
            <div class="text-center bg-background py-2">
              <p class="text-xs uppercase font-bold text-on-surface-variant">Age</p>
              <p class="font-black text-lg">{{ fighter.age }}</p>
            </div>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.clip-slanted {
  clip-path: polygon(0 0, 100% 0, 100% 85%, 0% 100%);
}
</style>

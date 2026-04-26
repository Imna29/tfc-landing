<script setup lang="ts">
import { isFilled } from "@prismicio/client";
import type { Content } from "@prismicio/client";
import { ref, onMounted } from "vue";

defineProps(
  getSliceComponentProps<Content.AboutUsHeroSlice>(["slice", "index", "slices", "context"]),
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
    class="relative h-auto md:h-[819px] flex items-start md:items-end overflow-hidden pt-28 md:pt-0"
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
        class="w-full h-full object-cover hero-image mma-ken-burns"
        :src="slice.primary.image.url"
      />
      <div class="absolute inset-0 hero-gradient" />
    </div>

    <div class="relative z-10 px-6 md:px-8 pb-12 md:pb-16 max-w-7xl mx-auto w-full">
      <h1
        class="font-headline text-5xl sm:text-6xl md:text-9xl font-black italic uppercase leading-none tracking-tighter text-white"
      >
        <span class="block mma-fade-up" :class="{ 'mma-active': isMounted }" :style="{ transitionDelay: '0.2s' }">
          {{ slice.primary.title }}
        </span>
        <span class="block mma-fade-up text-primary-container" :class="{ 'mma-active': isMounted }" :style="{ transitionDelay: '0.35s' }">
          {{ slice.primary.title_highlight }}
        </span>
      </h1>
      <div
        class="mt-6 md:mt-8 flex items-center space-x-3 md:space-x-4 mma-fade-left"
        :class="{ 'mma-active': isMounted }"
        :style="{ transitionDelay: '0.5s' }"
      >
        <div class="h-1 w-16 sm:w-20 md:w-24 bg-primary-container" />
        <p
          class="font-headline text-base sm:text-lg md:text-xl uppercase tracking-wide md:tracking-widest italic text-secondary"
        >
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

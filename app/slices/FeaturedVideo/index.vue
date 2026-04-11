<script setup lang="ts">
import { isFilled } from "@prismicio/client";
import type { Content } from "@prismicio/client";

const props = defineProps(
  getSliceComponentProps<Content.FeaturedVideoSlice>(["slice", "index", "slices", "context"]),
);

const selectedVideo = ref<{ title: string; html: string } | null>(null);
const isOpen = ref(false);

const imageUrl = computed(() => {
  if (isFilled.image(props.slice.primary.thumbnail)) {
    return props.slice.primary.thumbnail.url;
  }

  return props.slice.primary.youtube_link?.thumbnail_url ?? "";
});

const headlineOne = computed(() => props.slice.primary.headline_1 || "TOP 10");
const headlineTwo = computed(() => props.slice.primary.headline_2 || "KNOCKOUTS");
const subtitle = computed(
  () => props.slice.primary.subtitle || "Official Highlight Reel - Season 4 Premiere",
);

const openModal = () => {
  const html = props.slice.primary.youtube_link?.html;
  if (!html) {
    return;
  }

  selectedVideo.value = {
    title: `${headlineOne.value} ${headlineTwo.value}`,
    html,
  };
  isOpen.value = true;
};

const closeModal = () => {
  selectedVideo.value = null;
  isOpen.value = false;
};
</script>

<template>
  <section
    class="relative w-full h-[870px] overflow-hidden flex items-center justify-center bg-surface-container-lowest"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <div class="absolute inset-0 z-0">
      <img
        v-if="imageUrl"
        alt="MMA Action"
        loading="lazy"
        decoding="async"
        fetchpriority="low"
        class="w-full h-full object-cover opacity-60 grayscale hover:grayscale-0 transition-all duration-1000"
        :src="imageUrl"
      >
      <div v-else class="w-full h-full bg-surface-container-low" />
      <div
        class="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent"
      />
    </div>

    <div class="relative z-10 text-center px-4 max-w-5xl">
      <div class="mb-6 flex justify-center">
        <button
          class="group relative flex items-center justify-center w-24 h-24 bg-primary-container hover:bg-primary transition-colors duration-500 rounded-full"
          type="button"
          @click="openModal"
        >
          <Icon
            name="material-symbols:play-arrow"
            class="text-white text-5xl translate-x-1"
            style="font-variation-settings: &quot;FILL&quot; 1"
          />
          <div
            class="absolute inset-0 rounded-full border-2 border-primary-container animate-ping opacity-20"
          />
        </button>
      </div>
      <h1
        class="font-headline font-black italic text-6xl md:text-8xl lg:text-9xl uppercase tracking-tighter leading-none text-white drop-shadow-2xl"
      >
        {{ headlineOne }} <br>
        <span class="text-primary">{{ headlineTwo }}</span>
      </h1>
      <p
        class="mt-6 font-headline italic uppercase tracking-[0.2em] text-secondary text-lg font-bold"
      >
        {{ subtitle }}
      </p>
    </div>

    <div
      class="absolute bottom-10 left-0 w-32 h-2 bg-secondary-fixed/20 skew-x-[-12deg] -translate-x-10"
    />
    <div
      class="absolute bottom-20 right-0 w-64 h-1 bg-primary-container/40 skew-x-[12deg] translate-x-20"
    />

    <Teleport to="body">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
        @click="closeModal"
      >
        <div class="relative w-[90vw] max-w-5xl" @click.stop>
          <button
            class="absolute -top-10 right-0 text-white hover:text-primary transition-colors"
            type="button"
            @click="closeModal"
          >
            <Icon name="material-symbols:close" class="text-3xl" />
          </button>
          <div v-if="selectedVideo?.html" class="youtube-video" v-html="selectedVideo.html" />
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style>
.youtube-video {
  width: 100%;
  height: 100%;
  position: relative;
}

.youtube-video > iframe {
  width: 100%;
  height: 100%;
  aspect-ratio: 16 / 9;
}
</style>

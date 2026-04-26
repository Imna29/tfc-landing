<script setup lang="ts">
import { isFilled } from "@prismicio/client";
import type { Content } from "@prismicio/client";

const props = defineProps(
  getSliceComponentProps<Content.FeaturedVideoSlice>(["slice", "index", "slices", "context"]),
);

const selectedVideo = ref<{ title: string; html: string } | null>(null);
const isOpen = ref(false);

const videoUrl = computed(() => {
  if (isFilled.linkToMedia(props.slice.primary.video)) {
    return props.slice.primary.video.url;
  }

  return null;
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
      <video
        v-if="videoUrl"
        autoplay
        loop
        muted
        playsinline
        class="w-full h-full object-cover opacity-60 grayscale hover:grayscale-0 transition-all duration-1000"
      >
        <source :src="videoUrl" type="video/mp4">
      </video>
      <div v-else class="w-full h-full bg-surface-container-low" />
      <div
        class="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent"
      />
    </div>

    <div class="relative z-10 text-center px-4 max-w-5xl">

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

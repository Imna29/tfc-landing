<script setup lang="ts">
import { ref } from "vue";
import { isFilled } from "@prismicio/client";
import type { Content } from "@prismicio/client";

defineProps(
  getSliceComponentProps<Content.VideoHighlightsSlice>(["slice", "index", "slices", "context"]),
);

const selectedVideo = ref<{
  title: string;
  html: string;
} | null>(null);

const isOpen = ref(false);

const openModal = (video: { title: string; html: string }) => {
  selectedVideo.value = video;
  isOpen.value = true;
};

const closeModal = () => {
  selectedVideo.value = null;
  isOpen.value = false;
};
</script>

<template>
  <section
    class="bg-surface-container-lowest py-24 border-y border-outline-variant/10"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <div class="container mx-auto px-6 md:px-20">
      <div class="text-center max-w-2xl mx-auto mb-16">
        <h2 class="font-headline text-5xl font-black italic uppercase mb-4">
          {{ slice.primary.title }}
        </h2>
        <p class="text-on-surface-variant">{{ slice.primary.description }}</p>
      </div>

      <div
        v-if="slice.primary.videos && slice.primary.videos.length > 0"
        class="grid grid-cols-1 md:grid-cols-4 gap-6"
      >
        <div
          v-if="slice.primary.videos[0]"
          class="group border border-outline-variant/5 bg-surface-container-low cursor-pointer md:col-span-3 md:border-outline-variant/20 md:bg-transparent"
          @click="
            openModal({
              title: slice.primary.videos[0].title || '',
              html: slice.primary.videos[0].youtube_url?.html || '',
            })
          "
        >
          <div class="relative aspect-video overflow-hidden">
            <img
              v-if="
                isFilled.image(slice.primary.videos[0].thumbnail) ||
                slice.primary.videos[0].youtube_url?.thumbnail_url
              "
              :alt="slice.primary.videos[0].title || 'Video'"
              loading="lazy"
              decoding="async"
              fetchpriority="low"
              class="w-full h-full object-cover opacity-60 transition-opacity group-hover:opacity-100 md:opacity-100 md:transition-none"
              :src="
                isFilled.image(slice.primary.videos[0].thumbnail)
                  ? slice.primary.videos[0].thumbnail.url!
                  : slice.primary.videos[0].youtube_url?.thumbnail_url!
              "
            />
            <div class="absolute inset-0 flex items-center justify-center md:hidden">
              <Icon name="material-symbols:play-circle" class="text-4xl text-white" />
            </div>
            <div
              class="absolute inset-0 hidden items-center justify-center bg-background/30 transition-colors group-hover:bg-background/10 md:flex"
            >
              <button
                class="w-24 h-24 bg-primary-container text-white flex items-center justify-center skew-x-[-12deg] hover:scale-110 transition-transform"
              >
                <Icon
                  name="material-symbols:play-arrow"
                  class="skew-x-[12deg] text-5xl"
                  style="font-variation-settings: &quot;FILL&quot; 1"
                />
              </button>
            </div>
            <div
              class="absolute bottom-0 left-0 hidden p-8 bg-gradient-to-t from-background to-transparent w-full md:block"
            >
              <h3 class="font-headline text-3xl font-black italic uppercase">
                {{ slice.primary.videos[0].title }}
              </h3>
            </div>
          </div>
          <div class="p-4 md:hidden">
            <p class="font-bold text-sm uppercase text-on-surface-variant">
              {{ slice.primary.videos[0].title }}
            </p>
          </div>
        </div>

        <div class="flex flex-col gap-6">
          <article
            v-for="(video, index) in slice.primary.videos.slice(1)"
            :key="index"
            class="flex-1 bg-surface-container-low group cursor-pointer border border-outline-variant/5"
            @click="openModal({ title: video.title || '', html: video.youtube_url?.html || '' })"
          >
            <div class="relative aspect-video">
              <img
                v-if="isFilled.image(video.thumbnail) || video.youtube_url?.thumbnail_url"
                :alt="video.title || 'Video'"
                loading="lazy"
                decoding="async"
                fetchpriority="low"
                class="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                :src="
                  isFilled.image(video.thumbnail)
                    ? video.thumbnail.url
                    : video.youtube_url?.thumbnail_url!
                "
              />
              <div class="absolute inset-0 flex items-center justify-center">
                <Icon name="material-symbols:play-circle" class="text-4xl text-white" />
              </div>
            </div>
            <div class="p-4">
              <p class="font-bold text-sm uppercase text-on-surface-variant">
                {{ video.title }}
              </p>
            </div>
          </article>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
        @click="closeModal"
      >
        <div class="relative w-[90vw] max-w-5xl" @click.stop>
          <button
            class="absolute -top-10 right-0 text-white hover:text-primary transition-colors"
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

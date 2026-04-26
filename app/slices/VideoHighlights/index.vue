<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from "vue";
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
const isInView = ref(false);
const sectionRef = ref<HTMLElement | null>(null);
const cardStates = ref<Record<string, boolean>>({});
let observer: IntersectionObserver | null = null;
let cardObserver: IntersectionObserver | null = null;

const openModal = (video: { title: string; html: string }) => {
  selectedVideo.value = video;
  isOpen.value = true;
  document.body.style.overflow = "hidden";
};

const closeModal = () => {
  selectedVideo.value = null;
  isOpen.value = false;
  document.body.style.overflow = "";
};

onMounted(async () => {
  await nextTick();
  if (!sectionRef.value) return;

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          isInView.value = true;
          observer?.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );
  observer.observe(sectionRef.value);

  const cards = sectionRef.value.querySelectorAll<HTMLElement>("[data-video-id]");
  cards.forEach((card, index) => {
    const id = card.dataset.videoId;
    if (!id) return;

    const rect = card.getBoundingClientRect();
    const isAboveFold = rect.top < window.innerHeight && rect.bottom > 0;

    if (isAboveFold) {
      setTimeout(() => {
        cardStates.value[id] = true;
      }, index * 120);
    }
  });

  cardObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          const id = el.dataset.videoId;
          const index = Array.from(cards).indexOf(el);

          if (id) {
            setTimeout(() => {
              cardStates.value[id] = true;
            }, index * 120);
          }
          cardObserver?.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  cards.forEach((card) => {
    const id = card.dataset.videoId;
    if (!id || !cardStates.value[id]) {
      cardObserver?.observe(card);
    }
  });
});

onUnmounted(() => {
  observer?.disconnect();
  cardObserver?.disconnect();
  document.body.style.overflow = "";
});
</script>

<template>
  <section
    ref="sectionRef"
    class="bg-surface-container-lowest py-24 border-y border-outline-variant/10"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <div class="container mx-auto px-6 md:px-20">
      <div class="text-center max-w-2xl mx-auto mb-16 mma-fade-up" :class="{ 'mma-active': isInView }">
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
          data-video-id="main"
          class="group border border-outline-variant/5 bg-surface-container-low cursor-pointer md:col-span-3 md:border-outline-variant/20 md:bg-transparent mma-scale-in mma-delay-1"
          :class="{ 'mma-active': cardStates['main'] }"
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
                class="w-24 h-24 bg-primary-container text-white flex items-center justify-center skew-x-[-12deg] hover:scale-110 transition-transform mma-play-pulse"
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
            :data-video-id="`video-${index}`"
            class="flex-1 bg-surface-container-low group cursor-pointer border border-outline-variant/5 mma-fade-right"
            :class="{ 'mma-active': cardStates[`video-${index}`] }"
            :style="{ transitionDelay: `${(index + 1) * 120}ms` }"
            @click="openModal({ title: video.title || '', html: video.youtube_url?.html || '' })"
          >
            <div class="relative aspect-video overflow-hidden">
              <img
                v-if="isFilled.image(video.thumbnail) || video.youtube_url?.thumbnail_url"
                :alt="video.title || 'Video'"
                loading="lazy"
                decoding="async"
                fetchpriority="low"
                class="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity scale-105 group-hover:scale-100 transition-transform duration-700"
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
      <Transition name="mma-modal">
        <div
          v-if="isOpen"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          @click="closeModal"
        >
          <Transition name="mma-modal-content" appear>
            <div v-if="isOpen" class="relative w-[90vw] max-w-5xl" @click.stop>
              <button
                class="absolute -top-10 right-0 text-white hover:text-primary transition-colors"
                @click="closeModal"
              >
                <Icon name="material-symbols:close" class="text-3xl" />
              </button>
              <div v-if="selectedVideo?.html" class="youtube-video" v-html="selectedVideo.html" />
            </div>
          </Transition>
        </div>
      </Transition>
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

<script setup lang="ts">
import * as prismic from "@prismicio/client";
import { isFilled } from "@prismicio/client";
import type { Content } from "@prismicio/client";

const props = defineProps(
  getSliceComponentProps<Content.MediaArchiveSlice>(["slice", "index", "slices", "context"]),
);

const { client } = usePrismic();
const { locale } = useI18n();

const currentPage = ref(1);
const activeFilterId = ref<string>("all");
const selectedVideo = ref<{ title: string; html: string } | null>(null);
const isVideoOpen = ref(false);

const pageSize = 4;

const { data: mediaTypes } = await useAsyncData(
  () => `media-archive-types-${props.index}-${locale.value}`,
  () =>
    client.getAllByType("media_type", {
      lang: locale.value,
      orderings: [{ field: "my.media_type.name", direction: "asc" }],
    }),
  {
    watch: [locale],
  },
);

const filterOptions = computed(() => {
  const dynamicFilters = (mediaTypes.value ?? []).map((type) => ({
    id: type.id,
    label: (type.data.name || type.uid || "Media").toUpperCase(),
  }));

  return [{ id: "all", label: "ALL MEDIA" }, ...dynamicFilters];
});

const selectedMediaTypeId = computed(() =>
  activeFilterId.value === "all" ? null : activeFilterId.value,
);

const referencedMediaDocumentIds = computed(() =>
  Array.from(
    new Set(
      props.slice.primary.content.flatMap((item) =>
        isFilled.contentRelationship(item.media) ? [item.media.id] : [],
      ),
    ),
  ),
);

const { data: mediaDocuments, pending: mediaPending } = await useAsyncData(
  () =>
    `media-archive-items-${props.index}-${locale.value}-${referencedMediaDocumentIds.value.join(",") || "none"}`,
  () => {
    if (referencedMediaDocumentIds.value.length === 0) {
      return Promise.resolve([] as Content.MediaDocument[]);
    }

    return client.getAllByType("media", {
      lang: locale.value,
      filters: [prismic.filter.any("document.id", referencedMediaDocumentIds.value)],
      fetchLinks: ["media_type.name"],
    });
  },
  {
    watch: [locale, referencedMediaDocumentIds],
  },
);

const mediaDocumentsById = computed(
  () =>
    new Map(
      (mediaDocuments.value ?? []).map((mediaDocument) => [mediaDocument.id, mediaDocument]),
    ),
);

const orderedMediaItems = computed(() =>
  props.slice.primary.content
    .map((item) => {
      if (!isFilled.contentRelationship(item.media)) {
        return null;
      }

      const mediaDocument = mediaDocumentsById.value.get(item.media.id);

      if (!mediaDocument) {
        return null;
      }

      return mediaDocument;
    })
    .filter((mediaDocument): mediaDocument is Content.MediaDocument => mediaDocument !== null),
);

const filteredMediaItems = computed(() => {
  if (!selectedMediaTypeId.value) {
    return orderedMediaItems.value;
  }

  return orderedMediaItems.value.filter(
    (item) => item.data.media_type.id === selectedMediaTypeId.value,
  );
});

const totalPages = computed(() => Math.ceil(filteredMediaItems.value.length / pageSize));

const paginatedMediaItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredMediaItems.value.slice(start, start + pageSize);
});

const mediaItems = computed(() => paginatedMediaItems.value);
const featuredMedia = computed(() => mediaItems.value[0]);
const wideMedia = computed(() => mediaItems.value[1]);
const smallMediaItems = computed(() => mediaItems.value.slice(2, 4));

const canGoPrevious = computed(() => currentPage.value > 1);
const canGoNext = computed(() => currentPage.value < totalPages.value);

const titleText = computed(() => props.slice.primary.title || "BATTLE");
const titleHighlightText = computed(() => props.slice.primary.title_highlight || "ARCHIVES");
const descriptionText = computed(
  () =>
    props.slice.primary.description ||
    "Re-live the intensity. From main card finishes to raw backstage interviews.",
);

const setFilter = (filterId: string) => {
  if (activeFilterId.value === filterId) {
    return;
  }

  activeFilterId.value = filterId;
  currentPage.value = 1;
};

const getImageUrl = (item: Content.MediaDocument) => {
  if (isFilled.image(item.data.thumbnail)) {
    return item.data.thumbnail.url;
  }

  return item.data.youtube_link?.thumbnail_url ?? "";
};

const hasImage = (item: Content.MediaDocument) => Boolean(getImageUrl(item));

const getTypeLabel = (item: Content.MediaDocument) =>
  item.data.media_type.data?.name?.toUpperCase() || "MEDIA";

const getPrimaryBadge = (item: Content.MediaDocument) => item.data.badges[0]?.name || null;

const openVideo = (item: Content.MediaDocument) => {
  const html = item.data.youtube_link?.html;
  if (!html) {
    return;
  }

  selectedVideo.value = {
    title: item.data.title || "Media",
    html,
  };
  isVideoOpen.value = true;
};

const closeVideo = () => {
  selectedVideo.value = null;
  isVideoOpen.value = false;
};

const goToPreviousPage = () => {
  if (!canGoPrevious.value) {
    return;
  }

  currentPage.value -= 1;
};

const goToNextPage = () => {
  if (!canGoNext.value) {
    return;
  }

  currentPage.value += 1;
};

watch(locale, () => {
  activeFilterId.value = "all";
  currentPage.value = 1;
});
</script>

<template>
  <section
    class="py-24 px-8 bg-surface-container-low relative overflow-hidden"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <div
      class="max-w-7xl mx-auto mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6"
    >
      <div>
        <h2
          class="font-headline font-black italic text-5xl uppercase tracking-tighter leading-tight text-white mb-2"
        >
          {{ titleText }} <span class="text-primary">{{ titleHighlightText }}</span>
        </h2>
        <p class="text-on-surface-variant max-w-md font-medium">
          {{ descriptionText }}
        </p>
      </div>
      <div class="flex flex-wrap gap-4 font-headline italic uppercase text-sm font-bold tracking-widest">
        <button
          v-for="filterOption in filterOptions"
          :key="filterOption.id"
          class="pb-1 transition-colors"
          :class="
            activeFilterId === filterOption.id
              ? 'text-primary border-b-2 border-primary'
              : 'text-on-surface-variant hover:text-white'
          "
          type="button"
          @click="setFilter(filterOption.id)"
        >
          {{ filterOption.label }}
        </button>
      </div>
    </div>

    <div
      v-if="mediaPending"
      class="max-w-7xl mx-auto h-[620px] bg-surface-container-lowest animate-pulse"
    />

    <div v-else-if="mediaItems.length > 0" class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[300px]">
      <article
        v-if="featuredMedia"
        class="md:col-span-2 md:row-span-2 relative group overflow-hidden bg-surface-container-lowest cursor-pointer"
        @click="openVideo(featuredMedia)"
      >
        <img
          v-if="hasImage(featuredMedia)"
          :alt="featuredMedia.data.title || 'Featured media'"
          loading="lazy"
          decoding="async"
          fetchpriority="low"
          class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          :src="getImageUrl(featuredMedia)"
        >
        <div v-else class="w-full h-full bg-surface-container-low" />
        <div class="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all" />
        <div
          class="absolute bottom-0 left-0 p-8 w-full bg-gradient-to-t from-black to-transparent"
        >
          <span
            v-if="getPrimaryBadge(featuredMedia)"
            class="bg-primary text-white text-[10px] font-black italic px-3 py-1 uppercase tracking-widest mb-4 inline-block"
            >{{ getPrimaryBadge(featuredMedia) }}</span
          >
          <h3 class="font-headline font-black italic text-3xl uppercase text-white mb-2">
            {{ featuredMedia.data.title }}
          </h3>
          <p class="text-on-surface-variant text-sm flex items-center gap-2">
            <Icon name="material-symbols:schedule" class="text-sm" />
            {{ getTypeLabel(featuredMedia) }}
          </p>
        </div>
      </article>

      <article
        v-if="wideMedia"
        class="md:col-span-2 relative group overflow-hidden bg-surface-container-lowest cursor-pointer"
        @click="openVideo(wideMedia)"
      >
        <img
          v-if="hasImage(wideMedia)"
          :alt="wideMedia.data.title || 'Media item'"
          loading="lazy"
          decoding="async"
          fetchpriority="low"
          class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          :src="getImageUrl(wideMedia)"
        >
        <div v-else class="w-full h-full bg-surface-container-low" />
        <div class="absolute inset-0 flex items-center justify-center">
          <Icon
            name="material-symbols:play-circle"
            class="text-white text-5xl opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </div>
        <div class="absolute bottom-6 left-6">
          <h3 class="font-headline font-black italic text-xl uppercase text-white">
            {{ wideMedia.data.title }}
          </h3>
          <p class="text-on-surface-variant text-sm flex items-center gap-2">
            <Icon name="material-symbols:schedule" class="text-sm" />
            {{ getTypeLabel(wideMedia) }}
          </p>
        </div>
      </article>

      <article
        v-for="item in smallMediaItems"
        :key="item.id"
        class="relative group overflow-hidden bg-surface-container-lowest cursor-pointer"
        @click="openVideo(item)"
      >
        <img
          v-if="hasImage(item)"
          :alt="item.data.title || 'Media item'"
          loading="lazy"
          decoding="async"
          fetchpriority="low"
          class="w-full h-full object-cover opacity-80"
          :src="getImageUrl(item)"
        >
        <div v-else class="w-full h-full bg-surface-container-low" />
        <div
          class="absolute inset-0 bg-primary-container/20 group-hover:opacity-0 transition-opacity"
        />
        <div class="absolute bottom-4 left-4">
          <h3 class="font-headline font-black italic text-sm uppercase text-white">
            {{ item.data.title }}
          </h3>
          <p class="text-on-surface-variant text-xs flex items-center gap-1 mt-1">
            <Icon name="material-symbols:schedule" class="text-xs" />
            {{ getTypeLabel(item) }}
          </p>
        </div>
      </article>
    </div>

    <div v-else class="max-w-7xl mx-auto py-16 text-center text-on-surface-variant">
      No media entries found for this filter.
    </div>

    <div v-if="totalPages > 1" class="max-w-7xl mx-auto mt-12 flex items-center justify-center gap-6">
      <button
        class="font-headline font-black italic uppercase tracking-wider text-sm px-5 py-2 border border-outline-variant transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary hover:text-primary"
        :disabled="!canGoPrevious"
        type="button"
        @click="goToPreviousPage"
      >
        Previous
      </button>
      <p class="font-headline italic uppercase tracking-[0.2em] text-secondary text-xs">
        Page {{ currentPage }} / {{ totalPages }}
      </p>
      <button
        class="font-headline font-black italic uppercase tracking-wider text-sm px-5 py-2 border border-outline-variant transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary hover:text-primary"
        :disabled="!canGoNext"
        type="button"
        @click="goToNextPage"
      >
        Next
      </button>
    </div>

    <Teleport to="body">
      <div
        v-if="isVideoOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
        @click="closeVideo"
      >
        <div class="relative w-[90vw] max-w-5xl" @click.stop>
          <button
            class="absolute -top-10 right-0 text-white hover:text-primary transition-colors"
            type="button"
            @click="closeVideo"
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

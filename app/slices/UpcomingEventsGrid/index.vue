<script setup lang="ts">
import { isFilled } from "@prismicio/client";
import { asDate } from "@prismicio/client";
import type { Content } from "@prismicio/client";

defineProps(
  getSliceComponentProps<Content.UpcomingEventsGridSlice>(["slice", "index", "slices", "context"]),
);

const getTags = (tagsString: string | null | undefined) => {
  if (!tagsString) return [];
  return tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
};
</script>

<template>
  <section
    class="py-24 px-8 bg-surface-dim"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <div class="max-w-7xl mx-auto">
      <div class="flex items-end justify-between mb-16 border-b border-outline-variant pb-8">
        <div>
          <h2 class="font-headline text-5xl font-black italic uppercase tracking-tighter">
            {{ slice.primary.title }}
          </h2>
          <p class="text-secondary mt-2 uppercase tracking-widest text-sm">
            {{ slice.primary.subtitle }}
          </p>
        </div>
        <div class="hidden md:block">
          <span class="text-8xl font-black italic opacity-5 font-headline">{{ slice.primary.decorative_text }}</span>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <article
          v-for="(event, index) in slice.primary.events"
          :key="index"
          class="group relative bg-surface-container-low p-8 flex flex-col md:flex-row gap-8 hover:bg-surface-container-high transition-colors"
        >
          <div class="w-full md:w-48 h-64 overflow-hidden relative">
            <img
              v-if="isFilled.image(event.image)"
              :alt="event.title || 'Event'"
              loading="lazy"
              decoding="async"
              fetchpriority="low"
              class="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 scale-110 group-hover:scale-100"
              :src="event.image.url"
            >
            <div
              class="absolute top-0 left-0 bg-primary-container p-2 font-headline font-black italic text-xs"
            >
              {{ event.badge }}
            </div>
          </div>
          <div class="flex-1 flex flex-col justify-between">
            <div>
              <div class="flex justify-between items-start mb-4">
                <span v-if="slice.primary.tba" class="text-primary font-headline font-black italic text-xl">
                  TBA
                </span>
                <span v-else class="text-primary font-headline font-black italic text-xl">
                  {{ asDate(event.date)?.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase() }}
                </span>
                <Icon name="material-symbols:location-on" class="text-secondary text-xl" />
              </div>
              <h3 class="font-headline text-3xl font-black italic uppercase tracking-tighter mb-2">
                {{ event.title }}
              </h3>
              <p class="text-on-surface-variant text-sm uppercase tracking-wider mb-4">
                {{ event.venue }}
              </p>
              <div v-if="event.tags_comma_separated" class="flex gap-2">
                <span
                  v-for="tag in getTags(event.tags_comma_separated)"
                  :key="tag"
                  class="text-[10px] border border-outline-variant px-2 py-1 uppercase text-white"
                >
                  {{ tag }}
                </span>
              </div>
            </div>
            <div class="mt-8 flex gap-3">
              <PrismicLink
                v-if="isFilled.link(event.tickets_button_link)"
                :field="event.tickets_button_link"
                class="flex-1 py-3 bg-white text-background font-headline font-black italic uppercase tracking-tighter hover:bg-primary hover:text-white transition-colors text-center"
              >
                {{ event.tickets_button_text }}
              </PrismicLink>
              <PrismicLink
                v-if="isFilled.link(event.stream_button_link)"
                :field="event.stream_button_link"
                class="flex-1 py-3 bg-primary-container text-white font-headline font-black italic uppercase tracking-tighter hover:bg-primary hover:text-white transition-colors flex items-center justify-center"
              >
                {{ event.stream_button_text }}
              </PrismicLink>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

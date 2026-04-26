<script setup lang="ts">
import { isFilled } from "@prismicio/client";
import { asDate } from "@prismicio/client";
import type { Content } from "@prismicio/client";
import { ref, onMounted, onUnmounted, nextTick } from "vue";

const props = defineProps(
  getSliceComponentProps<Content.UpcomingEventsGridSlice>(["slice", "index", "slices", "context"]),
);

const getTags = (tagsString: string | null | undefined) => {
  if (!tagsString) return [];
  return tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
};

const sectionRef = ref<HTMLElement | null>(null);
const isHeaderInView = ref(false);
const cardStates = ref<Record<number, boolean>>({});
let headerObserver: IntersectionObserver | null = null;
let cardObserver: IntersectionObserver | null = null;

onMounted(async () => {
  await nextTick();
  if (!sectionRef.value) return;

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
  const header = sectionRef.value.querySelector("[data-section-header]");
  if (header) headerObserver.observe(header);

  const cards = sectionRef.value.querySelectorAll<HTMLElement>("[data-event-index]");
  cards.forEach((card, index) => {
    const rect = card.getBoundingClientRect();
    const isAboveFold = rect.top < window.innerHeight && rect.bottom > 0;
    if (isAboveFold) {
      setTimeout(() => {
        cardStates.value[index] = true;
      }, index * 120);
    }
  });

  cardObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          const idx = Number(el.dataset.eventIndex);
          const index = Array.from(cards).indexOf(el);
          if (!Number.isNaN(idx)) {
            setTimeout(() => {
              cardStates.value[idx] = true;
            }, index * 120);
          }
          cardObserver?.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  cards.forEach((card) => {
    const idx = Number(card.dataset.eventIndex);
    if (Number.isNaN(idx) || !cardStates.value[idx]) {
      cardObserver?.observe(card);
    }
  });
});

onUnmounted(() => {
  headerObserver?.disconnect();
  cardObserver?.disconnect();
});
</script>

<template>
  <section
    ref="sectionRef"
    class="py-24 px-8 bg-surface-dim"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <div class="max-w-7xl mx-auto">
      <div
        data-section-header
        class="flex items-end justify-between mb-16 border-b border-outline-variant pb-8"
      >
        <div class="mma-fade-up" :class="{ 'mma-active': isHeaderInView }">
          <h2 class="font-headline text-5xl font-black italic uppercase tracking-tighter">
            {{ slice.primary.title }}
          </h2>
          <p class="text-secondary mt-2 uppercase tracking-widest text-sm">
            {{ slice.primary.subtitle }}
          </p>
        </div>
        <div class="hidden md:block mma-fade-right" :class="{ 'mma-active': isHeaderInView }" :style="{ transitionDelay: '0.15s' }">
          <span class="text-8xl font-black italic opacity-5 font-headline">{{ slice.primary.decorative_text }}</span>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <article
          v-for="(event, index) in slice.primary.events"
          :key="index"
          :data-event-index="index"
          class="group relative bg-surface-container-low p-8 flex flex-col md:flex-row gap-8 hover:bg-surface-container-high transition-colors mma-fade-up"
          :class="{ 'mma-active': cardStates[index] }"
          :style="{ transitionDelay: `${index * 120}ms` }"
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

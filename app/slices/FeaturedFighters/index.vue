<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from "vue";
import * as prismic from "@prismicio/client";
import { isFilled } from "@prismicio/client";
import type { Content } from "@prismicio/client";

const PLACEHOLDER_IMAGE = "/fighter-placeholder.svg";

interface FighterCard {
  id: string;
  name: string;
  nickname: string;
  record: string;
  from: string;
  height: string;
  age: string;
  image: string;
}

const props = defineProps(
  getSliceComponentProps<Content.FeaturedFightersSlice>(["slice", "index", "slices", "context"]),
);

const { client } = usePrismic();
const { locale } = useI18n();

const sectionRef = ref<HTMLElement | null>(null);
const isMobileViewport = ref(false);
const isInView = ref(false);
const cardStates = ref<Record<string, boolean>>({});

let mobileViewportQuery: MediaQueryList | null = null;
let observer: IntersectionObserver | null = null;
let cardObserver: IntersectionObserver | null = null;

const initializeCardObserver = () => {
  cardObserver?.disconnect();
  cardObserver = null;

  const cards = sectionRef.value?.querySelectorAll<HTMLElement>("[data-fighter-id]");
  if (!cards?.length) return;

  cards.forEach((card, index) => {
    const id = card.dataset.fighterId;
    if (!id) return;

    const rect = card.getBoundingClientRect();
    const isAboveFold = rect.top < window.innerHeight && rect.bottom > 0;

    if (isAboveFold) {
      setTimeout(() => {
        cardStates.value[id] = true;
      }, index * 100);
    }
  });

  cardObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          const id = el.dataset.fighterId;
          const index = Array.from(cards).indexOf(el);

          if (id) {
            setTimeout(() => {
              cardStates.value[id] = true;
            }, index * 100);
          }
          cardObserver?.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  cards.forEach((card) => {
    const id = card.dataset.fighterId;
    if (!id || !cardStates.value[id]) {
      cardObserver?.observe(card);
    }
  });
};

const handleViewportChange = () => {
  isMobileViewport.value = mobileViewportQuery?.matches ?? false;
};

const referencedFighterDocumentIds = computed(() =>
  Array.from(
    new Set(
      props.slice.primary.fighters.flatMap((item) =>
        isFilled.contentRelationship(item.fighter) ? [item.fighter.id] : [],
      ),
    ),
  ),
);

const { data: fighterDocuments } = await useAsyncData(
  () =>
    `featured-fighters-${props.index}-${locale.value}-${referencedFighterDocumentIds.value.join(",") || "none"}`,
  () => {
    if (referencedFighterDocumentIds.value.length === 0) {
      return Promise.resolve([] as Content.FighterDocument[]);
    }

    return client.getAllByType("fighter", {
      lang: locale.value,
      filters: [prismic.filter.any("document.id", referencedFighterDocumentIds.value)],
    });
  },
  {
    watch: [locale, referencedFighterDocumentIds],
  },
);

const fighterDocumentsById = computed(
  () =>
    new Map(
      (fighterDocuments.value ?? []).map((fighterDocument) => [fighterDocument.id, fighterDocument]),
    ),
);

const fighters = computed<FighterCard[]>(() =>
  props.slice.primary.fighters
    .map((item) => {
      if (!isFilled.contentRelationship(item.fighter)) {
        return null;
      }

      const fighterDocument = fighterDocumentsById.value.get(item.fighter.id);

      if (!fighterDocument) {
        return null;
      }

      const fighterData = fighterDocument.data;
      const imageField = fighterData?.image;

      const image =
        isFilled.image(imageField) && imageField.url ? imageField.url : PLACEHOLDER_IMAGE;

      return {
        id: fighterDocument.uid || fighterDocument.id,
        name: fighterData?.name || "Unknown Fighter",
        nickname: fighterData?.nickname || "",
        record: fighterData?.record || "—",
        from: fighterData?.from || "—",
        height: fighterData?.height || "—",
        age: fighterData?.age || "—",
        image,
      };
    })
    .filter((fighter): fighter is FighterCard => fighter !== null),
);

onMounted(async () => {
  mobileViewportQuery = window.matchMedia("(max-width: 767px)");
  mobileViewportQuery.addEventListener("change", handleViewportChange);
  isMobileViewport.value = mobileViewportQuery.matches;

  await nextTick();
  initializeCardObserver();

  if (sectionRef.value) {
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
  }
});

onUnmounted(() => {
  mobileViewportQuery?.removeEventListener("change", handleViewportChange);
  observer?.disconnect();
  cardObserver?.disconnect();
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
      <div class="mma-fade-up" :class="{ 'mma-active': isInView }">
        <p class="text-primary font-black uppercase tracking-widest mb-2">
          {{ slice.primary.subtitle }}
        </p>
        <h2 class="font-headline text-6xl font-black italic uppercase tracking-tighter">
          {{ slice.primary.title }}
        </h2>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-10">
      <NuxtLink
        v-for="(fighter, index) in fighters"
        :key="fighter.id"
        :to="`/fighters/${fighter.id}`"
        class="group relative bg-surface-container-low overflow-hidden hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary-container/10 transition-all duration-500"
        :class="{ 'mt-8 md:mt-0': index === 0 || index === 2 }"
        :data-fighter-id="fighter.id"
      >
        <div
          class="aspect-[3/4] overflow-hidden clip-slanted"
          :class="[
            'mma-fade-up',
            { 'mma-active': cardStates[fighter.id] }
          ]"
          :style="{ transitionDelay: `${index * 100}ms` }"
        >
          <img
            :alt="fighter.name"
            loading="lazy"
            decoding="async"
            fetchpriority="low"
            :class="[
              'w-full h-full object-cover transition-all duration-500',
              isMobileViewport && cardStates[fighter.id]
                ? 'grayscale-0 scale-100'
                : 'grayscale group-hover:grayscale-0 scale-105 group-hover:scale-100',
            ]"
            :src="fighter.image"
          />
        </div>
        <div
          class="p-8"
          :class="[
            'mma-fade-up',
            { 'mma-active': cardStates[fighter.id] }
          ]"
          :style="{ transitionDelay: `${index * 100 + 80}ms` }"
        >
          <div class="flex justify-between items-start mb-6">
            <div>
              <h3 class="font-headline text-3xl font-black italic uppercase leading-none">
                {{ fighter.name }}
              </h3>
              <p v-if="fighter.nickname" class="text-primary font-bold uppercase text-xs mt-1">
                '{{ fighter.nickname }}'
              </p>
            </div>
            <div class="text-right">
              <p class="text-2xl font-black italic">{{ fighter.record }}</p>
              <p class="text-[10px] uppercase font-bold text-on-surface-variant">Record</p>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div class="text-center bg-background py-2">
              <p class="text-xs uppercase font-bold text-on-surface-variant">Nationality</p>
              <p class="font-black text-lg">{{ fighter.from }}</p>
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
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.clip-slanted {
  clip-path: polygon(0 0, 100% 0, 100% 85%, 0% 100%);
}
</style>

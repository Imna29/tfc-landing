<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from "vue";
import { isFilled } from "@prismicio/client";
import { asDate } from "@prismicio/client";
import type { Content } from "@prismicio/client";

defineProps(
  getSliceComponentProps<Content.LatestNewsSlice>(["slice", "index", "slices", "context"]),
);

const sectionRef = ref<HTMLElement | null>(null);
const cardStates = ref<Record<number, boolean>>({});
const isHeaderInView = ref(false);
const isMobileViewport = ref(false);

let mobileViewportQuery: MediaQueryList | null = null;
let cardObserver: IntersectionObserver | null = null;
let headerObserver: IntersectionObserver | null = null;

const initializeObservers = async () => {
  await nextTick();
  if (!sectionRef.value) return;

  const newsCards = sectionRef.value.querySelectorAll<HTMLElement>("[data-article-index]");
  if (!newsCards?.length) return;

  newsCards.forEach((card, index) => {
    const idx = Number(card.dataset.articleIndex);
    if (Number.isNaN(idx)) return;

    const rect = card.getBoundingClientRect();
    const isAboveFold = rect.top < window.innerHeight && rect.bottom > 0;

    if (isAboveFold) {
      setTimeout(() => {
        cardStates.value[idx] = true;
      }, index * 100);
    }
  });

  cardObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          const idx = Number(el.dataset.articleIndex);
          const index = Array.from(newsCards).indexOf(el);

          if (!Number.isNaN(idx)) {
            setTimeout(() => {
              cardStates.value[idx] = true;
            }, index * 100);
          }
          cardObserver?.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  newsCards.forEach((card) => {
    const idx = Number(card.dataset.articleIndex);
    if (Number.isNaN(idx) || !cardStates.value[idx]) {
      cardObserver?.observe(card);
    }
  });

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
};

const handleViewportChange = () => {
  isMobileViewport.value = mobileViewportQuery?.matches ?? false;
};

onMounted(async () => {
  mobileViewportQuery = window.matchMedia("(max-width: 767px)");
  mobileViewportQuery.addEventListener("change", handleViewportChange);
  isMobileViewport.value = mobileViewportQuery.matches;

  await initializeObservers();
});

onUnmounted(() => {
  mobileViewportQuery?.removeEventListener("change", handleViewportChange);
  cardObserver?.disconnect();
  headerObserver?.disconnect();
});
</script>

<template>
  <section
    ref="sectionRef"
    class="py-24 px-6 md:px-20 container mx-auto"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <h2
      data-section-header
      class="font-headline text-5xl font-black italic uppercase tracking-tighter mb-12 border-b-8 border-primary-container inline-block leading-none mma-fade-up"
      :class="{ 'mma-active': isHeaderInView }"
    >
      {{ slice.primary.title }}
    </h2>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-12">
      <article
        v-for="(article, index) in slice.primary.articles"
        :key="index"
        class="flex flex-col mma-fade-up"
        :class="{ 'mma-active': cardStates[index] }"
        :style="{ transitionDelay: `${index * 100}ms` }"
        :data-article-index="index"
      >
        <div class="bg-surface-container-highest mb-6 overflow-hidden">
          <img
            v-if="isFilled.image(article.image)"
            :alt="article.title || 'Article'"
            loading="lazy"
            decoding="async"
            fetchpriority="low"
            :class="[
              'w-full h-48 object-cover transition-all',
              isMobileViewport && cardStates[index]
                ? 'grayscale-0'
                : 'grayscale hover:grayscale-0',
            ]"
            :src="article.image.url"
          >
        </div>
        <time class="text-primary font-black uppercase text-xs mb-2">
          {{ asDate(article.date)?.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}
        </time>
        <component
          :is="isFilled.link(article.article_link) ? 'a' : 'div'"
          v-bind="isFilled.link(article.article_link) ? { href: article.article_link.url, target: article.article_link.target } : {}"
        >
          <h3 class="font-headline text-2xl font-black italic uppercase leading-tight mb-4 hover:text-primary transition-colors cursor-pointer">
            {{ article.title }}
          </h3>
        </component>
        <p class="text-on-surface-variant line-clamp-3">{{ article.excerpt }}</p>
      </article>
    </div>
  </section>
</template>
